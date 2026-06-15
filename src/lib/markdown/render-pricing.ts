import { SITE_URL } from "@/lib/config/site";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import {
	GST_RATE,
	HAS_VOLUME_DISCOUNTS,
	PRICING_FAQS,
	PRICING_GROUPS,
	SETUP_FEE_WAIVED,
	displayName,
	type PricedApi,
} from "@/lib/data/api-pricing";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_CATEGORIES,
	DMT_CUSTOMER_FEE_MIN,
	DMT_CUSTOMER_FEE_PCT,
	DMT_MAX_TXN_AMOUNT,
	DMT_SENDER_KYC_FEE,
	DMT_SLABS,
	PAYMENTS_FAQS,
	TDS_RATE,
} from "@/lib/data/payments-pricing";
import {
	CB_BANKS,
	CB_FAQS,
	CB_SETUP_FEE,
	CB_TXN_SLABS,
} from "@/lib/data/connected-banking-pricing";
import {
	bulletList,
	canonicalNotice,
	formatAmount,
	formatRate,
	frontMatter,
	gettingStartedNotice,
	h1,
	h2,
	h3,
	indexPageNotice,
	joinBlocks,
	markdownTable,
	slabRange,
	slabValue,
} from "./shared";

/** One rate-card table row: name (+ product link), rate, billing unit. */
const rateRow = (api: PricedApi): string[] => {
	const product = api.productId
		? ACTIVE_PRODUCTS_MAP[api.productId]
		: undefined;
	const name = api.popular
		? `**${displayName(api)}** (Popular)`
		: displayName(api);
	// Lowest rate across tiers — matches the rate card's headline figure.
	const rate = Math.min(...api.tiers.map((tier) => tier.rate));
	return [
		name,
		formatRate(rate),
		api.unitLabel ?? "per verification",
		product
			? `[${product.shortName ?? product.name}](${SITE_URL}${productHref(product.slug)}.md)`
			: "—",
	];
};

/**
 * Render `/pricing.md` — the full rate card for ALL products, mirroring the
 * HTML `/pricing` page: verification APIs (cost), DMT/AePS/BBPS commissions
 * (earnings) and Connected Banking charges. The interactive calculators are
 * HTML-only, so this document carries the complete tables, notes and FAQs.
 *
 * Pure function — no filesystem or network access — so it can be unit-tested.
 */
