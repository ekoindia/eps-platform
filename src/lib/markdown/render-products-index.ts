import type { FAQ } from "@/components/ProductPageLayout";
import { SITE_URL } from "@/lib/config/site";
import type { ApiProductRef } from "@/lib/data/api-products";
import {
	GST_RATE,
	SETUP_FEE_WAIVED,
	displayName,
	getPricedApisForProduct,
	type PricedApi,
} from "@/lib/data/api-pricing";
import { BBPS_OPERATORS } from "@/lib/data/bbps-operators";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	BBPS_CATEGORIES,
	DMT_CUSTOMER_FEE_MIN,
	DMT_CUSTOMER_FEE_PCT,
	DMT_MAX_TXN_AMOUNT,
	DMT_SENDER_KYC_FEE,
	DMT_SLABS,
	TDS_RATE,
} from "@/lib/data/payments-pricing";
import type { ProductPageDataShape } from "./render-product";
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

/** Join short phrases into one inline, comma-separated line. */
const inlineList = (items: string[]): string =>
	items.map((item) => item.trim()).join(", ");

/** Render "- **title** — desc" bullets for features/benefits. */
const titledBullets = (items: { title: string; desc: string }[]): string =>
	items.map((item) => `- **${item.title}** — ${item.desc.trim()}`).join("\n");

/** Render product FAQs as compact "- **Q** A" bullets. */
const faqBullets = (faqs: FAQ[]): string =>
	faqs.map((faq) => `- **${faq.q}** ${faq.a.trim()}`).join("\n");

/** Minimal preview shape shared by `inputOutputPreview` and `inputOutputPreviews[]`. */
interface PreviewLike {
	apiName: string;
	method?: string;
	endpoint?: string;
	inputs?: { label: string }[];
	outputs?: { label: string }[];
	comingSoon?: boolean;
	sampleJson?: { method: string; endpoint: string };
}

/**
 * Build compact one-line endpoint summaries from a page's API previews —
 * endpoint + input/output field labels only (no sample values or JSON).
 */
const previewLines = (page: ProductPageDataShape): string | undefined => {
	const previews: PreviewLike[] = page.inputOutputPreviews?.length
		? page.inputOutputPreviews
		: page.inputOutputPreview
			? [page.inputOutputPreview]
			: [];

	const lines = previews
		.filter((preview) => !preview.comingSoon)
		.map((preview) => {
			const inputs = (preview.inputs ?? []).map((field) => field.label);
			const outputs = (preview.outputs ?? []).map((field) => field.label);
			if (inputs.length === 0 && outputs.length === 0) return undefined;

			const method = preview.sampleJson?.method ?? preview.method;
			const endpoint = preview.sampleJson?.endpoint ?? preview.endpoint;
			const endpointPart =
				endpoint ? `\`${method ? `${method} ` : ""}${endpoint}\` — ` : "";
			const io = [
				inputs.length > 0 ? `inputs: ${inlineList(inputs)}` : undefined,
				outputs.length > 0 ? `outputs: ${inlineList(outputs)}` : undefined,
			]
				.filter(Boolean)
				.join(" → ");
			return `- ${endpointPart}${preview.apiName}: ${io}`;
		})
		.filter((line): line is string => Boolean(line));

	return lines.length > 0 ? lines.join("\n") : undefined;
};

/**
 * Render exactly one benefits block: prefer the short `keyBenefits` strings;
 * otherwise fall back to `benefits`, dropping items whose title duplicates a
 * feature title (case-insensitive) to avoid repeating the features list.
 */
const benefitsBlock = (page: ProductPageDataShape): string | undefined => {
	if (page.keyBenefits?.length) return bulletList(page.keyBenefits);
	if (!page.benefits?.length) return undefined;
	const featureTitles = new Set(
		(page.features ?? []).map((feature) => feature.title.toLowerCase()),
	);
	const distinct = page.benefits.filter(
		(benefit) => !featureTitles.has(benefit.title.toLowerCase()),
	);
	return distinct.length > 0 ? titledBullets(distinct) : undefined;
};

