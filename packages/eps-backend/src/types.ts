export type LifecycleState =
	| "lead"
	| "onboarded"
	| "active"
	/** Onboarded, but the KYC documents are still outstanding. */
	| "kyc-pending"
	| "inactive"
	| "unknown";

/** One entry of interaction 151's `account_detail.account_list`. */
export interface EkoAccount {
	id: number;
	label: string;
	productId: number;
	typeId: number;
}

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
	/**
	 * The user's accounts, from the same interaction-151 response. Empty when
	 * upstream sent no `account_detail` (e.g. a mid-onboarding profile).
	 */
	accounts: EkoAccount[];
	/**
	 * The E-value account id interaction 154 filters transaction history by, or
	 * null when it cannot be resolved — see `selectEvalueAccountId`.
	 */
	evalueAccountId: string | null;
	/**
	 * The profile blocks interaction 151 returns ALONGSIDE `user_detail` —
	 * `personal_detail` (gender, dob, qualification, marital status),
	 * `shop_detail`, `business_detail`. Eloka splits the same blocks out of its
	 * login payload (`wlc-webapp/utils/userObjectBuilder.js`) and renders them as
	 * the Profile page's Personal Details and Shop cards.
	 *
	 * Each block is passed through whole and untyped — the fields inside are
	 * upstream's, vary by user type, and modelling a subset silently drops
	 * whatever was left out (same reasoning as `RoleTransaction`).
	 *
	 * The BLOCK NAMES, though, are an allowlist and not a passthrough
	 * (`PROFILE_DETAIL_BLOCKS`): everything here is served to the browser by
	 * `/me`, so a block upstream adds later must be reviewed before it ships
	 * rather than forwarded automatically. Empty when 151 sent none of them.
	 */
	detailBlocks: Record<string, unknown>;
	/**
	 * `user_detail.account_state_id` — 16 is a live account, 48 one whose KYC is
	 * still pending. Null when upstream sent no id, or sent one that is not a
	 * whole number (`toStateId`).
	 *
	 * Also present inside `userDetail` below, and typed here anyway: it is the
	 * one field of that bag the lifecycle state machine branches on
	 * (`deriveStateFromProfile`), and a state machine reading an untyped record
	 * is how a renamed upstream key becomes a silent misclassification.
	 */
	accountStateId: number | null;
	/**
	 * The whole upstream `user_detail`, minus keys that look like credentials
	 * (`stripSensitive`).
	 *
	 * Unlike `detailBlocks` above this is a DENYLIST, not a reviewed allowlist:
	 * the console reads a long tail of profile fields — PAN, current plan,
	 * alternate mobiles, profile picture, primary-mobile metadata — and gating
	 * each one on a backend release was costing more than it bought. The trade is
	 * explicit: everything here reaches browser JavaScript and `sessionStorage`,
	 * so it is PII sitting where an injected script could read it, and the
	 * denylist cannot know about a credential upstream adds under a new name.
	 */
	userDetail: Record<string, unknown>;
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
