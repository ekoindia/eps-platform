import type { KV } from "../store/kv";
import { AppError } from "./errors";

/** Shared fixed-window length (seconds) for the admin/auth rate limits. */
export const RL_WINDOW_SEC = 600;
/** Per-IP cap on admin OAuth login-init hits per window. */
export const ADMIN_LOGIN_IP_LIMIT = 15;
/** Per-IP cap on valid-state admin OAuth callbacks per window. */
export const ADMIN_CALLBACK_IP_LIMIT = 15;
/** Per-admin-login cap on doc-propose mutations per window. */
export const PROPOSE_LIMIT = 30;
/** Per-admin-login cap on production-deploy mutations per window. */
export const DEPLOY_LIMIT = 10;

/**
 * Fixed-window per-key rate limit. Increments the window counter for `key`
 * and throws `AppError(429, "RATE_LIMITED")` once the count exceeds `limit`.
 * The window opens on the first increment and lasts `windowSec` (see KV.incr).
 *
 * On a KV/store outage the increment cannot be performed; rather than letting
 * the raw error surface as a 502 via the app's onError, we throw a
 * deterministic 503 so the limiter fails closed with a correct, retryable code.
 *
 * @throws AppError 429 RATE_LIMITED when the window is exceeded
 * @throws AppError 503 RATE_LIMIT_UNAVAILABLE when the KV store is unreachable
 */
export async function enforceRateLimit(
	kv: KV,
	key: string,
	limit: number,
	windowSec: number,
): Promise<void> {
	let count: number;
	try {
		count = await kv.incr(key, windowSec);
	} catch {
		throw new AppError(
			503,
			"RATE_LIMIT_UNAVAILABLE",
			"Rate limiter unavailable — try again shortly",
		);
	}
	if (count > limit) {
		throw new AppError(429, "RATE_LIMITED", "Rate limit exceeded");
	}
}