/** Render one tier list inline, e.g. "up to 10,000: ₹1.20; above: ₹1.00". */
const tiersInline = (api: PricedApi): string =>
	api.tiers
		.map((tier) =>
			tier.upTo === null
				? `${api.tiers.length > 1 ? "above: " : ""}${formatRate(tier.rate)}`
				: `up to ${tier.upTo.toLocaleString("en-IN")}: ${formatRate(tier.rate)}`,
		)
		.join("; ");

/** Pricing block for a verification product from its priced API variants. */
const verificationPricing = (product: ApiProductRef): string => {
	const apis = getPricedApisForProduct(product.id);
	if (apis.length === 0) {
		return `See the full rate card at ${SITE_URL}/pricing.md`;
	}

	if (apis.length === 1 && apis[0].tiers.length === 1) {
		const api = apis[0];
		const parts = [
			`${formatRate(api.tiers[0].rate)} ${api.unitLabel ?? "per verification"}`,
		];
		if (api.isBulk) parts.push("billed per record in bulk requests");
		if (api.notes) parts.push(api.notes);
		return parts.join(". ") + ".";
	}

	const table = markdownTable(
		["Variant", "Rate", "Billing unit"],
		apis.map((api) => [
			displayName(api),
			tiersInline(api),
			`${api.unitLabel ?? "per verification"}${api.isBulk ? " (billed per record in bulk requests)" : ""}`,
		]),
	);
	const notes = apis
		.filter((api) => api.notes)
		.map((api) => `${displayName(api)}: ${api.notes}`);
	return notes.length > 0 ? `${table}\n\n${bulletList(notes)}` : table;
};

/** DMT commission pricing — full slab table plus sender-fee notes. */
const dmtPricing = (): string =>
	[
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
		]),
	].join("\n\n");

/** AePS commission pricing — cashout slabs plus mini-statement rate. */
const aepsPricing = (): string =>
	[
		markdownTable(
			["Transaction bracket (INR)", "Cashout commission"],
			AEPS_CASHOUT_SLABS.map((slab) => [slabRange(slab), slabValue(slab)]),
		),
		`Mini statement: ${formatRate(AEPS_MINI_STATEMENT_COMMISSION)} per transaction.`,
	].join("\n\n");

/** BBPS commission pricing — category-level slab table plus operator pointer. */
const bbpsPricing = (): string =>
	[
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
		`Operator-level commission for ${BBPS_OPERATORS.length}+ BBPS billers: ${SITE_URL}/eps-pricing-calculator.xlsx (also summarised at ${SITE_URL}/pricing.md).`,
	].join("\n\n");

/** Pricing block for a product, switching on product id / category. */
const pricingBlock = (product: ApiProductRef): string => {
	if (product.id === "dmt") return dmtPricing();
	if (product.id === "aeps") return aepsPricing();
	if (product.id === "bbps") return bbpsPricing();
	if (product.category === "verification") return verificationPricing(product);
	return `See the full rate card at ${SITE_URL}/pricing.md`;
};

/** Render one product as a compact h3 section. */
const productSection = (
	product: ApiProductRef,
	page: ProductPageDataShape | undefined,
	commonQuestions: Set<string>,
): string => {
	const blocks: (string | undefined)[] = [h3(product.name)];

	if (!page) {
		blocks.push(
			product.shortDesc,
			`**Pricing:**\n${pricingBlock(product)}`,
			`**Links:** [Page](${SITE_URL}${product.href}) · [Markdown](${SITE_URL}${product.href}.md)`,
		);
		return joinBlocks(blocks).trimEnd();
	}

	blocks.push(page.overview || page.heroSubtitle || product.shortDesc);

	if (page.features?.length) {
		blocks.push(`**Features:**\n${titledBullets(page.features)}`);
	}

	const benefits = benefitsBlock(page);
	if (benefits) blocks.push(`**Key benefits:**\n${benefits}`);

	if (page.types?.length) {
		blocks.push(
			`**Supported types:** ${inlineList(page.types.map((t) => t.label))}`,
		);
	}

	if (page.whoShouldUse?.length) {
		blocks.push(`**Who should use:** ${inlineList(page.whoShouldUse)}`);
	}

	if (page.useCases?.length) {
		blocks.push(`**Use cases:** ${inlineList(page.useCases)}`);
	}

	const previews = previewLines(page);
	if (previews) blocks.push(`**API endpoints:**\n${previews}`);

	blocks.push(`**Pricing:**\n${pricingBlock(product)}`);

	const faqs = (page.faqs ?? []).filter((faq) => !commonQuestions.has(faq.q));
	if (faqs.length > 0) blocks.push(`**FAQs:**\n${faqBullets(faqs)}`);

	blocks.push(
		`**Links:** [Page](${SITE_URL}${product.href}) · [Markdown](${SITE_URL}${product.href}.md) · [API docs](${page.docsUrl})`,
	);

	return joinBlocks(blocks).trimEnd();
};

