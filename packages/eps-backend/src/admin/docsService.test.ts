import { describe, it, expect, vi } from "vitest";
import { createDocsService } from "./docsService";
import { GitHubApiError, type GitHubClient } from "../clients/github";
import { loadConfig } from "../config";

const cfg = loadConfig({
	JWT_SECRET: "x".repeat(32),
	SIMPLIBANK_API_HOST: "h",
	SIMPLIBANK_API_PORT: "1",
	SIMPLIBANK_API_PATH: "/p",
	EKO_DEVELOPER_KEY: "k",
	GITHUB_CLIENT_ID: "g",
	GITHUB_CLIENT_SECRET: "s",
	GITHUB_CALLBACK_URL: "https://x/cb",
	GITHUB_REPO: "o/r",
});

function ghMock(over: Partial<GitHubClient> = {}): GitHubClient {
	return {
		authorizeUrl: () => "",
		exchangeCode: vi.fn(async () => null),
		getUser: vi.fn(async () => null),
		hasRepoWrite: vi.fn(async () => true),
		getContent: vi.fn(async () => ({ content: "body", sha: "sha1" })),
		listDir: vi.fn(async () => []),
		getBranchHead: vi.fn(async () => "headsha"),
		createBranch: vi.fn(async () => undefined),
		putFile: vi.fn(async () => undefined),
		createPullRequest: vi.fn(async () => ({
			url: "https://gh/pr/7",
			number: 7,
		})),
		...over,
	};
}

describe("docsService.list", () => {
	it("maps guide + endpoint files, ignores non-editable + dirs", async () => {
		const github = ghMock({
			listDir: vi
				.fn()
				.mockResolvedValueOnce([
					{
						name: "how-auth-works.mdx",
						path: "src/content/docs/how-auth-works.mdx",
						type: "file",
					},
					{
						name: "docs-guides.ts",
						path: "src/content/docs/docs-guides.ts",
						type: "file",
					},
					{
						name: "endpoints",
						path: "src/content/docs/endpoints",
						type: "dir",
					},
				])
				.mockResolvedValueOnce([
					{
						name: "aeps-cw.md",
						path: "src/content/docs/endpoints/aeps-cw.md",
						type: "file",
					},
				]),
		});
		const svc = createDocsService(github, cfg);
		const docs = await svc.list("t");
		expect(docs).toEqual([
			{
				slug: "how-auth-works",
				path: "src/content/docs/how-auth-works.mdx",
				title: "how-auth-works",
				type: "guide",
			},
			{
				slug: "aeps-cw",
				path: "src/content/docs/endpoints/aeps-cw.md",
				title: "aeps-cw",
				type: "endpoint",
			},
		]);
	});
});

describe("docsService.getDoc", () => {
	it("returns content + sha + branch for an editable path", async () => {
		const svc = createDocsService(ghMock(), cfg);
		expect(
			await svc.getDoc("t", "src/content/docs/how-auth-works.mdx"),
		).toEqual({
			content: "body",
			sha: "sha1",
			branch: "dev",
		});
	});
	it("rejects a non-editable path with BAD_PATH", async () => {
		const svc = createDocsService(ghMock(), cfg);
		await expect(
			svc.getDoc("t", "src/lib/data/api-specs.ts"),
		).rejects.toMatchObject({ code: "BAD_PATH" });
	});
	it("throws NOT_FOUND when the file is absent", async () => {
		const svc = createDocsService(
			ghMock({ getContent: vi.fn(async () => null) }),
			cfg,
		);
		await expect(
			svc.getDoc("t", "src/content/docs/missing.mdx"),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("docsService.propose", () => {
	it("branches, commits, opens a PR into editBase", async () => {
		const github = ghMock();
		const svc = createDocsService(github, cfg);
		const out = await svc.propose("t", {
			path: "src/content/docs/how-auth-works.mdx",
			content: "new",
			baseSha: "sha1",
			summary: "tighten intro",
			login: "octocat",
		});
		expect(out).toEqual({
			prUrl: "https://gh/pr/7",
			branch: expect.stringMatching(/^edit\/docs-how-auth-works-/),
			prNumber: 7,
		});
		expect(github.createPullRequest).toHaveBeenCalledWith(
			"t",
			expect.objectContaining({ base: "dev", head: out.branch }),
		);
	});
	it("maps a putFile 409 to STALE_CONTENT", async () => {
		const github = ghMock({
			putFile: vi.fn(async () => {
				throw new GitHubApiError(409, "conflict");
			}),
		});
		const svc = createDocsService(github, cfg);
		await expect(
			svc.propose("t", {
				path: "src/content/docs/x.mdx",
				content: "c",
				baseSha: "s",
				summary: "",
				login: "o",
			}),
		).rejects.toMatchObject({ code: "STALE_CONTENT", status: 409 });
	});
	it("rejects a non-editable path with BAD_PATH", async () => {
		const svc = createDocsService(ghMock(), cfg);
		await expect(
			svc.propose("t", {
				path: "evil.ts",
				content: "c",
				baseSha: "s",
				summary: "",
				login: "o",
			}),
		).rejects.toMatchObject({ code: "BAD_PATH" });
	});
});

describe("docsService.deployProduction", () => {
	it("opens a PR from editBase to prodBase", async () => {
		const github = ghMock();
		const svc = createDocsService(github, cfg);
		expect(await svc.deployProduction("t")).toEqual({
			prUrl: "https://gh/pr/7",
			prNumber: 7,
		});
		expect(github.createPullRequest).toHaveBeenCalledWith(
			"t",
			expect.objectContaining({ head: "dev", base: "main" }),
		);
	});
	it("maps a 422 (no diff) to NOTHING_TO_DEPLOY", async () => {
		const github = ghMock({
			createPullRequest: vi.fn(async () => {
				throw new GitHubApiError(422, "no commits");
			}),
		});
		const svc = createDocsService(github, cfg);
		await expect(svc.deployProduction("t")).rejects.toMatchObject({
			code: "NOTHING_TO_DEPLOY",
			status: 409,
		});
	});
});
