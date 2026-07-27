import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Prefixes the widget emits that mean "somewhere in this app":
 * the app's own origin, Connect's web host, and its mobile deep-link scheme.
 */
const INTERNAL_PREFIXES =
	/^(?:(?:https?:)?\/\/(?:connect\.eko\.in|(?:[a-z0-9-]+\.)*ekoconnect\.in)|ekoconnect:\/\/)/i;

/**
 * True when a URL has no scheme and no leading hostname, i.e. it is a path on
 * this app rather than somewhere else. Mirrors Eloka's classifier: anything with
 * `https:`, `tel:`, `upi:`, `mailto:` … or a leading `www.` is external.
 */
function isInternalPath(url: string): boolean {
	return !/^(?:[-_a-z]+:|[a-z0-9-]+\.)/i.test(url);
}

/**
 * Normalizes a link the Connect widget asked to open.
 *
 * Strips the host prefixes above and Polymer's `/#!` hashbang, so
 * `https://connect.eko.in/#!/transaction/491` and `ekoconnect://transaction/491`
 * both collapse to `/transaction/491`.
 * @param raw - The URL as the widget emitted it.
 * @param origin - This app's origin, stripped when the widget echoes it back.
 * @returns The normalized URL, and whether it is internal to this app.
 */
export function normalizeWidgetUrl(
	raw: string,
	origin: string,
): { url: string; internal: boolean } {
	let url = raw.trim();
	if (origin && url.toLowerCase().startsWith(origin.toLowerCase())) {
		url = url.slice(origin.length);
	}
	url = url.replace(INTERNAL_PREFIXES, "");
	url = url.replace(/^\/?#!/, "");
	if (!isInternalPath(url)) return { url, internal: false };
	return { url: url.startsWith("/") ? url : `/${url}`, internal: true };
}

/**
 * Opens a URL the way the widget means it: internal paths route in-app,
 * everything else opens in a new tab.
 */
export function useAppLink(): { openUrl: (raw: string) => void } {
	const navigate = useNavigate();

	const openUrl = useCallback(
		(raw: string) => {
			if (!raw) return;
			const { url, internal } = normalizeWidgetUrl(raw, window.location.origin);
			if (internal) {
				navigate(url);
				return;
			}
			// `noopener,noreferrer`: the opened page must not get a handle on this
			// one via `window.opener`, and these URLs come from flow config we do not
			// own.
			window.open(url, "_blank", "noopener,noreferrer");
		},
		[navigate],
	);

	return { openUrl };
}
