import { describe, expect, it } from "vitest";
import {
	getApiPreviewsForProduct,
	getVerifiableFieldsForProduct,
} from "@/lib/data/api-spec-previews";
import { getSpecsForProduct } from "@/lib/data/api-specs";

/**
 * `-status` helper APIs (e.g. `pan-bulk-status`) poll bulk/async job status and
 * must be hidden from product-page UI: top tags, sample request/response, and
 * "what can you verify". The `pan` product owns `pan-bulk-status`, so it is the
 * representative fixture.
 */
describe("product-page adapters hide -status helper APIs", () => {
	it("registry still contains pan-bulk-status (guards the fixture)", () => {
		const ids = getSpecsForProduct("pan").map((s) => s.id);
		expect(ids).toContain("pan-bulk-status");
	});

	it("getApiPreviewsForProduct excludes -status specs", () => {
		const names = getApiPreviewsForProduct("pan").map((p) => p.apiName);
		const statusName = getSpecsForProduct("pan").find(
			(s) => s.id === "pan-bulk-status",
		)?.name;
		expect(statusName).toBeTruthy();
		expect(names).not.toContain(statusName);
		// non-status specs still surface
		expect(names.length).toBeGreaterThan(0);
	});

	it("getVerifiableFieldsForProduct omits fields contributed only by -status specs", () => {
		const withStatus = getSpecsForProduct("pan");
		const withoutStatus = withStatus.filter((s) => !s.id.endsWith("-status"));
		// Adapter output must match the non-status spec set, not the full set.
		expect(withoutStatus.length).toBeLessThan(withStatus.length);
		expect(getVerifiableFieldsForProduct("pan")).not.toHaveLength(0);
	});
});
