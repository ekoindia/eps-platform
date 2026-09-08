import type { Hono } from "hono";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";

/**
 * Upstream bases the docs "Try it" widget may call through the proxy. Anything
 * outside these origins + path prefixes is a 400 — the proxy is not a general
 * fetch relay.
 */
// ponytail: constant, env override when 3rd env appears
export const TRYIT_ALLOWED_BASES: readonly string[] = [
	"https://staging.eko.in/ekoapi/v3",
	"https://api.eko.in/ekoicici/v3",
];

/** Per-`x-real-ip` calls per `RL_WINDOW_SEC`. Generous: behind Vercel the IP is an edge, not a visitor. */
export const TRYIT_IP_LIMIT = 300;
/** Cap on request AND upstream body bytes: three 1 MB files + envelope. */
export const TRYIT_MAX_BODY_BYTES = 4 * 1024 * 1024;
/** Whole upstream exchange (connect + headers + body) must finish inside this. */
export const TRYIT_TIMEOUT_MS = 30_000;

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
/** Request headers copied verbatim to upstream when present. `developer_key` is handled separately. */
const FORWARDED_REQUEST_HEADERS = [
	"secret-key",
	"secret-key-timestamp",
	"content-type",
	"accept",
] as const;
/** Upstream response headers echoed back. Not `content-length`: Node fetch may have decompressed. */
const FORWARDED_RESPONSE_HEADERS = [
	"content-type",
	"date",
	"retry-after",
] as const;

const ALLOWED_URLS = TRYIT_ALLOWED_BASES.map((b) => new URL(b));

/** Thrown by `readBodyCapped` when a stream exceeds its cap; callers map it to 413 or 502. */
export class BodyTooLargeError extends Error {
	constructor() {
		super("body exceeds cap");
		this.name = "BodyTooLargeError";
	}
}

/**
 * Parses and validates the `x-eps-target-url` header against `TRYIT_ALLOWED_BASES`.
 * The URL is parsed exactly once and the parsed object is returned, so the
 * value that was validated is the value that gets fetched (WHATWG URL has
 * already normalised case, dot-segments and backslashes by then).
 *
 * @throws AppError 400 INVALID_TARGET unless https, no userinfo, no explicit
 *   port, origin equal to an allowed base and path equal to or under its path
 */
export function resolveTryItTarget(raw: string | undefined): URL {
	const reject = () =>
		new AppError(
			400,
			"INVALID_TARGET",
			"x-eps-target-url must be an https URL under an allowed Eko API base",
		);
	if (!raw) throw reject();
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw reject();
	}
	if (
		url.protocol !== "https:" ||
		url.username !== "" ||
		url.password !== "" ||
		url.port !== ""
	) {
		throw reject();
	}
	const ok = ALLOWED_URLS.some(
		(base) =>
			url.origin === base.origin &&
			(url.pathname === base.pathname ||
				url.pathname.startsWith(base.pathname + "/")),
	);
	if (!ok) throw reject();
	return url;
}

/**
 * Buffers a byte stream while counting, cancelling the reader and throwing
 * `BodyTooLargeError` the moment `cap` is exceeded — never `arrayBuffer()`, so
 * a chunked body with no content-length cannot grow unbounded in memory.
 *
 * @param stream body stream, or null for "no body"
 * @param cap maximum bytes accepted
 * @throws BodyTooLargeError once more than `cap` bytes have arrived
 */
