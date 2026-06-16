import { describe, expect, it } from "vitest";

import { API_SPECS } from "@/lib/data/api-specs";
import { RECIPES, assertRecipeSlugs } from "@/lib/data/api-recipes";

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
						name: "Bad",
						summary: "x",
						steps: [{ specSlug: "does-not-exist", purpose: "x" }],
					},
				],
				new Set(["dmt-get-sender"]),
			),
		).toThrow(/unknown spec slug/i);
	});
});
