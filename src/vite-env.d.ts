/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** UAT/sandbox developer_key — DEV-only prefill for the docs "Try it" modal. */
	readonly VITE_EPS_UAT_DEVELOPER_KEY?: string;
	/** UAT/sandbox access_key — DEV-only prefill; used for local HMAC signing. */
	readonly VITE_EPS_UAT_ACCESS_KEY?: string;
	/**
	 * CORS proxy for the docs "Try it" modal. Unset → Scalar's hosted proxy;
	 * empty string → proxy disabled (direct request). See lib/docs/tryit-proxy.ts.
	 */
	readonly VITE_SCALAR_PROXY_URL?: string;
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
}
