import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { noopAccessLogger, type AccessLogger } from "../audit/accessLog";
import { noopSecurityLogger, type SecurityLogger } from "../audit/securityLog";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { GitHubClient } from "../clients/github";
import type { ZohoClient } from "../clients/zoho";
import type { Config } from "../config";
import { buildMeView } from "../identity/me";
import type { SignupView } from "../identity/me";
import { createSignupService, type SignupService } from "../signup/service";
import type { KV } from "../store/kv";
import { passThroughSecretBox, type SecretBox } from "../store/secretbox";
import { StoreUnavailableError } from "../store/storeError";
import { mountAdmin } from "./admin";
import { AppError, errorBody } from "./errors";
import { mountSignup } from "./signup";
import {
	ADMIN_CALLBACK_IP_LIMIT,
	ADMIN_LOGIN_IP_LIMIT,
	enforceRateLimit,
	kvOr503,
	RL_WINDOW_SEC,
} from "./rateLimit";
import { requestId, type AppEnv } from "./requestId";

/**
 * Top-level dependencies for the EPS BFF application.
 * All optional fields have safe defaults so test harnesses only need to
 * supply what they exercise.
 */
export interface Deps {
	cfg: Config;
	eko: EkoClient;
	zoho: ZohoClient;
	sessions: Sessions;
	kv: KV;
	github?: GitHubClient;
	secretbox?: SecretBox;
	readiness?: () => Promise<boolean>; // Task 7
	securityLog?: SecurityLogger;
	accessLog?: AccessLogger;
	/** Signup orchestration; defaults to one built over the injected Eko client. */
	signup?: SignupService;
}

const OTP_START_LIMIT = 5;
const OTP_VERIFY_LIMIT = 5;
const OTP_IP_LIMIT = 20;
const OTP_VERIFY_IP_LIMIT = 50;
const OTP_WINDOW_SEC = 600;

const STATE_COOKIE = "eps_oauth_state";
const STATE_TTL_SEC = 600;

/**
 * Canonicalizes a mobile number to its last 10 digits so the same physical
 * number maps to one key regardless of country-code / leading-zero prefix
 * (`9990000001`, `919990000001`, `09990000001` → `9990000001`). Without this,
 * a caller could evade per-mobile OTP rate limits by re-prefixing the number.
 */
function normalizeMobile(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	return digits.length > 10 ? digits.slice(-10) : digits;
}

