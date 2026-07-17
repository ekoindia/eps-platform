import { describe, expect, it } from "vitest";
import {
	PRODUCTS_TXT_PARTS,
	renderProductsIndexMarkdown,
	renderProductsIndexText,
	renderProductsIndexTextPart,
} from "@/lib/markdown/render-products-index";
import type { ProductPageDataShape } from "@/lib/markdown/render-product";
import type { ApiProductId, ApiProductRef } from "@/lib/data/api-products";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import type { FAQ } from "@/components/ProductPageLayout";

/** Minimal ApiSpec fixture builder for deterministic preview/docs rendering. */
const makeSpec = (overrides: Partial<ApiSpec>): ApiSpec => ({
	id: "spec",
	productId: "pan",
	name: "Spec",
	slug: "spec",
	summary: "",
	method: "POST",
	path: "/spec",
	docsUrl: "https://developers.eko.in/docs/x",
	extraRequestParams: [],
	sampleRequest: {},
	responseData: [],
	sampleSuccessResponse: {},
	...overrides,
});

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
	features: [{ title: "Fast", desc: "Sub-second response." }],
	integrationSteps: [{ title: "Sign Up", desc: "Create an account." }],
	faqs: [],
	...overrides,
});

const panProduct: ApiProductRef = {
	id: "pan",
	name: "PAN Verification",
	slug: "pan-verification-api",
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
});

const unpricedProduct: ApiProductRef = {
	id: "not-a-priced-product",
	name: "Mystery Verification",
	slug: "mystery-api",
	category: "verification",
	shortDesc: "Mystery checks",
};

const unpricedPage = makePage({});

const dmtProduct: ApiProductRef = {
	id: "dmt",
	name: "Domestic Money Transfer (DMT)",
	slug: "dmt-api",
	category: "bc",
	shortDesc: "Send money to any bank account",
};

const aepsProduct: ApiProductRef = {
	id: "aeps",
	name: "AePS Cashout",
	slug: "aeps-api",
	category: "bc",
	shortDesc: "Aadhaar-enabled cash withdrawal",
};

const bbpsProduct: ApiProductRef = {
	id: "bbps",
	name: "BBPS",
	slug: "bbps-api",
	category: "payment",
	shortDesc: "Bill payments",
};

const products = [
	panProduct,
	unpricedProduct,
	bbpsProduct,
	dmtProduct,
	aepsProduct,
];
const pages: Record<string, ProductPageDataShape> = {
	pan: panPage,
	"not-a-priced-product": unpricedPage,
	dmt: makePage({ category: "payment" }),
	aeps: makePage({ category: "payment" }),
	bbps: makePage({ category: "payment" }),
};

// Deterministic technical specs for the renderers — keeps preview/docs output
// independent of the live `api-specs.ts` registry.
const specsByProduct: Record<string, ApiSpec[]> = {
	pan: [
		makeSpec({
			id: "pan-lite",
			name: "PAN Lite",
			path: "/pan/lite",
			extraRequestParams: [
				{ name: "pan_number", in: "body", type: "string", required: true },
			],
			sampleRequest: { pan_number: "ABCDE1234F" },
			responseData: [
				{
					name: "pan_status",
					type: "string",
					imp: true,
					description: "PAN validity status",
					example: "VALID",
				},
			],
		}),
	],
	"not-a-priced-product": [
		makeSpec({
			// Deliberately not a real product id — exercises rendering of a
			// product absent from the priced set. Cast past the literal union.
			productId: "not-a-priced-product" as ApiProductId,
			id: "mystery-check",
			name: "Mystery Check",
			path: "/mystery/check",
			extraRequestParams: [
				{ name: "mystery_id", in: "body", type: "string", required: true },
			],
			sampleRequest: { mystery_id: "123" },
			responseData: [
				{ name: "mystery_status", type: "string", imp: true, example: "OK" },
			],
		}),
	],
	dmt: [],
	aeps: [],
	bbps: [],
};

