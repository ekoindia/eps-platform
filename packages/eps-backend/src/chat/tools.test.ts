import { describe, expect, it } from "vitest";
import type { AgentBundle } from "@ekoindia/eps-context-mcp/src/bundle-types.js";
import {
	CHAT_TOOLS,
	MAX_ARGS_CHARS,
	MAX_RESULT_CHARS,
	dispatchTool,
} from "./tools";

/** Minimal bundle with one of each addressable thing the tools reach for. */
const bundle = {
	meta: {
		org: "ekoindia",
		apiVersion: "v3",
		bundleVersion: "test",
		environments: [],
	},
	topics: {
		auth: {
			summary: "secret-key = base64(HMAC-SHA256(timestamp, base64(access_key)))",
		},
		errors: { summary: "status 0 means success" },
	},
	apis: [
		{
			slug: "pan-verify",
			productId: "verify",
			productName: "Verification",
			name: "PAN Verification",
			method: "POST",
			path: "/pan",
			summary: "Verify a PAN number",
			category: "verification",
			docsUrl: "https://eps.eko.in/docs/pan-verify",
		},
	],
	recipes: [{ id: "onboard", name: "Onboard", summary: "Onboard a user", steps: [] }],
} as unknown as AgentBundle;

describe("CHAT_TOOLS", () => {
	it("declares closed schemas so providers reject invented arguments", () => {
		for (const tool of CHAT_TOOLS) {
			expect(tool.inputSchema.additionalProperties).toBe(false);
			expect(tool.description.length).toBeGreaterThan(40);
		}
	});
});

describe("dispatchTool — untrusted input never throws", () => {
	it("rejects an unknown tool name", () => {
		const r = dispatchTool(bundle, "rm_rf", {});
		expect(r.isError).toBe(true);
		expect(r.content).toContain("unknown tool");
	});

	it("rejects malformed JSON arguments", () => {
		const r = dispatchTool(bundle, "get_api", "{not json");
		expect(r.isError).toBe(true);
		expect(r.content).toContain("not valid JSON");
	});

	it("rejects oversized arguments before parsing them", () => {
		const r = dispatchTool(bundle, "search_apis", "x".repeat(MAX_ARGS_CHARS + 1));
		expect(r.isError).toBe(true);
		expect(r.content).toContain("too large");
	});

	it("rejects a missing or blank required argument", () => {
		expect(dispatchTool(bundle, "get_api", {}).isError).toBe(true);
		expect(dispatchTool(bundle, "get_api", { slug: "   " }).isError).toBe(true);
	});

	it("returns an error result, not a throw, for an unknown slug", () => {
		const r = dispatchTool(bundle, "get_api", { slug: "nope" });
		expect(r.isError).toBe(true);
		expect(r.sourceId).toBeUndefined();
	});

	it("accepts arguments as a JSON string, as some providers stream them", () => {
		const r = dispatchTool(bundle, "get_api", '{"slug":"pan-verify"}');
		expect(r.isError).toBe(false);
		expect(r.sourceId).toBe("api:pan-verify");
	});
});

describe("dispatchTool — sources are earned, not assumed", () => {
	it("cites a topic that returned content", () => {
		const r = dispatchTool(bundle, "get_topic", { topic: "auth" });
		expect(r.isError).toBe(false);
		expect(r.sourceId).toBe("topic:auth");
		expect(r.content).toContain("HMAC-SHA256");
	});

	it("does NOT cite a search hit list — looking is not using", () => {
		const r = dispatchTool(bundle, "search_apis", { query: "pan" });
		expect(r.isError).toBe(false);
		expect(r.sourceId).toBeUndefined();
	});

	it("reports an empty search without erroring, and suggests a next move", () => {
		const r = dispatchTool(bundle, "search_apis", { query: "zzzz" });
		expect(r.isError).toBe(false);
		expect(r.content).toContain("No endpoints matched");
	});

	it("cites a signing snippet by language", () => {
		const r = dispatchTool(bundle, "get_signing_snippet", { language: "php" });
		expect(r.isError).toBe(false);
		expect(r.sourceId).toBe("signing:php");
	});

	it("rejects an unsupported signing language rather than emitting a stub", () => {
		const r = dispatchTool(bundle, "get_signing_snippet", { language: "cobol" });
		expect(r.isError).toBe(true);
		expect(r.content).toContain("Supported:");
	});

	it("rejects an unknown topic", () => {
		const r = dispatchTool(bundle, "get_topic", { topic: "billing" });
		expect(r.isError).toBe(true);
	});
});

describe("dispatchTool — result size is bounded", () => {
	it("truncates a result that would otherwise flood the context window", () => {
		const fat = {
			...bundle,
			apis: [{ ...bundle.apis[0], summary: "x".repeat(MAX_RESULT_CHARS * 2) }],
		} as unknown as AgentBundle;
		const r = dispatchTool(fat, "get_api", { slug: "pan-verify" });
		expect(r.isError).toBe(false);
		expect(r.content).toContain("[truncated");
		expect(r.content.length).toBeLessThan(MAX_RESULT_CHARS + 200);
	});
});
