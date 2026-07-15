import { describe, expect, it } from "vitest";

import { RECIPES, type Recipe } from "@/lib/data/api-recipes";
import { resolveRecipe } from "@/lib/data/recipe-graph";
import {
	escapeMermaidLabel,
	recipeMermaidFence,
	renderRecipeMarkdown,
	renderRecipesIndexMarkdown,
} from "@/lib/markdown/render-recipe";

const dmt = RECIPES.find((r) => r.slug === "dmt-send-money") as Recipe;
const aeps = RECIPES.find((r) => r.slug === "aeps-cash-withdrawal") as Recipe;

describe("escapeMermaidLabel", () => {
	it("neutralises quotes, which would otherwise close the label early", () => {
		expect(escapeMermaidLabel('Send "OTP"')).toBe("Send #quot;OTP#quot;");
	});

	it("converts newlines, which would otherwise end the statement", () => {
		expect(escapeMermaidLabel("one\ntwo")).toBe("one<br/>two");
	});

	it("leaves brackets and pipes intact — quoting already contains them", () => {
		expect(escapeMermaidLabel("a [b] | c")).toBe("a [b] | c");
	});
});

describe("recipeMermaidFence", () => {
	it("opens a mermaid fence with a top-down flowchart", () => {
		const fence = recipeMermaidFence(dmt);
		expect(fence.startsWith("```mermaid\nflowchart TD\n")).toBe(true);
		expect(fence.endsWith("```")).toBe(true);
	});

	it("emits one quoted node per step, labelled METHOD Name", () => {
		const fence = recipeMermaidFence(aeps);
		for (const step of resolveRecipe(aeps).steps) {
			expect(fence).toContain(`${step.nodeId}["${step.method} ${step.title}"]`);
		}
	});

	it("collapses a branch that targets the next step into one labelled edge", () => {
		// DMT step 1 branches to onboarding on 463 — which is also step 2. That
		// must be a single labelled edge, not a labelled edge plus a bare one.
		const fence = recipeMermaidFence(dmt);
		expect(fence).toContain('s1 -->|"463: Sender not found');
		expect(fence).not.toMatch(/^\s*s1 --> s2$/m);
		expect(fence.match(/s1 -->/g)).toHaveLength(1);
	});

	it("draws unlabelled fall-through edges between plain sequential steps", () => {
		expect(recipeMermaidFence(dmt)).toMatch(/^\s*s2 --> s3$/m);
	});

	it("terminates a done branch at a rounded terminal node", () => {
		const fence = recipeMermaidFence(dmt);
		expect(fence).toContain('done(["done"])');
		expect(fence).toMatch(/s5 -->\|"[^"]*0[^"]*"\| done/);
	});

	it("omits the done node entirely when no branch reaches it", () => {
		const noDone: Recipe = {
			id: "x",
			slug: "x",
			name: "X",
			summary: "x",
			steps: [
				{ specSlug: "dmt-get-sender", purpose: "a" },
				{ specSlug: "dmt-add-recipient", purpose: "b" },
			],
		};
		const fence = recipeMermaidFence(noDone);
		expect(fence).not.toContain("done");
		expect(fence).toMatch(/^\s*s1 --> s2$/m);
	});

	it("labels every branch edge with its response_status_id", () => {
		const multi: Recipe = {
			id: "m",
			slug: "m",
			name: "M",
			summary: "m",
			steps: [
				{
					specSlug: "dmt-get-sender",
					purpose: "a",
					branches: [
						{ onResponseStatusId: 463, goto: "dmt-onboard-sender" },
						{ onResponseStatusId: 0, goto: "done" },
					],
				},
				{ specSlug: "dmt-onboard-sender", purpose: "b" },
			],
		};
		const fence = recipeMermaidFence(multi);
		expect(fence).toContain('s1 -->|"response_status_id 463"| s2');
		expect(fence).toContain('s1 -->|"response_status_id 0"| done');
		// The 463 branch already covers s1 -> s2; no duplicate bare edge.
		expect(fence).not.toMatch(/^\s*s1 --> s2$/m);
	});
});

describe("renderRecipeMarkdown", () => {
	it("carries front-matter, the canonical notice, and the flow", () => {
		const md = renderRecipeMarkdown(dmt);
		expect(md).toContain('title: "DMT — Send Money — API Recipe"');
		expect(md).toContain("https://eps.eko.in/recipe/dmt-send-money");
		expect(md).toContain("```mermaid");
		expect(md).toContain("## Steps");
	});

	it("links each step to its endpoint markdown twin", () => {
		const md = renderRecipeMarkdown(dmt);
		expect(md).toContain("https://eps.eko.in/docs/dmt-get-sender.md");
		expect(md).toContain("https://eps.eko.in/docs/dmt-initiate-transfer.md");
	});

	it("cross-links the product when it is active", () => {
		expect(renderRecipeMarkdown(dmt)).toContain(
			"https://eps.eko.in/products/dmt-api.md",
		);
	});

	it("drops the product cross-link when the product is disabled or unset", () => {
		const orphan: Recipe = { ...dmt, productId: undefined };
		expect(renderRecipeMarkdown(orphan)).not.toContain("Product & pricing");
	});

	it("spells out each branch condition in the step list", () => {
		const md = renderRecipeMarkdown(dmt);
		expect(md).toContain("`response_status_id` is `463`");
		expect(md).toContain("the flow is complete");
	});
});

describe("renderRecipesIndexMarkdown", () => {
	it("lists every recipe, linked to its twin", () => {
		const md = renderRecipesIndexMarkdown();
		for (const recipe of RECIPES) {
			expect(md).toContain(`https://eps.eko.in/recipe/${recipe.slug}.md`);
			expect(md).toContain(recipe.name);
		}
	});

	it("states each recipe's step count", () => {
		expect(renderRecipesIndexMarkdown()).toContain("5 steps");
	});
});
