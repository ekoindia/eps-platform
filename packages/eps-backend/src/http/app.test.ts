import { describe, it, expect, vi } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "../config";
import { createInMemoryKV } from "../store/kv";
import { createSessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
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

function deps(over: Partial<EkoClient> = {}) {
	const kv = createInMemoryKV();
	const eko: EkoClient = {
		sendOtp: vi.fn(async () => ({ ok: true, raw: {} })),
		verifyOtp: vi.fn(async () => ({ ok: true, raw: {} })),
		getProfile: vi.fn(async () => ({
			kind: "found" as const,
			responseTypeId: 369,
			profile: {
				name: "Dev",
				email: "d@e.in",
				mobile: "9990000001",
				code: 1,
				userType: "merchant",
				ekoUserId: "EKO1",
				roleList: ["1"],
				orgId: 1,
				onboarding: 0,
				zohoId: "ZCRM_9",
			},
		})),
		...over,
	};
	const zoho: ZohoClient = { findLead: vi.fn(async () => false) };
	const sessions = createSessions(cfg, kv);
	return {
		app: createApp({ cfg, eko, zoho, sessions, kv }),
		eko,
		zoho,
		sessions,
		kv,
	};
}

function cookieFrom(res: Response): string {
	const set = res.headers.getSetCookie?.() ?? [];
	return set.map((c) => c.split(";")[0]).join("; ");
}

async function body<T>(res: Response): Promise<T> {
	return (await res.json()) as T;
}

describe("healthz", () => {
	it("returns ok", async () => {
		const { app } = deps();
		const res = await app.request("/healthz");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});
});

describe("otp/start", () => {
	it("returns generic 200 and calls eko.sendOtp", async () => {
		const { app, eko } = deps();
		const res = await app.request("/auth/otp/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001" }),
		});
		expect(res.status).toBe(200);
		expect(eko.sendOtp).toHaveBeenCalled();
	});

	it("400 when mobile missing", async () => {
		const { app } = deps();
		const res = await app.request("/auth/otp/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"INVALID_INPUT",
		);
	});

	it("429 after exceeding the per-mobile window", async () => {
		const { app } = deps();
		let last = new Response();
		for (let i = 0; i < 6; i++) {
			last = await app.request("/auth/otp/start", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mobile: "9990000002" }),
			});
		}
		expect(last.status).toBe(429);
	});

	it("buckets formatting variants of the same mobile together", async () => {
		const { app } = deps();
		const formats = ["99900 00004", "9990000004", "999-000-0004"];
		let last = new Response();
		for (let i = 0; i < 6; i++) {
			last = await app.request("/auth/otp/start", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mobile: formats[i % formats.length] }),
			});
		}
		expect(last.status).toBe(429);
	});

	it("buckets country-code / leading-zero prefixes of the same number together", async () => {
		const { app } = deps();
		// Same physical number, re-prefixed each call — must not reset the window.
		const variants = ["9990000005", "919990000005", "09990000005"];
		let last = new Response();
		for (let i = 0; i < 6; i++) {
			last = await app.request("/auth/otp/start", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mobile: variants[i % variants.length] }),
			});
		}
		expect(last.status).toBe(429);
	});

	it("400 INVALID_INPUT for a non-numeric mobile", async () => {
		const { app } = deps();
		const res = await app.request("/auth/otp/start", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ mobile: "abc" }),
		});
		expect(res.status).toBe(400);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"INVALID_INPUT",
		);
	});
});

