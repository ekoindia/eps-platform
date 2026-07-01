import type { KV } from "./kv";

/**
 * Thrown by the KV seam when a store operation fails (connection lost, command
 * error, timeout). Distinct from AppError and from upstream-API errors so the
 * HTTP layer can map a store outage to a deterministic 503 rather than a 502.
 */
export class StoreUnavailableError extends Error {
	constructor(cause?: unknown) {
		super("Store unavailable");
		this.name = "StoreUnavailableError";
		this.cause = cause;
	}
}

/**
 * Decorates a KV so every method that rejects re-throws a StoreUnavailableError
 * (preserving the original as `cause`). Wrapping happens once, at the seam, so
 * call sites need no try/catch: an unguarded call fails closed (mapped to 503 by
 * app.onError); a fail-open call still swallows the typed error via its own
 * `.catch`. Success values and arguments pass through unchanged.
 *
 * @param kv the underlying store (redis-backed in prod, in-memory in dev/test)
 * @returns a KV with identical behavior except that outages throw StoreUnavailableError
 */
export function withStoreErrors(kv: KV): KV {
	return {
		async get(key) {
			try {
				return await kv.get(key);
			} catch (e) {
				throw new StoreUnavailableError(e);
			}
		},
		async set(key, value, ttlSec) {
			try {
				return await kv.set(key, value, ttlSec);
			} catch (e) {
				throw new StoreUnavailableError(e);
			}
		},
		async del(key) {
			try {
				return await kv.del(key);
			} catch (e) {
				throw new StoreUnavailableError(e);
			}
		},
		async getdel(key) {
			try {
				return await kv.getdel(key);
			} catch (e) {
				throw new StoreUnavailableError(e);
			}
		},
		async incr(key, ttlSec) {
			try {
				return await kv.incr(key, ttlSec);
			} catch (e) {
				throw new StoreUnavailableError(e);
			}
		},
	};
}
