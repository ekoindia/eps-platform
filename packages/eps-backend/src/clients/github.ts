import type { Config } from "../config";
import { withTimeout } from "./http";

/** Error thrown by GitHub write methods when the API returns a non-2xx status. */
export class GitHubApiError extends Error {
	public status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "GitHubApiError";
		this.status = status;
	}
}

/** Result of a repo-write check: confirmed write, confirmed no write, or could not determine. */
export type RepoWriteStatus = "write" | "no-write" | "unknown";

/** Builds the standard GitHub API headers for an authenticated request. */
function ghHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"User-Agent": "eps-backend",
		"Content-Type": "application/json",
	};
}

/** Percent-encodes each path segment while preserving slash separators. */
function encPath(path: string): string {
	return path.split("/").map(encodeURIComponent).join("/");
}

export interface GitHubUser {
	login: string;
	id: number;
}

export interface GitHubClient {
	authorizeUrl(state: string): string;
	exchangeCode(code: string): Promise<string | null>;
	getUser(accessToken: string): Promise<GitHubUser | null>;
	checkRepoWrite(accessToken: string, login: string): Promise<RepoWriteStatus>;
	getContent(
		token: string,
		path: string,
		ref: string,
	): Promise<{ content: string; sha: string } | null>;
	listDir(
		token: string,
		path: string,
		ref: string,
	): Promise<Array<{ name: string; path: string; type: string }>>;
	getBranchHead(token: string, branch: string): Promise<string | null>;
	createBranch(token: string, name: string, fromSha: string): Promise<void>;
	putFile(
		token: string,
		args: {
			branch: string;
			path: string;
			content: string;
			baseSha: string;
			message: string;
		},
	): Promise<void>;
	createPullRequest(
		token: string,
		args: { head: string; base: string; title: string; body: string },
	): Promise<{ url: string; number: number }>;
}

