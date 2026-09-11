import { COMPANY_TYPES } from "./businessFields";

/** Indian PAN: five letters, four digits, one letter. */
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const PAN_LENGTH = 10;

/**
 * Holder type encoded in the 4th letter of a PAN. Not a lookup we invented —
 * it is how the Income Tax Department allocates the number, so it is as
 * reliable as the PAN itself.
 */
export const PAN_CATEGORY_LABELS: Record<string, string> = {
	P: "Individual",
	C: "Company",
	H: "Hindu Undivided Family (HUF)",
	F: "Partnership Firm / LLP",
	A: "Association of Persons (AOP)",
	T: "Trust",
	B: "Body of Individuals (BOI)",
	L: "Local Authority",
	J: "Artificial Judicial Person",
	G: "Government Agency",
};

/**
 * Which `COMPANY_TYPES` a PAN category admits, and whether the first of them
 * dominates enough to preselect. One table so the ordering and the prefill can
 * never disagree about which option leads.
 *
 * A category absent from this table (H, A, T, B, L, J, G) has no matching
 * option at all: it gets the default order and no prefill rather than a
 * flattering guess.
 *
 * ponytail: `C` and `F` each hide a collision — `C` is Private *and* Public
 * Limited, `F` is LLP *and* Partnership Firm. The second entry is not padding;
 * it is the other half of an ambiguous letter, kept adjacent to the prefilled
 * one on purpose. Do not "simplify" these to single-element lists.
 */
const CATEGORY_CANDIDATES: Record<
	string,
	{ order: readonly string[]; prefill: string | null }
> = {
	// A personal PAN is equally likely a sole proprietor or a bare individual,
	// so surface both and preselect neither.
	P: { order: ["3", "7"], prefill: null },
	C: { order: ["1", "5"], prefill: "1" },
	F: { order: ["4", "2"], prefill: "4" },
};

/**
 * How each category reads in the success line under the field, article included.
 *
 * Separate from {@link PAN_CATEGORY_LABELS}, which names the legal type for
 * prose; these are written to slot into "Format looks right — ___."
 */
const PAN_CATEGORY_PHRASES: Record<string, string> = {
	P: "an individual's PAN",
	C: "a company PAN",
	H: "a Hindu Undivided Family PAN",
	F: "a partnership or LLP PAN",
	A: "an association-of-persons PAN",
	T: "a trust PAN",
	B: "a body-of-individuals PAN",
	L: "a local-authority PAN",
	J: "an artificial-judicial-person PAN",
	G: "a government-agency PAN",
};

/**
 * Names the holder type for the success line.
 *
 * PAN_PATTERN accepts ANY letter in the 4th position, not just the ten the
 * Income Tax Department allocates — "ABCDE1234F" is a well-formed PAN whose
 * category "D" means nothing. Those are format-valid and must not be rejected,
 * so they fall back to a phrase that claims nothing about the holder.
 *
 * @param category - A PAN category letter, or null when unknown.
 * @returns A phrase for "Format looks right — ___."
 */
export function panCategoryPhrase(category: string | null): string {
	return (category && PAN_CATEGORY_PHRASES[category]) ?? "a valid PAN";
}

/**
 * Cleans raw input into a PAN candidate: drops everything that is not a letter
 * or a digit, uppercases, and caps the length.
 *
 * Applied on every change rather than on paste alone, so a pasted
 * "abcde 1234 f", a typed lowercase character, a drag-and-drop and a browser
 * autofill all land the same way. This is also why the input carries no
 * `maxLength`: the browser applies that BEFORE the change handler sees the
 * value, so a pasted PAN with two spaces would be truncated to 10 dirty
 * characters and lose its last letter. Capping after the strip is the whole
 * fix.
 *
 * @param raw - Whatever the field received.
 * @returns Up to {@link PAN_LENGTH} uppercase alphanumerics.
 */
export function normalizePan(raw: string): string {
	return raw
		.replace(/[^a-zA-Z0-9]/g, "")
		.toUpperCase()
		.slice(0, PAN_LENGTH);
}

/**
 * Reads the holder-type letter out of a PAN.
 *
 * @param pan - The (uppercased) PAN as typed.
 * @returns The 4th letter, or null while the PAN is incomplete or malformed.
 */
export function panCategory(pan: string): string | null {
	return PAN_PATTERN.test(pan) ? pan[3] : null;
}

/**
 * True when the PAN belongs to a natural person rather than an entity.
 *
 * @param pan - The (uppercased) PAN as typed.
 */
export function isPersonalPan(pan: string): boolean {
	return panCategory(pan) === "P";
}

/**
 * The `company_type` value to preselect for a PAN category.
 *
 * @param category - A PAN category letter, or null when unknown.
 * @returns A `COMPANY_TYPES` value, or null when the letter admits more than
 * one equally likely option (P) or maps to nothing at all.
 */
export function companyTypeForPan(category: string | null): string | null {
	if (!category) return null;
	return CATEGORY_CANDIDATES[category]?.prefill ?? null;
}

/**
 * `COMPANY_TYPES` re-ordered so the options this PAN category permits come
 * first. Never filters — the PAN is a hint, the user is the authority, and a
 * partner whose PAN letter disagrees with their legal type must still be able
 * to pick the right one.
 *
 * @param category - A PAN category letter, or null when unknown.
 * @returns A permutation of `COMPANY_TYPES`; the default order when the
 * category is unknown or has no matching options.
 */
export function orderCompanyTypes(
	category: string | null,
): readonly { label: string; value: string }[] {
	const entry = category ? CATEGORY_CANDIDATES[category] : undefined;
	if (!entry) return COMPANY_TYPES;
	const head = entry.order
		.map((value) => COMPANY_TYPES.find((t) => t.value === value))
		.filter((t) => t !== undefined);
	return [
		...head,
		...COMPANY_TYPES.filter((t) => !entry.order.includes(t.value)),
	];
}
