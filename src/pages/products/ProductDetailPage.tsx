import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ProductPageLayout } from "@/components/ProductPageLayout";
import { API_PRODUCTS } from "@/lib/data/api-products";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import {
	getApiPreviewsForProduct,
	getProductDocsUrl,
	getVerifiableFieldsForProduct,
} from "@/lib/data/api-spec-previews";
import { AiHint } from "@/components/AiHint";
import { SITE_URL } from "@/lib/config/site";
import { generateProductJsonLd } from "@/lib/utils/json-ld";
import NotFound from "@/pages/NotFound";

const ProductDetailPage = () => {
	const { slug } = useParams<{ slug: string }>();

	const product = API_PRODUCTS.find((p) => p.slug === slug);
	const pageData =
		product && !product.disabled ? API_PRODUCT_PAGES[product.id] : undefined;

	if (!pageData) {
		return <NotFound />;
	}

	const { seo, ...layoutProps } = pageData;
	const jsonLdSchemas = generateProductJsonLd(pageData, product.slug);

	// Technical API details are sourced from the spec registry (api-specs.ts),
	// not the marketing page data. Cap on-page previews to keep the page focused;
	// the full set powers the developer reference.
	const inputOutputPreviews = getApiPreviewsForProduct(product.id, 6);
	const docsUrl = getProductDocsUrl(product.id);
	const verifiableFields = getVerifiableFieldsForProduct(product.id);

	return (
		<>
			<Helmet>
				<title>{seo.title} | Eko Platform Services</title>
				<meta name="description" content={seo.description} />
				<link rel="canonical" href={`${SITE_URL}/products/${product.slug}`} />
				<meta
					property="og:title"
					content={`${seo.ogTitle ?? seo.title} | Eko Platform Services`}
				/>
				<meta
					property="og:description"
					content={seo.ogDescription ?? seo.description}
				/>
				<meta property="og:type" content="website" />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={`/products/${product.slug}.md`}
				/>
				{jsonLdSchemas.map((schema, i) => (
					<script key={i} type="application/ld+json">
						{JSON.stringify(schema)}
					</script>
				))}
			</Helmet>

			<AiHint mdPath={`/products/${product.slug}.md`} />
			<ProductPageLayout
				{...layoutProps}
				productId={product.id}
				docsUrl={docsUrl}
				inputOutputPreviews={
					inputOutputPreviews.length > 0 ? inputOutputPreviews : undefined
				}
				verifiableFields={
					verifiableFields.length > 0 ? verifiableFields : undefined
				}
			/>
		</>
	);
};

export default ProductDetailPage;
