# Navigation, Routing & Left-Menu Categories

The docs registry (`src/lib/data/docs-registry.ts`) is the single SSR/Node-safe
module that unifies MDX guides and API endpoints into one navigable tree. It
imports **no React and no `.mdx`**, so `ssg/routes.ts` and unit tests can load it
without the MDX toolchain. Everything below — URL model, slug guard, left menu,
prerender list — comes out of this one file.

## URL model

A flat namespace:

- `/docs` — the overview (handled by `DocsIndexPage`).
- `/docs/<slug>` — every guide *and* every endpoint share this one namespace
  (handled by `DocDetailPage`).

The HTTP method is **not** in the URL. An endpoint's slug is just `spec.slug`
(`endpointSlug()` returns it unchanged); the method is surfaced via the nav tag
and the detail-page method tag instead.

```typescript
export const DOCS_SECTION_SLUG = "docs";
export const docsHref = (slug?: string): string =>
	slug ? `/${DOCS_SECTION_SLUG}/${slug}` : `/${DOCS_SECTION_SLUG}`;
```

Routes are registered in `src/App.tsx`:

```tsx
<Route path="/docs" element={<DocsIndexPage />} />
<Route path="/docs/:slug" element={<DocDetailPage />} />
```

## Doc nodes & the slug-collision guard

`buildDocNodes()` produces a flat `DocNode[]`: guides first (sorted by `order`),
then endpoints. `getDocumentedSpecs()` decides which specs get a page — any spec
belonging to an **active (non-disabled) product**, including `-status` pollers:

```typescript
export const getDocumentedSpecs = (): ApiSpec[] =>
	API_SPECS.filter((spec) => Boolean(ACTIVE_PRODUCTS_MAP[spec.productId]));
```

> `-status` specs are async-job pollers — real endpoints, shown in the docs. They
> are hidden **only** on the marketing surface: the product detail pages
> (`getDisplaySpecsForProduct` in api-spec-previews) and the product `.md` twin
> tree (`productNavNodes`), so marketing isn't cluttered with the obvious status
> companion of each bulk/async API.

Because the namespace is flat, a guide slug and an endpoint slug could in theory
collide. `assertNoSlugCollisions()` runs **at module load** and throws on any
duplicate (case-insensitive) or any `RESERVED_SLUGS` hit
(`"", "docs", "openapi", "openapi.json", "api", "assets", "index"`). A bad slug
fails the build and the tests, not production.

```typescript
const DOC_NODES: DocNode[] = buildDocNodes();
assertNoSlugCollisions(DOC_NODES);          // fails fast
const DOC_NODE_MAP = new Map(DOC_NODES.map((n) => [n.slug, n]));

export const getAllDocSlugs = (): string[] => DOC_NODES.map((n) => n.slug);
export const getDocBySlug = (slug: string) => DOC_NODE_MAP.get(slug);
```

`getAllDocSlugs()` feeds the SSG prerender list (see
[layout-ssg-theming.md](layout-ssg-theming.md)); `getDocBySlug()` powers
`DocDetailPage`.

## How the left-menu categories are built

`buildNavTree()` constructs the sidebar. The shape is **Guides first, then
category → product → endpoint**:

```
Overview                    (link to /docs)
Guides                      (group, only if any guides)
  ├ Quickstart
  ├ How Auth Works
  └ Error Codes
Banking & Cash              (category: bc)
  ├ DMT                     (product)
  │   ├ Get Sender Profile  (endpoint, with GET/POST tag)
  │   └ Transfer Money
  └ AePS                    (single-endpoint product → flattened)
Payments                    (category: payment)
Verification                (category: verification)
```

```typescript
export const buildNavTree = (): DocsNav => {
	const guides = [...GUIDES].sort((a, b) => a.order - b.order)
		.map((g) => ({ slug: g.slug, title: g.title }));

	const categories = CATEGORY_ORDER.map((category) => {
		const products = API_PRODUCTS
			.filter((p) => p.category === category && Boolean(ACTIVE_PRODUCTS_MAP[p.id]))
			.map((product) => {
				const endpoints = getSpecsForProduct(product.id)
					.filter((spec) => !isStatusSpec(spec))
					.map((spec) => ({ slug: endpointSlug(spec), title: spec.name, method: spec.method }));
				return { productId: product.id, name: product.name, endpoints };
			})
			.filter((group) => group.endpoints.length > 0);
		return { category, title: CATEGORY_TITLES[category], products };
	}).filter((group) => group.products.length > 0);

	return { guides, categories };
};
```

What governs the menu:

- **Category order** — `CATEGORY_ORDER = ["bc", "payment", "verification"]`, titled
  via `CATEGORY_TITLES`.
- **Product membership & order** — `API_PRODUCTS` filtered to the category and to
  active products; disabled products vanish from the menu automatically.
- **Endpoint order within a product** — `getSpecsForProduct()` sorts by relevance
  H → M → L (see [single-source-of-truth.md](single-source-of-truth.md)).
- **Empty pruning** — products with zero visible endpoints, and categories with
  zero products, are dropped (the trailing `.filter`s).

## Rendering the tree: `DocsNavTree`

`src/components/docs/DocsNavTree.tsx` renders the `DocsNav` data:

- **Single-endpoint flattening** — if a product has exactly one endpoint, the
  product sub-heading is skipped and the endpoint sits directly under its
  category, avoiding redundant "Passport Verification › Passport Verification"
  nesting.
- **Active state** — the current route's link is tinted (`bg-eko-gold-light` in
  light mode, `bg-eko-gold/15` in dark).
- **Method tags** — inactive endpoint links show their HTTP method (GET, POST, …).

## Route-parity tests

`docs-registry.test.ts` locks the invariants so the nav, routes, and data can't
drift:

- `getAllDocSlugs()` equals guides + documented endpoints — no dupes, no extras.
- every nav link resolves to a routable slug;
- `-status` specs of active products appear in the nav (hidden only on the
  marketing product surface);
- round-trip (`slug → getDocBySlug → slug`) holds for every documented endpoint.
</content>
