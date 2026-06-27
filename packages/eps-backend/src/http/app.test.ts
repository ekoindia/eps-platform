import { describe, it, expect, vi } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "../config";
import { createInMemoryKV } from "../store/kv";
import { createSessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";

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
	return { app: createApp({ cfg, eko, zoho, sessions, kv }), eko, zoho };
}

function cookieFrom(res: Response): string {
	const set = res.headers.getSetCookie?.() ?? [];
	return set.map((c) => c.split(";")[0]).join("; ");
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
		expect(((await res.json()) as any).error.code).toBe("INVALID_INPUT");
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
		const vbody = (await verify.json()) as any;
		expect(vbody.state).toBe("active");
		expect(vbody.zohoId).toBe("ZCRM_9");

		const cookie = cookieFrom(verify);
		expect(cookie).toContain("eps_at=");

		const me = await app.request("/me", { headers: { cookie } });
		expect(me.status).toBe(200);
		expect(((await me.json()) as any).profile.ekoUserId).toBe("EKO1");
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
		expect(((await res.json()) as any).error.code).toBe("OTP_INVALID");
	});

	it("/me 401 without a session", async () => {
		const { app } = deps();
		const res = await app.request("/me");
		expect(res.status).toBe(401);
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
});
