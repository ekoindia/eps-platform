/**
 * Pricing configuration for Banking-Correspondent (BC) APIs: AePS and BBPS.
 *
 * DMT is NOT here — see `dmt-pricing.ts`. Its economics are a per-transaction
 * ledger (GST-inclusive customer fee, reverse charge, flat Eko charge) rather
 * than a commission slab, so it gets its own module and its own pricing tab.
 *
 * Pure data + math module — no React or UI imports — so it can be imported
 * cheaply from the pricing page, the markdown renderer and the build-time
 * Excel generator (which loads it via ssrLoadModule).
 *
 * IMPORTANT SEMANTICS: unlike Verification APIs (a cost you pay per call),
 * these products EARN the partner a commission per transaction. All
 * commission values are in INR, EXCLUSIVE of GST @ 18%; TDS @ 2% is
 * deducted from commission payouts.
 *
 * Rates sourced from the EPS Fintech API Commercial Proposal.
 */

import {
	SETUP_FEE_DISCOUNT_PERCENT,
	buildSetupFeeQuote,
	clampDiscountPercent,
	type PricingFaq,
	type SetupFeeQuote,
} from "./api-pricing";

/**
 * One commission slab keyed on TRANSACTION AMOUNT (₹) — not monthly volume.
 * Exactly one of `flat` or `pct` is set.
 */
export interface AmountSlab {
	/** Inclusive lower bound of the transaction amount (₹) */
	from: number;
	/** Inclusive upper bound of the transaction amount (₹); null = no cap */
	upTo: number | null;
	/** Flat commission in ₹ per transaction (excl. GST) */
	flat?: number;
	/** Commission as a fraction of the amount, e.g. 0.004 = 0.40% */
	pct?: number;
}

/** TDS rate deducted from commission payouts */
export const TDS_RATE = 0.02;

// ---------------------------------------------------------------------------
// AePS — Aadhaar-Enabled Payment System
// ---------------------------------------------------------------------------

/** AePS cashout commission slabs by transaction amount */
export const AEPS_CASHOUT_SLABS: AmountSlab[] = [
	{ from: 101, upTo: 3000, pct: 0.004 },
	{ from: 3001, upTo: 10000, flat: 13 },
];

/** Commission per AePS mini-statement transaction (₹, excl. GST) */
export const AEPS_MINI_STATEMENT_COMMISSION = 0.75;

/**
 * AePS fund settlement charges (₹ + GST per settlement) — an informational
 * cost shown alongside earnings, NOT netted into the earnings math.
 */
export const AEPS_SETTLEMENT_CHARGES: AmountSlab[] = [
	{ from: 101, upTo: 25000, flat: 5 },
	{ from: 25001, upTo: 200000, flat: 10 },
];

// ---------------------------------------------------------------------------
// BBPS — Bharat Bill Payment System (category-level)
// ---------------------------------------------------------------------------

export interface BbpsCategory {
	/** Unique, URL-stable id used in query params, e.g. "bbps-electricity" */
	id: string;
	/** Display name, e.g. "Electricity Bill" */
	name: string;
	/**
	 * Commission slabs by transaction amount. For categories whose rate
	 * varies by operator, the LOWEST operator rate is used (conservative
	 * estimate) and `rangeNote` carries the spread.
	 */
	slabs: AmountSlab[];
	/** Shown when the commission varies by operator */
	rangeNote?: string;
	/** Default average transaction amount preselected in the calculator (₹) */
	defaultAvgAmount: number;
}

/** Slabs shared by Electricity and Water & Piped Gas */
const UTILITY_BILL_SLABS: AmountSlab[] = [
	{ from: 1, upTo: 5000, flat: 1.2 },
	{ from: 5001, upTo: 20000, pct: 0.0052 },
	{ from: 20001, upTo: 100000, pct: 0.006 },
	{ from: 100001, upTo: null, pct: 0.0032 },
];

