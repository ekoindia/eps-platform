import { AiHint } from "@/components/AiHint";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { StatCard } from "@/components/Cards";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { IndustryCard } from "@/components/IndustryCard";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { SolutionCard } from "@/components/SolutionCard";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/config/site";
import { INDUSTRY_CATEGORIES } from "@/lib/data/industries";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Package,
  Users,
  Zap,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const FEATURED_SOLUTION_SLUGS = [
  "assisted-banking-agent-pack",
  "lending-kyc-pack",
  "merchant-onboarding-pack",
  "mfi-field-operations-pack",
  "employee-bgv-pack",
  "fleet-compliance-pack",
];

const UseCasesHubPage = () => {
  const featuredSolutions = ACTIVE_SOLUTIONS_LIST.filter((s) =>
    FEATURED_SOLUTION_SLUGS.includes(s.slug),
  );

  return (
    <>
      <Helmet>
        <title>Use Cases | Eko Platform Services</title>
        <meta
          name="description"
          content="Find the right Eko API stack for your business. Browse by industry or solution pack to see pre-bundled APIs for common workflows."
        />
        <link rel="canonical" href={`${SITE_URL}/use-cases`} />
        <link
          rel="alternate"
          type="text/markdown"
          title="Markdown version"
          href="/use-cases.md"
        />
      </Helmet>
      <AiHint mdPath="/use-cases.md" />
      <div className="min-h-screen bg-background">
        <main>
          {/* Hero + Choice Cards */}
          <section className="relative pt-32 pb-20 bg-eko-navy overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-eko-gold/5 to-transparent" />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="text-left">
                <BreadcrumbNav
                  crumbs={[
                    { label: "Home", href: "/" },
                    { label: "All Use Cases" },
                  ]}
                />
              </div>
              <FadeIn onView={false} delay={100} className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Find the right Eko stack for your business
                </h1>
                <p className="text-xl text-white/70 max-w-3xl mx-auto">
                  Browse by industry to see how teams like yours use Eko, or by
                  solution pack to see pre-bundled APIs for common workflows.
                </p>
              </FadeIn>

              {/* Choice Cards */}
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <FadeIn delay={200} className="flex">
                  <Link
                    to="/industries"
                    className="flex flex-col group p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xs hover:bg-white/10 hover:border-eko-gold/40 hover:shadow-[0_0_40px_rgba(212,160,23,0.15)] transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-eko-gold/20 flex items-center justify-center mb-5 group-hover:bg-eko-gold/30 transition-colors">
                      <Building2 className="w-7 h-7 text-eko-gold" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      I'm building for an industry
                    </h2>
                    <p className="text-white/60 mb-6 leading-relaxed flex-1">
                      See which APIs and packs are recommended for your sector —
                      lending, microfinance, retail, insurance, and more.
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-eko-gold font-semibold group-hover:gap-3 transition-all duration-200">
                      Browse Industries <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </FadeIn>
                <FadeIn delay={300} className="flex">
                  <Link
                    to="/solutions"
                    className="flex flex-col group p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xs hover:bg-white/10 hover:border-eko-gold/40 hover:shadow-[0_0_40px_rgba(212,160,23,0.15)] transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-eko-gold/20 flex items-center justify-center mb-5 group-hover:bg-eko-gold/30 transition-colors">
                      <Package className="w-7 h-7 text-eko-gold" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      I need a specific solution
                    </h2>
                    <p className="text-white/60 mb-6 leading-relaxed flex-1">
                      Explore pre-bundled API packs for common workflows — KYC,
                      onboarding, agent banking, compliance, and more.
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-eko-gold font-semibold group-hover:gap-3 transition-all duration-200">
                      Browse Solutions <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </FadeIn>
              </div>
            </div>
          </section>

          {/* Featured Solutions */}
          <SectionContainer variant="muted">
            <SectionHeader
              badge="Popular"
              title="Featured solution packs"
              subtitle="The most popular pre-bundled API stacks across industries."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {featuredSolutions.map((sol, i) => (
                <SolutionCard key={sol.slug} solution={sol} delay={i * 100} />
              ))}
            </div>
          </SectionContainer>

          {/* Industries Grid */}
          {INDUSTRY_CATEGORIES.map((cat) => (
            <SectionContainer key={cat.key}>
              <SectionHeader title={cat.label} />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {cat.industries.map((ind, i) => (
                  <IndustryCard key={ind.slug} industry={ind} delay={i * 100} />
                ))}
              </div>
            </SectionContainer>
          ))}

          {/* How It Works */}
          <SectionContainer className="bg-eko-navy">
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                How it works
              </h2>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  step: 1,
                  title: "Pick industry or solution",
                  desc: "Start from your industry or a specific workflow",
                  icon: Building2,
                },
                {
                  step: 2,
                  title: "Review APIs in the bundle",
                  desc: "See exactly which APIs are included and why",
                  icon: Package,
                },
                {
                  step: 3,
                  title: "Get sandbox access",
                  desc: "Start testing in minutes — no commitment required",
                  icon: Zap,
                },
              ].map((s) => (
                <FadeIn
                  key={s.step}
                  delay={s.step * 100}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-lg mx-auto mb-4">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {s.title}
                  </h3>
                  <p className="text-white/60 text-sm">{s.desc}</p>
                </FadeIn>
              ))}
            </div>
          </SectionContainer>

          {/* Stats */}
          <SectionContainer>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <FadeIn>
                <StatCard value="50,000+" label="Businesses" icon={Users} />
              </FadeIn>
              <FadeIn delay={100}>
                <StatCard
                  value="200K+"
                  label="Agent touchpoints"
                  icon={Building2}
                />
              </FadeIn>
              {/* <FadeIn delay={200}><StatCard value="99.9%" label="Uptime" icon={Shield} /></FadeIn> */}
              <FadeIn delay={300}>
                <StatCard value="RBI" label="Compliant" icon={BarChart3} />
              </FadeIn>
            </div>
          </SectionContainer>

          {/* Bottom CTA */}
          <SectionContainer variant="muted">
            <FadeIn className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Ready to get started?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Talk to our solutions team or explore the APIs directly.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="gold"
                  size="lg"
                  onClick={() =>
                    window.dispatchEvent(new Event("open-talk-to-sales"))
                  }
                >
                  Talk to Our Solutions Team
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a
                    href="https://developers.eko.in"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explore APIs <ArrowRight className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </FadeIn>
          </SectionContainer>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default UseCasesHubPage;
