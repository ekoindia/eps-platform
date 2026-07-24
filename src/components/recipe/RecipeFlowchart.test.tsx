import { RecipeFlowchart } from "@/components/recipe/RecipeFlowchart";
import { RECIPES, type Recipe } from "@/lib/data/api-recipes";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const dmt = RECIPES.find((r) => r.slug === "dmt-fino-send-money") as Recipe;
const aeps = RECIPES.find(
	(r) => r.slug === "aeps-fingpay-cash-withdrawal",
) as Recipe;

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

/** viewBox width (node width + any arc gutter) — the layout is dynamic. */
const viewWidth = (svg: SVGSVGElement): number =>
	Number(svg.getAttribute("viewBox")?.split(" ")[2]);

/** The step node box width — the dynamic `NODE_W` the component computed. */
const nodeWidth = (svg: SVGSVGElement): number =>
	Number(svg.querySelector('rect[class*="fill-card"]')?.getAttribute("width"));

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
		// No dead gutter: the node box fills the whole (dynamic) viewBox width.
		expect(viewWidth(svg)).toBe(nodeWidth(svg));
	});

	it("arcs a skip edge through the gutter and widens the viewBox for it", () => {
		const svg = svgOf(skipping);
		const arcs = svg.querySelectorAll("path[stroke-dasharray]");
		expect(arcs).toHaveLength(1);
		const nodeW = nodeWidth(svg);
		// The arc gutter (76) is added on top of the node width.
		expect(viewWidth(svg)).toBe(nodeW + 76);
		// Cubic bezier bowing out from the node's right edge into the gutter.
		expect(arcs[0].getAttribute("d")).toMatch(new RegExp(`^M ${nodeW} `));
	});

	it("draws a frequency pill on each tagged step, tinted and labelled by kind", () => {
		const svg = svgOf(aeps);
		// 4 one-time (activation + 3 eKYC) indigo, 1 daily teal; withdrawal untagged.
		// Indigo/teal are off the method palette (emerald/sky/violet/rose), so these
		// rects/texts are frequency pills alone.
		expect(svg.querySelectorAll('rect[class*="fill-indigo"]')).toHaveLength(4);
		expect(svg.querySelectorAll('rect[class*="fill-teal"]')).toHaveLength(1);
		// Assert the visible pill labels, not just the tint.
		const once = [...svg.querySelectorAll('text[class*="fill-indigo"]')].map(
			(t) => t.textContent,
		);
		const daily = [...svg.querySelectorAll('text[class*="fill-teal"]')].map(
			(t) => t.textContent,
		);
		expect(once).toEqual(["One-time", "One-time", "One-time", "One-time"]);
		expect(daily).toEqual(["Daily"]);
		// The frequency also rides the node tooltip.
		const titles = [...svg.querySelectorAll("title")].map((t) => t.textContent);
		expect(titles.some((t) => t?.includes("(One-time)"))).toBe(true);
		expect(titles.some((t) => t?.includes("(Daily)"))).toBe(true);
	});

	it("draws no frequency pill for a recipe with no tagged steps", () => {
		const svg = svgOf(dmt);
		expect(svg.querySelectorAll('rect[class*="fill-indigo"]')).toHaveLength(0);
		expect(svg.querySelectorAll('rect[class*="fill-teal"]')).toHaveLength(0);
	});

	it("never truncates a node title — the node grows to fit", () => {
		const svg = svgOf(aeps);
		expect(svg.textContent).not.toContain("…");
		// The longest title (and one that also carries a pill) renders in full.
		expect(svg.textContent).toContain("Activate AePS Fingpay for Agent");
	});

	it("keeps every node label inside the node box", () => {
		const svg = svgOf(aeps);
		const viewW = viewWidth(svg);
		for (const text of svg.querySelectorAll("text")) {
			expect(Number(text.getAttribute("x"))).toBeLessThanOrEqual(viewW);
		}
	});
});
