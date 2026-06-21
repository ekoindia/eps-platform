import {
	BookOpen,
	Bot,
	Building2,
	Calculator,
	CreditCard,
	FileText,
	Home,
	Landmark,
	Layers,
	LayoutGrid,
	Rocket,
	ShieldCheck,
	Users,
	type LucideIcon,
} from "lucide-react";

import {
	API_PRODUCT_PAGES,
	hasProductPage,
} from "@/lib/data/api-product-pages";
import { getActiveProducts, productHref } from "@/lib/data/api-products";
import { docsHref, getAllDocNodes } from "@/lib/data/docs-registry";
import { ACTIVE_INDUSTRIES_LIST } from "@/lib/data/industries";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";

export type SearchCategory =
	| "api"
	| "endpoint"
	| "guide"
	| "industry"
	| "solution"
	| "page";

export interface SearchItem {
	/** Unique across the whole index — `${category}:${slug}` */
	id: string;
	label: string;
	sublabel?: string;
	href: string;
	/** Opens in a new tab instead of SPA navigation */
	external?: boolean;
	/** Special action instead of navigation */
	action?: "talk-to-sales";
	category: SearchCategory;
	/** Extra terms fed to cmdk's fuzzy filter via the CommandItem `keywords` prop */
	keywords: string[];
	icon: LucideIcon;
	/** Shown in the empty-query (default) view */
	suggested?: boolean;
	/** Endpoint-only: HTTP method, rendered as a coloured pill */
	method?: "GET" | "POST" | "PUT" | "DELETE";
	/** Endpoint-only: request path, shown as the secondary line */
	path?: string;
	/** Bare slug for match-field scoring (where the term hit) */
	slug?: string;
	/** Asset-type rank multiplier — drives priority ordering (see TYPE_WEIGHT) */
	typeWeight: number;
}

/**
 * Asset-type priority weights. Higher = surfaced first on equal text relevance.
 * Order: Product > API Endpoint > Guide > Solution Pack > Industry > Page.
 */
const TYPE_WEIGHT: Record<SearchCategory, number> = {
	api: 6,
	endpoint: 5,
	guide: 4,
	solution: 3,
	industry: 2,
	page: 1,
};

/** Highest type weight — normaliser for the ranking multiplier. */
export const MAX_TYPE_WEIGHT = TYPE_WEIGHT.api;

/** Icons per API product category */
const API_CATEGORY_ICONS: Record<string, LucideIcon> = {
	bc: Landmark,
	payment: CreditCard,
	verification: ShieldCheck,
};

/** Flagship APIs surfaced in the empty-query view */
const SUGGESTED_API_IDS = new Set(["dmt", "aeps", "bbps", "pan", "bank"]);

/** Splits a comma-separated SEO keywords string into trimmed terms, capped to keep matching fast */
const splitSeoKeywords = (keywords: string | undefined, cap = 12): string[] =>
	(keywords ?? "")
		.split(",")
		.map((k) => k.trim())
		.filter(Boolean)
		.slice(0, cap);

/** Builds API product search items from api-products + per-page SEO keywords */
const buildApiItems = (): SearchItem[] =>
	getActiveProducts()
		.filter((p) => hasProductPage(p.id))
		.map((p) => ({
			id: `api:${p.slug}`,
			slug: p.slug,
			label: p.name,
			sublabel: p.shortDesc,
			href: productHref(p.slug),
			category: "api" as const,
			keywords: [
				...(p.shortName ? [p.shortName] : []),
				p.slug,
				...splitSeoKeywords(API_PRODUCT_PAGES[p.id]?.seo.keywords),
			],
			icon: API_CATEGORY_ICONS[p.category] ?? ShieldCheck,
			suggested: SUGGESTED_API_IDS.has(p.id),
			typeWeight: TYPE_WEIGHT.api,
		}));

/** Builds API-endpoint search items from the docs registry (dynamic — future
 * endpoints auto-appear, removed/`-status`/inactive ones auto-drop). */
const buildEndpointItems = (): SearchItem[] =>
	getAllDocNodes()
		.filter((n) => n.kind === "endpoint")
		.map((n) => ({
			id: `endpoint:${n.slug}`,
			slug: n.slug,
			label: n.title,
			sublabel: n.summary,
			href: docsHref(n.slug),
			category: "endpoint" as const,
			method: n.method,
			path: n.spec?.path,
			keywords: [
				n.slug,
				n.method ?? "",
				n.spec?.path ?? "",
				n.productName ?? "",
				n.spec?.provider ?? "",
				n.spec?.group ?? "",
			].filter(Boolean),
			icon: API_CATEGORY_ICONS[n.category ?? ""] ?? ShieldCheck,
			typeWeight: TYPE_WEIGHT.endpoint,
		}));

/** Builds dev-docs guide search items from the docs registry (dynamic). */
const buildGuideItems = (): SearchItem[] =>
	getAllDocNodes()
		.filter((n) => n.kind === "guide")
		.map((n) => ({
			id: `guide:${n.slug}`,
			slug: n.slug,
			label: n.title,
			sublabel: n.summary,
			href: docsHref(n.slug),
			category: "guide" as const,
			keywords: [n.slug, "guide", "docs"],
			icon: BookOpen,
			typeWeight: TYPE_WEIGHT.guide,
			// Only the Quickstart guide surfaces in the empty-query view.
			suggested: n.slug === "quickstart",
		}));