export function renderPricingMarkdown(): string {
	const canonical = `${SITE_URL}/pricing`;

	const blocks: (string | false | undefined)[] = [
		frontMatter({
			type: "pricing",
			title:
				"API Pricing & Commissions — Verification, Payments & Connected Banking | Eko Platform Services",
			description:
				"Transparent pricing for 25+ verification APIs plus partner commissions for DMT, AePS and BBPS, and Connected Banking charges. Full per-transaction rate card, exclusive of GST @ 18%.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("EPS API Pricing — Full Rate Card & Commissions"),
		SETUP_FEE_WAIVED
			? "Transparent, pay-per-use API pricing. Setup fee waived for a limited time on verification APIs. No monthly minimums. Pay only for successful verifications."
			: "Transparent, pay-per-use API pricing. No monthly minimums. Pay only for successful verifications.",
		"This page covers (1) Verification API pricing (a cost you pay per call), (2) Payments & BC commissions for DMT, AePS and BBPS (which EARN you a commission per transaction), and (3) Connected Banking charges.",
		`Interactive pricing calculators (pick APIs, set monthly volumes, see your estimated cost or earnings) are available on the HTML page: ${canonical}`,
		gettingStartedNotice(),
		h2("Verification API Rate Card"),
		`All rates are in INR per transaction, **exclusive of GST @ ${Math.round(GST_RATE * 100)}%**.`,
	];

	for (const group of PRICING_GROUPS) {
		blocks.push(
			h3(group.label),
			markdownTable(
				["API", "Rate (INR, excl. GST)", "Billing unit", "Product page"],
				group.apis.map(rateRow),
			),
		);
	}

	if (PRICING_GROUPS.some((group) => group.apis.some((api) => api.isBulk))) {
		blocks.push(
			"\\* Bulk APIs are billed per individual verification inside the bulk request, not per bulk call.",
		);
	}

	// ---- Payments & BC commissions (DMT, AePS, BBPS) ----
	blocks.push(
		h2("Payments & BC API Commissions (DMT, AePS, BBPS)"),
		`Unlike verification APIs, these products **pay you a commission** per transaction. All commission figures are in INR, exclusive of GST @ ${Math.round(GST_RATE * 100)}%. TDS @ ${Math.round(TDS_RATE * 100)}% is deducted from commission payouts.`,
		h3("Domestic Money Transfer (DMT)"),
		markdownTable(
			[
				"Txn amount (INR)",
				"Eko pricing (excl. GST)",
				"Your commission (excl. GST)",
				`After TDS @ ${Math.round(TDS_RATE * 100)}%`,
			],
			DMT_SLABS.map((slab) => [
				`${formatAmount(slab.from)} – ${formatAmount(slab.upTo)}`,
				formatRate(slab.ekoPricing),
				formatRate(slab.commission),
				formatRate(slab.commission * (1 - TDS_RATE)),
			]),
		),
		bulletList([
			`Sender transaction fee: ${DMT_CUSTOMER_FEE_PCT * 100}% of the amount, minimum ${formatRate(DMT_CUSTOMER_FEE_MIN)} — paid by the sender.`,
			`One-time sender KYC charge: ${formatAmount(DMT_SENDER_KYC_FEE)} (excl. GST), paid by the sender at registration.`,
			`Maximum transaction amount: ${formatAmount(DMT_MAX_TXN_AMOUNT)}.`,
			"Actual earnings depend on your transaction-amount mix; commission applies per the slab of each transaction.",
		]),
		h3("AePS — Aadhaar-Enabled Payment System"),
		markdownTable(
			["Transaction bracket (INR)", "Cashout commission"],
			AEPS_CASHOUT_SLABS.map((slab) => [slabRange(slab), slabValue(slab)]),
		),
		`Mini statement: ${formatRate(AEPS_MINI_STATEMENT_COMMISSION)} per transaction.`,
		"Fund settlement charges (paid by you, incl. GST on the charge):",
		markdownTable(
			["Settlement bracket (INR)", "Charge"],
			AEPS_SETTLEMENT_CHARGES.map((slab) => [
				slabRange(slab),
				`${slabValue(slab)} + GST`,
			]),
		),
		h3("BBPS Bill Payments (category-level)"),
		"Commission per transaction by bill category. Where rates vary by operator, the lowest operator rate is shown (conservative estimate) with the range in notes.",
		markdownTable(
			["Category", "Commission (excl. GST)", "Notes"],
			BBPS_CATEGORIES.map((category) => [
				category.name,
				category.slabs
					.map((slab) =>
						category.slabs.length > 1
							? `${slabRange(slab)}: ${slabValue(slab)}`
							: slabValue(slab),
					)
					.join("; "),
				category.rangeNote ?? "—",
			]),
		),
		`Operator-wise commission for 100+ BBPS billers is available in the downloadable Excel rate card: ${SITE_URL}/eps-pricing-calculator.xlsx`,
	);

	// ---- Connected Banking ----
	blocks.push(
		h2("Connected Banking Pricing"),
		"Virtual account & BaaS infrastructure. Connected Banking is a cost you pay (like verification APIs), not a commission product.",
		bulletList([
			`One-time setup fee: ${formatAmount(CB_SETUP_FEE)} + GST per bank per user.`,
			`Available banks: ${CB_BANKS.join(", ")}.`,
		]),
		markdownTable(
			["Transaction slab (INR)", "Charge per txn (excl. GST)"],
			CB_TXN_SLABS.map((slab) => [slabRange(slab), slabValue(slab)]),
		),
	);

	blocks.push(
		h2("Pricing Notes"),
		bulletList([
			`All listed rates exclude GST, charged at ${Math.round(GST_RATE * 100)}%.`,
			"Billing is per successful API call — failed or errored calls are not charged.",
			"No monthly minimums and no lock-in.",
			...(SETUP_FEE_WAIVED
				? [
						"Setup fees are currently waived as a limited-time offer (₹0 to activate).",
					]
				: []),
			...(HAS_VOLUME_DISCOUNTS
				? [
						"Volume discounts apply automatically — higher monthly volumes get lower per-transaction rates.",
					]
				: []),
			"Commercials are subject to change based on service-provider terms; revisions are communicated in advance.",
		]),
		h2("FAQs"),
	);

	for (const faq of [...PRICING_FAQS, ...PAYMENTS_FAQS, ...CB_FAQS]) {
		blocks.push(`${h3(faq.q)}\n${faq.a}`);
	}

	blocks.push(h2("More Information"), bulletList([indexPageNotice()]));

	return joinBlocks(blocks);
}
