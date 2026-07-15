import type { EkoProfile, LifecycleState, ProfileResult } from "../types";

export interface MeView {
	state: LifecycleState;
	mobile: string;
	profile: EkoProfile | null;
	zohoId: string | null;
}

export function deriveStateFromProfile(r: ProfileResult): LifecycleState {
	if (r.kind === "inactive") return "inactive";
	if (r.kind === "error") return "unknown";
	if (r.kind === "not_found") return "lead";
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
	if (r.kind === "inactive") {
		return { state: "inactive", mobile, profile: null, zohoId: null };
	}
	if (r.kind === "error") {
		// Upstream lookup failed — report a neutral state, never a profile.
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
