/**
 * The list of things a partner can pay a one-time activation fee for, as the
 * `/console/pay-activation-fee` picker renders it.
 *
 * Derived from the pricing registry rather than the product catalogue, because
 * the fee is charged the way pricing is charged: **per verification API**, not
 * per product page. A partner who bought PAN Lite and PAN Advanced owes two
 * fees, so the picker has to offer them as two rows — which is exactly the
 * granularity `PRICED_APIS` already has, and `API_PRODUCTS` does not.
 */
import {
	buildSetupFeeQuote,
	calcSetupFee,
	displayName,
	PRICED_APIS_MAP,
	PRICING_GROUPS,
	SETUP_FEE_DISCOUNT_PERCENT,
	type PricedApi,
} from "@/lib/data/api-pricing";
import { BC_SETUP_FEE } from "@/lib/data/payments-pricing";

/** One tickable line in the picker. */
export interface FeeProductOption {
	/** Stable id — the priced-API id, or the family slug for BC/Payments. */
	id: string;
	/** What the partner reads, and what finance receives in the mail. */
	label: string;
}

/** A captioned block of options. */
export interface FeeProductGroup {
	label: string;
	options: FeeProductOption[];
}

/**
 * The BC / Payments families, which are charged a flat one-time fee **per
 * family** rather than per API.
 *
 * The three families are named here because `PRICED_APIS` covers the
 * verification catalogue only; the fee itself comes from `BC_SETUP_FEE` in
 * `payments-pricing.ts`, which is what the /pricing payments calculator
 * charges, so the two cannot drift.
 */
const BC_PAYMENT_FAMILIES: FeeProductOption[] = [
	{ id: "dmt", label: "Money Transfer (DMT)" },
	{ id: "aeps", label: "AePS" },
	{ id: "bbps", label: "Bill Payments (BBPS)" },
];

/** Caption for the BC/Payments block. */
const BC_PAYMENT_GROUP_LABEL = "Banking & Payments";

/**
 * Whether this API carries a one-time fee at all.
 *
 * `setupFee: 0` is the registry's way of exempting an API (see `PricedApi`), and
 * an exempt API has nothing to pay — offering it would invite a partner to
 * report a fee they were never charged.
 * @param api - A priced API from the registry.
 * @returns True when the API attracts a setup fee.
 */
const isChargeable = (api: PricedApi): boolean => api.setupFee !== 0;

/**
 * The picker's groups, in display order.
 *
 * BC/Payments leads: it is three rows against the verification catalogue's
 * dozens, and it carries the largest fee per row, so burying it under a long
 * scroll is the wrong default for the partner most likely to be paying. The
 * verification groups follow in the registry's own order, so the rest of the
 * list still reads the same way as the /pricing rate card.
 */
export const FEE_PRODUCT_GROUPS: FeeProductGroup[] = [
	{ label: BC_PAYMENT_GROUP_LABEL, options: BC_PAYMENT_FAMILIES },
	...PRICING_GROUPS.map((group) => ({
		label: group.label,
		options: group.apis.filter(isChargeable).map((api) => ({
			id: api.id,
			// `displayName` adds the bulk asterisk, which points at a footnote this
			// page does not have — the plain name is what finance should read.
			label: api.isBulk ? api.name : displayName(api),
		})),
	})).filter((group) => group.options.length > 0),
];

/** Every option, flattened — for id → label lookup. */
const ALL_OPTIONS: FeeProductOption[] = FEE_PRODUCT_GROUPS.flatMap(
	(group) => group.options,
);

/**
 * Turns the ids the form holds into the labels the mail carries.
 *
 * Unknown ids are dropped rather than passed through: the id set is this
 * module's, so anything else is a stale bookmark or a hand-edited request, and
 * neither should reach finance as a product name.
 * @param ids - Selected option ids, in any order.
 * @returns Labels in the picker's display order.
 */
export function labelsForFeeProducts(ids: readonly string[]): string[] {
	const selected = new Set(ids);
	return ALL_OPTIONS.filter((option) => selected.has(option.id)).map(
		(option) => option.label,
	);
}

/** The families a selection covers, for the per-family BC/Payments fee. */
const bcFamilyIds = new Set(BC_PAYMENT_FAMILIES.map((family) => family.id));

/**
 * What a selection costs to activate, as the partner should transfer it.
 *
 * The two halves of the catalogue are priced differently — verification is
 * per API (with pack pricing), BC/Payments is a flat fee per family — so each
 * is quoted by the same helper the /pricing calculator uses and the results are
 * added. Quoting them separately rounds each half to whole paise before adding,
 * which can differ from one combined quote by at most a paise; nobody transfers
 * that, and keeping both halves on their own calculator's code path is worth
 * more than the last paise.
 * @param ids - Selected option ids from {@link FEE_PRODUCT_GROUPS}.
 * @returns The undiscounted amount, what is payable after the running discount,
 * the GST on it, and the total to transfer — all INR.
 */
export function calcActivationFee(ids: readonly string[]): {
	amount: number;
	payable: number;
	gst: number;
	total: number;
	discountPercent: number;
	/** True when the selection names something the catalogue cannot price. */
	hasUnpriced: boolean;
} {
	const verificationIds = ids.filter((id) => PRICED_APIS_MAP[id]);
	const families = ids.filter((id) => bcFamilyIds.has(id));
	const verification = calcSetupFee([...verificationIds]);
	const bc = buildSetupFeeQuote(families.length * BC_SETUP_FEE * 100);
	return {
		amount: verification.amount + bc.amount,
		payable: verification.payable + bc.payable,
		gst: verification.gst + bc.gst,
		total: verification.total + bc.total,
		discountPercent: SETUP_FEE_DISCOUNT_PERCENT,
		// An id this module does not know cannot be priced — and neither can the
		// free-text box, which the caller folds in.
		hasUnpriced: ids.length > verificationIds.length + families.length,
	};
}

/**
 * Formats an INR amount the way the page shows money: whole rupees when it is
 * whole, two decimals when the discount or GST leaves paise behind.
 * @param inr - Amount in rupees.
 * @returns e.g. "₹10,620" or "₹10,620.50".
 */
export function formatInr(inr: number): string {
	const whole = Math.round(inr * 100) % 100 === 0;
	return `₹${inr.toLocaleString("en-IN", {
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: 2,
	})}`;
}

/**
 * The groups a search narrows to, keeping the picker's order.
 *
 * Matches on the option label and on the group caption, so typing "aeps" finds
 * the family and typing "identity" finds everything filed under it. A group
 * whose caption matches keeps all its options, which is what makes searching by
 * category work at all.
 * @param query - The raw search box contents; blank returns everything.
 * @returns Groups with at least one surviving option.
 */
export function filterFeeProducts(query: string): FeeProductGroup[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return FEE_PRODUCT_GROUPS;
	return FEE_PRODUCT_GROUPS.map((group) => ({
		label: group.label,
		options: group.label.toLowerCase().includes(needle)
			? group.options
			: group.options.filter((option) =>
					option.label.toLowerCase().includes(needle),
				),
	})).filter((group) => group.options.length > 0);
}
