import { describe, expect, it } from "vitest";
import { API_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import { hasProductPage } from "@/lib/data/api-product-pages";
import { ACTIVE_INDUSTRIES_LIST, INDUSTRIES_LIST } from "@/lib/data/industries";
import { ACTIVE_SOLUTIONS_LIST, SOLUTIONS_LIST } from "@/lib/data/solutions";

/**
 * Integrity guards for the curated buyer-intent layers (industries &
 * solution packs) that reference API products by id. These catch the drift
 * classes that the silent disabled/unknown-ref stripping would otherwise hide:
 *   - apiGrid `href` hand-written out of sync with the product slug,
 *   - references to non-existent products (typos like the old "otp"/"sms"),
 *   - rendered references to a product with no page (a 404 link),
 *   - stale buyer-facing display chips for removed/disabled capabilities.
 */

/** Display chips that map to no live product (removed/disabled aliases). */
const STALE_DISPLAY_CHIPS = new Set([
	"Mobile OTP",
	"OTP",
	"SMS",
	"Fund Transfer",
]);

describe("industry apiGrid integrity (rendered)", () => {
	for (const industry of ACTIVE_INDUSTRIES_LIST) {
		for (const item of industry.apiGrid) {
			const label = `${industry.slug} → ${item.apiId}`;
			it(`${label}: product is active`, () => {
				const product = API_PRODUCTS_MAP[item.apiId];
				expect(product, `unknown product id`).toBeDefined();
				expect(product?.disabled ?? false).toBe(false);
			});
			it(`${label}: href matches product slug`, () => {
				const product = API_PRODUCTS_MAP[item.apiId];
				expect(item.href).toBe(productHref(product.slug));
			});
			it(`${label}: has a product page (link resolves)`, () => {
				expect(hasProductPage(item.apiId)).toBe(true);
			});
		}
	}
});

describe("solution pack packApis integrity (rendered)", () => {
	for (const solution of ACTIVE_SOLUTIONS_LIST) {
		for (const ref of solution.packApis) {
			const label = `${solution.slug} → ${ref.apiId}`;
			it(`${label}: product is active`, () => {
				const product = API_PRODUCTS_MAP[ref.apiId];
				expect(product, `unknown product id`).toBeDefined();
				expect(product?.disabled ?? false).toBe(false);
			});
			it(`${label}: has a product page (link resolves)`, () => {
				expect(hasProductPage(ref.apiId)).toBe(true);
			});
		}
	}
});

describe("no unknown product ids in raw curated source", () => {
	it("every industry apiGrid apiId exists in API_PRODUCTS_MAP", () => {
		const unknown = INDUSTRIES_LIST.flatMap((i) =>
			i.apiGrid
				.filter((a) => !API_PRODUCTS_MAP[a.apiId])
				.map((a) => `${i.slug}:${a.apiId}`),
		);
		expect(unknown).toEqual([]);
	});
	it("every solution packApis apiId exists in API_PRODUCTS_MAP", () => {
		const unknown = SOLUTIONS_LIST.flatMap((s) =>
			s.packApis
				.filter((a) => !API_PRODUCTS_MAP[a.apiId])
				.map((a) => `${s.slug}:${a.apiId}`),
		);
		expect(unknown).toEqual([]);
	});
});

describe("no stale display chips in recommendedPacks", () => {
	it("recommendedPacks.apis contain no removed/disabled aliases", () => {
		const stale = INDUSTRIES_LIST.flatMap((i) =>
			i.recommendedPacks.flatMap((p) =>
				p.apis
					.filter((name) => STALE_DISPLAY_CHIPS.has(name))
					.map((name) => `${i.slug}:${p.slug}:${name}`),
			),
		);
		expect(stale).toEqual([]);
	});
});
