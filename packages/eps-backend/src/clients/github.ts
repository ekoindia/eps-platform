import type { Config } from "../config";

export interface GitHubUser {
	login: string;
	id: number;
}

export interface GitHubClient {
	authorizeUrl(state: string): string;
	exchangeCode(code: string): Promise<string | null>;
	getUser(accessToken: string): Promise<GitHubUser | null>;
	hasRepoWrite(accessToken: string, login: string): Promise<boolean>;
}

export function createGitHubClient(
	cfg: Config["github"],
	fetchImpl: typeof fetch = fetch,
): GitHubClient {
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
			const res = await fetchImpl(
				"https://github.com/login/oauth/access_token",
				{
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
				},
			);
			if (!res.ok) return null;
			try {
				const json = (await res.json()) as { access_token?: string };
				return json.access_token ?? null;
			} catch {
				return null;
			}
		},
		async getUser(accessToken) {
			const res = await fetchImpl("https://api.github.com/user", {
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
		async hasRepoWrite(accessToken, login) {
			const res = await fetchImpl(
				`https://api.github.com/repos/${cfg.repo}/collaborators/${login}/permission`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: "application/vnd.github+json",
						"User-Agent": "eps-backend",
					},
				},
			);
			if (!res.ok) return false;
			try {
				const json = (await res.json()) as { permission?: string };
				return json.permission === "write" || json.permission === "admin";
			} catch {
				return false;
			}
		},
	};
}
