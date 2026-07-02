import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import type { AgentBundle } from "./bundle-types.js";
import {
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
});
