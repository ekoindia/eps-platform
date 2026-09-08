/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Public UAT demo developer_key, prefilled into the docs "Test Request"
	 * dialog (inlined in production too — see lib/uat-credentials.ts). */
	readonly VITE_EPS_UAT_DEVELOPER_KEY?: string;
	/** Public UAT demo access_key; only ever an in-browser HMAC input. */
	readonly VITE_EPS_UAT_ACCESS_KEY?: string;
	/**
	 * Override for the Try-it proxy endpoint. Unset → `<VITE_EPS_BACKEND_URL or
	 * /api>/tryit/proxy` (eps-backend). See lib/docs/tryit-request.ts.
	 */
	readonly VITE_TRYIT_PROXY_URL?: string;
	/**
	 * Origin serving the Eko Connect widget bundle, e.g.
	 * `https://beta.ekoconnect.in`. Must match the environment
	 * `CONNECT_API_BASE_URL` points at on the backend — the widget's own API host
	 * is baked into its bundle, so a mismatch splits traffic across two backends
	 * while sharing one session.
	 */
	readonly VITE_CONNECT_WIDGET_URL?: string;
	/** Enable the embedded Connect transaction-flow widget in the console. */
	readonly VITE_SHOW_CONNECT_WIDGET?: string;
	/**
	 * Origin of the ekostore app the console rail links to for the KYC sandbox,
	 * e.g. `https://ekostore.app`. Unset or blank → `https://ekostore.app`. Must
	 * be backed by the same connect-api as this environment — the link carries a
	 * live access token.
	 */
	readonly VITE_EKOSTORE_URL?: string;
	/** Render the Business Dashboard widgets on `/console`. Off by default. */
	readonly VITE_SHOW_BUSINESS_DASHBOARD?: string;
	/**
	 * Offer the "Last 365 Days" window in the dashboard's picker. Local testing
	 * only — production caps the range at 30 days.
	 */
	readonly VITE_SHOW_DASHBOARD_LAST_365?: string;
	/**
	 * Poll `/notifications` for signed-in developers and show the header bell.
	 * Off by default — the shared EMS feed is authored for Eloka's retailers.
	 */
	readonly VITE_SHOW_NOTIFICATIONS?: string;
	/**
	 * Support contact channels for the strip at the bottom of `/console`. Each is
	 * optional and independent; unset or blank hides that channel, and all three
	 * unset hides the strip. Phone/WhatsApp are numbers (any punctuation), not
	 * links — e.g. `+91 951 318 1707`.
	 */
	readonly VITE_SUPPORT_EMAIL?: string;
	readonly VITE_SUPPORT_PHONE?: string;
	readonly VITE_SUPPORT_WHATSAPP?: string;
}
