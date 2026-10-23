import { describe, expect, it } from "vitest";
import { SETUP_FEE_DISCOUNT_PERCENT } from "@/lib/data/api-pricing";
import {
	CC_MAX_TXNS,
	CC_SETUP_FEE,
	calcCcQuote,
	clampCcTxns,
} from "@/lib/data/credit-card-pricing";

describe("calcCcQuote", () => {
	it("charges a flat ₹5 + 18% GST per payment", () => {
		const quote = calcCcQuote(500);
		expect(quote.perTxn).toBe(5);
		expect(quote.monthlySubtotal).toBe(2500);
		expect(quote.monthlyGst).toBe(450);
		expect(quote.monthlyTotal).toBe(2950);
	});

	it("applies the site-wide discount to its own setup fee", () => {
		const { setupFee } = calcCcQuote(500);
		expect(setupFee.amount).toBe(CC_SETUP_FEE);
		expect(setupFee.discountPercent).toBe(SETUP_FEE_DISCOUNT_PERCENT);
		expect(setupFee.payable).toBe(
			CC_SETUP_FEE * (1 - SETUP_FEE_DISCOUNT_PERCENT / 100),
		);
	});

	it("carries no fees at zero payments", () => {
		const quote = calcCcQuote(0);
		expect(quote.monthlyTotal).toBe(0);
		expect(quote.setupFee.amount).toBe(0);
		expect(quote.setupFee.total).toBe(0);
	});
});

describe("clampCcTxns", () => {
	it("rounds and clamps bad input", () => {
		expect(clampCcTxns(-5)).toBe(0);
		expect(clampCcTxns(12.6)).toBe(13);
		expect(clampCcTxns(Number.NaN)).toBe(0);
		expect(clampCcTxns(CC_MAX_TXNS + 1)).toBe(CC_MAX_TXNS);
	});
});
