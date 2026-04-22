/**
 * Deterministic route manifest for static pre-rendering.
 *
 * This is the single source of truth for which routes get pre-rendered
 * at build time. Adding or removing a route here is all that's needed.
 */
import { API_PRODUCTS } from "@/lib/data/api-products";
import { INDUSTRIES_LIST } from "@/lib/data/industries";
import { SOLUTIONS_LIST } from "@/lib/data/solutions";

export const PRERENDER_ROUTES: string[] = [
  // Home
  "/",

  // Products — dynamic slugs
  ...API_PRODUCTS.map((p) => `/products/${p.slug}`),

  // Products — static routes (before :slug wildcard in the router)
  "/products/eko-shield",
  "/products/eko-shield/document",

  // Industries
  "/industries",
  ...INDUSTRIES_LIST.map((i) => `/industries/${i.slug}`),

  // Solutions
  "/solutions",
  ...SOLUTIONS_LIST.map((s) => `/solutions/${s.slug}`),

  // Use-cases hub
  "/use-cases",

  // Company & Legal
  "/about-us",
  "/blogs-media",
  "/tnc",
  "/privacy-policy",
  "/refund-policy",
  "/grievance",
  "/signup",
];
