/**
 * Deterministic route manifest for static pre-rendering.
 *
 * This is the single source of truth for which routes get pre-rendered
 * at build time. Adding or removing a route here is all that's needed.
 */
import { hasProductPage } from "@/lib/data/api-product-pages";
import { getActiveProducts, productHref } from "@/lib/data/api-products";
import { docsHref, getAllDocSlugs } from "@/lib/data/docs-registry";
import { INDUSTRIES_LIST } from "@/lib/data/industries";
import { SOLUTIONS_LIST } from "@/lib/data/solutions";

/**
 * Maps route URL patterns to their React page component source paths.
 * Used at build time to inject <link rel="modulepreload"> for each page's
 * lazy chunk, eliminating the waterfall between the main bundle and the
 * route-specific chunk. Entries are matched in order; more-specific
 * patterns must come first.
 */
export const ROUTE_CHUNK_MAP: Array<{ pattern: RegExp; src: string }> = [
	// Static product routes must precede the dynamic :slug catch-all
	// { pattern: /^\/products\/eko-shield$/, src: "src/pages/EkoShieldPage.tsx" },
	{ pattern: /^\/products$/, src: "src/pages/ProductsPage.tsx" },
	{
		pattern: /^\/products\//,
		src: "src/pages/products/ProductDetailPage.tsx",
	},
	// Industries
	{
		pattern: /^\/industries\/[^/]+$/,
		src: "src/pages/IndustryDetailPage.tsx",
	},
	{ pattern: /^\/industries$/, src: "src/pages/IndustriesPage.tsx" },
	// Solutions
	{
		pattern: /^\/solutions\/[^/]+$/,
		src: "src/pages/SolutionDetailPage.tsx",
	},
	{ pattern: /^\/solutions$/, src: "src/pages/SolutionsPage.tsx" },
	// Developer docs (detail before the index)
	{ pattern: /^\/docs\/.+/, src: "src/pages/docs/DocDetailPage.tsx" },
	{ pattern: /^\/docs\/?$/, src: "src/pages/docs/DocsIndexPage.tsx" },
	// Other pages
	{ pattern: /^\/pricing$/, src: "src/pages/PricingPage.tsx" },
	{ pattern: /^\/faq$/, src: "src/pages/FaqPage.tsx" },
	{ pattern: /^\/ai$/, src: "src/pages/AiPage.tsx" },
	{ pattern: /^\/use-cases$/, src: "src/pages/UseCasesHubPage.tsx" },
	{ pattern: /^\/about-us$/, src: "src/pages/AboutPage.tsx" },
	{ pattern: /^\/blogs-media$/, src: "src/pages/BlogsMediaPage.tsx" },
	{ pattern: /^\/tnc$/, src: "src/pages/TermsPage.tsx" },
	{ pattern: /^\/privacy-policy$/, src: "src/pages/PrivacyPolicyPage.tsx" },
	{ pattern: /^\/refund-policy$/, src: "src/pages/RefundPolicyPage.tsx" },
	{ pattern: /^\/grievance$/, src: "src/pages/GrievancePage.tsx" },
	{ pattern: /^\/signup$/, src: "src/pages/SignupPage.tsx" },
	// Home — last so it does not accidentally match other paths
	{ pattern: /^\/$/, src: "src/pages/Index.tsx" },
];

export const PRERENDER_ROUTES: string[] = [
	// Home
	"/",

	// Products listing + dynamic slugs
	"/products",
	...getActiveProducts()
		.filter((p) => hasProductPage(p.id))
		.map((p) => productHref(p.slug)),

	// Products — static routes (before :slug wildcard in the router)
	// "/products/eko-shield",
	// "/products/eko-shield/document", --- IGNORE ---

	// Industries
	"/industries",
	...INDUSTRIES_LIST.map((i) => `/industries/${i.slug}`),

	// Solutions
	"/solutions",
	...SOLUTIONS_LIST.map((s) => `/solutions/${s.slug}`),

	// Pricing
	"/pricing",

	// FAQ
	"/faq",

	// AI Agents
	"/ai",

	// Developer docs (overview + every guide & endpoint slug)
	"/docs",
	...getAllDocSlugs().map((slug) => docsHref(slug)),

	// Use-cases hub
	"/use-cases",

	// Company & Legal
	"/about-us",
	// "/blogs-media", --- IGNORE ---
	"/tnc",
	"/privacy-policy",
	"/refund-policy",
	"/grievance",
	"/signup",
];
