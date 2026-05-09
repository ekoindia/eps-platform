import { useEffect, useMemo, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";


import { SectionContainer } from "@/components/SectionContainer";
import { ArrowRight, CheckCircle, Shield, Zap, FileText, HelpCircle, Users, Building2, Store, Landmark, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ApiInputOutputPreview } from "@/components/ApiInputOutputPreview";
import type { ApiField, ApiPreviewItem } from "@/components/ApiInputOutputPreview";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ZohoSignupForm } from "@/components/ZohoSignupForm";
import { openZohoChat } from "@/lib/zoho-form";
import EkoShieldAdBanner from "./EkoShieldAdBanner";
import { FadeIn } from "@/components/FadeIn";
import { ApiChip } from "./ApiChip";
import { normalizeApiLabel } from "@/lib/utils";
import { getSolutionPacksForApi } from "@/lib/data/solutions";
import { SolutionCard } from "@/components/SolutionCard";

export interface ProductFeature {
  title: string;
  desc: string;
  icon?: LucideIcon;
}

export interface IntegrationStep {
  title: string;
  desc: string;
  tip?: string;
}

export interface FAQ {
  q: string;
  a: string;
}

export interface ProductPageLayoutProps {
  title: string;
  desc: string;
  heroTitle: string;
  heroSubtitle: string;
  overview?: string;
  features: ProductFeature[];
  benefits?: ProductFeature[];
  keyBenefits?: string[];
  integrationSteps: IntegrationStep[];
  faqs: FAQ[];
  docsUrl: string;
  category: "payment" | "verification" | "platform";
  useCases?: string[];
  whoShouldUse?: string[];
  trustAndCompliance?: string[];
  leadForm?: {
    title: string;
  };
  types?: { label: string; icon?: LucideIcon }[];
  inputOutputPreview?: {
    apiName: string;
    inputs?: ApiField[];
    outputs?: ApiField[];
    comingSoon?: boolean;
  };
  inputOutputPreviews?: ApiPreviewItem[];
  heroImage?: string;
  productId?: string;
}

const industryIcons: Record<string, LucideIcon> = {
  fintech: Building2,
  financial: Building2,
  marketplace: Store,
  nbfc: Landmark,
  lender: Landmark,
  enterprise: Briefcase,
  default: Users,
};

const getIndustryIcon = (label: string): LucideIcon => {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(industryIcons)) {
    if (lower.includes(key)) return icon;
  }
  return industryIcons.default;
};