/** Builds industry search items (priority 3 = hidden/draft, excluded) */
const buildIndustryItems = (): SearchItem[] =>
	ACTIVE_INDUSTRIES_LIST.filter((i) => i.priority !== 3).map((i) => ({
		id: `industry:${i.slug}`,
		slug: i.slug,
		label: i.name,
		sublabel: i.tagline,
		href: `/industries/${i.slug}`,
		category: "industry" as const,
		keywords: [i.slug, i.category, ...splitSeoKeywords(i.seo.keywords)],
		icon: i.icon,
		suggested: i.priority === 1,
		typeWeight: TYPE_WEIGHT.industry,
	}));

/** Builds solution-pack search items (priority 3 = hidden/draft, excluded) */
const buildSolutionItems = (): SearchItem[] =>
	ACTIVE_SOLUTIONS_LIST.filter((s) => s.priority !== 3).map((s) => ({
		id: `solution:${s.slug}`,
		slug: s.slug,
		label: s.name,
		sublabel: s.tagline,
		href: `/solutions/${s.slug}`,
		category: "solution" as const,
		keywords: [s.slug, s.category, ...splitSeoKeywords(s.seo.keywords)],
		icon: s.icon,
		suggested: s.priority === 1,
		typeWeight: TYPE_WEIGHT.solution,
	}));

/** Static site pages + external docs + quick actions */
const PAGE_ITEMS: Omit<SearchItem, "typeWeight">[] = [
	{
		id: "page:home",
		label: "Home",
		href: "/",
		category: "page",
		keywords: ["homepage", "start"],
		icon: Home,
	},
	{
		id: "page:products",
		label: "All API Products",
		sublabel: "Browse the full API catalogue",
		href: "/products",
		category: "page",
		keywords: ["apis", "catalogue", "catalog", "products"],
		icon: LayoutGrid,
		suggested: true,
	},
	{
		id: "page:pricing",
		label: "API Pricing",
		sublabel: "Rates & cost calculator for verification APIs",
		href: "/pricing",
		category: "page",
		keywords: ["pricing", "rates", "cost", "calculator", "price", "charges"],
		icon: Calculator,
		suggested: true,
	},
	{
		id: "page:ai",
		label: "EPS for AI agents",
		sublabel: "Context packs, MCP server, machine bundle",
		href: "/ai",
		category: "page",
		keywords: [
			"ai",
			"agent",
			"mcp",
			"llm",
			"claude",
			"cursor",
			"copilot",
			"openapi",
		],
		icon: Bot,
		suggested: true,
	},
	{
		id: "page:use-cases",
		label: "Use Cases",
		sublabel: "Industries & solution packs",
		href: "/use-cases",
		category: "page",
		keywords: ["use cases", "industries", "solutions"],
		icon: Layers,
	},
	{
		id: "page:industries",
		label: "Industries",
		href: "/industries",
		category: "page",
		keywords: ["verticals", "sectors"],
		icon: Building2,
	},
	{
		id: "page:solutions",
		label: "Solution Packs",
		href: "/solutions",
		category: "page",
		keywords: ["packs", "bundles"],
		icon: Layers,
	},
	{
		id: "page:signup",
		label: "Sign Up",
		sublabel: "Create your Eko developer account",
		href: "/signup",
		category: "page",
		keywords: ["register", "get started", "account", "onboarding"],
		icon: Rocket,
		suggested: true,
	},
	{
		id: "page:docs",
		label: "Developer Docs",
		sublabel: "API reference & integration guides",
		href: "/docs",
		// external: true,
		category: "page",
		keywords: ["documentation", "api reference", "sandbox", "developers"],
		icon: BookOpen,
		suggested: true,
	},
	// {
	//   id: "page:talk-to-sales",
	//   label: "Talk to Sales",
	//   sublabel: "Get pricing & a guided demo",
	//   href: "#",
	//   action: "talk-to-sales",
	//   category: "page",
	//   keywords: ["contact", "sales", "pricing", "demo", "support"],
	//   icon: MessageCircle,
	//   suggested: true,
	// },
	{
		id: "page:about-us",
		label: "About Us",
		href: "/about-us",
		category: "page",
		keywords: ["company", "team", "eko"],
		icon: Users,
	},
	// {
	//   id: "page:blogs-media",
	//   label: "Blogs & Media",
	//   href: "/blogs-media",
	//   category: "page",
	//   keywords: ["blog", "press", "news", "media"],
	//   icon: Newspaper,
	// },
	{
		id: "page:tnc",
		label: "Terms & Conditions",
		href: "/tnc",
		category: "page",
		keywords: ["terms", "legal", "tnc"],
		icon: FileText,
	},
	{
		id: "page:privacy-policy",
		label: "Privacy Policy",
		href: "/privacy-policy",
		category: "page",
		keywords: ["privacy", "legal", "data"],
		icon: FileText,
	},
	{
		id: "page:refund-policy",
		label: "Refund Policy",
		href: "/refund-policy",
		category: "page",
		keywords: ["refund", "legal"],
		icon: FileText,
	},
	{
		id: "page:grievance",
		label: "Grievance Redressal",
		href: "/grievance",
		category: "page",
		keywords: ["grievance", "complaint", "support", "legal"],
		icon: FileText,
	},
];

/** Static-page items, stamped with the page type weight. */
const buildPageItems = (): SearchItem[] =>
	PAGE_ITEMS.map((p) => ({ ...p, typeWeight: TYPE_WEIGHT.page }));

/** Builds the complete search index. Runs once at module scope inside the lazy palette chunk. */
const buildSearchIndex = (): SearchItem[] => [
	...buildApiItems(),
	...buildEndpointItems(),
	...buildGuideItems(),
	...buildSolutionItems(),
	...buildIndustryItems(),
	...buildPageItems(),
];

export const SEARCH_INDEX: SearchItem[] = buildSearchIndex();
