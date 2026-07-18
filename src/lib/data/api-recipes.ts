/**
 * Machine-readable multi-step API "recipes" (runbooks) for Eko's REST APIs.
 *
 * These encode the conditional, multi-call flows that the per-endpoint
 * descriptions in `api-specs.ts` already imply (e.g. DMT: if the sender is not
 * found, onboard them first). They are consumed by the agent bundle, context
 * packs, the MCP, and SDK examples — never duplicated downstream.
 *
 * `specSlug` and branch `goto` targets are foreign keys into `API_SPECS.slug`;
 * `assertRecipeSlugs` fails the build/tests on any dangling reference.
 */

/**
 * What triggers a branch. EXACTLY ONE key — the `?: never` arms make setting
 * both a compile error rather than a runtime surprise.
 *
 * Which one to use follows the API: non-financial endpoints route on
 * `response_type_id` (the id space that says *which response shape* came back),
 * while financial endpoints don't return one — they signal on
 * `response_status_id` / `tx_status`.
 */
export type RecipeBranchCondition =
	| { onResponseTypeId: number; onResponseStatusId?: never }
	| { onResponseStatusId: number; onResponseTypeId?: never };

/** One conditional jump out of a recipe step. */
export type RecipeBranch = RecipeBranchCondition & {
	/** A spec slug to jump to, or "done" to end the flow. */
	goto: string;
	note?: string;
};

/**
 * The response field a branch fires on, and the value it fires at.
 *
 * The one place the two condition keys collapse back into "which field, which
 * value" — every renderer calls this instead of repeating the ternary. Returned
 * as parts, not a sentence, because each surface needs a different shape: the
 * SVG flowchart labels an edge with the bare value, the markdown twin wants the
 * field and value in separate code spans, the mermaid label wants both inline.
 */
export const branchCondition = (
	branch: RecipeBranch,
): { field: "response_type_id" | "response_status_id"; value: number } =>
	branch.onResponseTypeId !== undefined
		? { field: "response_type_id", value: branch.onResponseTypeId }
		: { field: "response_status_id", value: branch.onResponseStatusId };

/**
 * How often a step runs: once per agent ever (`once` — a one-time activation or
 * eKYC onboarding step), or once per calendar day (`daily` — the biometric
 * re-auth KYC). Absent means no frequency badge is rendered for the step.
 */
export type RecipeStepFrequency = "once" | "daily";

/** Human label for a step's frequency badge, shared by every surface. */
export const STEP_FREQUENCY_LABEL: Record<RecipeStepFrequency, string> = {
	once: "One-time",
	daily: "Daily",
};

/** One step in a recipe; a call to a single documented endpoint. */
export interface RecipeStep {
	/** FK into `API_SPECS.slug`. */
	specSlug: string;
	/** Why this step exists in the flow. */
	purpose: string;
	/** Conditional jumps out of this step; see {@link RecipeBranch}. */
	branches?: RecipeBranch[];
	/** How often the step runs (one-time setup/eKYC, or a daily KYC gate); see
	 * {@link RecipeStepFrequency}. Absent → no frequency badge. */
	frequency?: RecipeStepFrequency;
}

/** A named, multi-step flow across several endpoints. */
export interface Recipe {
	id: string;
	/** Kebab-case slug; the `/recipe/<slug>` route. Distinct from `id`, which is
	 * the bundle/MCP identifier — see `assertRecipeSlugs` for the guards. */
	slug: string;
	name: string;
	summary: string;
	/** Optional FK into `API_PRODUCTS.id`. */
	productId?: string;
	steps: RecipeStep[];
}

/** URL section segment under which all recipe pages live. */
export const RECIPE_SECTION_SLUG = "recipe";

/** Site-relative path for a recipe page; no slug → the `/recipe` overview. */
export const recipeHref = (slug?: string): string =>
	slug ? `/${RECIPE_SECTION_SLUG}/${slug}` : `/${RECIPE_SECTION_SLUG}`;

