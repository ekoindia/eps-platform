import {
	FileCheck,
	KeyRound,
	type LucideIcon,
	Receipt,
	Server,
	ShieldCheck,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { AiHint } from "@/components/AiHint";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { SectionContainer } from "@/components/SectionContainer";
import { FaqAnswer } from "@/components/sections/FaqSection";
import { PageHero } from "@/components/sections/PageHero";
import { SITE_OG_IMAGE, SITE_URL } from "@/lib/config/site";
import {
	SECURITY_PAGE_DESCRIPTION,
	SECURITY_PAGE_TITLE,
	SECURITY_PATH,
	SECURITY_SECTIONS,
} from "@/lib/data/security";

const PAGE_KEYWORDS =
	"Eko security, data residency India, RBI data localisation, ISO 27001 audit, Aadhaar data storage, API security HMAC, DMT OTP, AePS biometric, BBPS";

/** Section icons live here, not in the data file, so the data stays Node-safe. */
const SECTION_ICONS: Record<string, LucideIcon> = {
	infrastructure: Server,
	compliance: FileCheck,
	"api-security": KeyRound,
	transactions: ShieldCheck,
	"audit-trail": Receipt,
};

/**
 * Security & data-protection page (`/security`) — the partner due-diligence
 * answer sheet. Content comes from `SECURITY_SECTIONS`, shared with the
 * markdown twin, the security FAQs and the context-MCP `security` topic.
 */
const SecurityPage = () => {
	const canonical = `${SITE_URL}${SECURITY_PATH}`;

	return (
		<>
			<Helmet>
				<title>{SECURITY_PAGE_TITLE}</title>
				<meta name="description" content={SECURITY_PAGE_DESCRIPTION} />
				<meta name="keywords" content={PAGE_KEYWORDS} />
				<link rel="canonical" href={canonical} />
				<link rel="alternate" type="text/markdown" href={`${canonical}.md`} />
				<meta property="og:title" content={SECURITY_PAGE_TITLE} />
				<meta property="og:description" content={SECURITY_PAGE_DESCRIPTION} />
				<meta property="og:url" content={canonical} />
				<meta property="og:image" content={SITE_OG_IMAGE} />
				<meta name="twitter:title" content={SECURITY_PAGE_TITLE} />
				<meta name="twitter:description" content={SECURITY_PAGE_DESCRIPTION} />
				<meta name="twitter:image" content={SITE_OG_IMAGE} />
			</Helmet>

			<AiHint mdPath={`${SECURITY_PATH}.md`} />

			<div className="min-h-screen bg-background">
				<main>
					<PageHero className="pb-16">
						<BreadcrumbNav
							crumbs={[{ label: "Home", href: "/" }, { label: "Security" }]}
						/>
						<FadeIn onView={false} delay={100} className="text-center">
							<h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
								Security &amp; data protection
							</h1>
							<p className="text-xl text-white/70 max-w-2xl mx-auto">
								How we keep your data and your customers' money safe — from
								where data lives to how every transaction is authenticated.
							</p>
						</FadeIn>
					</PageHero>

					<SectionContainer>
						<div className="max-w-3xl mx-auto flex flex-col gap-8">
							{SECURITY_SECTIONS.map((section) => {
								const Icon = SECTION_ICONS[section.id] ?? ShieldCheck;
								return (
									<FadeIn
										key={section.id}
										className="scroll-mt-28 p-6 lg:p-8 rounded-2xl bg-card border border-border/50"
									>
										<section
											id={section.id}
											aria-labelledby={`${section.id}-title`}
										>
											<div className="flex items-center gap-4 mb-4">
												<div className="w-12 h-12 rounded-xl bg-eko-gold/20 flex items-center justify-center shrink-0">
													<Icon className="w-6 h-6 text-eko-gold" aria-hidden />
												</div>
												<div>
													<h2
														id={`${section.id}-title`}
														className="text-xl font-semibold text-foreground"
													>
														{section.title}
													</h2>
													<p className="text-sm text-muted-foreground">
														{section.summary}
													</p>
												</div>
											</div>
											<FaqAnswer
												content={section.points
													.map((point) => `- ${point}`)
													.join("\n")}
											/>
										</section>
									</FadeIn>
								);
							})}
							<p className="text-center text-muted-foreground">
								More questions? See the{" "}
								<Link
									to="/faq"
									className="font-medium text-eko-gold underline underline-offset-2 hover:no-underline"
								>
									FAQ
								</Link>
							</p>
						</div>
					</SectionContainer>

					{/* <LeadFormCTASection
						heading="Need a security questionnaire answered?"
						formTitle="Talk to our team"
						description="Share your requirements and our team will get back to you."
					/> */}
				</main>
				<Footer />
			</div>
		</>
	);
};

export default SecurityPage;
