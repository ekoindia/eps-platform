import type { FAQ } from "@/components/ProductPageLayout";
import { SITE_URL } from "@/lib/config/site";
import {
	GST_RATE,
	SETUP_FEE_WAIVED,
	displayName,
	getPricedApisForProduct,
	type PricedApi,
} from "@/lib/data/api-pricing";
import { productHref, type ApiProductRef } from "@/lib/data/api-products";
import {
	primaryDocSlug,
	specsToPreviews,
	specsToVerifiableFields,
	verifyHeading,
} from "@/lib/data/api-spec-previews";
import { getSpecsForProduct } from "@/lib/data/api-specs";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import { BBPS_OPERATORS } from "@/lib/data/bbps-operators";
import { docsHref } from "@/lib/data/docs-registry";
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
	aiGettingStartedNotice,
	bulletList,
	canonicalNotice,
	formatAmount,
	formatRate,
	frontMatter,
	gettingStartedNotice,
	heading,
	joinBlocks,
	link,
	slabRange,
	slabValue,
	table,
	type MarkdownFormat,
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

/**
 * Build compact one-line endpoint summaries from a product's API specs —
 * endpoint + input/output field labels only (no sample values or JSON).
 */
const previewLines = (specs: ApiSpec[]): string | undefined => {
	const lines = specsToPreviews(specs)
		.filter((preview) => !preview.comingSoon)
		.map((preview) => {
			const inputs = (preview.inputs ?? []).map((field) => field.label);
			const outputs = (preview.outputs ?? []).map((field) => field.label);
			if (inputs.length === 0 && outputs.length === 0) return undefined;

			const method = preview.sampleJson?.method ?? preview.method;
			const endpoint = preview.sampleJson?.endpoint ?? preview.endpoint;
			const endpointPart = endpoint
				? `\`${method ? `${method} ` : ""}${endpoint}\` — `
				: "";
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
	// if (page.keyBenefits?.length) return bulletList(page.keyBenefits);
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
const verificationPricing = (
	product: ApiProductRef,
	fmt: MarkdownFormat,
): string => {
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

	if (fmt === "txt") {
		// One line per variant — "Name: rate" — dropping the implied
		// "per verification" unit; the bulk "*" marker is footnoted once.
		const lines = apis.map((api, i) => {
			const unit =
				api.unitLabel && api.unitLabel !== "per verification"
					? ` ${api.unitLabel}`
					: "";
			return `  ${i + 1}. ${displayName(api)}: ${tiersInline(api)}${unit}`;
		});
		const trailer: string[] = [];
		if (apis.some((api) => api.isBulk)) {
			trailer.push("  * billed per record in bulk requests");
		}
		for (const api of apis) {
			if (api.notes) trailer.push(`  - ${displayName(api)}: ${api.notes}`);
		}
		return [...lines, ...trailer].join("\n");
	}

	const rateTable = table(
		["Variant", "Rate", "Billing unit"],
		apis.map((api) => [
			displayName(api),
			tiersInline(api),
			`${api.unitLabel ?? "per verification"}${api.isBulk ? " (billed per record in bulk requests)" : ""}`,
		]),
		fmt,
	);
	const notes = apis
		.filter((api) => api.notes)
		.map((api) => `${displayName(api)}: ${api.notes}`);
	return notes.length > 0 ? `${rateTable}\n\n${bulletList(notes)}` : rateTable;
};

const dmtSenderNotes = [
	`Sender transaction fee: ${DMT_CUSTOMER_FEE_PCT * 100}% of the amount, minimum ${formatRate(DMT_CUSTOMER_FEE_MIN)} — paid by the sender.`,
	`One-time sender KYC charge: ${formatAmount(DMT_SENDER_KYC_FEE)} (excl. GST), paid by the sender at registration.`,
	`Maximum transaction amount: ${formatAmount(DMT_MAX_TXN_AMOUNT)}.`,
];

/** DMT commission pricing — full slab table plus sender-fee notes. */
const dmtPricing = (fmt: MarkdownFormat): string => {
	if (fmt === "txt") {
		// Inline numbered slabs: "range: eko pricing (Commission: x, After TDS: y)".
		const lines = DMT_SLABS.map((slab, i) => {
			const afterTds = formatRate(slab.commission * (1 - TDS_RATE));
			return `  ${i + 1}. ${formatAmount(slab.from)} – ${formatAmount(slab.upTo)}: ${formatRate(slab.ekoPricing)} (Commission: ${formatRate(slab.commission)}, After TDS: ${afterTds})`;
		});
		return [lines.join("\n"), bulletList(dmtSenderNotes)].join("\n\n");
	}
	return [
		table(
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
			fmt,
		),
		bulletList(dmtSenderNotes),
	].join("\n\n");
};

/** AePS commission pricing — cashout slabs plus mini-statement rate. */
const aepsPricing = (fmt: MarkdownFormat): string => {
	const miniStatement = `Mini statement: ${formatRate(AEPS_MINI_STATEMENT_COMMISSION)} per transaction.`;
	if (fmt === "txt") {
		// Inline numbered slabs: "range: commission".
		const lines = AEPS_CASHOUT_SLABS.map(
			(slab, i) => `  ${i + 1}. ${slabRange(slab)}: ${slabValue(slab)}`,
		);
		return [lines.join("\n"), miniStatement].join("\n\n");
	}
	return [
		table(
			["Transaction bracket (INR)", "Cashout commission"],
			AEPS_CASHOUT_SLABS.map((slab) => [slabRange(slab), slabValue(slab)]),
			fmt,
		),
		miniStatement,
	].join("\n\n");
};

/** Inline commission for one BBPS category, e.g. "₹0.72" or "slab: rate; …". */
const bbpsCommissionInline = (
	category: (typeof BBPS_CATEGORIES)[number],
): string =>
	category.slabs
		.map((slab) =>
			category.slabs.length > 1
				? `${slabRange(slab)}: ${slabValue(slab)}`
				: slabValue(slab),
		)
		.join("; ");

const bbpsOperatorPointer = `Operator-level commission for ${BBPS_OPERATORS.length}+ BBPS billers: ${SITE_URL}/eps-pricing-calculator.xlsx (also summarised at ${SITE_URL}/pricing.md).`;

/** BBPS commission pricing — category-level slab table plus operator pointer. */
const bbpsPricing = (fmt: MarkdownFormat): string => {
	if (fmt === "txt") {
		// Inline numbered list — one line per category, range notes in [brackets].
		const lines = BBPS_CATEGORIES.map((category, i) => {
			const note = category.rangeNote ? ` [${category.rangeNote}]` : "";
			return `  ${i + 1}. ${category.name}: ${bbpsCommissionInline(category)}${note}`;
		});
		return [lines.join("\n"), bbpsOperatorPointer].join("\n\n");
	}
	return [
		table(
			["Category", "Commission (excl. GST)", "Notes"],
			BBPS_CATEGORIES.map((category) => [
				category.name,
				bbpsCommissionInline(category),
				category.rangeNote ?? "—",
			]),
			fmt,
		),
		bbpsOperatorPointer,
	].join("\n\n");
};

/** Pricing block for a product, switching on product id / category. */
const pricingBlock = (product: ApiProductRef, fmt: MarkdownFormat): string => {
	if (product.id === "dmt") return dmtPricing(fmt);
	if (product.id === "aeps") return aepsPricing(fmt);
	if (product.id === "bbps") return bbpsPricing(fmt);
	if (product.category === "verification")
		return verificationPricing(product, fmt);
	return `See the full rate card at ${SITE_URL}/pricing.md`;
};

/** Render one product as a compact h3 section. */
const productSection = (
	product: ApiProductRef,
	page: ProductPageDataShape | undefined,
	commonQuestions: Set<string>,
	fmt: MarkdownFormat,
	number: string,
	specs: ApiSpec[],
): string => {
	// md links to the per-product markdown twin and joins with " · "; txt drops
	// the markdown link and uses a plain comma separator.
	const sep = fmt === "md" ? " · " : ", ";
	const pageLink = link("Page", `${SITE_URL}${productHref(product.slug)}`, fmt);
	const mdLink =
		fmt === "md"
			? link("Markdown", `${SITE_URL}${productHref(product.slug)}.md`, fmt)
			: null;
	const linksLine = (...parts: (string | null)[]): string =>
		`**Links:** ${parts.filter(Boolean).join(sep)}`;
	// BBPS/DMT inline their commission slabs, so the label spells out the basis.
	const pricingLabel =
		product.id === "bbps"
			? "**Pricing (commission, excl. GST):**"
			: product.id === "dmt"
				? `**Pricing (excl. GST, TDS @ ${Math.round(TDS_RATE * 100)}%):**`
				: product.id === "aeps"
					? "**Pricing (commission):**"
					: "**Pricing:**";
	const pricing = `${pricingLabel}\n${pricingBlock(product, fmt)}`;
	const blocks: (string | undefined)[] = [
		heading(3, product.name, fmt, number),
	];

	if (!page) {
		blocks.push(product.shortDesc, pricing, linksLine(pageLink, mdLink));
		return joinBlocks(blocks).trimEnd();
	}

	// Pricing sits right under the description (before features) in every format.
	blocks.push(page.overview || page.heroSubtitle || product.shortDesc, pricing);

	if (page.features?.length) {
		blocks.push(`**Features:**\n${titledBullets(page.features)}`);
	}

	// Key benefits omitted from the plain-text twin to keep the parts compact.
	const benefits = fmt === "txt" ? undefined : benefitsBlock(page);
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

	if (product.category === "verification") {
		const verifiable = specsToVerifiableFields(specs);
		if (verifiable.length > 0) {
			blocks.push(
				`**${verifyHeading(product.name)}**\n${verifiable
					.map((f) =>
						f.description
							? `- **${f.label}** — ${f.description}`
							: `- **${f.label}**`,
					)
					.join("\n")}`,
			);
		}
	}

	const previews = previewLines(specs);
	if (previews) blocks.push(`**API endpoints:**\n${previews}`);

	const faqs = (page.faqs ?? []).filter((faq) => !commonQuestions.has(faq.q));
	if (faqs.length > 0) blocks.push(`**FAQs:**\n${faqBullets(faqs)}`);

	const docSlug = primaryDocSlug(specs);
	blocks.push(
		linksLine(
			pageLink,
			mdLink,
			docSlug ? link("API docs", `${SITE_URL}${docsHref(docSlug)}`, fmt) : null,
		),
	);

	return joinBlocks(blocks).trimEnd();
};

/**
 * One standalone slice of the products reference — a subset of products rendered
 * as a self-contained `txt` document with its own H1/lede. Used to split the
 * otherwise-large `products.txt` into chatbot-trainable parts (each well under the
 * size that times out Zoho SalesIQ's AnswerBot training).
 */
export interface ProductsIndexPart {
	/** Emitted as `<slug>.txt`; also the public path `${SITE_URL}/<slug>.txt`. */
	slug: string;
	/** H1 override for the standalone document. */
	title: string;
	/** Short human label, used in the cross-links between sibling parts. */
	shortLabel: string;
	/** Lede paragraph override (sibling cross-links are appended automatically). */
	lede: string;
	/** Product ids to include, in display order; disabled ones are skipped. */
	productIds: string[];
}

/**
 * The split of `products.txt` into three trainable parts: identity/KYC
 * verification, business/compliance verification, and payments + agent banking.
 */
export const PRODUCTS_TXT_PARTS: ProductsIndexPart[] = [
	{
		slug: "products-verification-identity",
		title: "Eko EPS Verification APIs (Identity & KYC) — Reference",
		shortLabel: "Identity & KYC verification",
		lede: "Production-ready identity & KYC verification APIs from Eko EPS — validate individuals and their bank/UPI accounts in real time, built for India's digital economy. This document contains the full details of every identity & KYC verification API so it can be used standalone; per-product pages are linked in each section.",
		productIds: [
			"pan",
			"mobile-otp",
			"aadhaar",
			"bank",
			"upi",
			"digilocker",
			"dl",
			"voter-id",
			"passport",
			"name-match",
			"email",
		],
	},
	{
		slug: "products-verification-business",
		title: "Eko EPS Verification APIs (Business & Compliance) — Reference",
		shortLabel: "Business & compliance verification",
		lede: "Production-ready business & compliance verification APIs from Eko EPS — validate companies, directors, tax and regulatory status, built for India's digital economy. This document contains the full details of every business & compliance verification API so it can be used standalone; per-product pages are linked in each section.",
		productIds: [
			"gst",
			"cin",
			"din",
			"itr",
			"fssai",
			"employee",
			"rc",
			"e-challan",
			"ip",
			"geocoding",
		],
	},
	{
		slug: "products-payments",
		title: "Eko EPS Payments & Banking APIs (BBPS, DMT, AePS) — Reference",
		shortLabel: "Payments & banking",
		lede: "Production-ready payments & agent-banking APIs from Eko EPS — bill payments, domestic money transfer and Aadhaar-enabled cash withdrawal that pay YOU a commission per transaction, built for India's digital economy. This document contains the full details of every payments & banking API so it can be used standalone; per-product pages are linked in each section.",
		productIds: ["bbps", "dmt", "aeps"],
	},
];

/**
 * Render the products index in the requested `fmt`. Covers every active API
 * product (description, features, use cases, endpoints, full pricing slabs and
 * product-specific FAQs), compact enough for an LLM to use standalone without
 * fetching the per-product pages.
 *
 * The `txt` variant drops the front-matter and canonical notice, numbers its
 * headings (`#1`, `#1.2`) and renders tables as indented numbered lists; bold
 * labels and backtick endpoints are kept in both formats. Repetitive
 * boilerplate (integration steps, per-product getting-started, common FAQs) is
 * intentionally excluded; `commonFaqs` filters the shared FAQs that data
 * post-processing appends to every product page.
 */
function renderProductsIndex(
	products: ApiProductRef[],
	pages: Record<string, ProductPageDataShape>,
	commonFaqs: FAQ[],
	fmt: MarkdownFormat,
	opts: {
		title?: string;
		lede?: string;
		omitMoreInfo?: boolean;
		specsByProduct?: Record<string, ApiSpec[]>;
	} = {},
): string {
	const commonQuestions = new Set(commonFaqs.map((faq) => faq.q));
	// Technical specs come from the registry unless explicitly supplied (tests).
	const specsFor = (id: string): ApiSpec[] =>
		opts.specsByProduct?.[id] ?? getSpecsForProduct(id);

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
		{
			label: "Utility APIs",
			list: products.filter((p) => p.category === "util"),
		},
	];

	const categoryLabels: Record<ApiProductRef["category"], string> = {
		verification: "Verification",
		payment: "Payments",
		bc: "BC Agent",
		util: "Utility",
	};

	const blocks: (string | undefined)[] = [];

	if (fmt === "md") {
		const canonical = `${SITE_URL}/products`;
		blocks.push(
			frontMatter({
				type: "products-index",
				title: "APIs & Products — Complete Reference | Eko Platform Services",
				description:
					"Complete reference for all of Eko's fintech APIs — features, use cases, pricing slabs, endpoints and FAQs for every payment, verification and BC agent API, in one document.",
				canonical,
			}),
			canonicalNotice(canonical),
			"# Getting Started for AI Coding Agents",
			aiGettingStartedNotice(),
		);
	}

	// Pricing notes carry only the clauses relevant to the products in this
	// document: the verification "you pay per call" line and the commission/TDS
	// line are each emitted only when that product type is actually present.
	const hasVerification = products.some((p) => p.category === "verification");
	const hasCommission = products.some(
		(p) => p.category === "payment" || p.category === "bc",
	);
	const typeClauses = [
		hasVerification
			? "Verification APIs are a cost you pay per call"
			: undefined,
		hasCommission
			? `DMT, AePS and BBPS pay YOU a commission per transaction (TDS @ ${Math.round(TDS_RATE * 100)}% is deducted from commission payouts)`
			: undefined,
	].filter(Boolean);
	const ratesWord = hasCommission ? "rates and commissions" : "rates";
	const pricingNotes =
		`**Pricing notes (apply to every product below):** All ${ratesWord} are in INR, exclusive of GST @ ${Math.round(GST_RATE * 100)}%. Billing is per successful API call.` +
		(typeClauses.length ? ` ${typeClauses.join("; ")}.` : "") +
		(SETUP_FEE_WAIVED ? " Setup fees are currently waived." : "");

	blocks.push(
		heading(
			1,
			opts.title ?? "Eko EPS APIs & Products — Complete Reference",
			fmt,
		),
		opts.lede ??
			"Production-ready fintech APIs for payments, verification, and agent banking — built for India's digital economy. This document contains the full details of every active Eko API so it can be used standalone; per-product pages are linked in each section.",
		gettingStartedNotice(),
		pricingNotes,
	);

	// Hierarchical heading numbers (used by the `txt` variant): top-level
	// sections are `#1`, `#2`…; products nest as `#N.M`.
	let section = 0;

	const glanceNo = String(++section);
	blocks.push(heading(2, "Products at a Glance", fmt, glanceNo));
	if (fmt === "md") {
		blocks.push(
			table(
				["Product", "Category", "Summary"],
				products.map((product) => [
					link(product.name, `${SITE_URL}${productHref(product.slug)}`, fmt),
					categoryLabels[product.category],
					product.shortDesc,
				]),
				fmt,
			),
		);
	} else {
		// txt: group products into category sub-sections, summary inline after the
		// link, separated by an em dash.
		let glanceSub = 0;
		for (const category of categories) {
			if (category.list.length === 0) continue;
			blocks.push(
				heading(
					3,
					categoryLabels[category.list[0].category],
					fmt,
					`${glanceNo}.${++glanceSub}`,
				),
				// Name only — the product's URL is repeated in its detailed section below.
				category.list
					.map(
						(product, i) =>
							`  ${i + 1}. ${product.name} — ${product.shortDesc}`,
					)
					.join("\n"),
			);
		}
	}

	for (const category of categories) {
		if (category.list.length === 0) continue;
		const n = ++section;
		blocks.push(heading(2, category.label, fmt, String(n)));
		category.list.forEach((product, i) => {
			blocks.push(
				productSection(
					product,
					pages[product.id],
					commonQuestions,
					fmt,
					`${n}.${i + 1}`,
					specsFor(product.id),
				),
			);
		});
	}

	if (!opts.omitMoreInfo) {
		blocks.push(
			heading(2, "More Information", fmt, String(++section)),
			bulletList([
				`${link("Site index", `${SITE_URL}/index.md`, fmt)}: Full list of API products, industries, and solution packs`,
				`${link("Pricing rate card", `${SITE_URL}/pricing.md`, fmt)}: Consolidated pricing for all APIs and other offerings`,
			]),
		);
	}

	const out = joinBlocks(blocks);
	// The txt variant carries no bold markup: strip every `**` emitted by the
	// shared helpers and inline labels (headings stay `#`-numbered; md keeps bold).
	// Also drop any blank line that the H1/H2 extra-spacing leaves at the top.
	return fmt === "txt" ? out.replace(/\*\*/g, "").replace(/^\n+/, "") : out;
}

/** Render `/products.md` — comprehensive Markdown reference for all products. */
export function renderProductsIndexMarkdown(
	products: ApiProductRef[],
	pages: Record<string, ProductPageDataShape> = {},
	commonFaqs: FAQ[] = [],
	specsByProduct?: Record<string, ApiSpec[]>,
): string {
	return renderProductsIndex(products, pages, commonFaqs, "md", {
		specsByProduct,
	});
}

/** Render `/products.txt` — markup-light plain-text twin of `products.md`. */
export function renderProductsIndexText(
	products: ApiProductRef[],
	pages: Record<string, ProductPageDataShape> = {},
	commonFaqs: FAQ[] = [],
	specsByProduct?: Record<string, ApiSpec[]>,
): string {
	return renderProductsIndex(products, pages, commonFaqs, "txt", {
		specsByProduct,
	});
}

/**
 * Render one standalone `txt` part (see {@link PRODUCTS_TXT_PARTS}) — a markup-light
 * slice of the products reference scoped to `products`, with the part's own H1/lede
 * and a trailing cross-link to its sibling parts. `products` is expected to be the
 * active products for this part, already resolved in display order.
 */
export function renderProductsIndexTextPart(
	part: ProductsIndexPart,
	products: ApiProductRef[],
	pages: Record<string, ProductPageDataShape> = {},
	commonFaqs: FAQ[] = [],
	specsByProduct?: Record<string, ApiSpec[]>,
): string {
	const siblings = PRODUCTS_TXT_PARTS.filter((p) => p.slug !== part.slug);
	const crossLinks = siblings.length
		? `\n\nThis reference is split into parts. Other parts: ${siblings
				.map((p) => `${p.shortLabel} (${SITE_URL}/${p.slug}.txt)`)
				.join(", ")}.`
		: "";
	return renderProductsIndex(products, pages, commonFaqs, "txt", {
		title: part.title,
		lede: part.lede + crossLinks,
		omitMoreInfo: true,
		specsByProduct,
	});
}
