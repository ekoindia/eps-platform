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
import {
	createSecurityLogger,
	type SecurityRecord,
} from "../audit/securityLog";

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
		checkRepoWrite: vi.fn(async () => "write" as const),
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

function captureLog() {
	const records: SecurityRecord[] = [];
	const logger = createSecurityLogger({
		sink: (line) => records.push(JSON.parse(line) as SecurityRecord),
	});
	return { logger, records };
}

async function harness(
	github = ghMock(),
	securityLog?: ReturnType<typeof createSecurityLogger>,
) {
	const kv = createInMemoryKV();
	const sessions = createSessions(cfg, kv);
	const app = new Hono();
	app.onError((err, c) =>
		err instanceof AppError
			? c.json(errorBody(err.code, err.message), err.status as 400)
			: c.json(errorBody("UPSTREAM_ERROR", "x"), 502),
	);
	mountAdmin(app, { cfg, sessions, kv, github, securityLog });
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

describe("admin authz freshness", () => {
	it("propose with no-write → 403 WRITE_ACCESS_REVOKED, putFile never called", async () => {
		const github = ghMock({
			checkRepoWrite: vi.fn(async () => "no-write" as const),
		});
		const { app, adminCookie } = await harness(github);
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "s",
			}),
		});
		expect(res.status).toBe(403);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
			"WRITE_ACCESS_REVOKED",
		);
		expect(github.putFile).not.toHaveBeenCalled();
	});

	it("propose with unknown → 503 UPSTREAM_UNAVAILABLE", async () => {
		const github = ghMock({
			checkRepoWrite: vi.fn(async () => "unknown" as const),
		});
		const { app, adminCookie } = await harness(github);
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "s",
			}),
		});
		expect(res.status).toBe(503);
		expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
			"UPSTREAM_UNAVAILABLE",
		);
	});

	it("deploy with no-write → 403, createPullRequest never called", async () => {
		const github = ghMock({
			checkRepoWrite: vi.fn(async () => "no-write" as const),
		});
		const { app, adminCookie } = await harness(github);
		const res = await app.request("/admin/deploy/production", {
			method: "POST",
			headers: { cookie: adminCookie },
		});
		expect(res.status).toBe(403);
		expect(github.createPullRequest).not.toHaveBeenCalled();
	});

	it("propose throttles at PROPOSE_LIMIT+1 → 429 before the re-check", async () => {
		const github = ghMock(); // checkRepoWrite → "write"
		const { app, adminCookie } = await harness(github);
		let last = new Response();
		for (let i = 0; i < 31; i++) {
			last = await app.request("/admin/docs/propose", {
				method: "POST",
				headers: { cookie: adminCookie, "Content-Type": "application/json" },
				body: JSON.stringify({
					path: "src/content/docs/g.mdx",
					content: "x",
					baseSha: "sha1",
				}),
			});
		}
		expect(last.status).toBe(429);
		// 30 allowed calls each ran the re-check; the throttled 31st did not.
		expect(
			(github.checkRepoWrite as ReturnType<typeof vi.fn>).mock.calls.length,
		).toBe(30);
	});

	it("deploy throttles at DEPLOY_LIMIT+1 → 429", async () => {
		const { app, adminCookie } = await harness();
		let last = new Response();
		for (let i = 0; i < 11; i++) {
			last = await app.request("/admin/deploy/production", {
				method: "POST",
				headers: { cookie: adminCookie },
			});
		}
		expect(last.status).toBe(429);
	});

	it("per-login budgets are independent", async () => {
		// Two admin sessions with distinct logins share one app/kv.
		const github = ghMock();
		const kv = createInMemoryKV();
		const sessions = createSessions(cfg, kv);
		const app = new Hono();
		app.onError((err, c) =>
			err instanceof AppError
				? c.json(errorBody(err.code, err.message), err.status as 400)
				: c.json(errorBody("UPSTREAM_ERROR", "x"), 502),
		);
		mountAdmin(app, { cfg, sessions, kv, github });
		async function admin(login: string): Promise<string> {
			const sid = `sid-${login}`;
			await kv.set(`ghtoken:${sid}`, "gh-secret", cfg.adminRefreshTtlSec);
			const at = await sessions.mintAccess({
				sub: `gh:${login}`,
				role: "admin",
				orgId: 1,
				ghLogin: login,
				sid,
			});
			return `eps_at=${at}`;
		}
		const deployOnce = (cookie: string) =>
			app.request("/admin/deploy/production", {
				method: "POST",
				headers: { cookie },
			});
		const a = await admin("alice");
		const b = await admin("bob");
		for (let i = 0; i < 11; i++) await deployOnce(a); // exhaust alice
		expect((await deployOnce(a)).status).toBe(429);
		expect((await deployOnce(b)).status).toBe(200); // bob unaffected
	});
});

