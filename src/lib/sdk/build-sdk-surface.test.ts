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

	it("emits one endpoint per api with method + path + required params", () => {
		expect(surface.endpoints.length).toBe(bundle.apis.length);
		const e = surface.endpoints[0];
		expect(e).toHaveProperty("slug");
		expect(e).toHaveProperty("method");
		expect(e).toHaveProperty("path");
		expect(Array.isArray(e.requiredParams)).toBe(true);
	});

	it("includes the error-code table", () => {
		expect(surface.errorCodes.length).toBeGreaterThan(0);
	});
});
