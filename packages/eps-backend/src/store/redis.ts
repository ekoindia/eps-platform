import { createClient } from "redis";
import type { KV } from "./kv";

/** Lua: atomic fixed-window incr — sets TTL only on the first increment. */
const INCR_FIXED_WINDOW = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n`;

/**
 * Creates a Redis-backed KV. Connects before returning; throws on connect
 * failure (startup-fatal by design). `disableOfflineQueue` makes commands
 * reject immediately when disconnected, so callers fail closed.
 *
 * @param url - Redis connection URL (redis:// or rediss://).
 * @param opts - Optional TLS settings for rediss:// connections.
 * @returns Object with `kv`, `ping`, and `close` handles.
 */
export async function createRedisKV(
	url: string,
	opts: { rejectUnauthorized?: boolean } = {},
): Promise<{
	kv: KV;
	ping: () => Promise<boolean>;
	close: () => Promise<void>;
}> {
	const client = createClient({
		url,
		disableOfflineQueue: true,
		socket: url.startsWith("rediss://")
			? { tls: true, rejectUnauthorized: opts.rejectUnauthorized ?? true }
			: undefined,
	});
	client.on("error", (e) => console.error("[eps-backend] redis error", e));
	await client.connect();

	const kv: KV = {
		async get(key) {
			return client.get(key);
		},
		async set(key, value, ttlSec) {
			await client.set(key, value, { EX: ttlSec });
		},
		async del(key) {
			await client.del(key);
		},
		async getdel(key) {
			return client.getDel(key);
		},
		async incr(key, ttlSec) {
			const n = await client.eval(INCR_FIXED_WINDOW, {
				keys: [key],
				arguments: [String(ttlSec)],
			});
			return Number(n);
		},
	};

	return {
		kv,
		async ping() {
			try {
				return (await client.ping()) === "PONG";
			} catch {
				return false;
			}
		},
		async close() {
			await client.quit();
		},
	};
}
