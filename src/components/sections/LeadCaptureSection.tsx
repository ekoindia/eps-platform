import { useState } from "react";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Building, User, Mail, Phone, MessageSquare } from "lucide-react";

export const LeadCaptureSection = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
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
          <form 
            onSubmit={handleSubmit}
            className="relative bg-card border border-border/50 rounded-2xl p-6 lg:p-8 shadow-xl"
          >
            <h3 className="text-xl font-semibold text-foreground mb-6">Request a Demo</h3>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company" className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  Company
                </Label>
                <Input
                  id="company"
                  placeholder="Your company name"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  Message (Optional)
                </Label>
                <textarea
                  id="message"
                  placeholder="Tell us about your requirements..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>
              
              <Button type="submit" variant="gold" size="lg" className="w-full">
                Submit Request
                <ArrowRight className="w-4 h-4" />
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </form>
        </div>
      </div>
    </SectionContainer>
  );
};