/**
 * Render `/products.md` — a single comprehensive reference document covering
 * every active API product (description, features, use cases, endpoints,
 * full pricing slabs and product-specific FAQs), compact enough for an LLM
 * to use standalone without fetching the per-product pages.
 *
 * Repetitive boilerplate (integration steps, per-product getting-started,
 * common FAQs) is intentionally excluded; `commonFaqs` is used to filter the
 * shared FAQs that data post-processing appends to every product page.
 */
export function renderProductsIndexMarkdown(
	products: ApiProductRef[],
	pages: Record<string, ProductPageDataShape> = {},
	commonFaqs: FAQ[] = [],
): string {
	const canonical = `${SITE_URL}/products`;
	const commonQuestions = new Set(commonFaqs.map((faq) => faq.q));

	const categories: { label: string; list: ApiProductRef[] }[] = [
		{
			label: "Verification APIs",
			list: products.filter((p) => p.category === "verification"),
		},
		{
			label: "Payment APIs",
			list: products.filter((p) => p.category === "payment"),
		},
		{
			label: "BC Agent APIs",
			list: products.filter((p) => p.category === "bc"),
		},
	];

	const categoryLabels: Record<ApiProductRef["category"], string> = {
		verification: "Verification",
		payment: "Payments",
		bc: "BC Agent",
	};

	const blocks: (string | undefined)[] = [
		frontMatter({
			type: "products-index",
			title: "APIs & Products — Complete Reference | Eko Platform Services",
			description:
				"Complete reference for all of Eko's fintech APIs — features, use cases, pricing slabs, endpoints and FAQs for every payment, verification and BC agent API, in one document.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("Eko APIs & Products — Complete Reference"),
		"Production-ready fintech APIs for payments, verification, and agent banking — built for India's digital economy. This document contains the full details of every active Eko API so it can be used standalone; per-product pages are linked in each section.",
		gettingStartedNotice(),
		`**Pricing notes (apply to every product below):** All rates and commissions are in INR, exclusive of GST @ ${Math.round(GST_RATE * 100)}%. Billing is per successful API call. Verification APIs are a cost you pay per call; DMT, AePS and BBPS pay YOU a commission per transaction (TDS @ ${Math.round(TDS_RATE * 100)}% is deducted from commission payouts).${SETUP_FEE_WAIVED ? " Setup fees are currently waived." : ""}`,
		h2("Products at a Glance"),
		markdownTable(
			["Product", "Category", "Summary"],
			products.map((product) => [
				`[${product.name}](${SITE_URL}${product.href})`,
				categoryLabels[product.category],
				product.shortDesc,
			]),
		),
	];

	for (const category of categories) {
		if (category.list.length === 0) continue;
		blocks.push(h2(category.label));
		for (const product of category.list) {
			blocks.push(productSection(product, pages[product.id], commonQuestions));
		}
	}

	blocks.push(
		h2("More Information"),
		bulletList([
			indexPageNotice(),
			`[Pricing rate card](${SITE_URL}/pricing.md): Consolidated pricing for all APIs and other offerings`,
		]),
	);

	return joinBlocks(blocks);
}
