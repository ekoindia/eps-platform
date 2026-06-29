export interface KV {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSec: number): Promise<void>;
	del(key: string): Promise<void>;
	getdel(key: string): Promise<string | null>;
	incr(key: string, ttlSec: number): Promise<number>;
}

interface Entry {
	value: string;
	expiresAt: number;
}

/**
 * Creates a process-local, in-memory KV store.
 *
 * WARNING: This implementation is NOT safe for multi-instance deployments.
 * Refresh tokens, OAuth state entries, and rate-limit windows are stored in
 * process memory only. Running more than one server instance will cause these
 * values to desync — resulting in rejected valid refresh tokens, broken OAuth
 * flows, and ineffective rate limits. For production multi-instance setups,
 * replace this with a shared store (e.g. Redis) that implements the same `KV`
 * interface.
 */
/** How often the background sweep evicts expired entries (ms). */
const SWEEP_INTERVAL_MS = 60_000;

export function createInMemoryKV(now: () => number = () => Date.now()): KV {
	const map = new Map<string, Entry>();

	// Lazy expiry (in `live`) only evicts on access, so keys that are set but
	// never read again (aborted OAuth states, abandoned OTP rate-limit windows,
	// sessions for users who never return) would accumulate forever. This sweep
	// bounds memory in a long-running single instance. `unref()` keeps it from
	// holding the process open — so graceful shutdown and the test runner exit
	// cleanly without an explicit disposer.
	const sweep = setInterval(() => {
		const t = now();
		for (const [key, entry] of map) {
			if (entry.expiresAt <= t) map.delete(key);
		}
	}, SWEEP_INTERVAL_MS);
	sweep.unref?.();

	const live = (key: string): Entry | null => {
		const e = map.get(key);
		if (!e) return null;
		if (e.expiresAt <= now()) {
			map.delete(key);
			return null;
		}
		return e;
	};

	return {
		async get(key) {
			return live(key)?.value ?? null;
		},
		async set(key, value, ttlSec) {
			map.set(key, { value, expiresAt: now() + ttlSec * 1000 });
		},
		async del(key) {
			map.delete(key);
		},
		async getdel(key) {
			const e = live(key);
			if (!e) return null;
			map.delete(key);
			return e.value;
		},
		async incr(key, ttlSec) {
			const e = live(key);
			if (!e) {
				map.set(key, { value: "1", expiresAt: now() + ttlSec * 1000 });
				return 1;
			}
			const next = Number(e.value) + 1;
			e.value = String(next);
			return next;
		},
	};
}
