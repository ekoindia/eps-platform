import { describe, expect, it } from "vitest";

import { PRERENDER_ROUTES } from "../../../ssg/routes";
import { buildNavTree, RESERVED_SLUGS } from "./docs-registry";
import { SDK_GUIDES, getAllSdkSlugs, getSdkGuide, sdkGuideHref } from "./sdk-guides";
import { SDK_INSTALL, SDK_LANGS } from "../docs/code-samples";
import { SEARCH_INDEX } from "../search-index";

describe("SDK guides", () => {
	it("covers exactly the languages SDK_LANGS and SDK_INSTALL do", () => {
		const guideLangs = SDK_GUIDES.map((g) => g.lang).sort();
		expect(guideLangs).toEqual(SDK_LANGS.map((l) => l.id).sort());
		// SDK_INSTALL is Partial<Record<…>> and `isSdkLang` is `lang in
		// SDK_INSTALL`, so a missing row silently falls back to Node.
		expect(guideLangs).toEqual(Object.keys(SDK_INSTALL).sort());
	});

	it("has unique slugs and orders", () => {
		expect(new Set(getAllSdkSlugs()).size).toBe(SDK_GUIDES.length);
		expect(new Set(SDK_GUIDES.map((g) => g.order)).size).toBe(SDK_GUIDES.length);
	});

	it("reserves the `sdk` docs slug so no guide or endpoint can shadow it", () => {
		expect(RESERVED_SLUGS.has("sdk")).toBe(true);
	});

	it("resolves every slug back to its guide", () => {
		for (const slug of getAllSdkSlugs())
			expect(getSdkGuide(slug)?.slug, slug).toBe(slug);
		expect(getSdkGuide("rust")).toBeUndefined();
	});

	it("prerenders the hub and every language page", () => {
		const routes = new Set(PRERENDER_ROUTES);
		expect(routes.has(sdkGuideHref())).toBe(true);
		for (const slug of getAllSdkSlugs())
			expect(routes.has(sdkGuideHref(slug)), slug).toBe(true);
	});

	// Matched by href, not title — the label is marketing copy and churns.
	it("surfaces SDKs as a guide link pointing at the SDK section", () => {
		const sdks = buildNavTree().guides.find((g) => g.href === sdkGuideHref());
		expect(sdks?.title).toMatch(/SDK/i);
	});

	it("indexes the hub and every language for ⌘K, at routable hrefs", () => {
		const items = SEARCH_INDEX.filter((i) => i.category === "sdk");
		expect(items).toHaveLength(SDK_GUIDES.length + 1);
		const routes = new Set(PRERENDER_ROUTES);
		for (const item of items) expect(routes.has(item.href), item.id).toBe(true);
	});

	it("describes every SDK well enough to be a guide", () => {
		for (const g of SDK_GUIDES) {
			expect(g.summary.length, g.slug).toBeGreaterThan(20);
			expect(g.packageName, g.slug).toBeTruthy();
			expect(g.minRuntime, g.slug).toBeTruthy();
			expect(g.dependencies, g.slug).toBeTruthy();
			expect(g.sourceUrl, g.slug).toMatch(/^https:\/\/github\.com\//);
			expect(g.config.length, g.slug).toBeGreaterThan(0);
			expect(g.members.length, g.slug).toBeGreaterThan(0);
			expect(g.fileValues.length, g.slug).toBeGreaterThan(0);
			// The shared contract from docs/sdk-golden-vector.md: every SDK reports
			// a non-2xx response with a typed HTTP error.
			expect(
				g.errorTypes.some((e) => /http/i.test(e.name)),
				g.slug,
			).toBe(true);
		}
	});
});