export const ProductPageLayout = ({
  title,
  heroTitle,
  heroSubtitle,
  overview,
  features,
  benefits,
  keyBenefits,
  integrationSteps,
  faqs,
  docsUrl,
  category,
  useCases,
  whoShouldUse,
  trustAndCompliance,
  leadForm,
  types,
  inputOutputPreview,
  inputOutputPreviews,
  heroImage,
  productId,
}: ProductPageLayoutProps) => {
  const [showSticky, setShowSticky] = useState(false);
  const [selectedApiName, setSelectedApiName] = useState<string | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const apiPreviewRef = useRef<HTMLDivElement>(null);
  const recommendedPacks = useMemo(
    () => (productId ? getSolutionPacksForApi(productId, 3) : []),
    [productId]
  );

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);


  const categoryColors = {
    payment: "from-eko-gold/20 to-eko-navy/5",
    verification: "from-eko-gold/20 to-eko-success/5",
    platform: "from-eko-navy/20 to-eko-gold/5",
  };

  /**
   * Utility function to scroll to API preview section when an API chip is clicked. This allows users to quickly navigate to the relevant section of the page to see input/output details for the selected API.
   * The function uses the `apiPreviewRef` reference to identify the target section and scrolls it into view with smooth behavior.
   */
  const scrollToApiPreview = (apiName?: string) => {
    if (apiName) setSelectedApiName(apiName);
    apiPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Sticky CTA Bar - positioned below the main header */}
      <div
        className={`fixed top-[72px] left-0 right-0 z-40 bg-background/95 backdrop-blur border-b border-border/50 shadow-sm transition-all duration-300 ${
          showSticky ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <span className="font-semibold text-foreground text-sm truncate">{title}</span>
          <Button variant="action" size="sm" asChild>
            <a href="#lead-form">Get API Access <ArrowRight className="w-3 h-3" /></a>
          </Button>
        </div>
      </div>

      <main>
        {/* Hero Section */}
        <section ref={heroRef} className="relative pt-32 pb-20 bg-eko-navy overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-eko-gold/5 to-transparent" />

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              {/* Left: Content */}
              <div>
                <FadeIn onView={false} delay={100}>
                  <Link
                    to="/#products"
                    className="inline-flex items-center gap-2 text-eko-gold/80 hover:text-eko-gold mb-6 text-sm font-medium transition-colors"
                  >
                    ← Back to Home
                  </Link>

                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                    {heroTitle}
                  </h1>
                </FadeIn>
                <FadeIn onView={false} delay={200}>
                  <p className="text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
                    {heroSubtitle}
                  </p>

                  {/* API Chip Row */}
                  {inputOutputPreviews && inputOutputPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-10">
                    {inputOutputPreviews.map((chip) => (
                      <ApiChip
                        key={chip.apiName}
                        name={normalizeApiLabel(chip.apiName)}
                        relevance={chip.relevance}
                        onClick={() => scrollToApiPreview(chip.apiName)}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    ))}
                  </div>
                  )}
                </FadeIn>
                <FadeIn onView={false} delay={300}>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="gold" size="lg" asChild onClick={() => openZohoChat()}>
                      <span>Get Sandbox Access <ArrowRight className="w-4 h-4" /></span>
                    </Button>

                    <Button variant="hero-outline" size="lg" asChild>
                      <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                        View Documentation
                        <FileText className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </FadeIn>
              </div>

              {/* Right: Hero Image or Lead Form */}
              {heroImage ? (
                <FadeIn onView={false} delay={300} className="relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-eko-gold/5 rounded-full blur-3xl" />
                  <div
                    className="relative animate-float"
                    style={{
                      perspective: "1000px",
                    }}
                  >
                    <img
                      src={heroImage}
                      alt={heroTitle}
                      width={512}
                      height={512}
                      fetchPriority="high"
                      className="w-full max-w-lg mx-auto transition-transform duration-500 hover:scale-105"
                      style={{
                        transform: "perspective(1000px) rotateY(-5deg) rotateX(5deg)",
                        filter: "drop-shadow(0 25px 50px rgba(0,0,0,0.4))",
                      }}
                    />
                  </div>
                </FadeIn>
              ) : (
                <FadeIn onView={false} delay={300} className="relative" id="lead-form">
                  {/* Trust Shield Badge - desktop only */}
                  <div className="hidden lg:flex absolute -left-4 -top-4 z-10 items-center gap-2 bg-eko-gold/10 border border-eko-gold/30 rounded-full px-4 py-2 backdrop-blur-sm">
                    <Shield className="w-4 h-4 text-eko-gold" />
                    <span className="text-xs font-semibold text-eko-gold">99.9% Uptime</span>
                  </div>

                  <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
                  <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div className="bg-eko-navy px-6 py-4">
                      <h3 className="text-lg font-bold text-white">
                        {leadForm?.title || "Get API Access"}
                      </h3>
                      <p className="text-white/70 text-sm">Get started in 10 minutes</p>
                    </div>

                    <div className="p-2">
                      <ZohoSignupForm />
                    </div>
                  </div>
                </FadeIn>
              )}
            </div>
          </div>
        </section>

        {/* Overview Section */}
        {overview && (
          <SectionContainer>
            <FadeIn className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">Overview</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">{overview}</p>
            </FadeIn>
          </SectionContainer>
        )}

        {/* Key Benefits */}
        {keyBenefits && keyBenefits.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Key Benefits</h2>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {keyBenefits.map((benefit, i) => (
                <FadeIn key={i} delay={i * 100} className="flex items-start gap-4 p-5 bg-card border border-border/50 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-eko-gold flex-shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium">{benefit}</span>
                </FadeIn>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* API Input/Output Preview Section */}
        {(inputOutputPreviews || inputOutputPreview) && (
          <div ref={apiPreviewRef}>
            {inputOutputPreviews ? (
              <ApiInputOutputPreview
                apiName={title}
                previews={inputOutputPreviews}
                docsUrl={docsUrl}
                activeApiName={selectedApiName ?? undefined}
              />
            ) : inputOutputPreview && (
              <ApiInputOutputPreview
                apiName={inputOutputPreview.apiName}
                inputs={inputOutputPreview.inputs}
                outputs={inputOutputPreview.outputs}
                comingSoon={inputOutputPreview.comingSoon}
                docsUrl={docsUrl}
              />
            )}
          </div>
        )}

        {/* Features Section */}
        <SectionContainer>
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Key Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to integrate and scale</p>
          </FadeIn>

          {/* Top features in 3-col highlighted row */}
          {features.length >= 3 && (
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {features.slice(0, 3).map((feature, index) => {
                const Icon = feature.icon || Zap;
                return (
                  <FadeIn
                    key={index}
                    delay={index * 100}
                    className="group p-6 bg-card border-2 border-eko-gold/20 rounded-2xl hover:shadow-lg hover:border-eko-gold/40 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </FadeIn>
                );
              })}
            </div>
          )}

          {/* Remaining features in 2-col grid */}
          {features.length > 3 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.slice(3).map((feature, index) => {
                const Icon = feature.icon || Zap;
                return (
                  <FadeIn
                    key={index}
                    delay={index * 100}
                    className="group p-6 bg-card border border-border/50 rounded-2xl hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </FadeIn>
                );
              })}
            </div>
          )}

          {/* Fallback for <= 3 features without top row */}
          {features.length < 3 && (
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon || Zap;
                return (
                  <FadeIn
                    key={index}
                    delay={index * 100}
                    className="group p-6 bg-card border border-border/50 rounded-2xl hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </SectionContainer>

        {/* Types Section */}
        {types && types.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Supported Types</h2>
            </FadeIn>
            <div className="flex flex-wrap justify-center gap-4">
              {types.map((type, index) => {
                const Icon = type.icon || CheckCircle;
                return (
                  <div key={index} className="flex items-center gap-3 px-5 py-3 bg-card border border-border/50 rounded-full">
                    <Icon className="w-5 h-5 text-eko-gold" />
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Benefits Section (legacy) */}
        {benefits && benefits.length > 0 && (
          <SectionContainer className={`bg-gradient-to-br ${categoryColors[category]}`}>
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why Choose Eko?</h2>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon || Zap;
                return (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-eko-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{benefit.desc}</p>
                  </div>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Who Should Use - Industry Cards */}
        {whoShouldUse && whoShouldUse.length > 0 && (
          <SectionContainer>
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Who Should Use This API?</h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {whoShouldUse.map((item, i) => {
                const Icon = getIndustryIcon(item);
                return (
                  <FadeIn
                    key={i}
                    delay={i * 100}
                    className="flex flex-col items-center gap-3 p-6 bg-card border border-border/50 rounded-xl text-center hover:-translate-y-1 hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300 cursor-default"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <span className="text-foreground font-medium text-sm">{item}</span>
                  </FadeIn>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Use Cases */}
        {useCases && useCases.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Primary Use Cases</h2>
            </FadeIn>
            <div className="flex flex-wrap justify-center gap-4">
              {useCases.map((useCase, index) => (
                <div key={index} className="px-6 py-3 bg-card border border-border/50 rounded-full text-sm font-medium">
                  {useCase}
                </div>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Eko Shield Ad Banner */}
        {/verification|kyc/i.test(heroTitle) && (
          <EkoShieldAdBanner/>
        )}

        {/* Trust & Compliance */}
        {trustAndCompliance && trustAndCompliance.length > 0 && (
          <SectionContainer>
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <FadeIn className="flex-1">
                <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mb-6">
                  <Shield className="w-8 h-8 text-eko-gold" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Trust & Compliance</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Every API call is secured with enterprise-grade encryption and compliance-ready workflows.
                </p>
                <ul className="space-y-3">
                  {trustAndCompliance.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-eko-gold flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </FadeIn>
              <FadeIn delay={200} className="flex-1">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-8 text-center">
                    <div className="text-6xl font-bold text-eko-gold mb-2">99.9%</div>
                    <div className="text-muted-foreground">Uptime Guaranteed</div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </SectionContainer>
        )}

        {/* Interactive Integration Stepper */}
        <SectionContainer className="bg-eko-navy">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How to Integrate</h2>
            <p className="text-white/70 max-w-2xl mx-auto">Get started in minutes with our simple integration process</p>
          </FadeIn>

          <TooltipProvider>
            {/* Desktop: horizontal stepper */}
            <div className="hidden md:flex items-start justify-center max-w-4xl mx-auto">
              {integrationSteps.map((step, i) => (
                <div key={i} className="flex items-start flex-1">
                  <div className="flex flex-col items-center text-center group">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-14 h-14 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-lg cursor-pointer hover:scale-110 hover:ring-4 hover:ring-eko-gold/30 transition-all duration-300">
                          {i + 1}
                        </div>
                      </TooltipTrigger>
                      {step.tip && (
                        <TooltipContent side="top" className="bg-eko-navy text-white border-eko-gold/30 max-w-[200px]">
                          <p className="text-xs">{step.tip}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <h3 className="text-sm font-semibold text-white mt-3 mb-1">{step.title}</h3>
                    <p className="text-white/70 text-xs max-w-[140px]">{step.desc}</p>
                  </div>
                  {i < integrationSteps.length - 1 && (
                    <div className="flex-1 h-0.5 bg-white/20 mt-7 mx-2" />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: vertical stepper */}
            <div className="md:hidden space-y-6 max-w-sm mx-auto">
              {integrationSteps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-sm">
                      {i + 1}
                    </div>
                    {i < integrationSteps.length - 1 && <div className="w-0.5 flex-1 bg-white/20 mt-2" />}
                  </div>
                  <div className="pb-6">
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="text-white/70 text-xs mt-1">{step.desc}</p>
                    {step.tip && <p className="text-eko-gold/80 text-xs mt-1 italic">{step.tip}</p>}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>

          <div className="text-center mt-10">
            <Button variant="gold" size="lg" asChild>
              <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                View Documentation
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </SectionContainer>

        {/* FAQ Section */}
        <SectionContainer className="bg-muted/30">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
          </FadeIn>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <FadeIn key={index} delay={index * 50}>
                <details className="group p-6 bg-card border border-border/50 rounded-2xl cursor-pointer">
                  <summary className="flex items-center justify-between font-semibold text-foreground list-none">
                    <span className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-eko-gold flex-shrink-0" />
                      {faq.q}
                    </span>
                    <span className="ml-4 text-eko-gold transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 text-muted-foreground leading-relaxed pl-8">{faq.a}</p>
                </details>
              </FadeIn>
            ))}
          </div>
        </SectionContainer>

        {/* Recommended Solution Packs */}
        {recommendedPacks.length > 0 && (
          <SectionContainer>
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Recommended Solution Packs</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Pre-bundled API stacks that include this API, designed for common industry workflows.</p>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {recommendedPacks.map((pack, i) => (
                <SolutionCard key={pack.slug} solution={pack} delay={i * 100} />
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Lead Form Section - Below FAQ */}
        {heroImage && (
          <SectionContainer variant="navy" id="lead-form" className="relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-eko-gold/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-eko-gold/5 rounded-full blur-3xl" />

            <div className="relative grid lg:grid-cols-2 gap-12 items-center">
              <FadeIn>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Get API Access
                </h2>
                <p className="text-white/70 text-lg mb-6 leading-relaxed">
                  Sign up now and start integrating in minutes. Our team will help you go live quickly.
                </p>
                <ul className="space-y-3">
                  {["Sandbox access in minutes", "Dedicated integration support", "Comprehensive documentation", "99.9% uptime guarantee"].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-white/80">
                      <CheckCircle className="w-5 h-5 text-eko-gold flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </FadeIn>

              <FadeIn delay={200} className="relative">
                <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="bg-eko-navy px-6 py-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">
                      {leadForm?.title || "Get API Access"}
                    </h3>
                    <p className="text-white/70 text-sm">Get started in 10 minutes</p>
                  </div>
                  <div className="p-2">
                    <ZohoSignupForm />
                  </div>
                </div>
              </FadeIn>
            </div>
          </SectionContainer>
        )}
      </main>

      <Footer />
    </div>
  );
};
