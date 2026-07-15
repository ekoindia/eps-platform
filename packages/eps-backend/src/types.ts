export type LifecycleState =
	| "lead"
	| "onboarded"
	| "active"
	| "inactive"
	| "unknown";

export interface EkoProfile {
	name: string;
	email: string;
	mobile: string;
	code: number | string;
	userType: string;
	ekoUserId: string;
	roleList: string[];
	orgId: number;
	dateOfJoining?: string;
	onboarding: number;
	zohoId: string;
}

export type ProfileResult =
	| { kind: "found"; responseTypeId: number; profile: EkoProfile }
	/**
	 * A real profile whose onboarding is incomplete (`onboarding === 1`).
	 * Checked BEFORE the EPS-business-partner gate: `user_type` becomes "23"
	 * immediately after partial-account creation, so it cannot distinguish
	 * in-progress from complete. Callers mint a signup session for this kind.
	 */
	| { kind: "onboarding"; responseTypeId: number; profile: EkoProfile }
	| { kind: "not_found"; responseTypeId: number }
	| { kind: "inactive"; responseTypeId: number }
	| { kind: "not_allowed"; responseTypeId: number }
	/**
	 * The upstream did not authenticate/complete the profile lookup (e.g.
	 * `response_status_id != 0`, "Invalid Sender/Initiator"). This is a system
	 * failure, NOT a user classification — callers must not treat it as a new
	 * user or grant a session.
	 */
	| { kind: "error"; responseTypeId: number };
