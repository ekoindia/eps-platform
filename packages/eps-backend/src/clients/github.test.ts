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

	it("checkRepoWrite: 200 write/admin → 'write'", async () => {
		for (const p of ["write", "admin"]) {
			const f = vi.fn(
				async () =>
					new Response(JSON.stringify({ permission: p }), { status: 200 }),
			) as unknown as typeof fetch;
			expect(
				await createGitHubClient(cfg, f).checkRepoWrite("t", "octocat"),
			).toBe("write");
		}
	});

	it("checkRepoWrite: 200 read/none/triage → 'no-write'", async () => {
		for (const p of ["read", "none", "triage"]) {
			const f = vi.fn(
				async () =>
					new Response(JSON.stringify({ permission: p }), { status: 200 }),
			) as unknown as typeof fetch;
			expect(
				await createGitHubClient(cfg, f).checkRepoWrite("t", "octocat"),
			).toBe("no-write");
		}
	});

	it("checkRepoWrite: 200 missing/non-string permission → 'unknown'", async () => {
		for (const b of [{}, { permission: 123 }, { permission: null }]) {
			const f = vi.fn(
				async () => new Response(JSON.stringify(b), { status: 200 }),
			) as unknown as typeof fetch;
			expect(
				await createGitHubClient(cfg, f).checkRepoWrite("t", "octocat"),
			).toBe("unknown");
		}
	});

	it("checkRepoWrite: 401 and 404 → 'no-write'", async () => {
		for (const s of [401, 404]) {
			const f = vi.fn(
				async () => new Response("", { status: s }),
			) as unknown as typeof fetch;
			expect(
				await createGitHubClient(cfg, f).checkRepoWrite("t", "octocat"),
			).toBe("no-write");
		}
	});

	it("checkRepoWrite: 403/429/422/500 → 'unknown'", async () => {
		for (const s of [403, 429, 422, 500]) {
			const f = vi.fn(
				async () => new Response("", { status: s }),
			) as unknown as typeof fetch;
			expect(
				await createGitHubClient(cfg, f).checkRepoWrite("t", "octocat"),
			).toBe("unknown");
		}
	});

	it("checkRepoWrite: network throw and unparseable 200 → 'unknown'", async () => {
		const thrower = vi.fn(async () => {
			throw new Error("net");
		}) as unknown as typeof fetch;
		expect(
			await createGitHubClient(cfg, thrower).checkRepoWrite("t", "octocat"),
		).toBe("unknown");
		const badBody = vi.fn(
			async () => new Response("<html>not json</html>", { status: 200 }),
		) as unknown as typeof fetch;
		expect(
			await createGitHubClient(cfg, badBody).checkRepoWrite("t", "octocat"),
		).toBe("unknown");
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

	it("getBranchHead preserves slashes in multi-segment branch names", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonRes(200, { object: { sha: "abc" } }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		await gh.getBranchHead("t", "feature/my-branch");
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://api.github.com/repos/o/r/git/ref/heads/feature/my-branch",
			expect.anything(),
		);
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

	// C4: malformed 2xx (missing html_url / number) must throw 502
	it("createPullRequest throws GitHubApiError 502 on 2xx missing html_url", async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(201, {}));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		await expect(
			gh.createPullRequest("t", {
				head: "h",
				base: "dev",
				title: "x",
				body: "y",
			}),
		).rejects.toMatchObject({ status: 502 });
	});

	it("createPullRequest throws GitHubApiError 502 on 2xx with number=0", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				jsonRes(201, { html_url: "https://gh/pr/1", number: 0 }),
			);
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		await expect(
			gh.createPullRequest("t", {
				head: "h",
				base: "dev",
				title: "x",
				body: "y",
			}),
		).rejects.toMatchObject({ status: 502 });
	});

	// C5: listDir must throw 502 on non-array payload; 404 still returns []
	it("listDir throws GitHubApiError 502 when response body is not an array", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonRes(200, { name: "not-an-array" }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		await expect(
			gh.listDir("t", "src/content/docs", "dev"),
		).rejects.toMatchObject({
			status: 502,
		});
	});

	it("listDir returns [] on 404", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response("", { status: 404 }));
		const gh = createGitHubClient(cfg, fetchImpl as unknown as typeof fetch);
		expect(await gh.listDir("t", "missing", "dev")).toEqual([]);
	});
});
