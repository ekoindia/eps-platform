import { authClient, type ConnectTokenView } from "@/lib/auth/client";

/**
 * The `sessionStorage` keys the Connect widget reads.
 *
 * This is a contract with someone else's bundle, not a choice: the widget's
 * `TfApiBehavior._getAPIDefaultHeaders` calls `sessionStorage.getItem` with
 * these exact names. Renaming them silently un-authenticates every flow.
 *
 * `access_token` (the full-scope token) is deliberately absent — no call site in
 * the widget passes the `fulltoken` flag that would read it, so writing lite is
 * enough and the full token never has to enter the browser.
 */
const LITE_KEY = "access_token_lite";
const CRM_KEY = "access_token_crm";

/**
 * How far ahead of expiry a token is considered spent. Covers the widget's own
 * in-flight requests: a token fetched at expiry-minus-nothing can still be
 * rejected by the time it is used.
 */
const EXPIRY_SKEW_MS = 60_000;

// ponytail: this tab, this session. Cleared on sign-out by AuthProvider and on
// widget unmount. Not shared across tabs — each mounts its own widget and each
// fetch is cheap.
let current: ConnectTokenView | null = null;
let inflight: Promise<ConnectTokenView> | null = null;

/** Writes the tokens where the widget looks for them. */
function write(view: ConnectTokenView): void {
	sessionStorage.setItem(LITE_KEY, view.accessTokenLite);
	// Absent CRM token: remove rather than store "null". The widget's guard is
	// `"undefined" !== value && value`, so the string "null" would sail through
	// it and be sent as `Bearer null`.
	if (view.accessTokenCrm) sessionStorage.setItem(CRM_KEY, view.accessTokenCrm);
	else sessionStorage.removeItem(CRM_KEY);
}

/**
 * Makes sure the widget has a usable token in `sessionStorage`, fetching one if
 * the cached one is missing or close to expiry. Concurrent callers share a
 * single request.
 * @returns The tokens now in storage.
 */
export function ensureConnectTokens(): Promise<ConnectTokenView> {
	if (current && Date.now() < current.expiresAt - EXPIRY_SKEW_MS) {
		// Re-write rather than trust storage: another tab or a stray clear could
		// have emptied it while this module still held the value.
		write(current);
		return Promise.resolve(current);
	}
	inflight ??= authClient
		.connectToken()
		.then((view) => {
			write(view);
			current = view;
			return view;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Removes the widget's credentials from `sessionStorage`.
 *
 * Called on widget unmount and whenever the session goes anon, so the tokens are
 * present only while something is actually using them.
 */
export function clearConnectTokens(): void {
	current = null;
	inflight = null;
	if (typeof sessionStorage === "undefined") return;
	sessionStorage.removeItem(LITE_KEY);
	sessionStorage.removeItem(CRM_KEY);
}
