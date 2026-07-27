import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { SessionClaim, Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";

/**
 * Token reads per session per `RL_WINDOW_SEC`. The console fetches once per
 * widget mount and once per `login-again`, so a well-behaved client sits in
 * single digits; this only bites a scripted one.
 */
const TOKEN_LIMIT = 60;

/** Interaction-list reads per session per window. The console caches it. */
const INTERACTIONS_LIMIT = 30;

/**
 * Mounts the endpoints backing the embedded Connect widget.
 *
 * These exist because `<tf-wlc-widget>` authenticates by reading
 * `sessionStorage` inside the host page's own realm — it has no token prop and
 * no postMessage API, so an HttpOnly cookie cannot reach it. Verified against
 * the shipped bundle's `TfApiBehavior._getAPIDefaultHeaders`.
 *
 * The exposure is deliberately narrowed to what that function actually reads:
 *
 * - `access_token_lite` — every transaction call. In the whole 1.4MB bundle the
 *   `fulltoken` flag that would select the FULL token appears exactly once: its
 *   own definition. No call site passes it, so setting lite means the full-token
 *   fallback never fires.
 * - `access_token_crm` — one fire-and-forget `/crm/updateProdDeal` ping.
 *
 * The full `accessToken` and the `refreshToken` therefore never leave this
 * process. `/connect/interactions` proves the point: it needs the full token, so
 * it runs here rather than in the browser.
 *
 * Mounted only when the connect provider is configured, so under the `eko`
 * provider these routes do not exist at all rather than answering 501.
 * @param app - The Hono app.
 * @param deps - Session verifier, auth provider, connect client and KV.
 */
export function mountConnect(
	app: Hono<AppEnv>,
	deps: {
		sessions: Sessions;
		auth: AuthProvider;
		connect: ConnectClient;
		kv: KV;
	},
): void {
	const { sessions, auth, connect, kv } = deps;

	/**
	 * Resolves the caller's claim, or throws unless this is a developer session
	 * that can actually carry upstream Connect credentials.
	 */
	async function requireWidgetSession(
		c: Context<AppEnv>,
	): Promise<SessionClaim> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "developer") {
			throw new AppError(
				403,
				"NOT_DEVELOPER_SESSION",
				"This account cannot run transaction flows.",
			);
		}
		// A developer session minted under the `eko` provider has no `sid` and no
		// upstream material behind it. 501 rather than 403: the account is fine,
		// this deployment simply cannot serve widget flows.
		if (!claim.sid || !auth.getUpstream) {
			throw new AppError(
				501,
				"CONNECT_UNAVAILABLE",
				"Transaction flows aren't available on this deployment.",
			);
		}
		return claim;
	}

	/**
	 * Opens the sealed upstream session.
	 * @throws {AppError} 401 CONNECT_SESSION_EXPIRED once it has aged out, so the
	 *   client re-authenticates deterministically instead of retrying forever.
	 */
	async function requireUpstream(
		claim: SessionClaim,
	): Promise<UpstreamSession> {
		const upstream = await auth.getUpstream!(claim.sid!);
		if (!upstream) {
			throw new AppError(
				401,
				"CONNECT_SESSION_EXPIRED",
				"Your session has expired. Please sign in again.",
			);
		}
		return upstream;
	}

	/**
	 * GET /connect/token → { accessTokenLite, accessTokenCrm, expiresAt }
	 *
	 * `no-store` because the body is a bearer credential: without it a shared
	 * proxy or the browser's bfcache could hand one user's token to the next.
	 */
	app.get("/connect/token", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxtok:${claim.sid}`,
			TOKEN_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		// connect-api minted a session but no lite token. The widget would fall
		// back to reading `access_token`, which we deliberately do not publish, so
		// it would send `Bearer null` on every call. Refuse instead of shipping a
		// widget that cannot authenticate.
		if (!upstream.accessTokenLite) {
			throw new AppError(
				502,
				"CONNECT_TOKEN_MISSING",
				"Couldn't start a transaction session right now.",
			);
		}

		c.header("Cache-Control", "no-store");
		return c.json({
			accessTokenLite: upstream.accessTokenLite,
			accessTokenCrm: upstream.accessTokenCrm ?? null,
			expiresAt: upstream.accessExpiresAt,
		});
	});

	/**
	 * GET /connect/interactions → { interactions }
	 *
	 * The role-scoped interaction list the widget needs as `role_trxn_list`, and
	 * what tells the console which Load-E-value flow this user is entitled to.
	 * Proxied rather than called from the browser because it requires the FULL
	 * upstream token.
	 */
	app.get("/connect/interactions", async (c) => {
		const claim = await requireWidgetSession(c);
		await enforceRateLimit(
			kv,
			`rl:cxint:${claim.sid}`,
			INTERACTIONS_LIMIT,
			RL_WINDOW_SEC,
		);
		const upstream = await requireUpstream(claim);

		const interactions = await connect.interactions(upstream.accessToken, {
			xRealIp: c.req.header("x-real-ip"),
		});

		// Entitlements, not public data — same reasoning as the token route.
		c.header("Cache-Control", "no-store");
		return c.json({ interactions });
	});
}
