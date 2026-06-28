import type { Config } from "../config";
import { GitHubApiError, type GitHubClient } from "../clients/github";
import { AppError } from "../http/errors";
import {
	GUIDES_DIR,
	ENDPOINTS_DIR,
	isEditableDocPath,
	docTypeFromPath,
	slugFromPath,
} from "./docPaths";
import { randomUUID } from "node:crypto";

/** A doc the admin console can edit. */
export interface DocItem {
	slug: string;
	path: string;
	title: string;
	type: "guide" | "endpoint";
}

/** Creates the admin docs service: list, read, propose edits, and deploy to production. */
export function createDocsService(github: GitHubClient, cfg: Config) {
	const editBase = cfg.github.editBase;
	const prodBase = cfg.github.prodBase;

	return {
		/** Lists editable guides + endpoint notes on the edit branch. */
		async list(token: string): Promise<DocItem[]> {
			const [guides, endpoints] = await Promise.all([
				github.listDir(token, GUIDES_DIR, editBase),
				github.listDir(token, ENDPOINTS_DIR, editBase),
			]);
			const items: DocItem[] = [];
			for (const f of [...guides, ...endpoints]) {
				if (f.type !== "file" || !isEditableDocPath(f.path)) continue;
				items.push({
					slug: slugFromPath(f.path),
					path: f.path,
					title: slugFromPath(f.path),
					type: docTypeFromPath(f.path),
				});
			}
			return items;
		},

		/** Reads one editable doc's content + blob sha at the edit branch. */
		async getDoc(token: string, path: string) {
			if (!isEditableDocPath(path)) {
				throw new AppError(400, "BAD_PATH", "File is not editable");
			}
			const got = await github.getContent(token, path, editBase);
			if (!got) throw new AppError(404, "NOT_FOUND", "Doc not found");
			return { content: got.content, sha: got.sha, branch: editBase };
		},

		/** Commits an edit to a fresh branch and opens a PR into the edit branch. */
		async propose(
			token: string,
			input: {
				path: string;
				content: string;
				baseSha: string;
				summary: string;
				login: string;
			},
		): Promise<{ prUrl: string; branch: string; prNumber: number }> {
			const { path, content, baseSha, summary, login } = input;
			if (!isEditableDocPath(path)) {
				throw new AppError(400, "BAD_PATH", "File is not editable");
			}
			const head = await github.getBranchHead(token, editBase);
			if (!head)
				throw new AppError(502, "UPSTREAM_ERROR", `Cannot read ${editBase}`);
			const slug = slugFromPath(path);
			const branch = `edit/docs-${slug}-${randomUUID().slice(0, 8)}`;
			const message = summary
				? `docs: update ${slug}\n\n${summary}`
				: `docs: update ${slug}`;
			const body = `Proposed by @${login} via the admin console.${summary ? `\n\n${summary}` : ""}`;
			try {
				await github.createBranch(token, branch, head);
				await github.putFile(token, {
					branch,
					path,
					content,
					baseSha,
					message,
				});
				const pr = await github.createPullRequest(token, {
					head: branch,
					base: editBase,
					title: `docs: update ${slug}`,
					body,
				});
				return { prUrl: pr.url, branch, prNumber: pr.number };
			} catch (e) {
				if (e instanceof GitHubApiError) {
					if (e.status === 409) {
						throw new AppError(
							409,
							"STALE_CONTENT",
							"Doc changed upstream — reload before saving",
						);
					}
					if (e.status === 422) {
						throw new AppError(409, "NO_CHANGES", "No changes to propose");
					}
					throw new AppError(502, "UPSTREAM_ERROR", "GitHub request failed");
				}
				throw e;
			}
		},

		/** Opens a release PR promoting the edit branch to the production branch. */
		async deployProduction(
			token: string,
		): Promise<{ prUrl: string; prNumber: number }> {
			try {
				const pr = await github.createPullRequest(token, {
					head: editBase,
					base: prodBase,
					title: "release: deploy docs to production",
					body: `Promote ${editBase} → ${prodBase} via the admin console.`,
				});
				return { prUrl: pr.url, prNumber: pr.number };
			} catch (e) {
				if (e instanceof GitHubApiError && e.status === 422) {
					throw new AppError(
						409,
						"NOTHING_TO_DEPLOY",
						`${editBase} is already in sync with ${prodBase}`,
					);
				}
				if (e instanceof GitHubApiError) {
					throw new AppError(502, "UPSTREAM_ERROR", "GitHub request failed");
				}
				throw e;
			}
		},
	};
}
