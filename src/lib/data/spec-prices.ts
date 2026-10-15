/**
 * Per-endpoint price and commission, resolved from the three pricing sources
 * so a docs page can show what a billable call costs instead of a bare
 * "Billable" tag, and which calls earn the partner a commission:
 *
 * - verification rows in `api-pricing.ts` (linked by `PricedApi.specId`)
 * - DMT add-ons and the per-transfer Eko charge in `dmt-pricing.ts`
 * - AePS settlement charges in `payments-pricing.ts`
 *
 * `spec-prices.test.ts` enforces that every billable documented endpoint has a
 * price here, that every price points at a billable documented endpoint, and
 * that every commission points at a documented endpoint. Every link opens the
 * matching calculator section on /pricing (`#calculator`, `#dmt-calculator`,
 * `#payments-calculator`).
 */
import {
	DMT_RECIPIENT_VERIFY_FEE,
	DMT_SENDER_KYC_FEE,
	EKO_DMT_CHARGE,
} from "./dmt-pricing";
import {
	AEPS_SETTLEMENT_CHARGES,
	EARNINGS_PRODUCTS_MAP,
	serializeSelection,
} from "./payments-pricing";
import { PRICED_APIS } from "./api-pricing";

/** What one endpoint costs (or earns), ready for a badge. */
export interface SpecPrice {
	/** Short badge text, e.g. "₹1.20 + GST / verification". */
	label: string;
	/** One-sentence explanation (tooltip / markdown gloss). */
	hint: string;
	/** Site-relative link to the pricing calculator section. */
	href: string;
}

const VERIFICATION_CALCULATOR = "#calculator";
const DMT_CALCULATOR = "/pricing?tab=dmt#dmt-calculator";
const PAYMENTS_CALCULATOR = "/pricing?tab=payments#payments-calculator";

/** ₹ with paise, e.g. 1.2 → "₹1.20". */
const inr = (amount: number): string => `₹${amount.toFixed(2)}`;

/** "per verification" → "/ verification". */
const perUnit = (unitLabel = "per verification"): string =>
	unitLabel.replace(/^per /, "/ ");

const settlementFees = AEPS_SETTLEMENT_CHARGES.map((slab) => slab.flat ?? 0);

/** Non-verification billable endpoints, priced from the BC pricing modules. */
const BC_PRICES: Record<string, SpecPrice> = Object.fromEntries(
	[
		{
			ids: ["dmt-fino-sender-ekyc", "dmt-levin-sender-ekyc"],
			price: {
				label: `${inr(DMT_SENDER_KYC_FEE)} incl. GST / new sender`,
				hint: "Charged once per newly registered sender; a repeat KYC is free.",
				href: DMT_CALCULATOR,
			},
		},
		{
			ids: ["dmt-add-recipient", "dmt-levin-add-recipient"],
			price: {
				label: `${inr(DMT_RECIPIENT_VERIFY_FEE)} incl. GST / new recipient`,
				hint: "Recipient verification, charged once per new recipient — not per transfer.",
				href: DMT_CALCULATOR,
			},
		},
		{
			ids: ["dmt-initiate-transfer", "dmt-levin-initiate-transfer"],
			price: {
				label: `${inr(EKO_DMT_CHARGE)} Eko charge / transfer`,
				hint: "Deducted from the sender's fee; the rest is your commission.",
				href: DMT_CALCULATOR,
			},
		},
		{
			ids: ["aeps-initiate-settlement"],
			price: {
				label: `${inr(Math.min(...settlementFees))}–${inr(Math.max(...settlementFees))} + GST / settlement`,
				hint: "Flat charge per settlement, by amount.",
				href: PAYMENTS_CALCULATOR,
			},
		},
	].flatMap(({ ids, price }) => ids.map((id) => [id, price] as const)),
);

/** Verification endpoints, priced from the rows that name them. */
const VERIFICATION_PRICES: Record<string, SpecPrice> = Object.fromEntries(
	PRICED_APIS.filter((api) => api.specId).map((api) => {
		const rates = api.tiers.map((tier) => tier.rate);
		const from = rates.length > 1 ? "from " : "";
		return [
			api.specId as string,
			{
				label: `${from}${inr(Math.min(...rates))} + GST ${perUnit(api.unitLabel)}`,
				hint: api.isBulk
					? "Billed per item inside the batch, not per call."
					: "Charged per successful call; failed calls are free.",
				href: `/pricing?apis=${api.id}${VERIFICATION_CALCULATOR}`,
			},
		];
	}),
);

/** Every endpoint with a price, keyed by `ApiSpec.id`. */
export const SPEC_PRICES: Readonly<Record<string, SpecPrice>> = {
	...VERIFICATION_PRICES,
	...BC_PRICES,
};

/**
 * Price of one endpoint, or undefined when it has none.
 * @param specId - The endpoint's `ApiSpec.id`
 */
export const specPrice = (specId: string): SpecPrice | undefined =>
	SPEC_PRICES[specId];

/**
 * Payments calculator link with one AePS line preselected at its defaults,
 * built like the ⌘K earnings card so both open the same state.
 * @param earningsId - An `EARNINGS_PRODUCTS` id, e.g. "aeps-cashout"
 */
const earningsHref = (earningsId: string): string => {
	const product = EARNINGS_PRODUCTS_MAP[earningsId];
	const pay = serializeSelection([
		{
			productId: product.id,
			monthlyTxns: product.defaultMonthlyTxns,
			avgAmount: product.needsAmount ? product.defaultAvgAmount : undefined,
		},
	]);
	return `/pricing?tab=payments&pay=${pay}#payments-calculator`;
};

const EARNS = "Earns commission";

/** Endpoints that earn the partner a commission, keyed by `ApiSpec.id`. A
 * commission is income, never a charge: it is not `billable`. */
export const SPEC_COMMISSIONS: Readonly<Record<string, SpecPrice>> =
	Object.fromEntries(
		[
			{
				ids: ["aeps-fingpay-cash-withdrawal"],
				price: {
					label: EARNS,
					hint: `You earn ${EARNINGS_PRODUCTS_MAP["aeps-cashout"].notes} per withdrawal.`,
					href: earningsHref("aeps-cashout"),
				},
			},
			{
				ids: ["aeps-fingpay-mini-statement"],
				price: {
					label: EARNS,
					hint: `You earn ${EARNINGS_PRODUCTS_MAP["aeps-mini"].notes}.`,
					href: earningsHref("aeps-mini"),
				},
			},
			{
				ids: ["bbps-pay-bill"],
				price: {
					label: EARNS,
					hint: "You earn a commission per bill, by biller category, amount and settlement mode.",
					href: PAYMENTS_CALCULATOR,
				},
			},
			{
				ids: ["dmt-initiate-transfer", "dmt-levin-initiate-transfer"],
				price: {
					label: EARNS,
					hint: "The sender's fee, less GST and the Eko charge, is your commission.",
					href: DMT_CALCULATOR,
				},
			},
		].flatMap(({ ids, price }) => ids.map((id) => [id, price] as const)),
	);

/**
 * Commission an endpoint earns, or undefined when it earns none.
 * @param specId - The endpoint's `ApiSpec.id`
 */
export const specCommission = (specId: string): SpecPrice | undefined =>
	SPEC_COMMISSIONS[specId];
