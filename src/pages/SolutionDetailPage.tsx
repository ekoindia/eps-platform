import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SOLUTIONS_MAP } from "@/lib/data/solutions";
import { SolutionPageLayout } from "@/components/SolutionPageLayout";
import { AiHint } from "@/components/AiHint";
import NotFound from "@/pages/NotFound";

const SolutionDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const data = slug ? SOLUTIONS_MAP[slug] : undefined;

  if (!data) return <NotFound />;

  return (
    <>
      <Helmet>
        <title>{data.seo.title}</title>
        <meta name="description" content={data.seo.description} />
        <meta name="keywords" content={data.seo.keywords} />
        {/* <link rel="canonical" href={`https://eps.eko.in/solutions/${data.slug}`} /> */}
        <link
          rel="alternate"
          type="text/markdown"
          title="Markdown version"
          href={`/solutions/${data.slug}.md`}
        />
        <meta property="og:title" content={data.seo.title} />
        <meta property="og:description" content={data.seo.description} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://eps.eko.in/" },
              { "@type": "ListItem", position: 2, name: "Solutions", item: "https://eps.eko.in/solutions" },
              { "@type": "ListItem", position: 3, name: data.name, item: `https://eps.eko.in/solutions/${data.slug}` },
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
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: data.name,
            description: data.heroSubtitle,
            brand: { "@type": "Brand", name: "Eko" },
            category: "API Solution Pack",
            offers: {
              "@type": "Offer",
              priceCurrency: "INR",
              url: `https://eps.eko.in/solutions/${data.slug}`,
              availability: "https://schema.org/InStock",
            },
          })}
        </script>
      </Helmet>
      <AiHint mdPath={`/solutions/${data.slug}.md`} />
      <SolutionPageLayout data={data} />
    </>
  );
};

export default SolutionDetailPage;
