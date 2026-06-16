import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { buildFixtures } from "@/lib/agent/build-fixtures";

const bundle = buildAgentBundle(getDocumentedSpecs());
const fixtures = buildFixtures(bundle);

describe("buildFixtures", () => {
	it("has one fixture per endpoint with request + success response", () => {
		expect(fixtures.length).toBe(bundle.apis.length);
		for (const f of fixtures) {
			expect(f).toHaveProperty("slug");
			expect(f).toHaveProperty("request");
			expect(f).toHaveProperty("successResponse");
		}
	});

	it("carries error scenarios keyed by response_status_id where present", () => {
		const dmt = fixtures.find((f) => f.slug === "dmt-get-sender");
		expect(dmt).toBeTruthy();
		// the 463 branch is documented for the DMT flow
		expect(Array.isArray(dmt?.errors)).toBe(true);
	});
});
