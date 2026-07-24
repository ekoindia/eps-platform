import { describe, expect, it } from "vitest";

import {
	RECIPES,
	type Recipe,
	STEP_FREQUENCY_LABEL,
} from "@/lib/data/api-recipes";
import { resolveRecipe } from "@/lib/data/recipe-graph";
import {
	escapeMermaidLabel,
	recipeMermaidFence,
	renderRecipeMarkdown,
	renderRecipesIndexMarkdown,
} from "@/lib/markdown/render-recipe";

const dmt = RECIPES.find((r) => r.slug === "dmt-fino-send-money") as Recipe;
const aeps = RECIPES.find(
	(r) => r.slug === "aeps-fingpay-cash-withdrawal",
) as Recipe;

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
			const suffix = step.frequency
				? ` · ${STEP_FREQUENCY_LABEL[step.frequency]}`
				: "";
			expect(fence).toContain(
				`${step.nodeId}["${step.method} ${step.title}${suffix}"]`,
			);
		}
	});

	it("suffixes the frequency onto tagged step nodes, and only those", () => {
		const fence = recipeMermaidFence(aeps);
		// The activation + 3 eKYC steps are one-time; step 5 (daily-auth) is daily;
		// step 6 (withdrawal) carries no tag and must stay unsuffixed.
		expect(fence).toContain("· One-time");
		expect(fence).toContain("· Daily");
		expect(fence).toMatch(/s6\["POST AePS Cash Withdrawal"\]/);
	});

	it("collapses a branch that targets the next step into one labelled edge", () => {
		// DMT step 1 branches to onboarding on response_type_id 308 — which is also
		// step 2. That must be a single labelled edge, not a labelled edge plus a
		// bare one.
		const fence = recipeMermaidFence(dmt);
		expect(fence).toContain('s1 -->|"response_type_id 308: Sender not found');
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

	it("labels each branch edge with the field it actually fires on", () => {
		// Both condition keys in one recipe: routing on response_type_id, and a
		// financial success on response_status_id. The label must name the right
		// field for each — that is the whole point of `branchCondition`.
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
						{ onResponseTypeId: 308, goto: "dmt-onboard-sender" },
						{ onResponseStatusId: 0, goto: "done" },
					],
				},
				{ specSlug: "dmt-onboard-sender", purpose: "b" },
			],
		};
		const fence = recipeMermaidFence(multi);
		expect(fence).toContain('s1 -->|"response_type_id 308"| s2');
		expect(fence).toContain('s1 -->|"response_status_id 0"| done');
		// The 463 branch already covers s1 -> s2; no duplicate bare edge.
		expect(fence).not.toMatch(/^\s*s1 --> s2$/m);
	});
});

describe("renderRecipeMarkdown", () => {
	it("carries front-matter, the canonical notice, and the flow", () => {
		const md = renderRecipeMarkdown(dmt);
		expect(md).toContain('title: "DMT (Fino) — Send Money — API Recipe"');
		expect(md).toContain("https://eps.eko.in/recipe/dmt-fino-send-money");
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

	it("marks frequency-tagged steps in the step list", () => {
		const md = renderRecipeMarkdown(aeps);
		expect(md).toContain(`_(${STEP_FREQUENCY_LABEL.once})_`);
		expect(md).toContain(`_(${STEP_FREQUENCY_LABEL.daily})_`);
		// The final withdrawal step carries no tag — no marker leaks onto it.
		expect(md).not.toMatch(/AePS Cash Withdrawal\*\* — [^\n]*_\(/);
	});

	it("spells out each branch condition in the step list", () => {
		const md = renderRecipeMarkdown(dmt);
		expect(md).toContain("`response_type_id` is `308`");
		expect(md).toContain("`response_status_id` is `0`");
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
