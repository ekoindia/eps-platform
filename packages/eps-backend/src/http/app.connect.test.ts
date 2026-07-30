import { describe, it, expect, vi } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "../config";
import { createInMemoryKV, type KV } from "../store/kv";
import { createSessions } from "../auth/session";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import { withStoreErrors } from "../store/storeError";

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

const FOUND_PROFILE = {
	kind: "found" as const,
	responseTypeId: 369,
	profile: {
		name: "Dev",
		email: "d@e.in",
		mobile: "9990000001",
		code: 1,
		userType: "23",
		ekoUserId: "",
		roleList: ["1"],
		orgId: 1,
		onboarding: 0,
		zohoId: "",
		onboardingSteps: [],
		accounts: [],
		evalueAccountId: null,
	},
};

const UPSTREAM: UpstreamSession = {
	accessToken: "ca_access",
	refreshToken: "ca_refresh",
	accessExpiresAt: Date.now() + 3_600_000,
	sessionExpiresAt: Date.now() + 8 * 3_600_000,
};

function setup(authOver: Partial<AuthProvider> = {}, opts: { kv?: KV } = {}) {
	const kv = opts.kv ?? withStoreErrors(createInMemoryKV());
	const auth: AuthProvider = {
		name: "connect",
		sendOtp: vi.fn(async () => ({ ok: true })),
		verify: vi.fn(async () => ({
			ok: true as const,
			profile: FOUND_PROFILE,
			upstream: UPSTREAM,
		})),
		persist: vi.fn(async () => {}),
		refresh: vi.fn(async () => {}),
		revoke: vi.fn(async () => {}),
		...authOver,
	};
	const eko = {
		getProfile: vi.fn(async () => FOUND_PROFILE),
	} as unknown as EkoClient;
	const zoho: ZohoClient = { findLead: vi.fn(async () => false) };
	const sessions = createSessions(cfg, kv);
	return {
		app: createApp({ cfg, eko, auth, zoho, sessions, kv }),
		auth,
		kv,
		sessions,
	};
}

function verifyReq() {
	return {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ mobile: "9990000001", otp: "123456" }),
	};
}

/** Collects every Set-Cookie on a response. */
function cookies(res: Response): string[] {
	return res.headers.getSetCookie();
}

describe("connect provider — session minting", () => {
	it("persists upstream tokens BEFORE any cookie is set", async () => {
		const order: string[] = [];
		const { app } = setup({
			persist: vi.fn(async () => {
				order.push("persist");
			}),
		});
		const res = await app.request("/auth/otp/verify", verifyReq());
		expect(res.status).toBe(200);
		if (cookies(res).length) order.push("cookies");
		expect(order).toEqual(["persist", "cookies"]);
	});

	it("passes a session id so the sealed entry is reachable later", async () => {
		const { app, auth } = setup();
		await app.request("/auth/otp/verify", verifyReq());
		const [sid, session] = (auth.persist as ReturnType<typeof vi.fn>).mock
			.calls[0];
		expect(typeof sid).toBe("string");
		expect(sid).not.toHaveLength(0);
		expect(session).toEqual(UPSTREAM);
	});

	it("sets NO cookie when persisting the upstream session fails", async () => {
		// The whole reason persist runs first: a live browser session whose
		// upstream credentials were dropped cannot be rolled back.
		const { app } = setup({
			persist: vi.fn(async () => {
				throw new Error("kv down");
			}),
		});
		const res = await app.request("/auth/otp/verify", verifyReq());
		expect(res.status).toBe(502);
		expect(cookies(res)).toEqual([]);
	});

	it("mints a signup session with upstream tokens for a new user", async () => {
		const { app, auth } = setup({
			verify: vi.fn(async () => ({
				ok: true as const,
				profile: { kind: "not_found" as const, responseTypeId: 319 },
				upstream: UPSTREAM,
			})),
		});
		const res = await app.request("/auth/otp/verify", verifyReq());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ role: "signup", mobile: "9990000001" });
		expect(auth.persist).toHaveBeenCalled();
	});

	it("refuses a session for an Eloka user who is not an EPS partner", async () => {
		// The gate that keeps the whole Eloka retailer base out of the portal.
		const { app, auth } = setup({
			verify: vi.fn(async () => ({
				ok: true as const,
				profile: { kind: "not_allowed" as const, responseTypeId: 369 },
				upstream: UPSTREAM,
			})),
		});
		const res = await app.request("/auth/otp/verify", verifyReq());
		expect(res.status).toBe(403);
		expect(cookies(res)).toEqual([]);
		expect(auth.persist).not.toHaveBeenCalled();
	});

	it("counts a rejected OTP against the brute-force budget", async () => {
		const { app, kv } = setup({
			verify: vi.fn(async () => ({ ok: false as const })),
		});
		const res = await app.request("/auth/otp/verify", verifyReq());
		expect(res.status).toBe(401);
		expect(await kv.get("otp:fail:9990000001")).toBe("1");
	});
});

