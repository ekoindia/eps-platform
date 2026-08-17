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

/**
 * Origin of the ekostore app the console rail hands the user off to, for the KYC
 * & verification sandbox. Must be the ekostore deployment backed by the same
 * connect-api as this environment: the link carries a live access token, and a
 * token minted here is worthless — or worse, spent — at a different backend.
 *
 * `||` rather than `??`: a blank `VITE_EKOSTORE_URL=` in a `.env` file reaches
 * here as `""`, which `new URL()` would throw on.
 */
export const EKOSTORE_URL: string =
	import.meta.env.VITE_EKOSTORE_URL || "https://ekostore.app";

/**
 * When true, `/console` renders the Business Dashboard below the Next Steps
 * card — the window picker and every widget under it. When false (the default),
 * Home is the Next Steps card plus the lifecycle state, and nothing calls
 * `/dashboard` at all.
 *
 * Flip to `true` (`VITE_SHOW_BUSINESS_DASHBOARD=true`) only once the numbers on
 * that page have been reconciled against Eloka for a real account — see the
 * status banner in `docs/features/business-dashboard.md`, which still records a
 * blank Usage Analytics dataset. A partner reads these totals as their own
 * revenue, so a wrong one is worse than none.
 */
export const SHOW_BUSINESS_DASHBOARD: boolean =
	import.meta.env.VITE_SHOW_BUSINESS_DASHBOARD === "true";

/**
 * When true, the dashboard's window picker offers "Last 365 Days" beside the
 * shorter windows. When false (the default), 30 days is the widest window a
 * partner can ask for.
 *
 * Local testing only (`VITE_SHOW_DASHBOARD_LAST_365=true`). A year of upstream
 * aggregation is a slow, expensive query for interaction 682, and production
 * caps the range deliberately. This hides the control and nothing else: the
 * backend still accepts `last365` and `dashboardRange.ts` still computes it, so
 * the range maths and its tests are untouched by the cap.
 */
export const SHOW_DASHBOARD_LAST_365: boolean =
	import.meta.env.VITE_SHOW_DASHBOARD_LAST_365 === "true";

/**
 * When true, a signed-in developer's session polls `/notifications` every ten
 * minutes and the header grows a bell; `/console` also gets a notifications
 * card. When false (the default), nothing calls the endpoint at all.
 *
 * Flip to `true` (`VITE_SHOW_NOTIFICATIONS=true`) only once interaction 10010
 * has been checked on production connect-api FOR A REAL DEVELOPER ACCOUNT. The
 * notification feed this reads is Eko's shared EMS, and the content authored
 * there today is aimed at Eloka's retailers ("Earn with AePS", cashout promos).
 * The backend serves only `notification_type: 0` and drops every ad, but a
 * retailer-flavoured announcement can still be published as a plain one — so
 * what needs confirming is the CONTENT, not just that the call succeeds.
 */
export const SHOW_NOTIFICATIONS: boolean =
	import.meta.env.VITE_SHOW_NOTIFICATIONS === "true";
