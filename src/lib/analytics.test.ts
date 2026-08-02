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

	it("leaves step names and short numbers readable", () => {
		expect(redactIdentifiers("Money Transfer > Add Recipient")).toBe(
			"Money Transfer > Add Recipient",
		);
		// Interaction ids, step counts and amounts under six digits stay useful.
		expect(redactIdentifiers("Step 2 of 5 (491)")).toBe("Step 2 of 5 (491)");
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