describe("otp/verify + me", () => {
	it("verifies, sets cookies, then /me returns the view", async () => {
		const { app } = deps();
		const verify = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "123456" }),
		});
		expect(verify.status).toBe(200);
		const vbody = await body<{ state: string; zohoId: string | null }>(verify);
		expect(vbody.state).toBe("active");
		expect(vbody.zohoId).toBe("ZCRM_9");

		const cookie = cookieFrom(verify);
		expect(cookie).toContain("eps_at=");

		const me = await app.request("/me", { headers: { cookie } });
		expect(me.status).toBe(200);
		const meBody = await body<{ profile: { ekoUserId: string } | null }>(me);
		expect(meBody.profile?.ekoUserId).toBe("EKO1");
	});

	it("401 on bad otp", async () => {
		const { app } = deps({
			verifyOtp: vi.fn(async () => ({ ok: false, raw: {} })),
		});
		const res = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "000000" }),
		});
		expect(res.status).toBe(401);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"OTP_INVALID",
		);
	});

	it("/me 401 without a session", async () => {
		const { app } = deps();
		const res = await app.request("/me");
		expect(res.status).toBe(401);
	});

	it("429 after too many failed otp attempts", async () => {
		const { app } = deps({
			verifyOtp: vi.fn(async () => ({ ok: false, raw: {} })),
		});
		const attempt = () =>
			app.request("/auth/otp/verify", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mobile: "9990000003", otp: "000000" }),
			});
		for (let i = 0; i < 5; i++) {
			const r = await attempt();
			expect(r.status).toBe(401);
		}
		const blocked = await attempt();
		expect(blocked.status).toBe(429);
		expect((await body<{ error: { code: string } }>(blocked)).error.code).toBe(
			"RATE_LIMITED",
		);
	});
});

describe("refresh", () => {
	async function login(app: ReturnType<typeof deps>["app"]): Promise<string> {
		const verify = await app.request("/auth/otp/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ mobile: "9990000001", otp: "123456" }),
		});
		expect(verify.status).toBe(200);
		return cookieFrom(verify);
	}

	it("rotates cookies and is single-use", async () => {
		const { app } = deps();
		const original = await login(app);
		expect(original).toContain("eps_rt=");

		const refreshed = await app.request("/auth/refresh", {
			method: "POST",
			headers: { cookie: original },
		});
		expect(refreshed.status).toBe(200);
		const set = refreshed.headers.getSetCookie?.() ?? [];
		expect(set.join(";")).toContain("eps_at=");
		expect(set.join(";")).toContain("eps_rt=");

		// Reusing the original (now-rotated) refresh cookie must fail.
		const replay = await app.request("/auth/refresh", {
			method: "POST",
			headers: { cookie: original },
		});
		expect(replay.status).toBe(401);
		expect((await body<{ error: { code: string } }>(replay)).error.code).toBe(
			"SESSION_EXPIRED",
		);
	});

	it("401 NO_SESSION without a refresh cookie", async () => {
		const { app } = deps();
		const res = await app.request("/auth/refresh", { method: "POST" });
		expect(res.status).toBe(401);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"NO_SESSION",
		);
	});
});

describe("logout", () => {
	it("clears cookies", async () => {
		const { app } = deps();
		const res = await app.request("/auth/logout", { method: "POST" });
		expect(res.status).toBe(200);
		const set = res.headers.getSetCookie?.() ?? [];
		expect(set.join(";")).toContain("eps_at=");
	});

	it("clears cookies on logout even when the store revoke fails", async () => {
		const base = deps();
		// Refresh store: set works (to mint the token); del rejects (simulate outage).
		const failingKv = {
			...base.kv,
			del: vi.fn(async () => {
				throw new Error("redis down");
			}),
		};
		const sessions = createSessions(cfg, failingKv);
		// `deps()` does not return `cfg`; pass the module-level `cfg` explicitly.
		const app = createApp({ ...base, cfg, kv: failingKv, sessions });
		// Mint a real refresh token so the handler actually attempts revocation.
		const rt = await sessions.issueRefresh({
			sub: "9990000001",
			role: "developer",
			orgId: 1,
		});
		const res = await app.request("/auth/logout", {
			method: "POST",
			headers: { cookie: `eps_rt=${rt}` },
		});
		expect(res.status).toBe(200);
		const cookies = res.headers.getSetCookie?.() ?? [];
		// Both cookies are cleared (Max-Age=0) despite the store failure.
		expect(
			cookies.some((c) => c.startsWith("eps_at=") && c.includes("Max-Age=0")),
		).toBe(true);
		expect(
			cookies.some((c) => c.startsWith("eps_rt=") && c.includes("Max-Age=0")),
		).toBe(true);
	});

	it("clears both cookies for an admin session even when the store del fails", async () => {
		const base = deps();
		// Both refresh revoke and ghtoken del hit the store; del rejects (outage).
		const failingKv = {
			...base.kv,
			del: vi.fn(async () => {
				throw new Error("redis down");
			}),
		};
		const sessions = createSessions(cfg, failingKv);
		// `deps()` does not return `cfg`; pass the module-level `cfg` explicitly.
		const app = createApp({ ...base, cfg, kv: failingKv, sessions });
		// Admin-style session: access token carrying a sid drives the ghtoken-del
		// best-effort branch; refresh token drives the revoke branch.
		const adminClaim = {
			sub: "gh:octocat",
			role: "admin" as const,
			orgId: 1,
			ghLogin: "octocat",
			sid: crypto.randomUUID(),
		};
		const at = await sessions.mintAccess(adminClaim);
		const rt = await sessions.issueRefresh(adminClaim);
		const res = await app.request("/auth/logout", {
			method: "POST",
			headers: { cookie: `eps_at=${at}; eps_rt=${rt}` },
		});
		expect(res.status).toBe(200);
		const cookies = res.headers.getSetCookie?.() ?? [];
		// Both cookies cleared despite the ghtoken-del store failure.
		expect(
			cookies.some((c) => c.startsWith("eps_at=") && c.includes("Max-Age=0")),
		).toBe(true);
		expect(
			cookies.some((c) => c.startsWith("eps_rt=") && c.includes("Max-Age=0")),
		).toBe(true);
	});
});

