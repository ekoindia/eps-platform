import { describe, expect, it } from "vitest";

import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import { GLOBAL_FAQS } from "@/lib/data/common-faqs";
import {
	SECURITY_FAQS,
	SECURITY_PATH,
	SECURITY_SECTIONS,
	resolveSecuritySections,
	type TransactionProductId,
} from "@/lib/data/security";
import { renderSecurityMarkdown } from "@/lib/markdown/render-security";

/**
 * IT-confirmed statements, with the qualifiers that must not get lost. Each
 * one must reach every projection: page data, `/security.md` and the MCP topic.
 */
const APPROVED_STATEMENTS = [
	"Microsoft Azure",
	"Central India (Pune)",
	"South India (Chennai)",
	"stored and processed within India",
	"Aadhaar numbers are never stored",
	"never retained",
	"RBI-empanelled auditors",
	"every year against ISO/IEC 27001",
	"KYC and AML/CFT",
	"HMAC-SHA256",
	"backend-only",
	"TLS 1.2+",
	"optional extra layer of security for production",
	"10–20 characters",
	"before retrying",
	"shared over email on request",
];

/** Product-specific statements: required only while that product is enabled. */
const PRODUCT_STATEMENTS: Record<TransactionProductId, string[]> = {
	dmt: ["one-time biometric Aadhaar eKYC", "fresh OTP"],
	aeps: [
		"biometric authentication each day",
		"withdrawals above ₹5,000 also need an SMS OTP",
	],
	bbps: ["never exceed the fetched bill amount"],
};

const productStatements = (isActive: (id: TransactionProductId) => boolean) =>
	(Object.keys(PRODUCT_STATEMENTS) as TransactionProductId[]).flatMap((id) =>
		isActive(id) ? PRODUCT_STATEMENTS[id] : [],
	);

/** Claims IT ruled out: "certified" (it's "audited against") and at-rest encryption. */
const FORBIDDEN = [
	/certified\s+(to|for|under)?\s*ISO/i,
	/ISO[^.]*certified/i,
	/at rest/i,
];

/** Drop markdown emphasis so qualifiers match regardless of bolding. */
const plain = (text: string): string => text.replace(/\*\*/g, "");

const projections: Record<string, string> = {
	page: plain(SECURITY_SECTIONS.flatMap((s) => s.points).join("\n")),
	markdown: plain(renderSecurityMarkdown()),
	mcp: plain(JSON.stringify(buildAgentBundle(getDocumentedSpecs()).topics.security)),
};

describe("security content", () => {
	for (const [name, text] of Object.entries(projections)) {
		it(`${name} carries every approved statement`, () => {
			const expected = [
				...APPROVED_STATEMENTS,
				...productStatements((id) => id in ACTIVE_PRODUCTS_MAP),
			];
			for (const statement of expected) {
				expect(text, `${name} is missing "${statement}"`).toContain(statement);
			}
		});

		it(`${name} makes no ruled-out claim`, () => {
			for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
		});
	}

	it("drops a disabled product's copy and keeps the rest", () => {
		const text = (isActive: (id: TransactionProductId) => boolean) =>
			plain(
				resolveSecuritySections(isActive)
					.flatMap((s) => s.points)
					.join("\n"),
			);
		const withoutDmt = text((id) => id !== "dmt");
		for (const statement of PRODUCT_STATEMENTS.dmt) {
			expect(withoutDmt).not.toContain(statement);
		}
		for (const statement of productStatements((id) => id !== "dmt")) {
			expect(withoutDmt).toContain(statement);
		}
		const noneActive = text(() => false);
		for (const statement of productStatements(() => true)) {
			expect(noneActive).not.toContain(statement);
		}
		for (const statement of APPROVED_STATEMENTS) {
			expect(noneActive).toContain(statement);
		}
	});

	it("the transaction-auth FAQ covers exactly the enabled products", () => {
		const text = plain(SECURITY_FAQS.map((f) => `${f.q}\n${f.a}`).join("\n"));
		const isActive = (id: TransactionProductId) => id in ACTIVE_PRODUCTS_MAP;
		for (const id of Object.keys(PRODUCT_STATEMENTS) as TransactionProductId[]) {
			for (const statement of PRODUCT_STATEMENTS[id]) {
				if (isActive(id)) expect(text).toContain(statement);
				else expect(text).not.toContain(statement);
			}
		}
	});

	it("security FAQs make no ruled-out claim", () => {
		const text = plain(SECURITY_FAQS.map((f) => f.a).join("\n"));
		for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
	});

	it("every /security anchor link points at a real section", () => {
		const ids = new Set(SECURITY_SECTIONS.map((s) => s.id));
		const faqs = [
			...GLOBAL_FAQS,
			...Object.values(API_PRODUCT_PAGES).flatMap((p) => p.faqs),
		];
		const hrefs = faqs
			.flatMap((faq) => faq.links ?? [])
			.map((link) => link.href)
			.filter((href) => href.startsWith(`${SECURITY_PATH}#`));
		expect(hrefs.length).toBeGreaterThan(0);
		for (const href of hrefs) expect(ids).toContain(href.split("#")[1]);
	});

	it("ships the security FAQs on the global FAQ page", () => {
		for (const faq of SECURITY_FAQS) {
			expect(GLOBAL_FAQS.map((f) => f.q)).toContain(faq.q);
		}
	});
});
