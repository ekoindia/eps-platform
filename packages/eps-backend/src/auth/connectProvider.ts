import type { ConnectClient } from "../clients/connect";
import { mapConnectLogin, tokensOf } from "../clients/connect";
import type { EkoClient } from "../clients/eko";
import type { Config } from "../config";
import type { KV } from "../store/kv";
import type { SecretBox } from "../store/secretbox";
import type { ProfileResult } from "../types";
import type { AuthProvider, UpstreamSession } from "./provider";

/**
 * How close to expiry an upstream access token may get before `refresh()`
 * exchanges it. Covers clock skew between this host and connect-api plus the
 * round-trip itself.
 */
const REFRESH_SKEW_MS = 60_000;

/**
 * How recently a rotation counts as "already done" for `refreshEntitlements`.
 *
 * Every completed `/signup/*` response asks for one, and connect-api's refresh
 * grant is single-use — two rotations racing on the same stored session would
 * leave the loser's refresh token dead. This collapses a burst into one.
 *
 * ponytail: a time window, not a lock. It closes the realistic gap (a repeated
 * or double-submitted request) without a KV round-trip; two calls landing in the
 * same millisecond can still both rotate. Move to an atomic KV flag if entitlement
 * refreshes ever become something more than a once-per-signup event.
 */
const ENTITLEMENT_ROTATE_MIN_INTERVAL_MS = 60_000;

/**
 * Delegates login to Eloka's connect-api so both products share one identity
 * and one upstream session, while this service keeps issuing its own HttpOnly
 * cookies to the browser.
 *
 * connect-api's tokens never leave this process: they are sealed with the same
 * `SecretBox` used for admin GitHub tokens and stored at `ca:<sid>`, keyed by
 * the session id in the EPS claim.
 */
