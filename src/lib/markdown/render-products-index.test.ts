import { describe, expect, it } from "vitest";
import {
	renderProductsIndexMarkdown,
	renderProductsIndexText,
} from "@/lib/markdown/render-products-index";
import type { ProductPageDataShape } from "@/lib/markdown/render-product";
import type { ApiProductRef } from "@/lib/data/api-products";
import type { FAQ } from "@/components/ProductPageLayout";

const COMMON_FAQS: FAQ[] = [
	{ q: "How do I get started?", a: "Sign up and integrate." },
	{ q: "How is API usage billed?", a: "Per successful call." },
];

const makePage = (
	overrides: Partial<ProductPageDataShape>,
): ProductPageDataShape => ({
	seo: { title: "T", description: "D", keywords: "k" },
	title: "T",
	desc: "D",
	heroTitle: "H",
	heroSubtitle: "Hero subtitle.",
	category: "verification",
	docsUrl: "https://developers.eko.in/docs/x",
	features: [{ title: "Fast", desc: "Sub-second response." }],
	integrationSteps: [{ title: "Sign Up", desc: "Create an account." }],
	faqs: [],
	...overrides,
});

const panProduct: ApiProductRef = {
	id: "pan",
	name: "PAN Verification",
	slug: "pan-verification-api",
	href: "/products/pan-verification-api",
	category: "verification",
	shortDesc: "Full PAN identity fetch in <2 seconds",
};

const panPage = makePage({
	overview: "Verify PAN cards against the source of truth.",
	keyBenefits: ["Instant verification", "Reduced fraud"],
	useCases: ["Lending", "Insurance"],
	whoShouldUse: ["Fintechs", "NBFCs"],
	faqs: [
		{ q: "Is it real-time?", a: "Yes." },
		{ q: "How do I get started?", a: "Sign up and integrate." },
	],
	inputOutputPreviews: [
		{
			apiName: "PAN Lite",
			method: "POST",
			endpoint: "/pan/lite",
			inputs: [{ label: "PAN Number", value: "ABCDE1234F" }],
			outputs: [{ label: "PAN Status", value: "VALID" }],
		},
		{
			apiName: "PAN Hidden",
			comingSoon: true,
			inputs: [{ label: "Secret Input", value: "x" }],
			outputs: [],
		},
	],
});

const unpricedProduct: ApiProductRef = {
	id: "not-a-priced-product",
	name: "Mystery Verification",
	slug: "mystery-api",
	href: "/products/mystery-api",
	category: "verification",
	shortDesc: "Mystery checks",
};

const unpricedPage = makePage({
	inputOutputPreview: {
		apiName: "Mystery Check",
		inputs: [{ label: "Mystery ID", value: "123" }],
		outputs: [{ label: "Mystery Status", value: "OK" }],
		sampleJson: {
			method: "POST",
			endpoint: "/mystery/check",
			request: {},
			response: {},
		},
	},
});

const dmtProduct: ApiProductRef = {
	id: "dmt",
	name: "Domestic Money Transfer (DMT)",
	slug: "dmt-api",
	href: "/products/dmt-api",
	category: "bc",
	shortDesc: "Send money to any bank account",
};

const aepsProduct: ApiProductRef = {
	id: "aeps",
	name: "AePS Cashout",
	slug: "aeps-api",
	href: "/products/aeps-api",
	category: "bc",
	shortDesc: "Aadhaar-enabled cash withdrawal",
};

const bbpsProduct: ApiProductRef = {
	id: "bbps",
	name: "BBPS",
	slug: "bbps-api",
	href: "/products/bbps-api",
	category: "payment",
	shortDesc: "Bill payments",
};

const products = [panProduct, unpricedProduct, bbpsProduct, dmtProduct, aepsProduct];
const pages: Record<string, ProductPageDataShape> = {
	pan: panPage,
	"not-a-priced-product": unpricedPage,
	dmt: makePage({ category: "payment" }),
	aeps: makePage({ category: "payment" }),
	bbps: makePage({ category: "payment" }),
};

