import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";
import { SALES_MOBILE } from "@/lib/config/site";
import { formatMobile } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-form";

export const LeadCaptureSection = () => {
  const handleChat = () => {
    openZohoChat();
  };

  return (
    <SectionContainer variant="muted" id="contact">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Content */}
        <div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Whether you're looking to integrate our APIs or explore our platform solutions,
            our team is here to help you find the right fit.
          </p>

          <div className="space-y-4">
            {[
              "Personalized demo of our products",
              "Technical consultation for integration",
              "Custom pricing basis needs of MSMEs",
              "Sandbox access for testing",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-eko-gold/20 flex items-center justify-center flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-eko-gold" />
                </span>
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Chat & Call CTAs */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
          <div className="relative bg-card border border-border/50 rounded-2xl p-8 lg:p-10 shadow-xl">
            <h3 className="text-xl font-semibold text-foreground mb-2">Get Started with Eko Platform Services</h3>
            <p className="text-muted-foreground mb-8">Reach out to us and our team will get back to you within 24 hours.</p>

            <div className="space-y-4">
              <Button
                id="btn-chat-section-lead-capture"
                variant="gold" size="xl" className="w-full group" onClick={handleChat}>
                <MessageCircle className="w-5 h-5" />
                Chat with Us
              </Button>
              <Button variant="navy-outline" size="xl" className="w-full" asChild>
                <a
                  id="lnk-sales-phone-section-lead-capture"
                  href={`tel:+91${SALES_MOBILE}`}>
                  <Phone className="w-5 h-5" />
                  Call {formatMobile(SALES_MOBILE)}
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              Available Monday to Saturday, 9 AM – 7 PM IST
            </p>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
};