describe("renderProductsIndexMarkdown", () => {
	const md = renderProductsIndexMarkdown(
		products,
		pages,
		COMMON_FAQS,
		specsByProduct,
	);

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
			specsByProduct,
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
			"- `POST /pan/lite` — PAN Lite: inputs: Pan Number → outputs: Pan Status",
		);
		// sample values and comingSoon previews are excluded
		expect(md).not.toContain("ABCDE1234F");
		expect(md).not.toContain("Secret Input");
	});

	it("renders a 'What Can You Verify' block for verification products only", () => {
		const panSection = md.slice(
			md.indexOf("### PAN Verification"),
			md.indexOf("### Mystery Verification"),
		);
		expect(panSection).toContain(
			"**What Can You Verify With PAN Verification API?**",
		);
		expect(panSection).toContain("- **Pan Status** — PAN validity status");
		// payment/BC sections never carry the block
		const bbpsSection = md.slice(md.indexOf("### BBPS"));
		expect(bbpsSection).not.toContain("What Can You Verify");
	});

	it("renders endpoint one-liners from the singular preview via sampleJson", () => {
		expect(md).toContain(
			"- `POST /mystery/check` — Mystery Check: inputs: Mystery Id → outputs: Mystery Status",
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
			"[Page](https://eps.eko.in/products/pan-verification-api) · [Markdown](https://eps.eko.in/products/pan-verification-api.md) · [API docs](https://eps.eko.in/docs/spec)",
		);
	});

	it("excludes repetitive boilerplate sections", () => {
		expect(md).not.toContain("Integration Steps");
		expect(md).not.toContain("Connected Banking");
	});
});

