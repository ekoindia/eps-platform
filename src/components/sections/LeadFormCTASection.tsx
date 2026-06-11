import { FadeIn } from "@/components/FadeIn";
import { SectionContainer } from "@/components/SectionContainer";
import { ZohoSignupForm } from "@/components/ZohoSignupForm";
import { CheckCircle } from "lucide-react";

const DEFAULT_BULLETS = [
  "Sandbox access in minutes",
  "Dedicated integration support",
  "Comprehensive documentation",
  "Reliable, high-volume workflows",
];

interface LeadFormCTASectionProps {
  heading?: string;
  /** Title shown on the signup form card header. */
  formTitle?: string;
  description?: string;
  bullets?: string[];
  id?: string;
}

/**
 * Shared bottom call-to-action section with a benefits list and an embedded
 * Zoho signup form. Used by the product, industry and solution page layouts.
 */
export const LeadFormCTASection = ({
  heading = "Get API Access Now",
  formTitle = "Get API Access",
  description = "Sign up now and start integrating in minutes. Our team will help you go live quickly.",
  bullets = DEFAULT_BULLETS,
  id = "lead-form",
}: LeadFormCTASectionProps) => {
  return (
    <SectionContainer
      variant="navy"
      id={id}
      className="relative overflow-hidden"
    >
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-eko-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-eko-gold/5 rounded-full blur-3xl" />
      <div className="relative grid lg:grid-cols-2 gap-12 items-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {heading}
          </h2>
          <p className="text-white/70 text-lg mb-6 leading-relaxed">
            {description}
          </p>
          <ul className="flex flex-col gap-3">
            {bullets.map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/80">
                <CheckCircle className="w-5 h-5 text-eko-gold shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={200} className="relative">
          <div className="absolute -inset-3 bg-eko-gold/10 rounded-2xl blur-2xl" />
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-eko-navy px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">{formTitle}</h3>
              <p className="text-white/70 text-sm">Get started in 10 minutes</p>
            </div>
            <ZohoSignupForm />
          </div>
        </FadeIn>
      </div>
    </SectionContainer>
  );
};
