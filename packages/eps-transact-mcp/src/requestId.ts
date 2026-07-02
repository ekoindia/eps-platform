// Copied from packages/eps-backend/src/http/requestId.ts (eps-backend is an
// app, not a library — copying beats coupling deploys). Keep in sync manually.
import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";

/** Hono context environment: `rid` is set by the requestId middleware; the
 * /mcp route sets `toolName` (name only, never arguments) for the access log. */
export type AppEnv = { Variables: { rid: string; toolName?: string } };

/** Fallback id used only if the generator itself throws — keeps the middleware total. */
const FALLBACK_RID = "rid-unavailable";

/**
 * Reduces an inbound request id to a safe, bounded token: keeps only
 * `[A-Za-z0-9._-]`, caps at 128 characters, and returns `""` when nothing
 * usable remains. Prevents log injection and unbounded ids from the proxy.
 *
 * @param raw the inbound `x-request-id` header value, if any
 * @returns the sanitized id, or `""` when empty/undefined
 */
export function sanitizeRequestId(raw: string | undefined): string {
	if (!raw) return "";
	return raw.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128);
}

/**
 * Hono middleware that assigns a correlation id (`rid`) to every request:
 * reuses a sanitized inbound `x-request-id` when present, otherwise mints one
 * via `genId`. Sets `c.get("rid")` and the `x-request-id` response header.
 * Never throws — a throwing `genId` falls back to a constant id.
 *
 * @param opts.genId id generator; defaults to `randomUUID`
 */
export function requestId(
	opts: { genId?: () => string } = {},
): MiddlewareHandler<AppEnv> {
	const genId = opts.genId ?? (() => randomUUID());
	return async (c, next) => {
		let rid = sanitizeRequestId(c.req.header("x-request-id"));
		if (!rid) {
			try {
				rid = genId();
			} catch {
				rid = FALLBACK_RID;
			}
		}
		c.set("rid", rid);
		c.header("x-request-id", rid);
		await next();
	};
}
