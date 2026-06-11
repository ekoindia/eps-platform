import {
  BookOpen,
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

import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import { getActiveProducts } from "@/lib/data/api-products";
import { ACTIVE_INDUSTRIES_LIST } from "@/lib/data/industries";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";

export type SearchCategory = "api" | "industry" | "solution" | "page";

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
}

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
  getActiveProducts().map((p) => ({
    id: `api:${p.slug}`,
    label: p.name,
    sublabel: p.shortDesc,
    href: p.href,
    category: "api" as const,
    keywords: [
      ...(p.shortName ? [p.shortName] : []),
      p.slug,
      ...splitSeoKeywords(API_PRODUCT_PAGES[p.id]?.seo.keywords),
    ],
    icon: API_CATEGORY_ICONS[p.category] ?? ShieldCheck,
    suggested: SUGGESTED_API_IDS.has(p.id),
  }));

/** Builds industry search items (priority 3 = hidden/draft, excluded) */
const buildIndustryItems = (): SearchItem[] =>
  ACTIVE_INDUSTRIES_LIST.filter((i) => i.priority !== 3).map((i) => ({
    id: `industry:${i.slug}`,
    label: i.name,
    sublabel: i.tagline,
    href: `/industries/${i.slug}`,
    category: "industry" as const,
    keywords: [i.slug, i.category, ...splitSeoKeywords(i.seo.keywords)],
    icon: i.icon,
    suggested: i.priority === 1,
  }));

/** Builds solution-pack search items (priority 3 = hidden/draft, excluded) */
const buildSolutionItems = (): SearchItem[] =>
  ACTIVE_SOLUTIONS_LIST.filter((s) => s.priority !== 3).map((s) => ({
    id: `solution:${s.slug}`,
    label: s.name,
    sublabel: s.tagline,
    href: `/solutions/${s.slug}`,
    category: "solution" as const,
    keywords: [s.slug, s.category, ...splitSeoKeywords(s.seo.keywords)],
    icon: s.icon,
    suggested: s.priority === 1,
  }));

/** Static site pages + external docs + quick actions */
const buildPageItems = (): SearchItem[] => [
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
    href: "https://developers.eko.in",
    external: true,
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

/** Builds the complete search index. Runs once at module scope inside the lazy palette chunk. */
const buildSearchIndex = (): SearchItem[] => [
  ...buildApiItems(),
  ...buildIndustryItems(),
  ...buildSolutionItems(),
  ...buildPageItems(),
];

export const SEARCH_INDEX: SearchItem[] = buildSearchIndex();
