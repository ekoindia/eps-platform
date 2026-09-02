/**
 * Pricing configuration for DMT — Domestic Money Transfer.
 *
 * DMT is modelled separately from the other BC products (AePS/BBPS in
 * `payments-pricing.ts`) because its economics are a per-transaction LEDGER,
 * not a commission slab table:
 *
 *   customer fee (1%, min ₹10, GST-INCLUSIVE)
 *     → strip 18% GST            = taxable value
 *     → less Eko charge ₹2.80    = gross partner commission
 *     → less TDS @ 2%            = net partner commission
 *
 * Because the fee is GST-inclusive, GST is carved back OUT of it and is never
 * added on top. The GST attributable to the partner's own supply is paid to
 * the government by Eko under the Reverse Charge Mechanism (RCM) — see
 * `DmtTxnBreakdown.rcmGst`.
 *
 * Pure data + math module — no React or UI imports — so it can be imported
 * cheaply from the pricing page, the markdown renderer and the build-time
 * Excel generator (which loads it via ssrLoadModule).
 *
 * Rates sourced from the EPS DMT Charges schedule.
 */

import {
	GST_RATE,
	buildSetupFeeQuote,
	type PricingFaq,
	type SetupFeeQuote,
} from "./api-pricing";
import { BC_SETUP_FEE, MAX_TXNS, TDS_RATE } from "./payments-pricing";

// ---------------------------------------------------------------------------
// Rate constants
// ---------------------------------------------------------------------------

/** Minimum supported DMT transaction amount (₹) */
export const DMT_MIN_TXN_AMOUNT = 100;
/** Maximum DMT transaction amount (₹) */
export const DMT_MAX_TXN_AMOUNT = 5000;
/** Transaction fee charged to the sender: 1% of the amount… */
export const DMT_CUSTOMER_FEE_PCT = 0.01;
/** …with a minimum of ₹10 (i.e. flat ₹10 up to ₹1,000) */
export const DMT_CUSTOMER_FEE_MIN = 10;
/** Eko's flat charge per transaction (₹, excl. GST) — same at any amount */
export const EKO_DMT_CHARGE = 2.8;
/** One-time sender KYC charge (₹, EXCL. GST), per newly registered sender */
export const DMT_SENDER_KYC_FEE = 11;
/** Recipient bank account verification (₹, GST-INCLUSIVE), per new recipient */
export const DMT_RECIPIENT_VERIFY_FEE = 3.25;

/** Default transfer amount preselected in the calculator (₹) */
export const DMT_DEFAULT_AMOUNT = 2500;
/** Default monthly transfer count preselected in the calculator */
export const DMT_DEFAULT_MONTHLY_TXNS = 1000;

/** Rounds an INR value to whole paise to avoid float drift */
const toPaise = (inr: number): number => Math.round(inr * 100);

// ---------------------------------------------------------------------------
// Per-transaction ledger
// ---------------------------------------------------------------------------

/** The full money trail for a single DMT transfer. All values in ₹. */
export interface DmtTxnBreakdown {
	/** Transfer amount entered by the partner */
	amount: number;
	/** Fee charged to the sender — 1% (min ₹10), GST-INCLUSIVE */
	customerFee: number;
	/** Taxable value: customerFee with the 18% GST stripped out */
	feeExGst: number;
	/** Total GST contained in customerFee (= rcmGst + ekoGst) */
	gstInFee: number;
	/** Eko's flat charge (excl. GST) */
	ekoCharge: number;
	/** Partner commission before TDS (feeExGst − ekoCharge) */
	grossCommission: number;
	/**
	 * GST on the partner's supply to Eko (18% of grossCommission). Eko pays
	 * this to the government directly under the Reverse Charge Mechanism, so
	 * the partner neither collects nor remits it.
	 */
	rcmGst: number;
	/**
	 * GST on Eko's own ₹2.80 — Eko's ordinary forward-charge output tax, NOT
	 * an RCM amount. Derived as the residual so gstInFee reconciles exactly.
	 */
	ekoGst: number;
	/** TDS @ 2% on grossCommission (indicative; withheld on monthly aggregate) */
	tds: number;
	/** grossCommission − tds */
	netCommission: number;
}

/**
 * Clamps a transfer amount to the supported range, in whole rupees.
 * @param amount - Raw amount input (₹)
 */
export const clampDmtAmount = (amount: number): number => {
	const safe = Number.isFinite(amount)
		? Math.round(amount)
		: DMT_DEFAULT_AMOUNT;
	return Math.min(Math.max(safe, DMT_MIN_TXN_AMOUNT), DMT_MAX_TXN_AMOUNT);
};

