import { describe, it, expect, vi } from "vitest";
import { createGitHubClient } from "./github";

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