export const BBPS_CATEGORIES: BbpsCategory[] = [
	{
		id: "bbps-electricity",
		name: "Electricity Bill",
		slabs: UTILITY_BILL_SLABS,
		defaultAvgAmount: 1500,
	},
	{
		id: "bbps-water-gas",
		name: "Water & Piped Gas",
		slabs: UTILITY_BILL_SLABS,
		defaultAvgAmount: 800,
	},
	{
		id: "bbps-postpaid-landline",
		name: "Mobile Postpaid & Landline",
		slabs: [{ from: 1, upTo: null, flat: 0.72 }],
		defaultAvgAmount: 600,
	},
	{
		id: "bbps-broadband",
		name: "Broadband",
		slabs: [{ from: 1, upTo: null, flat: 0.72 }],
		defaultAvgAmount: 800,
	},
	{
		id: "bbps-insurance",
		name: "Insurance Premium",
		slabs: [
			{ from: 1, upTo: 5000, flat: 3.76 },
			{ from: 5001, upTo: null, flat: 1.744 },
		],
		defaultAvgAmount: 3000,
	},
	{
		id: "bbps-loan-emi",
		name: "Loan EMI Repayment",
		slabs: [{ from: 1, upTo: null, flat: 2 }],
		defaultAvgAmount: 5000,
	},
	{
		id: "bbps-fastag",
		name: "FASTag Recharge",
		slabs: [{ from: 1, upTo: null, flat: 1.12 }],
		rangeNote: "Bank-issued FASTags ₹1.12; FASTag (General) 0.05%",
		defaultAvgAmount: 500,
	},
	{
		id: "bbps-lpg",
		name: "LPG Cylinder Booking",
		slabs: [{ from: 1, upTo: null, flat: 0.8 }],
		rangeNote: "Rate varies by oil company — see Excel rate card",
		defaultAvgAmount: 1000,
	},
	{
		id: "bbps-prepaid",
		name: "Mobile Prepaid Recharge",
		slabs: [{ from: 1, upTo: null, pct: 0.01 }],
		rangeNote: "1%–3.04% by operator (Jio/Airtel 1%, VI 2.56%, BSNL 3.04%)",
		defaultAvgAmount: 300,
	},
	{
		id: "bbps-dth",
		name: "DTH Recharge",
		slabs: [{ from: 1, upTo: null, pct: 0.02 }],
		rangeNote: "2%–2.56% by operator (Tata Play/Videocon 2%, others 2.56%)",
		defaultAvgAmount: 400,
	},
	{
		id: "bbps-credit-card",
		name: "Credit Card Bill Payment",
		slabs: [{ from: 1, upTo: null, flat: 0.2 }],
		defaultAvgAmount: 8000,
	},
	{
		id: "bbps-education",
		name: "Education Fee Payment",
		slabs: [{ from: 1, upTo: null, flat: 1.744 }],
		defaultAvgAmount: 10000,
	},
	{
		id: "bbps-municipal",
		name: "Municipal Taxes & Services",
		slabs: [{ from: 1, upTo: null, flat: 0.72 }],
		rangeNote: "₹0.72–₹1.824 by amount and corporation",
		defaultAvgAmount: 2000,
	},
	{
		id: "bbps-metro",
		name: "Metro Card Recharge",
		slabs: [{ from: 1, upTo: null, flat: 0.8 }],
		defaultAvgAmount: 300,
	},
];

// ---------------------------------------------------------------------------
// Unified earnings products (what the Payments calculator iterates over)
// ---------------------------------------------------------------------------

export interface EarningsProduct {
	/** Unique, URL-stable id, e.g. "dmt" or a BbpsCategory id */
	id: string;
	/** Product family — drives picker/rate-card grouping */
	family: "AePS" | "BBPS";
	/** Display name */
	name: string;
	/** Whether the commission depends on the average transaction amount */
	needsAmount: boolean;
	/** Default average transaction amount preselected in the calculator (₹) */
	defaultAvgAmount?: number;
	/** Default monthly transaction count preselected in the calculator */
	defaultMonthlyTxns: number;
	/** Maximum supported transaction amount (₹), when capped */
	maxTxnAmount?: number;
	/** Optional footnote shown alongside the product */
	notes?: string;
}

/**
 * One-time setup fee per BC/Payments API family (INR, excl. GST). Charged
 * once per family — DMT, AePS and BBPS are one API each, however many BBPS
 * bill categories a partner enables. DMT charges this same fee via
 * `calcDmtQuote` in `dmt-pricing.ts`.
 */
export const BC_SETUP_FEE = 20_000;

/** Hard cap for the monthly transaction-count input */
export const MAX_TXNS = 10_000_000;
/** Fallback cap for the avg transaction amount input when not product-capped */
export const DEFAULT_MAX_TXN_AMOUNT = 200_000;

export const EARNINGS_PRODUCTS: EarningsProduct[] = [
	{
		id: "aeps-cashout",
		family: "AePS",
		name: "AePS Cash Withdrawal",
		needsAmount: true,
		defaultAvgAmount: 2000,
		defaultMonthlyTxns: 1000,
		maxTxnAmount: 10000,
		notes: "0.40% up to ₹3,000; ₹13 flat for ₹3,001–₹10,000",
	},
	{
		id: "aeps-mini",
		family: "AePS",
		name: "AePS Mini Statement",
		needsAmount: false,
		defaultMonthlyTxns: 500,
		notes: "₹0.75 per transaction",
	},
	...BBPS_CATEGORIES.map(
		(category): EarningsProduct => ({
			id: category.id,
			family: "BBPS",
			name: category.name,
			needsAmount: true,
			defaultAvgAmount: category.defaultAvgAmount,
			defaultMonthlyTxns: 500,
			notes: category.rangeNote,
		}),
	),
];

