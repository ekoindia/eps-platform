import { describe, expect, it } from "vitest";
import { GST_RATE } from "@/lib/data/api-pricing";
import {
	calcDmtQuote,
	calcDmtTxn,
	clampDmtAmount,
	DMT_MAX_TXN_AMOUNT,
	DMT_MIN_TXN_AMOUNT,
	DMT_RECIPIENT_VERIFY_FEE,
	dmtMaxCommission,
	dmtRateCardRows,
	dmtSenderKycInclGst,
	EKO_DMT_CHARGE,
} from "@/lib/data/dmt-pricing";
import { TDS_RATE } from "@/lib/data/payments-pricing";

describe("calcDmtTxn — published DMT charges schedule", () => {
	// The worked example from the DMT Charges brief. These six numbers are the
	// contract; if any of them move, the published rate card has changed.
	it("reproduces the ₹5,000 worked example exactly", () => {
		const txn = calcDmtTxn(5000);
		expect(txn.customerFee).toBe(50); // B — 1% of 5,000, incl. GST
		expect(txn.feeExGst).toBe(42.37); // C — fee excl. 18% GST
		expect(txn.ekoCharge).toBe(2.8); // D — flat Eko charge
		expect(txn.grossCommission).toBe(39.57); // E = C − D
		expect(txn.tds).toBe(0.79); // 2% of E
		expect(txn.netCommission).toBe(38.78); // F = E − TDS
	});

	it("floors the customer fee at ₹10 below ₹1,000", () => {
		for (const amount of [100, 500, 999, 1000]) {
			const txn = calcDmtTxn(amount);
			expect(txn.customerFee).toBe(10);
			expect(txn.grossCommission).toBe(5.67);
		}
		// …and tracks 1% above it
		expect(calcDmtTxn(1001).customerFee).toBe(10.01);
	});

	// Regression: the old DMT_SLABS table resolved every amount to its slab's
	// UPPER bound, so commission was flat across a slab instead of rising.
	it("scales continuously with amount rather than by slab", () => {
		expect(calcDmtTxn(2001).grossCommission).toBe(14.16); // old slab said 15.59
		expect(calcDmtTxn(2500).grossCommission).toBe(18.39);
		const rising = [2001, 2100, 2300, 2500].map(
			(a) => calcDmtTxn(a).grossCommission,
		);
		expect(rising).toStrictEqual([...rising].sort((a, b) => a - b));
		expect(new Set(rising).size).toBe(rising.length);
	});

	// Regression: DMT_SLABS deducted the ₹2.80 Eko charge TWICE.
	it("deducts the Eko charge exactly once", () => {
		for (const row of dmtRateCardRows()) {
			expect(+(row.feeExGst - row.grossCommission).toFixed(2)).toBe(
				EKO_DMT_CHARGE,
			);
		}
	});

	it("reconciles the GST inside the fee into its RCM and non-RCM parts", () => {
		for (const row of dmtRateCardRows()) {
			// The fee is GST-INCLUSIVE: taxable value + GST === fee
			expect(+(row.feeExGst + row.gstInFee).toFixed(2)).toBe(row.customerFee);
			// GST splits into the partner's supply (RCM, paid by Eko) and Eko's own
			expect(+(row.rcmGst + row.ekoGst).toFixed(2)).toBe(row.gstInFee);
			// The RCM figure is the one the partner puts on their invoice
			expect(row.rcmGst).toBe(
				Math.round(row.grossCommission * 100 * GST_RATE) / 100,
			);
		}
		expect(calcDmtTxn(5000).rcmGst).toBe(7.12);
	});

	it("clamps amounts to the supported range", () => {
		expect(clampDmtAmount(Number.NaN)).toBe(2500); // falls back to default
		expect(clampDmtAmount(-5)).toBe(DMT_MIN_TXN_AMOUNT);
		expect(clampDmtAmount(0)).toBe(DMT_MIN_TXN_AMOUNT);
		expect(clampDmtAmount(99_999)).toBe(DMT_MAX_TXN_AMOUNT);
		expect(clampDmtAmount(2500.4)).toBe(2500); // whole rupees only
	});

	it("never yields a negative commission, even at the fee floor", () => {
		expect(calcDmtTxn(DMT_MIN_TXN_AMOUNT).grossCommission).toBeGreaterThan(0);
	});
});

