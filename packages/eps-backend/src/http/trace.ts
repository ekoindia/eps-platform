import { AsyncLocalStorage } from "node:async_hooks";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./requestId";

/**
 * One upstream call made while serving the current request, as it will be
 * echoed to the browser.
 *
 * `response` is already redacted by the caller (`createEkoLogger`) and clamped
 * by `clamp()` below — nothing here is raw.
 */
export interface UpstreamCall {
	/** Endpoint path or full target URL the call went to. */
	path: string | null;
	/**
	 * The `client_ref_id` this service minted for the call. The single field
	 * Eko's own support team can look a transaction up by, which is why it is
	 * worth carrying all the way to a screenshot.
	 */
	clientRefId: string | null;
	/** Upstream HTTP status; null on a transport failure. */
	status: number | null;
	/** Round-trip duration in milliseconds. */
	durMs: number;
	/** Transport/parse error message, when the call yielded no JSON body. */
	error: string | null;
	/** Redacted, clamped response body. Omitted for anonymous callers. */
	response?: unknown;
	/** True when `clamp()` dropped part of the response (depth/size/width). */
	truncated?: boolean;
}

/** The per-request trace: the correlation id plus every upstream call under it. */
interface TraceContext {
	rid: string;
	calls: UpstreamCall[];
	/**
	 * Whether this request presented a session that verified. Gates the response
	 * BODIES out of the trace: a caller who proved who they are may see what
	 * upstream said about them, an anonymous one may not.
	 */
	authed: boolean;
}

/**
 * Caps. A trace rides in an error response and in a support ticket, so an
 * upstream that returns a 4 MB list must not become a 4 MB error body — nor
 * blow the stack on a self-referential object.
 */
const MAX_CALLS = 10;
const MAX_RESPONSE_BYTES = 8_192;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_CHARS = 1_000;

const store = new AsyncLocalStorage<TraceContext>();

/**
 * Deep-copies `value`, bounding depth, array width and string length, and
 * cutting cycles. Returns `[clamped, truncated]` so the caller can flag a
 * partial body rather than silently presenting it as complete.
 *
 * Cycle-safe via a `seen` set on the current path only (not globally), so a
 * legitimately repeated sibling object is kept rather than mistaken for a loop.
 */
function clampValue(
	value: unknown,
	depth: number,
	seen: Set<object>,
): [unknown, boolean] {
	if (typeof value === "string") {
		return value.length > MAX_STRING_CHARS
			? [`${value.slice(0, MAX_STRING_CHARS)}…[truncated]`, true]
			: [value, false];
	}
	if (!value || typeof value !== "object") return [value, false];
	if (seen.has(value)) return ["[circular]", true];
	if (depth >= MAX_DEPTH) return ["[depth limit]", true];

	const next = new Set(seen);
	next.add(value);
	let truncated = false;

	if (Array.isArray(value)) {
		const kept = value.slice(0, MAX_ARRAY_ITEMS);
		if (kept.length < value.length) truncated = true;
		const out = kept.map((v) => {
			const [c, t] = clampValue(v, depth + 1, next);
			if (t) truncated = true;
			return c;
		});
		return [out, truncated];
	}

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		const [c, t] = clampValue(v, depth + 1, next);
		if (t) truncated = true;
		out[k] = c;
	}
	return [out, truncated];
}

/**
 * Bounds an already-redacted upstream body for transport to the browser.
 *
 * Applies the structural caps first, then a byte cap: a body that is shallow
 * and narrow can still be large, and `JSON.stringify` is the only honest
 * measure of what will actually go on the wire.
 *
 * @returns the clamped value and whether anything was dropped
 */
export function clamp(value: unknown): [unknown, boolean] {
	const [out, truncated] = clampValue(value, 0, new Set());
	try {
		const json = JSON.stringify(out);
		if (json && json.length > MAX_RESPONSE_BYTES) {
			return [{ note: "[response too large]", bytes: json.length }, true];
		}
	} catch {
		// Not serializable (BigInt, a throwing getter) — never let the diagnostic
		// path be the thing that breaks the error response.
		return [{ note: "[unserializable response]" }, true];
	}
	return [out, truncated];
}

/**
 * Hono middleware opening a trace scope for the request. Must run after
 * `requestId()`, whose `rid` it captures as the trace's owner.
 *
 * `AsyncLocalStorage` rather than threading a context object through every
 * call site: the upstream clients are built once at startup and never see the
 * Hono context, so there is nothing to thread through without touching every
 * caller.
 */
export function trace(): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		await store.run({ rid: c.get("rid"), calls: [], authed: false }, next);
	};
}

/**
 * Appends one upstream call to the current request's trace. A no-op outside a
 * request scope (startup probes, tests, background work), and silently drops
 * calls past `MAX_CALLS` so a retry loop cannot grow the response unbounded.
 */
export function recordUpstream(call: UpstreamCall): void {
	const ctx = store.getStore();
	if (!ctx || ctx.calls.length >= MAX_CALLS) return;
	ctx.calls.push(call);
}

/** The upstream calls recorded so far for this request; empty outside a scope. */
export function currentTrace(): UpstreamCall[] {
	return store.getStore()?.calls ?? [];
}

/**
 * The rid owning the current trace, for log lines that have no Hono context —
 * specifically the upstream logger, whose records otherwise cannot be joined to
 * the access-log line for the same request.
 */
export function currentRid(): string | null {
	return store.getStore()?.rid ?? null;
}

/**
 * Records that this request carries a verified session.
 *
 * Called from `verifyAccess` — the single point every route resolves a session
 * through — rather than from each route's own guard, so a route added later is
 * covered without anyone remembering to opt in. A no-op outside a request scope.
 */
export function markAuthenticated(): void {
	const ctx = store.getStore();
	if (ctx) ctx.authed = true;
}

/**
 * The trace as it may be sent to the caller.
 *
 * Metadata — path, `client_ref_id`, status, duration, error — goes to everyone:
 * it names the failing call without disclosing anything about the account, and
 * `client_ref_id` is the one field Eko support can look a transaction up by.
 * Response bodies are held back unless the caller proved who they are; they are
 * redacted, but redaction removes credentials, not personal data.
 *
 * @returns One entry per recorded call, or an empty array outside a scope.
 */
export function traceForResponse(): UpstreamCall[] {
	const ctx = store.getStore();
	if (!ctx) return [];
	if (ctx.authed) return ctx.calls;
	return ctx.calls.map(({ response, truncated, ...rest }) => {
		void response;
		void truncated;
		return rest;
	});
}
