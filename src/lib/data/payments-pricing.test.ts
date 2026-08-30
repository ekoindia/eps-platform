import { describe, expect, it } from "vitest";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_CATEGORIES,
	BBPS_CATEGORIES_MAP,
	calcEarningsQuote,
	clampAvgAmount,
	commissionForAmount,
	commissionPerTxn,
	EARNINGS_PRODUCTS,
	EARNINGS_PRODUCTS_MAP,
	MAX_TXNS,
	BC_SETUP_FEE,
	bcSetupFeeFaqAnswer,
	calcPaymentsSetupFee,
} from "@/lib/data/payments-pricing";
import {
	SETUP_FEE_DISCOUNT_PERCENT,
	applySetupFeeDiscount,
} from "@/lib/data/api-pricing";

describe("commissionForAmount (AePS cashout)", () => {
	it("uses 0.40% up to ₹3,000 and ₹13 flat above", () => {
		expect(commissionForAmount(AEPS_CASHOUT_SLABS, 1000)).toBe(4);
		expect(commissionForAmount(AEPS_CASHOUT_SLABS, 3000)).toBe(12);
		expect(commissionForAmount(AEPS_CASHOUT_SLABS, 3001)).toBe(13);
		expect(commissionForAmount(AEPS_CASHOUT_SLABS, 10000)).toBe(13);
	});

	it("rounds percentage commissions to whole paise", () => {
		// 0.4% of ₹1,111 = ₹4.444 → ₹4.44
		expect(commissionForAmount(AEPS_CASHOUT_SLABS, 1111)).toBe(4.44);
	});
});

describe("AEPS_SETTLEMENT_CHARGES", () => {
	it("charges ₹5 up to ₹25,000 and ₹10 above, with no upper cap", () => {
		expect(commissionForAmount(AEPS_SETTLEMENT_CHARGES, 25000)).toBe(5);
		expect(commissionForAmount(AEPS_SETTLEMENT_CHARGES, 25001)).toBe(10);
		expect(commissionForAmount(AEPS_SETTLEMENT_CHARGES, 500000)).toBe(10);
	});

	it("leaves the top slab uncapped so it renders as a \"₹25,001+\" range", () => {
		const top = AEPS_SETTLEMENT_CHARGES[AEPS_SETTLEMENT_CHARGES.length - 1];
		expect(top.upTo).toBeNull();
	});
});

describe("BBPS electricity slabs", () => {
	const electricity = BBPS_CATEGORIES_MAP["bbps-electricity"];

	it("resolves all four amount slabs at their boundaries", () => {
		expect(commissionForAmount(electricity.slabs, 5000)).toBe(1.2);
		expect(commissionForAmount(electricity.slabs, 5001)).toBeCloseTo(26.01, 2);
		expect(commissionForAmount(electricity.slabs, 20000)).toBe(104);
		expect(commissionForAmount(electricity.slabs, 20001)).toBeCloseTo(120, 1);
		expect(commissionForAmount(electricity.slabs, 100000)).toBe(600);
		expect(commissionForAmount(electricity.slabs, 100001)).toBeCloseTo(320, 1);
	});
});

describe("commissionPerTxn", () => {
	it("returns the mini-statement flat rate regardless of amount", () => {
		expect(commissionPerTxn("aeps-mini", 0)).toBe(0.75);
		expect(commissionPerTxn("aeps-mini", 5000)).toBe(0.75);
	});

	it("returns 0 for unknown product ids", () => {
		expect(commissionPerTxn("nope", 1000)).toBe(0);
	});
});

describe("clampAvgAmount", () => {
	it("clamps to the product's max txn amount", () => {
		const cashout = EARNINGS_PRODUCTS_MAP["aeps-cashout"];
		expect(clampAvgAmount(cashout, 99999)).toBe(10000);
		expect(clampAvgAmount(cashout, -5)).toBe(1);
		expect(clampAvgAmount(cashout, Number.NaN)).toBe(1);
	});
});

