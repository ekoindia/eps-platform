import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeFlowchart } from "@/components/recipe/RecipeFlowchart";
import { RECIPES, type Recipe } from "@/lib/data/api-recipes";

const dmt = RECIPES.find((r) => r.slug === "dmt-send-money") as Recipe;

/** A recipe whose step 1 skips PAST step 2 — the only shape that arcs. */
const skipping: Recipe = {
	id: "skip",
	slug: "skip",
	name: "Skip",
	summary: "s",
	steps: [
		{
			specSlug: "dmt-get-sender",
			purpose: "a",
			branches: [{ onResponseStatusId: 12, goto: "dmt-add-recipient" }],
		},
		{ specSlug: "dmt-onboard-sender", purpose: "b" },
		{ specSlug: "dmt-add-recipient", purpose: "c" },
	],
};

const svgOf = (recipe: Recipe): SVGSVGElement => {
	const { container } = render(<RecipeFlowchart recipe={recipe} />);
	const svg = container.querySelector("svg");
	if (!svg) throw new Error("no svg rendered");
	return svg as SVGSVGElement;
};

describe("RecipeFlowchart", () => {
	it("draws one node per step plus the done terminal", () => {
		const svg = svgOf(dmt);
		// 5 step boxes + 5 method pills + 1 done pill
		expect(svg.querySelectorAll("rect")).toHaveLength(11);
		expect(svg.textContent).toContain("done");
	});

	it("labels branch edges with the bare condition value, not the full note", () => {
		const svg = svgOf(dmt);
		const texts = [...svg.querySelectorAll("text")].map((t) =>
			t.textContent?.trim(),
		);
		expect(texts).toContain("308");
		expect(texts).toContain("0");
		// The verbose note belongs to the stepper, not the glance view — it is
		// only reachable here as the edge's hover tooltip.
		expect(svg.textContent).not.toContain("onboard them before continuing");
		// The bare label can't say which field it came from; the tooltip must, and
		// must name the field each branch actually fires on.
		const titles = [...svg.querySelectorAll("title")].map((t) => t.textContent);
		expect(titles).toContain("response_type_id 308");
		expect(titles).toContain("response_status_id 0");
	});

	it("draws only straight edges, and reserves no arc gutter, for a linear flow", () => {
		const svg = svgOf(dmt);
		expect(svg.querySelectorAll("path[stroke-dasharray]")).toHaveLength(0);
		// viewBox width stays at the node width — no dead gutter.
		expect(svg.getAttribute("viewBox")).toMatch(/^0 0 240 /);
	});

	it("arcs a skip edge through the gutter and widens the viewBox for it", () => {
		const svg = svgOf(skipping);
		const arcs = svg.querySelectorAll("path[stroke-dasharray]");
		expect(arcs).toHaveLength(1);
		// Cubic bezier bowing out to the right of the nodes.
		expect(arcs[0].getAttribute("d")).toMatch(/^M 240 .* C 30[0-9] /);
		expect(svg.getAttribute("viewBox")).toMatch(/^0 0 316 /);
	});

	it("keeps every node label inside the node box", () => {
		const svg = svgOf(dmt);
		for (const text of svg.querySelectorAll("text")) {
			const x = Number(text.getAttribute("x"));
			expect(x).toBeLessThanOrEqual(316);
		}
	});
});
