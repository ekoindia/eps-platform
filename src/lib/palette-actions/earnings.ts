import {
	DMT_DEFAULT_INPUT,
	calcDmtQuote,
	clampDmtAmount,
	serializeDmtInput,
} from "@/lib/data/dmt-pricing";
import {
	EARNINGS_PRODUCTS,
	EARNINGS_PRODUCTS_MAP,
	MAX_TXNS,
	calcEarningsQuote,
	clampAvgAmount,
	serializeSelection,
	type EarningsSelection,
} from "@/lib/data/payments-pricing";
import { formatINR, formatIndianCompact } from "@/lib/utils";
import { normalizeAmounts } from "./normalize";
import type { ActionCard, DetectedIntent } from "./types";

/** The DMT calculator's product id in slots; it has its own pricing tab. */
const DMT = "dmt";

/** Lowercase words of 3+ characters, for loose product-name matching. */
const words = (text: string): string[] =>
	text.toLowerCase().match(/[a-z]{3,}/g) ?? [];

/**
 * Words naming each calculator product: its id parts and display name,
 * derived from the pricing data so a new BBPS category needs no edit here.
 * DMT first — it lives on its own tab, outside EARNINGS_PRODUCTS.
 */
const PRODUCT_WORDS: [string, string[]][] = [
	[DMT, ["dmt", "money", "transfer", "remittance", "domestic"]],
	...EARNINGS_PRODUCTS.map((p): [string, string[]] => [
		p.id,
		[...new Set([...words(p.id), ...words(p.name)])],
	]),
];

/** A query word matches a product word by prefix either way ("bills"/"bill", "elec"/"electricity"). */
const wordMatches = (query: string, product: string): boolean =>
	query.startsWith(product) || (query.length >= 4 && product.startsWith(query));

/**
 * The calculator product a query names: the one sharing the most words with
 * it, earliest on a tie (so plain "aeps" → cash withdrawal, "bbps" → electricity).
 * @param query - The query or its subject.
 * @returns A calculator id (`dmt` or an EARNINGS_PRODUCTS id), or null.
 */
export function earningsProductOf(query: string): string | null {
	const queryWords = words(query);
	let best: string | null = null;
	let bestScore = 0;
	for (const [id, productWords] of PRODUCT_WORDS) {
		const score = productWords.filter((pw) =>
			queryWords.some((qw) => wordMatches(qw, pw)),
		).length;
		if (score > bestScore) {
			best = id;
			bestScore = score;
		}
	}
	return best;
}

/** Words after a number that make it a monthly transaction count. */
const COUNT_AFTER =
	/^\s*(?:[a-z]+\s+){0,2}?(?:txns?|transactions?|withdrawals?|transfers?|bills?|recharges?|payments?|monthly|(?:a|per|every|each|\/)\s*month)\b/;
/** Words before a number that make it an average amount. */
const AMOUNT_BEFORE =
	/\b(?:avg|average|of|worth|size|amount|ticket)\s*(?:of\s*)?$/;
/** Words after a number that make it an amount. */
const AMOUNT_AFTER = /^\s*(?:rupees?|rs)\b/;

/**
 * Reads the monthly count and average amount from an earnings question.
 * ponytail: cue-word heuristics, not a parser. A number with no cue fills the
 * count first, then the amount.
 * @param normalised - The query after normalizeAmounts (digits only).
 * @param raw - The original query; its "₹" marks an amount, which
 *   normalizeAmounts strips.
 * @returns `txns` and/or `amount`, whichever the query states.
 */
