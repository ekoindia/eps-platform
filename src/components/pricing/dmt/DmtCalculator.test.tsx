import { describe, expect, it } from "vitest";
import { parseInputFromParams } from "@/components/pricing/dmt/DmtCalculator";
import { calcDmtQuote } from "@/lib/data/dmt-pricing";
import { MAX_TXNS } from "@/lib/data/payments-pricing";

const parse = (raw?: string) =>
	parseInputFromParams(new URLSearchParams(raw ? { dmt: raw } : {}));

describe("parseInputFromParams (?dmt=)", () => {
	it("round-trips a well-formed param", () => {
		expect(parse("2500:1000:50:80:1")).toStrictEqual({
			amount: 2500,
			monthlyTxns: 1000,
			newSendersPerMonth: 50,
			newRecipientsPerMonth: 80,
			recoverChargesFromCustomer: true,
		});
		expect(parse("2500:1000:50:80:0")?.recoverChargesFromCustomer).toBe(false);
	});

	it("returns null when the param is absent, leaving defaults in place", () => {
		expect(parse()).toBeNull();
	});

	// Regression: a hostile ?dmt= used to be clamped by the math but rendered
	// RAW back into the number inputs — "-99" displayed above a "-₹0" line.
	it("clamps hostile values so nothing raw reaches the inputs", () => {
		const input = parse("abc::-99:xyz");
		expect(input).not.toBeNull();
		expect(input?.amount).toBe(2500); // "abc" → default
		expect(input?.monthlyTxns).toBe(0); // "" → 0, not NaN
		expect(input?.newSendersPerMonth).toBe(0); // never negative
		expect(input?.newRecipientsPerMonth).toBe(80); // "xyz" → default
		for (const value of Object.values(input ?? {})) {
			expect(Number.isNaN(value)).toBe(false);
		}
	});

	it("clamps out-of-range amounts and counts to the supported bounds", () => {
		expect(parse("99999:1:1:1:0")?.amount).toBe(5000);
		expect(parse("1:1:1:1:0")?.amount).toBe(100);
		expect(parse(`2500:${MAX_TXNS * 2}:0:0:0`)?.monthlyTxns).toBe(MAX_TXNS);
		expect(parse("2500:12.7:0:0:0")?.monthlyTxns).toBe(13); // whole counts
	});

	it("feeds a quote that matches the ledger for a shared link", () => {
		const quote = calcDmtQuote(parse("5000:100:0:0:0")!);
		expect(quote.perTxn.grossCommission).toBe(39.57);
		expect(quote.monthlyGross).toBe(3957);
		expect(quote.monthlyTakeHome).toBe(3877.86); // 3957 − 2% TDS, no add-ons
	});
});
