import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PageMeta } from "@/components/PageMeta";
import { SOLUTIONS_MAP } from "@/lib/data/solutions";
import { SolutionPageLayout } from "@/components/SolutionPageLayout";
import { AiHint } from "@/components/AiHint";
import { SITE_URL } from "@/lib/config/site";
import { faqPageJsonLd } from "@/lib/utils/json-ld";
import NotFound from "@/pages/NotFound";

const SolutionDetailPage = () => {
	const { slug } = useParams<{ slug: string }>();
	const data = slug ? SOLUTIONS_MAP[slug] : undefined;

	if (!data) return <NotFound />;

	return (
		<>
			<PageMeta
				title={`${data.seo.title} | Eko Platform Services`}
				description={data.seo.description}
				ogTitle={data.seo.title}
			/>
			<Helmet>
				<link rel="canonical" href={`${SITE_URL}/solutions/${data.slug}`} />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={`/solutions/${data.slug}.md`}
				/>
				<script type="application/ld+json">
					{JSON.stringify({
						"@context": "https://schema.org",
						"@type": "BreadcrumbList",
						itemListElement: [
							{
								"@type": "ListItem",
								position: 1,
								name: "Home",
								item: `${SITE_URL}/`,
							},
							{
								"@type": "ListItem",
								position: 2,
								name: "Solutions",
								item: `${SITE_URL}/solutions`,
							},
							{
								"@type": "ListItem",
								position: 3,
								name: data.name,
								item: `${SITE_URL}/solutions/${data.slug}`,
							},
						],
					})}
				</script>
				{data.faqs.length > 0 && (
					<script type="application/ld+json">
						{JSON.stringify(faqPageJsonLd(data.faqs))}
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
							url: `${SITE_URL}/solutions/${data.slug}`,
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
