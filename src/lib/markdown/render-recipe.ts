/**
 * Build-time markdown twins for the recipe pages (`/recipe.md`,
 * `/recipe/<slug>.md`).
 *
 * The flow itself comes from `resolveRecipe` — the same resolver the HTML
 * stepper uses — so the two surfaces cannot drift. This module only turns that
 * structure into markdown: a mermaid fence (which agents and GitHub render
 * natively, so it costs no dependency) followed by the numbered steps.
 *
 * Dependency-free: runs in the Vite build SSR context and unit tests.
 */
import { SITE_URL } from "@/lib/config/site";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import {
	branchCondition,
	RECIPES,
	type Recipe,
	recipeHref,
} from "@/lib/data/api-recipes";
import { docsHref } from "@/lib/data/docs-registry";
import {
	DONE_NODE,
	type ResolvedBranch,
	type ResolvedRecipe,
	resolveRecipe,
} from "@/lib/data/recipe-graph";
import {
	bulletList,
	canonicalNotice,
	frontMatter,
	h1,
	h2,
	joinBlocks,
	link,
} from "./shared";

/**
 * Escape a string for use inside a mermaid `["…"]` label or `|"…"|` edge label.
 *
 * Mermaid labels are quoted here rather than bare, so the only character that
 * can still terminate the label early is the double quote — replaced with the
 * `#quot;` entity mermaid understands. Newlines become `<br/>`, since a raw
 * newline ends the statement.
 */
export const escapeMermaidLabel = (text: string): string =>
	text.replace(/"/g, "#quot;").replace(/\r?\n/g, "<br/>").trim();

/** `s1["GET Get Sender Profile"]`, or the rounded terminal for `done`. */
const mermaidNode = (recipe: ResolvedRecipe): string[] => {
	const nodes = recipe.steps.map((step) => {
		const label = escapeMermaidLabel(
			step.method ? `${step.method} ${step.title}` : step.title,
		);
		return `  ${step.nodeId}["${label}"]`;
	});
	if (recipe.hasDone) nodes.push(`  ${DONE_NODE}(["done"])`);
	return nodes;
};

/** The twin has room for the full condition — the trigger plus the branch note. */
const edgeLabel = (branch: ResolvedBranch): string => {
	const { field, value } = branchCondition(branch);
	return branch.note
		? `${field} ${value}: ${branch.note}`
		: `${field} ${value}`;
};

const mermaidEdges = (recipe: ResolvedRecipe): string[] =>
	recipe.edges.map((edge) =>
		edge.branch
			? `  ${edge.from} -->|"${escapeMermaidLabel(edgeLabel(edge.branch))}"| ${edge.to}`
			: `  ${edge.from} --> ${edge.to}`,
	);

/** The recipe's flow as a fenced mermaid `flowchart TD`. */
export const recipeMermaidFence = (recipe: Recipe): string => {
	const resolved = resolveRecipe(recipe);
	return [
		"```mermaid",
		"flowchart TD",
		...mermaidNode(resolved),
		...mermaidEdges(resolved),
		"```",
	].join("\n");
};

/** Numbered steps, each linking to its endpoint's markdown twin. */
const stepList = (resolved: ResolvedRecipe): string =>
	resolved.steps
		.map((step) => {
			const name = step.docHref
				? link(step.title, `${SITE_URL}${step.docHref}.md`, "md")
				: step.title;
			const method = step.method ? `\`${step.method}\` ` : "";
			const lines = [`${step.number}. ${method}**${name}** — ${step.purpose}`];
			for (const branch of step.branches) {
				const target =
					branch.goto === DONE_NODE
						? "the flow is complete"
						: `go to ${branch.targetStepNumber ? `step ${branch.targetStepNumber}` : "**" + branch.targetTitle + "**"} (${branch.targetTitle})`;
				const { field, value } = branchCondition(branch);
				lines.push(
					`   - If \`${field}\` is \`${value}\` → ${target}.${branch.note ? ` ${branch.note}` : ""}`,
				);
			}
			return lines.join("\n");
		})
		.join("\n");

/** Render a single recipe's `/recipe/<slug>.md` twin. */
export function renderRecipeMarkdown(recipe: Recipe): string {
	const canonical = `${SITE_URL}${recipeHref(recipe.slug)}`;
	const resolved = resolveRecipe(recipe);
	const product = recipe.productId
		? ACTIVE_PRODUCTS_MAP[recipe.productId]
		: undefined;

	return joinBlocks([
		frontMatter({
			title: `${recipe.name} — API Recipe`,
			description: recipe.summary,
			canonical,
		}),
		canonicalNotice(canonical),
		h1(`${recipe.name} — API Recipe`),
		recipe.summary,
		product &&
			`> Product & pricing details: ${link(product.name, `${SITE_URL}${productHref(product.slug)}.md`, "md")}`,
		h2("Flow"),
		recipeMermaidFence(recipe),
		h2("Steps"),
		stepList(resolved),
		h2("Notes"),
		bulletList([
			"Call the steps in the order shown above; each links to its full API reference.",
			"Branch on the exact field each step names above: `response_type_id` says which response shape came back (the usual routing key), while `response_status_id` carries the status of a financial transaction.",
			`All requests are signed; see ${link("How Auth Works", `${SITE_URL}${docsHref("how-auth-works")}`, "md")}.`,
		]),
	]);
}

/** Render the `/recipe.md` overview: every recipe, linked to its twin. */
export function renderRecipesIndexMarkdown(): string {
	const canonical = `${SITE_URL}${recipeHref()}`;

	return joinBlocks([
		frontMatter({
			title: "API Recipes",
			description:
				"Multi-step Eko API workflows — the order to call endpoints in, and how to branch on each response.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("API Recipes"),
		"Each recipe is a complete, multi-call workflow across several Eko endpoints — the order to call them in, and the conditional jumps to make based on each response. The per-endpoint references tell you how to call one API; these tell you how to combine them.",
		h2("Available recipes"),
		bulletList(
			RECIPES.map((recipe) => {
				const product = recipe.productId
					? ACTIVE_PRODUCTS_MAP[recipe.productId]
					: undefined;
				const context = product ? ` _(${product.name})_` : "";
				const steps = `${recipe.steps.length} step${recipe.steps.length === 1 ? "" : "s"}`;
				return `${link(recipe.name, `${SITE_URL}${recipeHref(recipe.slug)}.md`, "md")} — ${recipe.summary} ${steps}.${context}`;
			}),
		),
	]);
}
