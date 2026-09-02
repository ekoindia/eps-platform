import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { loadBundle } from "./load-bundle.js";
import { createEpsServer } from "./server.js";

const { bundle } = await loadBundle();

const connect = async () => {
	const server = createEpsServer(bundle, "baked");
	const client = new Client({ name: "test", version: "0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(a), client.connect(b)]);
	return client;
};

/**
 * JSON body of a tool result. Takes callTool's own return type — a union that
 * still carries the legacy `toolResult` shape — so call sites need no cast.
 */
const parse = (res: Awaited<ReturnType<Client["callTool"]>>) =>
	JSON.parse(
		(res.content as { text?: string }[] | undefined)?.[0]?.text ?? "null",
	);

describe("eps-context-mcp tools", () => {
	it("exposes the expected tool set", async () => {
		const client = await connect();
		const names = (await client.listTools()).tools.map((t) => t.name).sort();
		expect(names).toEqual(
			[
				"debug_auth",
				"get_api",
				"get_meta",
				"get_recipe",
				"get_sdk",
				"get_signing_snippet",
				"get_topic",
				"list_apis",
				"list_recipes",
				"list_sdks",
				"list_topics",
				"search",
			].sort(),
		);
	});

	it("list_apis returns compact entries with no bodies", async () => {
		const client = await connect();
		const res = await client.callTool({ name: "list_apis", arguments: {} });
		const list = parse(res);
		expect(list[0]).not.toHaveProperty("responseFields");
	});

	it("get_topic('auth') is backend-only", async () => {
		const client = await connect();
		const res = await client.callTool({
			name: "get_topic",
			arguments: { topic: "auth" },
		});
		expect(parse(res).backendOnly).toBe(true);
	});

	it("get_meta reports package version + update availability", async () => {
		const server = createEpsServer(bundle, "baked", {
			current: "0.1.0",
			latest: "0.2.0",
			updateAvailable: true,
		});
		const client = new Client({ name: "test", version: "0" });
		const [a, b] = InMemoryTransport.createLinkedPair();
		await Promise.all([server.connect(a), client.connect(b)]);
		const meta = parse(
			(await client.callTool({ name: "get_meta", arguments: {} })) as never,
		);
		expect(meta.packageVersion).toBe("0.1.0");
		expect(meta.latestVersion).toBe("0.2.0");
		expect(meta.updateAvailable).toBe(true);
		expect(meta.source).toBe("baked");
	});

	it("debug_auth serves a test vector that actually reproduces", async () => {
		const client = await connect();
		const res = parse(
			(await client.callTool({
				name: "debug_auth",
				arguments: {},
			})) as never,
		);
		const { accessKey, timestamp, secretKey } = res.test_vector;
		// Independent implementation: if this drifts, the vector we publish to
		// agents is wrong and would send them chasing a phantom signing bug.
		expect(secretKey).toBe(
			createHmac("sha256", Buffer.from(accessKey).toString("base64"))
				.update(timestamp)
				.digest("base64"),
		);
		expect(res.ranked_causes.length).toBeGreaterThan(0);
		// Callable with no arguments: useful before the caller has anything to check.
		expect(res.checks.every((c: { ok: boolean | null }) => c.ok === null)).toBe(
			true,
		);
	});

	it("debug_auth diagnoses the supplied timestamp and signature", async () => {
		const client = await connect();
		const res = parse(
			(await client.callTool({
				name: "debug_auth",
				arguments: { timestamp: "1700000000", secret_key: "not-base64!!" },
			})) as never,
		);
		const checks: { name: string; ok: boolean | null; detail: string }[] =
			res.checks;
		expect(checks.find((c) => c.name === "timestamp_unit")?.ok).toBe(false);
		expect(checks.find((c) => c.name === "signature_shape")?.ok).toBe(false);
	});

	it("no tool accepts an access_key parameter (secret-free)", async () => {
		const client = await connect();
		for (const t of (await client.listTools()).tools) {
			const props =
				(t.inputSchema as { properties?: Record<string, unknown> })
					.properties ?? {};
			expect(Object.keys(props)).not.toContain("access_key");
		}
	});

	it("every tool carries read-only annotations", async () => {
		const client = await connect();
		for (const t of (await client.listTools()).tools) {
			expect(t.annotations, t.name).toMatchObject({
				readOnlyHint: true,
				idempotentHint: true,
				openWorldHint: false,
			});
		}
	});

	it("list_apis and search honor limit; search defaults to 10", async () => {
		const client = await connect();
		const limited = parse(
			(await client.callTool({
				name: "list_apis",
				arguments: { limit: 5 },
			})) as never,
		);
		expect(limited).toHaveLength(5);
		const defaulted = parse(
			(await client.callTool({
				name: "search",
				arguments: { query: "verification" },
			})) as never,
		);
		expect(defaulted.length).toBeLessThanOrEqual(10);
		const wide = parse(
			(await client.callTool({
				name: "search",
				arguments: { query: "verification", limit: 50 },
			})) as never,
		);
		expect(wide.length).toBeGreaterThanOrEqual(defaulted.length);
	});

	it("rejects an invalid category, naming the valid values", async () => {
		const client = await connect();
		const res = (await client.callTool({
			name: "list_apis",
			arguments: { category: "nonsense" },
		})) as { isError?: boolean; content: { text?: string }[] };
		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("verification");
	});

	it("unknown slug returns isError with suggestions", async () => {
		const client = await connect();
		const res = (await client.callTool({
			name: "get_api",
			arguments: { slug: "pan-lit" },
		})) as { isError?: boolean; content: { text?: string }[] };
		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("Unknown slug");
		expect(res.content[0].text).toMatch(/search or list_apis/);
	});

	it("unknown recipe returns isError listing valid ids", async () => {
		const client = await connect();
		const res = (await client.callTool({
			name: "get_recipe",
			arguments: { id: "bogus" },
		})) as { isError?: boolean; content: { text?: string }[] };
		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("Valid recipe ids");
	});

	it("outputs are minified (no pretty-print indentation)", async () => {
		const client = await connect();
		const res = (await client.callTool({
			name: "get_meta",
			arguments: {},
		})) as { content: { text?: string }[] };
		expect(res.content[0].text).not.toContain("\n");
	});

	it("lists the SDKs compactly, without members or examples", async () => {
		const client = await connect();
		const res = await client.callTool({ name: "list_sdks", arguments: {} });
		const sdks = parse(res) as Record<string, unknown>[];
		expect(sdks.length).toBeGreaterThan(0);
		for (const sdk of sdks) {
			expect(sdk.installCommand).toBeTruthy();
			expect(sdk.docsUrl).toContain("/docs/sdk/");
			expect(sdk.members).toBeUndefined();
			expect(sdk.example).toBeUndefined();
		}
	});

	it("returns one SDK in full, by language id or guide slug", async () => {
		const client = await connect();
		for (const language of ["javascript", "nodejs"]) {
			const res = await client.callTool({
				name: "get_sdk",
				arguments: { language },
			});
			const sdk = parse(res) as Record<string, unknown>;
			expect(sdk.slug).toBe("nodejs");
			expect(Array.isArray(sdk.members)).toBe(true);
			expect(sdk.example).toContain("pan-lite");
			expect(Array.isArray(sdk.errorTypes)).toBe(true);
		}
	});

	it("rejects a language with no SDK, naming the ones that exist", async () => {
		const client = await connect();
		const res = await client.callTool({
			name: "get_sdk",
			arguments: { language: "javascript" },
		});
		expect(res.isError).toBeFalsy();
		// `csharp` is a signing-snippet language but has no SDK — the two enums
		// are deliberately different, so schema validation rejects it.
		const bad = await client.callTool({
			name: "get_sdk",
			arguments: { language: "csharp" },
		});
		expect(bad.isError).toBe(true);
	});
});
