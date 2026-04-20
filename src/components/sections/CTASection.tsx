import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";
import { SALES_MOBILE } from "@/lib/config/site";
import { formatMobile } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-form";

export const CTASection = () => {
  const handleChat = () => {
    openZohoChat();
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
          Join thousands of MSMEs using Eko's infrastructure to power their financial operations.
          Get started in minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="gold" size="xl" className="group" onClick={handleChat}>
            <MessageCircle className="w-5 h-5" />
            Chat with Us
          </Button>
          <Button variant="hero-outline" size="xl" asChild>
            <a href={`tel:+91${SALES_MOBILE}`}>
              <Phone className="w-5 h-5" />
              Call {formatMobile(SALES_MOBILE)}
            </a>
          </Button>
        </div>
      </div>
    </SectionContainer>
  );
};
