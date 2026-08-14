/**
 * Reads the `next` query param as a safe in-app destination.
 *
 * Relative paths only: "https://evil.com", the protocol-relative "//evil.com"
 * and the browser-equivalent "/\evil.com" are open redirects and are rejected,
 * as is anything that isn't rooted at "/". Everything after the path (query,
 * hash) is preserved, so `?next=/console/transactions?tab=failed` works.
 *
 * @param search - `location.search`; the leading "?" is optional.
 */
export function readNextParam(search: string): string | null {
	const raw = new URLSearchParams(search).get("next");
	if (!raw || !raw.startsWith("/")) return null;
	if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
	return raw;
}
