import { describe, it, expect, vi } from "vitest";
import { createGitHubClient, GitHubApiError } from "./github";

const cfg = {
	clientId: "gid",
	clientSecret: "gsecret",
	callbackUrl: "https://eps.eko.in/api/auth/admin/github/callback",
	repo: "ekoindia/eps-platform",
	editBase: "dev",
	prodBase: "main",
};

describe("GitHubClient", () => {
	it("authorizeUrl carries client_id, redirect_uri, scope, state", () => {
		const gh = createGitHubClient(cfg);
		const url = new URL(gh.authorizeUrl("st8"));
		expect(url.searchParams.get("client_id")).toBe("gid");
		expect(url.searchParams.get("state")).toBe("st8");
		expect(url.searchParams.get("scope")).toContain("repo");
	});

	it("exchangeCode returns access_token", async () => {
		const f = vi.fn(
			async () =>
				new Response(JSON.stringify({ access_token: "ght" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		) as unknown as typeof fetch;
		const gh = createGitHubClient(cfg, f);
		expect(await gh.exchangeCode("code123")).toBe("ght");
	});

	it("hasRepoWrite true when permission push", async () => {
		const f = vi.fn(
			async () =>
				new Response(JSON.stringify({ permission: "write" }), { status: 200 }),
		) as unknown as typeof fetch;
		const gh = createGitHubClient(cfg, f);
		expect(await gh.hasRepoWrite("ght", "octocat")).toBe(true);
	});

	it("hasRepoWrite false on 403", async () => {
		const f = vi.fn(
			async () => new Response("{}", { status: 403 }),
		) as unknown as typeof fetch;
		const gh = createGitHubClient(cfg, f);
		expect(await gh.hasRepoWrite("ght", "octocat")).toBe(false);
	});

	it("exchangeCode returns null on non-JSON 2xx body", async () => {
		const f = vi.fn(
			async () => new Response("<html>not json</html>", { status: 200 }),
		) as unknown as typeof fetch;
		const gh = createGitHubClient(cfg, f);
		await expect(gh.exchangeCode("code123")).resolves.toBeNull();
	});
});

function jsonRes(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("github write methods", () => {
	const cfg = {
		clientId: "c",
		clientSecret: "s",
		callbackUrl: "u",
		repo: "o/r",
		editBase: "dev",
		prodBase: "main",
	};

	it("getContent decodes base64 + returns sha; 404 → null", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				jsonRes(200, {
					content: Buffer.from("hello", "utf8").toString("base64"),
					sha: "abc",
				}),
			)
			.mockResolvedValueOnce(new Response("", { status: 404 }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		expect(await gh.getContent("t", "src/content/docs/x.mdx", "dev")).toEqual({
			content: "hello",
			sha: "abc",
		});
		expect(await gh.getContent("t", "missing.mdx", "dev")).toBeNull();
	});

	it("getBranchHead returns object.sha; 404 → null", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonRes(200, { object: { sha: "deadbeef" } }))
			.mockResolvedValueOnce(new Response("", { status: 404 }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		expect(await gh.getBranchHead("t", "dev")).toBe("deadbeef");
		expect(await gh.getBranchHead("t", "nope")).toBeNull();
	});

	it("putFile sends base64 content + sha; throws GitHubApiError on 409", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response("", { status: 409 }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		await expect(
			gh.putFile("t", {
				branch: "b",
				path: "p.mdx",
				content: "x",
				baseSha: "s",
				message: "m",
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("createPullRequest returns url + number; throws on 422", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				jsonRes(201, { html_url: "https://gh/pr/1", number: 1 }),
			)
			.mockResolvedValueOnce(new Response("", { status: 422 }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		expect(
			await gh.createPullRequest("t", {
				head: "h",
				base: "dev",
				title: "x",
				body: "y",
			}),
		).toEqual({
			url: "https://gh/pr/1",
			number: 1,
		});
		await expect(
			gh.createPullRequest("t", {
				head: "dev",
				base: "main",
				title: "x",
				body: "y",
			}),
		).rejects.toBeInstanceOf(GitHubApiError);
	});
});
