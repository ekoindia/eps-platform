import { describe, expect, it } from "vitest";

import {
	API_PRODUCT_PAGES,
	COMMON_API_FAQS,
	GLOBAL_FAQS,
	GLOBAL_REFERENCE_FAQS,
} from "@/lib/data/api-product-pages";

/**
 * Guards for the common / global FAQ scoping. Importing api-product-pages runs
 * the module-load merge that appends COMMON_API_FAQS to every product page.
 */
describe("common & global FAQs", () => {
	const pages = Object.values(API_PRODUCT_PAGES);
	const globalOnlyQuestions = new Set(GLOBAL_REFERENCE_FAQS.map((f) => f.q));

	it("never appends global-only reference FAQs to product pages", () => {
		for (const page of pages) {
			for (const faq of page.faqs) {
				expect(globalOnlyQuestions.has(faq.q)).toBe(false);
			}
		}
	});

	it("injects each common FAQ exactly once per product page", () => {
		for (const page of pages) {
			for (const common of COMMON_API_FAQS) {
				const matches = page.faqs.filter((f) => f.q === common.q);
				expect(
					matches.length,
					`"${common.q}" should appear once on product "${page.title}"`,
				).toBe(1);
			}
		}
	});

	it("has no duplicate question across product-specific and common FAQs", () => {
		for (const page of pages) {
			const questions = page.faqs.map((f) => f.q);
			expect(new Set(questions).size).toBe(questions.length);
		}
	});

	it("composes GLOBAL_FAQS as product commons followed by reference FAQs", () => {
		expect(GLOBAL_FAQS).toEqual([...COMMON_API_FAQS, ...GLOBAL_REFERENCE_FAQS]);
		const questions = GLOBAL_FAQS.map((f) => f.q);
		expect(new Set(questions).size).toBe(questions.length);
	});
});
