import { pushDataLayer, redactIdentifiers } from "@/lib/analytics";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
	delete window.dataLayer;
});

describe("redactIdentifiers", () => {
	// The Connect widget's step labels are written in another codebase and land on
	// Google's servers verbatim, so anything customer-identifying has to go.
	it("removes numbers long enough to identify a customer", () => {
		expect(redactIdentifiers("Send to 9876543210")).toBe("Send to …");
		expect(redactIdentifiers("A/c 123456789012 verified")).toBe(
			"A/c … verified",
		);
		expect(redactIdentifiers("TID 88123456 and 99123456")).toBe("TID … and …");
	});

	// ⌘K queries are typed or pasted, so identifiers arrive spaced, lowercase or
	// embedded in a sentence.
	it("removes spaced numbers, PANs, emails and keys", () => {
		expect(redactIdentifiers("aadhaar 1234 5678 9012 check")).toBe(
			"aadhaar … check",
		);
		expect(redactIdentifiers("call 98765-43210")).toBe("call …");
		expect(redactIdentifiers("verify pan abcde1234f now")).toBe(
			"verify pan … now",
		);
		expect(redactIdentifiers("mail me at a.b@example.com")).toBe(
			"mail me at …",
		);
		expect(
			redactIdentifiers("key 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d failing"),
		).toBe("key … failing");
	});

	it("leaves step names and short numbers readable", () => {
		expect(redactIdentifiers("Money Transfer > Add Recipient")).toBe(
			"Money Transfer > Add Recipient",
		);
		// Interaction ids, step counts and amounts under six digits stay useful.
		expect(redactIdentifiers("Step 2 of 5 (491)")).toBe("Step 2 of 5 (491)");
		expect(redactIdentifiers("earn on 500 DMT of 20000 avg")).toBe(
			"earn on 500 DMT of 20000 avg",
		);
		expect(redactIdentifiers("bank-account-verification")).toBe(
			"bank-account-verification",
		);
	});
});

describe("pushDataLayer", () => {
	it("pushes the event name alongside its params", () => {
		window.dataLayer = [];

		pushDataLayer("connect_widget", { category: "Transaction", label: "x" });

		expect(window.dataLayer).toEqual([
			{ event: "connect_widget", category: "Transaction", label: "x" },
		]);
	});

	// A blocked or slow tag manager must never take down the flow being measured.
	it("does nothing when the container never loaded", () => {
		expect(() => pushDataLayer("connect_widget", {})).not.toThrow();
	});
});
