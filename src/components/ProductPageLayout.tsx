import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionContainer } from "@/components/SectionContainer";
import { ArrowRight, CheckCircle, Shield, Zap, FileText, HelpCircle, Users, Send } from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

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
}

export const ProductPageLayout = ({
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
}: ProductPageLayoutProps) => {
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const categoryColors = {
    payment: "from-eko-gold/20 to-eko-navy/5",
    verification: "from-eko-gold/20 to-eko-success/5",
    platform: "from-eko-navy/20 to-eko-gold/5",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        {/* Hero Section with inline form */}
        <section className="relative pt-32 pb-20 bg-eko-navy overflow-hidden">
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
              <div className="relative">
                <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="bg-eko-navy px-6 py-4">
                    <h3 className="text-lg font-bold text-white">
                      {leadForm?.title || "Get API Access"}
                    </h3>
                    <p className="text-white/70 text-sm">Get started in 10 minutes</p>
                  </div>

                  <div className="p-6">
                    {formSubmitted ? (
                      <div className="text-center py-8">
                        <div className="w-14 h-14 rounded-full bg-eko-gold/20 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-7 h-7 text-eko-gold" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Thank You!</h3>
                        <p className="text-muted-foreground text-sm">Our team will reach out to you within 24 hours.</p>
                      </div>
                    ) : (
                      <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div>
                          <Label htmlFor="hero-name" className="text-sm font-medium text-foreground">
                            Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="hero-name"
                            placeholder="Enter your name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="hero-phone" className="text-sm font-medium text-foreground">
                            Phone <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex mt-1.5">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                              +91
                            </span>
                            <Input
                              id="hero-phone"
                              type="tel"
                              placeholder="Enter mobile number"
                              required
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="rounded-l-none"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="hero-email" className="text-sm font-medium text-foreground">
                            Email <span className="text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            id="hero-email"
                            type="email"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="mt-1.5"
                          />
                        </div>
                        <Button type="submit" variant="gold" size="lg" className="w-full">
                          {leadForm?.cta || "Request API Access"}
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          By submitting, you agree to our Terms & Conditions.
                        </p>
                      </form>
                    )}
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
                <div key={i} className="flex items-start gap-4 p-5 bg-card border border-border/50 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-eko-gold flex-shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </SectionContainer>
        )}

        {/* Features Section */}
        <SectionContainer>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Key Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to integrate and scale</p>
          </div>
          
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

        {/* Who Should Use */}
        {whoShouldUse && whoShouldUse.length > 0 && (
          <SectionContainer>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Who Should Use This API?</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {whoShouldUse.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-card border border-border/50 rounded-xl">
                  <Users className="w-5 h-5 text-eko-gold flex-shrink-0" />
                  <span className="text-foreground font-medium">{item}</span>
                </div>
              ))}
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

        {/* Integration Steps */}
        <SectionContainer className="bg-eko-navy">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How to Integrate</h2>
            <p className="text-white/70 max-w-2xl mx-auto">Get started in minutes with our simple integration process</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {integrationSteps.map((step) => (
              <div key={step.step} className="relative p-6 bg-white/5 backdrop-blur border border-white/10 rounded-2xl">
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-eko-gold flex items-center justify-center text-eko-navy font-bold">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 mt-4">{step.title}</h3>
                <p className="text-white/60 text-sm">{step.description}</p>
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
