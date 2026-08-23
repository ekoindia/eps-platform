/**
 * Mounts the anonymous eps-context-mcp server at `/context/*` (public URL
 * `https://mcp.eko.in/context/mcp`).
 *
 * The MCP app itself lives in `@ekoindia/eps-context-mcp` and is consumed as-is;
 * only two things are this deployment's problem and therefore live here:
 *
 *  1. **Freshness.** The published package bakes a bundle at publish time and
 *     `load-bundle.ts` fetches once at startup — fine for a short-lived stdio
 *     process or a serverless lambda, permanently stale in a container that
 *     runs for weeks. Here the bundle is re-validated against the live site on
 *     a TTL so a docs change reaches agents without redeploying anything.
 *  2. **Isolation.** This process also mints sessions and holds admin GitHub
 *     tokens, so nothing on this path may throw into the shared error handler,
 *     reject unhandled (fatal on Node 20), or fail `/readyz`.
 */
import type { Hono } from "hono";
import { createApp as createContextApp } from "@ekoindia/eps-context-mcp/src/http.js";
import type { AgentBundle } from "@ekoindia/eps-context-mcp/src/bundle-types.js";

import { withTimeout } from "../clients/http";
import type { AppEnv } from "./requestId";

/** Bundle fetches abort here: the site is not on the request path, but a hung
 * socket still costs a connection for as long as it is held open. */
const FETCH_TIMEOUT_MS = 10_000;

export interface ContextMcpOptions {
	/** Absolute URL of the agent bundle (`.../agent/eps.json`). */
	bundleUrl: string;
	/** Seconds before a loaded bundle is re-validated. */
	ttlSec: number;
	/** Fetch seam for tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
}

/** Path prefix the MCP server is mounted under. */
export const CONTEXT_PREFIX = "/context/";

/** JSON-RPC-shaped error body — `/context/*` must never emit the BFF's own
 * `{error:{code:"UPSTREAM_ERROR"}}` shape, which no MCP client can parse. */
const rpcError = (code: number, message: string) => ({
	jsonrpc: "2.0" as const,
	error: { code, message },
	id: null,
});

/**
 * A bundle is only usable if the tool handlers' load-bearing fields survived
 * the round trip. A 200 that is valid JSON but not a bundle (an SPA fallback
 * page, an error envelope, a half-written deploy artifact) would otherwise be
 * installed and crash every tool call afterwards.
 *
 * The `docsUrl` and object-`topics` checks are what separate the full bundle
 * from its *index* slice (`/agent/index.json`), which is the easiest wrong
 * value to configure: it carries the same top-level keys, so a laxer check
 * would accept it and every tool would quietly answer with body-free stubs.
 */
function isUsableBundle(value: unknown): value is AgentBundle {
	const b = value as AgentBundle | undefined;
	return (
		!!b &&
		typeof b.meta?.bundleVersion === "string" &&
		b.meta.bundleVersion.length > 0 &&
		Array.isArray(b.apis) &&
		b.apis.length > 0 &&
		typeof b.apis[0]?.docsUrl === "string" &&
		!!b.topics &&
		!Array.isArray(b.topics) &&
		typeof b.topics === "object"
	);
}

/**
 * Mounts `GET /context/healthz` + `POST /context/mcp` and keeps the served
 * bundle fresh.
 *
 * @param app - the BFF app; routes are added under `/context`.
 * @param opts - bundle URL, TTL, and an optional fetch seam.
 */
export function mountContextMcp(app: Hono<AppEnv>, opts: ContextMcpOptions): void {
	const doFetch = withTimeout(opts.fetchImpl ?? fetch, FETCH_TIMEOUT_MS);
	const ttlMs = opts.ttlSec * 1000;

	// One object identity for the process lifetime: the MCP app closes over it,
	// so a refresh swaps contents in place rather than rebuilding routes.
	const bundle = {} as AgentBundle;
	let loaded = false;
	let etag: string | undefined;
	/** Stamped on every ATTEMPT, not only on success — otherwise a dead origin
	 * would start a fresh fetch on every single request once the TTL lapsed. */
	let attemptedAt = 0;
	let inflight: Promise<void> | undefined;

	async function refresh(): Promise<void> {
		attemptedAt = Date.now();
		try {
			const res = await doFetch(opts.bundleUrl, {
				headers: etag ? { "if-none-match": etag } : undefined,
			});
			// The common case once loaded: the site republishes rarely, so most
			// revalidations cost one conditional GET and no parse at all.
			if (res.status === 304) return;
			if (!res.ok) {
				console.error("[eps-backend] context bundle fetch failed", {
					status: res.status,
				});
				return;
			}
			const next: unknown = await res.json();
			if (!isUsableBundle(next)) {
				console.error("[eps-backend] context bundle rejected (shape)");
				return;
			}
			// Swap with no `await` in between, so a request in flight can never
			// observe a half-emptied bundle (single-threaded JS makes this atomic).
			const mutable = bundle as unknown as Record<string, unknown>;
			for (const key of Object.keys(mutable)) delete mutable[key];
			Object.assign(bundle, next);
			etag = res.headers.get("etag") ?? undefined;
			loaded = true;
			console.log("[eps-backend] context bundle loaded", {
				bundleVersion: next.meta.bundleVersion,
			});
		} catch (err) {
			// Keep serving the last good bundle. Never rethrow: this runs detached.
			console.error("[eps-backend] context bundle refresh error", err);
		}
	}

	function maybeRefresh(): void {
		if (inflight || Date.now() - attemptedAt < ttlMs) return;
		inflight = refresh().finally(() => {
			inflight = undefined;
		});
		// ponytail: lazy trigger, no setInterval — nothing to unref on shutdown and
		// zero work while idle. Ceiling: after a long idle the first request serves
		// a stale bundle and refreshes behind it. Add a timer only if that matters.
		void inflight;
	}

	// Warm the bundle at boot without blocking startup: the auth service must
	// come up (and pass /readyz) whether or not the site is reachable.
	maybeRefresh();

	app.use("/context/*", async (c, next) => {
		maybeRefresh();
		if (!loaded) {
			return c.json(rpcError(-32000, "Context bundle not loaded yet"), 503);
		}
		await next();
		// Hono's cors middleware rebuilds the response when an Origin header is
		// present, which drops the `no-store` the MCP app set on its own Response.
		// Re-assert it: MCP replies vary by JSON-RPC body, so any shared cache
		// keyed on the URL alone would hand back the wrong tool result.
		if (!c.res.headers.has("cache-control")) {
			c.res.headers.set("cache-control", "no-store");
		}
	});

	// `route` strips the `/context` prefix natively, so the sub-app keeps serving
	// bare `/mcp` + `/healthz` and no Request rewriting is involved.
	app.route("/context", createContextApp(bundle, "remote"));
}

/**
 * The JSON-RPC error an unhandled failure under `/context/*` must return.
 *
 * Hono resolves a thrown handler error inside `dispatch` and hands it to the
 * app-level `onError`, so a middleware `try/catch` around `next()` never sees
 * it — containment has to happen in `onError` itself, which is why this is
 * exported rather than applied here. Without it an MCP client gets the BFF's
 * `{error:{code:"UPSTREAM_ERROR"}}` envelope, which is not JSON-RPC.
 */
export const contextMcpErrorBody = () =>
	rpcError(-32603, "Internal error");
