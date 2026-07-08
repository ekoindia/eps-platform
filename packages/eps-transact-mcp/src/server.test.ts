import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { signSecretKey } from "@ekoindia/eps-sdk";

import { loadBundle } from "./load-bundle.js";
import { buildToolDefs, verificationApis, type ToolDef } from "./tools.js";
import { createTransactServer, sanitizeError } from "./server.js";
import type { TransactCtx } from "./ctx.js";

const { bundle } = await loadBundle();
const tools = buildToolDefs(bundle);
const FIXED_NOW = 1_700_000_000_000;

/** Capture-all fetch mock: records requests, returns a canned success body. */
const mockFetch = () => {
	const calls: { url: string; init: RequestInit }[] = [];
	const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return new Response(
			JSON.stringify({ response_status_id: 0, data: { ok: true } }),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	}) as typeof fetch;
	return { calls, impl };
};

const connect = async (ctxOverrides: Partial<TransactCtx> = {}) => {
	const { calls, impl } = mockFetch();
	const ctx: TransactCtx = {
		developerKey: "dev-key-1",
		accessKey: "access-key-1",
		environment: "sandbox",
		allowed: "all",
		fetch: impl,
		now: () => FIXED_NOW,
		...ctxOverrides,
	};
	const server = createTransactServer(tools, ctx, bundle.meta.bundleVersion);
	const client = new Client({ name: "test", version: "0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(a), client.connect(b)]);
	return { client, calls };
};

/** Args for a tool built from spec examples (typed fallbacks otherwise). */
const argsFor = (tool: ToolDef): Record<string, unknown> => {
	const api = verificationApis(bundle).find((a) => a.slug === tool.slug);
	if (!api) throw new Error(`no api for ${tool.slug}`);
	return Object.fromEntries(
		api.requestParams
			.filter((p) => p.required)
			.map((p) => [
				p.name,
				p.example ??
					(p.type === "number" || p.type === "integer" ? 1 : "test-value"),
			]),
	);
};

const panLite = tools.find((t) => t.name === "eps_pan_lite");
if (!panLite) throw new Error("eps_pan_lite tool missing");

describe("transact server", () => {
	it("lists every generated tool when allowlist is 'all'", async () => {
		const { client } = await connect();
		const names = (await client.listTools()).tools.map((t) => t.name);
		expect(names.sort()).toEqual(tools.map((t) => t.name).sort());
	});

	it("filters tools/list by the allowlist and rejects non-allowed calls", async () => {
		const { client } = await connect({ allowed: new Set(["eps_pan_lite"]) });
		const names = (await client.listTools()).tools.map((t) => t.name);
		expect(names).toEqual(["eps_pan_lite"]);
		const other = tools.find((t) => t.name !== "eps_pan_lite");
		const res = await client.callTool({
			name: other?.name ?? "",
			arguments: argsFor(other as ToolDef),
		});
		expect(res.isError).toBe(true);
		expect(JSON.parse((res.content as { text: string }[])[0].text).code).toBe(
			"TOOL_NOT_ALLOWED",
		);
	});

	it("signs and sends a real EPS request (sandbox base URL, JSON body)", async () => {
		const { client, calls } = await connect();
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: argsFor(panLite),
		});
		expect(res.isError).toBeFalsy();
		expect(calls).toHaveLength(1);
		const sandbox = bundle.meta.environments.find((e) => e.id === "sandbox");
		expect(calls[0].url.startsWith(sandbox?.baseUrl ?? "")).toBe(true);
		const headers = calls[0].init.headers as Record<string, string>;
		expect(headers.developer_key).toBe("dev-key-1");
		expect(headers["secret-key-timestamp"]).toBe(String(FIXED_NOW));
		expect(headers["secret-key"]).toBe(
			signSecretKey("access-key-1", String(FIXED_NOW)),
		);
		expect(headers["content-type"]).toBe("application/json");
	});

	it("targets the production base URL when ctx.environment is production", async () => {
		const { client, calls } = await connect({ environment: "production" });
		await client.callTool({
			name: "eps_pan_lite",
			arguments: argsFor(panLite),
		});
		const prod = bundle.meta.environments.find((e) => e.id === "production");
		expect(prod?.baseUrl).toBeTruthy();
		expect(calls[0].url.startsWith(prod?.baseUrl ?? "")).toBe(true);
	});

	it("returns a VALIDATION error naming params (not values) when required args are missing", async () => {
		const { client, calls } = await connect();
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: {},
		});
		expect(res.isError).toBe(true);
		const payload = JSON.parse((res.content as { text: string }[])[0].text) as {
			code: string;
			message: string;
		};
		expect(payload.code).toBe("VALIDATION");
		expect(payload.message).toContain("pan-lite");
		expect(calls).toHaveLength(0); // nothing signed or sent
	});

	it("demotes initiator_id from required when ctx has a default, and injects it", async () => {
		const { client, calls } = await connect({ initiatorId: "9999999999" });
		const listed = (await client.listTools()).tools.find(
			(t) => t.name === "eps_pan_lite",
		);
		const required = (listed?.inputSchema as { required?: string[] }).required;
		expect(required).not.toContain("initiator_id");
		const args = argsFor(panLite);
		delete args.initiator_id;
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: args,
		});
		expect(res.isError).toBeFalsy();
		const body = JSON.parse(String(calls[0].init.body)) as Record<
			string,
			unknown
		>;
		expect(body.initiator_id).toBe("9999999999");
	});

	it("sanitizes upstream failures to a generic message (no PII passthrough)", async () => {
		const failingFetch = (async () => {
			throw new Error('connect ECONNREFUSED — request {"pan_number":"SECRET"}');
		}) as unknown as typeof fetch;
		const { client } = await connect({ fetch: failingFetch });
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: argsFor(panLite),
		});
		expect(res.isError).toBe(true);
		const payload = JSON.parse((res.content as { text: string }[])[0].text) as {
			code: string;
			message: string;
		};
		expect(payload.code).toBe("UPSTREAM_ERROR");
		expect(payload.message).not.toContain("SECRET");
	});

	it("rejects unknown tools", async () => {
		const { client } = await connect();
		const res = await client.callTool({ name: "eps_nope", arguments: {} });
		expect(res.isError).toBe(true);
		expect(JSON.parse((res.content as { text: string }[])[0].text).code).toBe(
			"UNKNOWN_TOOL",
		);
	});

	it("tools/list parses against the raw protocol schema with title + annotations", async () => {
		const { client } = await connect();
		const listed = ListToolsResultSchema.parse(await client.listTools());
		for (const t of listed.tools) {
			expect(t.title, t.name).toBeTruthy();
			expect(t.annotations?.openWorldHint, t.name).toBe(true);
			expect(typeof t.annotations?.readOnlyHint, t.name).toBe("boolean");
		}
		const pennyDrop = listed.tools.find(
			(t) => t.name === "eps_bank_account_verification",
		);
		expect(pennyDrop?.annotations?.readOnlyHint).toBe(false);
		expect(pennyDrop?.description).toContain("penny-drop");
	});

	it("call results are minified (no pretty-print indentation)", async () => {
		const { client } = await connect();
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: argsFor(panLite),
		});
		expect((res.content as { text: string }[])[0].text).not.toContain("\n");
	});

	it("connects and lists tools even without credentials (stdio no-creds mode)", async () => {
		const { client } = await connect({ developerKey: "", accessKey: "" });
		const names = (await client.listTools()).tools.map((t) => t.name);
		expect(names.sort()).toEqual(tools.map((t) => t.name).sort());
	});

	it("returns MISSING_CREDENTIALS and makes no network call when credentials are absent", async () => {
		const { client, calls } = await connect({
			developerKey: "",
			accessKey: "",
		});
		const res = await client.callTool({
			name: "eps_pan_lite",
			arguments: argsFor(panLite),
		});
		expect(res.isError).toBe(true);
		expect(JSON.parse((res.content as { text: string }[])[0].text).code).toBe(
			"MISSING_CREDENTIALS",
		);
		expect(calls).toHaveLength(0); // guard fires before any signing/network
	});
});

describe("sanitizeError", () => {
	it("classifies timeouts", () => {
		const err = new Error("timed out");
		err.name = "TimeoutError";
		expect(sanitizeError(err).code).toBe("UPSTREAM_TIMEOUT");
	});
	it("passes through EpsClient validation messages verbatim", () => {
		expect(
			sanitizeError(new Error('Missing required params for "pan-lite": dob.')),
		).toEqual({
			code: "VALIDATION",
			message: 'Missing required params for "pan-lite": dob.',
		});
	});
});
