/**
 * Remote (streamable HTTP) transport: a stateless Hono app for the edge deploy
 * at https://mcp.eko.in/context/mcp. Every POST /mcp builds a fresh MCP Server +
 * transport pair and tears it down with the request. Unlike the transact server
 * there is NO auth: context tools are read-only documentation lookups over the
 * baked bundle — no credentials, no PII, no billable upstream calls. Abuse
 * protection is handled at the proxy/platform layer (nginx `limit_req`), not here.
 *
 * Mirrors the stateless POST-only shape of packages/eps-transact-mcp/src/http.ts.
 * Once this compiles and its tests match that shape, the common skeleton should
 * be extracted into a shared adapter both packages import (see remote-design spec).
 */
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { AgentBundle } from "./bundle-types.js";
import { createEpsServer } from "./server.js";

/** JSON-RPC-shaped error for the HTTP layer (before the MCP transport exists). */
const rpcError = (code: number, message: string) => ({
	jsonrpc: "2.0" as const,
	error: { code, message },
	id: null,
});

/**
 * Build the Hono app. Pure: no environment reads, no I/O at construction. The
 * bundle is loaded once by the caller (api/index.ts) and injected here.
 *
 * @param bundle - the loaded agent bundle.
 * @param source - "baked" | "remote", surfaced by the get_meta tool.
 */
export const createApp = (
	bundle: AgentBundle,
	source: "baked" | "remote" = "baked",
) => {
	const app = new Hono();

	app.get("/healthz", (c) =>
		c.json({ ok: true, bundleVersion: bundle.meta.bundleVersion, source }),
	);

	app.post("/mcp", async (c) => {
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined, // stateless: no session to manage
			enableJsonResponse: true,
		});
		const server = createEpsServer(bundle, source);
		await server.connect(transport);
		const res = await transport.handleRequest(c.req.raw);
		// Never cache MCP responses: they vary by JSON-RPC body + method, so a
		// shared cache keyed on anything coarser would serve the wrong tool result.
		res.headers.set("Cache-Control", "no-store");
		return res;
	});

	// Stateless POST-only per MCP streamable-HTTP spec (server MAY omit the GET
	// SSE stream); DELETE is meaningless without sessions.
	app.on(["GET", "DELETE"], "/mcp", (c) => {
		c.header("Allow", "POST");
		return c.json(rpcError(-32000, "Method not allowed. POST only."), 405);
	});

	return app;
};
