/**
 * Mounts the anonymous eps-context-mcp server at `/context/*` (public URL
 * `https://mcp.eko.in/context/mcp`).
 *
 * The MCP app itself lives in `@ekoindia/eps-context-mcp` and is consumed
 * as-is. Bundle freshness is not this module's concern — it belongs to the
 * shared `ContextBundleManager` (`../context/bundleManager`), because the
 * docs-chat route grounds its answers on the same object and the two must
 * never disagree about which bundle version is current.
 *
 * What remains here is **isolation**: this process also mints sessions and
 * holds admin GitHub tokens, so nothing on this path may throw into the shared
 * error handler or emit the BFF's error envelope to an MCP client.
 */
import type { Hono } from "hono";
import { createApp as createContextApp } from "@ekoindia/eps-context-mcp/src/http.js";

import type { ContextBundleManager } from "../context/bundleManager";
import type { AppEnv } from "./requestId";

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
 * Mounts `GET /context/healthz` + `POST /context/mcp` against a shared bundle.
 *
 * @param app - the BFF app; routes are added under `/context`.
 * @param bundles - the shared bundle manager, also used by the chat route.
 */
export function mountContextMcp(
	app: Hono<AppEnv>,
	bundles: ContextBundleManager,
): void {
	app.use("/context/*", async (c, next) => {
		bundles.ensureFresh();
		if (!bundles.isLoaded()) {
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
	app.route("/context", createContextApp(bundles.bundle, "remote"));
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
