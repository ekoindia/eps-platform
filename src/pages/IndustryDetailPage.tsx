import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { INDUSTRIES_MAP } from "@/lib/data/industries";
import { IndustryPageLayout } from "@/components/IndustryPageLayout";
import { AiHint } from "@/components/AiHint";
import { SITE_URL } from "@/lib/config/site";
import NotFound from "@/pages/NotFound";

const IndustryDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const data = slug ? INDUSTRIES_MAP[slug] : undefined;

  if (!data) return <NotFound />;

  return (
    <>
      <Helmet>
        <title>{data.seo.title} | Eko Platform Services</title>
        <meta name="description" content={data.seo.description} />
        <meta name="keywords" content={data.seo.keywords} />
        <link rel="canonical" href={`${SITE_URL}/industries/${data.slug}`} />
        <link
          rel="alternate"
          type="text/markdown"
          title="Markdown version"
          href={`/industries/${data.slug}.md`}
        />
        <meta property="og:title" content={data.seo.title} />
        <meta property="og:description" content={data.seo.description} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Industries", item: `${SITE_URL}/industries` },
              { "@type": "ListItem", position: 3, name: data.name, item: `${SITE_URL}/industries/${data.slug}` },
            ],
          })}
        </script>
        {data.faqs.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: data.faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            })}
          </script>
        )}
      </Helmet>
      <AiHint mdPath={`/industries/${data.slug}.md`} />
      <IndustryPageLayout data={data} />
    </>
  );
};

export default IndustryDetailPage;
