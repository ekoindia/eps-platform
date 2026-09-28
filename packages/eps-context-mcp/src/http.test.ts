import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { createApp } from "./http.js";
import { MAX_DESCRIPTION, restStatus, toOpenApi, withClient } from "./rest.js";
import { createEpsServer } from "./server.js";

const { bundle } = await loadBundle();

const MCP_HEADERS = {
	"content-type": "application/json",
	accept: "application/json, text/event-stream",
};

const rpc = (method: string, params: unknown = {}, id: number = 1) =>
	JSON.stringify({ jsonrpc: "2.0", id, method, params });

const INITIALIZE = rpc("initialize", {
	protocolVersion: "2025-03-26",
	capabilities: {},
	clientInfo: { name: "test", version: "0" },
});

describe("context-mcp http transport", () => {
	it("GET /healthz reports bundle version, no auth required", async () => {
		const res = await createApp(bundle).request("/healthz");
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			ok: true,
			bundleVersion: bundle.meta.bundleVersion,
		});
	});

	it("405 on GET/DELETE /mcp (stateless POST-only)", async () => {
		for (const method of ["GET", "DELETE"] as const) {
			const res = await createApp(bundle).request("/mcp", { method });
			expect(res.status).toBe(405);
			expect(res.headers.get("Allow")).toBe("POST");
		}
	});

	it("serves initialize + tools/list anonymously, never caches", async () => {
		const app = createApp(bundle);
		const init = await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: INITIALIZE,
		});
		expect(init.status).toBe(200);
		// The whole point of the remote deploy: no auth header sent, still works.
		expect(init.headers.get("Cache-Control")).toBe("no-store");

		const list = await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: rpc("tools/list", {}, 2),
		});
		expect(list.status).toBe(200);
		const text = await list.text();
		expect(text).toContain("list_apis"); // a known context tool
	});
});

describe("context-mcp REST shim", () => {
	const app = createApp(bundle);
	const post = (name: string, body?: string) =>
		app.request(`/tools/${name}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		});

	it("GET /openapi.json publishes exactly the read-only MCP tools", async () => {
		// Mounted the way eps-backend mounts it (contextMcp.ts).
		const mounted = new Hono().route("/context", app);
		const res = await mounted.request(
			"http://mcp.eko.in/context/openapi.json",
			{
				headers: { "x-forwarded-proto": "https" },
			},
		);
		expect(res.status).toBe(200);
		const doc = await res.json();
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.servers[0].url).toBe("https://mcp.eko.in/context");

		const { tools } = await withClient(createEpsServer(bundle, "baked"), (c) =>
			c.listTools(),
		);
		const ops = Object.values(doc.paths).map(
			(p) => (p as { post: { operationId: string } }).post.operationId,
		);
		expect(ops.sort()).toEqual(tools.map((t) => t.name).sort());
		for (const path of Object.values(doc.paths)) {
			const { description } = (path as { post: { description: string } }).post;
			expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
		}
	});

	it("drops non-read-only tools from the OpenAPI doc", () => {
		const tools = [
			{
				name: "safe",
				inputSchema: { type: "object" as const },
				annotations: { readOnlyHint: true },
			},
			{ name: "writes", inputSchema: { type: "object" as const } },
		];
		expect(Object.keys(toOpenApi(tools, "https://x", "v").paths)).toEqual([
			"/tools/safe",
		]);
	});

	it("POST /tools/search → 200 JSON array", async () => {
		const res = await post("search", JSON.stringify({ query: "pan" }));
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(Array.isArray(await res.json())).toBe(true);
	});

	it("empty body counts as {} for no-arg tools", async () => {
		const res = await post("list_recipes");
		expect(res.status).toBe(200);
		expect((await res.json()).length).toBeGreaterThan(0);
	});

	it("POST /tools/get_recipe with unknown id → 404 with message", async () => {
		const res = await post("get_recipe", JSON.stringify({ id: "nope" }));
		expect(res.status).toBe(404);
		expect((await res.json()).error.message).toContain("Unknown recipe");
	});

	it("invalid or missing arguments → 400 (pins the SDK's validation prefix)", async () => {
		for (const body of [
			JSON.stringify({ limit: "x" }),
			JSON.stringify({}), // search requires query
		]) {
			const res = await post(
				body.includes("limit") ? "list_apis" : "search",
				body,
			);
			expect(res.status).toBe(400);
			expect((await res.json()).error.code).toBe("BAD_REQUEST");
		}
	});

	it("non-object bodies → 400", async () => {
		for (const body of ["{bad", "null", "[]", "42", '"str"']) {
			expect((await post("list_topics", body)).status).toBe(400);
		}
	});

	it("unknown tool → 404", async () => {
		expect((await post("nope", "{}")).status).toBe(404);
	});

	it("non-JSON tool output comes back as { text }", async () => {
		const res = await post(
			"get_signing_snippet",
			JSON.stringify({ language: "python" }),
		);
		expect(res.status).toBe(200);
		expect((await res.json()).text).toContain("hmac");
	});

	it("a throwing handler → 500 without leaking its message", async () => {
		const server = new McpServer({ name: "t", version: "0" });
		server.registerTool("boom", { inputSchema: {} }, async () => {
			throw new Error("secret internals");
		});
		const result = await withClient(server, (c) =>
			c.callTool({ name: "boom", arguments: {} }),
		);
		expect(restStatus(result as CallToolResult)).toBe(500);
	});
});
