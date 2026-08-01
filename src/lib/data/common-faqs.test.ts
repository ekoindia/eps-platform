import { describe, expect, it } from "vitest";

// Importing api-product-pages (not just the FAQ data) is load-bearing: it runs
// the module-load merge that appends COMMON_API_FAQS to every product page.
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import {
	COMMON_API_FAQS,
	FAQ_TAGS,
	type FaqTag,
	faqsByTag,
	GLOBAL_FAQS,
	GLOBAL_REFERENCE_FAQS,
	parseFaqTags,
} from "@/lib/data/common-faqs";

/** Tags the `/docs/faqs` guide renders a section for — see `faqs.mdx`. */
const DOCS_GUIDE_TAGS: FaqTag[] = [
	"getting-started",
	"auth",
	"testing",
	"integration",
	"ai",
	"support",
];

/**
 * Guards for the common / global FAQ scoping.
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

	it("tags every global FAQ with a known category", () => {
		for (const faq of GLOBAL_FAQS) {
			expect(faq.tag, `"${faq.q}" is missing a tag`).toBeDefined();
			expect(FAQ_TAGS).toContain(faq.tag);
		}
	});

	it("fills every section of the /docs/faqs guide", () => {
		for (const tag of DOCS_GUIDE_TAGS) {
			expect(
				faqsByTag(GLOBAL_FAQS, [tag]).length,
				`no FAQ tagged "${tag}" — the /docs/faqs section would render empty`,
			).toBeGreaterThan(0);
		}
	});

	it("never shows the same FAQ under two /docs/faqs sections", () => {
		const shown = DOCS_GUIDE_TAGS.flatMap((tag) =>
			faqsByTag(GLOBAL_FAQS, [tag]).map((f) => f.q),
		);
		expect(new Set(shown).size).toBe(shown.length);
	});

	it("rejects unknown tags when parsing a FaqList filter", () => {
		expect(parseFaqTags("auth, testing")).toEqual(["auth", "testing"]);
		expect(() => parseFaqTags("integration,typo")).toThrow(/typo/);
	});
});
