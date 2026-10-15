import { describe, expect, it } from "vitest";

import { PRICED_APIS } from "./api-pricing";
import { getDocumentedSpecs } from "./docs-registry";
import {
	SPEC_COMMISSIONS,
	SPEC_PRICES,
	specCommission,
	specPrice,
} from "./spec-prices";

const documented = new Map(getDocumentedSpecs().map((s) => [s.id, s]));

describe("billable ↔ priced", () => {
	it("every billable documented endpoint has a price", () => {
		const unpriced = [...documented.values()]
			.filter((s) => s.semantics?.billable && !specPrice(s.id))
			.map((s) => s.id);
		expect(unpriced).toEqual([]);
	});

	it("every price points at a billable documented endpoint", () => {
		const wrong = Object.keys(SPEC_PRICES).filter(
			(id) => !documented.get(id)?.semantics?.billable,
		);
		expect(wrong).toEqual([]);
	});

	it("no endpoint is priced by two verification rows", () => {
		const ids = PRICED_APIS.flatMap((api) => (api.specId ? [api.specId] : []));
		expect(ids.length).toBe(new Set(ids).size);
	});
});

describe("price labels", () => {
	it("formats a verification row with its unit and calculator link", () => {
		expect(specPrice("pan-lite")).toMatchObject({
			label: "₹1.20 + GST / verification",
			href: "/pricing?apis=pan-lite#calculator",
		});
		expect(specPrice("ip")?.label).toBe("₹2.50 + GST / lookup");
	});

	it("prices DMT add-ons and AePS settlement from the BC modules", () => {
		expect(specPrice("dmt-levin-sender-ekyc")?.label).toBe(
			"₹11.00 incl. GST / new sender",
		);
		expect(specPrice("dmt-add-recipient")?.label).toBe(
			"₹3.54 incl. GST / new recipient",
		);
		expect(specPrice("aeps-initiate-settlement")?.label).toBe(
			"₹5.00–₹10.00 + GST / settlement",
		);
	});
});

describe("commission", () => {
	it("every commission points at a documented endpoint", () => {
		const unknown = Object.keys(SPEC_COMMISSIONS).filter(
			(id) => !documented.has(id),
		);
		expect(unknown).toEqual([]);
	});

	it("tags BBPS pay bill, AePS earnings calls and DMT transfers", () => {
		for (const id of [
			"bbps-pay-bill",
			"aeps-fingpay-cash-withdrawal",
			"aeps-fingpay-mini-statement",
			"dmt-initiate-transfer",
			"dmt-levin-initiate-transfer",
		])
			expect(specCommission(id)?.label, id).toBe("Earns commission");
		expect(specCommission("pan-lite")).toBeUndefined();
	});

	it("preselects the AePS line in the payments calculator", () => {
		expect(specCommission("aeps-fingpay-cash-withdrawal")?.href).toBe(
			"/pricing?tab=payments&pay=aeps-cashout:1000:2000#payments-calculator",
		);
		expect(specCommission("aeps-fingpay-mini-statement")?.href).toBe(
			"/pricing?tab=payments&pay=aeps-mini:500#payments-calculator",
		);
	});
});

describe("calculator links", () => {
	it("every price and commission opens a calculator section", () => {
		for (const [id, p] of Object.entries({
			...SPEC_PRICES,
			...SPEC_COMMISSIONS,
		}))
			expect(p.href, id).toMatch(
				/^\/pricing\?.*#(calculator|dmt-calculator|payments-calculator)$/,
			);
	});
});
