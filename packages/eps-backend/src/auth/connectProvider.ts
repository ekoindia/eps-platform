import type { ConnectClient } from "../clients/connect";
import { mapConnectLogin, tokensOf } from "../clients/connect";
import type { Config } from "../config";
import type { KV } from "../store/kv";
import type { SecretBox } from "../store/secretbox";
import type { AuthProvider, UpstreamSession } from "./provider";

/**
 * How close to expiry an upstream access token may get before `refresh()`
 * exchanges it. Covers clock skew between this host and connect-api plus the
 * round-trip itself.
 */
const REFRESH_SKEW_MS = 60_000;

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
	deps: { kv: KV; secretbox: SecretBox; cfg: Config },
): AuthProvider {
	const { kv, secretbox, cfg } = deps;
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

	return {
		name: "connect",

		sendOtp: (input) => connect.sendOtp(input),

		async verify({ mobile, otp, xRealIp }) {
			const env = await connect.login({ mobile, otp, xRealIp });
			// A wrong OTP comes back as HTTP 200 with this flag. Reading the status
			// code alone would mint a session for any six digits.
			if (env.otpFailed) return { ok: false };

			const profile = mapConnectLogin(env, orgId, cfg.eko.devAllowAnyUserType);
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
			});
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