function ghDeps(gh: Partial<GitHubClient>) {
	const base = deps();
	const github: GitHubClient = {
		authorizeUrl: (state) =>
			`https://github.com/login/oauth/authorize?state=${state}`,
		exchangeCode: vi.fn(async () => "ght"),
		getUser: vi.fn(async () => ({ login: "octocat", id: 1 })),
		checkRepoWrite: vi.fn(async () => "write" as const),
		getContent: vi.fn(async () => null),
		listDir: vi.fn(async () => []),
		getBranchHead: vi.fn(async () => "headsha"),
		createBranch: vi.fn(async () => undefined),
		putFile: vi.fn(async () => undefined),
		createPullRequest: vi.fn(async () => ({
			url: "https://gh/pr/1",
			number: 1,
		})),
		...gh,
	};
	// rebuild app with github included
	const kv = createInMemoryKV();
	const sessions = createSessions(cfg, kv);
	const app = createApp({
		cfg,
		eko: base.eko,
		zoho: base.zoho,
		sessions,
		kv,
		github,
	});
	return { app, github, kv, sessions };
}

describe("admin github", () => {
	it("start redirects to GitHub and stores state", async () => {
		const { app } = ghDeps({});
		const res = await app.request("/auth/admin/github");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("github.com/login/oauth");
	});

	it("callback with valid state + repo write → 302 redirect + admin session cookie", async () => {
		const { app } = ghDeps({});
		const start = await app.request("/auth/admin/github");
		const loc = new URL(start.headers.get("location")!);
		const state = loc.searchParams.get("state")!;
		const stateCookie = (start.headers.getSetCookie?.() ?? [])
			.map((c) => c.split(";")[0])
			.join("; ");

		const res = await app.request(
			`/auth/admin/github/callback?code=abc&state=${state}`,
			{ headers: { cookie: stateCookie } },
		);
		expect(res.status).toBe(302);
		// Default ADMIN_POST_LOGIN_REDIRECT is "/admin"
		expect(res.headers.get("location")).toBe("/admin");
		const set = res.headers.getSetCookie?.() ?? [];
		expect(set.join(";")).toContain("eps_at=");
	});

	it("callback without repo write → 403", async () => {
		const { app } = ghDeps({
			checkRepoWrite: vi.fn(async () => "no-write" as const),
		});
		const start = await app.request("/auth/admin/github");
		const loc = new URL(start.headers.get("location")!);
		const state = loc.searchParams.get("state")!;
		const stateCookie = (start.headers.getSetCookie?.() ?? [])
			.map((c) => c.split(";")[0])
			.join("; ");
		const res = await app.request(
			`/auth/admin/github/callback?code=abc&state=${state}`,
			{ headers: { cookie: stateCookie } },
		);
		expect(res.status).toBe(403);
	});

	it("callback with bad state → 400", async () => {
		const { app } = ghDeps({});
		const res = await app.request(
			"/auth/admin/github/callback?code=abc&state=forged",
		);
		expect(res.status).toBe(400);
	});

	it("callback issues an admin session cookie whose sid resolves a stored token", async () => {
		const { app, kv, sessions } = ghDeps({
			exchangeCode: vi.fn(async () => "gh-secret-token"),
		});
		const start = await app.request("/auth/admin/github");
		const loc = new URL(start.headers.get("location")!);
		const state = loc.searchParams.get("state")!;
		const stateCookie = (start.headers.getSetCookie?.() ?? [])
			.map((c) => c.split(";")[0])
			.join("; ");
		const res = await app.request(
			`/auth/admin/github/callback?code=abc&state=${state}`,
			{
				headers: { cookie: stateCookie },
			},
		);
		const cookies = res.headers.getSetCookie?.() ?? [];
		expect(cookies.join(";")).toContain("eps_at=");
		// Decode the access JWT to read its sid, then confirm the token was stored.
		const at = cookies
			.find((c) => c.startsWith("eps_at="))!
			.split(";")[0]
			.slice("eps_at=".length);
		const claim = await sessions.verifyAccess(at);
		expect(claim?.sid).toBeTruthy();
		expect(await kv.get(`ghtoken:${claim!.sid}`)).toBe("gh-secret-token");
	});

	it("callback with unknown repo-write status → 403 (no session)", async () => {
		const { app } = ghDeps({
			checkRepoWrite: vi.fn(async () => "unknown" as const),
		});
		const start = await app.request("/auth/admin/github");
		const loc = new URL(start.headers.get("location")!);
		const state = loc.searchParams.get("state")!;
		const stateCookie = (start.headers.getSetCookie?.() ?? [])
			.map((c) => c.split(";")[0])
			.join("; ");
		const res = await app.request(
			`/auth/admin/github/callback?code=abc&state=${state}`,
			{ headers: { cookie: stateCookie } },
		);
		expect(res.status).toBe(403);
		expect(res.headers.getSetCookie?.() ?? []).toEqual([]);
	});
});

