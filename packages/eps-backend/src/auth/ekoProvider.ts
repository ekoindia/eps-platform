import type { EkoClient } from "../clients/eko";
import type { AuthProvider } from "./provider";

/**
 * The original auth path: OTP send/verify and profile lookup straight against
 * SimpliBank interactions 515 / 518 / 151.
 *
 * This is the default provider and stays supported indefinitely — it is the
 * fallback whenever `CONNECT_API_BASE_URL` is unset. It holds no upstream
 * session material (SimpliBank issues none), so `persist`/`refresh`/`revoke`
 * are absent and the routes skip those steps entirely.
 */
export function createEkoAuthProvider(eko: EkoClient): AuthProvider {
	return {
		name: "eko",

		async sendOtp({ mobile, xRealIp }) {
			const r = await eko.sendOtp({ mobile, xRealIp });
			return {
				ok: r.ok,
				otp: (r.raw as { data?: { otp?: string } })?.data?.otp,
			};
		},

		async verify({ mobile, otp, xRealIp }) {
			const v = await eko.verifyOtp({ mobile, otp, xRealIp });
			if (!v.ok) return { ok: false };
			// Two round-trips by necessity: 518 proves the OTP, 151 says who this is.
			// connect-api collapses these into one call; here they stay separate.
			return { ok: true, profile: await eko.getProfile({ mobile, xRealIp }) };
		},
	};
}
