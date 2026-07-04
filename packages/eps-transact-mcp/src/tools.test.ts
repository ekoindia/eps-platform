import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import type { AgentBundle } from "./bundle-types.js";
import {
	FLOW_GUIDANCE,
	SIDE_EFFECTS,
	buildToolDefs,
	paramToJsonSchema,
	toToolName,
	verificationApis,
} from "./tools.js";

const { bundle } = await loadBundle();
const tools = buildToolDefs(bundle);

describe("tool generation", () => {
	it("exposes exactly the verification, non-financial APIs (registry-driven)", () => {
		const expected = verificationApis(bundle);
		expect(expected.length).toBeGreaterThan(0);
		expect(tools.map((t) => t.slug).sort()).toEqual(
			expected.map((a) => a.slug).sort(),
		);
		const bySlug = new Map(bundle.apis.map((a) => [a.slug, a]));
		for (const t of tools) {
			const api = bySlug.get(t.slug);
			expect(api?.category).toBe("verification");
			expect(api?.financial).not.toBe(true);
		}
	});

	it("never exposes a financial or non-verification API", () => {
		const exposed = new Set(tools.map((t) => t.slug));
		for (const api of bundle.apis)
			if (api.financial || api.category !== "verification")
				expect(exposed.has(api.slug)).toBe(false);
	});

	it("prefixes tool names: pan-lite → eps_pan_lite", () => {
		expect(toToolName("pan-lite")).toBe("eps_pan_lite");
		expect(tools.every((t) => /^eps_[a-z0-9_]+$/.test(t.name))).toBe(true);
	});

	it("builds a proper JSON Schema for pan-lite", () => {
		const tool = tools.find((t) => t.name === "eps_pan_lite");
		expect(tool).toBeTruthy();
		expect(tool?.inputSchema.type).toBe("object");
		expect(tool?.inputSchema.required).toContain("pan_number");
		expect(tool?.inputSchema.properties.pan_number?.type).toBe("string");
	});

	it("marks each tool as billed in the description", () => {
		for (const t of tools) expect(t.description).toContain("billed");
	});

	it("maps unknown spec types to untyped schema properties", () => {
		expect(
			paramToJsonSchema({
				name: "x",
				in: "body",
				type: "file",
				required: true,
			}),
		).not.toHaveProperty("type");
		expect(
			paramToJsonSchema({
				name: "x",
				in: "body",
				type: "integer",
				required: true,
			}).type,
		).toBe("integer");
	});

	it("fails loudly if a spec requires a header the executor cannot send", () => {
		const poisoned: AgentBundle = {
			...bundle,
			apis: [
				{
					...verificationApis(bundle)[0],
					headers: [
						{ name: "x-custom", in: "header", type: "string", required: true },
					],
				},
			],
		};
		expect(() => buildToolDefs(poisoned)).toThrow(/x-custom/);
	});

	it("no currently exposed spec requires a non-auth header", () => {
		// buildToolDefs would have thrown otherwise; keep an explicit guard.
		expect(tools.length).toBe(verificationApis(bundle).length);
	});

	it("every SIDE_EFFECTS and FLOW_GUIDANCE slug exists in the exposed set", () => {
		const exposed = new Set(tools.map((t) => t.slug));
		for (const slug of Object.keys(SIDE_EFFECTS))
			expect(exposed.has(slug), slug).toBe(true);
		for (const slug of Object.keys(FLOW_GUIDANCE))
			expect(exposed.has(slug), slug).toBe(true);
	});

	it("annotations: openWorld everywhere; readOnly false exactly on side-effect tools", () => {
		for (const t of tools) {
			expect(t.annotations.openWorldHint, t.name).toBe(true);
			if (SIDE_EFFECTS[t.slug]) {
				expect(t.annotations.readOnlyHint, t.name).toBe(false);
				expect(t.annotations.idempotentHint, t.name).toBe(false);
			} else {
				expect(t.annotations.readOnlyHint, t.name).toBe(true);
				expect(t.annotations).not.toHaveProperty("idempotentHint");
			}
		}
	});

	it("side-effecting tools never claim to be read-only in the description", () => {
		for (const t of tools) {
			if (SIDE_EFFECTS[t.slug]) {
				expect(t.description, t.name).not.toContain("Read-only");
				expect(t.description, t.name).toContain(SIDE_EFFECTS[t.slug]);
			} else {
				expect(t.description, t.name).toContain("Read-only verification");
			}
		}
	});

	it("multi-step tools carry flow-chaining guidance", () => {
		for (const [slug, hint] of Object.entries(FLOW_GUIDANCE)) {
			const tool = tools.find((t) => t.slug === slug);
			expect(tool?.description, slug).toContain(hint);
		}
	});

	it("every tool has a human-readable title", () => {
		for (const t of tools) expect(t.title, t.name).toBeTruthy();
	});

	it("types array params with items from flattened entries[].* siblings", () => {
		const tool = tools.find(
			(t) => t.name === "eps_bulk_bank_account_verification",
		);
		const entries = tool?.inputSchema.properties.entries as {
			type: string;
			items: {
				type: string;
				properties: Record<string, { type?: string }>;
				required: string[];
			};
		};
		expect(entries.type).toBe("array");
		expect(entries.items.type).toBe("object");
		expect(entries.items.properties.bank_account?.type).toBe("string");
		expect(entries.items.required).toEqual(
			expect.arrayContaining(["bank_account", "ifsc"]),
		);
		// flattened params are folded into items, not left as top-level noise
		expect(Object.keys(tool?.inputSchema.properties ?? {})).not.toContain(
			"entries[].bank_account",
		);
		expect(tool?.inputSchema.required).not.toContain("entries[].bank_account");
	});

	it("types array params from examples when no flattened siblings exist", () => {
		const bulkPan = tools.find((t) => t.name === "eps_pan_bulk_verify");
		const entries = bulkPan?.inputSchema.properties.entries as {
			type: string;
			items: { type: string; properties: Record<string, unknown> };
		};
		expect(entries.type).toBe("array");
		expect(entries.items.type).toBe("object");
		expect(entries.items.properties).toHaveProperty("pan");

		const digilocker = tools.find(
			(t) => t.name === "eps_digilocker_create_url",
		);
		const docs = digilocker?.inputSchema.properties.document_requested as {
			type: string;
			items: { type?: string };
		};
		expect(docs.type).toBe("array");
		expect(docs.items.type).toBe("string");
	});
});
