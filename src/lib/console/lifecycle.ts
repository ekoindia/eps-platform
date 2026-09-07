import type { Lifecycle } from "@/lib/auth/client";

/** How a lifecycle state reads on a badge. */
export interface LifecycleBadge {
	label: string;
	variant: "secondary" | "destructive";
}

/**
 * The badge for each lifecycle state.
 *
 * One map, because the rail caption and the Home profile card must never
 * disagree about what state an account is in — and because the label and the
 * colour are one decision: only `kyc-rejected` is red, and it is red for the
 * same reason its Upload Documents rows are.
 */
const BADGES: Record<Lifecycle, LifecycleBadge> = {
	lead: { label: "Lead", variant: "secondary" },
	onboarded: { label: "Onboarded", variant: "secondary" },
	active: { label: "Active", variant: "secondary" },
	"kyc-pending": { label: "KYC Pending", variant: "secondary" },
	"kyc-rejected": { label: "KYC Rejected", variant: "destructive" },
	inactive: { label: "Inactive", variant: "secondary" },
	unknown: { label: "Pending", variant: "secondary" },
};

/**
 * The badge for a lifecycle state. A state this build doesn't know — one added
 * upstream — reads as a neutral "Pending" rather than rendering `undefined`.
 * @param state - The session's lifecycle state.
 * @returns The badge label and variant.
 */
export const lifecycleBadge = (state: Lifecycle): LifecycleBadge =>
	BADGES[state] ?? BADGES.unknown;

/**
 * The upstream `account_state_id` of a fully live account.
 *
 * Distinct from the `Lifecycle` value `"active"`, which deliberately fails OPEN
 * — every id except the KYC-pending one reads as active, `null` included, so
 * that an unmapped id never puts a blocking step in front of a working partner
 * (see `deriveStateFromProfile`). That is the right default for *showing* a
 * partner their console. It is the wrong one for deciding whether a support
 * ticket can be filed, which needs the narrow question answered narrowly.
 */
export const LIVE_ACCOUNT_STATE_ID = 16;

/**
 * Whether this account can have a Zoho Desk ticket raised against it.
 *
 * A ticket is filed against the partner's Zoho **contact**, and the lead is only
 * converted into one when the account goes fully live. Before that the console
 * holds a lead id, ticket creation fails upstream, and offering the button
 * promises the partner a support channel that cannot exist yet.
 *
 * Fails CLOSED, unlike the lifecycle derivation: an absent or unrecognised state
 * id hides the button. A missing escape hatch is a smaller harm than one that
 * errors when a partner is already looking at an error.
 * @param accountStateId - `profile.accountStateId`, or null when unknown.
 * @returns True only for a fully live account.
 */
export const canRaiseIssue = (accountStateId: number | null | undefined): boolean =>
	accountStateId === LIVE_ACCOUNT_STATE_ID;

/**
 * Whether this account still owes a KYC document pack.
 *
 * The two upstream `account_state_id` values 48 (KYC Pending) and 47 (Ready for
 * Resubmission), read through the names the backend already collapsed them into
 * — see `deriveStateFromProfile`. Gating on the state rather than on the
 * `/connect/interactions` entitlement for 586/587 is deliberate: a short or
 * stale wlc list used to hide the one step a partner must complete to go live.
 *
 * Fails CLOSED like `canRaiseIssue`, and for a milder reason: every other
 * lifecycle — `active` included — is an account with no pack outstanding, so
 * `unknown` reading as "nothing owed" costs a partner a rail item for one
 * `/me` round-trip, not access to a working account.
 * @param state - The session's lifecycle state.
 * @returns True while the KYC pack is outstanding or was refused.
 */
export const needsKycUpload = (state: Lifecycle): boolean =>
	state === "kyc-pending" || state === "kyc-rejected";
