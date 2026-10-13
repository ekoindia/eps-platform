import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PageMeta } from "@/components/PageMeta";
import { INDUSTRIES_MAP } from "@/lib/data/industries";
import { IndustryPageLayout } from "@/components/IndustryPageLayout";
import { AiHint } from "@/components/AiHint";
import { SITE_URL } from "@/lib/config/site";
import { faqPageJsonLd } from "@/lib/utils/json-ld";
import NotFound from "@/pages/NotFound";

const IndustryDetailPage = () => {
	const { slug } = useParams<{ slug: string }>();
	const data = slug ? INDUSTRIES_MAP[slug] : undefined;

	if (!data) return <NotFound />;

	return (
		<>
			<PageMeta
				title={`${data.seo.title} | Eko Platform Services`}
				description={data.seo.description}
				ogTitle={data.seo.title}
			/>
			<Helmet>
				<link rel="canonical" href={`${SITE_URL}/industries/${data.slug}`} />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={`/industries/${data.slug}.md`}
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
								name: "Industries",
								item: `${SITE_URL}/industries`,
							},
							{
								"@type": "ListItem",
								position: 3,
								name: data.name,
								item: `${SITE_URL}/industries/${data.slug}`,
							},
						],
					})}
				</script>
				{data.faqs.length > 0 && (
					<script type="application/ld+json">
						{JSON.stringify(faqPageJsonLd(data.faqs))}
					</script>
				)}
			</Helmet>
			<AiHint mdPath={`/industries/${data.slug}.md`} />
			<IndustryPageLayout data={data} />
		</>
	);
};

export default IndustryDetailPage;
