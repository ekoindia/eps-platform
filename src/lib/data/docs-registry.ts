/**
 * Developer docs registry — the single, SSR/Node-safe source of truth that
 * unifies MDX guides and API endpoints into one navigable doc tree.
 *
 * Everything here is pure data derived from the existing spec layer
 * (`api-specs.ts` + `api-products.ts`) and guide metadata (`docs-guides.ts`).
 * It deliberately imports NO `.mdx` and NO React, so it can be loaded by
 * `ssg/routes.ts` (route enumeration) and unit tests without the MDX toolchain.
 *
 * URL model: `/docs` (overview, handled by the index page) and a FLAT
 * `/docs/<slug>` namespace shared by guides and endpoints. Endpoint slug is
 * `spec.slug` (no method prefix); the HTTP method is surfaced via the nav tag,
 * not the URL. Because the namespace is flat, {@link assertNoSlugCollisions}
 * runs at module load and fails the build/tests on any duplicate or reserved
 * slug.
 */
import { ACTIVE_PRODUCTS_MAP, API_PRODUCTS } from "./api-products";
import type { ApiProductCategory } from "./api-products";
import { API_SPECS, getSpecsForProduct } from "./api-specs";
import { categoryForSpec } from "./api-specs-common";
import type { ApiSpec } from "./api-specs-common";
import { GUIDES, type GuideMeta } from "@/content/docs/docs-guides";

/** URL section segment under which all docs pages live. */
export const DOCS_SECTION_SLUG = "docs";

/** Site-relative path for a docs page; no slug → the `/docs` overview. */
export const docsHref = (slug?: string): string =>
	slug ? `/${DOCS_SECTION_SLUG}/${slug}` : `/${DOCS_SECTION_SLUG}`;

/** The three product categories, in canonical nav order. */
export type DocCategory = ApiProductCategory;

export const CATEGORY_ORDER: DocCategory[] = ["bc", "payment", "verification"];

export const CATEGORY_TITLES: Record<DocCategory, string> = {
	bc: "Banking & Cash",
	payment: "Payments",
	verification: "Verification",
};

/**
 * Slugs that must never be produced by a guide or endpoint because they are
 * reserved for the section root, the public OpenAPI artifact, or hosting
 * assets. A collision with any of these throws at module load.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
	"",
	"docs",
	"openapi",
	"openapi.json",
	"api",
	"assets",
	"index",
]);

export type DocKind = "guide" | "endpoint";

/** A single addressable `/docs/<slug>` page (guide or endpoint). */
export interface DocNode {
	slug: string;
	kind: DocKind;
	title: string;
	summary?: string;
	// endpoint-only
	spec?: ApiSpec;
	method?: ApiSpec["method"];
	category?: DocCategory;
	productId?: string;
	productName?: string;
	// guide-only
	guide?: GuideMeta;
}

/** Canonical `/docs/<slug>` slug for an API endpoint (no method prefix). */
export const endpointSlug = (spec: ApiSpec): string => spec.slug;

/** `-status` specs are async-job pollers — hidden from the docs entirely. */
const isStatusSpec = (spec: ApiSpec): boolean => spec.id.endsWith("-status");

/**
 * Specs that get a docs page: non-`-status`, belonging to an active (non
 * disabled) product. Other consumers should derive from this, not `API_SPECS`.
 */
export const getDocumentedSpecs = (): ApiSpec[] =>
	API_SPECS.filter(
		(spec) =>
			!isStatusSpec(spec) && Boolean(ACTIVE_PRODUCTS_MAP[spec.productId]),
	);

const toEndpointNode = (spec: ApiSpec): DocNode => ({
	slug: endpointSlug(spec),
	kind: "endpoint",
	title: spec.name,
	summary: spec.summary,
	spec,
	method: spec.method,
	category: categoryForSpec(spec),
	productId: spec.productId,
	productName: ACTIVE_PRODUCTS_MAP[spec.productId]?.name,
});