export async function readBodyCapped(
	stream: ReadableStream<Uint8Array> | null,
	cap: number,
): Promise<Uint8Array<ArrayBuffer>> {
	if (!stream) return new Uint8Array(0);
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > cap) {
			await reader.cancel().catch(() => {});
			throw new BodyTooLargeError();
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

/**
 * Mounts `POST /tryit/proxy`: a same-origin relay the docs "Try it" widget uses
 * to call Eko's staging/production APIs from the browser (which those hosts do
 * not allow via CORS). Anonymous by design — no session middleware runs here
 * and no request header outside a fixed allowlist is ever forwarded, so the
 * visitor's site cookie cannot ride along to Eko.
 *
 * Order: rate limit → validate target/method → read body (capped) → fetch.
 * `x-eps-developer-key` maps to upstream `developer_key` because nginx drops
 * underscored request headers by default.
 *
 * @param deps.kv rate-limit counter store
 * @param deps.fetchImpl test seam; defaults to global fetch
 * @param deps.timeoutMs test seam; defaults to `TRYIT_TIMEOUT_MS`
 */
export function mountTryItProxy(
	app: Hono<AppEnv>,
	deps: { kv: KV; fetchImpl?: typeof fetch; timeoutMs?: number },
): void {
	const doFetch = deps.fetchImpl ?? fetch;
	const timeoutMs = deps.timeoutMs ?? TRYIT_TIMEOUT_MS;

	app.post("/tryit/proxy", async (c) => {
		await enforceRateLimit(
			deps.kv,
			`rl:tryit:ip:${c.req.header("x-real-ip") ?? "unknown"}`,
			TRYIT_IP_LIMIT,
			RL_WINDOW_SEC,
		);

		const target = resolveTryItTarget(c.req.header("x-eps-target-url"));
		const method = (
			c.req.header("x-eps-target-method") ?? "POST"
		).toUpperCase();
		if (!ALLOWED_METHODS.has(method)) {
			throw new AppError(
				400,
				"INVALID_METHOD",
				"x-eps-target-method must be one of GET, POST, PUT, DELETE",
			);
		}

		const headers = new Headers();
		const developerKey = c.req.header("x-eps-developer-key");
		if (developerKey) headers.set("developer_key", developerKey);
		for (const name of FORWARDED_REQUEST_HEADERS) {
			const value = c.req.header(name);
			if (value) headers.set(name, value);
		}

		let body: Uint8Array<ArrayBuffer> | undefined;
		if (method !== "GET" && method !== "DELETE") {
			const declared = Number(c.req.header("content-length"));
			if (declared > TRYIT_MAX_BODY_BYTES) throw payloadTooLarge();
			try {
				body = await readBodyCapped(c.req.raw.body, TRYIT_MAX_BODY_BYTES);
			} catch (err) {
				if (err instanceof BodyTooLargeError) throw payloadTooLarge();
				throw err;
			}
		}

		const start = performance.now();
		let upstream: Response;
		let bytes: Uint8Array<ArrayBuffer>;
		try {
			upstream = await doFetch(target.href, {
				method,
				headers,
				body,
				redirect: "manual",
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (upstream.status >= 300 && upstream.status < 400) {
				throw new AppError(
					502,
					"UPSTREAM_REDIRECT",
					"Upstream answered with a redirect, which the proxy does not follow",
				);
			}
			// Awaited inside the same try so a body that stalls past the deadline
			// is the same TimeoutError as a connect that does.
			bytes = await readBodyCapped(upstream.body, TRYIT_MAX_BODY_BYTES);
		} catch (err) {
			if (err instanceof AppError) throw err;
			if (err instanceof BodyTooLargeError) {
				throw new AppError(
					502,
					"UPSTREAM_TOO_LARGE",
					"Upstream response exceeded the 4 MiB proxy cap",
				);
			}
			if (err instanceof Error && err.name === "TimeoutError") {
				throw new AppError(
					504,
					"UPSTREAM_TIMEOUT",
					`Upstream did not answer within ${timeoutMs} ms`,
				);
			}
			throw new AppError(
				502,
				"UPSTREAM_UNREACHABLE",
				"Could not reach the upstream Eko API",
			);
		}
		const upstreamMs = Math.round(performance.now() - start);

		const out: Record<string, string> = {
			"cache-control": "no-store",
			"x-eps-proxied": "1",
			"x-eps-upstream-ms": String(upstreamMs),
		};
		for (const name of FORWARDED_RESPONSE_HEADERS) {
			const value = upstream.headers.get(name);
			if (value) out[name] = value;
		}
		// c.body (not a raw Response) so the middleware-set x-request-id /
		// x-eps-version headers are merged in like every other route.
		return c.body(bytes, upstream.status as 200, out);
	});
}

function payloadTooLarge(): AppError {
	return new AppError(
		413,
		"PAYLOAD_TOO_LARGE",
		"Request body exceeds the 4 MiB proxy cap",
	);
}
