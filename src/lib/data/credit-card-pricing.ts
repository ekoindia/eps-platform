/**
 * Pricing configuration for Credit Card Bill Payment.
 *
 * Pure data + math module — no React or UI imports — shared by the pricing
 * page, the markdown renderer, the JSON-LD catalog, the ⌘K palette and the
 * build-time Excel generator.
 *
 * Unlike the other BBPS categories (which pay the partner a commission),
 * Credit Card Bill Payment is a COST to the partner: a flat fee per payment,
 * plus its own one-time setup fee. All amounts are in INR, EXCLUSIVE of
 * GST @ 18%.
 */

import {
	GST_RATE,
	buildSetupFeeQuote,
	type PricingFaq,
	type SetupFeeQuote,
} from "./api-pricing";

/** Flat fee per credit card bill payment (₹, excl. GST), any bill amount */
export const CC_FEE_PER_TXN = 5;

/**
 * One-time setup fee for the Credit Card Bill Payment API (₹, excl. GST,
 * before the site-wide setup-fee discount). Separate from — and charged in
 * addition to — the BBPS setup fee.
 */
export const CC_SETUP_FEE = 20_000;

/** Upper bound for the monthly payment count input */
export const CC_MAX_TXNS = 10_000_000;

/** Default monthly payment count for the calculator */
export const CC_DEFAULT_TXNS = 500;

export interface CcQuote {
	/** Monthly payment count actually priced (clamped) */
	monthlyTxns: number;
	/** Fee per payment (₹, excl. GST) */
	perTxn: number;
	/** Monthly fees (₹, excl. GST) */
	monthlySubtotal: number;
	/** GST on the monthly fees */
	monthlyGst: number;
	/** monthlySubtotal + monthlyGst */
	monthlyTotal: number;
	/** One-time setup fee (zero when no payments are planned) */
	setupFee: SetupFeeQuote;
}

/** Rounds an INR value to whole paise to avoid float drift */
const toPaise = (inr: number): number => Math.round(inr * 100);

/**
 * Clamps a monthly payment count to a whole number within the supported range.
 * @param txns - Raw monthly payment count
 */
export const clampCcTxns = (txns: number): number =>
	Math.min(
		Math.max(Math.round(Number.isFinite(txns) ? txns : 0), 0),
		CC_MAX_TXNS,
	);

/**
 * Computes the Credit Card Bill Payment cost quote: monthly fees with GST
 * broken out, plus the one-time setup fee (discounted like every other
 * setup fee on the site). Zero payments carry no setup fee.
 * @param monthlyTxns - Monthly credit card bill payment count
 */
export const calcCcQuote = (monthlyTxns: number): CcQuote => {
	const txns = clampCcTxns(monthlyTxns);
	const monthlyPaise = toPaise(CC_FEE_PER_TXN) * txns;
	const monthlyGstPaise = Math.round(monthlyPaise * GST_RATE);

	return {
		monthlyTxns: txns,
		perTxn: CC_FEE_PER_TXN,
		monthlySubtotal: monthlyPaise / 100,
		monthlyGst: monthlyGstPaise / 100,
		monthlyTotal: (monthlyPaise + monthlyGstPaise) / 100,
		setupFee: buildSetupFeeQuote(txns > 0 ? toPaise(CC_SETUP_FEE) : 0),
	};
};

/**
 * Credit Card Bill Payment FAQs — sourced into the /pricing page, its
 * FAQPage JSON-LD and the generated /pricing.md markdown.
 */
export const CC_FAQS: PricingFaq[] = [
	{
		q: "How much does credit card bill payment cost?",
		a: `A flat **₹${CC_FEE_PER_TXN} per payment** + GST @ ${Math.round(GST_RATE * 100)}% (₹${(CC_FEE_PER_TXN * (1 + GST_RATE)).toFixed(2)} in total), whatever the bill amount.`,
	},
	{
		q: "Why is credit card bill payment charged when other BBPS bills earn a commission?",
		a: "Credit card bill payment is a separate API with its own cost structure. Other BBPS categories (electricity, DTH, FASTag and so on) pay you a commission; credit card bill payments carry a per-payment fee instead.",
	},
	{
		q: "Is there a setup fee for credit card bill payment?",
		a: `Yes — a one-time setup fee of **₹${CC_SETUP_FEE.toLocaleString("en-IN")}** (excl. GST) for the Credit Card Bill Payment API, separate from the BBPS setup fee.`,
	},
];
