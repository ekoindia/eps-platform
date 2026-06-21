import { Helmet } from "react-helmet-async";

import { AiHint } from "@/components/AiHint";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { FaqSection } from "@/components/sections/FaqSection";
import { LeadFormCTASection } from "@/components/sections/LeadFormCTASection";
import { PageHero } from "@/components/sections/PageHero";
import { SITE_OG_IMAGE, SITE_URL } from "@/lib/config/site";
import { GLOBAL_FAQS } from "@/lib/data/api-product-pages";
import { generateFaqJsonLd } from "@/lib/utils/json-ld";

const PAGE_TITLE = "Frequently Asked Questions | Eko Platform Services API";
const PAGE_DESCRIPTION =
	"Answers to common questions about integrating Eko's APIs — getting started, authentication, SDKs and AI tooling, sandbox testing, response times, billing, error handling, versioning, and data privacy & compliance.";
const PAGE_KEYWORDS =
	"Eko API FAQ, API integration FAQ, API authentication, sandbox testing, API pricing, API versioning, data privacy compliance, fintech API help";

/**
 * Global FAQ page (`/faq`) — renders the platform-agnostic common FAQs plus the
 * global-only reference FAQs that are intentionally kept off product pages.
 */
const FaqPage = () => {
	const jsonLdSchemas = generateFaqJsonLd(GLOBAL_FAQS);

	return (
		<>
			<Helmet>
				<title>{PAGE_TITLE}</title>
				<meta name="description" content={PAGE_DESCRIPTION} />
				<meta name="keywords" content={PAGE_KEYWORDS} />
				<link rel="canonical" href={`${SITE_URL}/faq`} />
				<link
					rel="alternate"
					type="text/markdown"
					href={`${SITE_URL}/faq.md`}
				/>
				<meta property="og:title" content={PAGE_TITLE} />
				<meta property="og:description" content={PAGE_DESCRIPTION} />
				<meta property="og:url" content={`${SITE_URL}/faq`} />
				<meta property="og:image" content={SITE_OG_IMAGE} />
				<meta name="twitter:title" content={PAGE_TITLE} />
				<meta name="twitter:description" content={PAGE_DESCRIPTION} />
				<meta name="twitter:image" content={SITE_OG_IMAGE} />
				{jsonLdSchemas.map((schema, i) => (
					<script key={i} type="application/ld+json">
						{JSON.stringify(schema)}
					</script>
				))}
			</Helmet>

			<AiHint mdPath="/faq.md" />

			<div className="min-h-screen bg-background">
				<main>
					<PageHero className="pb-16">
						<BreadcrumbNav
							crumbs={[{ label: "Home", href: "/" }, { label: "FAQ" }]}
						/>
						<FadeIn onView={false} delay={100} className="text-center">
							<h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
								Frequently asked questions
							</h1>
							<p className="text-xl text-white/70 max-w-2xl mx-auto">
								Everything you need to know about integrating Eko's APIs —
								authentication, testing, pricing, and more.
							</p>
						</FadeIn>
					</PageHero>

					<FaqSection faqs={GLOBAL_FAQS} variant="default" title={null} />

					<LeadFormCTASection
						heading="Still have questions?"
						formTitle="Get API Access"
						description="Sign up now, test in the free sandbox, and our team will help you go live quickly."
					/>
				</main>
				<Footer />
			</div>
		</>
	);
};

export default FaqPage;
