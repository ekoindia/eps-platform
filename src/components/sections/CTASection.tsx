import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";

export const CTASection = () => {
  const handleGetStarted = () => {
    window.dispatchEvent(new CustomEvent("open-get-started"));
  };

  return (
    <SectionContainer variant="navy" className="relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-eko-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-eko-gold/5 rounded-full blur-3xl" />

      <div className="relative text-center max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
          Build with Eko Today
        </h2>
        <p className="text-lg md:text-xl text-white/80 mb-10 leading-relaxed">
          Join thousands of businesses using Eko's infrastructure to power their financial operations. 
          Get started in minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="gold" size="xl" className="group" onClick={handleGetStarted}>
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button variant="hero-outline" size="xl" onClick={() => window.dispatchEvent(new CustomEvent("open-talk-to-sales"))}>
            <MessageCircle className="w-5 h-5" />
            Talk to Sales
          </Button>
        </div>
      </div>
    </SectionContainer>
  );
};