/** Clamps a monthly count to a non-negative integer within MAX_TXNS */
const clampCount = (value: number): number =>
	Math.min(
		Math.max(Math.round(Number.isFinite(value) ? value : 0), 0),
		MAX_TXNS,
	);

/**
 * The full per-transaction ledger for a DMT transfer.
 *
 * Rounding order matters and is load-bearing: the fee is rounded to paise,
 * the GST-exclusive value is rounded after the ÷1.18, and only then is the
 * ₹2.80 subtracted. Any other order drifts off the published schedule.
 *
 * @param rawAmount - Transfer amount in ₹ (clamped to ₹100–₹5,000)
 */
export const calcDmtTxn = (rawAmount: number): DmtTxnBreakdown => {
	const amount = clampDmtAmount(rawAmount);

	const feePaise = Math.max(
		toPaise(DMT_CUSTOMER_FEE_MIN),
		Math.round(toPaise(amount) * DMT_CUSTOMER_FEE_PCT),
	);
	const feeExGstPaise = Math.round(feePaise / (1 + GST_RATE));
	const gstInFeePaise = feePaise - feeExGstPaise;

	const ekoChargePaise = toPaise(EKO_DMT_CHARGE);
	const grossPaise = feeExGstPaise - ekoChargePaise;

	// The RCM figure is what the partner puts on their invoice, so it is the
	// one computed directly; Eko's own GST takes the rounding residual.
	const rcmGstPaise = Math.round(grossPaise * GST_RATE);
	const ekoGstPaise = gstInFeePaise - rcmGstPaise;

	const tdsPaise = Math.round(grossPaise * TDS_RATE);

	return {
		amount,
		customerFee: feePaise / 100,
		feeExGst: feeExGstPaise / 100,
		gstInFee: gstInFeePaise / 100,
		ekoCharge: ekoChargePaise / 100,
		grossCommission: grossPaise / 100,
		rcmGst: rcmGstPaise / 100,
		ekoGst: ekoGstPaise / 100,
		tds: tdsPaise / 100,
		netCommission: (grossPaise - tdsPaise) / 100,
	};
};

// ---------------------------------------------------------------------------
// Monthly quote
// ---------------------------------------------------------------------------

export interface DmtInput {
	/** Average transfer amount (₹) */
	amount: number;
	/** Transfers per month */
	monthlyTxns: number;
	/** Newly registered senders per month (each incurs the KYC charge) */
	newSendersPerMonth: number;
	/** Newly added recipients per month (each incurs account verification) */
	newRecipientsPerMonth: number;
	/**
	 * Whether the partner recovers the KYC and verification charges from the
	 * sender. The wallet debit happens either way — this only adds an
	 * offsetting reimbursement credit.
	 */
	recoverChargesFromCustomer: boolean;
}

export interface DmtQuote {
	/** Per-transaction ledger at the chosen amount */
	perTxn: DmtTxnBreakdown;
	/** Echo of the clamped inputs actually used */
	input: DmtInput;
	/** grossCommission × monthlyTxns */
	monthlyGross: number;
	/** TDS @ 2% withheld on the monthly aggregate, not per transaction */
	monthlyTds: number;
	/** monthlyGross − monthlyTds */
	monthlyNetCommission: number;
	/** Sender KYC debited this month (₹, incl. GST) */
	senderKycCost: number;
	/** Recipient verification debited this month (₹, incl. GST) */
	recipientVerifyCost: number;
	/** senderKycCost + recipientVerifyCost — always debited from the wallet */
	addOnCost: number;
	/** Offsetting credit when the partner recovers add-ons from the sender */
	recoveredFromCustomer: number;
	/** monthlyNetCommission − addOnCost + recoveredFromCustomer */
	monthlyTakeHome: number;
	/** One-time setup fee — a COST, deliberately excluded from take-home */
	setupFee: SetupFeeQuote;
}

/** Sender KYC charge including GST (₹) — what actually leaves the wallet */
export const dmtSenderKycInclGst = (): number =>
	Math.round(toPaise(DMT_SENDER_KYC_FEE) * (1 + GST_RATE)) / 100;

/**
 * Computes the monthly DMT earnings quote.
 *
 * TDS is withheld on the aggregate monthly commission — NOT by multiplying a
 * rounded per-transaction TDS by the transaction count, which drifts at scale.
 *
 * @param input - Raw calculator inputs; all fields are clamped
 */
