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
 * How recently a profile refresh counts as "already done" for
 * `refreshEntitlements`.
 *
 * Every completed `/signup/*` response asks for one, connect-api's refresh
 * grant is single-use, and each refresh costs upstream an interaction-151 read
 * — two racing on the same stored session would leave the loser's refresh
 * token dead. This collapses a burst into one.
 *
 * Compared against `profileRefreshedAt`, NOT `rotatedAt`: an expiry-driven
 * rotation re-signs the stored claim verbatim and says nothing about roles, so
 * it must never suppress the one profile refresh a signup gets.
 *
 * ponytail: a time window, not a lock. It closes the realistic gap (a repeated
 * or double-submitted request) without a KV round-trip; two calls landing in the
 * same millisecond can still both refresh. Move to an atomic KV flag if profile
 * refreshes ever become something more than a once-per-signup event.
 */
const ENTITLEMENT_REFRESH_MIN_INTERVAL_MS = 60_000;

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
		// The identity check for the post-onboarding entitlement refresh: if the
		// rotated token still says anonymous (`-1`), `/authentication/token` cannot
		// rebind a session minted pre-onboarding and rotating is pointless — the
		// stale-entitlements fix has to happen some other way. `userType` absent
		// means the endpoint sent no details block and this log proves nothing.
		console.log("[connect-auth] rotated", {
			sid: sid.slice(0, 8),
			userType: next.userType ?? "<absent>",
			anonymousUser: next.anonymousUser ?? "<unknown>",
		});
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
			// A rotation is not a profile refresh — carry the marker, don't reset it.
			profileRefreshedAt: current.profileRefreshedAt,
		});
	}

	/**
	 * Re-mints the claim behind a session with the account's REAL roles.
	 *
	 * connect-api stamps role `[-5]` on every mobile login
	 * (`routes/authentication.js:791`) and `/authentication/token` re-signs that
	 * claim verbatim (`auth/auth.js:383`), while `/transactions/wlc` builds its
	 * entitlement list from the claim alone. So this call is the only thing that
	 * makes the console see what the account actually owns: 16 interactions
	 * against Eloka's 44 for the same user, which is what sent us here.
	 *
	 * Returns the material to store rather than storing it — the login path has
	 * no `sid` yet and hands its result to `issueSession`, while the refresh
	 * paths save it themselves.
	 *
	 * ponytail: the grant is single-use, so a call that succeeds upstream and
	 * then fails here (unreadable envelope, KV write) leaves the caller holding a
	 * refresh token connect-api has already retired — the session then lives only
	 * until its access token expires. Nothing on our side can undo that; both
	 * callers log loudly so it is visible rather than silent. Upgrade only if
	 * connect-api ever makes the rotation idempotent.
	 * @param current - Session material whose tokens authenticate the call.
	 * @param ctx - Who this is for, for the log line: a sid, or a mobile at login.
	 * @returns The next session material, or null when connect-api refused.
	 */
	async function profileRefreshed(
		current: UpstreamSession,
		ctx: { sid?: string; mobile?: string },
	): Promise<UpstreamSession | null> {
		const env = await connect.refreshProfile(
			current.accessToken,
			current.refreshToken,
		);
		const next = tokensOf(env);
		// No token pair means connect-api refused (dead grant, inactive account,
		// unrecognized envelope). The caller decides whether that is fatal.
		if (!next) return null;
		const now = Date.now();
		// The identity check this whole path exists for: after onboarding this
		// must NOT say anonymous any more — if it does, upstream's 151 still has
		// the old view and no amount of refreshing on our side will help.
		console.log("[connect-auth] profile refreshed", {
			sid: ctx.sid?.slice(0, 8) ?? "<login>",
			mobile: String(env.details?.mobile ?? ctx.mobile ?? ""),
			userType: next.userType ?? "<absent>",
			anonymousUser: next.anonymousUser ?? "<unknown>",
		});
		return {
			accessToken: next.accessToken,
			refreshToken: next.refreshToken,
			// Unlike `rotate`, a refresh-profile response minting no lite/crm tier
			// is unexpected (the login branch always does) — but the fallback rule
			// is the same: a stale widget token degrades to a failed widget call,
			// while a blanked one breaks a widget that was working.
			accessTokenLite: next.accessTokenLite ?? current.accessTokenLite,
			accessTokenCrm: next.accessTokenCrm ?? current.accessTokenCrm,
			accessExpiresAt: now + next.accessTtlSec * 1000,
			sessionExpiresAt: now + next.sessionTtlSec * 1000,
			rotatedAt: now,
			profileRefreshedAt: now,
		};
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
			// Baseline for the rotation log above: a brand-new signup legitimately
			// logs `anonymousUser: true` here — connect-api mints an anonymous
			// session for a mobile it has no EPS account for.
			console.log("[connect-auth] login", {
				mobile,
				profileKind: profile.kind,
				hasTokens: Boolean(tokens),
				userType: tokens?.userType ?? "<absent>",
				anonymousUser: tokens?.anonymousUser ?? "<unknown>",
			});
			const now = Date.now();
			let upstream: UpstreamSession | undefined = tokens
				? {
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						accessTokenLite: tokens.accessTokenLite,
						accessTokenCrm: tokens.accessTokenCrm,
						accessExpiresAt: now + tokens.accessTtlSec * 1000,
						sessionExpiresAt: now + tokens.sessionTtlSec * 1000,
					}
				: undefined;
			// The token we just minted carries connect-api's `[-5]`, not the
			// account's roles, so a session built straight from it is entitled to a
			// fraction of what the user owns. Re-read the profile before it is
			// persisted — one KV write, no sid needed. Eloka does the same after
			// every login (`wlc-webapp/helpers/loginHelper.js:475`).
			//
			// Skipped for `not_found`: that mobile has no EPS account to re-read,
			// and its signup session is upgraded by `/signup/*` calling
			// `refreshEntitlements` once the account exists.
			//
			// Best-effort either way — a refresh-profile outage must not take login
			// down with it. See the ceiling noted on `profileRefreshed`.
			if (upstream && profile.kind !== "not_found") {
				try {
					const refreshed = await profileRefreshed(upstream, { mobile });
					if (refreshed) upstream = refreshed;
					else
						console.warn("[connect-auth] login profile refresh refused", {
							mobile,
						});
				} catch (err) {
					console.warn("[connect-auth] login profile refresh failed", {
						mobile,
						err,
					});
				}
			}
			return { ok: true, profile, upstream };
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
			// A rotation re-signs the same claim, so the fresh token is entitled to
			// exactly what the dead one was. Re-read the profile behind it, so roles
			// granted upstream mid-session (activation, KYC pass, a new product)
			// reach the session without a re-login.
			//
			// After the rotation and in its own catch, deliberately: `rotate` has
			// already stored a working pair, and a session with stale roles beats a
			// session that cannot act — the same rule `http/signup.ts:250` applies.
			const rotated = await load(sid);
			if (!rotated) return;
			try {
				const next = await profileRefreshed(rotated, { sid });
				if (next) await save(sid, next);
				else
					console.warn("[connect-auth] rotation profile refresh refused", {
						sid: sid.slice(0, 8),
					});
			} catch (err) {
				console.warn("[connect-auth] rotation profile refresh failed", {
					sid: sid.slice(0, 8),
					err,
				});
			}
		},

		async refreshEntitlements(sid) {
			let current = await load(sid);
			// Nothing stored means the session is already gone. `refresh` throws here
			// because a live cookie over dead credentials must fail closed; this one
			// returns, because its callers hold a session that is valid either way and
			// every Connect route will 401 on its own next call.
			if (!current) {
				console.warn("[connect-auth] entitlement refresh: no stored session", {
					sid: sid.slice(0, 8),
				});
				return;
			}
			if (
				current.profileRefreshedAt &&
				Date.now() - current.profileRefreshedAt <
					ENTITLEMENT_REFRESH_MIN_INTERVAL_MS
			) {
				console.warn("[connect-auth] entitlement refresh collapsed", {
					sid: sid.slice(0, 8),
					refreshedAgoMs: Date.now() - current.profileRefreshedAt,
				});
				return;
			}
			// `/authentication/refresh-profile` sits behind bearer auth, so an access
			// token at the edge of its life would 401 there. Rotate first and pick up
			// what `rotate` stored — the roles in it are still stale, but the token
			// is alive enough to authenticate the profile refresh.
			if (current.accessExpiresAt - Date.now() <= REFRESH_SKEW_MS) {
				await rotate(sid, current);
				current = await load(sid);
				if (!current) return;
			}
			const next = await profileRefreshed(current, { sid });
			// No token pair means connect-api refused. Throw rather than overwrite a
			// stored session that still works — the caller treats stale-but-working
			// as recoverable.
			if (!next) {
				throw new Error("connect-api refused to refresh the profile");
			}
			await save(sid, next);
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