export function createGitHubClient(
	cfg: Config["github"],
	fetchImpl: typeof fetch = fetch,
): GitHubClient {
	const doFetch = withTimeout(fetchImpl);
	return {
		authorizeUrl(state) {
			const u = new URL("https://github.com/login/oauth/authorize");
			u.searchParams.set("client_id", cfg.clientId);
			u.searchParams.set("redirect_uri", cfg.callbackUrl);
			u.searchParams.set("scope", "read:user repo");
			u.searchParams.set("state", state);
			return u.toString();
		},
		async exchangeCode(code) {
			const res = await doFetch("https://github.com/login/oauth/access_token", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					"User-Agent": "eps-backend",
				},
				body: JSON.stringify({
					client_id: cfg.clientId,
					client_secret: cfg.clientSecret,
					code,
					redirect_uri: cfg.callbackUrl,
				}),
			});
			if (!res.ok) return null;
			try {
				const json = (await res.json()) as { access_token?: string };
				return json.access_token ?? null;
			} catch {
				return null;
			}
		},
		async getUser(accessToken) {
			const res = await doFetch("https://api.github.com/user", {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/vnd.github+json",
					"User-Agent": "eps-backend",
				},
			});
			if (!res.ok) return null;
			try {
				const u = (await res.json()) as { login?: string; id?: number };
				return u.login && u.id ? { login: u.login, id: u.id } : null;
			} catch {
				return null;
			}
		},
		async checkRepoWrite(accessToken, login) {
			let res: Response;
			try {
				res = await doFetch(
					`https://api.github.com/repos/${cfg.repo}/collaborators/${login}/permission`,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
							Accept: "application/vnd.github+json",
							"User-Agent": "eps-backend",
						},
					},
				);
			} catch {
				return "unknown"; // network error / timeout
			}
			if (res.ok) {
				try {
					const json = (await res.json()) as { permission?: unknown };
					if (typeof json.permission !== "string") return "unknown";
					return json.permission === "write" || json.permission === "admin"
						? "write"
						: "no-write";
				} catch {
					return "unknown"; // unparseable body
				}
			}
			// non-2xx: 401 (token rejected) and 404 (not a collaborator) are genuine
			// no-access; 403/429 are GitHub rate-limit/abuse and all else is transient.
			if (res.status === 401 || res.status === 404) return "no-write";
			return "unknown";
		},
		/** Reads a file's UTF-8 content and blob sha at a ref; null if absent. */
		async getContent(token, path, ref) {
			const res = await doFetch(
				`https://api.github.com/repos/${cfg.repo}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`,
				{ headers: ghHeaders(token) },
			);
			if (res.status === 404) return null;
			if (!res.ok)
				throw new GitHubApiError(res.status, `getContent ${res.status}`);
			const j = (await res.json()) as { content?: string; sha?: string };
			if (!j.sha || j.content === undefined) {
				throw new GitHubApiError(502, "Malformed contents response");
			}
			return {
				content: Buffer.from(j.content, "base64").toString("utf8"),
				sha: j.sha,
			};
		},
		/** Lists a directory at a ref; empty array if the directory is absent. */
		async listDir(token, path, ref) {
			const res = await doFetch(
				`https://api.github.com/repos/${cfg.repo}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`,
				{ headers: ghHeaders(token) },
			);
			if (res.status === 404) return [];
			if (!res.ok)
				throw new GitHubApiError(res.status, `listDir ${res.status}`);
			const arr = (await res.json()) as Array<{
				name?: string;
				path?: string;
				type?: string;
			}>;
			if (!Array.isArray(arr)) {
				throw new GitHubApiError(502, "Malformed directory response");
			}
			return arr.map((x) => ({
				name: x.name ?? "",
				path: x.path ?? "",
				type: x.type ?? "",
			}));
		},
		/** Returns the head commit sha of a branch; null if the branch is absent. */
		async getBranchHead(token, branch) {
			const res = await doFetch(
				`https://api.github.com/repos/${cfg.repo}/git/ref/heads/${encPath(branch)}`,
				{ headers: ghHeaders(token) },
			);
			if (res.status === 404) return null;
			if (!res.ok)
				throw new GitHubApiError(res.status, `getBranchHead ${res.status}`);
			const j = (await res.json()) as { object?: { sha?: string } };
			return j.object?.sha ?? null;
		},
		/** Creates a new branch ref pointing at fromSha. */
		async createBranch(token, name, fromSha) {
			const res = await doFetch(
				`https://api.github.com/repos/${cfg.repo}/git/refs`,
				{
					method: "POST",
					headers: ghHeaders(token),
					body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }),
				},
			);
			if (!res.ok)
				throw new GitHubApiError(res.status, `createBranch ${res.status}`);
		},
		/** Creates or updates a file on a branch (baseSha = the blob sha being replaced). */
		async putFile(token, args) {
			const res = await doFetch(
				`https://api.github.com/repos/${cfg.repo}/contents/${encPath(args.path)}`,
				{
					method: "PUT",
					headers: ghHeaders(token),
					body: JSON.stringify({
						message: args.message,
						content: Buffer.from(args.content, "utf8").toString("base64"),
						sha: args.baseSha,
						branch: args.branch,
					}),
				},
			);
			if (!res.ok)
				throw new GitHubApiError(res.status, `putFile ${res.status}`);
		},
		/** Opens a pull request; returns the PR's html_url and number. */
		async createPullRequest(token, args) {
			const res = await doFetch(
				`https://api.github.com/repos/${cfg.repo}/pulls`,
				{
					method: "POST",
					headers: ghHeaders(token),
					body: JSON.stringify({
						title: args.title,
						head: args.head,
						base: args.base,
						body: args.body,
					}),
				},
			);
			if (!res.ok)
				throw new GitHubApiError(res.status, `createPullRequest ${res.status}`);
			const j = (await res.json()) as { html_url?: string; number?: number };
			if (
				typeof j.html_url !== "string" ||
				j.html_url === "" ||
				typeof j.number !== "number" ||
				j.number <= 0
			) {
				throw new GitHubApiError(502, "Malformed pull response");
			}
			return { url: j.html_url, number: j.number };
		},
	};
}
