import { describe, expect, it } from "vitest";
import { PRICED_APIS } from "@/lib/data/api-pricing";
import {
	calcActivationFee,
	FEE_PRODUCT_GROUPS,
	filterFeeProducts,
	formatInr,
	labelsForFeeProducts,
} from "@/lib/console/feeProducts";
import {
	GST_RATE,
	SETUP_FEE_DISCOUNT_PERCENT,
	VERIFICATION_SETUP_FEE,
	setupFeeFor,
	PRICED_APIS_MAP,
} from "@/lib/data/api-pricing";
import { BC_SETUP_FEE } from "@/lib/data/payments-pricing";

const allOptions = FEE_PRODUCT_GROUPS.flatMap((group) => group.options);

describe("FEE_PRODUCT_GROUPS", () => {
	it("offers every chargeable priced API as its own row", () => {
		// The fee is per API, not per product page: PAN Lite and PAN Advanced are
		// two fees, so they must be two rows.
		const chargeable = PRICED_APIS.filter((api) => api.setupFee !== 0);
		expect(allOptions.length).toBeGreaterThanOrEqual(chargeable.length);
		for (const api of chargeable) {
			expect(allOptions.some((option) => option.id === api.id)).toBe(true);
		}
	});

	it("omits APIs the registry exempts from the setup fee", () => {
		const exempt = PRICED_APIS.filter((api) => api.setupFee === 0);
		for (const api of exempt) {
			expect(allOptions.some((option) => option.id === api.id)).toBe(false);
		}
	});

	it("leads with the BC/Payments families, which are priced per family", () => {
		const [first] = FEE_PRODUCT_GROUPS;
		expect(first.label).toBe("Banking & Payments");
		expect(first.options.map((option) => option.id)).toEqual([
			"dmt",
			"aeps",
			"bbps",
		]);
	});

	it("keeps the verification groups in the rate card's own order behind it", () => {
		const labels = FEE_PRODUCT_GROUPS.map((group) => group.label);
		expect(labels.indexOf("PAN")).toBe(1);
	});

	it("renders no group empty and no id twice", () => {
		for (const group of FEE_PRODUCT_GROUPS) {
			expect(group.options.length).toBeGreaterThan(0);
		}
		const ids = allOptions.map((option) => option.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("drops the bulk asterisk, which points at a footnote this page lacks", () => {
		for (const option of allOptions) {
			expect(option.label).not.toContain("*");
		}
	});
});

describe("labelsForFeeProducts", () => {
	it("resolves ids to their display labels", () => {
		expect(labelsForFeeProducts(["dmt", "aeps"])).toEqual([
			"Money Transfer (DMT)",
			"AePS",
		]);
	});

	it("returns labels in picker order, not the order asked for", () => {
		expect(labelsForFeeProducts(["bbps", "dmt"])).toEqual([
			"Money Transfer (DMT)",
			"Bill Payments (BBPS)",
		]);
	});

	it("drops ids it does not recognise", () => {
		expect(labelsForFeeProducts(["dmt", "not-a-real-api"])).toEqual([
			"Money Transfer (DMT)",
		]);
	});

	it("returns nothing for an empty selection", () => {
		expect(labelsForFeeProducts([])).toEqual([]);
	});
});

describe("calcActivationFee", () => {
	/** Undiscounted → discounted → +GST, the way the rate card charges it. */
	const expected = (undiscounted: number) => {
		const payable = (undiscounted * (100 - SETUP_FEE_DISCOUNT_PERCENT)) / 100;
		return { payable, gst: payable * GST_RATE, total: payable * (1 + GST_RATE) };
	};

	it("charges nothing for an empty selection", () => {
		expect(calcActivationFee([])).toMatchObject({
			amount: 0,
			payable: 0,
			gst: 0,
			total: 0,
		});
	});

	it("charges one verification API at the rate card's own fee", () => {
		const api = PRICED_APIS_MAP["pan-fetch"];
		const fee = calcActivationFee(["pan-fetch"]);
		expect(fee.amount).toBe(setupFeeFor(api));
		expect(fee).toMatchObject(expected(setupFeeFor(api)));
	});

	it("charges per API, so two APIs cost twice one", () => {
		const one = calcActivationFee(["pan-fetch"]);
		const two = calcActivationFee(["pan-fetch", "upi-vpa"]);
		expect(two.amount).toBe(one.amount + setupFeeFor(PRICED_APIS_MAP["upi-vpa"]));
	});

	it("charges a BC/Payments family the flat per-family fee", () => {
		expect(calcActivationFee(["dmt"])).toMatchObject({
			amount: BC_SETUP_FEE,
			...expected(BC_SETUP_FEE),
		});
	});

	it("adds the two halves of the catalogue together", () => {
		const fee = calcActivationFee(["pan-fetch", "dmt"]);
		expect(fee.amount).toBe(VERIFICATION_SETUP_FEE + BC_SETUP_FEE);
		expect(fee).toMatchObject(expected(VERIFICATION_SETUP_FEE + BC_SETUP_FEE));
	});

	it("reports the running discount so the page can show its own line", () => {
		expect(calcActivationFee(["dmt"]).discountPercent).toBe(
			SETUP_FEE_DISCOUNT_PERCENT,
		);
	});

	it("flags a selection it cannot price rather than undercharging silently", () => {
		expect(calcActivationFee(["pan-fetch"]).hasUnpriced).toBe(false);
		expect(calcActivationFee(["not-an-api"]).hasUnpriced).toBe(true);
	});

	it("prices an unknown id at zero, never as a guess", () => {
		expect(calcActivationFee(["not-an-api"]).amount).toBe(0);
	});
});

describe("formatInr", () => {
	it("drops the decimals on a whole amount", () => {
		expect(formatInr(3540)).toBe("₹3,540");
	});

	it("keeps paise when the discount or GST leaves some", () => {
		expect(formatInr(3540.5)).toBe("₹3,540.50");
	});

	it("groups in the Indian system, not thousands", () => {
		expect(formatInr(1500000)).toBe("₹15,00,000");
	});
});

describe("filterFeeProducts", () => {
	it("returns everything for a blank or whitespace query", () => {
		expect(filterFeeProducts("")).toBe(FEE_PRODUCT_GROUPS);
		expect(filterFeeProducts("   ")).toBe(FEE_PRODUCT_GROUPS);
	});

	it("matches an option label, case-insensitively", () => {
		const groups = filterFeeProducts("aeps");
		expect(groups).toHaveLength(1);
		expect(groups[0].options.map((option) => option.id)).toEqual(["aeps"]);
		expect(filterFeeProducts("AePS")).toEqual(groups);
	});

	it("matches on a partial word", () => {
		const ids = filterFeeProducts("pan").flatMap((group) =>
			group.options.map((option) => option.id),
		);
		expect(ids).toContain("pan-fetch");
	});

	it("keeps a whole group when its caption matches", () => {
		const groups = filterFeeProducts("banking");
		expect(groups).toHaveLength(1);
		expect(groups[0].options).toHaveLength(3);
	});

	it("drops groups with nothing left rather than showing an empty caption", () => {
		for (const group of filterFeeProducts("pan")) {
			expect(group.options.length).toBeGreaterThan(0);
		}
	});

	it("returns nothing when the query matches nothing", () => {
		expect(filterFeeProducts("zzzznotanapi")).toEqual([]);
	});

	it("preserves the picker's order among the survivors", () => {
		const labels = filterFeeProducts("verification").map((g) => g.label);
		const full = FEE_PRODUCT_GROUPS.map((g) => g.label);
		expect(labels).toEqual(full.filter((label) => labels.includes(label)));
	});
});
