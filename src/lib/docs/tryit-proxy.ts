/**
 * CORS proxy resolution for the docs "Try it" modal.
 *
 * The Scalar API-client modal routes sandbox requests through a proxy so the
 * browser is not blocked by CORS. We default to Scalar's hosted proxy; it can be
 * pointed at a self-hosted proxy or disabled entirely via an env var.
 *
 *   VITE_SCALAR_PROXY_URL unset        → hosted default (proxy on)
 *   VITE_SCALAR_PROXY_URL="<url>"      → that proxy
 *   VITE_SCALAR_PROXY_URL="" (blank)   → proxy disabled (direct request; may CORS-fail)
 */

/** Scalar's hosted CORS proxy — the default when the env var is unset. */
export const DEFAULT_SCALAR_PROXY_URL = "https://proxy.scalar.com";

/**
 * Resolve the proxy URL for the Try-it modal.
 *
 * Distinguishes "unset" (→ hosted default) from an explicit empty string
 * (→ disabled), which is the whole point of the toggle.
 */
export const resolveTryItProxyUrl = (): string | undefined => {
	const configured = import.meta.env.VITE_SCALAR_PROXY_URL;
	if (configured === undefined) return DEFAULT_SCALAR_PROXY_URL;
	const trimmed = configured.trim();
	return trimmed === "" ? undefined : trimmed;
};
