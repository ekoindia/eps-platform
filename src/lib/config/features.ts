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
