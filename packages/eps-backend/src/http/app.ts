import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { noopAccessLogger, type AccessLogger } from "../audit/accessLog";
import { noopSecurityLogger, type SecurityLogger } from "../audit/securityLog";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import { createEkoAuthProvider } from "../auth/ekoProvider";
import type { SessionClaim, Sessions } from "../auth/session";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import type { EkoClient } from "../clients/eko";
import { identityOf } from "../clients/eko";
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
import { mountChat } from "./chat";
import { mountConnect } from "./connect";
import { createChatProvider, type ChatProvider } from "../chat/providers";
import { createSpendTracker } from "../chat/spend";
import { createContextBundleManager } from "../context/bundleManager";
import {
	CONTEXT_PREFIX,
	contextMcpErrorBody,
	mountContextMcp,
} from "./contextMcp";
import { mountDashboard } from "./dashboard";
import { AppError, errorBody } from "./errors";
import { mountNotifications } from "./notifications";
import { mountSignup } from "./signup";
import { mountTransactions } from "./transactions";
import {
	ADMIN_CALLBACK_IP_LIMIT,
	ADMIN_LOGIN_IP_LIMIT,
	enforceRateLimit,
	kvOr503,
	RL_WINDOW_SEC,
} from "./rateLimit";
import { requestId, type AppEnv } from "./requestId";
import {
	debugEcho,
	isAuthenticated,
	trace,
	traceForResponse,
} from "./trace";
import { API_VERSION } from "../version";

/**
 * Top-level dependencies for the EPS BFF application.
 * All optional fields have safe defaults so test harnesses only need to
 * supply what they exercise.
 */
export interface Deps {
	cfg: Config;
	eko: EkoClient;
	/**
	 * Who answers the OTP/login exchange. Defaults to the direct-to-SimpliBank
	 * provider, so existing callers and tests need not supply it.
	 */
	auth?: AuthProvider;
	/**
	 * connect-api client, supplied only when the connect provider is configured.
	 * Its presence is what mounts the Connect-widget routes — see `mountConnect`.
	 */
	connect?: ConnectClient;
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
	/** Fetch used to pull the context-MCP bundle; test seam, defaults to global. */
	contextFetch?: typeof fetch;
	/** Chat LLM provider; test seam, defaults to one built from `cfg.chat`. */
	chatProvider?: ChatProvider;
}

const OTP_START_LIMIT = 5;
const OTP_VERIFY_LIMIT = 5;
const OTP_IP_LIMIT = 20;
const OTP_VERIFY_IP_LIMIT = 50;
const OTP_WINDOW_SEC = 600;

/** Wallet reads per session per `RL_WINDOW_SEC`. The console's own 30s refresh
 * cooldown caps a well-behaved client at 20, so this only bites a scripted one. */
const WALLET_BALANCE_LIMIT = 30;

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

/**
 * Reduces a thrown error to a one-line cause safe to put in a response.
 *
 * Upstream messages name our own hosts ("Eko upstream HTTP 503",
 * "connect-api returned non-JSON from /transactions/do"), which is exactly
 * their diagnostic value — but a transport error can quote a URL, and a URL can
 * carry credentials in its userinfo. Strip those and cap the length; an
 * unbounded `err.message` is a payload, not a diagnostic.
 */
function safeCause(err: unknown): string {
	const raw = err instanceof Error ? err.message : String(err);
	return raw.replace(/\/\/[^/@\s]*@/g, "//[redacted]@").slice(0, 200);
}

/**
 * Adds the request's diagnostics to an error envelope: the correlation id, the
 * server clock, the running build, and the upstream trace.
 *
 * Siblings of `error` rather than fields inside it: they describe the request,
 * not the failure, and keeping them out of `error` leaves the shape every
 * existing client parses untouched. `rid` goes in the body as well as the
 * header because a screenshot shows the body, never the headers.
 */
function withDiagnostics<T extends object>(c: Context<AppEnv>, body: T): T {
	try {
		const calls = traceForResponse();
		return {
			...body,
			rid: c.get("rid"),
			ts: new Date().toISOString(),
			version: API_VERSION,
			...(calls.length ? { trace: calls } : {}),
		};
	} catch {
		// The diagnostic must never be the thing that breaks the error path.
		return body;
	}
}

