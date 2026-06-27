import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Config } from "../config";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import type { KV } from "../store/kv";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../auth/session";
import { buildMeView } from "../identity/me";
import { AppError, errorBody } from "./errors";

export interface Deps {
	cfg: Config;
	eko: EkoClient;
	zoho: ZohoClient;
	sessions: Sessions;
	kv: KV;
}

const OTP_START_LIMIT = 5;
const OTP_VERIFY_LIMIT = 5;
const OTP_IP_LIMIT = 20;
const OTP_WINDOW_SEC = 600;

function normalizeMobile(raw: string): string {
	return raw.replace(/\D/g, "");
}

export function createApp(deps: Deps): Hono {
	const { cfg, eko, zoho, sessions, kv } = deps;
	const app = new Hono();

	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as 400);
		}
		console.error("[eps-backend] unhandled", err);
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 502);
	});

	app.get("/healthz", (c) => c.json({ status: "ok" }));

	app.post("/auth/otp/start", async (c) => {
		const { mobile } = await c.req.json().catch(() => ({}));
		if (!mobile || typeof mobile !== "string") {
			throw new AppError(400, "INVALID_INPUT", "mobile is required");
		}
		const m = normalizeMobile(mobile);
		if (m.length < 6) {
			throw new AppError(400, "INVALID_INPUT", "mobile is invalid");
		}
		const ipKey = `otp:ip:${c.req.header("x-real-ip") ?? "unknown"}`;
		const mobKey = `otp:mob:${m}`;
		const count = await kv.incr(mobKey, OTP_WINDOW_SEC);
		const ipCount = await kv.incr(ipKey, OTP_WINDOW_SEC);
		if (count > OTP_START_LIMIT) {
			throw new AppError(429, "RATE_LIMITED", "Too many OTP requests");
		}
		if (ipCount > OTP_IP_LIMIT) {
			throw new AppError(429, "RATE_LIMITED", "Too many OTP requests");
		}
		await eko.sendOtp({ mobile: m });
		// generic response — no account enumeration
		return c.json({ ok: true });
	});

	app.post("/auth/otp/verify", async (c) => {
		const { mobile, otp } = await c.req.json().catch(() => ({}));
		if (!mobile || !otp) {
			throw new AppError(400, "INVALID_INPUT", "mobile and otp are required");
		}
		const m = normalizeMobile(mobile);
		if (m.length < 6) {
			throw new AppError(400, "INVALID_INPUT", "mobile is invalid");
		}
		const failKey = `otp:fail:${m}`;
		const fails = Number((await kv.get(failKey)) ?? 0);
		if (fails >= OTP_VERIFY_LIMIT) {
			throw new AppError(429, "RATE_LIMITED", "Too many attempts");
		}
		const verified = await eko.verifyOtp({ mobile: m, otp });
		if (!verified.ok) {
			await kv.incr(failKey, OTP_WINDOW_SEC);
			throw new AppError(401, "OTP_INVALID", "Invalid or expired OTP");
		}
		await kv.del(failKey);
		const profile = await eko.getProfile({ mobile: m });
		const view = await buildMeView(m, profile, (mob) => zoho.findLead(mob));
		const claim = {
			sub: m,
			role: "developer" as const,
			orgId: view.profile?.orgId ?? cfg.eko.defaultOrgId,
			zohoId: view.zohoId ?? undefined,
		};
		const access = await sessions.mintAccess(claim);
		const refresh = await sessions.issueRefresh(claim);
		c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
		c.header("Set-Cookie", sessions.refreshCookie(refresh), { append: true });
		return c.json(view);
	});

	app.post("/auth/refresh", async (c) => {
		const token = getCookie(c, REFRESH_COOKIE);
		if (!token) throw new AppError(401, "NO_SESSION", "No refresh token");
		const rotated = await sessions.rotateRefresh(token);
		if (!rotated)
			throw new AppError(401, "SESSION_EXPIRED", "Please log in again");
		const access = await sessions.mintAccess(rotated.claim);
		c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
		c.header("Set-Cookie", sessions.refreshCookie(rotated.refresh), {
			append: true,
		});
		return c.json({ ok: true });
	});

	app.post("/auth/logout", async (c) => {
		const token = getCookie(c, REFRESH_COOKIE);
		if (token) await sessions.revokeRefresh(token);
		for (const ck of sessions.clearCookies()) {
			c.header("Set-Cookie", ck, { append: true });
		}
		return c.json({ ok: true });
	});

	app.get("/me", async (c) => {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		const profile = await eko.getProfile({ mobile: claim.sub });
		const view = await buildMeView(claim.sub, profile, (m) => zoho.findLead(m));
		return c.json(view);
	});

	return app;
}
