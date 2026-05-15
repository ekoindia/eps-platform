import {
  SITE_URL,
  SITE_ORG_NAME,
  SITE_LOGO_URL,
  PARENT_SITE_URL,
  PARENT_SITE_NAME,
} from "@/lib/config/site";
import type { ProductPageData } from "@/lib/data/api-product-pages";

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
	const productUrl = `${SITE_URL}/products/${slug}`;
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
			}
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
