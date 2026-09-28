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

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { AgentBundle } from "./bundle-types.js";
import { createEpsServer } from "./server.js";
import {
	isPublicTool,
	restStatus,
	toOpenApi,
	toRestBody,
	withClient,
} from "./rest.js";

/** JSON-RPC-shaped error for the HTTP layer (before the MCP transport exists). */
const rpcError = (code: number, message: string) => ({
	jsonrpc: "2.0" as const,
	error: { code, message },
	id: null,
});

/** REST error envelope — `/tools/*` and `/openapi.json` are plain REST, not
 * JSON-RPC, so they get the conventional `{error:{code,message}}` shape. */
const restError = (code: string, message: string) => ({
	error: { code, message },
});

/**
 * Parse a REST tool body into MCP arguments. An empty body is `{}` (no-arg
 * tools); anything that isn't a JSON object is rejected rather than coerced.
 */
const readArgs = async (
	req: Request,
): Promise<Record<string, unknown> | undefined> => {
	const raw = await req.text();
	if (!raw.trim()) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed !== null &&
			typeof parsed === "object" &&
			!Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
};

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

	// REST face of the same tools (see rest.ts). The server URL is derived from
	// the request so it is right both at the edge (bare) and behind the
	// backend's `/context` mount; nginx sets Host + X-Forwarded-Proto.
	app.get("/openapi.json", async (c) => {
		const url = new URL(c.req.url);
		const proto =
			c.req.header("x-forwarded-proto") ?? url.protocol.slice(0, -1);
		const base = `${proto}://${url.host}${url.pathname.replace(/\/openapi\.json$/, "")}`;
		const { tools } = await withClient(
			createEpsServer(bundle, source),
			(client) => client.listTools(),
		);
		return c.json(toOpenApi(tools, base, bundle.meta.bundleVersion), 200, {
			"Cache-Control": "no-store",
		});
	});

	app.post("/tools/:name", async (c) => {
		c.header("Cache-Control", "no-store");
		const name = c.req.param("name");
		const args = await readArgs(c.req.raw);
		if (!args) {
			return c.json(
				restError("BAD_REQUEST", "Body must be a JSON object."),
				400,
			);
		}
		const outcome = await withClient(
			createEpsServer(bundle, source),
			async (client) => {
				const { tools } = await client.listTools();
				if (!tools.some((tool) => tool.name === name && isPublicTool(tool))) {
					return undefined;
				}
				return client.callTool({ name, arguments: args });
			},
		);
		if (!outcome) {
			return c.json(restError("NOT_FOUND", `Unknown tool "${name}".`), 404);
		}
		const result = outcome as CallToolResult;
		const status = restStatus(result);
		if (status === 200) return c.json(toRestBody(result) as object, 200);
		if (status === 500) {
			console.error("[eps-context-mcp] tool failed", { name, result });
			return c.json(restError("INTERNAL", "Internal error"), 500);
		}
		const message =
			result.content[0]?.type === "text" ? result.content[0].text : "";
		return c.json(
			restError(status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message),
			status,
		);
	});

	// Stateless POST-only per MCP streamable-HTTP spec (server MAY omit the GET
	// SSE stream); DELETE is meaningless without sessions.
	app.on(["GET", "DELETE"], "/mcp", (c) => {
		c.header("Allow", "POST");
		return c.json(rpcError(-32000, "Method not allowed. POST only."), 405);
	});

	return app;
};