describe("renderProductsIndexMarkdown", () => {
	const md = renderProductsIndexMarkdown(products, pages, COMMON_FAQS);

	it("includes YAML front-matter with canonical URL", () => {
		expect(md).toMatch(/^---\n/);
		expect(md).toContain('type: "products-index"');
		expect(md).toContain('canonical: "https://eps.eko.in/products"');
	});

	it("groups products under category headings", () => {
		expect(md).toContain("## Verification APIs");
		expect(md).toContain("## Payment APIs");
		expect(md).toContain("## BC Agent APIs");
		expect(md.indexOf("### PAN Verification")).toBeGreaterThan(
			md.indexOf("## Verification APIs"),
		);
		expect(md.indexOf("### PAN Verification")).toBeLessThan(
			md.indexOf("## Payment APIs"),
		);
	});

	it("omits empty categories", () => {
		const verificationOnly = renderProductsIndexMarkdown(
			[panProduct],
			pages,
			COMMON_FAQS,
		);
		expect(verificationOnly).toContain("## Verification APIs");
		expect(verificationOnly).not.toContain("## Payment APIs");
		expect(verificationOnly).not.toContain("## BC Agent APIs");
	});

	it("renders global notices exactly once", () => {
		expect(md.match(/To get started, fill the form/g)).toHaveLength(1);
		expect(md).toContain("GST @ 18%");
	});

	it("renders a products-at-a-glance table", () => {
		expect(md).toContain("## Products at a Glance");
		expect(md).toContain(
			"[PAN Verification](https://eps.eko.in/products/pan-verification-api)",
		);
	});

	it("filters out common FAQs but keeps product-specific ones", () => {
		expect(md).toContain("- **Is it real-time?** Yes.");
		expect(md).not.toContain("How do I get started?");
	});

	it("renders compact endpoint one-liners from the previews array", () => {
		expect(md).toContain(
			"- `POST /pan/lite` — PAN Lite: inputs: PAN Number → outputs: PAN Status",
		);
		// sample values and comingSoon previews are excluded
		expect(md).not.toContain("ABCDE1234F");
		expect(md).not.toContain("Secret Input");
	});

	it("renders endpoint one-liners from the singular preview via sampleJson", () => {
		expect(md).toContain(
			"- `POST /mystery/check` — Mystery Check: inputs: Mystery ID → outputs: Mystery Status",
		);
	});

	it("renders verification pricing from the rate card", () => {
		const panSection = md.slice(
			md.indexOf("### PAN Verification"),
			md.indexOf("### Mystery Verification"),
		);
		expect(panSection).toContain("**Pricing:**");
		expect(panSection).toMatch(/₹\d/);
	});

	it("falls back to the pricing page for unpriced products", () => {
		const section = md.slice(
			md.indexOf("### Mystery Verification"),
			md.indexOf("## Payment APIs"),
		);
		expect(section).toContain(
			"See the full rate card at https://eps.eko.in/pricing.md",
		);
	});

	it("renders the full DMT slab table and sender notes", () => {
		expect(md).toContain("₹5.67");
		expect(md).toContain("Maximum transaction amount: ₹5,000.");
		expect(md).toContain("After TDS @ 2%");
	});

	it("renders AePS slabs and mini-statement rate", () => {
		expect(md).toContain("Mini statement: ₹0.75 per transaction.");
	});

	it("renders BBPS category slabs and the operator-count pointer", () => {
		expect(md).toContain("Electricity Bill");
		expect(md).toMatch(/Operator-level commission for \d+\+ BBPS billers/);
		expect(md).toContain("eps-pricing-calculator.xlsx");
	});

	it("renders per-product links including docs", () => {
		expect(md).toContain(
			"[Page](https://eps.eko.in/products/pan-verification-api) · [Markdown](https://eps.eko.in/products/pan-verification-api.md) · [API docs](https://developers.eko.in/docs/x)",
		);
	});

	it("excludes repetitive boilerplate sections", () => {
		expect(md).not.toContain("Integration Steps");
		expect(md).not.toContain("Connected Banking");
	});
});

