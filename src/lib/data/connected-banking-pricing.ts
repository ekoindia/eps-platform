/**
 * Pricing configuration for Connected Banking (virtual accounts & BaaS).
 *
 * Pure data + math module — no React or UI imports — shared by the pricing
 * page, the markdown renderer and the build-time Excel generator.
 *
 * Connected Banking is a COST to the client (like Verification APIs):
 * a one-time setup fee per bank per user plus per-transaction charges.
 * All amounts are in INR, EXCLUSIVE of GST @ 18%.
 *
 * Rates sourced from the EPS Fintech API Commercial Proposal.
 */

import { GST_RATE, type PricingFaq } from "./api-pricing";
import type { AmountSlab } from "./payments-pricing";

/** One-time setup fee (₹, excl. GST) per bank per user */
export const CB_SETUP_FEE = 75000;

/** Banks available for Connected Banking integrations */
export const CB_BANKS = ["HDFC", "IDFC FIRST", "RBL", "SLICE"] as const;

/** Per-transaction charges (₹, excl. GST) by transaction-amount slab */
export const CB_TXN_SLABS: AmountSlab[] = [
	{ from: 100, upTo: 1000, flat: 8 },
	{ from: 1001, upTo: 25000, flat: 8 },
	{ from: 25001, upTo: 50000, flat: 15 },
];

/** Maximum supported transaction amount (₹) */
export const CB_MAX_TXN_AMOUNT = 50000;
/** Hard cap for the bank-integration count input */
export const CB_MAX_BANK_USERS = 20;

export interface CbInput {
	/** Number of bank integrations (bank × user) */
	bankUsers: number;
	/** Monthly transaction count */
	monthlyTxns: number;
	/** Average transaction amount (₹) */
	avgAmount: number;
}

export interface CbQuote {
	/** One-time setup fee total (₹, excl. GST) */
	setupFee: number;
	/** GST on the setup fee */
	setupGst: number;
	/** setupFee + setupGst */
	setupTotal: number;
	/** Per-transaction charge for the matched slab (₹, excl. GST) */
	perTxn: number;
	/** Monthly transaction charges (₹, excl. GST) */
	monthlySubtotal: number;
	/** GST on the monthly charges */
	monthlyGst: number;
	/** monthlySubtotal + monthlyGst */
	monthlyTotal: number;
}

/** Rounds an INR value to whole paise to avoid float drift */
const toPaise = (inr: number): number => Math.round(inr * 100);

/**
 * Per-transaction Connected Banking charge (₹, excl. GST) for an average
 * transaction amount. Amounts above the last slab use the last slab.
 * @param avgAmount - Average transaction amount in ₹
 */
export const cbChargeForAmount = (avgAmount: number): number => {
	const slab =
		CB_TXN_SLABS.find((s) => s.upTo === null || avgAmount <= s.upTo) ??
		CB_TXN_SLABS[CB_TXN_SLABS.length - 1];
	return slab.flat ?? 0;
};

/**
 * Computes the full Connected Banking quote: one-time setup costs and
 * monthly transaction charges, each with GST broken out.
 * Inputs are clamped to sane ranges.
 * @param input - { bankUsers, monthlyTxns, avgAmount }
 */
export const calcCbQuote = (input: CbInput): CbQuote => {
	const bankUsers = Math.min(
		Math.max(
			Math.round(Number.isFinite(input.bankUsers) ? input.bankUsers : 1),
			1,
		),
		CB_MAX_BANK_USERS,
	);
	const monthlyTxns = Math.min(
		Math.max(
			Math.round(Number.isFinite(input.monthlyTxns) ? input.monthlyTxns : 0),
			0,
		),
		10_000_000,
	);
	const avgAmount = Math.min(
		Math.max(
			Math.round(Number.isFinite(input.avgAmount) ? input.avgAmount : 0),
			1,
		),
		CB_MAX_TXN_AMOUNT,
	);

	const setupPaise = toPaise(CB_SETUP_FEE) * bankUsers;
	const setupGstPaise = Math.round(setupPaise * GST_RATE);

	const perTxn = cbChargeForAmount(avgAmount);
	const monthlyPaise = toPaise(perTxn) * monthlyTxns;
	const monthlyGstPaise = Math.round(monthlyPaise * GST_RATE);

	return {
		setupFee: setupPaise / 100,
		setupGst: setupGstPaise / 100,
		setupTotal: (setupPaise + setupGstPaise) / 100,
		perTxn,
		monthlySubtotal: monthlyPaise / 100,
		monthlyGst: monthlyGstPaise / 100,
		monthlyTotal: (monthlyPaise + monthlyGstPaise) / 100,
	};
};

/**
 * Connected Banking FAQs — sourced into the /pricing page, its FAQPage
 * JSON-LD and the generated /pricing.md markdown.
 */
export const CB_FAQS: PricingFaq[] = [
	{
		q: "What does the Connected Banking setup fee cover?",
		a: "The one-time setup fee of ₹75,000 + GST applies per bank per user and covers the virtual-account and BaaS infrastructure integration with that bank.",
	},
	{
		q: "Which banks are available for Connected Banking?",
		a: "HDFC, IDFC FIRST, RBL and SLICE. Each bank integration is set up separately per user.",
	},
	{
		q: "What are the Connected Banking transaction charges?",
		a: "₹8 per transaction (excl. GST) for amounts of ₹100–₹25,000 and ₹15 per transaction for ₹25,001–₹50,000.",
	},
];
