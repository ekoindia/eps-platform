/** When true, surface the user Log in / Console entry points in header + footer. */
export const SHOW_USER_LOGIN: boolean =
	import.meta.env.VITE_SHOW_USER_LOGIN === "true";

/**
 * When true, market EPS-Transact-MCP: the "AI Tools" nav becomes a dropdown
 * ("Build with AI" + "For AI agents"), the `/agents` page is prerendered and
 * listed in llms.txt, and the `/ai` page shows a cross-link. When false (the
 * default), "AI Tools" stays a single direct link to `/ai`, and `/agents`
 * exists only as an unlinked, unindexed client route — safe to preview.
 *
 * Flip to `true` (set `VITE_SHOW_TRANSACT_MCP=true`) only once the transactional
 * MCP server is deployed to production and smoke-tested. This flag is read at
 * build time; it also resolves during SSG prerender + llms.txt generation
 * because those modules are loaded through Vite's SSR loader.
 */
export const SHOW_TRANSACT_MCP: boolean =
	import.meta.env.VITE_SHOW_TRANSACT_MCP === "true";

/**
 * When true, the console can render Eko Connect transaction flows inline: the
 * E-value card grows a "＋" that opens the Load-E-value flow, and
 * `/console/transaction/:startId` mounts the widget.
 *
 * Keep false until connect-api's CORS allowlist includes this origin — the
 * widget calls it directly from the browser, using an API host baked into its
 * own bundle, so a missing entry fails every request with no way to fix it from
 * here. Requires `CONNECT_API_BASE_URL` on the backend too; without it the
 * `/connect/*` routes are not mounted at all.
 */
export const SHOW_CONNECT_WIDGET: boolean =
	import.meta.env.VITE_SHOW_CONNECT_WIDGET === "true";

/**
 * Origin serving the Connect widget bundle. Must point at the same environment
 * as the backend's `CONNECT_API_BASE_URL`: the widget's API host is compiled
 * into its own bundle, so a beta widget against a production backend would spend
 * one environment's token at the other.
 */
export const CONNECT_WIDGET_URL: string =
	import.meta.env.VITE_CONNECT_WIDGET_URL ?? "";
