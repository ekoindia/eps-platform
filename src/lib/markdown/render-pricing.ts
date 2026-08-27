import { SITE_URL } from "@/lib/config/site";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import {
	GST_RATE,
	HAS_VOLUME_DISCOUNTS,
	PRICING_FAQS,
	PRICING_GROUPS,
	SETUP_FEE_DISCOUNTED,
	SETUP_FEE_DISCOUNT_PERCENT,
	VERIFICATION_SETUP_FEE,
	displayName,
	type PricedApi,
} from "@/lib/data/api-pricing";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_CATEGORIES,
	BC_SETUP_FEE,
	PAYMENTS_FAQS,
	TDS_RATE,
} from "@/lib/data/payments-pricing";
import {
	DMT_CUSTOMER_FEE_MIN,
	DMT_CUSTOMER_FEE_PCT,
	DMT_FAQS,
	DMT_MAX_TXN_AMOUNT,
	DMT_RECIPIENT_VERIFY_FEE,
	DMT_SENDER_KYC_FEE,
	EKO_DMT_CHARGE,
	calcDmtTxn,
	dmtRateCardRows,
	dmtSenderKycInclGst,
} from "@/lib/data/dmt-pricing";
import {
	CB_BANKS,
	CB_FAQS,
	CB_SETUP_FEE,
	CB_TXN_SLABS,
	CONNECTED_BANKING_ENABLED,
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
 * (earnings) and — when `CONNECTED_BANKING_ENABLED` — Connected Banking
 * charges. The interactive calculators are HTML-only, so this document carries
 * the complete tables, notes and FAQs.
 *
 * Pure function — no filesystem or network access — so it can be unit-tested.
 */
export function renderPricingMarkdown(): string {
	const canonical = `${SITE_URL}/pricing`;

	const blocks: (string | false | undefined)[] = [
		frontMatter({
			type: "pricing",
			title: CONNECTED_BANKING_ENABLED
				? "API Pricing & Commissions — Verification, Payments & Connected Banking | Eko Platform Services"
				: "API Pricing & Commissions — Verification & Payments | Eko Platform Services",
			description: CONNECTED_BANKING_ENABLED
				? "Transparent pricing for 25+ verification APIs plus partner commissions for DMT, AePS and BBPS, and Connected Banking charges. Full per-transaction rate card, exclusive of GST @ 18%."
				: "Transparent pricing for 25+ verification APIs plus partner commissions for DMT, AePS and BBPS. Full per-transaction rate card, exclusive of GST @ 18%.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("EPS API Pricing — Full Rate Card & Commissions"),
		SETUP_FEE_DISCOUNT_PERCENT >= 100
			? "Transparent, pay-per-use API pricing. Setup fee waived for a limited time on verification APIs. No monthly minimums. Pay only for successful verifications."
			: SETUP_FEE_DISCOUNTED
				? `Transparent, pay-per-use API pricing. ${SETUP_FEE_DISCOUNT_PERCENT}% off the one-time setup fee for a limited time. No monthly minimums. Pay only for successful verifications.`
				: "Transparent, pay-per-use API pricing. No monthly minimums. Pay only for successful verifications.",
		CONNECTED_BANKING_ENABLED
			? "This page covers (1) Verification API pricing (a cost you pay per call), (2) Payments & BC commissions for DMT, AePS and BBPS (which EARN you a commission per transaction), and (3) Connected Banking charges."
			: "This page covers (1) Verification API pricing (a cost you pay per call) and (2) Payments & BC commissions for DMT, AePS and BBPS (which EARN you a commission per transaction).",
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

	// ---- DMT (its own pricing tab — a per-transaction ledger, not slabs) ----
	const dmtExample = calcDmtTxn(DMT_MAX_TXN_AMOUNT);
	blocks.push(
		h2("Domestic Money Transfer (DMT) Charges"),
		`The sender pays a transaction fee of ${DMT_CUSTOMER_FEE_PCT * 100}% of the transfer amount (minimum ${formatRate(DMT_CUSTOMER_FEE_MIN)}). That fee is **inclusive of GST @ ${Math.round(GST_RATE * 100)}%** — GST is never added on top of it. Stripping the GST out gives the taxable value; Eko's flat charge of ${formatRate(EKO_DMT_CHARGE)} per transaction comes off that, and the remainder is your commission, from which TDS @ ${Math.round(TDS_RATE * 100)}% is withheld.`,
		`Worked example on a ${formatAmount(dmtExample.amount)} transfer: ${formatRate(dmtExample.customerFee)} fee → ${formatRate(dmtExample.feeExGst)} taxable value → less ${formatRate(dmtExample.ekoCharge)} → **${formatRate(dmtExample.grossCommission)} gross commission** → less ${formatRate(dmtExample.tds)} TDS → ${formatRate(dmtExample.netCommission)} net.`,
		markdownTable(
			[
				"Transfer amount (INR)",
				"Sender fee (incl. GST)",
				"GST in fee",
				"Taxable value",
				"Eko charge",
				"Your commission",
				`After TDS @ ${Math.round(TDS_RATE * 100)}%`,
			],
			dmtRateCardRows().map((row) => [
				formatAmount(row.amount),
				formatRate(row.customerFee),
				formatRate(row.gstInFee),
				formatRate(row.feeExGst),
				formatRate(row.ekoCharge),
				formatRate(row.grossCommission),
				formatRate(row.netCommission),
			]),
		),
		`Commission scales continuously with the transfer amount — the table lists representative amounts, not bands. Below ${formatAmount(1000)} the fee floors at ${formatRate(DMT_CUSTOMER_FEE_MIN)}, so commission is flat at ${formatRate(calcDmtTxn(100).grossCommission)}.`,
		h3("Reverse Charge Mechanism (RCM)"),
		`DMT commission is notified under reverse charge: the GST on your commission is paid to the government by Eko, not collected and remitted by you. Raise your invoice to Eko with the **RCM option set to "YES"** and no GST line on it. On the ${formatAmount(dmtExample.amount)} example the RCM amount is ${formatRate(dmtExample.rcmGst)} (${Math.round(GST_RATE * 100)}% of ${formatRate(dmtExample.grossCommission)}). Confirm the treatment for your own registration with your accountant.`,
		h3("Other DMT charges"),
		bulletList([
			`Sender KYC: ${formatAmount(DMT_SENDER_KYC_FEE)} + GST (${formatRate(dmtSenderKycInclGst())}), charged once per newly registered sender.`,
			`Recipient bank account verification: ${formatRate(DMT_RECIPIENT_VERIFY_FEE)} (incl. GST), charged once per new recipient — not per transfer.`,
			"Both are debited from your wallet; you may recover them from your customer in your own app.",
			`Maximum transfer amount: ${formatAmount(DMT_MAX_TXN_AMOUNT)} per transaction.`,
		]),
	);

	// ---- Payments & BC commissions (AePS, BBPS) ----
	blocks.push(
		h2("Payments & BC API Commissions (AePS, BBPS)"),
		`Unlike verification APIs, these products **pay you a commission** per transaction. All commission figures are in INR, exclusive of GST @ ${Math.round(GST_RATE * 100)}%. TDS @ ${Math.round(TDS_RATE * 100)}% is deducted from commission payouts.`,
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

	// ---- Connected Banking (omitted while the product is disabled) ----
	if (CONNECTED_BANKING_ENABLED) {
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
	}

	blocks.push(
		h2("Pricing Notes"),
		bulletList([
			`All listed rates exclude GST, charged at ${Math.round(GST_RATE * 100)}%.`,
			"Billing is per successful API call — failed or errored calls are not charged.",
			"No monthly minimums and no lock-in.",
			`One-time setup fee: ${formatAmount(VERIFICATION_SETUP_FEE)} per verification API and ${formatAmount(BC_SETUP_FEE)} per BC/Payments API family (DMT, AePS, BBPS), excl. GST.`,
			...(SETUP_FEE_DISCOUNT_PERCENT >= 100
				? [
						"Setup fees are currently waived as a limited-time offer (₹0 to activate).",
					]
				: SETUP_FEE_DISCOUNTED
					? [
							`Setup fees are currently **${SETUP_FEE_DISCOUNT_PERCENT}% off** as a limited-time offer. A full waiver is available against a higher monthly volume commitment.`,
						]
					: [
							"A full setup-fee waiver is available against a higher monthly volume commitment.",
						]),
			...(HAS_VOLUME_DISCOUNTS
				? [
						"Volume discounts apply automatically — higher monthly volumes get lower per-transaction rates.",
					]
				: []),
			"Commercials are subject to change based on service-provider terms; revisions are communicated in advance.",
		]),
		h2("FAQs"),
	);

	// CB_FAQS is empty while Connected Banking is disabled.
	for (const faq of [
		...PRICING_FAQS,
		...DMT_FAQS,
		...PAYMENTS_FAQS,
		...CB_FAQS,
	]) {
		blocks.push(`${h3(faq.q)}\n${faq.a}`);
	}

	blocks.push(h2("More Information"), bulletList([indexPageNotice()]));

	return joinBlocks(blocks);
}
