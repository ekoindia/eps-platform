import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import type { Config } from "../config";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import type { KV } from "../store/kv";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../auth/session";
import { buildMeView } from "../identity/me";
import { AppError, errorBody } from "./errors";
import type { GitHubClient } from "../clients/github";
import { mountAdmin } from "./admin";

export interface Deps {
	cfg: Config;
	eko: EkoClient;
	zoho: ZohoClient;
	sessions: Sessions;
	kv: KV;
	github?: GitHubClient;
}

const OTP_START_LIMIT = 5;
const OTP_VERIFY_LIMIT = 5;
const OTP_IP_LIMIT = 20;
const OTP_VERIFY_IP_LIMIT = 50;
const OTP_WINDOW_SEC = 600;

const STATE_COOKIE = "eps_oauth_state";
const STATE_TTL_SEC = 600;

function normalizeMobile(raw: string): string {
	return raw.replace(/\D/g, "");
}

export function createApp(deps: Deps): Hono {
	const { cfg, eko, zoho, sessions, kv, github } = deps;
	const app = new Hono();

	app.use("*", cors({ origin: cfg.corsOrigins, credentials: true }));

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
		// SECURITY: x-real-ip must be set/overwritten by a trusted reverse proxy.
		// Clients can otherwise spoof this header to evade per-IP rate limits.
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
		// SECURITY: x-real-ip must be set/overwritten by a trusted reverse proxy.
		// Clients can otherwise spoof this header to evade per-IP rate limits.
		const ipFailKey = `otp:verify:ip:${c.req.header("x-real-ip") ?? "unknown"}`;
		const ipFails = Number((await kv.get(ipFailKey)) ?? 0);
		if (ipFails >= OTP_VERIFY_IP_LIMIT) {
			throw new AppError(429, "RATE_LIMITED", "Too many attempts");
		}
		const verified = await eko.verifyOtp({ mobile: m, otp });
		if (!verified.ok) {
			await kv.incr(failKey, OTP_WINDOW_SEC);
			await kv.incr(ipFailKey, OTP_WINDOW_SEC);
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
		// C1: re-extend the stored GitHub token TTL so a long-lived admin session
		// does not lose write access when its refresh token is rotated.
		if (rotated.claim.role === "admin" && rotated.claim.sid) {
			const tok = await kv.get(`ghtoken:${rotated.claim.sid}`);
			if (tok)
				await kv.set(
					`ghtoken:${rotated.claim.sid}`,
					tok,
					cfg.adminRefreshTtlSec,
				);
		}
		const access = await sessions.mintAccess(rotated.claim);
		// C2: use role-aware TTL for the refresh cookie max-age.
		const refreshTtl =
			rotated.claim.role === "admin"
				? cfg.adminRefreshTtlSec
				: cfg.refreshTtlSec;
		c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
		c.header(
			"Set-Cookie",
			sessions.refreshCookie(rotated.refresh, refreshTtl),
			{
				append: true,
			},
		);
		return c.json({ ok: true });
	});

	app.post("/auth/logout", async (c) => {
		const token = getCookie(c, REFRESH_COOKIE);
		if (token) await sessions.revokeRefresh(token);
		// Best-effort: drop the stored GitHub token for admin sessions.
		const at = getCookie(c, ACCESS_COOKIE);
		const claim = at ? await sessions.verifyAccess(at) : null;
		if (claim?.sid) await kv.del(`ghtoken:${claim.sid}`).catch(() => {});
		for (const ck of sessions.clearCookies()) {
			c.header("Set-Cookie", ck, { append: true });
		}
		return c.json({ ok: true });
	});

	app.get("/me", async (c) => {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		// Admin sessions use a GitHub-derived sub (gh:<login>), not a mobile number.
		// Return a lightweight admin view without hitting the Eko/Zoho APIs.
		if (claim.role === "admin") {
			return c.json({
				role: "admin",
				login: claim.ghLogin ?? null,
				sub: claim.sub,
			});
		}
		const profile = await eko.getProfile({ mobile: claim.sub });
		const view = await buildMeView(claim.sub, profile, (m) => zoho.findLead(m));
		return c.json(view);
	});

	if (github) {
		app.get("/auth/admin/github", async (c) => {
			const state = crypto.randomUUID();
			await kv.set(`ghstate:${state}`, "1", STATE_TTL_SEC);
			setCookie(c, STATE_COOKIE, state, {
				httpOnly: true,
				path: "/",
				sameSite: "Lax",
				secure: cfg.cookieSecure,
				maxAge: STATE_TTL_SEC,
			});
			return c.redirect(github.authorizeUrl(state), 302);
		});

		app.get("/auth/admin/github/callback", async (c) => {
			const code = c.req.query("code");
			const state = c.req.query("state");
			const cookieState = getCookie(c, STATE_COOKIE);
			if (!code || !state || state !== cookieState) {
				throw new AppError(400, "BAD_STATE", "Invalid OAuth state");
			}
			const stored = await kv.get(`ghstate:${state}`);
			if (!stored) throw new AppError(400, "BAD_STATE", "Expired OAuth state");
			await kv.del(`ghstate:${state}`);

			const token = await github.exchangeCode(code);
			if (!token)
				throw new AppError(401, "OAUTH_FAILED", "Code exchange failed");
			const user = await github.getUser(token);
			if (!user)
				throw new AppError(401, "OAUTH_FAILED", "Cannot read GitHub user");
			const allowed = await github.hasRepoWrite(token, user.login);
			if (!allowed) {
				throw new AppError(403, "NOT_AUTHORIZED", "Repo write access required");
			}
			const sid = crypto.randomUUID();
			const claim = {
				sub: `gh:${user.login}`,
				role: "admin" as const,
				orgId: cfg.eko.defaultOrgId,
				ghLogin: user.login,
				sid,
			};
			// Persist the admin's OAuth token server-side, keyed by the stable
			// session id, so the GitOps console can author commits as this admin.
			await kv.set(`ghtoken:${sid}`, token, cfg.adminRefreshTtlSec);
			const access = await sessions.mintAccess(claim);
			const refresh = await sessions.issueRefresh(claim);
			c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
			c.header(
				"Set-Cookie",
				sessions.refreshCookie(refresh, cfg.adminRefreshTtlSec),
				{ append: true },
			);
			return c.redirect(cfg.adminPostLoginRedirect, 302);
		});

		mountAdmin(app, { cfg, sessions, kv, github });
	}

	app.notFound((c) => c.json(errorBody("NOT_FOUND", "Not found"), 404));

	return app;
}
