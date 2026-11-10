/**
 * How many directors (or partners) a business has, and what that means for the
 * KYC pack.
 *
 * Every per-director document — an Aadhaar, a PAN, a live photograph — is one
 * upload slot that has to carry a copy for each of them, and upstream locks the
 * slot once it is in. So the count is asked for up front on the Documents page
 * (stored on the CRM Lead as `Count_of_Directors`) and the upload dialog warns
 * before a pack goes in short.
 *
 * Which counts make sense is the business type's call — see {@link directorRule}.
 */

import type { Profile } from "@/lib/auth/client";
import { profileCompanyTypeCode } from "@/lib/auth/identity";

/** The most directors a pack is ever asked for. */
export const DIRECTOR_MAX = 15;

/** What the people being counted are called, for one business type. */
export interface DirectorNoun {
	/** Singular, e.g. `director`. */
	one: string;
	/** Plural, e.g. `directors`. */
	many: string;
}

/** What the business type says about the director count. */
export type DirectorRule =
	/** Not a question for this business: a sole proprietor or an individual. */
	| { kind: "hidden" }
	/** Settled by the business type itself: a One Person Company. */
	| { kind: "fixed"; count: 1 }
	/** Asked for, within `min..max`. */
	| {
			kind: "ask";
			min: number;
			max: number;
			/**
			 * What the checks assume until the partner answers — the legal minimum
			 * for the type — or null when there is nothing safe to assume.
			 */
			floor: number | null;
			noun: DirectorNoun;
	  };

const DIRECTORS: DirectorNoun = { one: "director", many: "directors" };

/**
 * The rule per interaction-522 company code (see `COMPANY_TYPES`). Minimums are
 * the legal ones: a private company needs two directors, a public one three,
 * an LLP two designated partners, a partnership two partners.
 */
const RULES: Record<string, DirectorRule> = {
	"1": { kind: "ask", min: 2, max: DIRECTOR_MAX, floor: 2, noun: DIRECTORS }, // Private Limited
	"2": {
		kind: "ask",
		min: 2,
		max: DIRECTOR_MAX,
		floor: 2,
		noun: { one: "partner", many: "partners" },
	}, // Partnership
	"3": { kind: "hidden" }, // Sole Proprietorship
	"4": {
		kind: "ask",
		min: 2,
		max: DIRECTOR_MAX,
		floor: 2,
		noun: { one: "designated partner", many: "designated partners" },
	}, // LLP
	"5": { kind: "ask", min: 3, max: DIRECTOR_MAX, floor: 3, noun: DIRECTORS }, // Public Limited
	"7": { kind: "hidden" }, // Individual
};

/**
 * An unknown or missing company type: still worth asking, but with no minimum
 * to assume, so nothing warns until the partner picks a number.
 */
const UNKNOWN: DirectorRule = {
	kind: "ask",
	min: 1,
	max: DIRECTOR_MAX,
	floor: null,
	noun: DIRECTORS,
};

/** "Private Limited", "Pvt Ltd", "Pvt. Ltd." — a private company's suffix. */
const PRIVATE_LIMITED = /\b(?:private\s+limited|pvt\.?\s*ltd)\b/i;

/**
 * Whether a name is a private company's registered name at all.
 *
 * Not a given on a Private Limited profile: the name comes from the PAN, and a
 * partner who verified a personal PAN by mistake carries their own name here.
 * @param name - The registered business name.
 */
export function isPrivateLimitedName(name: string | null | undefined): boolean {
	return PRIVATE_LIMITED.test(name ?? "");
}

/**
 * Whether a registered name marks a One Person Company — a private company
 * whose name must carry "(OPC)", as in "Acme (OPC) Private Limited".
 * @param name - The registered business name.
 */
export function isOpcName(name: string | null | undefined): boolean {
	return isPrivateLimitedName(name) && /\(\s*OPC\s*\)/i.test(name ?? "");
}

/**
 * What the partner's business type says about the director count.
 *
 * An OPC registers as a Private Limited company, so it is told apart by name —
 * and only for that type (or no type at all): an "(OPC)" in a partnership's
 * name is a typo, not one director.
 *
 * A Private Limited profile whose name is not a company's — a personal PAN
 * verified by mistake — could be an OPC or not, so it is asked across the full
 * range with nothing assumed.
 * @param profile - The signed-in developer's profile, or null.
 * @returns The rule to ask, assume and check by.
 */
export function directorRule(
	profile: Profile | null | undefined,
): DirectorRule {
	const code = profileCompanyTypeCode(profile);
	const name = profile?.name;
	if ((code === null || code === "1") && isOpcName(name)) {
		return { kind: "fixed", count: 1 };
	}
	if (code === "1" && !isPrivateLimitedName(name)) return UNKNOWN;
	return (code !== null && RULES[code]) || UNKNOWN;
}

/**
 * The partner's own answer, if it is one the rule allows.
 *
 * A stored count outside the type's range — a "1" on a private company, say —
 * is read as no answer rather than shown or trusted.
 * @param rule - From {@link directorRule}.
 * @param stored - `Count_of_Directors` as the CRM returned it.
 * @returns The count, or null when there is no usable answer.
 */
export function chosenDirectorCount(
	rule: DirectorRule,
	stored: unknown,
): number | null {
	if (rule.kind !== "ask") return null;
	const count =
		typeof stored === "number"
			? stored
			: typeof stored === "string" && stored.trim()
				? Number(stored)
				: NaN;
	return Number.isInteger(count) && count >= rule.min && count <= rule.max
		? count
		: null;
}

/**
 * The count the upload checks go by: the partner's answer, else what the rule
 * assumes.
 * @param rule - From {@link directorRule}.
 * @param stored - `Count_of_Directors` as the CRM returned it.
 * @returns The count, or null when there is nothing to check against.
 */
export function effectiveDirectorCount(
	rule: DirectorRule,
	stored: unknown,
): number | null {
	if (rule.kind === "hidden") return null;
	if (rule.kind === "fixed") return rule.count;
	return chosenDirectorCount(rule, stored) ?? rule.floor;
}