// C1: ghtoken TTL is re-extended on admin refresh rotation
describe("admin refresh re-extends ghtoken", () => {
	it("ghtoken:<sid> is still present after /auth/refresh for admin session", async () => {
		const { app, kv, sessions } = ghDeps({
			exchangeCode: vi.fn(async () => "gh-secret-token"),
		});
		// Complete OAuth flow to get admin session cookies
		const start = await app.request("/auth/admin/github");
		const loc = new URL(start.headers.get("location")!);
		const state = loc.searchParams.get("state")!;
		const stateCookie = (start.headers.getSetCookie?.() ?? [])
			.map((c) => c.split(";")[0])
			.join("; ");
		const callbackRes = await app.request(
			`/auth/admin/github/callback?code=abc&state=${state}`,
			{ headers: { cookie: stateCookie } },
		);
		const callbackCookies = callbackRes.headers.getSetCookie?.() ?? [];
		const sessionCookies = callbackCookies
			.map((c) => c.split(";")[0])
			.join("; ");
		// Retrieve the admin sid from the access token
		const at = callbackCookies
			.find((c) => c.startsWith("eps_at="))!
			.split(";")[0]
			.slice("eps_at=".length);
		const claim = await sessions.verifyAccess(at);
		expect(claim?.sid).toBeTruthy();
		// Confirm the token is present before refresh
		expect(await kv.get(`ghtoken:${claim!.sid}`)).toBe("gh-secret-token");
		// Call /auth/refresh
		const refreshRes = await app.request("/auth/refresh", {
			method: "POST",
			headers: { cookie: sessionCookies },
		});
		expect(refreshRes.status).toBe(200);
		// Token must still be present after refresh rotation
		expect(await kv.get(`ghtoken:${claim!.sid}`)).toBe("gh-secret-token");
	});
});

