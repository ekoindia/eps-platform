import { describe, expect, it } from "vitest";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import {
	assertNoSlugCollisions,
	buildNavTree,
	type DocNode,
	endpointSlug,
	getAllDocNodes,
	getAllDocSlugs,
	getDocBySlug,
	getDocumentedSpecs,
	RESERVED_SLUGS,
} from "@/lib/data/docs-registry";
import { API_SPECS } from "@/lib/data/api-specs";

describe("endpointSlug", () => {
	it("is the spec slug with no method prefix", () => {
		const spec = API_SPECS.find((s) => s.id === "pan-lite");
		expect(spec).toBeTruthy();
		expect(endpointSlug(spec!)).toBe(spec!.slug);
		expect(endpointSlug(spec!)).not.toMatch(/^(get|post|put|delete)-/);
	});
});

describe("documented specs", () => {
	it("excludes -status helper specs", () => {
		const ids = getDocumentedSpecs().map((s) => s.id);
		expect(API_SPECS.some((s) => s.id.endsWith("-status"))).toBe(true);
		expect(ids.some((id) => id.endsWith("-status"))).toBe(false);
	});

	it("only includes specs whose product is active (non-disabled)", () => {
		for (const spec of getDocumentedSpecs()) {
			expect(ACTIVE_PRODUCTS_MAP[spec.productId]).toBeTruthy();
		}
	});
});

describe("slug namespace", () => {
	it("has no duplicate or reserved slugs across guides + endpoints", () => {
		// Throws at module load already; this re-asserts on the built nodes.
		expect(() => assertNoSlugCollisions(getAllDocNodes())).not.toThrow();
		const slugs = getAllDocSlugs();
		const lower = slugs.map((s) => s.toLowerCase());
		expect(new Set(lower).size).toBe(slugs.length);
		for (const s of lower) expect(RESERVED_SLUGS.has(s)).toBe(false);
	});

	it("getDocBySlug round-trips every documented endpoint", () => {
		for (const spec of getDocumentedSpecs()) {
			const node = getDocBySlug(endpointSlug(spec));
			expect(node?.kind).toBe("endpoint");
			expect(node?.spec?.id).toBe(spec.id);
		}
	});

	it("returns undefined for unknown slugs", () => {
		expect(getDocBySlug("definitely-not-a-real-slug")).toBeUndefined();
	});
});

describe("assertNoSlugCollisions guard", () => {
	const node = (slug: string, title: string): DocNode => ({
		slug,
		kind: "guide",
		title,
	});

	it("throws on a case-insensitive duplicate", () => {
		expect(() =>
			assertNoSlugCollisions([node("Pan-Lite", "A"), node("pan-lite", "B")]),
		).toThrow(/duplicate slug/i);
	});

	it("throws on a reserved slug", () => {
		expect(() => assertNoSlugCollisions([node("openapi", "X")])).toThrow(
			/reserved/i,
		);
	});
});

describe("buildNavTree", () => {
	it("orders categories bc → payment → verification and nests products", () => {
		const { categories } = buildNavTree();
		expect(categories.map((c) => c.category)).toEqual(
			["bc", "payment", "verification"].filter((cat) =>
				categories.some((c) => c.category === cat),
			),
		);
		for (const cat of categories) {
			expect(cat.products.length).toBeGreaterThan(0);
			for (const product of cat.products) {
				expect(product.endpoints.length).toBeGreaterThan(0);
				for (const ep of product.endpoints) {
					expect(ep.method).toBeTruthy();
					expect(getDocBySlug(ep.slug)?.kind).toBe("endpoint");
				}
			}
		}
	});
});
