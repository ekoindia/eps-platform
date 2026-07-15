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

export function deriveStateFromProfile(r: ProfileResult): LifecycleState {
	if (r.kind === "inactive") return "inactive";
	if (r.kind === "error" || r.kind === "not_allowed") return "unknown";
	if (r.kind === "not_found") return "lead";
	if (r.kind === "onboarding") return "onboarded";
	return r.profile.onboarding === 0 ? "active" : "onboarded";
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
