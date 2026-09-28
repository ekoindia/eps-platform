import { buildEngine } from "@/lib/search-engine";
import { DMT_DEFAULT_INPUT, calcDmtQuote } from "@/lib/data/dmt-pricing";
import { calcEarningsQuote } from "@/lib/data/payments-pricing";
import { formatINR } from "@/lib/utils";
import { describe, expect, it } from "vitest";
import { earningsProductOf, earningsSlotsOf } from "./earnings";
import { detectIntent } from "./intent";
import { resolveAction } from "./resolve";

describe("earningsProductOf", () => {
	it.each([
		["dmt", "dmt"],
		["money transfer", "dmt"],
		["aeps", "aeps-cashout"],
		["cash withdrawal", "aeps-cashout"],
		["mini statement", "aeps-mini"],
		["electricity bills", "bbps-electricity"],
		["mobile recharge", "bbps-prepaid"],
		["dth", "bbps-dth"],
		["bbps", "bbps-electricity"],
	])("%s → %s", (subject, id) => {
		expect(earningsProductOf(subject)).toBe(id);
	});

	it("returns null when no product is named", () => {
		expect(earningsProductOf("how much can i make")).toBeNull();
	});
});

describe("earningsSlotsOf", () => {
	it.each([
		["500 dmt a month", { txns: 500 }],
		["1000 withdrawals of 3000", { txns: 1000, amount: 3000 }],
		["2000 per month", { txns: 2000 }],
		["100000 dmt transactions avg 5000", { txns: 100000, amount: 5000 }],
		["aeps", {}],
	])("%s → %j", (query, slots) => {
		expect(earningsSlotsOf(query, query)).toEqual(slots);
	});

	// normalizeAmounts strips "₹", so the currency cue is read from the raw query.
	it("reads a ₹ amount from the raw query", () => {
		expect(earningsSlotsOf("500 aeps 3000", "500 aeps ₹3,000")).toEqual({
			txns: 500,
			amount: 3000,
		});
	});
});

describe("detectIntent → estimate_earnings", () => {
	it("fills product and numbers", () => {
		expect(
			detectIntent("How much will I earn on 500 DMT a month?"),
		).toMatchObject({
			intent: "estimate_earnings",
			slots: { product: "dmt", txns: 500 },
		});
		expect(
			detectIntent("aeps commission for 1 lakh withdrawals of ₹2,500"),
		).toMatchObject({
			intent: "estimate_earnings",
			slots: { product: "aeps-cashout", txns: 100000, amount: 2500 },
		});
	});
});

describe("resolveAction → estimate_earnings (real pricing data)", () => {
	const engine = buildEngine();

	it("prefills the DMT calculator and shows its take-home", () => {
		const input = { ...DMT_DEFAULT_INPUT, monthlyTxns: 500 };
		const card = resolveAction(engine, "what will i earn on 500 dmt a month");
		expect(card).toMatchObject({
			intent: "estimate_earnings",
			id: "action:estimate_earnings:dmt",
			primary: {
				href: `/pricing?tab=dmt&dmt=${input.amount}:500:${input.newSendersPerMonth}:${input.newRecipientsPerMonth}:0#dmt-calculator`,
			},
		});
		expect(card?.title).toContain(
			formatINR(calcDmtQuote(input).monthlyTakeHome, 0),
		);
	});

	it("prefills the AePS/BBPS calculator and shows gross commission", () => {
		const card = resolveAction(
			engine,
			"aeps commission for 1000 withdrawals of ₹3,000",
		);
		const quote = calcEarningsQuote([
			{ productId: "aeps-cashout", monthlyTxns: 1000, avgAmount: 3000 },
		]);
		expect(card).toMatchObject({
			id: "action:estimate_earnings:aeps-cashout",
			primary: {
				href: "/pricing?tab=payments&pay=aeps-cashout:1000:3000#payments-calculator",
			},
		});
		expect(card?.title).toContain(formatINR(quote.total, 0));
	});

	it("uses the calculator's defaults for numbers the query leaves out", () => {
		expect(
			resolveAction(engine, "earnings from mobile recharge"),
		).toMatchObject({
			primary: {
				href: "/pricing?tab=payments&pay=bbps-prepaid:500:300#payments-calculator",
			},
		});
	});

	it("opens the calculator unfilled when no product is named", () => {
		expect(resolveAction(engine, "how much can i earn")).toMatchObject({
			id: "action:estimate_earnings:calculator",
			primary: { href: "/pricing?tab=payments#payments-calculator" },
		});
	});
});
