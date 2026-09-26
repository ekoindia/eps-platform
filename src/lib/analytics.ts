declare global {
	interface Window {
		dataLayer?: unknown[];
	}
}

/**
 * Customer identifiers and secrets, in the order they are replaced. Emails and
 * long opaque tokens go first so their digits are not half-eaten by the digit
 * rule and leave a recognisable remainder.
 * - email
 * - opaque token ≥24 chars containing a digit: developer keys, access keys,
 *   UUIDs, JWT segments. The digit keeps a hyphenated slug such as
 *   `bank-account-verification` readable.
 * - PAN (`ABCDE1234F`), any case — people type it lowercase
 * - six or more digits, optionally split by single spaces or hyphens, so a
 *   spaced Aadhaar (`1234 5678 9012`) or phone (`98765-43210`) goes too. The
 *   match starts and ends on a digit, so neighbouring words keep their spacing.
 *
 * eps-backend keeps a copy (`packages/eps-backend/src/audit/redact.ts`) pinned
 * by `analytics.parity.test.ts` — change both together.
 */
const IDENTIFIER_PATTERNS: readonly RegExp[] = [
	/[^\s@]+@[^\s@]+/g,
	/\b(?=[\w-]*\d)[\w-]{24,}/g,
	/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g,
	/\d(?:[\s-]?\d){5,}/g,
];

/**
 * Replaces anything that could identify a customer, or authenticate as one,
 * with an ellipsis.
 *
 * Two kinds of text pass through here: the Connect widget's step labels, which
 * are written in another codebase and reach Google's servers verbatim, and
 * ⌘K queries, which are whatever a visitor typed or pasted. Six digits is the
 * shortest phone, account, Aadhaar or transaction id; step names, product names
 * and amounts under a lakh have nothing that long.
 *
 * ponytail: pattern list, not a PII classifier. A name or an address survives —
 * that is why raw query text never goes to GTM, only to our own backend.
 * @param text - The text to scrub.
 * @returns The same text with identifiers replaced.
 */
export function redactIdentifiers(text: string): string {
	return IDENTIFIER_PATTERNS.reduce(
		(scrubbed, pattern) => scrubbed.replace(pattern, "…"),
		text,
	);
}

/**
 * Pushes an event to the Google Tag Manager dataLayer.
 *
 * The container is loaded from `index.html`; the optional chain covers one that
 * is blocked or not yet initialised, since a missing analytics tag is never a
 * reason to fail the thing being measured.
 * @param event - The GTM event name.
 * @param params - Event parameters, merged into the pushed object.
 */
export function pushDataLayer(
	event: string,
	params: Record<string, unknown>,
): void {
	window.dataLayer?.push({ event, ...params });
}