describe("dmtRateCardRows", () => {
	it("is derived from calcDmtTxn, so the card cannot drift", () => {
		for (const row of dmtRateCardRows()) {
			expect(row).toStrictEqual(calcDmtTxn(row.amount));
		}
	});

	it("headlines the maximum commission at the transfer cap", () => {
		expect(dmtMaxCommission()).toBe(39.57); // was 36.77 under the double deduction
	});
});

describe("calcDmtQuote", () => {
	const base = {
		amount: 2500,
		monthlyTxns: 1000,
		newSendersPerMonth: 50,
		newRecipientsPerMonth: 80,
		recoverChargesFromCustomer: false,
	};

	it("withholds TDS on the monthly aggregate, not per transaction", () => {
		const quote = calcDmtQuote(base);
		expect(quote.monthlyGross).toBe(18_390);
		expect(quote.monthlyTds).toBe(367.8);
		expect(quote.monthlyNetCommission).toBe(18_022.2);
		// Rounding per transaction first would over-withhold — lock the difference
		expect(quote.perTxn.tds * base.monthlyTxns).toBe(370);
		expect(quote.monthlyTds).not.toBe(quote.perTxn.tds * base.monthlyTxns);
		expect(quote.monthlyTds).toBe(
			Math.round(quote.monthlyGross * 100 * TDS_RATE) / 100,
		);
	});

	it("debits sender KYC and recipient verification from the wallet", () => {
		const quote = calcDmtQuote(base);
		expect(dmtSenderKycInclGst()).toBe(12.98); // ₹11 + 18% GST
		expect(quote.senderKycCost).toBe(649); // 50 × 12.98
		expect(quote.recipientVerifyCost).toBe(260); // 80 × 3.25, already incl. GST
		expect(DMT_RECIPIENT_VERIFY_FEE).toBe(3.25);
		expect(quote.addOnCost).toBe(909);
		expect(quote.monthlyTakeHome).toBe(17_113.2);
	});

	// The wallet debit happens whether or not the partner passes the charge on;
	// recovery is an offsetting credit, never a suppressed cost.
	it("models recovery as a credit without hiding the debit", () => {
		const quote = calcDmtQuote({ ...base, recoverChargesFromCustomer: true });
		expect(quote.addOnCost).toBe(909);
		expect(quote.recoveredFromCustomer).toBe(909);
		expect(quote.monthlyTakeHome).toBe(quote.monthlyNetCommission);
	});

	it("charges no add-ons when there are no new senders or recipients", () => {
		const quote = calcDmtQuote({
			...base,
			newSendersPerMonth: 0,
			newRecipientsPerMonth: 0,
		});
		expect(quote.addOnCost).toBe(0);
		expect(quote.monthlyTakeHome).toBe(quote.monthlyNetCommission);
	});

	it("clamps hostile inputs instead of producing NaN", () => {
		const quote = calcDmtQuote({
			amount: Number.NaN,
			monthlyTxns: -50,
			newSendersPerMonth: 12.7,
			newRecipientsPerMonth: Number.NaN,
			recoverChargesFromCustomer: false,
		});
		expect(quote.input.monthlyTxns).toBe(0);
		expect(quote.input.newSendersPerMonth).toBe(13);
		expect(quote.input.newRecipientsPerMonth).toBe(0);
		expect(Number.isFinite(quote.monthlyTakeHome)).toBe(true);
	});

	it("activates the setup fee only once there is volume", () => {
		expect(calcDmtQuote({ ...base, monthlyTxns: 0 }).setupFee.amount).toBe(0);
		expect(calcDmtQuote(base).setupFee.amount).toBe(20_000);
	});
});
