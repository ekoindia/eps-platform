import { describe, expect, it } from "vitest";

import { getDocBySlug } from "@/lib/data/docs-registry";
import { SEARCH_INDEX, type SearchItem } from "@/lib/search-index";

/**
 * Integrity guards for the ⌘K search index. The endpoint/guide items are
 * derived dynamically from the docs registry, so these catch drift between the
 * index and the live `/docs/:slug` routes (e.g. an item linking to a slug that
 * no longer resolves) plus the invariants the ranking/render code relies on.
 */

const byCategory = (category: SearchItem["category"]): SearchItem[] =>
	SEARCH_INDEX.filter((item) => item.category === category);

describe("search index integrity", () => {
	it("has unique ids", () => {
		const ids = SEARCH_INDEX.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("gives every item a positive type weight", () => {
		for (const item of SEARCH_INDEX) {
			expect(item.typeWeight).toBeGreaterThan(0);
		}
	});

	it("actually indexed endpoints and guides", () => {
		expect(byCategory("endpoint").length).toBeGreaterThan(0);
		expect(byCategory("guide").length).toBeGreaterThan(0);
	});

	it("resolves every endpoint/guide item to a live /docs page", () => {
		for (const item of [...byCategory("endpoint"), ...byCategory("guide")]) {
			expect(item.slug, item.id).toBeTruthy();
			expect(item.href).toBe(`/docs/${item.slug}`);
			expect(getDocBySlug(item.slug as string), item.id).toBeDefined();
		}
	});

	it("gives every endpoint item a method (the row renders a method pill)", () => {
		for (const item of byCategory("endpoint")) {
			expect(item.method, item.id).toBeTruthy();
		}
	});

	it("never surfaces endpoints in the empty-query suggested view", () => {
		expect(byCategory("endpoint").every((item) => !item.suggested)).toBe(true);
	});
});
