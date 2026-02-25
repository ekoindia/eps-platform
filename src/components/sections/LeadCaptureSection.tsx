import { useState } from "react";
import { SectionContainer } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { submitToZoho, validateLeadForm, type LeadFormErrors } from "@/lib/zoho-form";
import { toast } from "sonner";

export const LeadCaptureSection = () => {
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<LeadFormErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLeadForm(formData);
    if (errors) { setFormErrors(errors); return; }
    setFormErrors({});
    setIsSubmitting(true);
    try {
      await submitToZoho(formData, { referrer: "homepage-contact" });
      setFormSubmitted(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          {formSubmitted ? (
            <div className="relative bg-card border border-border/50 rounded-2xl p-6 lg:p-8 shadow-xl text-center py-12">
              <div className="w-14 h-14 rounded-full bg-eko-gold/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-eko-gold" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Thank You!</h3>
              <p className="text-muted-foreground text-sm">Our team will reach out to you within 24 hours.</p>
            </div>
          ) : (
            <form 
              onSubmit={handleSubmit}
              className="relative bg-card border border-border/50 rounded-2xl p-6 lg:p-8 shadow-xl"
            >
              <h3 className="text-xl font-semibold text-foreground mb-6">Request a Demo</h3>
              
              <div className="space-y-5">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors((p) => ({ ...p, name: undefined })); }}
                    required
                    className="mt-1.5"
                  />
                  {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Phone <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex mt-1.5">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter mobile number"
                      value={formData.phone}
                      onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); setFormErrors((p) => ({ ...p, phone: undefined })); }}
                      required
                      maxLength={10}
                      className="rounded-l-none"
                    />
                  </div>
                  {formErrors.phone && <p className="text-xs text-destructive mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFormErrors((p) => ({ ...p, email: undefined })); }}
                    className="mt-1.5"
                  />
                  {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
                </div>
                
                <Button type="submit" variant="gold" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Request <ArrowRight className="w-4 h-4" /></>}
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  By submitting, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </SectionContainer>
  );
};
