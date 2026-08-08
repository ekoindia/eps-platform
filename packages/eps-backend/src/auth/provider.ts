import type { ProfileResult } from "../types";

/**
 * Upstream session material held server-side for a logged-in user.
 *
 * Only the connect-api provider produces this. The tokens are treated as opaque
 * credentials for calling connect-api — nothing from them is ever decoded into
 * an EPS session claim, because connect-api signs an audience it then skips at
 * verify time (`routes/authentication.js:1332`) and so cannot vouch for who a
 * token belongs to.
 */
export interface UpstreamSession {
	accessToken: string;
	refreshToken: string;
	/**
	 * Reduced-scope token the browser-side Connect widget reads from
	 * `sessionStorage`. This is the ONLY field here that is ever handed to a
	 * browser, and only via `GET /connect/token`; `accessToken` and
	 * `refreshToken` never leave this process.
	 */
	accessTokenLite?: string;
	/** CRM-scoped token, likewise browser-visible via `GET /connect/token`. */
	accessTokenCrm?: string;
	/** Epoch ms after which `accessToken` must be exchanged for a fresh one. */
	accessExpiresAt: number;
	/** Epoch ms after which `refreshToken` is dead and the user must log in again. */
	sessionExpiresAt: number;
}

/**
 * Outcome of exchanging an OTP for an identity.
 *
 * `ok: false` means the OTP itself was wrong or expired — the caller counts it
 * against the brute-force budget. Every other outcome (inactive account,
 * unknown user, upstream failure) arrives as `ok: true` with a `profile` kind
 * describing it, because the OTP *did* authenticate the number.
 */
export type VerifyResult =
	| { ok: false }
	| { ok: true; profile: ProfileResult; upstream?: UpstreamSession };

/**
 * Who answers "is this the right OTP for this mobile, and whose account is it".
 *
 * Two implementations, chosen once at startup by whether `CONNECT_API_BASE_URL`
 * is configured:
 *
 * - `eko` — calls SimpliBank interactions 515/518/151 directly (the original
 *   path, and the default).
 * - `connect` — delegates to Eloka's connect-api so both products share one
 *   identity and one upstream session.
 *
 * Note this is a *configuration* fallback, not an availability one: the choice
 * is made at boot, so a connect-api outage does not silently fail over to the
 * direct path. Switching providers is a redeploy.
 *
 * Profile *reads* deliberately stay outside this interface — `/me`,
 * `/wallet/balance`, `/signup/*` and `/transactions/search` keep calling
 * `eko.getProfile` under either provider, because both providers ultimately
 * read the same interaction 151. Only the OTP exchange is delegated.
 *
 * That applies to the profile a `verify` hands back, too: it must be the 151
 * profile, not whatever the provider's own login response happened to carry.
 * connect-api answers with `auth_details`, a profile it assembles field by
 * field, and a view built from that disagreed with the very next `/me` — see
 * `connectProvider.enrich`.
 */
export interface AuthProvider {
	readonly name: "eko" | "connect";

	/**
	 * Dispatches a login OTP.
	 *
	 * @returns `ok` false when the upstream declined to send. `otp` is the code
	 *   itself when the upstream echoes it (UAT only); callers must gate exposing
	 *   it on `cfg.demoOtp`.
	 */
	sendOtp(input: {
		mobile: string;
		xRealIp?: string;
	}): Promise<{ ok: boolean; otp?: string }>;

	verify(input: {
		mobile: string;
		otp: string;
		xRealIp?: string;
	}): Promise<VerifyResult>;

	/**
	 * Stores upstream session material against a new session id, before any
	 * cookie is set. A throw aborts the login — never a half-session whose
	 * cookies are live but whose upstream credentials were dropped.
	 */
	persist?(sid: string, session: UpstreamSession): Promise<void>;

	/**
	 * Keeps upstream session material alive alongside our own refresh rotation.
	 * A throw means the upstream session is gone; the caller must fail closed and
	 * force a fresh login rather than serve a session with dead credentials.
	 */
	refresh?(sid: string): Promise<void>;

	/** Best-effort upstream logout. Must not throw. */
	revoke?(sid: string): Promise<void>;

	/**
	 * Reads back the stored upstream session.
	 *
	 * Exists solely so `GET /connect/token` can hand the browser the reduced-scope
	 * `accessTokenLite`/`accessTokenCrm` that the embedded Connect widget reads
	 * from `sessionStorage` — it has no prop or postMessage API, so there is no
	 * other way to authenticate it. Callers MUST NOT return `accessToken` or
	 * `refreshToken` to a client.
	 * @returns The session, or null when it has expired or cannot be opened.
	 */
	getUpstream?(sid: string): Promise<UpstreamSession | null>;
}