export function createApp(deps: Deps): Hono<AppEnv> {
	const { cfg, eko, zoho, sessions, kv, github } = deps;
	const secretbox = deps.secretbox ?? passThroughSecretBox;
	const securityLog = deps.securityLog ?? noopSecurityLogger;
	const accessLog = deps.accessLog ?? noopAccessLogger;
	const signup = deps.signup ?? createSignupService({ eko, cfg });
	const auth = deps.auth ?? createEkoAuthProvider(eko);
	const app = new Hono<AppEnv>();

	/**
	 * Mints session cookies for a claim, persisting any upstream session material
	 * FIRST.
	 *
	 * Order is the whole point: a KV failure must surface as a 503 with no
	 * `Set-Cookie` at all, rather than a live browser session whose upstream
	 * credentials were silently dropped. The reverse ordering cannot fail safely —
	 * once a cookie is on the response there is nothing to roll back.
	 */
	async function issueSession(
		c: { header: (k: string, v: string, o?: { append?: boolean }) => void },
		claim: SessionClaim,
		upstream?: UpstreamSession,
	): Promise<void> {
		if (upstream && auth.persist && claim.sid) {
			await auth.persist(claim.sid, upstream);
		}
		const access = await sessions.mintAccess(claim);
		const refresh = await sessions.issueRefresh(claim);
		c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
		c.header("Set-Cookie", sessions.refreshCookie(refresh), { append: true });
	}

	app.use("*", requestId());
	// Stamped on every response, success or failure: "which build served this?"
	// is the question that precedes every other one during an incident, and the
	// deploy poller can latch a stale image without anything else showing it.
	app.use("*", async (c, next) => {
		c.header("x-eps-version", API_VERSION);
		await next();
	});
	// Right after `requestId()`, whose `rid` the trace scope captures as its owner,
	// and before everything else so an upstream call from any handler lands in it.
	app.use("*", trace());
	// Outside the trace scope's consumers but inside it: runs after the handler,
	// so `isAuthenticated()` reflects whatever the route resolved.
	app.use("*", debugEcho());
	app.use("*", async (c, next) => {
		const start = performance.now();
		try {
			await next();
		} finally {
			const path = c.req.path;
			if (
				path !== "/healthz" &&
				path !== "/readyz" &&
				path !== "/context/healthz"
			) {
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
	const corsSite = cors({
		origin: cfg.corsOrigins,
		credentials: true,
		exposeHeaders: ["x-request-id", "x-eps-version"],
	});
	/**
	 * The MCP server at /context/* is anonymous and called from arbitrary
	 * origins, including in-browser agents. Wildcard origin WITHOUT credentials
	 * is the only combination a browser accepts — and it is also the guarantee
	 * that a visitor's session cookie can never ride along to a public endpoint.
	 */
	const corsContext = cors({
		origin: "*",
		allowMethods: ["POST", "GET", "OPTIONS"],
		allowHeaders: [
			"content-type",
			"accept",
			"mcp-protocol-version",
			"mcp-session-id",
		],
		exposeHeaders: ["mcp-protocol-version", "mcp-session-id", "x-request-id"],
		maxAge: 86_400,
	});
	// One cors instance per request, picked by path: registering both as "*"
	// middlewares would emit two conflicting sets of headers.
	app.use("*", (c, next) =>
		(c.req.path.startsWith("/context/") ? corsContext : corsSite)(c, next),
	);

	app.onError((err, c) => {
		// The public MCP endpoint speaks JSON-RPC; the BFF error envelope below
		// would be unparseable to every MCP client, so contain it here (Hono
		// routes thrown handler errors straight to onError).
		if (c.req.path.startsWith(CONTEXT_PREFIX)) {
			console.error("[eps-backend] context mcp error", {
				rid: c.get("rid"),
				err,
			});
			return c.json(contextMcpErrorBody(), 500);
		}
		if (err instanceof AppError) {
			return c.json(
				withDiagnostics(
					c,
					errorBody(err.code, err.message, err.details, err.source),
				),
				err.status as 400,
			);
		}
		if (err instanceof StoreUnavailableError) {
			return c.json(
				withDiagnostics(
					c,
					errorBody(
						"STORE_UNAVAILABLE",
						"Storage temporarily unavailable — try again shortly",
					),
				),
				503,
			);
		}
		try {
			console.error("[eps-backend] unhandled", { rid: c.get("rid"), err });
		} catch {
			// logging must never escalate the error path
		}
		// The user-facing message stays deliberately vague, but the reason no
		// longer lives only in stdout: `cause` carries what actually threw. Held
		// back from anonymous callers — it names our own hosts and paths — and
		// scrubbed of any credentials a URL in the message might carry.
		return c.json(
			withDiagnostics(c, {
				...errorBody("UPSTREAM_ERROR", "Something went wrong"),
				...(isAuthenticated() ? { cause: safeCause(err) } : {}),
			}),
			502,
		);
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
	 * POST /auth/otp/start → { ok: true, otp?: string } (200)
	 * `otp` is echoed only when DEMO_OTP is on (dev/UAT) and the upstream
	 * returned one — UAT does, production does not.
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
		const resp = await auth.sendOtp({
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
		// The provider surfaces the code whenever upstream echoes it; whether the
		// caller may SEE it stays gated here, where the security decision is visible.
		const demoOtp = cfg.demoOtp ? resp.otp : undefined;
		return c.json(demoOtp ? { ok: true, otp: demoOtp } : { ok: true });
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
		const verified = await auth.verify({ mobile: m, otp, xRealIp });
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
		const { profile, upstream } = verified;
		// Only providers that hold upstream session material need a session id, so
		// sessions minted by the direct path stay exactly as they were.
		const sid = upstream ? crypto.randomUUID() : undefined;
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
				sid,
			};
			await issueSession(c, claim, upstream);
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
			sid,
		};
		await issueSession(c, claim, upstream);
		return c.json(view);
	});

	app.post("/auth/refresh", async (c) => {
		const token = getCookie(c, REFRESH_COOKIE);
		if (!token) throw new AppError(401, "NO_SESSION", "No refresh token");
		const rotated = await sessions.rotateRefresh(token);
		if (!rotated)
			throw new AppError(401, "SESSION_EXPIRED", "Please log in again");
		// Keep the upstream (connect-api) session alive alongside our own rotation.
		//
		// Fail CLOSED: an EPS session whose upstream credentials are gone is not a
		// degraded session, it is a session that cannot act. Because rotation above
		// already burned the old refresh token, recovery here means discarding the
		// new one too and sending the user back through login — cheaper and safer
		// than serving a cookie that will fail at the first upstream call.
		if (auth.refresh && rotated.claim.sid) {
			try {
				await auth.refresh(rotated.claim.sid);
			} catch {
				await sessions.revokeRefresh(rotated.refresh).catch(() => {});
				for (const ck of sessions.clearCookies()) {
					c.header("Set-Cookie", ck, { append: true });
				}
				throw new AppError(401, "SESSION_EXPIRED", "Please log in again");
			}
		}
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
		// `getCookie` reads the REQUEST, so clearing cookies on the response above
		// does not hide the claim we still need to identify what to revoke.
		const at = getCookie(c, ACCESS_COOKIE);
		const claim = at ? await sessions.verifyAccess(at).catch(() => null) : null;
		if (claim?.sid) {
			await kv.del(`ghtoken:${claim.sid}`).catch(() => {});
			// Best-effort upstream logout. An already-expired access cookie yields no
			// claim and therefore no sid, in which case `ca:<sid>` simply expires on
			// its own TTL — the same trade-off the GitHub token above accepts.
			if (auth.revoke) await auth.revoke(claim.sid).catch(() => {});
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

	/**
	 * GET /me/ip → { ip }
	 *
	 * The caller's own public IP, which the browser cannot see. Used to stamp a
	 * KYC capture with where it was taken from — a watermark claiming a location
	 * is worth more when the network agrees with it.
	 *
	 * Read from the proxy headers rather than the socket: this runs behind nginx
	 * and Vercel, so the socket peer is the proxy. Session-gated because it is a
	 * fact about the caller, not public data.
	 */
	app.get("/me/ip", async (c) => {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
		const ip = c.req.header("x-real-ip") || forwarded || "";
		c.header("Cache-Control", "no-store");
		return c.json({ ip });
	});

	/**
	 * The signed-in developer's E-value wallet balance.
	 *
	 * The identity is re-derived from the session claim's mobile on every call —
	 * never read from the request — so one developer cannot read another's
	 * wallet. Mirrors the rule `mountSignup` follows for onboarding.
	 */
	app.get("/wallet/balance", async (c) => {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		// Admin sessions have no mobile, and a signup session has no wallet until
		// onboarding finishes.
		if (claim.role !== "developer") {
			throw new AppError(403, "NO_WALLET", "This session has no wallet.");
		}
		// Each hit is two upstream round-trips. Limit per session, not per IP:
		// x-real-ip is spoofable by anything the reverse proxy doesn't overwrite.
		await enforceRateLimit(
			kv,
			`rl:wallet:mob:${claim.sub}`,
			WALLET_BALANCE_LIMIT,
			RL_WINDOW_SEC,
		);
		const xRealIp = c.req.header("x-real-ip");
		const profile = await eko.getProfile({ mobile: claim.sub, xRealIp });
		// Gate on the profile kind, not on buildMeView — that view never throws and
		// would happily hand back a state for a profile upstream refused.
		//
		// `error` is an unclassified upstream failure, NOT a user classification, so
		// it must not answer 403: the console treats 403 as the definitive "no
		// wallet here" and hides the card for good. A blip would silently retire the
		// balance for an account that has one.
		if (profile.kind === "error") {
			throw new AppError(
				502,
				"UPSTREAM_ERROR",
				"Couldn't reach your account right now.",
			);
		}
		if (profile.kind !== "found") {
			throw new AppError(403, "NO_WALLET", "This account has no wallet yet.");
		}
		const balance = await eko.getWalletBalance({
			identity: identityOf(profile.profile),
			xRealIp,
		});
		if (balance === null) {
			throw new AppError(
				502,
				"UPSTREAM_ERROR",
				"Couldn't fetch your balance right now.",
			);
		}
		return c.json({ balance });
	});

	// One bundle manager, two consumers: the anonymous MCP server below and the
	// docs-chat route, which grounds its tool calls on the same object.
	const contextBundles = cfg.contextMcp
		? createContextBundleManager({
				...cfg.contextMcp,
				fetchImpl: deps.contextFetch,
			})
		: undefined;

	if (contextBundles) {
		mountContextMcp(app, contextBundles);
	}

	// Chat needs both a provider AND the bundle: an assistant with no grounding
	// would answer EPS questions from model memory, which is exactly the failure
	// this feature exists to prevent. Either missing → the route reports
	// CHAT_DISABLED rather than silently answering ungrounded.
	mountChat(app, {
		sessions,
		kv,
		securityLog,
		engine:
			cfg.chat && contextBundles
				? {
						bundles: contextBundles,
						provider: deps.chatProvider ?? createChatProvider(cfg.chat),
						spend: createSpendTracker(kv, {
							monthlyBudgetUsd: cfg.chat.monthlyBudgetUsd,
							inputPerMTok: cfg.chat.inputPerMTok,
							outputPerMTok: cfg.chat.outputPerMTok,
						}),
					}
				: undefined,
	});

	mountSignup(app, { sessions, signup, eko, zoho, cfg, auth });
	mountTransactions(app, { sessions, eko });

	// Mounted unconditionally, unlike the Connect-widget routes below: it serves
	// aggregate counts rather than credentials, so under the `eko` provider the
	// honest answer is a named 501 the console can explain, not a 404 it has to
	// guess at. See `mountDashboard`.
	mountDashboard(app, {
		sessions,
		auth,
		connect: deps.connect,
		kv,
		connectBaseUrl: cfg.connectApi?.baseUrl,
	});

	// Same reasoning, same shape: mounted everywhere, 501 where there is no
	// upstream to ask, so the console can simply not render a bell.
	mountNotifications(app, { sessions, auth, connect: deps.connect, kv });

	// Connect-widget routes exist only where they can work: they need a provider
	// that stores upstream credentials AND a client to spend them. Under the `eko`
	// provider the token-bearing endpoints are not registered at all, so a
	// misconfiguration cannot leave them reachable.
	if (deps.connect && auth.getUpstream) {
		mountConnect(app, {
			sessions,
			auth,
			connect: deps.connect,
			kv,
			connectBaseUrl: cfg.connectApi?.baseUrl ?? "",
		});
	}

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

	app.notFound((c) =>
		c.json(withDiagnostics(c, errorBody("NOT_FOUND", "Not found")), 404),
	);

	return app;
}
