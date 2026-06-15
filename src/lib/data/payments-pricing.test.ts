import { describe, expect, it } from "vitest";
import {
	AEPS_CASHOUT_SLABS,
	BBPS_CATEGORIES,
	BBPS_CATEGORIES_MAP,
	calcEarningsQuote,
	clampAvgAmount,
	commissionForAmount,
	commissionPerTxn,
	DMT_SLABS,
	dmtCommissionForAmount,
	dmtSlabForAmount,
	EARNINGS_PRODUCTS,
	EARNINGS_PRODUCTS_MAP,
	MAX_TXNS,
} from "@/lib/data/payments-pricing";

describe("DMT_SLABS", () => {
	it("is ascending and contiguous (VLOOKUP-safe)", () => {
		for (let i = 1; i < DMT_SLABS.length; i++) {
			expect(DMT_SLABS[i].from).toBe(DMT_SLABS[i - 1].upTo + 1);
			expect(DMT_SLABS[i].commission).toBeGreaterThan(
				DMT_SLABS[i - 1].commission,
			);
		}
	});
});

describe("dmtCommissionForAmount", () => {
	it("resolves slab boundaries correctly", () => {
		expect(dmtCommissionForAmount(100)).toBe(2.87);
		expect(dmtCommissionForAmount(1000)).toBe(2.87);
		expect(dmtCommissionForAmount(1001)).toBe(3.72);
		expect(dmtCommissionForAmount(2000)).toBe(11.35);
		expect(dmtCommissionForAmount(2001)).toBe(15.59);
		expect(dmtCommissionForAmount(5000)).toBe(36.77);
	});

	it("clamps amounts above the table to the last slab", () => {
		expect(dmtCommissionForAmount(99999)).toBe(36.77);
	});

	it("matches dmtSlabForAmount", () => {
		expect(dmtSlabForAmount(2500).commission).toBe(
			dmtCommissionForAmount(2500),
		);
	});
});

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
		const dmt = EARNINGS_PRODUCTS_MAP["dmt"];
		expect(clampAvgAmount(dmt, 99999)).toBe(5000);
		expect(clampAvgAmount(dmt, -5)).toBe(1);
		expect(clampAvgAmount(dmt, Number.NaN)).toBe(1);
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
			{ productId: "dmt", monthlyTxns: 1000, avgAmount: 2500 },
			{ productId: "aeps-mini", monthlyTxns: 500 },
		]);
		expect(quote.lines[0].perTxn).toBe(15.59);
		expect(quote.lines[0].monthlyEarnings).toBe(15590);
		expect(quote.lines[1].monthlyEarnings).toBe(375);
		expect(quote.total).toBe(15965);
		expect(quote.totalAfterTds).toBe(15645.7); // 15965 × (1 − TDS_RATE), paise-exact
		expect(quote.totalTxns).toBe(1500);
	});

	it("clamps txn counts and amounts", () => {
		const quote = calcEarningsQuote([
			{ productId: "dmt", monthlyTxns: MAX_TXNS * 2, avgAmount: 99999 },
		]);
		expect(quote.lines[0].monthlyTxns).toBe(MAX_TXNS);
		expect(quote.lines[0].avgAmount).toBe(5000);
	});

	it("falls back to the product's default avg amount", () => {
		const quote = calcEarningsQuote([{ productId: "dmt", monthlyTxns: 10 }]);
		expect(quote.lines[0].avgAmount).toBe(
			EARNINGS_PRODUCTS_MAP["dmt"].defaultAvgAmount,
		);
	});
});

describe("EARNINGS_PRODUCTS", () => {
	it("covers DMT, both AePS products and every BBPS category", () => {
		expect(EARNINGS_PRODUCTS).toHaveLength(3 + BBPS_CATEGORIES.length);
		expect(
			EARNINGS_PRODUCTS.filter((p) => !p.needsAmount).map((p) => p.id),
		).toEqual(["aeps-mini"]);
	});

	it("has unique URL-stable ids", () => {
		const ids = EARNINGS_PRODUCTS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
