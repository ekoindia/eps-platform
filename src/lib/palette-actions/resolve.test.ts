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
		["check gst number", "gst number"],
		["cin lookup api", "cin"],
		["endpoint to send money", "send money"],
	])("%s → find_api (%s)", (query, subject) => {
		expect(detectIntent(query)).toEqual({
			intent: "find_api",
			subject,
			slots: {},
		});
	});

	it.each([
		["how do i integrate dmt", "dmt"],
		["How to recharge a mobile?", "recharge mobile"],
		["steps for aeps cash withdrawal", "aeps cash withdrawal"],
		["bbps bill payment flow", "bbps bill payment"],
	])("%s → how_to_build (%s)", (query, subject) => {
		expect(detectIntent(query)).toEqual({
			intent: "how_to_build",
			subject,
			slots: {},
		});
	});

	// Plain keyword search keeps the palette's normal results — no card.
	it.each([
		["pricing"],
		["bank account verification"],
		["api"],
		[""],
		// A lone verb names nothing to look up.
		["verify"],
	])(
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

	// Found by the query audit (scripts/palette-eval/audit.jsonl).
	it.each([
		["how do i start using eps", "get_started"],
		["how to onboard sender in dmt", "how_to_build"],
		["payout api", "find_api"],
	])("%s → %s", (query, intent) => {
		expect(detectIntent(query)?.intent).toBe(intent);
	});

	it("returns no card for plain search or an empty subject", () => {
		expect(resolveAction(engine, "pricing")).toBeNull();
		expect(resolveAction(engine, "api")).toBeNull();
	});

	// Query audit: a card must match every subject word (no OR fallback), and
	// a docs page as the best hit means the visitor wants that page instead.
	it.each([
		["cibil score api"],
		["how to cook biryani"],
		["api pricing"],
		["how does authentication work"],
	])("%s → no card", (query) => {
		expect(resolveAction(engine, query)).toBeNull();
	});

	it("sends a how-to question to its recipe, with the first step", () => {
		expect(resolveAction(engine, "how do i integrate dmt")).toMatchObject({
			intent: "how_to_build",
			id: "action:how_to_build:dmt-fino-send-money",
			badge: "Recipe",
			primary: { label: "Open recipe", href: "/recipe/dmt-fino-send-money" },
			secondary: [
				{
					label: expect.stringMatching(/^Step 1: /),
					href: "/docs/dmt-get-sender",
				},
			],
		});
	});

	it.each([
		["how to recharge mobile", "bbps-mobile-recharge"],
		["aeps cash withdrawal flow", "aeps-fingpay-cash-withdrawal"],
		["how do i send money", "dmt-fino-send-money"],
	])("%s → recipe %s", (query, slug) => {
		expect(resolveAction(engine, query)?.id).toBe(
			`action:how_to_build:${slug}`,
		);
	});

	// No recipe covers bank-account checks, but the question still names an
	// API — the card falls back to find_api rather than showing nothing.
	it("falls back to find_api when no recipe matches", () => {
		expect(
			resolveAction(engine, "how do i verify a bank account"),
		).toMatchObject({
			intent: "find_api",
			id: "action:find_api:bank-account-verification",
		});
	});
});
