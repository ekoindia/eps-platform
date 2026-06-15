import {
	SITE_URL,
	SITE_ORG_NAME,
	SITE_LOGO_URL,
	PARENT_SITE_URL,
	PARENT_SITE_NAME,
} from "@/lib/config/site";
import type { ProductPageData } from "@/lib/data/api-product-pages";
import { productHref } from "@/lib/data/api-products";
import { PRICED_APIS } from "@/lib/data/api-pricing";
import {
	CB_SETUP_FEE,
	CB_TXN_SLABS,
} from "@/lib/data/connected-banking-pricing";
import type { FaqItem } from "@/components/sections/FaqSection";

const ORG_ID = `${SITE_URL}/#organization`;

/**
 * Generates structured JSON-LD schema objects for an API product page.
 *
 * Returns an array of JSON-LD objects:
 * - Always: a `@graph` object containing Organization, Product/SoftwareApplication,
 *   and BreadcrumbList nodes.
 * - When `pageData.faqs` is non-empty: a separate FAQPage object.
 *
 * Each item in the returned array should be serialised into its own
 * `<script type="application/ld+json">` tag.
 *
 * @param pageData - The full product page data record.
 * @param slug     - The URL slug for the product (e.g. "pan-verification-api").
 */
export function generateProductJsonLd(
	pageData: ProductPageData,
	slug: string,
): object[] {
	const productUrl = `${SITE_URL}${productHref(slug)}`;
	const productId = `${productUrl}#product`;

	const graph: object[] = [
		{
			"@type": "Organization",
			"@id": ORG_ID,
			name: SITE_ORG_NAME,
			url: SITE_URL,
			logo: SITE_LOGO_URL,
			parentOrganization: {
				"@type": "Organization",
				name: PARENT_SITE_NAME,
				url: PARENT_SITE_URL,
			},
		},
		{
			"@type": ["Product", "SoftwareApplication"],
			"@id": productId,
			name: pageData.title,
			description: pageData.seo.description,
			url: productUrl,
			brand: { "@id": ORG_ID },
			applicationCategory: "BusinessApplication",
			operatingSystem: "Cloud",
			offers: {
				"@type": "Offer",
				url: productUrl,
				priceCurrency: "INR",
				price: "0",
				availability: "https://schema.org/InStock",
				category: "API subscription",
				seller: { "@id": ORG_ID },
			},
			...(pageData.whoShouldUse?.length
				? {
						audience: {
							"@type": "BusinessAudience",
							audienceType: pageData.whoShouldUse.join(", "),
						},
					}
				: {}),
		},
		{
			"@type": "BreadcrumbList",
			"@id": `${productUrl}#breadcrumb`,
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Home",
					item: SITE_URL,
				},
				{
					"@type": "ListItem",
					position: 2,
					name: "Products",
					item: `${SITE_URL}/products`,
				},
				{
					"@type": "ListItem",
					position: 3,
					name: pageData.title,
					item: productUrl,
				},
			],
		},
	];

	const result: object[] = [
		{
			"@context": "https://schema.org",
			"@graph": graph,
		},
	];

	if (pageData.faqs?.length) {
		result.push({
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"@id": `${productUrl}#faq`,
			mainEntity: pageData.faqs.map((faq) => ({
				"@type": "Question",
				name: faq.q,
				acceptedAnswer: {
					"@type": "Answer",
					text: faq.a,
				},
			})),
		});
	}

	return result;
}

/**
 * Generates structured JSON-LD schema objects for the pricing page.
 *
 * Returns an array of JSON-LD objects:
 * - A `@graph` with Organization, an OfferCatalog of per-API Offers (each
 *   with a UnitPriceSpecification in INR per transaction), and BreadcrumbList.
 * - A FAQPage object when `faqs` is non-empty.
 *
 * Each item should be serialised into its own
 * `<script type="application/ld+json">` tag.
 *
 * @param faqs - The FAQ entries rendered on the pricing page.
 */
export function generatePricingJsonLd(faqs: FaqItem[]): object[] {
	const pricingUrl = `${SITE_URL}/pricing`;

	const graph: object[] = [
		{
			"@type": "Organization",
			"@id": ORG_ID,
			name: SITE_ORG_NAME,
			url: SITE_URL,
			logo: SITE_LOGO_URL,
			parentOrganization: {
				"@type": "Organization",
				name: PARENT_SITE_NAME,
				url: PARENT_SITE_URL,
			},
		},
		{
			"@type": "OfferCatalog",
			"@id": `${pricingUrl}#offers`,
			name: "Verification API Pricing",
			url: pricingUrl,
			itemListElement: PRICED_APIS.map((api) => ({
				"@type": "Offer",
				name: api.name,
				url: pricingUrl,
				priceCurrency: "INR",
				price: api.tiers[0].rate.toFixed(2),
				priceSpecification: {
					"@type": "UnitPriceSpecification",
					price: api.tiers[0].rate.toFixed(2),
					priceCurrency: "INR",
					unitText: api.unitLabel ?? "per verification",
					valueAddedTaxIncluded: false,
				},
				availability: "https://schema.org/InStock",
				seller: { "@id": ORG_ID },
			})),
		},
		{
			// Connected Banking is a cost product, so Offer semantics apply.
			// DMT/AePS/BBPS commissions are income to the buyer — deliberately
			// NOT modelled as Offers; they are covered by the FAQPage entries.
			"@type": "OfferCatalog",
			"@id": `${pricingUrl}#banking-offers`,
			name: "Connected Banking Pricing",
			url: pricingUrl,
			itemListElement: [
				{
					"@type": "Offer",
					name: "Connected Banking — one-time setup (per bank per user)",
					url: pricingUrl,
					priceCurrency: "INR",
					price: CB_SETUP_FEE.toFixed(2),
					priceSpecification: {
						"@type": "UnitPriceSpecification",
						price: CB_SETUP_FEE.toFixed(2),
						priceCurrency: "INR",
						unitText: "one-time, per bank per user",
						valueAddedTaxIncluded: false,
					},
					availability: "https://schema.org/InStock",
					seller: { "@id": ORG_ID },
				},
				...CB_TXN_SLABS.map((slab) => ({
					"@type": "Offer",
					name: `Connected Banking — transactions of ₹${slab.from.toLocaleString("en-IN")}–₹${(slab.upTo ?? 0).toLocaleString("en-IN")}`,
					url: pricingUrl,
					priceCurrency: "INR",
					price: (slab.flat ?? 0).toFixed(2),
					priceSpecification: {
						"@type": "UnitPriceSpecification",
						price: (slab.flat ?? 0).toFixed(2),
						priceCurrency: "INR",
						unitText: "per transaction",
						valueAddedTaxIncluded: false,
					},
					availability: "https://schema.org/InStock",
					seller: { "@id": ORG_ID },
				})),
			],
		},
		{
			"@type": "BreadcrumbList",
			"@id": `${pricingUrl}#breadcrumb`,
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Home",
					item: SITE_URL,
				},
				{
					"@type": "ListItem",
					position: 2,
					name: "Pricing",
					item: pricingUrl,
				},
			],
		},
	];

	const result: object[] = [
		{
			"@context": "https://schema.org",
			"@graph": graph,
		},
	];

	if (faqs.length) {
		result.push({
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"@id": `${pricingUrl}#faq`,
			mainEntity: faqs.map((faq) => ({
				"@type": "Question",
				name: faq.q ?? faq.question,
				acceptedAnswer: {
					"@type": "Answer",
					text: faq.a ?? faq.answer,
				},
			})),
		});
	}

	return result;
}