describe("renderProductsIndexText", () => {
	const txt = renderProductsIndexText(products, pages, COMMON_FAQS);
	const md = renderProductsIndexMarkdown(products, pages, COMMON_FAQS);

	it("drops front-matter and the canonical notice", () => {
		expect(txt).not.toMatch(/^---\n/);
		expect(txt).not.toContain('type: "products-index"');
		expect(txt).not.toContain("canonical:");
		expect(txt).not.toContain("machine-readable Markdown version");
	});

	it("carries no bold markup anywhere", () => {
		expect(txt).not.toContain("**");
	});

	it("uses '#'-numbered headings, no markdown '#' headings", () => {
		expect(txt).toContain("Eko APIs & Products — Complete Reference");
		expect(txt).toMatch(/#\d+ Verification APIs/);
		expect(txt).toMatch(/#\d+\.\d+ PAN Verification/);
		for (const line of txt.split("\n")) {
			expect(line.startsWith("## ")).toBe(false);
			expect(line.startsWith("### ")).toBe(false);
		}
	});

	it("groups the glance section into category sub-sections with inline summaries", () => {
		expect(txt).toMatch(/#\d+\.\d+ Verification\n/);
		expect(txt).toContain(
			"  1. PAN Verification (https://eps.eko.in/products/pan-verification-api) — Full PAN identity fetch in <2 seconds",
		);
		// the glance no longer carries a "Category:" column
		expect(txt).not.toContain("Category: Verification");
	});

	it("renders labels and FAQs unbolded, filtering common FAQs", () => {
		expect(txt).toContain("Pricing:");
		expect(txt).toContain("- Is it real-time? Yes.");
		expect(txt).not.toContain("How do I get started?");
	});

	it("keeps backtick endpoint one-liners", () => {
		expect(txt).toContain(
			"- `POST /pan/lite` — PAN Lite: inputs: PAN Number → outputs: PAN Status",
		);
	});

	it("renders tables as indented numbered lists, not pipe tables", () => {
		expect(txt).not.toContain("|---");
		expect(txt).not.toMatch(/^\| /m);
		// Pricing content parity with the markdown variant.
		expect(txt).toMatch(/₹\d/);
		expect(txt).toContain("After TDS @ 2%");
		expect(txt).toContain("Mini statement: ₹0.75 per transaction.");
		expect(txt).toContain("eps-pricing-calculator.xlsx");
		expect(txt).toMatch(/Operator-level commission for \d+\+ BBPS billers/);
	});

	it("compresses verification pricing to one line per variant", () => {
		// "Name: rate" on a single line, no stacked Rate:/Billing unit: lines.
		expect(txt).toMatch(/  \d+\. PAN[^\n]*: ₹\d/);
		expect(txt).not.toContain("Billing unit:");
		// the implied per-verification unit is dropped
		expect(txt).not.toContain(": ₹1.20 per verification");
		// bulk variants keep their "*" marker and share one footnote
		expect(txt).toContain("  * billed per record in bulk requests");
	});

	it("drops the markdown link and comma-joins the links line", () => {
		expect(txt).toContain(
			"Links: Page (https://eps.eko.in/products/pan-verification-api), API docs (https://developers.eko.in/docs/x)",
		);
		expect(txt).not.toContain("[Page](");
		expect(txt).not.toContain("Markdown (");
		expect(txt).not.toContain(" · ");
	});

	it("adds an extra blank line before H1/H2 sections only", () => {
		// no leading blank at the very top (H1 title)
		expect(txt.startsWith("\n")).toBe(false);
		// H2 sections are preceded by two blank lines
		expect(txt).toMatch(/\n\n\n#1 Products at a Glance/);
		expect(txt).toMatch(/\n\n\n#\d+ Verification APIs/);
		// H3 sub-sections keep a single blank line
		expect(txt).toMatch(/[^\n]\n\n#1\.1 Verification/);
		expect(txt).not.toMatch(/\n\n\n#1\.1 Verification/);
	});

	it("renders the same product set as the markdown twin", () => {
		for (const product of products) {
			expect(txt).toContain(product.name);
		}
		// md reference kept to assert content parity, not size — the indented
		// numbered-list table format can make the txt larger for table-heavy data.
		expect(md).toContain("PAN Verification");
	});
});
