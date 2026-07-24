import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import {
	buildAgentBundle,
	buildApi,
	buildIndex,
	buildTopic,
} from "@/lib/agent/build-agent-bundle";

const specs = getDocumentedSpecs();
const bundle = buildAgentBundle(specs);

describe("buildAgentBundle", () => {
	it("is deterministic / byte-stable for a fixed spec set", () => {
		const a = JSON.stringify(buildAgentBundle(specs));
		const b = JSON.stringify(buildAgentBundle(specs));
		expect(a).toBe(b);
	});

	it("includes every documented spec in apis", () => {
		expect(bundle.apis.length).toBe(specs.length);
		for (const s of specs)
			expect(bundle.apis.some((a) => a.slug === s.slug)).toBe(true);
	});

	it("auth topic is backend-only and carries signing steps", () => {
		const auth = buildTopic(bundle, "auth");
		expect(auth.backendOnly).toBe(true);
		expect(auth.warning).toMatch(/backend-only/i);
		expect(auth.secretKeyGeneration.length).toBeGreaterThan(0);
	});

	it("never leaks an access_key value anywhere in the bundle", () => {
		const json = JSON.stringify(bundle).toLowerCase();
		// the literal header name access_key may appear in prose, but no value;
		// guard against an accidental "access_key":"<something>" assignment.
		expect(json).not.toMatch(/"access_key"\s*:/);
	});

	it("meta carries org + a content-hash bundleVersion", () => {
		expect(bundle.meta.org).toBe("ekoindia");
		expect(bundle.meta.bundleVersion).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe("slices", () => {
	it("index is compact: entries have no request/response bodies", () => {
		const index = buildIndex(bundle);
		expect(index.apis.length).toBe(specs.length);
		for (const entry of index.apis) {
			expect(entry).not.toHaveProperty("responseFields");
			expect(entry).not.toHaveProperty("sampleRequest");
			expect(entry).not.toHaveProperty("responseTypes");
		}
		expect(index.topics).toContain("auth");
		expect(index.recipes.some((r) => r.id === "dmt-send-money")).toBe(true);
	});

	it("buildApi returns full detail for a known slug and undefined otherwise", () => {
		const known = specs[0].slug;
		expect(buildApi(bundle, known)?.responseFields.length).toBeGreaterThan(0);
		expect(buildApi(bundle, "nope-not-real")).toBeUndefined();
	});

	it("carries a spec's response types through to the per-API slice", () => {
		// This is what lets an agent branch on response_type_id without scraping
		// the docs prose.
		const responseTypes = buildApi(bundle, "dmt-get-sender")?.responseTypes;
		expect(responseTypes).toContainEqual({
			id: 308,
			meaning: "Sender not found",
			next: "dmt-onboard-sender",
		});
	});

	it("gives an endpoint with no documented response types an empty array", () => {
		// Never undefined — consumers map over it without a guard.
		const withNone = bundle.apis.find((a) => a.responseTypes.length === 0);
		expect(withNone).toBeDefined();
		expect(withNone?.responseTypes).toEqual([]);
	});
});
