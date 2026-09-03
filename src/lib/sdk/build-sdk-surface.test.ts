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

	it("bakes the format registry and only the constraints a param sets", () => {
		expect(surface.formats["client-ref"]).toMatch(/^\^.*\$$/);
		const sender = surface.endpoints.find((e) => e.slug === "dmt-get-sender")!;
		const ref = sender.params.find((p) => p.name === "client_ref_id")!;
		expect(ref).toEqual({
			name: "client_ref_id",
			type: "string",
			required: false,
			format: "client-ref",
			maxLength: 20,
		});
		// Every format a param names resolves in the baked map.
		for (const e of surface.endpoints)
			for (const p of e.params)
				if (p.format) expect(surface.formats).toHaveProperty(p.format);
	});

	it("flags money-moving endpoints as financial and omits the key otherwise", () => {
		const bySlug = (slug: string) =>
			surface.endpoints.find((e) => e.slug === slug)!;
		expect(bySlug("bbps-pay-bill").financial).toBe(true);
		expect(bySlug("dmt-get-sender")).not.toHaveProperty("financial");
		expect(surface.endpoints.filter((e) => e.financial).length).toBe(
			bundle.apis.filter((a) => a.financial).length,
		);
	});
});