describe("CORS", () => {
	it("responds with Access-Control-Allow-Origin for a known origin", async () => {
		const { app } = deps();
		const res = await app.request("/healthz", {
			headers: { Origin: "https://eps.eko.in" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBe(
			"https://eps.eko.in",
		);
	});
});

describe("/me for admin sessions", () => {
	it("returns admin view without calling eko.getProfile", async () => {
		const { app, eko, sessions } = deps();
		const token = await sessions.mintAccess({
			sub: "gh:octocat",
			role: "admin",
			orgId: 1,
			ghLogin: "octocat",
		});
		const res = await app.request("/me", {
			headers: { cookie: `eps_at=${token}` },
		});
		expect(res.status).toBe(200);
		const b = await body<{ role: string; login: string | null; sub: string }>(
			res,
		);
		expect(b.role).toBe("admin");
		expect(b.login).toBe("octocat");
		expect(eko.getProfile).not.toHaveBeenCalled();
	});
});

describe("otp/verify per-IP cap", () => {
	it("429 after too many failed verifies from one IP across different mobiles", async () => {
		const { app } = deps({
			verifyOtp: vi.fn(async () => ({ ok: false, raw: {} })),
		});
		// 50 failures from the same IP on 50 distinct mobiles exhaust the IP cap.
		let last = new Response();
		for (let i = 0; i < 51; i++) {
			const mobile = `9990${String(i).padStart(6, "0")}`;
			last = await app.request("/auth/otp/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-real-ip": "1.2.3.4",
				},
				body: JSON.stringify({ mobile, otp: "000000" }),
			});
		}
		expect(last.status).toBe(429);
		expect((await body<{ error: { code: string } }>(last)).error.code).toBe(
			"RATE_LIMITED",
		);
	});
});

describe("not found", () => {
	it("unknown route returns 404 with error envelope", async () => {
		const { app } = deps();
		const res = await app.request("/does/not/exist");
		expect(res.status).toBe(404);
		const b = await body<{ error: { code: string } }>(res);
		expect(b.error.code).toBe("NOT_FOUND");
	});
});

describe("/readyz", () => {
	it("/readyz is ready when no readiness probe is configured", async () => {
		const res = await deps().app.request("/readyz");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ready: true });
	});

	it("/readyz returns 503 when the readiness probe resolves false", async () => {
		const base = deps();
		const app = createApp({ ...base, cfg, readiness: async () => false });
		const res = await app.request("/readyz");
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ ready: false });
	});

	it("/readyz returns 503 when the readiness probe throws", async () => {
		const base = deps();
		const app = createApp({
			...base,
			cfg,
			readiness: async () => {
				throw new Error("redis down");
			},
		});
		const res = await app.request("/readyz");
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ ready: false });
	});
});

it("WRITE path: OAuth callback stores the ghtoken encrypted", async () => {
	const secretbox = createSecretBox(randomBytes(32).toString("base64"));
	const base = deps();
	const github: GitHubClient = {
		authorizeUrl: (state) => `https://x/authorize?state=${state}`,
		exchangeCode: vi.fn(async () => "gh-secret"),
		getUser: vi.fn(async () => ({ login: "octocat", id: 1 })),
		checkRepoWrite: vi.fn(async () => "write" as const),
		getContent: vi.fn(async () => null),
		listDir: vi.fn(async () => []),
		getBranchHead: vi.fn(async () => "headsha"),
		createBranch: vi.fn(async () => undefined),
		putFile: vi.fn(async () => undefined),
		createPullRequest: vi.fn(async () => ({
			url: "https://gh/pr/1",
			number: 1,
		})),
	};
	const kv = createInMemoryKV();
	const setSpy = vi.spyOn(kv, "set");
	const sessions = createSessions(cfg, kv, { secretbox });
	const app = createApp({
		cfg,
		eko: base.eko,
		zoho: base.zoho,
		sessions,
		kv,
		github,
		secretbox,
	});
	const start = await app.request("/auth/admin/github");
	const state = new URL(start.headers.get("location")!).searchParams.get(
		"state",
	)!;
	const stateCookie = (start.headers.getSetCookie?.() ?? [])
		.map((c) => c.split(";")[0])
		.join("; ");
	const cb = await app.request(
		`/auth/admin/github/callback?code=abc&state=${state}`,
		{
			headers: { cookie: stateCookie },
		},
	);
	expect(cb.status).toBe(302);
	// The ghtoken:* set call stored ciphertext, never the raw token.
	const ghSet = setSpy.mock.calls.find(([k]) =>
		String(k).startsWith("ghtoken:"),
	);
	expect(ghSet).toBeTruthy();
	expect(ghSet![1]).not.toBe("gh-secret");
	expect(secretbox.decrypt(ghSet![1] as string)).toBe("gh-secret");
});
