import { describe, expect, it } from "vitest";

import {
	assertRecipeSlugs,
	branchCondition,
	RECIPES,
	recipesForSpec,
	type Recipe,
	type RecipeBranch,
} from "@/lib/data/api-recipes";
import { API_SPECS } from "@/lib/data/api-specs";

describe("api-recipes", () => {
	it("ships at least the two exemplar recipes", () => {
		const ids = RECIPES.map((r) => r.id);
		expect(ids).toContain("dmt-fino-send-money");
		expect(ids).toContain("aeps-fingpay-cash-withdrawal");
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
		).toThrow(/neither onResponseTypeId nor onStatus/);
	});
});

describe("assertRecipeSlugs — conditional steps", () => {
	const known = new Set([
		"dmt-get-sender",
		"dmt-onboard-sender",
		"dmt-add-recipient",
		"dmt-send-otp",
	]);
	const check = (steps: Recipe["steps"]) => () =>
		assertRecipeSlugs(
			[{ id: "c", slug: "c", name: "C", summary: "x", steps }],
			known,
		);
	const plain = (specSlug: string) => ({ specSlug, purpose: "x" });
	const conditional = (specSlug: string) => ({
		specSlug,
		purpose: "x",
		appliesWhen: "amount > ₹5,000",
	});

	it("accepts a conditional step between two plain steps", () => {
		expect(
			check([
				plain("dmt-get-sender"),
				conditional("dmt-onboard-sender"),
				plain("dmt-add-recipient"),
			]),
		).not.toThrow();
	});

	it("rejects a conditional first or last step — nothing to skip from or to", () => {
		expect(
			check([conditional("dmt-get-sender"), plain("dmt-onboard-sender")]),
		).toThrow(/first or last/);
		expect(
			check([plain("dmt-get-sender"), conditional("dmt-onboard-sender")]),
		).toThrow(/first or last/);
	});

	it("rejects two adjacent conditional steps", () => {
		expect(
			check([
				plain("dmt-get-sender"),
				conditional("dmt-onboard-sender"),
				conditional("dmt-add-recipient"),
				plain("dmt-send-otp"),
			]),
		).toThrow(/another conditional step/);
	});

	it("rejects a conditional step after a branching step", () => {
		expect(
			check([
				{
					...plain("dmt-get-sender"),
					branches: [{ onStatus: 0, goto: "done" }],
				},
				conditional("dmt-onboard-sender"),
				plain("dmt-add-recipient"),
			]),
		).toThrow(/follow a step that branches/);
	});

	it("rejects a conditional step that a branch jumps to", () => {
		expect(
			check([
				plain("dmt-get-sender"),
				conditional("dmt-onboard-sender"),
				{
					...plain("dmt-add-recipient"),
					branches: [{ onResponseTypeId: 1, goto: "dmt-onboard-sender" }],
				},
			]),
		).toThrow(/branch goto target/);
	});
});

describe("recipesForSpec", () => {
	it("finds a recipe that uses the endpoint with a matching product", () => {
		const found = recipesForSpec({ slug: "dmt-get-sender", productId: "dmt" });
		expect(found.map((r) => r.id)).toEqual(["dmt-fino-send-money"]);
	});

	it("returns [] for an endpoint no recipe uses", () => {
		expect(
			recipesForSpec({ slug: "dmt-get-sender", productId: "pan" }),
		).toEqual([]);
	});

	it("returns [] when the product does not match the recipe's product", () => {
		// The slug IS a recipe step, but under the wrong product — the AND guard
		// must reject it, not link the DMT recipe from an unrelated product.
		expect(
			recipesForSpec({ slug: "dmt-get-sender", productId: "aeps" }),
		).toEqual([]);
	});
});

describe("branchCondition", () => {
	it("names response_type_id for a routing branch", () => {
		expect(
			branchCondition({ onResponseTypeId: 308, goto: "dmt-onboard-sender" }),
		).toEqual({ field: "response_type_id", value: 308 });
	});

	it("names status for a financial branch", () => {
		// 0 is falsy — a truthiness check here would misreport the field.
		expect(branchCondition({ onStatus: 0, goto: "done" })).toEqual({
			field: "status",
			value: 0,
		});
	});
});
