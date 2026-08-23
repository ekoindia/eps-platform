/**
 * Headline "Earn up to …" figures for BC/Payments product cards on /products.
 *
 * Lives in its own module because it spans two pricing sources — AePS/BBPS in
 * `payments-pricing.ts` and DMT in `dmt-pricing.ts`. Putting it in either one
 * would make those modules import each other.
 */

import { dmtMaxCommission } from "./dmt-pricing";
import { AEPS_CASHOUT_SLABS } from "./payments-pricing";

export interface EarningsHighlight {
	/** Max commission display, e.g. "₹39.57" or "3.04%" */
	maxLabel: string;
	/** Unit label, e.g. "per transfer" */
	unitLabel: string;
}

/**
 * Maximum BBPS commission rate across operators — sourced from the
 * Mobile Prepaid rangeNote (BSNL 3.04%); operator-level rates only
 * exist in notes, not slab data.
 */
const BBPS_MAX_COMMISSION_PCT = 3.04;

/**
 * Headline "Earn up to …" figure for a BC/payment product card.
 * Returns undefined for products without commission data.
 * @param productId - ApiProductRef.id from api-products.ts ("dmt" | "aeps" | "bbps")
 */
export const getEarningsHighlight = (
	productId: string,
): EarningsHighlight | undefined => {
	if (productId === "dmt") {
		return {
			maxLabel: `₹${dmtMaxCommission().toFixed(2)}`,
			unitLabel: "per transfer",
		};
	}
	if (productId === "aeps") {
		const maxFlat = Math.max(
			...AEPS_CASHOUT_SLABS.map((slab) => slab.flat ?? 0),
		);
		return { maxLabel: `₹${maxFlat}`, unitLabel: "per withdrawal" };
	}
	if (productId === "bbps") {
		return { maxLabel: `${BBPS_MAX_COMMISSION_PCT}%`, unitLabel: "per bill" };
	}
	return undefined;
};
