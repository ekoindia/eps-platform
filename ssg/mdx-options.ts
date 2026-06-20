import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

/**
 * Shared @mdx-js/rollup options, used by both the client build (vite.config)
 * and the prerender inner SSR server (ssg/plugin) so MDX compiles identically
 * in every context. GFM for tables/strikethrough; slugged + self-linking
 * headings for deep-linkable guides.
 */
export const mdxOptions = {
	// Always compile against the stable automatic JSX runtime (`jsx`/`jsxs`),
	// never the dev runtime (`jsxDEV`). The prerender's inner SSR server runs in
	// Vite "dev" mode but has no `react/jsx-dev-runtime` wired, so dev-runtime
	// output renders MDX to nothing there. The stable runtime works everywhere.
	development: false,
	remarkPlugins: [remarkGfm],
	rehypePlugins: [
		rehypeSlug,
		[rehypeAutolinkHeadings, { behavior: "wrap" }] as const,
	],
};