export const RECIPES: Recipe[] = [
	{
		id: "dmt-send-money",
		slug: "dmt-send-money",
		name: "DMT — Send Money",
		summary:
			"Full domestic money transfer flow: look up the sender, onboard them if new, add the recipient, then send an OTP-verified transfer.",
		productId: "dmt",
		steps: [
			{
				specSlug: "dmt-get-sender",
				purpose:
					"Check whether the customer is already a registered DMT sender.",
				branches: [
					{
						onResponseTypeId: 308,
						goto: "dmt-onboard-sender",
						note: "Sender not found — onboard them before continuing.",
					},
				],
			},
			{
				specSlug: "dmt-onboard-sender",
				purpose:
					"Register a new sender when Get Sender API returns `response_type_id=308`.",
			},
			{
				specSlug: "dmt-add-recipient",
				purpose: "Add the beneficiary the sender wants to transfer to.",
			},
			{
				specSlug: "dmt-send-otp",
				purpose: "Trigger the transaction OTP sent to the sender.",
			},
			{
				specSlug: "dmt-initiate-transfer",
				purpose: "Submit the OTP-verified transfer to complete the flow.",
				branches: [{ onResponseStatusId: 0, goto: "done" }],
			},
		],
	},
	{
		id: "aeps-cash-withdrawal",
		slug: "aeps-cash-withdrawal",
		name: "AePS — Cash Withdrawal",
		summary:
			"Aadhaar-enabled cash withdrawal: one-time agent activation and eKYC, daily KYC, then the biometric withdrawal.",
		productId: "aeps",
		steps: [
			{
				specSlug: "aeps-activate-fingpay",
				purpose: "One-time activation of AePS Fingpay for the agent.",
				frequency: "once",
			},
			{
				specSlug: "aeps-send-otp-kyc",
				purpose:
					"One-time eKYC step 1 (agent onboarding, not per transaction): OTP to the agent's Aadhaar-linked mobile.",
				frequency: "once",
			},
			{
				specSlug: "aeps-verify-otp-kyc",
				purpose:
					"One-time eKYC step 2 (agent onboarding): verify the OTP with the otp_ref_id and reference_tid from step 1.",
				frequency: "once",
			},
			{
				specSlug: "aeps-biometric-ekyc",
				purpose:
					"One-time eKYC step 3 (agent onboarding): the agent's biometric PID completes eKYC.",
				frequency: "once",
			},
			{
				specSlug: "aeps-daily-auth",
				purpose:
					"Daily KYC — biometric-only, repeated once per calendar day before the agent's first transaction.",
				frequency: "daily",
			},
			{
				specSlug: "aeps-cash-withdrawal",
				purpose: "Perform the biometric Aadhaar-enabled cash withdrawal.",
				branches: [{ onResponseStatusId: 0, goto: "done" }],
			},
		],
	},
];

const RECIPES_BY_SLUG: Map<string, Recipe> = new Map(
	RECIPES.map((recipe) => [recipe.slug, recipe]),
);

/** Resolve a `/recipe/<slug>` page, or `undefined` for an unknown slug. */
export const getRecipeBySlug = (slug: string): Recipe | undefined =>
	RECIPES_BY_SLUG.get(slug);

/** Kebab-case: lowercase alphanumerics separated by single hyphens. */
const KEBAB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Throws if any recipe's own slug is malformed or duplicated, or if any step
 * (or branch target) references an unknown spec slug. Runs at build time via
 * `build-agent-bundle.ts`, so a dangling reference fails the build rather than
 * shipping a `/recipe/<slug>` page that links to a 404.
 */
export const assertRecipeSlugs = (
	recipes: Recipe[],
	knownSlugs: ReadonlySet<string>,
): void => {
	const seenRecipeSlugs = new Map<string, string>();
	for (const recipe of recipes) {
		if (!KEBAB_SLUG.test(recipe.slug)) {
			throw new Error(
				`api-recipes: recipe "${recipe.id}" has a non-kebab-case slug "${recipe.slug}".`,
			);
		}
		// URLs are not reliably case-sensitive — compare case-insensitively.
		const key = recipe.slug.toLowerCase();
		const prior = seenRecipeSlugs.get(key);
		if (prior) {
			throw new Error(
				`api-recipes: duplicate recipe slug "${recipe.slug}" — "${prior}" vs "${recipe.id}".`,
			);
		}
		seenRecipeSlugs.set(key, recipe.id);

		for (const step of recipe.steps) {
			if (!knownSlugs.has(step.specSlug)) {
				throw new Error(
					`api-recipes: recipe "${recipe.id}" references unknown spec slug "${step.specSlug}".`,
				);
			}
			for (const branch of step.branches ?? []) {
				if (branch.goto !== "done" && !knownSlugs.has(branch.goto)) {
					throw new Error(
						`api-recipes: recipe "${recipe.id}" branch references unknown spec slug "${branch.goto}".`,
					);
				}
				// The union type rejects setting both keys; only "neither" can reach
				// here (hand-written JSON, or a spread that drops the discriminant).
				if (
					branch.onResponseTypeId === undefined &&
					branch.onResponseStatusId === undefined
				) {
					throw new Error(
						`api-recipes: recipe "${recipe.id}" branch to "${branch.goto}" sets neither onResponseTypeId nor onResponseStatusId.`,
					);
				}
			}
		}
	}
};