export function earningsSlotsOf(
	normalised: string,
	raw: string,
): { txns?: number; amount?: number } {
	const text = normalised.toLowerCase();
	const rupeeAmounts = new Set(
		[...raw.matchAll(/(?:₹|\brs\.?|\binr)\s*[\d,.]+\s*[a-z]*/gi)].map((m) =>
			Number(normalizeAmounts(m[0]).match(/\d+/)?.[0]),
		),
	);
	const slots: { txns?: number; amount?: number } = {};
	const unassigned: number[] = [];
	for (const match of text.matchAll(/\d+/g)) {
		const value = Number(match[0]);
		const end = (match.index ?? 0) + match[0].length;
		const before = text.slice(0, match.index);
		const after = text.slice(end);
		if (slots.txns === undefined && COUNT_AFTER.test(after)) {
			slots.txns = value;
		} else if (
			slots.amount === undefined &&
			(rupeeAmounts.has(value) ||
				AMOUNT_BEFORE.test(before) ||
				AMOUNT_AFTER.test(after))
		) {
			slots.amount = value;
		} else {
			unassigned.push(value);
		}
	}
	for (const value of unassigned) {
		if (slots.txns === undefined) slots.txns = value;
		else if (slots.amount === undefined) slots.amount = value;
	}
	return slots;
}

/** Whole count within the calculator's bounds. */
const clampTxns = (txns: number): number =>
	Math.min(Math.max(Math.round(txns), 0), MAX_TXNS);

/**
 * `estimate_earnings`: the earnings calculator, pre-filled from the query,
 * with the calculator's own headline number on the card — computed by the
 * same pricing functions, so card and page never disagree.
 * @param detected - The detected intent, with `product`/`txns`/`amount` slots.
 */
export function resolveEstimateEarnings(detected: DetectedIntent): ActionCard {
	const { product, txns, amount } = detected.slots as {
		product?: string;
		txns?: number;
		amount?: number;
	};
	const base = {
		intent: "estimate_earnings" as const,
		badge: "Earnings",
		secondary: [],
		alternatives: [],
	};

	if (product === DMT) {
		const input = {
			...DMT_DEFAULT_INPUT,
			amount: clampDmtAmount(amount ?? DMT_DEFAULT_INPUT.amount),
			monthlyTxns: clampTxns(txns ?? DMT_DEFAULT_INPUT.monthlyTxns),
		};
		const quote = calcDmtQuote(input);
		return {
			...base,
			id: `action:estimate_earnings:${DMT}`,
			title: `≈ ${formatINR(quote.monthlyTakeHome, 0)}/month take-home from DMT`,
			detail: `${formatIndianCompact(input.monthlyTxns)} transfers × ${formatINR(input.amount, 0)} · after TDS and new-customer KYC`,
			primary: {
				label: "Open calculator",
				href: `/pricing?tab=dmt&dmt=${serializeDmtInput(input)}#dmt-calculator`,
			},
		};
	}

	const earnings = product ? EARNINGS_PRODUCTS_MAP[product] : undefined;
	if (!earnings) {
		return {
			...base,
			id: "action:estimate_earnings:calculator",
			title: "Estimate your monthly earnings",
			detail: "Commission calculator for AePS, BBPS and DMT",
			primary: {
				label: "Open calculator",
				href: "/pricing?tab=payments#payments-calculator",
			},
		};
	}

	const selection: EarningsSelection = {
		productId: earnings.id,
		monthlyTxns: clampTxns(txns ?? earnings.defaultMonthlyTxns),
		avgAmount: earnings.needsAmount
			? clampAvgAmount(earnings, amount ?? earnings.defaultAvgAmount ?? 0)
			: undefined,
	};
	const quote = calcEarningsQuote([selection]);
	const volume = `${formatIndianCompact(selection.monthlyTxns)} txns`;
	return {
		...base,
		id: `action:estimate_earnings:${earnings.id}`,
		title: `≈ ${formatINR(quote.total, 0)}/month commission from ${earnings.name}`,
		detail:
			selection.avgAmount !== undefined
				? `${volume} × ${formatINR(selection.avgAmount, 0)} · gross, excl. GST`
				: `${volume} · gross, excl. GST`,
		primary: {
			label: "Open calculator",
			href: `/pricing?tab=payments&pay=${serializeSelection([selection])}#payments-calculator`,
		},
	};
}