/** Map of all earnings products for quick lookup by id */
export const EARNINGS_PRODUCTS_MAP: Record<string, EarningsProduct> =
	Object.fromEntries(EARNINGS_PRODUCTS.map((product) => [product.id, product]));

/** Map of BBPS categories for quick lookup by id */
export const BBPS_CATEGORIES_MAP: Record<string, BbpsCategory> =
	Object.fromEntries(
		BBPS_CATEGORIES.map((category) => [category.id, category]),
	);

/** Earnings products grouped by family in display order */
export const EARNINGS_GROUPS: { label: string; products: EarningsProduct[] }[] =
	(["AePS", "BBPS"] as const).map((family) => ({
		label: family,
		products: EARNINGS_PRODUCTS.filter((product) => product.family === family),
	}));

// ---------------------------------------------------------------------------
// Earnings math (paise-integer arithmetic, mirroring api-pricing.ts)
// ---------------------------------------------------------------------------

/** Rounds an INR value to whole paise to avoid float drift */
const toPaise = (inr: number): number => Math.round(inr * 100);

/**
 * Resolves the commission (₹ per transaction) for a transaction amount
 * against a set of amount slabs. Amounts below the first slab use the first
 * slab; amounts above the last capped slab use the last slab.
 * @param slabs - Amount slabs, ascending
 * @param amount - Transaction amount in ₹
 */
export const commissionForAmount = (
	slabs: AmountSlab[],
	amount: number,
): number => {
	const slab =
		slabs.find((s) => s.upTo === null || amount <= s.upTo) ??
		slabs[slabs.length - 1];
	if (slab.flat !== undefined) return slab.flat;
	return toPaise((slab.pct ?? 0) * Math.max(amount, slab.from)) / 100;
};

/**
 * Commission (₹ per transaction) for any earnings product at an average
 * transaction amount. Returns 0 for unknown product ids.
 * @param productId - EarningsProduct id
 * @param avgAmount - Average transaction amount in ₹ (ignored when the
 *   product does not need an amount, e.g. AePS mini statement)
 */
export const commissionPerTxn = (
	productId: string,
	avgAmount: number,
): number => {
	if (productId === "aeps-cashout")
		return commissionForAmount(AEPS_CASHOUT_SLABS, avgAmount);
	if (productId === "aeps-mini") return AEPS_MINI_STATEMENT_COMMISSION;
	const category = BBPS_CATEGORIES_MAP[productId];
	return category ? commissionForAmount(category.slabs, avgAmount) : 0;
};

export interface EarningsSelection {
	productId: string;
	monthlyTxns: number;
	/** Average transaction amount in ₹; defaults to the product default */
	avgAmount?: number;
}

export interface EarningsLine {
	product: EarningsProduct;
	monthlyTxns: number;
	/** Average transaction amount used for the estimate (₹) */
	avgAmount: number;
	/** Commission per transaction (₹, excl. GST) */
	perTxn: number;
	/** Estimated monthly commission (₹, excl. GST) */
	monthlyEarnings: number;
}

export interface EarningsQuote {
	lines: EarningsLine[];
	/** Gross estimated monthly commission (₹, excl. GST) */
	total: number;
	/** total × (1 − TDS_RATE) — indicative payout after TDS */
	totalAfterTds: number;
	/** Total monthly transactions across lines */
	totalTxns: number;
	/** One-time setup fee — a COST, deliberately excluded from `total` */
	setupFee: SetupFeeQuote;
}

/**
 * "Is there a setup fee for DMT, AePS and BBPS?" answer, in the three
 * discount states. The volume-commitment waiver is a standing commercial
 * term, so it holds whether or not a campaign is running.
 * @param raw - Discount percentage
 */
export const bcSetupFeeFaqAnswer = (raw: number): string => {
	const percent = clampDiscountPercent(raw);
	const standard = `Yes — a one-time setup fee of **₹${BC_SETUP_FEE.toLocaleString("en-IN")} per API family** (excl. GST) applies. DMT, AePS and BBPS are one API each, so enabling six BBPS bill categories still carries a single BBPS fee.`;
	if (percent >= 100) {
		return `${standard} It is **fully waived right now** as a limited-time offer — you pay ₹0 to activate.`;
	}
	const commitment =
		"A full waiver is also available against a higher monthly volume commitment.";
	return percent > 0
		? `${standard} It is currently **${percent}% off** as a limited-time offer. ${commitment}`
		: `${standard} ${commitment}`;
};