export const calcDmtQuote = (input: DmtInput): DmtQuote => {
	const amount = clampDmtAmount(input.amount);
	const monthlyTxns = clampCount(input.monthlyTxns);
	const newSendersPerMonth = clampCount(input.newSendersPerMonth);
	const newRecipientsPerMonth = clampCount(input.newRecipientsPerMonth);
	const recoverChargesFromCustomer = Boolean(input.recoverChargesFromCustomer);

	const perTxn = calcDmtTxn(amount);

	const monthlyGrossPaise = toPaise(perTxn.grossCommission) * monthlyTxns;
	const monthlyTdsPaise = Math.round(monthlyGrossPaise * TDS_RATE);
	const monthlyNetPaise = monthlyGrossPaise - monthlyTdsPaise;

	const kycPaise = toPaise(dmtSenderKycInclGst()) * newSendersPerMonth;
	const verifyPaise = toPaise(DMT_RECIPIENT_VERIFY_FEE) * newRecipientsPerMonth;
	const addOnPaise = kycPaise + verifyPaise;
	const recoveredPaise = recoverChargesFromCustomer ? addOnPaise : 0;

	return {
		perTxn,
		input: {
			amount,
			monthlyTxns,
			newSendersPerMonth,
			newRecipientsPerMonth,
			recoverChargesFromCustomer,
		},
		monthlyGross: monthlyGrossPaise / 100,
		monthlyTds: monthlyTdsPaise / 100,
		monthlyNetCommission: monthlyNetPaise / 100,
		senderKycCost: kycPaise / 100,
		recipientVerifyCost: verifyPaise / 100,
		addOnCost: addOnPaise / 100,
		recoveredFromCustomer: recoveredPaise / 100,
		monthlyTakeHome: (monthlyNetPaise - addOnPaise + recoveredPaise) / 100,
		setupFee: buildSetupFeeQuote(monthlyTxns > 0 ? toPaise(BC_SETUP_FEE) : 0),
	};
};

// ---------------------------------------------------------------------------
// Rate card (DERIVED — never hand-maintained)
// ---------------------------------------------------------------------------

/** Representative transfer amounts shown in the static rate card */
export const DMT_RATE_CARD_AMOUNTS = [
	100, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000,
];

/**
 * Rate-card rows derived from `calcDmtTxn`, so the table, /pricing.md and the
 * Excel workbook cannot drift from the calculator.
 */
export const dmtRateCardRows = (): DmtTxnBreakdown[] =>
	DMT_RATE_CARD_AMOUNTS.map(calcDmtTxn);

/** Highest gross commission on the schedule — the "Earn up to" headline */
export const dmtMaxCommission = (): number =>
	calcDmtTxn(DMT_MAX_TXN_AMOUNT).grossCommission;

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

/** DMT FAQs — sourced into /pricing, its FAQPage JSON-LD and /pricing.md */
export const DMT_FAQS: PricingFaq[] = [
	{
		q: "How is my DMT commission calculated?",
		a: `The sender pays a **1% transaction fee (minimum ₹10)** which is **inclusive of 18% GST** — nothing is added on top. Stripping the GST out gives the taxable value; Eko's flat charge of **₹${EKO_DMT_CHARGE.toFixed(2)} per transaction** comes off that, and the remainder is your commission. On a ₹5,000 transfer: ₹50.00 fee → ₹42.37 taxable → less ₹2.80 → **₹39.57 gross commission**, or ₹38.78 after TDS.`,
	},
	{
		q: "What is the Reverse Charge Mechanism (RCM) on DMT?",
		a: 'DMT commission is notified under reverse charge, so the GST on your commission is paid to the government by **Eko** rather than collected and remitted by you. Raise your invoice to Eko with the **RCM option set to "YES"** and no GST line on it. Please confirm the treatment for your own registration with your accountant.',
	},
	{
		q: "Is TDS deducted from DMT commissions?",
		a: "Yes. **TDS @ 2%** is withheld on your monthly commission, as required by law. The [calculator](/pricing?tab=dmt) shows both gross commission and the after-TDS figure.",
	},
	{
		q: "What are the sender KYC and account verification charges?",
		a: `Registering a new sender costs **₹${DMT_SENDER_KYC_FEE} + GST (₹${dmtSenderKycInclGst().toFixed(2)})**, charged once per sender. Verifying a new recipient's bank account costs **₹${DMT_RECIPIENT_VERIFY_FEE.toFixed(2)}** (incl. GST), charged once per recipient — not per transfer. Both are debited from your wallet; you are free to recover them from your customer in your own app.`,
	},
	{
		q: "What is the maximum DMT transfer amount?",
		a: `₹${DMT_MAX_TXN_AMOUNT.toLocaleString("en-IN")} per transaction. Larger payouts should be split across transfers, subject to the sender's monthly limit of ₹25,000.`,
	},
];
