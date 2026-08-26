import type { EkoProfile, LifecycleState, ProfileResult } from "../types";

export interface MeView {
	state: LifecycleState;
	mobile: string;
	profile: EkoProfile | null;
	zohoId: string | null;
}

/**
 * The `/me` view for a signup session. Deliberately lightweight — no Eko call —
 * because the wizard fetches its own state from `/signup/state`. It exists so a
 * page reload mid-onboarding restores the session instead of dropping the user
 * to anonymous and forcing a fresh OTP.
 */
export interface SignupView {
	role: "signup";
	mobile: string;
}

/**
 * `user_detail.account_state_id` for an account that has finished onboarding but
 * whose KYC documents are still outstanding. Its sibling, 16, is a live account.
 */
const KYC_PENDING_STATE_ID = 48;

/**
 * `user_detail.account_state_id` for an account whose KYC pack was reviewed and
 * refused — upstream describes it as *Ready for Resubmission*. The partner has
 * to read the per-document rejection reason and upload the flagged documents
 * again; the account is otherwise as provisioned as a `kyc-pending` one.
 */
const KYC_REJECTED_STATE_ID = 47;

export function deriveStateFromProfile(r: ProfileResult): LifecycleState {
	if (r.kind === "inactive") return "inactive";
	if (r.kind === "error" || r.kind === "not_allowed") return "unknown";
	if (r.kind === "not_found") return "lead";
	if (r.kind === "onboarding") return "onboarded";
	// Tests for 1 rather than "not 0": 1 is the value upstream documents as
	// in-progress, and a third value appearing later is not a reason to tell a
	// finished partner their onboarding is unfinished.
	if (r.profile.onboarding === 1) return "onboarded";
	if (r.profile.accountStateId === KYC_PENDING_STATE_ID) return "kyc-pending";
	if (r.profile.accountStateId === KYC_REJECTED_STATE_ID) return "kyc-rejected";
	// Deliberately fail-open on the id. 16 is live, and so is every id we have
	// not mapped — including `null`, which is what the connect-api provider
	// always reports (its envelope has no such field). Reading an unknown id as
	// pending would put a blocking KYC step in front of every partner on that
	// provider the day this ships.
	return "active";
}

export async function buildMeView(
	mobile: string,
	r: ProfileResult,
	leadLookup?: (mobile: string) => Promise<boolean>,
): Promise<MeView> {
	if (r.kind === "found") {
		return {
			state: deriveStateFromProfile(r),
			mobile,
			profile: r.profile,
			zohoId: r.profile.zohoId || null,
		};
	}
	if (r.kind === "onboarding") {
		return {
			state: "onboarded",
			mobile,
			profile: r.profile,
			zohoId: r.profile.zohoId || null,
		};
	}
	if (r.kind === "inactive") {
		return { state: "inactive", mobile, profile: null, zohoId: null };
	}
	if (r.kind === "error" || r.kind === "not_allowed") {
		// Upstream lookup failed, or the profile is not an EPS business partner —
		// report a neutral state, never a profile.
		return { state: "unknown", mobile, profile: null, zohoId: null };
	}
	// not_found: try optional lead enrichment
	let isLead = false;
	if (leadLookup) {
		try {
			isLead = await leadLookup(mobile);
		} catch {
			isLead = false;
		}
	}
	return {
		state: isLead ? "lead" : "unknown",
		mobile,
		profile: null,
		zohoId: null,
	};
}
