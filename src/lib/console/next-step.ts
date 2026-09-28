import type { Lifecycle } from "@/lib/auth/client";
import { needsKycUpload } from "./lifecycle";

/** The one blocker a developer account must clear next, if this session can see one. */
export type NextStep =
	| { kind: "esign" }
	| { kind: "kyc-upload"; action: "Upload" | "Re-upload" }
	| { kind: "none" };

/**
 * The step NextStepsCard spotlights, and ⌘K's `get_started` card answers
 * with — one function, so the two can never disagree.
 *
 * E-sign first when owed (the signed agreement is what the KYC pack covers),
 * else the KYC upload while the pack is owed. Anything else is not a blocker
 * this session can see: the remaining steps are routes, not checklists.
 * @param input.state - The session's lifecycle state.
 * @param input.esignPending - The E-sign entitlement is in the wlc list.
 * @param input.packCta - The counted pack's action: `null` when the pack owes
 *   nothing (approved or all in review), undefined when not fetched — the
 *   lifecycle state then decides the wording.
 * @returns The next step, or `{ kind: "none" }`.
 */
export function deriveNextStep({
	state,
	esignPending,
	packCta,
}: {
	state: Lifecycle;
	esignPending: boolean;
	packCta?: "Upload" | "Re-upload" | null;
}): NextStep {
	if (esignPending) return { kind: "esign" };
	if (needsKycUpload(state) && packCta !== null) {
		return {
			kind: "kyc-upload",
			action: packCta ?? (state === "kyc-rejected" ? "Re-upload" : "Upload"),
		};
	}
	return { kind: "none" };
}