describe("renderProductsIndexText", () => {
	const txt = renderProductsIndexText(
		products,
		pages,
		COMMON_FAQS,
		specsByProduct,
	);
	const md = renderProductsIndexMarkdown(
		products,
		pages,
		COMMON_FAQS,
		specsByProduct,
	);

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
		expect(txt).toContain("Eko EPS APIs & Products — Complete Reference");
		expect(txt).toMatch(/#\d+ Verification APIs/);
		expect(txt).toMatch(/#\d+\.\d+ PAN Verification/);
		for (const line of txt.split("\n")) {
			expect(line.startsWith("## ")).toBe(false);
			expect(line.startsWith("### ")).toBe(false);
		}
	});

	it("groups the glance section into category sub-sections with inline summaries", () => {
		expect(txt).toMatch(/#\d+\.\d+ Verification\n/);
		// name + summary only — the URL is dropped here, it rides the detail section
		expect(txt).toContain(
			"  1. PAN Verification — Full PAN identity fetch in <2 seconds",
		);
		expect(txt).not.toContain(
			"PAN Verification (https://eps.eko.in/products/pan-verification-api) —",
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
			"- `POST /pan/lite` — PAN Lite: inputs: Pan Number → outputs: Pan Status",
		);
	});

	it("renders tables as indented numbered lists, not pipe tables", () => {
		expect(txt).not.toContain("|---");
		expect(txt).not.toMatch(/^\| /m);
		// Pricing content parity with the markdown variant.
		expect(txt).toMatch(/₹\d/);
		expect(txt).toContain("After TDS: ₹2.81");
		expect(txt).toContain("Mini statement: ₹0.75 per transaction.");
		expect(txt).toContain("eps-pricing-calculator.xlsx");
		expect(txt).toMatch(/Operator-level commission for \d+\+ BBPS billers/);
	});

	it("renders AePS cashout slabs as an inline numbered list", () => {
		expect(txt).toContain("Pricing (commission):");
		expect(txt).toMatch(/ {2}1\. ₹101 – ₹3,000: 0\.4% of amount/);
		expect(txt).toContain("Mini statement: ₹0.75 per transaction.");
	});

	it("renders DMT slabs as an inline numbered list with commission/after-TDS", () => {
		expect(txt).toContain("Pricing (excl. GST, TDS @ 2%):");
		expect(txt).toMatch(
			/ {2}1\. ₹100 – ₹1,000: ₹5\.67 \(Commission: ₹2\.87, After TDS: ₹2\.81\)/,
		);
		// sender notes still follow as bullets
		expect(txt).toContain("Maximum transaction amount: ₹5,000.");
	});

	it("renders BBPS commission as an inline numbered list with [bracketed] notes", () => {
		expect(txt).toContain("Pricing (commission, excl. GST):");
		expect(txt).toMatch(
			/ {2}\d+\. Electricity Bill: ₹1 – ₹5,000: ₹1\.20; ₹5,001 – ₹20,000: 0\.52% of amount/,
		);
		// range notes ride inline in square brackets, not on a separate line
		expect(txt).toMatch(/ {2}\d+\. FASTag Recharge: ₹[\d.]+ \[[^\]]+\]/);
		expect(txt).not.toContain("Notes: —");
	});

	it("compresses verification pricing to one line per variant", () => {
		// "Name: rate" on a single line, no stacked Rate:/Billing unit: lines.
		expect(txt).toMatch(/ {2}\d+\. PAN[^\n]*: ₹\d/);
		expect(txt).not.toContain("Billing unit:");
		// the implied per-verification unit is dropped
		expect(txt).not.toContain(": ₹1.20 per verification");
		// bulk variants keep their "*" marker and share one footnote
		expect(txt).toContain("  * billed per record in bulk requests");
	});

	it("drops the markdown link and comma-joins the links line", () => {
		expect(txt).toContain(
			"Links: Page (https://eps.eko.in/products/pan-verification-api), API docs (https://eps.eko.in/docs/spec)",
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

describe("renderProductsIndexTextPart", () => {
	const part = {
		slug: "products-verification-identity",
		title: "Eko Verification APIs (Identity & KYC) — Reference",
		shortLabel: "Identity & KYC verification",
		lede: "Identity & KYC verification APIs from Eko.",
		productIds: ["pan"],
	};
	const txt = renderProductsIndexTextPart(
		part,
		[panProduct],
		pages,
		COMMON_FAQS,
		specsByProduct,
	);

	it("uses the part's H1 title and lede, not the combined one", () => {
		expect(txt).toContain("Eko Verification APIs (Identity & KYC) — Reference");
		expect(txt).not.toContain("Eko EPS APIs & Products — Complete Reference");
		expect(txt).toContain("Identity & KYC verification APIs from Eko.");
	});

	it("includes only the part's products", () => {
		expect(txt).toContain("PAN Verification");
		// no payment / BC product sections in an identity-only part
		// (BBPS/AePS still appear in the shared pricing-notes boilerplate)
		expect(txt).not.toMatch(/#\d+ Payment APIs/);
		expect(txt).not.toMatch(/#\d+ BC Agent APIs/);
		expect(txt).not.toContain("Domestic Money Transfer");
		expect(txt).not.toContain("AePS Cashout");
	});

	it("stays self-contained: global notices plus its own glance, once each", () => {
		expect(txt).toContain("GST @ 18%");
		expect(txt).toContain("To get started");
		expect(txt.match(/#1 Products at a Glance/g)).toHaveLength(1);
	});

	it("cross-links the sibling parts by public URL", () => {
		expect(txt).toContain("Other parts:");
		expect(txt).toContain("https://eps.eko.in/products-payments.txt");
		expect(txt).toContain(
			"https://eps.eko.in/products-verification-business.txt",
		);
	});

	it("carries no bold markup and no glance URLs", () => {
		expect(txt).not.toContain("**");
		expect(txt).not.toContain(
			"PAN Verification (https://eps.eko.in/products/pan-verification-api) —",
		);
	});

	it("exposes three parts with unique slugs covering every active product once", () => {
		expect(PRODUCTS_TXT_PARTS).toHaveLength(3);
		const slugs = PRODUCTS_TXT_PARTS.map((p) => p.slug);
		expect(new Set(slugs).size).toBe(3);
		const ids = PRODUCTS_TXT_PARTS.flatMap((p) => p.productIds);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
