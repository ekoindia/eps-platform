import type { ApiProductRef } from "@/lib/data/api-products";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import type { ProductPageDataShape } from "@/lib/markdown/render-product";
import { renderProductMarkdown } from "@/lib/markdown/render-product";
import { describe, expect, it } from "vitest";

const product: ApiProductRef = {
	id: "pan",
	name: "PAN Verification",
	slug: "pan-verification-api",
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
		category: "verification",
		shortDesc: "Aadhaar-based identity",
	},
];

const specs: ApiSpec[] = [
	{
		id: "pan-lite",
		productId: "pan",
		name: "PAN Lite",
		slug: "pan-lite",
		summary: "Quick PAN validation.",
		method: "POST",
		path: "/pan/lite",
		docsUrl: "https://developers.eko.in/docs/pan",
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
			{
				name: "full_name",
				type: "string",
				imp: true,
				description: "Registered PAN holder name",
				example: "Rajesh Kumar",
			},
		],
		sampleSuccessResponse: {},
	},
];

describe("renderProductMarkdown", () => {
	const md = renderProductMarkdown(product, page, related, specs);

	it("includes YAML front-matter with canonical URL", () => {
		expect(md).toMatch(/^---\n/);
		expect(md).toContain(
			'canonical: "https://eps.eko.in/products/pan-verification-api"',
		);
		expect(md).toContain('type: "product"');
	});

	it("includes the canonical notice and H1 hero title", () => {
		expect(md).toContain(
			"**Canonical URL:** https://eps.eko.in/products/pan-verification-api",
		);
		expect(md).toContain("# Verify PAN in under 2 seconds");
	});

	it("includes the shared get-started CTA", () => {
		expect(md).toContain(
			"To get started, fill the form at https://eps.eko.in/signup (with your name, mobile number and email) or call us at +919513181707",
		);
	});

	it("renders major sections", () => {
		expect(md).toContain("## Features");
		expect(md).toContain("- Fast: Sub-second response times.");
		expect(md).toContain("## Integration Steps");
		expect(md).toContain("1. **Sign Up** — Create an account.");
		expect(md).toContain("> Tip: Takes a minute");
		expect(md).toContain("## Use Cases");
		expect(md).toContain("- Lending");
		expect(md).toContain("## FAQs");
		expect(md).toContain("### Is it real-time?");
		expect(md).toContain("## API Documentation");
		expect(md).toContain("https://eps.eko.in/docs/pan-lite");
	});

	it("lists the product's endpoints, linking the markdown twins", () => {
		expect(md).toContain("## API Endpoints");
		expect(md).toContain(
			"- [PAN Lite](https://eps.eko.in/docs/pan-lite.md) (POST)",
		);
	});

	it("renders the 'What Can You Verify' section from imp fields", () => {
		expect(md).toContain("## What Can You Verify With PAN Verification API?");
		expect(md).toContain("- **Pan Status** — PAN validity status");
		expect(md).toContain("- **Full Name** — Registered PAN holder name");
		// it sits above the API preview section
		expect(md.indexOf("## What Can You Verify")).toBeLessThan(
			md.indexOf("## API Preview"),
		);
	});

	it("links related products with markdown-version suffixes", () => {
		expect(md).toContain("## Related Products");
		expect(md).toContain(
			"(https://eps.eko.in/products/aadhaar-verification-api)",
		);
		expect(md).toContain(
			"(https://eps.eko.in/products/aadhaar-verification-api.md)",
		);
	});
});

describe("renderProductMarkdown — nested API endpoint list", () => {
	const base = {
		productId: "pan" as const,
		summary: "x",
		path: "/x",
		docsUrl: "",
		extraRequestParams: [],
		responseData: [],
		sampleSuccessResponse: {},
	};
	const nestedSpecs: ApiSpec[] = [
		{
			...base,
			id: "fino-sender",
			name: "Get Sender",
			slug: "fino-sender",
			provider: "Fino",
			group: "Sender",
			method: "GET",
		},
		{
			...base,
			id: "fino-onboard",
			name: "Onboard Sender",
			slug: "fino-onboard",
			provider: "Fino",
			group: "Sender",
			method: "POST",
		},
		{
			...base,
			id: "fino-status",
			name: "Status Poller",
			slug: "fino-status",
			provider: "Fino",
			group: "Sender",
			method: "GET",
		},
	];
	const md = renderProductMarkdown(product, page, [], nestedSpecs);

	it("nests provider › group › endpoint with indentation", () => {
		expect(md).toContain("## API Endpoints");
		expect(md).toContain("- **Fino**");
		expect(md).toContain("  - **Sender**");
		// leaves indented two levels under the group; unknown slugs are plain text
		expect(md).toContain("    - Get Sender (GET)");
		expect(md).toContain("    - Onboard Sender (POST)");
	});

	it("drops -status poller specs from the endpoint list", () => {
		// (still shown as an API Preview, but never as an endpoint-list leaf)
		expect(md).not.toContain("Status Poller (GET)");
	});
});
