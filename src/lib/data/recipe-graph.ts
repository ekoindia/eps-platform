/**
 * Resolves a {@link Recipe} into a rendered-shape graph: steps enriched with
 * their endpoint's title/method/docs-href, plus the edges between them.
 *
 * Neutral by design — no markdown helpers, no React, no mermaid syntax. Both
 * the HTML stepper (`components/recipe/RecipeStepper.tsx`) and the markdown
 * twin (`markdown/render-recipe.ts`) derive from this one function, so the two
 * surfaces cannot disagree about the flow. Mermaid string-escaping lives in the
 * markdown layer, which is the only consumer that needs it.
 */
import type { Recipe, RecipeStep } from "./api-recipes";
import type { ApiSpec } from "./api-specs-common";
import { docHrefForSlug, getDocBySlug } from "./docs-registry";

/** The terminal node id for a flow that ends. */
export const DONE_NODE = "done";

export interface ResolvedBranch {
	/** The `response_status_id` that triggers this jump. */
	onResponseStatusId: number;
	/** Raw target: a spec slug, or `"done"`. */
	goto: string;
	note?: string;
	/** Node id of the target — a step id, or {@link DONE_NODE}. */
	targetNodeId: string;
	/** Human label for the target ("done", or the endpoint's name). */
	targetTitle: string;
	/** 1-based step number of the target, when it is a step in this recipe. */
	targetStepNumber?: number;
	/** True when this branch's target is simply the next step in the flow. */
	targetIsNextStep: boolean;
}

export interface ResolvedStep {
	/** Stable node id, `s1`-based, used by both the stepper and the graph. */
	nodeId: string;
	/** 1-based position in the flow. */
	number: number;
	specSlug: string;
	purpose: string;
	/** The endpoint's display name; falls back to the slug if it has no docs page. */
	title: string;
	method?: ApiSpec["method"];
	/** Docs link, or `undefined` when the endpoint has no page (never a 404). */
	docHref?: string;
	branches: ResolvedBranch[];
}

export interface ResolvedEdge {
	from: string;
	to: string;
	/** The branch this edge represents; absent for a plain fall-through to the
	 * next step. Renderers format their own label from it — the compact SVG wants
	 * just the status id, the mermaid twin wants the full note. */
	branch?: ResolvedBranch;
}

export interface ResolvedRecipe {
	steps: ResolvedStep[];
	edges: ResolvedEdge[];
	/** True when any edge reaches {@link DONE_NODE}. */
	hasDone: boolean;
}

const nodeIdFor = (index: number): string => `s${index + 1}`;

/** Display title for a step's endpoint — the spec name, or the bare slug. */
const titleFor = (specSlug: string): string =>
	getDocBySlug(specSlug)?.title ?? specSlug;

/**
 * Resolve one branch against the recipe's own step list. A `goto` that names a
 * spec outside this recipe still resolves to its own node so the edge is not
 * silently dropped — `assertRecipeSlugs` has already proven the slug is real.
 */
const resolveBranch = (
	branch: NonNullable<RecipeStep["branches"]>[number],
	steps: RecipeStep[],
	stepIndex: number,
): ResolvedBranch => {
	if (branch.goto === DONE_NODE) {
		return {
			...branch,
			targetNodeId: DONE_NODE,
			targetTitle: "done",
			targetIsNextStep: false,
		};
	}
	const targetIndex = steps.findIndex((s) => s.specSlug === branch.goto);
	const isStepInRecipe = targetIndex !== -1;
	return {
		...branch,
		targetNodeId: isStepInRecipe ? nodeIdFor(targetIndex) : branch.goto,
		targetTitle: titleFor(branch.goto),
		targetStepNumber: isStepInRecipe ? targetIndex + 1 : undefined,
		targetIsNextStep: isStepInRecipe && targetIndex === stepIndex + 1,
	};
};

/**
 * Resolve a recipe into steps + edges.
 *
 * Edge rules:
 * - Each step falls through to the next one, unless a branch already targets
 *   that same next step — then the single labelled branch edge stands in for it,
 *   rather than drawing a duplicate unlabelled edge alongside it.
 * - Branch edges carry their `response_status_id` (and note) as the label.
 * - A `goto: "done"` branch draws an edge to the terminal node.
 *
 * NOTE: the flow drawn here is exactly what `RECIPES` encodes and no more. Where
 * a step branches on an error but the success path is only implied (e.g. DMT's
 * "sender found" path skipping onboarding), that implied edge is absent from the
 * data and so is absent here. Fixing that means adding it to `RECIPES` — which
 * also fixes the context packs and MCP, which read the same field.
 */
export const resolveRecipe = (recipe: Recipe): ResolvedRecipe => {
	const steps: ResolvedStep[] = recipe.steps.map((step, index) => ({
		nodeId: nodeIdFor(index),
		number: index + 1,
		specSlug: step.specSlug,
		purpose: step.purpose,
		title: titleFor(step.specSlug),
		method: getDocBySlug(step.specSlug)?.method,
		docHref: docHrefForSlug(step.specSlug),
		branches: (step.branches ?? []).map((branch) =>
			resolveBranch(branch, recipe.steps, index),
		),
	}));

	const edges: ResolvedEdge[] = [];
	for (const [index, step] of steps.entries()) {
		for (const branch of step.branches) {
			edges.push({ from: step.nodeId, to: branch.targetNodeId, branch });
		}
		const next = steps[index + 1];
		if (!next) continue;
		// A labelled branch to the next step already covers the fall-through.
		if (step.branches.some((b) => b.targetIsNextStep)) continue;
		edges.push({ from: step.nodeId, to: next.nodeId });
	}

	return { steps, edges, hasDone: edges.some((e) => e.to === DONE_NODE) };
};
