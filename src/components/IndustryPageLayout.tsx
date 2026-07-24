import { ApiChip } from "@/components/ApiChip";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { IndustryCard } from "@/components/IndustryCard";
import { MiniToc } from "@/components/MiniToc";
import { FaqSection } from "@/components/sections/FaqSection";
import { LeadFormCTASection } from "@/components/sections/LeadFormCTASection";
import { PageHero } from "@/components/sections/PageHero";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { SolutionCard } from "@/components/SolutionCard";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { IndustryData } from "@/lib/data/industries";
import { INDUSTRIES_MAP } from "@/lib/data/industries";
import { SOLUTIONS_MAP } from "@/lib/data/solutions";
import { openZohoChat } from "@/lib/zoho-chat";
import { ArrowRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { docsHref } from "@/lib/data/docs-registry";

interface IndustryPageLayoutProps {
	data: IndustryData;
}

export const IndustryPageLayout = ({ data }: IndustryPageLayoutProps) => {
	return (
		<div className="min-h-screen bg-background">
			<main>
				{/* Hero */}
				<PageHero>
					<BreadcrumbNav
						crumbs={[
							{ label: "Home", href: "/" },
							// { label: "Use Cases", href: "/use-cases" },
							{ label: "Industries", href: "/industries" },
							{ label: data.name },
						]}
					/>
					<div className="grid lg:grid-cols-1 gap-10 lg:gap-16 items-start">
						<div>
							<FadeIn onView={false} delay={100}>
								<span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-eko-gold/20 text-eko-gold mb-4">
									{data.eyebrow}
								</span>
								<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
									{data.h1}
								</h1>
							</FadeIn>
							<FadeIn onView={false} delay={200}>
								<p className="text-xl text-white/80 mb-6 max-w-2xl leading-relaxed">
									{data.heroSubtitle}
								</p>
								<TrustStrip
									items={data.trustStrip}
									className="flex flex-wrap gap-3 mb-8"
								/>
							</FadeIn>
							<FadeIn onView={false} delay={300}>
								<div className="flex flex-wrap gap-4">
									<Button
										variant="gold"
										size="lg"
										asChild
										onClick={() => openZohoChat()}
									>
										<span>
											Get Sandbox Access <ArrowRight className="w-4 h-4" />
										</span>
									</Button>
									<Button
										variant="hero-outline"
										size="lg"
										onClick={() =>
											window.dispatchEvent(new Event("open-talk-to-sales"))
										}
									>
										Talk to Sales
									</Button>
								</div>
							</FadeIn>
						</div>
						{/* Lead Form */}
						{/* <div className="relative" id="lead-form-hero">
                <div className="hidden lg:flex absolute -left-4 -top-4 z-10 items-center gap-2 bg-eko-gold/10 border border-eko-gold/30 rounded-full px-4 py-2 backdrop-blur-xs">
                  <Shield className="w-4 h-4 text-eko-gold" />
                  <span className="text-xs font-semibold text-eko-gold">99.9% Uptime</span>
                </div>
                <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="bg-eko-navy px-6 py-4">
                    <h3 className="text-lg font-bold text-white">Get API Access</h3>
                    <p className="text-white/70 text-sm">Get started in 10 minutes</p>
                  </div>
                  <div className="p-2">
                    <iframe
                      aria-label="New Eko.in API Signup"
                      frameBorder="0"
                      allow="geolocation;"
                      style={{ height: "500px", width: "100%", border: "none" }}
                      src={ZOHO_SIGNUP_EMBED_URL}
                    />
                  </div>
                </div>
              </div> */}
					</div>
				</PageHero>

				{/* The Challenge */}
				{data.challengeText && (
					<SectionContainer>
						<SectionHeader
							badge="The Challenge"
							title={`The challenge for ${data.name}`}
						/>
						<div className="max-w-4xl mx-auto">
							{data.challengeText.split("\n\n").map((para, i) => (
								<FadeIn key={i}>
									<p className="text-muted-foreground leading-relaxed text-lg mb-4 last:mb-0">
										{para}
									</p>
								</FadeIn>
							))}
						</div>
					</SectionContainer>
				)}

				{/* Recommended Solution Packs */}
				{data.recommendedPacks.length > 0 && (
					<SectionContainer variant="muted">
						<SectionHeader
							badge="Solutions"
							title="Recommended solution packs"
							subtitle="Pre-bundled API stacks designed for your industry workflow."
						/>
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
							{data.recommendedPacks.map((pack, i) => {
								const solData = SOLUTIONS_MAP[pack.slug];
								if (solData) {
									return (
										<SolutionCard
											key={pack.slug}
											solution={solData}
											featured={pack.featured}
											delay={i * 100}
										/>
									);
								}
								return (
									<div
										key={pack.slug}
										className="p-6 rounded-xl bg-card border border-border/50"
									>
										<h3 className="font-semibold text-foreground mb-2">
											{pack.name}
										</h3>
										<p className="text-muted-foreground text-sm mb-3">
											{pack.description}
										</p>
										<div className="flex flex-wrap gap-1.5">
											{pack.apis.map((api) => (
												<span
													key={api}
													className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
												>
													{api}
												</span>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</SectionContainer>
				)}

				{/* All APIs You'll Need */}
				{data.apiGrid.length > 0 && (
					<SectionContainer>
						<SectionHeader
							badge="APIs"
							title="All APIs you'll need"
							subtitle="Every Eko API relevant to your industry, with relevance indicators."
						/>
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
							{data.apiGrid.map((api, i) => (
								<FadeIn key={api.apiId} delay={i * 50}>
									<Link
										to={api.href}
										className="group flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-eko-gold/30 hover:shadow-md transition-all h-full"
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="font-medium text-foreground text-sm group-hover:text-eko-gold transition-colors">
													{api.name}
												</span>
												<ApiChip
													name=""
													relevance={api.relevance}
													className="px-1.5! py-0! border-0 bg-transparent"
												/>
											</div>
											<p className="text-muted-foreground text-xs leading-relaxed">
												{api.description}
											</p>
										</div>
										<ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-eko-gold shrink-0 mt-0.5" />
									</Link>
								</FadeIn>
							))}
						</div>
					</SectionContainer>
				)}

				{/* Real-World Use Cases */}
				{data.useCaseVignettes.length > 0 && (
					<SectionContainer variant="muted">
						<SectionHeader badge="Use Cases" title="Real-world use cases" />
						<div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
							{data.useCaseVignettes.map((uc, i) => (
								<FadeIn
									key={i}
									delay={i * 100}
									className="p-6 rounded-xl bg-card border border-border/50"
								>
									<h3 className="font-semibold text-foreground mb-3">
										{uc.title}
									</h3>
									<p className="text-muted-foreground text-sm leading-relaxed mb-2">
										<strong className="text-foreground/80">Situation:</strong>{" "}
										{uc.situation}
									</p>
									<p className="text-muted-foreground text-sm leading-relaxed mb-2">
										<strong className="text-foreground/80">Integration:</strong>{" "}
										{uc.integration}
									</p>
									<p className="text-sm leading-relaxed">
										<strong className="text-eko-gold">Result:</strong>{" "}
										<span className="text-foreground">{uc.outcome}</span>
									</p>
								</FadeIn>
							))}
						</div>
					</SectionContainer>
				)}

				{/* Why Eko */}
				{data.whyEko.length > 0 && (
					<SectionContainer>
						<SectionHeader badge="Why Eko" title={`Why Eko for ${data.name}`} />
						<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
							{data.whyEko.map((diff, i) => {
								const Icon = diff.icon;
								return (
									<FadeIn key={i} delay={i * 100} className="text-center">
										<div className="w-14 h-14 rounded-2xl bg-eko-gold/10 flex items-center justify-center mx-auto mb-4">
											<Icon className="w-7 h-7 text-eko-gold" />
										</div>
										<h3 className="font-semibold text-foreground mb-2">
											{diff.title}
										</h3>
										<p className="text-muted-foreground text-sm leading-relaxed">
											{diff.description}
										</p>
									</FadeIn>
								);
							})}
						</div>
					</SectionContainer>
				)}

				{/* Integration Stepper */}
				<SectionContainer className="bg-eko-navy">
					<FadeIn className="text-center mb-12">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							How to Integrate
						</h2>
						<p className="text-white/70 max-w-2xl mx-auto">
							Get started in minutes with our simple integration process
						</p>
					</FadeIn>
					<TooltipProvider>
						<div className="hidden md:flex items-start justify-center max-w-4xl mx-auto">
							{data.integrationSteps.map((step, i) => (
								<FadeIn
									key={step.step}
									delay={i * 150}
									className="flex items-start flex-1"
								>
									<div className="flex flex-col items-center text-center">
										<div className="w-14 h-14 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-lg">
											{step.step}
										</div>
										<h3 className="text-sm font-semibold text-white mt-3 mb-1">
											{step.title}
										</h3>
										<p className="text-white/50 text-xs max-w-[140px]">
											{step.description}
										</p>
									</div>
									{i < data.integrationSteps.length - 1 && (
										<div className="flex-1 h-0.5 bg-white/20 mt-7 mx-2" />
									)}
								</FadeIn>
							))}
						</div>
						<div className="md:hidden flex flex-col gap-6 max-w-sm mx-auto">
							{data.integrationSteps.map((step, i) => (
								<FadeIn key={step.step} delay={i * 150} className="flex gap-4">
									<div className="flex flex-col items-center">
										<div className="w-10 h-10 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-sm">
											{step.step}
										</div>
										{i < data.integrationSteps.length - 1 && (
											<div className="w-0.5 flex-1 bg-white/20 mt-2" />
										)}
									</div>
									<div className="pb-6">
										<h3 className="text-sm font-semibold text-white">
											{step.title}
										</h3>
										<p className="text-white/50 text-xs mt-1">
											{step.description}
										</p>
									</div>
								</FadeIn>
							))}
						</div>
					</TooltipProvider>
					<div className="text-center mt-10">
						<Button variant="gold" size="lg" asChild>
							<Link to={docsHref()}>
								View Documentation <ArrowRight className="w-4 h-4" />
							</Link>
						</Button>
					</div>
				</SectionContainer>

				{/* Compliance & Regulatory */}
				{data.complianceItems.length > 0 && (
					<SectionContainer>
						<SectionHeader badge="Compliance" title="Compliance & regulatory" />
						<div className="max-w-3xl mx-auto flex flex-col gap-4">
							{data.complianceItems.map((item, i) => (
								<FadeIn
									key={i}
									delay={i * 50}
									className="flex items-start gap-4 p-5 bg-card border border-border/50 rounded-xl"
								>
									<Shield className="w-5 h-5 text-eko-gold shrink-0 mt-0.5" />
									<div>
										<h4 className="font-semibold text-foreground mb-1">
											{item.title}
										</h4>
										<p className="text-muted-foreground text-sm">
											{item.description}
										</p>
									</div>
								</FadeIn>
							))}
						</div>
					</SectionContainer>
				)}

				{/* FAQ */}
				<FaqSection faqs={data.faqs} variant="muted" />

				{/* Related Industries */}
				{data.relatedIndustries.length > 0 && (
					<SectionContainer>
						<SectionHeader badge="Related" title="Related industries" />
						<div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
							{data.relatedIndustries.map((rel, i) => {
								const relData = INDUSTRIES_MAP[rel.slug];
								if (relData) {
									return (
										<IndustryCard
											key={rel.slug}
											industry={relData}
											delay={i * 100}
										/>
									);
								}
								return (
									<Link
										key={rel.slug}
										to={`/industries/${rel.slug}`}
										className="p-6 rounded-xl bg-card border border-border/50 hover:border-eko-gold/30 transition-all"
									>
										<h3 className="font-semibold text-foreground">
											{rel.name}
										</h3>
									</Link>
								);
							})}
						</div>
					</SectionContainer>
				)}

				{/* Bottom CTA */}
				<LeadFormCTASection />
			</main>
			<MiniToc maxLevel={2} />
			<Footer />
		</div>
	);
};
