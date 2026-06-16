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

/** One step in a recipe; a call to a single documented endpoint. */
export interface RecipeStep {
	/** FK into `API_SPECS.slug`. */
	specSlug: string;
	/** Why this step exists in the flow. */
	purpose: string;
	/** Conditional jumps keyed on the response's `response_status_id`. */
	branches?: {
		onResponseStatusId: number;
		/** A spec slug to jump to, or "done" to end the flow. */
		goto: string;
		note?: string;
	}[];
}

/** A named, multi-step flow across several endpoints. */
export interface Recipe {
	id: string;
	name: string;
	summary: string;
	/** Optional FK into `API_PRODUCTS.id`. */
	productId?: string;
	steps: RecipeStep[];
}

export const RECIPES: Recipe[] = [
	{
		id: "dmt-send-money",
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
						onResponseStatusId: 463,
						goto: "dmt-onboard-sender",
						note: "Sender not found — onboard them before continuing.",
					},
				],
			},
			{
				specSlug: "dmt-onboard-sender",
				purpose: "Register a new sender when Get Sender returned 463.",
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
		name: "AePS — Cash Withdrawal",
		summary:
			"Aadhaar-enabled cash withdrawal: one-time agent activation, daily 2FA, then the biometric withdrawal.",
		productId: "aeps",
		steps: [
			{
				specSlug: "aeps-activate-fingpay",
				purpose: "One-time activation of AePS Fingpay for the agent.",
			},
			{
				specSlug: "aeps-daily-auth",
				purpose: "Daily two-factor authentication required before transacting.",
			},
			{
				specSlug: "aeps-cash-withdrawal",
				purpose: "Perform the biometric Aadhaar-enabled cash withdrawal.",
				branches: [{ onResponseStatusId: 0, goto: "done" }],
			},
		],
	},
];

/** Throws if any recipe step (or branch target) references an unknown slug. */
export const assertRecipeSlugs = (
	recipes: Recipe[],
	knownSlugs: ReadonlySet<string>,
): void => {
	for (const recipe of recipes) {
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
			}
		}
	}
};
