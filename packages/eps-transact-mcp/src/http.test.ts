import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import { createApp, extractToolName } from "./http.js";
import { buildToolDefs, verificationApis } from "./tools.js";
import type { AccessLogger } from "./accessLog.js";

const { bundle } = await loadBundle();
const tools = buildToolDefs(bundle);

const AUTH_HEADERS = {
	"x-eko-developer-key": "dev-key-1",
	"x-eko-access-key": "access-key-1",
	"x-eko-allowed-apis": "*",
};
const MCP_HEADERS = {
	...AUTH_HEADERS,
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

/** Fetch mock that always returns an EPS success envelope. */
const okFetch = (async () =>
	new Response(JSON.stringify({ response_status_id: 0, data: { ok: true } }), {
		status: 200,
		headers: { "content-type": "application/json" },
	})) as typeof fetch;

const makeApp = (overrides: Partial<Parameters<typeof createApp>[0]> = {}) =>
	createApp({ bundle, fetch: okFetch, rateLimit: false, ...overrides });

const panLiteArgs = () => {
	const api = verificationApis(bundle).find((a) => a.slug === "pan-lite");
	return Object.fromEntries(
		(api?.requestParams ?? [])
			.filter((p) => p.required)
			.map((p) => [p.name, p.example ?? "test-value"]),
	);
};

describe("http transport", () => {
	it("GET /healthz reports bundle version and tool count", async () => {
		const res = await makeApp().request("/healthz");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({
			ok: true,
			bundleVersion: bundle.meta.bundleVersion,
			tools: tools.length,
		});
	});

	it("401 when credential headers are missing", async () => {
		const res = await makeApp().request("/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: INITIALIZE,
		});
		expect(res.status).toBe(401);
	});

	it("400 when the allowlist header is absent (paid APIs: explicit opt-in)", async () => {
		const res = await makeApp().request("/mcp", {
			method: "POST",
			headers: {
				...MCP_HEADERS,
				"x-eko-allowed-apis": "",
			},
			body: INITIALIZE,
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("X-Eko-Allowed-Apis");
	});

	it("400 on an unknown X-Eko-Env value", async () => {
		const res = await makeApp().request("/mcp", {
			method: "POST",
			headers: { ...MCP_HEADERS, "x-eko-env": "staging" },
			body: INITIALIZE,
		});
		expect(res.status).toBe(400);
	});

	it("405 on GET/DELETE /mcp (stateless POST-only)", async () => {
		const app = makeApp();
		for (const method of ["GET", "DELETE"]) {
			const res = await app.request("/mcp", { method, headers: MCP_HEADERS });
			expect(res.status).toBe(405);
		}
	});

	it("echoes/mints x-request-id", async () => {
		const res = await makeApp().request("/healthz", {
			headers: { "x-request-id": "abc-123" },
		});
		expect(res.headers.get("x-request-id")).toBe("abc-123");
	});

	it("serves initialize, tools/list and tools/call as independent stateless requests", async () => {
		const app = makeApp();
		const init = await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: INITIALIZE,
		});
		expect(init.status).toBe(200);
		const initBody = (await init.json()) as {
			result: { serverInfo: { name: string } };
		};
		expect(initBody.result.serverInfo.name).toBe("eps-transact-mcp");

		// No session id carried over — each request stands alone.
		const list = await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: rpc("tools/list", {}, 2),
		});
		expect(list.status).toBe(200);
		const listBody = (await list.json()) as {
			result: { tools: { name: string }[] };
		};
		expect(listBody.result.tools.length).toBe(tools.length);

		const call = await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: rpc(
				"tools/call",
				{ name: "eps_pan_lite", arguments: panLiteArgs() },
				3,
			),
		});
		expect(call.status).toBe(200);
		const callBody = (await call.json()) as {
			result: { isError?: boolean; content: { text: string }[] };
		};
		expect(callBody.result.isError).toBeFalsy();
		expect(JSON.parse(callBody.result.content[0].text).response_status_id).toBe(
			0,
		);
	});

	it("respects a scoped allowlist end-to-end", async () => {
		const app = makeApp();
		const list = await app.request("/mcp", {
			method: "POST",
			headers: { ...MCP_HEADERS, "x-eko-allowed-apis": "eps_pan_lite" },
			body: rpc("tools/list", {}, 4),
		});
		const body = (await list.json()) as {
			result: { tools: { name: string }[] };
		};
		expect(body.result.tools.map((t) => t.name)).toEqual(["eps_pan_lite"]);
	});

	it("429 after the per-key window limit", async () => {
		const app = makeApp({ rateLimit: { limit: 2, windowSec: 600 } });
		const post = () =>
			app.request("/mcp", {
				method: "POST",
				headers: MCP_HEADERS,
				body: rpc("tools/list", {}, 5),
			});
		expect((await post()).status).toBe(200);
		expect((await post()).status).toBe(200);
		expect((await post()).status).toBe(429);
	});

	it("access log carries the tool name but never argument values", async () => {
		const lines: string[] = [];
		const sink: AccessLogger = {
			log: (input) => lines.push(JSON.stringify(input)),
		};
		const app = makeApp({ accessLog: sink });
		const args = { ...panLiteArgs(), pan_number: "SECRETPAN1" };
		await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: rpc("tools/call", { name: "eps_pan_lite", arguments: args }, 6),
		});
		expect(lines.length).toBe(1);
		expect(lines[0]).toContain('"tool":"eps_pan_lite"');
		expect(lines.join("")).not.toContain("SECRETPAN1");
		expect(lines.join("")).not.toContain("access-key-1");
	});

	it("malformed JSON body does not break logging or the request path", async () => {
		const lines: string[] = [];
		const sink: AccessLogger = {
			log: (input) => lines.push(JSON.stringify(input)),
		};
		const app = makeApp({ accessLog: sink });
		const res = await app.request("/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: "{not json",
		});
		expect(res.status).toBeGreaterThanOrEqual(400); // transport rejects it
		expect(lines.length).toBe(1);
		expect(lines[0]).not.toContain("not json");
	});
});

describe("extractToolName", () => {
	it("extracts only from tools/call", async () => {
		const req = (body: string) =>
			new Request("http://x/mcp", { method: "POST", body });
		expect(
			await extractToolName(
				req(rpc("tools/call", { name: "eps_pan_lite", arguments: {} })),
			),
		).toBe("eps_pan_lite");
		expect(await extractToolName(req(rpc("tools/list")))).toBeUndefined();
		expect(await extractToolName(req("{broken"))).toBeUndefined();
		expect(await extractToolName(req("[1,2]"))).toBeUndefined();
	});
});
