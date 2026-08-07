import type { Lifecycle } from "@/lib/auth/client";

/**
 * The short label for each lifecycle state.
 *
 * One map, because the rail caption and the Home profile card must never
 * disagree about what state an account is in.
 */
const BADGE_LABELS: Record<Lifecycle, string> = {
	lead: "Lead",
	onboarded: "Onboarded",
	active: "Active",
	"kyc-pending": "KYC Pending",
	inactive: "Inactive",
	unknown: "Pending",
};

/**
 * The short label for a lifecycle state. A state this build doesn't know — one
 * added upstream — reads as "Pending" rather than rendering `undefined`.
 * @param state - The session's lifecycle state.
 * @returns The badge label.
 */
export const lifecycleBadge = (state: Lifecycle): string =>
	BADGE_LABELS[state] ?? BADGE_LABELS.unknown;
