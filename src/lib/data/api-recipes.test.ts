import { describe, expect, it } from "vitest";

import { API_SPECS } from "@/lib/data/api-specs";
import {
	assertRecipeSlugs,
	branchCondition,
	RECIPES,
	type RecipeBranch,
} from "@/lib/data/api-recipes";

describe("api-recipes", () => {
	it("ships at least the two exemplar recipes", () => {
		const ids = RECIPES.map((r) => r.id);
		expect(ids).toContain("dmt-send-money");
		expect(ids).toContain("aeps-cash-withdrawal");
	});

	it("every step references a real spec slug", () => {
		const known = new Set(API_SPECS.map((s) => s.slug));
		for (const recipe of RECIPES) {
			for (const step of recipe.steps) {
				expect(known.has(step.specSlug)).toBe(true);
				for (const branch of step.branches ?? []) {
					if (branch.goto !== "done") expect(known.has(branch.goto)).toBe(true);
				}
			}
		}
	});

	it("assertRecipeSlugs throws on an unknown slug", () => {
		expect(() =>
			assertRecipeSlugs(
				[
					{
						id: "bad",
						slug: "bad",
						name: "Bad",
						summary: "x",
						steps: [{ specSlug: "does-not-exist", purpose: "x" }],
					},
				],
				new Set(["dmt-get-sender"]),
			),
		).toThrow(/unknown spec slug/i);
	});

	it("assertRecipeSlugs throws on a branch with no condition", () => {
		// The union type rejects setting BOTH keys at compile time; this guards the
		// other half — a branch that names neither, which only untyped data can
		// produce, and which would otherwise render as "undefined".
		const branch = { goto: "dmt-get-sender" } as unknown as RecipeBranch;
		expect(() =>
			assertRecipeSlugs(
				[
					{
						id: "bad",
						slug: "bad",
						name: "Bad",
						summary: "x",
						steps: [
							{ specSlug: "dmt-get-sender", purpose: "x", branches: [branch] },
						],
					},
				],
				new Set(["dmt-get-sender"]),
			),
		).toThrow(/neither onResponseTypeId nor onResponseStatusId/);
	});
});

describe("branchCondition", () => {
	it("names response_type_id for a routing branch", () => {
		expect(
			branchCondition({ onResponseTypeId: 308, goto: "dmt-onboard-sender" }),
		).toEqual({ field: "response_type_id", value: 308 });
	});

	it("names response_status_id for a financial branch", () => {
		// 0 is falsy — a truthiness check here would misreport the field.
		expect(branchCondition({ onResponseStatusId: 0, goto: "done" })).toEqual({
			field: "response_status_id",
			value: 0,
		});
	});
});
