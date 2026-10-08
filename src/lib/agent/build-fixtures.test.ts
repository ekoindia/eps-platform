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

	it("keys error scenarios on status + response_type_id, never response_status_id", () => {
		const dmt = fixtures.find((f) => f.slug === "dmt-get-sender");
		expect(dmt).toBeTruthy();
		// The documented "sender not enrolled" example (status 308 /
		// response_type_id 308) is what the DMT recipe routes to Onboard Sender
		// on, so `?eps_scenario=308` must select it. Its response_status_id is 1
		// like every other error example — keying on that could never tell
		// scenarios apart.
		const notEnrolled = dmt?.errors.find((e) => e.responseTypeId === 308);
		expect(notEnrolled).toBeTruthy();
		expect(notEnrolled?.status).toBe(308);
		expect(notEnrolled?.example.response_status_id).toBe(1);
	});
});
