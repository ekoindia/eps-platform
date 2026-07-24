import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import {
	getApi,
	getRecipe,
	getTopic,
	listApis,
	listRecipes,
	listTopics,
	searchApis,
} from "./bundle-access.js";

const { bundle } = await loadBundle();

describe("bundle-access", () => {
	it("listApis returns compact entries (no bodies)", () => {
		const list = listApis(bundle);
		expect(list.length).toBeGreaterThan(0);
		expect(list[0]).not.toHaveProperty("responseFields");
		expect(list[0]).toHaveProperty("slug");
	});

	it("listTopics + listRecipes return ids", () => {
		expect(listTopics(bundle)).toContain("auth");
		expect(
			listRecipes(bundle).some((r) => r.id === "dmt-fino-send-money"),
		).toBe(true);
	});

	it("searchApis ranks by query, returns ids only", () => {
		const hits = searchApis(bundle, "sender");
		expect(hits.length).toBeGreaterThan(0);
		expect(hits[0]).toHaveProperty("slug");
		expect(hits[0]).not.toHaveProperty("responseFields");
	});

	it("getApi returns detail for a known slug, undefined otherwise", () => {
		const known = bundle.apis[0].slug;
		expect(getApi(bundle, known)?.responseFields).toBeTruthy();
		expect(getApi(bundle, "nope")).toBeUndefined();
	});

	it("getTopic('auth') is backend-only; getRecipe resolves", () => {
		expect(getTopic(bundle, "auth")?.backendOnly).toBe(true);
		expect(
			getRecipe(bundle, "dmt-fino-send-money")?.steps.length,
		).toBeGreaterThan(0);
	});
});
