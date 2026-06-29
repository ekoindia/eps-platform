import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { mountAdmin } from "./admin";
import { loadConfig } from "../config";
import { createInMemoryKV } from "../store/kv";
import { createSessions } from "../auth/session";
import { AppError, errorBody } from "./errors";
import type { GitHubClient } from "../clients/github";
import { createSecretBox } from "../store/secretbox";
import { randomBytes } from "node:crypto";

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
	COOKIE_SECURE: "false",
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

async function harness(github = ghMock()) {
	const kv = createInMemoryKV();
	const sessions = createSessions(cfg, kv);
	const app = new Hono();
	app.onError((err, c) =>
		err instanceof AppError
			? c.json(errorBody(err.code, err.message), err.status as 400)
			: c.json(errorBody("UPSTREAM_ERROR", "x"), 502),
	);
	mountAdmin(app, { cfg, sessions, kv, github });
	// seed an admin session + persisted token
	const sid = "sid-test";
	await kv.set(`ghtoken:${sid}`, "gh-secret", cfg.adminRefreshTtlSec);
	const at = await sessions.mintAccess({
		sub: "gh:octocat",
		role: "admin",
		orgId: 1,
		ghLogin: "octocat",
		sid,
	});
	const devAt = await sessions.mintAccess({
		sub: "9990000001",
		role: "developer",
		orgId: 1,
	});
	return {
		app,
		kv,
		github,
		adminCookie: `eps_at=${at}`,
		devCookie: `eps_at=${devAt}`,
	};
}

describe("admin routes gating", () => {
	it("rejects anonymous with 403", async () => {
		const { app } = await harness();
		expect((await app.request("/admin/docs")).status).toBe(403);
	});
	it("rejects a developer session with 403", async () => {
		const { app, devCookie } = await harness();
		expect(
			(await app.request("/admin/docs", { headers: { cookie: devCookie } }))
				.status,
		).toBe(403);
	});
	it("rejects an admin with no persisted token (NO_GH_TOKEN)", async () => {
		const { app, kv, adminCookie } = await harness();
		await kv.del("ghtoken:sid-test");
		const res = await app.request("/admin/docs", {
			headers: { cookie: adminCookie },
		});
		expect(res.status).toBe(401);
	});
});

describe("admin docs routes", () => {
	it("GET /admin/docs lists docs", async () => {
		const github = ghMock({
			listDir: vi
				.fn()
				.mockResolvedValueOnce([
					{ name: "g.mdx", path: "src/content/docs/g.mdx", type: "file" },
				])
				.mockResolvedValueOnce([]),
		});
		const { app, adminCookie } = await harness(github);
		const res = await app.request("/admin/docs", {
			headers: { cookie: adminCookie },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			docs: [
				{
					slug: "g",
					path: "src/content/docs/g.mdx",
					title: "g",
					type: "guide",
				},
			],
		});
	});
	it("GET /admin/docs/content requires path", async () => {
		const { app, adminCookie } = await harness();
		const res = await app.request("/admin/docs/content", {
			headers: { cookie: adminCookie },
		});
		expect(res.status).toBe(400);
	});
	it("POST /admin/docs/propose returns the PR", async () => {
		const { app, adminCookie } = await harness();
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "new",
				baseSha: "sha1",
				summary: "s",
			}),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			prUrl: "https://gh/pr/7",
			prNumber: 7,
		});
	});
	it("POST /admin/deploy/production returns the release PR", async () => {
		const { app, adminCookie } = await harness();
		const res = await app.request("/admin/deploy/production", {
			method: "POST",
			headers: { cookie: adminCookie },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ prUrl: "https://gh/pr/7", prNumber: 7 });
	});
});

// C3: CSRF Origin-allowlist on admin POSTs
describe("admin CSRF origin check", () => {
	it("POST /admin/docs/propose rejects a cross-origin request with 403 BAD_ORIGIN", async () => {
		const { app, adminCookie } = await harness();
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: {
				cookie: adminCookie,
				"Content-Type": "application/json",
				origin: "https://evil.example",
			},
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "new",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(403);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
			"BAD_ORIGIN",
		);
	});

	it("POST /admin/docs/propose allows a request from a corsOrigins origin", async () => {
		const { app, adminCookie } = await harness();
		// cfg.corsOrigins defaults to ["https://eps.eko.in"]
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: {
				cookie: adminCookie,
				"Content-Type": "application/json",
				origin: "https://eps.eko.in",
			},
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "new",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(200);
	});

	it("POST /admin/docs/propose with no origin header still succeeds", async () => {
		const { app, adminCookie } = await harness();
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: {
				cookie: adminCookie,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "new",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(200);
	});

	it("POST /admin/deploy/production rejects a cross-origin request with 403 BAD_ORIGIN", async () => {
		const { app, adminCookie } = await harness();
		const res = await app.request("/admin/deploy/production", {
			method: "POST",
			headers: {
				cookie: adminCookie,
				origin: "https://evil.example",
			},
		});
		expect(res.status).toBe(403);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
			"BAD_ORIGIN",
		);
	});
});

// Builds an app+admin with github + a REAL secretbox, returning the pieces.
function encHarness(github = ghMock()) {
	const secretbox = createSecretBox(randomBytes(32).toString("base64"));
	const kv = createInMemoryKV();
	const sessions = createSessions(cfg, kv, { secretbox });
	const app = new Hono();
	app.onError((err, c) =>
		err instanceof AppError
			? c.json(errorBody(err.code, err.message), err.status as 400)
			: c.json(errorBody("UPSTREAM_ERROR", "x"), 502),
	);
	mountAdmin(app, { cfg, sessions, kv, github, secretbox });
	return { app, kv, sessions, secretbox, github };
}

it("READ path: adminToken decrypts the stored ghtoken (github mock sees plaintext)", async () => {
	// listDir asserts the token it receives is the decrypted value.
	const github = ghMock({
		listDir: vi.fn(async (token: string) => {
			expect(token).toBe("gh-secret");
			return [];
		}),
	});
	const { app, kv, sessions, secretbox } = encHarness(github);
	const sid = "sid-enc";
	// Seed as ciphertext (what the write path will produce).
	await kv.set(
		`ghtoken:${sid}`,
		secretbox.encrypt("gh-secret"),
		cfg.adminRefreshTtlSec,
	);
	const at = await sessions.mintAccess({
		sub: "gh:octocat",
		role: "admin",
		orgId: 1,
		ghLogin: "octocat",
		sid,
	});
	const res = await app.request("/admin/docs", {
		headers: { cookie: `eps_at=${at}` },
	});
	expect(res.status).toBe(200);
	expect(github.listDir).toHaveBeenCalled(); // ensures the assertion above ran
});
