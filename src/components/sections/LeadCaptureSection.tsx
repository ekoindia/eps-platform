import { SectionContainer } from "@/components/SectionContainer";

export const LeadCaptureSection = () => {


  return (
    <SectionContainer variant="muted" id="contact">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Content */}
        <div>
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-eko-gold-light text-eko-navy">
            Get in Touch
          </span>
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
              "Custom pricing for enterprise needs",
              "Sandbox access for testing"
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

        {/* Right: Form */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
          <div className="relative bg-card border border-border/50 rounded-2xl p-6 lg:p-8 shadow-xl overflow-hidden">
            <h3 className="text-xl font-semibold text-foreground mb-4">Get Started with Eko Platform Services</h3>
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
    </SectionContainer>
  );
};