const toGuideNode = (guide: GuideMeta): DocNode => ({
	slug: guide.slug,
	kind: "guide",
	title: guide.title,
	summary: guide.summary,
	guide,
});

/** All `/docs/<slug>` nodes: guides (by `order`) followed by endpoints. */
export const buildDocNodes = (): DocNode[] => {
	const guideNodes = [...GUIDES]
		.sort((a, b) => a.order - b.order)
		.map(toGuideNode);
	const endpointNodes = getDocumentedSpecs().map(toEndpointNode);
	return [...guideNodes, ...endpointNodes];
};

/**
 * Throws if any node's slug is reserved or collides with another (comparison
 * is case-insensitive — filesystems and URLs are not reliably case-sensitive).
 */
export const assertNoSlugCollisions = (nodes: DocNode[]): void => {
	const seen = new Map<string, DocNode>();
	for (const node of nodes) {
		const key = node.slug.toLowerCase();
		if (RESERVED_SLUGS.has(key)) {
			throw new Error(
				`docs-registry: slug "${node.slug}" (${node.kind} "${node.title}") is reserved.`,
			);
		}
		const prior = seen.get(key);
		if (prior) {
			throw new Error(
				`docs-registry: duplicate slug "${node.slug}" — ${prior.kind} "${prior.title}" vs ${node.kind} "${node.title}".`,
			);
		}
		seen.set(key, node);
	}
};

// Built once at module load; the guard fails fast on a bad slug.
const DOC_NODES: DocNode[] = buildDocNodes();
assertNoSlugCollisions(DOC_NODES);

const DOC_NODE_MAP: Map<string, DocNode> = new Map(
	DOC_NODES.map((node) => [node.slug, node]),
);

/** All addressable docs slugs (guides + endpoints) — consumed by `ssg/routes.ts`. */
export const getAllDocSlugs = (): string[] => DOC_NODES.map((n) => n.slug);

/** All doc nodes (guides + endpoints). */
export const getAllDocNodes = (): DocNode[] => DOC_NODES;

/** Resolve a `/docs/<slug>` page, or `undefined` for an unknown slug. */
export const getDocBySlug = (slug: string): DocNode | undefined =>
	DOC_NODE_MAP.get(slug);

// ---------------------------------------------------------------------------
// Nav tree — Guides group, then category → product → endpoints
// ---------------------------------------------------------------------------

export interface NavEndpoint {
	slug: string;
	title: string;
	method: ApiSpec["method"];
}

export interface NavProductGroup {
	productId: string;
	name: string;
	endpoints: NavEndpoint[];
}

export interface NavCategoryGroup {
	category: DocCategory;
	title: string;
	products: NavProductGroup[];
}

export interface NavGuideLink {
	slug: string;
	title: string;
}

export interface DocsNav {
	guides: NavGuideLink[];
	categories: NavCategoryGroup[];
}

/** Build the left-nav tree: Guides first, then API categories → products. */
export const buildNavTree = (): DocsNav => {
	const guides: NavGuideLink[] = [...GUIDES]
		.sort((a, b) => a.order - b.order)
		.map((g) => ({ slug: g.slug, title: g.title }));

	const categories: NavCategoryGroup[] = CATEGORY_ORDER.map((category) => {
		const products: NavProductGroup[] = API_PRODUCTS.filter(
			(p) => p.category === category && Boolean(ACTIVE_PRODUCTS_MAP[p.id]),
		)
			.map((product) => {
				const endpoints = getSpecsForProduct(product.id)
					.filter((spec) => !isStatusSpec(spec))
					.map((spec) => ({
						slug: endpointSlug(spec),
						title: spec.name,
						method: spec.method,
					}));
				return { productId: product.id, name: product.name, endpoints };
			})
			.filter((group) => group.endpoints.length > 0);

		return { category, title: CATEGORY_TITLES[category], products };
	}).filter((group) => group.products.length > 0);

	return { guides, categories };
};
