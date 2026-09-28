import { buildEngine } from "@/lib/search-engine";
import { describe, expect, it } from "vitest";
import { detectIntent, subjectOf } from "./intent";
import { resolveAction } from "./resolve";

describe("subjectOf", () => {
	it("keeps the words that name the subject", () => {
		expect(subjectOf("Is there an API to verify PAN?")).toBe("verify pan");
		expect(subjectOf("api")).toBe("");
	});
});

describe("detectIntent", () => {
	it.each([
		["is there an api to verify pan", "verify pan"],
		["dmt api", "dmt"],
		["check gst number", "check gst number"],
		["endpoint to send money", "send money"],
	])("%s → find_api (%s)", (query, subject) => {
		expect(detectIntent(query)).toEqual({
			intent: "find_api",
			subject,
			slots: {},
		});
	});

	// Plain keyword search keeps the palette's normal results — no card.
	it.each([["pricing"], ["bank account verification"], ["api"], [""]])(
		"%j → no intent",
		(query) => {
			expect(detectIntent(query)).toBeNull();
		},
	);
});

describe("resolveAction (real search index)", () => {
	const engine = buildEngine();

	it("sends a product name to the product page", () => {
		expect(resolveAction(engine, "dmt api")).toMatchObject({
			intent: "find_api",
			id: "action:find_api:dmt-api",
			badge: "Product",
			primary: { href: "/products/dmt-api" },
			secondary: [],
		});
	});

	it("sends an operation to its endpoint docs, with Try-it", () => {
		expect(resolveAction(engine, "fetch bill")).toMatchObject({
			id: "action:find_api:bbps-fetch-bill",
			badge: "GET",
			primary: { href: "/docs/bbps-fetch-bill" },
			secondary: [{ label: "Try it", href: "/docs/bbps-fetch-bill?try=1" }],
		});
	});

	it("returns no card for plain search or an empty subject", () => {
		expect(resolveAction(engine, "pricing")).toBeNull();
		expect(resolveAction(engine, "api")).toBeNull();
	});
});
