/** Multipliers for Indian and shorthand amount words. */
const SCALE: Record<string, number> = {
	k: 1_000,
	thousand: 1_000,
	lakh: 100_000,
	lakhs: 100_000,
	lac: 100_000,
	lacs: 100_000,
	l: 100_000,
	crore: 10_000_000,
	crores: 10_000_000,
	cr: 10_000_000,
};

/**
 * Rewrites amounts in a query as plain digits: `₹5,000` → `5000`,
 * `1.5 lakh` → `150000`, `5k` → `5000`, `2 cr` → `20000000`.
 *
 * Every amount slot downstream reads digits only — the rules here, and the
 * on-device model later, which counts only digits or number words as evidence
 * for a number. Indian grouping (`1,50,000`) is handled because commas are
 * simply dropped between digits.
 * @param query - The raw palette query.
 * @returns The query with amounts as digits; everything else untouched.
 */
export function normalizeAmounts(query: string): string {
	return query
		.replace(/(?:₹|\brs\.?|\binr)\s*/gi, "")
		.replace(/(\d),(?=\d)/g, "$1")
		.replace(
			/(\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|crores?|cr)\b/gi,
			(_, amount: string, unit: string) =>
				String(Math.round(Number(amount) * SCALE[unit.toLowerCase()])),
		);
}
