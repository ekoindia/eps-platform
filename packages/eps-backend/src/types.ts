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
	| { kind: "not_found"; responseTypeId: number }
	| { kind: "inactive"; responseTypeId: number };
