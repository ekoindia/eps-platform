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
	/** Ordered onboarding steps from upstream; empty for a fully-onboarded user. */
	onboardingSteps: Array<{ role: number; label: string }>;
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

/**
 * One row of transaction history, narrowed to the fields the console renders.
 *
 * Deliberately duplicated with the frontend's copy in
 * `src/lib/console/transactions.ts`: this is the package boundary, and
 * `EkoProfile`/`MeView` are already duplicated the same way. A shared types
 * package for two interfaces is not worth the build wiring.
 *
 * Money fields are always numbers here — `mapTransactionRows` coerces them,
 * since upstream sends some as numeric strings.
 */
export interface TransactionRow {
	tid: string;
	tx_typeid: number;
	tx_name: string;
	amount_dr: number;
	amount_cr: number;
	fee: number;
	commission_earned: number;
	bonus: number;
	tds: number;
	gst: number;
	insurance_amount: number;
	eko_service_charge: number;
	eko_gst: number;
	r_bal: number;
	status: string;
	response_status_id: number;
	datetime: string;
	customer_name?: string;
	customer_mobile?: string;
	account?: string;
	bank?: string;
	operator?: string;
	rrn?: string;
	trackingnumber?: string;
	recipient_name?: string;
	recipient_mobile?: string;
}
