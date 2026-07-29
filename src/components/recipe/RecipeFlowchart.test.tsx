import { RecipeFlowchart } from "@/components/recipe/RecipeFlowchart";
import { RECIPES, type Recipe } from "@/lib/data/api-recipes";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
			branches: [{ onStatus: 12, goto: "dmt-add-recipient" }],
		},
		{ specSlug: "dmt-onboard-sender", purpose: "b" },
		{ specSlug: "dmt-add-recipient", purpose: "c" },
	],
};

/** The whole <figure> — the diagram plus its legend. Routed, because each step
 * node is a link to its endpoint's docs page. */
const figureOf = (recipe: Recipe): HTMLElement => {
	const { container } = render(
		<MemoryRouter>
			<RecipeFlowchart recipe={recipe} />
		</MemoryRouter>,
	);
	const figure = container.querySelector("figure");
	if (!figure) throw new Error("no figure rendered");
	return figure as HTMLElement;
};

const svgOf = (recipe: Recipe): SVGSVGElement => {
	const svg = figureOf(recipe).querySelector("svg");
	if (!svg) throw new Error("no svg rendered");
	return svg as SVGSVGElement;
};

/** viewBox width (node width + any arc gutter) — the layout is dynamic. */
const viewWidth = (svg: SVGSVGElement): number =>
	Number(svg.getAttribute("viewBox")?.split(" ")[2]);

/** The step node box width — the dynamic `NODE_W` the component computed. */
const nodeWidth = (svg: SVGSVGElement): number =>
	Number(svg.querySelector('rect[class*="fill-card"]')?.getAttribute("width"));

const textsOf = (el: Element): string[] =>
	[...el.querySelectorAll("text")].map((t) => t.textContent?.trim() ?? "");

/**
 * Each arc's gutter lane (its bezier control x) and the vertical span it covers,
 * parsed back out of the path — `M x yFrom C cx yFrom, cx yTo, x yTo`.
 */
const arcLanes = (
	svg: SVGSVGElement,
): Array<{ lane: number; top: number; bottom: number }> =>
	[...svg.querySelectorAll("path[stroke-dasharray]")].map((path) => {
		const n = (path.getAttribute("d") ?? "")
			.split(/[^0-9.]+/)
			.filter(Boolean)
			.map(Number);
		// n = [x, yFrom, cx, yFrom, cx, yTo, x, yTo]
		const [, yFrom, lane, , , yTo] = n;
		return {
			lane,
			top: Math.min(yFrom, yTo),
			bottom: Math.max(yFrom, yTo),
		};
	});