describe("admin security logging", () => {
	it("logs propose denial on revoked write (reason WRITE_ACCESS_REVOKED, actor @login)", async () => {
		const { logger, records } = captureLog();
		const github = ghMock({
			checkRepoWrite: vi.fn(async () => "no-write" as const),
		});
		const { app, adminCookie } = await harness(github, logger);
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(403);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			event: "admin_mutation",
			outcome: "denied",
			action: "propose",
			actor: "@octocat",
			reason: "WRITE_ACCESS_REVOKED",
		});
	});

	it("logs propose denial reason UPSTREAM_UNAVAILABLE on unknown repo-write", async () => {
		const { logger, records } = captureLog();
		const github = ghMock({
			checkRepoWrite: vi.fn(async () => "unknown" as const),
		});
		const { app, adminCookie } = await harness(github, logger);
		await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "sha1",
			}),
		});
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			action: "propose",
			actor: "@octocat",
			reason: "UPSTREAM_UNAVAILABLE",
		});
	});

	it("logs propose denial reason BAD_ORIGIN with actor unknown", async () => {
		const { logger, records } = captureLog();
		const { app, adminCookie } = await harness(ghMock(), logger);
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: {
				cookie: adminCookie,
				"Content-Type": "application/json",
				Origin: "https://evil.example",
			},
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(403);
		expect(records[0]).toMatchObject({
			action: "propose",
			actor: "unknown",
			reason: "BAD_ORIGIN",
		});
	});

	it("logs propose denial reason RATE_LIMITED at the throttle boundary", async () => {
		const { logger, records } = captureLog();
		const { app, adminCookie } = await harness(ghMock(), logger);
		for (let i = 0; i < 31; i++) {
			await app.request("/admin/docs/propose", {
				method: "POST",
				headers: { cookie: adminCookie, "Content-Type": "application/json" },
				body: JSON.stringify({
					path: "src/content/docs/g.mdx",
					content: "x",
					baseSha: "sha1",
				}),
			});
		}
		// Only the throttled 31st request is a denial.
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			action: "propose",
			actor: "@octocat",
			reason: "RATE_LIMITED",
		});
	});

	it("logs deploy denial with action deploy", async () => {
		const { logger, records } = captureLog();
		const github = ghMock({
			checkRepoWrite: vi.fn(async () => "no-write" as const),
		});
		const { app, adminCookie } = await harness(github, logger);
		await app.request("/admin/deploy/production", {
			method: "POST",
			headers: { cookie: adminCookie },
		});
		expect(records[0]).toMatchObject({
			action: "deploy",
			actor: "@octocat",
			reason: "WRITE_ACCESS_REVOKED",
		});
	});

	it("logs nothing on a successful propose", async () => {
		const { logger, records } = captureLog();
		const github = ghMock({
			getContent: vi.fn(async () => ({ content: "b", sha: "sha1" })),
		});
		const { app, adminCookie } = await harness(github, logger);
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(200);
		expect(records).toHaveLength(0);
	});

	it("logs nothing on a mid-work STALE_CONTENT (409) error", async () => {
		const { logger, records } = captureLog();
		const { GitHubApiError } = await import("../clients/github");
		const github = ghMock({
			putFile: vi.fn(async () => {
				throw new GitHubApiError(409, "conflict");
			}),
		});
		const { app, adminCookie } = await harness(github, logger);
		const res = await app.request("/admin/docs/propose", {
			method: "POST",
			headers: { cookie: adminCookie, "Content-Type": "application/json" },
			body: JSON.stringify({
				path: "src/content/docs/g.mdx",
				content: "x",
				baseSha: "sha1",
			}),
		});
		expect(res.status).toBe(409);
		expect(records).toHaveLength(0);
	});
});

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
