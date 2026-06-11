import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";

import type {
  ApiField,
  ApiPreviewItem,
  ApiSampleJson,
} from "@/components/ApiInputOutputPreview";
import { ApiInputOutputPreview } from "@/components/ApiInputOutputPreview";
import { SectionContainer } from "@/components/SectionContainer";
import { FaqSection } from "@/components/sections/FaqSection";
import { IntegrationStepperSection } from "@/components/sections/IntegrationStepperSection";
import { LeadFormCTASection } from "@/components/sections/LeadFormCTASection";
import { PageHero } from "@/components/sections/PageHero";
import { openZohoChat } from "@/lib/zoho-chat";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle,
  FileText,
  IndianRupee,
  Landmark,
  Store,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FadeIn } from "@/components/FadeIn";
import { Picture, type PictureSource } from "@/components/Picture";
import { SolutionCard } from "@/components/SolutionCard";
import {
  getPricedApisForProduct,
  getStartingRate,
} from "@/lib/data/api-pricing";
import { getSolutionPacksForApi } from "@/lib/data/solutions";
import { formatINRRate, normalizeApiLabel } from "@/lib/utils";
import { Helmet } from "react-helmet-async";
import { ApiChip } from "./ApiChip";

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
  icon?: LucideIcon;
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
    sampleJson?: ApiSampleJson;
  };
  inputOutputPreviews?: ApiPreviewItem[];
  heroImage?: PictureSource;
  productId?: string;
}

