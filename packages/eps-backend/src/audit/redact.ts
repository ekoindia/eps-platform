/**
 * Server-side twin of the site's `redactIdentifiers` (`src/lib/analytics.ts`).
 *
 * The browser already redacts before sending, but a stale or hand-rolled client
 * can post anything, and these lines land in VM logs — so the backend redacts
 * again as the authority. Duplicated rather than imported: the Docker build
 * context holds only this package, and the site module touches `window`.
 * `src/lib/analytics.parity.test.ts` runs both over the same inputs; change one
 * list and that test fails until the other matches.
 */
const IDENTIFIER_PATTERNS: readonly RegExp[] = [
	/[^\s@]+@[^\s@]+/g,
	/\b(?=[\w-]*\d)[\w-]{24,}/g,
	/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g,
	/\d(?:[\s-]?\d){5,}/g,
];

/**
 * Replaces emails, key-like tokens, PANs and six-plus-digit numbers (spaced or
 * hyphenated) with an ellipsis.
 * @param text - The text to scrub.
 * @returns The same text with identifiers replaced.
 */
export function redactIdentifiers(text: string): string {
	return IDENTIFIER_PATTERNS.reduce(
		(scrubbed, pattern) => scrubbed.replace(pattern, "…"),
		text,
	);
}
