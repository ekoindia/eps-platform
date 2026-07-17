/**
 * E-sign provider mechanics for the Sign Agreement step.
 *
 * Web-only port of wlc-webapp's `services/esign` — the Android bridge and pubsub
 * paths are intentionally dropped (this site never runs in the Android wrapper).
 * Two provider shapes are supported, selected by the upstream `pipe` value:
 *
 *  - Leegality (3) / Karza (1, reuses the same SDK): the self-hosted
 *    `leegalityv5.min.js` exposes `window.Leegality`, which opens the signing
 *    modal and reports the outcome through its `callback`.
 *  - Everything else (Signzy = 2, DigiO = 0, unknown): a plain `window.open`
 *    popup. These have no SDK callback — success arrives only as a
 *    `postMessage({ type: "STATUS_UPDATE" })` from the signing page, which the
 *    caller listens for (see `SignAgreementStep`).
 */

/** Upstream `pipe` values that mean "use the Leegality SDK". */
const LEEGALITY_PIPES = new Set([1, 3]);

const SCRIPT_ID = "leegality-sdk";
// Vendored from wlc-webapp/public/scripts/leegalityv5.min.js (Leegality v5 loader,
// 2.6KB). Self-hosted so it loads under the site's own `script-src 'self'`.
const SCRIPT_SRC = "/scripts/leegalityv5.min.js";

declare global {
	interface Window {
		Leegality?: new (opts: {
			callback: (res: {
				error?: string;
				documentId?: string;
				document_id?: string;
			}) => void;
			logo?: string;
		}) => { init: () => void; esign: (url: string) => void };
	}
}

/** The outcome of a signing attempt, normalized across providers. */
export interface EsignOutcome {
	documentId?: string;
	error?: string;
}

/** True when this `pipe` is driven by the Leegality SDK (vs a plain popup). */
export function usesLeegality(pipe: number): boolean {
	return LEEGALITY_PIPES.has(pipe);
}

/** Loads the self-hosted Leegality SDK once; resolves immediately if present. */
function loadLeegality(): Promise<void> {
	if (window.Leegality || document.getElementById(SCRIPT_ID)) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.id = SCRIPT_ID;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load the signing SDK."));
		document.body.appendChild(script);
	});
}

/**
 * The `postMessage` origin to trust for popup-provider completion, derived from
 * the signing URL itself (never a wildcard). Returns null if `shortUrl` has no
 * parseable origin, in which case the caller should not trust any message.
 */
export function esignOrigin(shortUrl: string): string | null {
	try {
		return new URL(shortUrl).origin;
	} catch {
		return null;
	}
}

/**
 * Opens the signing provider for `shortUrl`.
 *
 * For Leegality/Karza the SDK reports back through `onOutcome`. For popup
 * providers this only opens the window — completion arrives via the caller's
 * `STATUS_UPDATE` listener, so `onOutcome` is not called here (a blocked popup
 * surfaces as `{ error }`).
 *
 * @param shortUrl - The provider signing URL from interaction 287.
 * @param pipe - Provider id selecting the flow.
 * @param onOutcome - Called with the SDK result (Leegality) or a popup-blocked error.
 */
export async function openEsign(
	shortUrl: string,
	pipe: number,
	onOutcome: (outcome: EsignOutcome) => void,
): Promise<void> {
	if (usesLeegality(pipe)) {
		try {
			await loadLeegality();
		} catch (e) {
			onOutcome({
				error: e instanceof Error ? e.message : "SDK failed to load.",
			});
			return;
		}
		if (!window.Leegality) {
			onOutcome({ error: "The signing SDK is unavailable. Please retry." });
			return;
		}
		const leegality = new window.Leegality({
			callback: (res) =>
				onOutcome(
					res.error
						? { error: res.error }
						: { documentId: res.documentId || res.document_id },
				),
		});
		leegality.init();
		leegality.esign(shortUrl);
		return;
	}

	// Popup providers: window.open, then wait for the page's STATUS_UPDATE.
	const win = window.open(shortUrl, "SignAgreementWindow");
	if (!win) {
		onOutcome({ error: "Please allow pop-ups to sign the agreement." });
	}
}
