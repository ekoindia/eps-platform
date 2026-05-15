import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { CodeBlock, exampleApiCode } from "@/components/CodeBlock";
import { openZohoChat } from "@/lib/zoho-chat";
import heroImage from "@/assets/hero-network.jpg";
import { FadeIn } from "@/components/FadeIn";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          fetchPriority="high"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 hero-gradient opacity-95" />
        <div className="absolute inset-0 hero-pattern" />
      </div>

      {/* Floating Elements */}
      <div className="absolute top-1/4 left-10 w-64 h-64 bg-eko-gold/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-eko-gold/5 rounded-full blur-3xl animate-float animation-delay-200" />

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className="text-center lg:text-left">
            <FadeIn onView={false} delay={100} className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm mb-6">
                <span className="w-2 h-2 rounded-full bg-eko-gold animate-pulse-soft" />
                <span className="text-white/80 text-sm font-medium">Trusted by 50,000+ businesses</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6">
                APIs & Platform for MSMEs to Scale Their{" "}
                <span className="text-gradient-gold">Business</span>{" "}
                Everyday
              </h1>
            </FadeIn>

            <FadeIn onView={false} delay={200}>
              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                BC, Identity, Payment & Collection solutions & APIs for MSMEs
                to scale their business across Tier-2 and beyond.
              </p>
            </FadeIn>

            <FadeIn onView={false} delay={300}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  id="btn-explore-apis-section-hero"
                  variant="gold" size="xl" className="group" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>
                  Explore APIs
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  id="btn-chat-section-hero"
                  variant="hero-outline" size="xl" onClick={() => openZohoChat()}>
                  Talk to Sales
                </Button>
              </div>
            </FadeIn>

            {/* Trust Badges */}
            <FadeIn onView={false} delay={400}>
              <div className="mt-12 flex flex-wrap items-center gap-6 justify-center lg:justify-start">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>RBI Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Right: Code Preview */}
          <FadeIn onView={false} delay={500} className="hidden lg:block">
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-eko-gold/10 rounded-2xl blur-2xl" />

              <CodeBlock
                code={exampleApiCode}
                fileName="verify.js"
                className="relative"
              />

              {/* Floating Badge */}
              <div className="absolute -bottom-4 -right-4 bg-card rounded-xl p-4 shadow-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-eko-gold-light flex items-center justify-center">
                  <svg className="w-5 h-5 text-eko-gold" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Verified</div>
                  <div className="text-xs text-eko-slate">PAN: ABCDE1234F</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};