export function createApp(deps: Deps): Hono<AppEnv> {
	const { cfg, eko, zoho, sessions, kv, github } = deps;
	const secretbox = deps.secretbox ?? passThroughSecretBox;
	const securityLog = deps.securityLog ?? noopSecurityLogger;
	const accessLog = deps.accessLog ?? noopAccessLogger;
	const signup = deps.signup ?? createSignupService({ eko, cfg });
	const app = new Hono<AppEnv>();

	app.use("*", requestId());
	app.use("*", async (c, next) => {
		const start = performance.now();
		try {
			await next();
		} finally {
			const path = c.req.path;
			if (path !== "/healthz" && path !== "/readyz") {
				accessLog.log({
					rid: c.get("rid"),
					method: c.req.method,
					path,
					status: c.res?.status ?? 500,
					durMs: Math.round(performance.now() - start),
					ip: c.req.header("x-real-ip") ?? "unknown",
				});
			}
		}
	});
	app.use(
		"*",
		cors({
			origin: cfg.corsOrigins,
			credentials: true,
			exposeHeaders: ["x-request-id"],
		}),
	);

	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as 400);
		}
		if (err instanceof StoreUnavailableError) {
			return c.json(
				errorBody(
					"STORE_UNAVAILABLE",
					"Storage temporarily unavailable — try again shortly",
				),
				503,
			);
		}
		try {
			console.error("[eps-backend] unhandled", { rid: c.get("rid"), err });
		} catch {
			// logging must never escalate the error path
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 502);
	});

	app.get("/healthz", (c) => c.json({ status: "ok" }));

	/**
	 * Readiness probe — returns 200 `{ ready: true }` when the optional
	 * `readiness` function is absent or resolves `true`; returns 503
	 * `{ ready: false }` when it resolves `false` or throws.
	 */
	app.get("/readyz", async (c) => {
		const ready = deps.readiness
			? await deps.readiness().catch(() => false)
			: true;
		return c.json({ ready }, ready ? 200 : 503);
	});

	/**
	 * POST /auth/otp/start → { ok: true } (200)
	 * MARK: /start
	 */
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
		await enforceRateLimit(kv, mobKey, OTP_START_LIMIT, OTP_WINDOW_SEC);
		await enforceRateLimit(kv, ipKey, OTP_IP_LIMIT, OTP_WINDOW_SEC);
		const resp = await eko.sendOtp({
			mobile: m,
			xRealIp: c.req.header("x-real-ip"),
		});
		// A non-zero upstream status means the OTP was NOT dispatched. Surface a
		// uniform retryable failure (same for every mobile → no enumeration)
		// instead of a misleading `{ ok: true }` that leaves the user waiting for
		// an SMS that never arrives.
		if (!resp.ok) {
			throw new AppError(
				502,
				"OTP_SEND_FAILED",
				"Couldn't send the OTP right now. Please try again.",
			);
		}
		return c.json({ ok: true });
	});

	/**
	 * POST /auth/otp/verify → { ...meView } (200)
	 * MARK: /verify
	 */
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
		// KV outage on the brute-force gate → 503 (fail-closed), never a raw 502.
		const fails = Number((await kvOr503(() => kv.get(failKey))) ?? 0);
		if (fails >= OTP_VERIFY_LIMIT) {
			throw new AppError(429, "RATE_LIMITED", "Too many attempts");
		}
		// SECURITY: x-real-ip must be set/overwritten by a trusted reverse proxy.
		// Clients can otherwise spoof this header to evade per-IP rate limits.
		const ipFailKey = `otp:verify:ip:${c.req.header("x-real-ip") ?? "unknown"}`;
		const ipFails = Number((await kvOr503(() => kv.get(ipFailKey))) ?? 0);
		if (ipFails >= OTP_VERIFY_IP_LIMIT) {
			throw new AppError(429, "RATE_LIMITED", "Too many attempts");
		}
		const xRealIp = c.req.header("x-real-ip");
		const verified = await eko.verifyOtp({ mobile: m, otp, xRealIp });
		if (!verified.ok) {
			// Fail-closed: if the failed attempt cannot be counted, refuse (503)
			// rather than let unbounded guesses through.
			await kvOr503(() => kv.incr(failKey, OTP_WINDOW_SEC));
			await kvOr503(() => kv.incr(ipFailKey, OTP_WINDOW_SEC));
			throw new AppError(401, "OTP_INVALID", "Invalid or expired OTP");
		}
		// Best-effort cleanup: a valid OTP is already consumed; a stale failKey
		// expires by its own TTL, so never 502/503 the user over it.
		await kv.del(failKey).catch(() => {});
		const profile = await eko.getProfile({ mobile: m, xRealIp });
		// An inactive account (upstream 2123) authenticated the OTP but must NOT
		// receive a session — deny before minting any token/cookie (parity with
		// the reference login). The OTP already proved control of the number, so a
		// clear 403 is safe (no enumeration) and surfaces a real message.
		if (profile.kind === "inactive") {
			throw new AppError(
				403,
				"ACCOUNT_INACTIVE",
				"This account is inactive. Please contact support.",
			);
		}
		// An unrecognized upstream response must NOT be treated as a new user —
		// refuse the login instead of minting a null-profile session. The OTP was
		// already consumed; the client can retry.
		if (profile.kind === "error") {
			throw new AppError(
				502,
				"PROFILE_UNAVAILABLE",
				"Couldn't load your profile right now. Please try again.",
			);
		}
		// New users (`not_found`) and users partway through onboarding
		// (`onboarding`) both get a limited signup session, which authorizes the
		// /signup/* endpoints and a lightweight /me — nothing else. The wizard
		// reads its own progress from /signup/state.
		if (profile.kind === "not_found" || profile.kind === "onboarding") {
			const claim = {
				sub: m,
				role: "signup" as const,
				orgId:
					profile.kind === "onboarding"
						? profile.profile.orgId
						: cfg.eko.defaultOrgId,
			};
			const access = await sessions.mintAccess(claim);
			const refresh = await sessions.issueRefresh(claim);
			c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
			c.header("Set-Cookie", sessions.refreshCookie(refresh), { append: true });
			const view: SignupView = { role: "signup", mobile: m };
			return c.json(view);
		}
		// The OTP authenticated the number, but the profile is not an EPS business
		// partner (org 1 / user_type 23) — deny before minting any token/cookie.
		if (profile.kind === "not_allowed") {
			throw new AppError(
				403,
				"NOT_ALLOWED",
				"This account isn't an EPS business account. Please contact support.",
			);
		}
		// Only a `found` (existing, EPS-business, active-or-onboarded) profile
		// reaches here — `not_found`/`onboarding` returned a signup session above,
		// and every other kind threw before this point.
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
				await kv
					.set(`ghtoken:${rotated.claim.sid}`, tok, cfg.adminRefreshTtlSec)
					.catch(() => {}); // re-extend: fail-open — a TTL touch must not 503 a refresh
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
		// Clear cookies FIRST so logout always succeeds client-side, even if the
		// shared store is unreachable. Revocation is best-effort; an orphaned
		// refresh entry expires by its TTL.
		for (const ck of sessions.clearCookies()) {
			c.header("Set-Cookie", ck, { append: true });
		}
		const token = getCookie(c, REFRESH_COOKIE);
		if (token) await sessions.revokeRefresh(token).catch(() => {});
		const at = getCookie(c, ACCESS_COOKIE);
		const claim = at ? await sessions.verifyAccess(at).catch(() => null) : null;
		if (claim?.sid) await kv.del(`ghtoken:${claim.sid}`).catch(() => {});
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
		// A signup session has no developer profile yet. Return a lightweight view
		// without an Eko call, so a reload mid-onboarding restores the session
		// instead of dropping the user to anonymous and forcing a fresh OTP.
		if (claim.role === "signup") {
			const view: SignupView = { role: "signup", mobile: claim.sub };
			return c.json(view);
		}
		const profile = await eko.getProfile({
			mobile: claim.sub,
			xRealIp: c.req.header("x-real-ip"),
		});
		const view = await buildMeView(claim.sub, profile, (m) => zoho.findLead(m));
		return c.json(view);
	});

	mountSignup(app, { sessions, signup, eko, zoho, cfg });

	if (github) {
		app.get("/auth/admin/github", async (c) => {
			const ip = c.req.header("x-real-ip") ?? "unknown";
			await enforceRateLimit(
				kv,
				`rl:adminlogin:ip:${ip}`,
				ADMIN_LOGIN_IP_LIMIT,
				RL_WINDOW_SEC,
			);
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
			// Rate-limit AFTER state validation + single-use consumption: a forged or
			// replayed state fails the checks above and never reaches here, so it
			// cannot burn a shared IP's callback budget.
			const ip = c.req.header("x-real-ip") ?? "unknown";
			await enforceRateLimit(
				kv,
				`rl:admincb:ip:${ip}`,
				ADMIN_CALLBACK_IP_LIMIT,
				RL_WINDOW_SEC,
			);

			const token = await github.exchangeCode(code);
			if (!token) {
				securityLog.loginDenied({
					actor: "unknown",
					ip,
					reason: "OAUTH_FAILED",
					rid: c.get("rid"),
				});
				throw new AppError(401, "OAUTH_FAILED", "Code exchange failed");
			}
			const user = await github.getUser(token);
			if (!user) {
				securityLog.loginDenied({
					actor: "unknown",
					ip,
					reason: "OAUTH_FAILED",
					rid: c.get("rid"),
				});
				throw new AppError(401, "OAUTH_FAILED", "Cannot read GitHub user");
			}
			const status = await github.checkRepoWrite(token, user.login);
			if (status !== "write") {
				// Grant a session ONLY on confirmed write. no-write and unknown both
				// block — a non-write GitHub user never receives any session.
				securityLog.loginDenied({
					actor: `@${user.login}`,
					ip,
					reason: status,
					rid: c.get("rid"),
				});
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
			// Encrypted at rest via the injected SecretBox (AES-256-GCM in prod).
			await kv.set(
				`ghtoken:${sid}`,
				secretbox.encrypt(token),
				cfg.adminRefreshTtlSec,
			);
			const access = await sessions.mintAccess(claim);
			const refresh = await sessions.issueRefresh(claim);
			c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
			c.header(
				"Set-Cookie",
				sessions.refreshCookie(refresh, cfg.adminRefreshTtlSec),
				{ append: true },
			);
			securityLog.loginGranted({
				actor: `@${user.login}`,
				ip,
				sid,
				rid: c.get("rid"),
			});
			return c.redirect(cfg.adminPostLoginRedirect, 302);
		});

		mountAdmin(app, {
			cfg,
			sessions,
			kv,
			github,
			secretbox,
			securityLog,
		});
	}

	app.notFound((c) => c.json(errorBody("NOT_FOUND", "Not found"), 404));

	return app;
}
