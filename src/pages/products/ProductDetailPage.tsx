import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ProductPageLayout } from "@/components/ProductPageLayout";
import { API_PRODUCTS } from "@/lib/data/api-products";
import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import { AiHint } from "@/components/AiHint";
import { SITE_URL } from "@/lib/config/site";
import { generateProductJsonLd } from "@/lib/utils/json-ld";
import NotFound from "@/pages/NotFound";

const ProductDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const product = API_PRODUCTS.find((p) => p.slug === slug);
  const pageData = product && !product.disabled ? API_PRODUCT_PAGES[product.id] : undefined;

  if (!pageData) {
    return <NotFound />;
  }

  const { seo, ...layoutProps } = pageData;
  const jsonLdSchemas = generateProductJsonLd(pageData, product.slug);

  return (
    <>
      <Helmet>
        <title>{seo.title} | Eko Platform Services</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <link rel="canonical" href={`${SITE_URL}/products/${product.slug}`} />
        <meta property="og:title" content={`${seo.ogTitle ?? seo.title} | Eko Platform Services`} />
        <meta property="og:description" content={seo.ogDescription ?? seo.description} />
        <meta property="og:type" content="website" />
        <link
          rel="alternate"
          type="text/markdown"
          title="Markdown version"
          href={`/products/${product.slug}.md`}
        />
        {jsonLdSchemas.map((schema, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
        ))}
      </Helmet>

      <AiHint mdPath={`/products/${product.slug}.md`} />
      <ProductPageLayout {...layoutProps} productId={product.id} />
    </>
  );
};

export default ProductDetailPage;
