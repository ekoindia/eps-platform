declare global {
	interface Window {
		dataLayer?: unknown[];
	}
}

/**
 * Replaces long digit runs with an ellipsis.
 *
 * Analytics text that originates outside this codebase — the Connect widget's
 * own step labels, say — reaches Google's servers verbatim, so anything that
 * could be a phone number, account number, Aadhaar or transaction id is removed
 * before it leaves. Six digits is the shortest of those; step names and product
 * names have nothing that long.
 *
 * ponytail: digit runs only. A PAN (`ABCDE1234F`) or an email would survive —
 * neither has ever appeared in a breadcrumb. Widen the pattern if one does.
 * @param text - The text to scrub.
 * @returns The same text with long digit runs replaced.
 */
export function redactIdentifiers(text: string): string {
	return text.replace(/\d{6,}/g, "…");
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