/** Hero image `sizes`, shared by the <Picture> and its preload <link>. */
const HERO_IMAGE_SIZES =
  "(max-width: 767px) 70vw, (max-width: 1023px) 45vw, 448px";

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
  const [selectedApiName, setSelectedApiName] = useState<string | null>(null);
  const apiPreviewRef = useRef<HTMLDivElement>(null);
  const recommendedPacks = useMemo(
    () => (productId ? getSolutionPacksForApi(productId, 3) : []),
    [productId],
  );
  const hasPricing = productId
    ? getPricedApisForProduct(productId).length > 0
    : false;
  const startingRate = productId ? getStartingRate(productId) : undefined;

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
    apiPreviewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <main>
        {/* Hero Section */}
        <PageHero>
          <div
            className={`grid gap-10 lg:gap-16 items-start ${
              heroImage ? "lg:grid-cols-[3fr_2fr]" : ""
            }`}
          >
            {/* Left: Content */}
            <div>
              <FadeIn onView={false} delay={100}>
                <Link
                  to="/#products"
                  className="inline-flex items-center gap-2 text-eko-gold/80 hover:text-eko-gold mb-6 text-sm font-medium transition-colors"
                >
                  ← Back to Home
                </Link>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight text-balance">
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

                  <Button variant="hero-outline" size="lg" asChild>
                    <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                      View Documentation
                      <FileText className="w-4 h-4" />
                    </a>
                  </Button>

                  {hasPricing && (
                    <Button variant="hero-outline" size="lg" asChild>
                      <Link to={`/pricing?apis=${productId}`}>
                        View Pricing
                        <IndianRupee className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
                {hasPricing && startingRate !== undefined && (
                  <p className="text-white/60 text-sm mt-4">
                    Starts at{" "}
                    <span className="text-eko-gold font-semibold">
                      {formatINRRate(startingRate)}
                    </span>{" "}
                    per verification · excl. GST
                  </p>
                )}
              </FadeIn>
            </div>

            {/* Right: Hero Image or Lead Form */}
            {
              heroImage ? (
                <FadeIn
                  onView={false}
                  delay={300}
                  className="relative flex items-center justify-center"
                >
                  {/* Preload the LCP hero image so the browser starts the
                      request during <head> parse (Lighthouse "LCP request
                      discovery"), instead of when the in-body <img> is reached. */}
                  <Helmet>
                    {typeof heroImage === "string" ? (
                      <link
                        rel="preload"
                        as="image"
                        href={heroImage}
                        fetchPriority="high"
                      />
                    ) : (
                      <link
                        rel="preload"
                        as="image"
                        href={heroImage.img.src}
                        imageSrcSet={Object.values(heroImage.sources)[0]}
                        imageSizes={HERO_IMAGE_SIZES}
                        fetchPriority="high"
                      />
                    )}
                  </Helmet>
                  <div className="absolute inset-0 bg-eko-gold/5 rounded-full blur-3xl" />
                  <div className="relative perspective-[1000px]">
                    <Picture
                      src={heroImage}
                      alt={heroTitle}
                      sizes={HERO_IMAGE_SIZES}
                      fetchPriority="high"
                      className="w-full max-w-md mx-auto transition-transform duration-500 transform-3d rotate-y-[-5deg] rotate-x-[5deg] drop-shadow-[0_25px_50px_rgba(0,0,0,0.4)]"
                    />
                  </div>
                </FadeIn>
              ) : null
              // (
              //   <FadeIn
              //     onView={false}
              //     delay={300}
              //     className="relative"
              //     id="lead-form"
              //   >
              //     {/* Trust Shield Badge - desktop only */}
              //     <div className="hidden lg:flex absolute -left-4 -top-4 z-10 items-center gap-2 bg-eko-gold/10 border border-eko-gold/30 rounded-full px-4 py-2 backdrop-blur-xs">
              //       <Shield className="w-4 h-4 text-eko-gold" />
              //       <span className="text-xs font-semibold text-eko-gold">
              //         Reliable, high-volume workflows
              //       </span>
              //     </div>

              //     <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
              //     <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
              //       <div className="bg-eko-navy px-6 py-4">
              //         <h3 className="text-lg font-bold text-white">
              //           {leadForm?.title || "Get API Access"}
              //         </h3>
              //         <p className="text-white/70 text-sm">
              //           Get started in 10 minutes
              //         </p>
              //       </div>

              //       <div className="p-2">
              //         <ZohoSignupForm />
              //       </div>
              //     </div>
              //   </FadeIn>
              // )
            }
          </div>
        </PageHero>

        {/* Overview Section */}
        {overview && (
          <SectionContainer>
            <FadeIn className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Overview
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {overview}
              </p>
            </FadeIn>
          </SectionContainer>
        )}

        {/* Key Benefits */}
        {keyBenefits && keyBenefits.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Key Benefits
              </h2>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {keyBenefits.map((benefit, i) => (
                <FadeIn
                  key={i}
                  delay={i * 100}
                  className="flex items-start gap-4 p-5 bg-card border border-border/50 rounded-xl"
                >
                  <CheckCircle className="w-6 h-6 text-eko-gold shrink-0 mt-0.5" />
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
            ) : (
              inputOutputPreview && (
                <ApiInputOutputPreview
                  apiName={inputOutputPreview.apiName}
                  inputs={inputOutputPreview.inputs}
                  outputs={inputOutputPreview.outputs}
                  comingSoon={inputOutputPreview.comingSoon}
                  docsUrl={docsUrl}
                  sampleJson={inputOutputPreview.sampleJson}
                />
              )
            )}
          </div>
        )}

        {/* Features Section */}
        <SectionContainer>
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Key Features
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to integrate and scale
            </p>
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
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.desc}
                    </p>
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
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.desc}
                    </p>
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
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.desc}
                    </p>
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
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Supported Types
              </h2>
            </FadeIn>
            <div className="flex flex-wrap justify-center gap-4">
              {types.map((type, index) => {
                const Icon = type.icon || CheckCircle;
                return (
                  <FadeIn
                    key={index}
                    delay={index * 75}
                    className="flex items-center gap-3 px-5 py-3 bg-card border border-border/50 rounded-full"
                  >
                    <Icon className="w-5 h-5 text-eko-gold" />
                    <span className="font-medium text-sm">{type.label}</span>
                  </FadeIn>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Benefits Section (legacy) */}
        {benefits && benefits.length > 0 && (
          <SectionContainer
            className={`bg-linear-to-br ${categoryColors[category]}`}
          >
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Why Choose Eko?
              </h2>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon || Zap;
                return (
                  <FadeIn
                    key={index}
                    delay={index * 100}
                    className="text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-eko-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {benefit.desc}
                    </p>
                  </FadeIn>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Who Should Use - Industry Cards */}
        {whoShouldUse && whoShouldUse.length > 0 && (
          <SectionContainer>
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Who Should Use This API?
              </h2>
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
                    <span className="text-foreground font-medium text-sm">
                      {item}
                    </span>
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
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Primary Use Cases
              </h2>
            </FadeIn>
            <div className="flex flex-wrap justify-center gap-4">
              {useCases.map((useCase, index) => (
                <FadeIn
                  key={index}
                  delay={index * 75}
                  className="px-6 py-3 bg-card border border-border/50 rounded-full text-sm font-medium"
                >
                  {useCase}
                </FadeIn>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Trust & Compliance */}
        {/* TODO: Fix how to show Trust & Compliance. The claims like "99.9% Uptime" should be legally/SLA backed. */}
        {/* {trustAndCompliance && trustAndCompliance.length > 0 && (
          <SectionContainer>
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <FadeIn className="flex-1">
                <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mb-6">
                  <Shield className="w-8 h-8 text-eko-gold" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Trust & Compliance
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Every API call is secured with enterprise-grade encryption and
                  compliance-ready workflows.
                </p>
                <ul className="flex flex-col gap-3">
                  {trustAndCompliance.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-eko-gold shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </FadeIn>
              <FadeIn delay={200} className="flex-1">
                <div className="relative">
                  <div className="absolute -inset-4 bg-linear-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-8 text-center">
                    <div className="text-6xl font-bold text-eko-gold mb-2">
                      99.9%
                    </div>
                    <div className="text-muted-foreground">
                      Uptime Guaranteed
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </SectionContainer>
        )} */}

        {/* Interactive Integration Stepper */}
        <IntegrationStepperSection
          integrationSteps={integrationSteps}
          docsUrl={docsUrl}
        />

        {/* FAQ Section */}
        <FaqSection faqs={faqs} variant="default" className="bg-muted/30" />

        {/* Recommended Solution Packs */}
        {recommendedPacks.length > 0 && (
          <SectionContainer>
            <FadeIn className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Recommended Solution Packs
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Pre-bundled API stacks that include {title}, designed for common
                industry workflows.
              </p>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {recommendedPacks.map((pack, i) => (
                <SolutionCard key={pack.slug} solution={pack} delay={i * 100} />
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Lead Form Section - Below FAQ */}
        <LeadFormCTASection
          heading="Get API Access"
          formTitle={leadForm?.title || "Get API Access"}
        />
      </main>

      <Footer />
    </div>
  );
};
