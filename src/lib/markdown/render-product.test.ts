import { describe, expect, it } from "vitest";
import { renderProductMarkdown } from "@/lib/markdown/render-product";
import type { ProductPageDataShape } from "@/lib/markdown/render-product";
import type { ApiProductRef } from "@/lib/data/api-products";

const product: ApiProductRef = {
  id: "pan",
  name: "PAN Verification",
  slug: "pan-verification-api",
  href: "/products/pan-verification-api",
  category: "verification",
  shortDesc: "Full PAN identity fetch in <2 seconds",
};

const page: ProductPageDataShape = {
  seo: {
    title: "PAN Verification API",
    description: "Verify PAN cards instantly.",
    keywords: "pan, verification, api",
  },
  title: "PAN Verification API",
  desc: "Verify PAN cards instantly.",
  heroTitle: "Verify PAN in under 2 seconds",
  heroSubtitle: "Real-time PAN identity lookup for onboarding and KYC.",
  category: "verification",
  docsUrl: "https://developers.eko.in/docs/pan",
  features: [
    { title: "Fast", desc: "Sub-second response times." },
    { title: "Accurate", desc: "Direct from source of truth." },
  ],
  integrationSteps: [
    { title: "Sign Up", desc: "Create an account.", tip: "Takes a minute" },
    { title: "Integrate", desc: "Call the API." },
  ],
  faqs: [{ q: "Is it real-time?", a: "Yes." }],
  useCases: ["Lending", "Insurance"],
};

const related: ApiProductRef[] = [
  {
    id: "aadhaar",
    name: "Aadhaar Verification",
    slug: "aadhaar-verification-api",
    href: "/products/aadhaar-verification-api",
    category: "verification",
    shortDesc: "Aadhaar-based identity",
  },
];

describe("renderProductMarkdown", () => {
  const md = renderProductMarkdown(product, page, related);

  it("includes YAML front-matter with canonical URL", () => {
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('canonical: "https://eps.eko.in/products/pan-verification-api"');
    expect(md).toContain('type: "product"');
  });

  it("includes the canonical notice and H1 hero title", () => {
    expect(md).toContain("**Canonical URL:** https://eps.eko.in/products/pan-verification-api");
    expect(md).toContain("# Verify PAN in under 2 seconds");
  });

  it("includes the shared get-started CTA", () => {
    expect(md).toContain(
      "To get started, fill the form at https://eps.eko.in/signup (with your name and mobile number) or call us at +919513181707"
    );
  });

  it("renders major sections", () => {
    expect(md).toContain("## Features");
    expect(md).toContain("### Fast");
    expect(md).toContain("## Integration Steps");
    expect(md).toContain("1. **Sign Up** — Create an account.");
    expect(md).toContain("> Tip: Takes a minute");
    expect(md).toContain("## Use Cases");
    expect(md).toContain("- Lending");
    expect(md).toContain("## FAQs");
    expect(md).toContain("### Is it real-time?");
    expect(md).toContain("## API Documentation");
    expect(md).toContain("https://developers.eko.in/docs/pan");
  });

  it("links related products with markdown-version suffixes", () => {
    expect(md).toContain("## Related Products");
    expect(md).toContain("(https://eps.eko.in/products/aadhaar-verification-api)");
    expect(md).toContain("(https://eps.eko.in/products/aadhaar-verification-api.md)");
  });
});