describe("calcEarningsQuote", () => {
	it("ignores unknown product ids", () => {
		const quote = calcEarningsQuote([
			{ productId: "nope", monthlyTxns: 100, avgAmount: 100 },
		]);
		expect(quote.lines).toHaveLength(0);
		expect(quote.total).toBe(0);
	});

	it("computes line earnings and totals in exact paise", () => {
		const quote = calcEarningsQuote([
			{ productId: "aeps-cashout", monthlyTxns: 1000, avgAmount: 2000 },
			{ productId: "aeps-mini", monthlyTxns: 500 },
		]);
		expect(quote.lines[0].perTxn).toBe(8); // 0.40% of ₹2,000
		expect(quote.lines[0].monthlyEarnings).toBe(8000);
		expect(quote.lines[1].monthlyEarnings).toBe(375);
		expect(quote.total).toBe(8375);
		expect(quote.totalAfterTds).toBe(8207.5); // 8375 × (1 − TDS_RATE), paise-exact
		expect(quote.totalTxns).toBe(1500);
	});

	it("clamps txn counts and amounts", () => {
		const quote = calcEarningsQuote([
			{ productId: "aeps-cashout", monthlyTxns: MAX_TXNS * 2, avgAmount: 99999 },
		]);
		expect(quote.lines[0].monthlyTxns).toBe(MAX_TXNS);
		expect(quote.lines[0].avgAmount).toBe(10000);
	});

	it("falls back to the product's default avg amount", () => {
		const quote = calcEarningsQuote([
			{ productId: "aeps-cashout", monthlyTxns: 10 },
		]);
		expect(quote.lines[0].avgAmount).toBe(
			EARNINGS_PRODUCTS_MAP["aeps-cashout"].defaultAvgAmount,
		);
	});
});

describe("EARNINGS_PRODUCTS", () => {
	// DMT is deliberately absent — it lives in dmt-pricing.ts / its own tab.
	it("covers both AePS products and every BBPS category, but not DMT", () => {
		expect(EARNINGS_PRODUCTS).toHaveLength(2 + BBPS_CATEGORIES.length);
		expect(EARNINGS_PRODUCTS.map((p) => p.id)).not.toContain("dmt");
		expect(
			EARNINGS_PRODUCTS.filter((p) => !p.needsAmount).map((p) => p.id),
		).toEqual(["aeps-mini"]);
	});

	it("has unique URL-stable ids", () => {
		const ids = EARNINGS_PRODUCTS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("calcPaymentsSetupFee", () => {
	const bbpsIds = BBPS_CATEGORIES.slice(0, 3).map((c) => c.id);

	it("charges once per API family, however many BBPS categories are picked", () => {
		expect(calcPaymentsSetupFee(bbpsIds).amount).toBe(BC_SETUP_FEE);
		expect(calcPaymentsSetupFee(["aeps-cashout", "aeps-mini"]).amount).toBe(
			BC_SETUP_FEE,
		);
	});

	it("adds up across families", () => {
		expect(calcPaymentsSetupFee(["aeps-cashout", bbpsIds[0]]).amount).toBe(
			BC_SETUP_FEE * 2,
		);
	});

	it("ignores unknown ids and charges nothing for an empty selection", () => {
		expect(calcPaymentsSetupFee([]).amount).toBe(0);
		expect(calcPaymentsSetupFee(["not-a-product"]).amount).toBe(0);
	});

	it("applies the site-wide discount and GST", () => {
		const quote = calcPaymentsSetupFee(["aeps-cashout"]);
		expect(quote.discountPercent).toBe(SETUP_FEE_DISCOUNT_PERCENT);
		expect(quote.payable).toBe(
			applySetupFeeDiscount(BC_SETUP_FEE * 100, SETUP_FEE_DISCOUNT_PERCENT),
		);
		expect(quote.total).toBeCloseTo(quote.payable * 1.18, 2);
	});
});

describe("calcEarningsQuote setup fee", () => {
	it("only counts families with non-zero transactions", () => {
		const quote = calcEarningsQuote([
			{ productId: "aeps-cashout", monthlyTxns: 100 },
			{ productId: "bbps-electricity", monthlyTxns: 0 },
		]);
		expect(quote.setupFee.amount).toBe(BC_SETUP_FEE);
	});

	it("keeps the one-time cost out of the commission totals", () => {
		const quote = calcEarningsQuote([
			{ productId: "aeps-cashout", monthlyTxns: 100 },
		]);
		// Holds at every discount level, including a full waiver (payable 0).
		expect(quote.setupFee.amount).toBeGreaterThan(0);
		expect(quote.totalAfterTds).toBeLessThan(quote.total);
		expect(quote.total).toBeCloseTo(quote.lines[0].monthlyEarnings, 2);
	});
});

describe("bcSetupFeeFaqAnswer", () => {
	it("never promises a waiver it is not running", () => {
		expect(bcSetupFeeFaqAnswer(100)).toContain("fully waived");
		expect(bcSetupFeeFaqAnswer(50)).toContain("50% off");
		expect(bcSetupFeeFaqAnswer(0)).not.toContain("limited-time");
	});

	it("always names the per-family fee", () => {
		for (const percent of [0, 50, 100]) {
			expect(bcSetupFeeFaqAnswer(percent)).toContain(
				BC_SETUP_FEE.toLocaleString("en-IN"),
			);
		}
	});
});
