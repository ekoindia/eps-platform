import { describe, expect, it } from "vitest";
import {
	PRICED_APIS,
	SETUP_FEE_CLAUSE,
	SETUP_FEE_DISCOUNT_PERCENT,
	SETUP_FEE_OFFER_LABEL,
	VERIFICATION_SETUP_FEE,
	applySetupFeeDiscount,
	calcQuote,
	calcSetupFee,
	clampDiscountPercent,
	sentences,
	setupFeeBadgeLabel,
	setupFeeClause,
	setupFeeFor,
	setupFeeOfferLabel,
} from "./api-pricing";

describe("clampDiscountPercent", () => {
	it("normalises out-of-range, fractional and non-finite inputs", () => {
		expect(clampDiscountPercent(-10)).toBe(0);
		expect(clampDiscountPercent(150)).toBe(100);
		expect(clampDiscountPercent(33.4)).toBe(33);
		expect(clampDiscountPercent(Number.NaN)).toBe(0);
		expect(clampDiscountPercent(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe("setup-fee copy builders", () => {
	it("says nothing at 0 so callers leave no gap", () => {
		expect(setupFeeClause(0)).toBe("");
		expect(setupFeeOfferLabel(0)).toBe("");
		expect(sentences("Pay per use.", setupFeeClause(0), "Sandbox free.")).toBe(
			"Pay per use. Sandbox free.",
		);
	});

	it("claims a full waiver only at 100", () => {
		expect(setupFeeClause(100)).toBe("No setup fee.");
		expect(setupFeeOfferLabel(100)).toContain("₹0 setup fee");
	});

	it("states the percentage in between", () => {
		expect(setupFeeClause(50)).toBe("50% off setup fee.");
		expect(setupFeeOfferLabel(50)).toBe(
			"50% off setup fee — limited-time offer",
		);
	});

	it("keeps the quote-line badge short — the row label already says 'setup fee'", () => {
		expect(setupFeeBadgeLabel(50)).toBe("50% off — limited time");
		expect(setupFeeBadgeLabel(100)).toBe("Waived — limited time");
		expect(setupFeeBadgeLabel(0)).toBe("");
		// Must stay well shorter than the chip label or it crushes the label
		// column in the narrow summary sidebar.
		expect(setupFeeBadgeLabel(50).length).toBeLessThan(
			setupFeeOfferLabel(50).length,
		);
	});

	it("clamps inside the builder, so no caller can emit 0% or 33.4%", () => {
		expect(setupFeeClause(150)).toBe("No setup fee.");
		expect(setupFeeClause(33.4)).toBe("33% off setup fee.");
		expect(setupFeeOfferLabel(Number.NaN)).toBe("");
	});

	it("exports the running offer's copy for the configured percentage", () => {
		expect(SETUP_FEE_CLAUSE).toBe(setupFeeClause(SETUP_FEE_DISCOUNT_PERCENT));
		expect(SETUP_FEE_OFFER_LABEL).toBe(
			setupFeeOfferLabel(SETUP_FEE_DISCOUNT_PERCENT),
		);
	});
});

describe("applySetupFeeDiscount", () => {
	it("rounds to whole paise rather than leaving float dust", () => {
		// ₹999.99 at 50% is ₹499.995 — must land on ₹500.00, not ₹499.995.
		expect(applySetupFeeDiscount(99_999, 50)).toBe(500);
	});

	it("returns the full amount at 0 and nothing at 100", () => {
		expect(applySetupFeeDiscount(600_000, 0)).toBe(6_000);
		expect(applySetupFeeDiscount(600_000, 100)).toBe(0);
	});
});

describe("setupFeeFor", () => {
	it("defaults every API to the standard fee unless it opts out with 0", () => {
		for (const api of PRICED_APIS) {
			const expected = api.setupFee ?? VERIFICATION_SETUP_FEE;
			expect(setupFeeFor(api)).toBe(expected);
			// An exemption must be deliberate — an explicit 0, never an omission.
			if (setupFeeFor(api) === 0) expect(api.setupFee).toBe(0);
		}
	});
});

describe("calcSetupFee", () => {
	it("charges the standard fee per selected API", () => {
		const quote = calcSetupFee(["pan-lite", "upi-vpa"]);
		expect(quote.amount).toBe(VERIFICATION_SETUP_FEE * 2);
		expect(quote.discountPercent).toBe(SETUP_FEE_DISCOUNT_PERCENT);
		expect(quote.payable).toBe(
			applySetupFeeDiscount(quote.amount * 100, SETUP_FEE_DISCOUNT_PERCENT),
		);
	});

	it("adds GST on the discounted payable, not the list amount", () => {
		const quote = calcSetupFee(["pan-lite"]);
		expect(quote.total).toBeCloseTo(quote.payable + quote.gst, 2);
		expect(quote.gst).toBeCloseTo(quote.payable * 0.18, 2);
	});

	it("ignores unknown api ids", () => {
		expect(calcSetupFee(["not-an-api"]).amount).toBe(0);
	});
});

describe("calcQuote setup-fee activation", () => {
	it("only charges APIs that are actually used", () => {
		const parked = calcQuote([{ apiId: "pan-lite", volume: 0 }]);
		expect(parked.setupFee.amount).toBe(0);

		const used = calcQuote([
			{ apiId: "pan-lite", volume: 1_000 },
			{ apiId: "upi-vpa", volume: 0 },
		]);
		expect(used.setupFee.amount).toBe(VERIFICATION_SETUP_FEE);
	});

	it("keeps the one-time fee out of the monthly total", () => {
		const quote = calcQuote([{ apiId: "pan-lite", volume: 1_000 }]);
		expect(quote.total).toBeCloseTo(quote.subtotal + quote.gst, 2);
		// Holds at every discount level, including a full waiver (payable 0).
		expect(quote.setupFee.amount).toBeGreaterThan(0);
	});
});
