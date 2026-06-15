import { describe, expect, it } from "vitest";
import { renderPricingMarkdown } from "@/lib/markdown/render-pricing";
import {
	PRICED_APIS,
	PRICING_FAQS,
	PRICING_GROUPS,
} from "@/lib/data/api-pricing";
import {
	BBPS_CATEGORIES,
	DMT_SLABS,
	PAYMENTS_FAQS,
} from "@/lib/data/payments-pricing";
import { CB_FAQS } from "@/lib/data/connected-banking-pricing";

describe("renderPricingMarkdown", () => {
	const md = renderPricingMarkdown();

	it("includes YAML front-matter with canonical URL", () => {
		expect(md).toMatch(/^---\n/);
		expect(md).toContain('canonical: "https://eps.eko.in/pricing"');
		expect(md).toContain('type: "pricing"');
	});

	it("includes the canonical notice and H1", () => {
		expect(md).toContain("**Canonical URL:** https://eps.eko.in/pricing");
		expect(md).toContain("# EPS API Pricing — Full Rate Card & Commissions");
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

	it("renders the DMT commission slab table", () => {
		expect(md).toContain("### Domestic Money Transfer (DMT)");
		for (const slab of DMT_SLABS) {
			expect(md).toContain(`₹${slab.commission.toFixed(2)}`);
		}
		expect(md).toContain("minimum ₹10.00");
		expect(md).toContain("₹11");
	});

	it("renders the AePS section with settlement charges", () => {
		expect(md).toContain("### AePS — Aadhaar-Enabled Payment System");
		expect(md).toContain("0.4% of amount");
		expect(md).toContain("₹13.00");
		expect(md).toContain("₹0.75 per transaction");
		expect(md).toContain("₹5.00 + GST");
		expect(md).toContain("₹10.00 + GST");
	});

	it("renders every BBPS category and points to the Excel rate card", () => {
		for (const category of BBPS_CATEGORIES) {
			expect(md).toContain(category.name);
		}
		expect(md).toContain("https://eps.eko.in/eps-pricing-calculator.xlsx");
	});

	it("renders the Connected Banking section", () => {
		expect(md).toContain("## Connected Banking Pricing");
		expect(md).toContain("₹75,000 + GST per bank per user");
		expect(md).toContain("HDFC, IDFC FIRST, RBL, SLICE");
		expect(md).toContain("₹8.00");
		expect(md).toContain("₹15.00");
	});

	it("includes every FAQ across all product families", () => {
		for (const faq of [...PRICING_FAQS, ...PAYMENTS_FAQS, ...CB_FAQS]) {
			expect(md).toContain(`### ${faq.q}`);
			expect(md).toContain(faq.a);
		}
	});

	it("points to the interactive calculator on the HTML page", () => {
		expect(md).toContain("calculator");
		expect(md).toContain("https://eps.eko.in/pricing");
	});
});
