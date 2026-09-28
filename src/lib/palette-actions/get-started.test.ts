import { buildEngine } from "@/lib/search-engine";
import { ESIGN_PATH } from "@/lib/connect/esign";
import { describe, expect, it } from "vitest";
import { resolveGetStarted } from "./get-started";
import { detectIntent } from "./intent";
import { resolveAction } from "./resolve";

describe("detectIntent → get_started", () => {
	it.each([
		["how do i get started"],
		["how do I go live?"],
		["get api keys"],
		["production credentials"],
		["sign up"],
		["what are my next steps"],
		["integration fee"],
	])("%s", (query) => {
		expect(detectIntent(query)?.intent).toBe("get_started");
	});

	// KYC *APIs* are products; "kyc" alone must stay a find/search query.
	it.each([["kyc api"], ["how to integrate dmt"], ["pricing"]])(
		"%s → not get_started",
		(query) => {
			expect(detectIntent(query)?.intent).not.toBe("get_started");
		},
	);
});

describe("resolveGetStarted", () => {
	it("sends a visitor to sign up", () => {
		expect(resolveGetStarted({ kind: "anon" })).toMatchObject({
			intent: "get_started",
			id: "action:get_started:signup",
			primary: { href: "/signup" },
			secondary: [{ href: "/docs" }],
		});
	});

	it("sends a part-signed-up user back to sign-up", () => {
		expect(resolveGetStarted({ kind: "signup" })).toMatchObject({
			id: "action:get_started:finish-signup",
			primary: { href: "/signup" },
		});
	});

	it("gives an admin no card", () => {
		expect(resolveGetStarted({ kind: "admin" })).toBeNull();
	});

	it("asks a developer for the owed signature first", () => {
		expect(
			resolveGetStarted({
				kind: "developer",
				state: "kyc-pending",
				esignPending: true,
			}),
		).toMatchObject({
			id: "action:get_started:esign",
			primary: { href: ESIGN_PATH },
			secondary: [{ href: "/console/pay-activation-fee" }],
		});
	});

	it("asks a developer for the KYC pack while it is owed", () => {
		expect(
			resolveGetStarted({
				kind: "developer",
				state: "kyc-rejected",
				esignPending: false,
			}),
		).toMatchObject({
			id: "action:get_started:kyc-upload",
			primary: { label: "Re-upload", href: "/console/documents" },
		});
	});

	it("sends an active developer to production credentials", () => {
		expect(
			resolveGetStarted({
				kind: "developer",
				state: "active",
				esignPending: false,
			}),
		).toMatchObject({
			id: "action:get_started:credentials",
			primary: { href: "/console/credentials" },
		});
	});
});

describe("resolveAction → get_started", () => {
	const engine = buildEngine();

	it("uses the session it is given", () => {
		expect(
			resolveAction(engine, "how do i go live", {
				kind: "developer",
				state: "kyc-pending",
				esignPending: false,
			})?.id,
		).toBe("action:get_started:kyc-upload");
	});

	it("treats a missing session as a visitor", () => {
		expect(resolveAction(engine, "how do i get started")?.id).toBe(
			"action:get_started:signup",
		);
	});
});
