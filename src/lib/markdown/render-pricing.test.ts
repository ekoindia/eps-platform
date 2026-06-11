import { describe, expect, it } from "vitest";
import { renderPricingMarkdown } from "@/lib/markdown/render-pricing";
import { PRICED_APIS, PRICING_FAQS, PRICING_GROUPS } from "@/lib/data/api-pricing";

describe("renderPricingMarkdown", () => {
  const md = renderPricingMarkdown();

  it("includes YAML front-matter with canonical URL", () => {
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('canonical: "https://eps.eko.in/pricing"');
    expect(md).toContain('type: "pricing"');
  });

  it("includes the canonical notice and H1", () => {
    expect(md).toContain("**Canonical URL:** https://eps.eko.in/pricing");
    expect(md).toContain("# Verification API Pricing — Full Rate Card");
  });

  it("renders a rate-card section per pricing group", () => {
    for (const group of PRICING_GROUPS) {
      expect(md).toContain(`### ${group.label}`);
    }
  });

  it("lists every priced API with its rate", () => {
    for (const api of PRICED_APIS) {
      expect(md).toContain(api.name);
      const lowestRate = Math.min(...api.tiers.map((tier) => tier.rate));
      expect(md).toContain(`₹${lowestRate.toFixed(2)}`);
    }
  });

  it("includes the bulk-billing footnote", () => {
    expect(md).toContain("Bulk APIs are billed per individual verification");
  });

  it("includes every pricing FAQ", () => {
    for (const faq of PRICING_FAQS) {
      expect(md).toContain(`### ${faq.q}`);
      expect(md).toContain(faq.a);
    }
  });

  it("points to the interactive calculator on the HTML page", () => {
    expect(md).toContain("calculator");
    expect(md).toContain("https://eps.eko.in/pricing");
  });
});
