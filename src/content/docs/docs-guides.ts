/**
 * Guide metadata for the developer docs section — METADATA ONLY.
 *
 * This file is intentionally free of any `.mdx` imports so it stays
 * Node-loadable (consumed by `docs-registry.ts`, `ssg/routes.ts`, and unit
 * tests) without pulling the MDX toolchain into those contexts. The compiled
 * MDX components live separately in `docs-guide-components.tsx` and are only
 * reachable from the (lazy, client) docs detail page.
 *
 * Each entry's `slug` MUST match its `.mdx` filename (kebab-case) and is the
 * `/docs/<slug>` route. Guide slugs share the flat docs namespace with API
 * endpoint slugs, so the collision guard in `docs-registry.ts` is load-bearing.
 */

/** Display + ordering metadata for a single MDX guide. */
export interface GuideMeta {
	/** Kebab-case slug; equals the `.mdx` filename and the `/docs/<slug>` route. */
	slug: string;
	title: string;
	/** Sort order within the Guides nav group (ascending). */
	order: number;
	summary: string;
	/** Optional sub-grouping label within the Guides section. */
	group?: string;
}

/**
 * Authored guides. Empty until the MDX pipeline lands (phase P5); endpoints
 * ship first. Keep in sync with the `.mdx` files in this directory and the
 * eager component map in `docs-guide-components.tsx`.
 */
export const GUIDES: GuideMeta[] = [
	{
		slug: "quickstart",
		title: "Quickstart",
		order: 1,
		summary: "From zero to your first verified API call in minutes.",
	},
	{
		slug: "how-auth-works",
		title: "How Auth Works",
		order: 2,
		summary:
			"Keys, request signing, and the per-request HMAC secret-key + request_hash.",
	},
	{
		slug: "error-codes",
		title: "Error Codes",
		order: 3,
		summary:
			"HTTP status codes, transaction status ids, and the response envelope.",
	},
];
