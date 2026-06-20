# MDX Guides

Alongside the spec-driven API references, the portal ships hand-written prose
guides authored in MDX: **Quickstart**, **How Auth Works**, and **Error Codes**.
They live in the same `/docs/<slug>` namespace as endpoints and appear in the
"Guides" group at the top of the left nav.

## Where the files live

- `src/content/docs/quickstart.mdx`
- `src/content/docs/how-auth-works.mdx`
- `src/content/docs/error-codes.mdx`

The `.mdx` filename stem **must** equal the guide's `slug`.

## Two registries, deliberately split

Guide metadata and guide components are kept in **separate** files so that the
metadata stays loadable by Node (no `.mdx` import in the dependency graph) for SSG
route enumeration and tests.

**Metadata — `src/content/docs/docs-guides.ts`** (Node-safe, no `.mdx`):

```typescript
export const GUIDES: GuideMeta[] = [
	{ slug: "quickstart",     title: "Quickstart",     order: 1, summary: "…" },
	{ slug: "how-auth-works", title: "How Auth Works", order: 2, summary: "…" },
	{ slug: "error-codes",    title: "Error Codes",    order: 3, summary: "…" },
];
```

`GuideMeta` fields: `slug` (kebab-case, matches the `.mdx`), `title`, `order`
(sort order within the Guides group), `summary` (nav/SEO), optional `group`.
This is what `docs-registry.ts` imports to build guide `DocNode`s and nav links —
**not** the components.

**Components — `src/content/docs/docs-guide-components.tsx`** (imports the `.mdx`):

```typescript
export const GUIDE_COMPONENTS: Record<string, ComponentType<…>> = {
	quickstart: Quickstart,
	"how-auth-works": HowAuthWorks,
	"error-codes": ErrorCodes,
};
```

Imports are **eager, not lazy**, so the server and client render the same tree
during hydration (a lazy import would risk a hydration mismatch).

## Rendering: `MdxGuide`

`src/components/docs/MdxGuide.tsx` looks up the compiled component by slug and
wraps it in Tailwind Typography prose styling, inverting under the docs-local dark
mode:

```tsx
export const MdxGuide = ({ slug }: { slug: string }) => {
	const Guide = GUIDE_COMPONENTS[slug];
	if (!Guide) return null;
	return (
		<div className="prose prose-slate max-w-none dark:prose-invert …">
			<Guide />
		</div>
	);
};
```

`DocDetailPage` renders `<MdxGuide>` with **no right pane** (guides have no code
sample rail).

## MDX toolchain config

The Vite MDX plugin runs with `enforce: "pre"` so `.mdx` → JS happens before the
React plugin (`vite.config.ts`):

```typescript
{ enforce: "pre", ...mdx(mdxOptions) },
```

Options (`ssg/mdx-options.ts`):

```typescript
export const mdxOptions = {
	development: false,                       // always the stable JSX runtime
	remarkPlugins: [remarkGfm],               // GFM tables / strikethrough
	rehypePlugins: [
		rehypeSlug,                           // id="" on headings
		[rehypeAutolinkHeadings, { behavior: "wrap" }],
	],
};
```

## Frontmatter

There is **no YAML frontmatter** in the `.mdx` files. All metadata (title, order,
summary, slug) lives in `GuideMeta` in `docs-guides.ts`. Keeping it out of the MDX
is what lets the registry and SSG read guide metadata without parsing or compiling
MDX.

## Adding a guide

1. Create `src/content/docs/<slug>.mdx`.
2. Add a `GuideMeta` entry to `GUIDES` in `docs-guides.ts` (set `order`).
3. Register the component in `GUIDE_COMPONENTS` in `docs-guide-components.tsx`.
4. The registry picks it up automatically — it gets a `/docs/<slug>` route, a
   prerendered HTML file, and a left-nav entry. The slug guard rejects collisions
   and reserved slugs at build time.
</content>