/**
 * One-time setup fee for a payments selection. Charged once per API family
 * (DMT / AePS / BBPS), so enabling six BBPS bill categories is still a single
 * BBPS API. Products parked at zero transactions do not activate a fee.
 * @param productIds - Selected EarningsProduct ids with non-zero volume
 */
export const calcPaymentsSetupFee = (productIds: string[]): SetupFeeQuote => {
	const families = new Set(
		productIds
			.map((id) => EARNINGS_PRODUCTS_MAP[id]?.family)
			.filter((family): family is EarningsProduct["family"] => Boolean(family)),
	);
	return buildSetupFeeQuote(families.size * BC_SETUP_FEE * 100);
};

/**
 * Clamps an average transaction amount to a product's supported range.
 * @param product - The earnings product
 * @param avgAmount - Raw amount input
 */
export const clampAvgAmount = (
	product: EarningsProduct,
	avgAmount: number,
): number => {
	const max = product.maxTxnAmount ?? DEFAULT_MAX_TXN_AMOUNT;
	const safe = Number.isFinite(avgAmount) ? Math.round(avgAmount) : 0;
	return Math.min(Math.max(safe, 1), max);
};

/**
 * Computes the full monthly earnings quote for a selection of products.
 * Unknown product ids are ignored; txn counts are clamped to [0, MAX_TXNS]
 * and amounts to the product's supported range.
 * @param selection - Array of { productId, monthlyTxns, avgAmount? }
 */
export const calcEarningsQuote = (
	selection: EarningsSelection[],
): EarningsQuote => {
	const lines: EarningsLine[] = selection.flatMap(
		({ productId, monthlyTxns, avgAmount }) => {
			const product = EARNINGS_PRODUCTS_MAP[productId];
			if (!product) return [];
			const safeTxns = Math.min(
				Math.max(Math.round(Number.isFinite(monthlyTxns) ? monthlyTxns : 0), 0),
				MAX_TXNS,
			);
			const safeAmount = clampAvgAmount(
				product,
				avgAmount ?? product.defaultAvgAmount ?? 0,
			);
			const perTxn = commissionPerTxn(productId, safeAmount);
			return [
				{
					product,
					monthlyTxns: safeTxns,
					avgAmount: safeAmount,
					perTxn,
					monthlyEarnings: (toPaise(perTxn) * safeTxns) / 100,
				},
			];
		},
	);

	const totalPaise = lines.reduce(
		(sum, line) => sum + toPaise(line.monthlyEarnings),
		0,
	);
	const afterTdsPaise = Math.round(totalPaise * (1 - TDS_RATE));

	return {
		lines,
		total: totalPaise / 100,
		totalAfterTds: afterTdsPaise / 100,
		totalTxns: lines.reduce((sum, line) => sum + line.monthlyTxns, 0),
		setupFee: calcPaymentsSetupFee(
			lines
				.filter((line) => line.monthlyTxns > 0)
				.map((line) => line.product.id),
		),
	};
};

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

/**
 * Payments & BC FAQs — sourced into the /pricing page, its FAQPage JSON-LD
 * and the generated /pricing.md markdown.
 */
export const PAYMENTS_FAQS: PricingFaq[] = [
	{
		q: "How does AePS commission work?",
		a: "AePS cash withdrawals earn 0.40% of the amount for transactions of ₹101–₹3,000 and a flat ₹13 for ₹3,001–₹10,000. Mini statements earn ₹0.75 per transaction. Fund settlements carry a small charge of ₹5–₹10 + GST depending on the settlement amount.",
	},
	{
		q: "Where can I find operator-wise BBPS commission rates?",
		a: "The calculator uses category-level rates (conservative, lowest operator rate where rates vary). The downloadable Excel rate card lists commission for every BBPS operator — 100+ billers across electricity, insurance, EMI, FASTag, prepaid and more.",
	},
	{
		q: "Is there a setup fee for DMT, AePS and BBPS?",
		a: bcSetupFeeFaqAnswer(SETUP_FEE_DISCOUNT_PERCENT),
	},
	{
		q: "Are the commission rates inclusive of GST?",
		a: "No. All commission figures are **exclusive of GST @ 18%**. Add your GST number on the Connect portal for GST-compliant invoices.",
	},
];
