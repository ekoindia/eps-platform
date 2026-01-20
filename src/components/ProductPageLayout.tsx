import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { SectionContainer } from "@/components/SectionContainer";
import { ArrowRight, CheckCircle, Shield, Zap, FileText, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LeadCaptureSection } from "@/components/sections/LeadCaptureSection";

interface ProductFeature {
  title: string;
  description: string;
  icon?: LucideIcon;
}

interface IntegrationStep {
  step: number;
  title: string;
  description: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface ProductPageLayoutProps {
  // SEO
  title: string;
  description: string;
  
  // Hero
  heroTitle: string;
  heroSubtitle: string;
  heroImage?: string;
  
  // Features
  features: ProductFeature[];
  
  // Benefits
  benefits: ProductFeature[];
  
  // Integration steps
  integrationSteps: IntegrationStep[];
  
  // FAQ
  faqs: FAQ[];
  
  // Documentation link
  docsUrl: string;
  
  // Category
  category: "payment" | "verification" | "platform";
  
  // Optional: Use cases specific to this product
  useCases?: string[];
  
  // Optional: Types/categories (like BBPS biller types)
  types?: { label: string; icon?: LucideIcon }[];
}

export const ProductPageLayout = ({
  heroTitle,
  heroSubtitle,
  features,
  benefits,
  integrationSteps,
  faqs,
  docsUrl,
  category,
  useCases,
  types,
}: ProductPageLayoutProps) => {
  const categoryColors = {
    payment: "from-eko-gold/20 to-eko-navy/5",
    verification: "from-eko-gold/20 to-eko-success/5",
    platform: "from-eko-navy/20 to-eko-gold/5",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 bg-eko-navy overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-eko-gold/5 to-transparent" />
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl">
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
                <Button variant="gold" size="lg" asChild>
                  <a href="#signup-form">
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="hero-outline" size="lg" asChild>
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4" />
                    View Documentation
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <SectionContainer>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Key Features
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to integrate and scale
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon || CheckCircle;
              return (
                <div 
                  key={index}
                  className="group p-6 bg-card border border-border/50 rounded-2xl hover:shadow-lg hover:border-eko-gold/30 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-eko-gold/10 flex items-center justify-center mb-4 group-hover:bg-eko-gold/20 transition-colors">
                    <Icon className="w-6 h-6 text-eko-gold" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionContainer>

        {/* Types Section (if applicable, like BBPS biller types) */}
        {types && types.length > 0 && (
          <SectionContainer className="bg-muted/30">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Supported Types
              </h2>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {types.map((type, index) => {
                const Icon = type.icon || CheckCircle;
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-3 px-5 py-3 bg-card border border-border/50 rounded-full"
                  >
                    <Icon className="w-5 h-5 text-eko-gold" />
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                );
              })}
            </div>
          </SectionContainer>
        )}

        {/* Benefits Section */}
        <SectionContainer className={`bg-gradient-to-br ${categoryColors[category]}`}>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose Eko?
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon || Zap;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-eko-gold" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionContainer>

        {/* Trust Section */}
        <SectionContainer>
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-eko-gold/10 flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-eko-gold" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Eko's Trust
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We use the same APIs here at Eko! Every API call is secured with one-time-use tokens 
                generated using asymmetric cryptography. Our open-source libraries make it extremely 
                easy & error-proof.
              </p>
              <ul className="space-y-3">
                {[
                  "RBI-compliant infrastructure",
                  "99.9% uptime guarantee",
                  "Enterprise-grade security",
                  "24/7 support"
                ].map((item, i) => (
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

        {/* Integration Steps */}
        <SectionContainer className="bg-eko-navy">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How to Integrate
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              Get started in minutes with our simple integration process
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {integrationSteps.map((step) => (
              <div 
                key={step.step}
                className="relative p-6 bg-white/5 backdrop-blur border border-white/10 rounded-2xl"
              >
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 mt-4">
                  {step.title}
                </h3>
                <p className="text-white/60 text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-10">
            <Button variant="gold" size="lg" asChild>
              <a href={docsUrl} target="_blank" rel="noopener noreferrer">
                View Documentation
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </SectionContainer>

        {/* Use Cases */}
        {useCases && useCases.length > 0 && (
          <SectionContainer>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Use Cases
              </h2>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {useCases.map((useCase, index) => (
                <div 
                  key={index}
                  className="px-6 py-3 bg-muted rounded-full text-sm font-medium"
                >
                  {useCase}
                </div>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* FAQ Section */}
        <SectionContainer className="bg-muted/30">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <details 
                key={index}
                className="group p-6 bg-card border border-border/50 rounded-2xl cursor-pointer"
              >
                <summary className="flex items-center justify-between font-semibold text-foreground list-none">
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-eko-gold flex-shrink-0" />
                    {faq.question}
                  </span>
                  <span className="ml-4 text-eko-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed pl-8">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </SectionContainer>

        {/* Lead Capture */}
        <div id="signup-form">
          <LeadCaptureSection />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};
