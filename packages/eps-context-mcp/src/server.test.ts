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

const parse = (res: { content: { type: string; text?: string }[] }) =>
	JSON.parse(res.content[0].text ?? "null");

describe("eps-context-mcp tools", () => {
	it("exposes the expected tool set", async () => {
		const client = await connect();
		const names = (await client.listTools()).tools.map((t) => t.name).sort();
		expect(names).toEqual(
			[
				"get_api",
				"get_meta",
				"get_recipe",
				"get_signing_snippet",
				"get_topic",
				"list_apis",
				"list_recipes",
				"list_topics",
				"search",
			].sort(),
		);
	});

	it("list_apis returns compact entries with no bodies", async () => {
		const client = await connect();
		const res = await client.callTool({ name: "list_apis", arguments: {} });
		const list = parse(res as never);
		expect(list[0]).not.toHaveProperty("responseFields");
	});

	it("get_topic('auth') is backend-only", async () => {
		const client = await connect();
		const res = await client.callTool({
			name: "get_topic",
			arguments: { topic: "auth" },
		});
		expect(parse(res as never).backendOnly).toBe(true);
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

	it("no tool accepts an access_key parameter (secret-free)", async () => {
		const client = await connect();
		for (const t of (await client.listTools()).tools) {
			const props =
				(t.inputSchema as { properties?: Record<string, unknown> })
					.properties ?? {};
			expect(Object.keys(props)).not.toContain("access_key");
		}
	});
});