describe("connect provider — refresh", () => {
	async function loggedIn(authOver: Partial<AuthProvider> = {}) {
		const s = setup(authOver);
		const res = await s.app.request("/auth/otp/verify", verifyReq());
		const rt = cookies(res)
			.find((c) => c.startsWith("eps_rt="))!
			.split(";")[0];
		return { ...s, rt };
	}

	it("keeps the upstream session alive on every rotation", async () => {
		const { app, auth, rt } = await loggedIn();
		const res = await app.request("/auth/refresh", {
			method: "POST",
			headers: { cookie: rt },
		});
		expect(res.status).toBe(200);
		expect(auth.refresh).toHaveBeenCalledTimes(1);
	});

	it("fails closed and clears both cookies when the upstream refresh throws", async () => {
		// An EPS session whose upstream credentials are dead is not degraded, it
		// is unusable — send the user back through login rather than serve it.
		// Both apps share one KV so the rotated refresh token really resolves.
		const kv = withStoreErrors(createInMemoryKV());
		const good = setup({}, { kv });
		const res1 = await good.app.request("/auth/otp/verify", verifyReq());
		const rt = cookies(res1)
			.find((c) => c.startsWith("eps_rt="))!
			.split(";")[0];
		// Same KV, but a provider whose upstream refresh now fails.
		const bad = setup(
			{
				refresh: vi.fn(async () => {
					throw new Error("gone");
				}),
			},
			{ kv },
		);
		const res = await bad.app.request("/auth/refresh", {
			method: "POST",
			headers: { cookie: rt },
		});
		expect(res.status).toBe(401);
		const cleared = cookies(res);
		expect(cleared.some((c) => c.startsWith("eps_at=;"))).toBe(true);
		expect(cleared.some((c) => c.startsWith("eps_rt=;"))).toBe(true);
	});
});

describe("connect provider — logout", () => {
	it("revokes the upstream session", async () => {
		const kv = withStoreErrors(createInMemoryKV());
		const { app, auth } = setup({}, { kv });
		const res1 = await app.request("/auth/otp/verify", verifyReq());
		const cookie = cookies(res1)
			.map((c) => c.split(";")[0])
			.join("; ");
		const res = await app.request("/auth/logout", {
			method: "POST",
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		expect(auth.revoke).toHaveBeenCalledTimes(1);
	});
});

describe("eko provider parity", () => {
	it("mints a session with no session id when the provider holds nothing", async () => {
		// The direct-to-SimpliBank path must behave exactly as before: no sid, no
		// persist, no upstream bookkeeping.
		const { app, auth } = setup({
			persist: undefined,
			refresh: undefined,
			revoke: undefined,
			verify: vi.fn(async () => ({
				ok: true as const,
				profile: FOUND_PROFILE,
			})),
		});
		const res = await app.request("/auth/otp/verify", verifyReq());
		expect(res.status).toBe(200);
		expect(cookies(res).some((c) => c.startsWith("eps_at="))).toBe(true);
		expect(auth.persist).toBeUndefined();
	});
});
