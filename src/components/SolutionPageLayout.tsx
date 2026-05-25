import { useState } from "react";
import { Footer } from "@/components/Footer";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ApiChip } from "@/components/ApiChip";
import { IndustryCard } from "@/components/IndustryCard";
import { SolutionCard } from "@/components/SolutionCard";
import { CodeBlock } from "@/components/CodeBlock";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ZohoSignupForm } from "@/components/ZohoSignupForm";
import { ArrowRight, CheckCircle, HelpCircle, Shield, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { SolutionData } from "@/lib/data/solutions";
import { SOLUTIONS_MAP, resolvePackApi } from "@/lib/data/solutions";
import { INDUSTRIES_MAP } from "@/lib/data/industries";
import { openZohoChat } from "@/lib/zoho-chat";
// import EkoShieldAdBanner from "@/components/EkoShieldAdBanner";
import { FadeIn } from "@/components/FadeIn";

interface SolutionPageLayoutProps {
  data: SolutionData;
}

export const SolutionPageLayout = ({ data }: SolutionPageLayoutProps) => {
  const [activeCodeTab, setActiveCodeTab] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-20 bg-eko-navy overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-eko-gold/5 to-transparent" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <BreadcrumbNav crumbs={[
              { label: "Home", href: "/" },
              // { label: "Use Cases", href: "/use-cases" },
              { label: "Solutions", href: "/solutions" },
              { label: data.name },
            ]} />
            <div className="max-w-3xl">
              <FadeIn onView={false} delay={100}>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-eko-gold/20 text-eko-gold mb-4">
                  {data.eyebrow}
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  {data.name.replace(/ ?(?:API )?Pack$/i, "")}{" "}API Pack
                </h1>
              </FadeIn>
              <FadeIn onView={false} delay={200}>
                <p className="text-xl text-white/80 mb-6 leading-relaxed">
                  {data.heroSubtitle}
                </p>

                {/* API Chip Row */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {data.packApis.map(resolvePackApi).filter(Boolean).map((api) => (
                    <ApiChip key={api.apiId} name={api.shortName} href={api.href} className="bg-white/10 border-white/20 text-white hover:bg-white/20" />
                  ))}
                </div>
              </FadeIn>
              <FadeIn onView={false} delay={300}>
                {/* Trust Strip */}
                <div className="flex flex-wrap gap-4 mb-8">
                  {data.trustStrip.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 text-sm text-white/70">
                      <CheckCircle className="w-4 h-4 text-eko-gold shrink-0" />
                      {item}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button variant="gold" size="lg" asChild onClick={() => openZohoChat()}>
                    <span>Get Sandbox Access <ArrowRight className="w-4 h-4" /></span>
                  </Button>
                  <Button variant="hero-outline" size="lg" asChild>
                    <a href="https://developers.eko.in" target="_blank" rel="noopener noreferrer">
                      View Documentation <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* The Job This Pack Does */}
        <SectionContainer>
          <div className="max-w-4xl mx-auto text-center">
            {/* <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">What You Can Achieve</h2> */}
			<SectionHeader badge="Core Use Cases" title="What You Can Achieve" />
            <FadeIn>
              <p className="text-xl text-muted-foreground leading-relaxed italic">
                "{data.jobStatement}"
              </p>
            </FadeIn>
          </div>
        </SectionContainer>

        {/* What's Inside the Pack */}
        {data.packApis.length > 0 && (
          <SectionContainer variant="muted">
            <SectionHeader badge="APIs In This Pack" title="What You Get" subtitle="Every API in this pack, what it does, and why it's included." />
            <div className="max-w-4xl mx-auto space-y-4">
              {data.packApis.map((ref, i) => {
                const api = resolvePackApi(ref);
                if (!api) return null;
                const Icon = api.icon;
                return (
                  <FadeIn key={api.apiId} delay={i * 50} className="group p-6 rounded-xl bg-card border border-border/50 hover:border-eko-gold/30 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-eko-gold/10 flex items-center justify-center shrink-0 group-hover:bg-eko-gold/20 transition-colors">
                        <Icon className="w-5 h-5 text-eko-gold" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{api.name}{" "}API</h3>
                          {api.href && api.href !== "#" && (
                            <Link to={api.href} className="text-xs text-eko-gold hover:underline">See API docs →</Link>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-1.5">
                          <span className="font-medium text-foreground/80">What it does:</span> {api.what}
                        </p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          <span className="font-medium text-foreground/80">Why it's in this pack:</span> {api.why}
                        </p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* How It Works */}
        {data.howItWorksSteps.length > 0 && (
          <SectionContainer>
            <SectionHeader badge="Workflow" title="How it works" />
            <div className="max-w-3xl mx-auto">
              <div className="space-y-0">
                {data.howItWorksSteps.map((step, i) => (
                  <FadeIn key={step.step} delay={i * 100} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-sm shrink-0">
                        {step.step}
                      </div>
                      {i < data.howItWorksSteps.length - 1 && <div className="w-0.5 flex-1 bg-border mt-2" />}
                    </div>
                    <div className="pb-8">
                      <p className="text-foreground font-medium pt-2">{step.label}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </SectionContainer>
        )}

        {/* Industries Using This Pack */}
        {data.industriesUsingSlugs.length > 0 && (
          <SectionContainer variant="muted">
            <SectionHeader badge="Industries" title="Built For These Businesses" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {data.industriesUsingSlugs.map((slug, i) => {
                const indData = INDUSTRIES_MAP[slug];
                if (indData) {
                  return <IndustryCard key={slug} industry={indData} delay={i * 100} />;
                }
                return null;
              }).filter(Boolean)}
            </div>
          </SectionContainer>
        )}

        {/* Example Integration */}
        {/* {data.exampleCode.length > 0 && (
          <SectionContainer>
            <SectionHeader badge="Code" title="Example integration" subtitle="Copy-paste ready code to get started quickly." />
            <div className="max-w-4xl mx-auto">
              {data.exampleCode.length > 1 && (
                <div className="flex gap-2 mb-4">
                  {data.exampleCode.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveCodeTab(i)}
                      className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors cursor-pointer ${
                        activeCodeTab === i
                          ? "bg-eko-navy text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {ex.language === "bash" ? "cURL" : ex.language.charAt(0).toUpperCase() + ex.language.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              <CodeBlock
                code={data.exampleCode[activeCodeTab].code}
                language={data.exampleCode[activeCodeTab].language}
                fileName={data.exampleCode[activeCodeTab].fileName}
              />
            </div>
          </SectionContainer>
        )} */}

        {/* Comparison Table */}
        {/* {data.comparisonRows.length > 0 && (
          <SectionContainer variant="muted">
            <SectionHeader badge="Compare" title="Why this pack vs. building it yourself" />
            <div className="max-w-4xl mx-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 font-semibold text-foreground w-1/3">Aspect</th>
                    <th className="text-left py-4 px-4 font-semibold text-muted-foreground w-1/3">DIY</th>
                    <th className="text-left py-4 px-4 font-semibold text-eko-gold w-1/3">Eko {data.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparisonRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-3 px-4 font-medium text-foreground">{row.aspect}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.diy}</td>
                      <td className="py-3 px-4 text-foreground font-medium">{row.eko}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionContainer>
        )} */}

        {/* Pricing */}
        {/* {data.pricingBlurb && (
          <SectionContainer>
            <SectionHeader badge="Pricing" title="Commercial model" />
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">{data.pricingBlurb}</p>
              <Button variant="gold" size="lg" onClick={() => window.dispatchEvent(new Event("open-talk-to-sales"))}>
                Get Pricing <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </SectionContainer>
        )} */}

        {/* FAQ */}
        {data.faqs.length > 0 && (
          <SectionContainer>
            <SectionHeader title="Frequently Asked Questions" />
            <div className="max-w-3xl mx-auto space-y-4">
              {data.faqs.map((faq, i) => (
                <FadeIn key={i} delay={i * 50}>
                  <details className="group p-6 bg-card border border-border/50 rounded-2xl cursor-pointer">
                    <summary className="flex items-center justify-between font-semibold text-foreground list-none">
                      <span className="flex items-center gap-3">
                        <HelpCircle className="w-5 h-5 text-eko-gold shrink-0" />
                        {faq.question}
                      </span>
                      <span className="ml-4 text-eko-gold transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-muted-foreground leading-relaxed pl-8">{faq.answer}</p>
                  </details>
                </FadeIn>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Eko Shield Ad Banner */}
        {/* {data.packApis.map(resolvePackApi).filter(Boolean).some((api) => /verification|kyc/i.test(api.name)) && (
          <EkoShieldAdBanner/>
        )} */}

        {/* Related Solutions */}
        {data.relatedSolutions.length > 0 && (
          <SectionContainer variant="muted">
            <SectionHeader badge="Related" title="Related solutions" />
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {data.relatedSolutions.map((rel, i) => {
                const solData = SOLUTIONS_MAP[rel.slug];
                if (solData) {
                  return <SolutionCard key={rel.slug} solution={solData} delay={i * 100} />;
                }
                return (
                  <Link key={rel.slug} to={`/solutions/${rel.slug}`} className="p-6 rounded-xl bg-card border border-border/50 hover:border-eko-gold/30 transition-all">
                    <h3 className="font-semibold text-foreground mb-1">{rel.name}</h3>
                    <p className="text-muted-foreground text-sm">{rel.tagline}</p>
                  </Link>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Bottom CTA */}
        <SectionContainer variant="navy" id="lead-form" className="relative overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-eko-gold/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-eko-gold/5 rounded-full blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Get API Access Now</h2>
              <p className="text-white/70 text-lg mb-6 leading-relaxed">
                Sign up now and start integrating in minutes. Our team will help you go live quickly.
              </p>
              <ul className="space-y-3">
                {["Sandbox access in minutes", "Dedicated integration support", "Comprehensive documentation", "99.9% uptime guarantee"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/80">
                    <CheckCircle className="w-5 h-5 text-eko-gold shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={200} className="relative">
              <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-eko-navy px-6 py-4 border-b border-white/10">
                  <h3 className="text-lg font-bold text-white">Get API Access</h3>
                  <p className="text-white/70 text-sm">Get started in 10 minutes</p>
                </div>
                <div className="p-2">
                  <ZohoSignupForm />
                </div>
              </div>
            </FadeIn>
          </div>
        </SectionContainer>
      </main>
      <Footer />
    </div>
  );
};
