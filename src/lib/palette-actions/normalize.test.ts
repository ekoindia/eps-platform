import { describe, expect, it } from "vitest";
import { normalizeAmounts } from "./normalize";

describe("normalizeAmounts", () => {
	it.each([
		["earn on ₹5,000 dmt", "earn on 5000 dmt"],
		["500 txns of 2 lakh", "500 txns of 200000"],
		["1.5 lakh a month", "150000 a month"],
		["Rs. 1,50,000", "150000"],
		["5k transfers", "5000 transfers"],
		["2 cr volume", "20000000 volume"],
		["INR 750", "750"],
	])("%s → %s", (input, expected) => {
		expect(normalizeAmounts(input)).toBe(expected);
	});

	// Words that merely contain a unit letter must survive.
	it("leaves non-amount words alone", () => {
		expect(normalizeAmounts("kyc for lending app")).toBe("kyc for lending app");
		expect(normalizeAmounts("bank account verification")).toBe(
			"bank account verification",
		);
	});
});
