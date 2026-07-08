import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import { createApp } from "./http.js";

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
