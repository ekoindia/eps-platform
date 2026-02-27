import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";


import { SectionContainer } from "@/components/SectionContainer";
import { ArrowRight, CheckCircle, Shield, Zap, FileText, HelpCircle, Users, Send, Building2, Store, Landmark, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ApiInputOutputPreview } from "@/components/ApiInputOutputPreview";
import type { ApiField } from "@/components/ApiInputOutputPreview";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProductFeature {
  title: string;
  description: string;
  icon?: LucideIcon;
}

interface IntegrationStep {
  step: number;
  title: string;
  description: string;
  tip?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "select";
  required?: boolean;
  options?: string[];
}

interface ProductPageLayoutProps {
  title: string;
  description: string;
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
    fields: FormField[];
    cta: string;
  };
  types?: { label: string; icon?: LucideIcon }[];
  inputOutputPreview?: {
    apiName: string;
    inputs: ApiField[];
    outputs: ApiField[];
    comingSoon?: boolean;
  };
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
}: ProductPageLayoutProps) => {
  const [showSticky, setShowSticky] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <Header />

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
                <Link 
                  to="/#products" 
                  className="inline-flex items-center gap-2 text-eko-gold/80 hover:text-eko-gold mb-6 text-sm font-medium transition-colors"
                >
                  ← Back to Products
                </Link>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  {heroTitle}
                </h1>
                <p className="text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
                  {heroSubtitle}
                </p>
                
                <div className="flex flex-wrap gap-4">
                  <Button variant="hero-outline" size="lg" asChild>
                    <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4" />
                      View Documentation
                    </a>
                  </Button>
                </div>
              </div>

              {/* Right: Lead Form Card */}
              <div className="relative" id="lead-form">
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
                    <iframe
                      aria-label="New Eko.in API Signup"
                      frameBorder="0"
                      allow="geolocation;"
                      style={{ height: "500px", width: "100%", border: "none" }}
                      src="https://forms.zohopublic.in/ekoindiafinancialservicespvtlt/form/NewEkoinAPISignup/formperma/JmSIq1OIg5-iNmPq-fcqHv9g9_QBNvM2VQ2DC3XetvQ"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Overview Section */}
        {overview && (
          <SectionContainer>
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">Overview</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">{overview}</p>
            </div>
          </SectionContainer>
        )}

        {/* Key Benefits */}
        {keyBenefits && keyBenefits.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Key Benefits</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {keyBenefits.map((benefit, i) => (
                <div key={i} className="flex items-start gap-4 p-5 bg-card border border-border/50 rounded-xl opacity-0 animate-fade-up" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}>
                  <CheckCircle className="w-6 h-6 text-eko-gold flex-shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* API Input/Output Preview */}
        {inputOutputPreview && (
          <ApiInputOutputPreview
            apiName={inputOutputPreview.apiName}
            inputs={inputOutputPreview.inputs}
            outputs={inputOutputPreview.outputs}
            comingSoon={inputOutputPreview.comingSoon}
            docsUrl={docsUrl}
          />
        )}

        {/* Features Section */}
        <SectionContainer>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Key Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to integrate and scale</p>
          </div>
          
          {/* Top features in 3-col highlighted row */}
          {features.length >= 3 && (
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {features.slice(0, 3).map((feature, index) => {
                const Icon = feature.icon || Zap;
                return (
                  <div 
                    key={index}
                    className="group p-6 bg-card border-2 border-eko-gold/20 rounded-2xl hover:shadow-lg hover:border-eko-gold/40 transition-all duration-300 opacity-0 animate-fade-up"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
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
                  <div 
                    key={index}
                    className="group p-6 bg-card border border-border/50 rounded-2xl hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
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
                  <div 
                    key={index}
                    className="group p-6 bg-card border border-border/50 rounded-2xl hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionContainer>

        {/* Types Section */}
        {types && types.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Supported Types</h2>
            </div>
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
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why Choose Eko?</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon || Zap;
                return (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-eko-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Who Should Use - Industry Cards */}
        {whoShouldUse && whoShouldUse.length > 0 && (
          <SectionContainer>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Who Should Use This API?</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {whoShouldUse.map((item, i) => {
                const Icon = getIndustryIcon(item);
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-3 p-6 bg-card border border-border/50 rounded-xl text-center hover:-translate-y-1 hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300 cursor-default"
                  >
                    <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-eko-gold" />
                    </div>
                    <span className="text-foreground font-medium text-sm">{item}</span>
                  </div>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Use Cases */}
        {useCases && useCases.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Primary Use Cases</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {useCases.map((useCase, index) => (
                <div key={index} className="px-6 py-3 bg-card border border-border/50 rounded-full text-sm font-medium">
                  {useCase}
                </div>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Trust & Compliance */}
        {trustAndCompliance && trustAndCompliance.length > 0 && (
          <SectionContainer>
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1">
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
              </div>
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-8 text-center">
                    <div className="text-6xl font-bold text-eko-gold mb-2">99.9%</div>
                    <div className="text-muted-foreground">Uptime Guaranteed</div>
                  </div>
                </div>
              </div>
            </div>
          </SectionContainer>
        )}

        {/* Interactive Integration Stepper */}
        <SectionContainer className="bg-eko-navy">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How to Integrate</h2>
            <p className="text-white/70 max-w-2xl mx-auto">Get started in minutes with our simple integration process</p>
          </div>
          
          <TooltipProvider>
            {/* Desktop: horizontal stepper */}
            <div className="hidden md:flex items-start justify-center max-w-4xl mx-auto">
              {integrationSteps.map((step, i) => (
                <div key={step.step} className="flex items-start flex-1">
                  <div className="flex flex-col items-center text-center group">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-14 h-14 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-lg cursor-pointer hover:scale-110 hover:ring-4 hover:ring-eko-gold/30 transition-all duration-300">
                          {step.step}
                        </div>
                      </TooltipTrigger>
                      {step.tip && (
                        <TooltipContent side="top" className="bg-eko-navy text-white border-eko-gold/30 max-w-[200px]">
                          <p className="text-xs">{step.tip}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <h3 className="text-sm font-semibold text-white mt-3 mb-1">{step.title}</h3>
                    <p className="text-white/50 text-xs max-w-[140px]">{step.description}</p>
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
                <div key={step.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold text-sm">
                      {step.step}
                    </div>
                    {i < integrationSteps.length - 1 && <div className="w-0.5 flex-1 bg-white/20 mt-2" />}
                  </div>
                  <div className="pb-6">
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="text-white/50 text-xs mt-1">{step.description}</p>
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
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <details key={index} className="group p-6 bg-card border border-border/50 rounded-2xl cursor-pointer">
                <summary className="flex items-center justify-between font-semibold text-foreground list-none">
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-eko-gold flex-shrink-0" />
                    {faq.question}
                  </span>
                  <span className="ml-4 text-eko-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed pl-8">{faq.answer}</p>
              </details>
            ))}
          </div>
        </SectionContainer>
      </main>
      
      <Footer />
    </div>
  );
};