export function createConnectAuthProvider(
	connect: ConnectClient,
	deps: { kv: KV; secretbox: SecretBox; cfg: Config; eko: EkoClient },
): AuthProvider {
	const { kv, secretbox, cfg, eko } = deps;
	const orgId = cfg.connectApi?.orgId ?? cfg.eko.defaultOrgId;
	const key = (sid: string) => `ca:${sid}`;

	async function load(sid: string): Promise<UpstreamSession | null> {
		const raw = await kv.get(key(sid));
		if (!raw) return null;
		try {
			return JSON.parse(secretbox.decrypt(raw)) as UpstreamSession;
		} catch {
			// A value we cannot open is indistinguishable from one that is gone.
			// Fail closed: the caller forces a fresh login.
			return null;
		}
	}

	async function save(sid: string, session: UpstreamSession): Promise<void> {
		// Never outlive the upstream session. A KV TTL of our own 30-day default
		// against connect-api's 8-hour non-long session would leave an EPS cookie
		// looking healthy while its upstream credentials were already dead.
		const ttlSec = Math.min(
			cfg.refreshTtlSec,
			Math.floor((session.sessionExpiresAt - Date.now()) / 1000),
		);
		if (ttlSec <= 0) {
			throw new Error("connect-api session already expired");
		}
		await kv.set(key(sid), secretbox.encrypt(JSON.stringify(session)), ttlSec);
	}

	/**
	 * Exchanges the stored refresh token for a fresh set and saves the result.
	 *
	 * The two callers differ only in when they decide to call it: `refresh` on
	 * imminent expiry, `refreshEntitlements` on a role change.
	 * @throws When connect-api declines to rotate — the session is gone.
	 */
	async function rotate(sid: string, current: UpstreamSession): Promise<void> {
		const next = await connect.refreshTokens(current.refreshToken);
		if (!next) {
			throw new Error("connect-api refused to rotate the session");
		}
		const now = Date.now();
		await save(sid, {
			accessToken: next.accessToken,
			refreshToken: next.refreshToken,
			// Keep the previous lite/crm tokens when a rotation omits them, rather
			// than blanking a widget session that was working: `/authentication/token`
			// is not guaranteed to re-mint every tier. They share the access token's
			// lifetime, so a stale one simply fails and triggers `login-again`.
			accessTokenLite: next.accessTokenLite ?? current.accessTokenLite,
			accessTokenCrm: next.accessTokenCrm ?? current.accessTokenCrm,
			accessExpiresAt: now + next.accessTtlSec * 1000,
			sessionExpiresAt: now + next.sessionTtlSec * 1000,
			rotatedAt: now,
		});
	}

	/**
	 * Replaces a login-derived profile with the interaction-151 one.
	 *
	 * connect-api's login envelope carries `auth_details` — a profile it builds
	 * field by field (`routes/authentication.js`), NOT upstream's `user_detail`.
	 * Fields it does not name are simply absent, `account_state_id` among them,
	 * so a login view built from it says `accountStateId: null` and reads as
	 * `active` for an account whose KYC is outstanding. `GET /me` calls
	 * `eko.getProfile` under either provider and gets the real thing, so the
	 * session silently corrected itself on the next page load — the login view
	 * and the `/me` view disagreed about the same account.
	 *
	 * This is the same 151 read the direct provider already does after its OTP
	 * check (`ekoProvider.ts`), so the cost is one call the other path pays too,
	 * and both providers now hand the route a profile from one source.
	 *
	 * Only a `found` profile is enriched, and only a `found` re-read replaces it:
	 * `mapConnectLogin` is what decides whether a session is minted at all, and
	 * this must be able to add fields, never to change that verdict. A 151 that
	 * fails or disagrees leaves the envelope's profile exactly as it was —
	 * degrading to the previous behaviour beats refusing a login that succeeded.
	 */
	async function enrich(
		profile: ProfileResult,
		mobile: string,
		xRealIp?: string,
	): Promise<ProfileResult> {
		if (profile.kind !== "found") return profile;
		try {
			const fresh = await eko.getProfile({ mobile, orgId, xRealIp });
			return fresh.kind === "found" ? fresh : profile;
		} catch {
			return profile;
		}
	}

	return {
		name: "connect",

		sendOtp: (input) => connect.sendOtp(input),

		async verify({ mobile, otp, xRealIp }) {
			const env = await connect.login({ mobile, otp, xRealIp });
			// A wrong OTP comes back as HTTP 200 with this flag. Reading the status
			// code alone would mint a session for any six digits.
			if (env.otpFailed) return { ok: false };

			const profile = await enrich(
				mapConnectLogin(env, orgId, cfg.eko.devAllowAnyUserType),
				mobile,
				xRealIp,
			);
			const tokens = tokensOf(env);
			const now = Date.now();
			return {
				ok: true,
				profile,
				upstream: tokens
					? {
							accessToken: tokens.accessToken,
							refreshToken: tokens.refreshToken,
							accessTokenLite: tokens.accessTokenLite,
							accessTokenCrm: tokens.accessTokenCrm,
							accessExpiresAt: now + tokens.accessTtlSec * 1000,
							sessionExpiresAt: now + tokens.sessionTtlSec * 1000,
						}
					: undefined,
			};
		},

		persist: save,

		async refresh(sid) {
			const current = await load(sid);
			if (!current) {
				throw new Error("no connect-api session for this sid");
			}
			// Nothing to do while the access token is still comfortably valid — an
			// EPS refresh fires every 15 minutes, connect-api's token lasts hours.
			if (current.accessExpiresAt - Date.now() > REFRESH_SKEW_MS) return;

			await rotate(sid, current);
		},

		async refreshEntitlements(sid) {
			const current = await load(sid);
			// Nothing stored means the session is already gone. `refresh` throws here
			// because a live cookie over dead credentials must fail closed; this one
			// returns, because its callers hold a session that is valid either way and
			// every Connect route will 401 on its own next call.
			if (!current) return;
			if (
				current.rotatedAt &&
				Date.now() - current.rotatedAt < ENTITLEMENT_ROTATE_MIN_INTERVAL_MS
			) {
				return;
			}
			await rotate(sid, current);
		},

		getUpstream: load,

		async revoke(sid) {
			const current = await load(sid).catch(() => null);
			if (current) {
				await connect.revoke(current.refreshToken).catch(() => {});
			}
			await kv.del(key(sid)).catch(() => {});
		},
	};
}