describe("RecipeFlowchart", () => {
	it("draws one node per step plus the done terminal", () => {
		const svg = svgOf(dmt);
		// Counted off the recipe rather than hardcoded, so adding a step does not
		// fail this case. Only node boxes carry `fill-card` — method, frequency and
		// edge-label pills are all tinted differently.
		expect(svg.querySelectorAll('rect[class*="fill-card"]')).toHaveLength(
			dmt.steps.length,
		);
		expect(svg.textContent).toContain("done");
	});

	it("names the field each branch fires on, never a bare number", () => {
		const svg = svgOf(dmt);
		const texts = textsOf(svg);
		// `308` is a response_type_id and `0` is a status; unprefixed they read as
		// the same kind of thing, which is the bug this fixes.
		expect(texts).toContain("on type 308");
		expect(texts).not.toContain("308");
		expect(texts).not.toContain("0");
		// A status of 0 is the success case, so it says so in words.
		expect(texts).toContain("on success");
		// The verbose note belongs to the stepper, not the glance view — it is
		// only reachable here as the edge's hover tooltip.
		expect(svg.textContent).not.toContain("onboard them before continuing");
		const titles = [...svg.querySelectorAll("title")].map((t) => t.textContent);
		expect(titles).toContain("response_type_id 308");
		expect(titles).toContain("status 0");
	});

	it("says whether an unlabelled edge is the only way on, or the leftover case", () => {
		// Onboard Sender branches away on 309, so its fall-through is what is left.
		expect(textsOf(svgOf(dmt))).toContain("otherwise, on success");
		// AePS branches nowhere, so every edge is unconditional.
		const linear = textsOf(svgOf(aeps));
		expect(linear).toContain("on success");
		expect(linear.some((t) => t.startsWith("otherwise"))).toBe(false);
	});

	it("glosses only the notations the recipe actually uses", () => {
		const dmtLegend = figureOf(dmt).querySelector("figcaption");
		expect(dmtLegend?.textContent).toContain("on type N");
		expect(dmtLegend?.textContent).toContain("response_type_id");
		expect(dmtLegend?.textContent).toContain("on success");
		// A linear recipe draws no `on type` edge, so it gets no `on type` gloss.
		const linearLegend = figureOf(aeps).querySelector("figcaption");
		expect(linearLegend?.textContent).toContain("on success");
		expect(linearLegend?.textContent).not.toContain("on type");
	});

	it("links every step node to its endpoint's docs page", () => {
		const hrefs = [...svgOf(dmt).querySelectorAll("a")].map((a) =>
			a.getAttribute("href"),
		);
		expect(hrefs).toHaveLength(dmt.steps.length);
		expect(hrefs.every((href) => href?.startsWith("/docs/"))).toBe(true);
	});

	it("wires every edge to the step it leaves, so hovering that step lights them", () => {
		const svg = svgOf(dmt);
		// Get Sender Profile routes four ways; all four edges must answer to it.
		expect(svg.querySelectorAll(".rf-n-s1")).toHaveLength(1);
		expect(svg.querySelectorAll(".recipe-edge.rf-e-s1")).toHaveLength(4);
		// CSS cannot match "edges whose source is the hovered node", so the rules
		// are emitted per node id — and scoped to this chart, never `.recipe-flow`
		// at large, or two diagrams on one page would highlight each other.
		const css = svg.querySelector("style")?.textContent ?? "";
		expect(css).toContain("#rf-dmt-fino-send-money:has(.rf-n-s1:hover)");
		expect(css).toContain(".recipe-edge:not(.rf-e-s1)");
		expect(css).not.toContain(".recipe-flow:has");
	});

	it("draws only straight edges, and reserves no arc gutter, for a linear flow", () => {
		// AePS is the fully sequential recipe — every step falls through to the
		// next, so nothing should reach for the gutter.
		const svg = svgOf(aeps);
		expect(svg.querySelectorAll("path[stroke-dasharray]")).toHaveLength(0);
		// No dead gutter: the node box fills the whole (dynamic) viewBox width.
		expect(viewWidth(svg)).toBe(nodeWidth(svg));
	});

	it("gives every overlapping arc its own gutter lane", () => {
		// DMT's four skip branches (get-sender → eKYC/validate/recipients, and
		// onboard → recipients) plus recipients → send-otp all bow out; the
		// 308 and 22 branches target the next step and stay straight.
		const svg = svgOf(dmt);
		const arcs = arcLanes(svg);
		expect(arcs).toHaveLength(5);
		// The whole point of lane packing: two arcs may share a lane only if one
		// finishes above the other starts. Anything else draws them on top of
		// each other, which is what made the old single-gutter version unreadable.
		for (const [i, a] of arcs.entries()) {
			for (const b of arcs.slice(i + 1)) {
				if (a.lane !== b.lane) continue;
				expect(a.bottom <= b.top || b.bottom <= a.top).toBe(true);
			}
		}
		expect(viewWidth(svg)).toBeGreaterThan(nodeWidth(svg));
	});

	it("arcs a skip edge through the gutter and widens the viewBox for it", () => {
		const svg = svgOf(skipping);
		const arcs = svg.querySelectorAll("path[stroke-dasharray]");
		expect(arcs).toHaveLength(1);
		const nodeW = nodeWidth(svg);
		// Cubic bezier bowing out from the node's right edge into the gutter.
		expect(arcs[0].getAttribute("d")).toMatch(new RegExp(`^M ${nodeW} `));
		// The gutter is added on top of the node width, and holds the arc's label.
		expect(viewWidth(svg)).toBeGreaterThan(nodeW);
		expect(textsOf(svg)).toContain("on status 12");
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

	it("keeps every label, node and edge alike, inside the viewBox", () => {
		for (const recipe of [dmt, aeps, skipping]) {
			const svg = svgOf(recipe);
			const viewW = viewWidth(svg);
			for (const text of svg.querySelectorAll("text")) {
				expect(Number(text.getAttribute("x"))).toBeLessThanOrEqual(viewW);
			}
			// Edge-label pills run rightwards from their lane — the gutter has to be
			// wide enough for the longest of them.
			for (const rect of svg.querySelectorAll("rect")) {
				const right =
					Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"));
				expect(right).toBeLessThanOrEqual(viewW);
			}
		}
	});
});
