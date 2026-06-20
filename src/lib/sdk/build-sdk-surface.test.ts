import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { buildSdkSurface } from "@/lib/sdk/build-sdk-surface";

const bundle = buildAgentBundle(getDocumentedSpecs());
const surface = buildSdkSurface(bundle);

describe("buildSdkSurface", () => {
	it("lists both environments with base URLs", () => {
		const ids = surface.environments.map((e) => e.id);
		expect(ids).toContain("sandbox");
		expect(ids).toContain("production");
	});

	it("emits one endpoint per api with method + path + typed params", () => {
		expect(surface.endpoints.length).toBe(bundle.apis.length);
		const e = surface.endpoints[0];
		expect(e).toHaveProperty("slug");
		expect(e).toHaveProperty("method");
		expect(e).toHaveProperty("path");
		expect(Array.isArray(e.params)).toBe(true);
		for (const p of e.params) {
			expect(typeof p.name).toBe("string");
			expect(typeof p.type).toBe("string");
			expect(typeof p.required).toBe("boolean");
		}
		// requiredParams stays in sync with params (back-compat).
		expect(e.requiredParams).toEqual(
			e.params.filter((p) => p.required).map((p) => p.name),
		);
	});

	it("includes the error-code table", () => {
		expect(surface.errorCodes.length).toBeGreaterThan(0);
	});
});
