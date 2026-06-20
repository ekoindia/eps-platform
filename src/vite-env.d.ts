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
}
