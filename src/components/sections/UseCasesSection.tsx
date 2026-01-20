import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { UseCaseCard } from "@/components/Cards";
import { 
  Building2, 
  Smartphone, 
  CreditCard, 
  Plane, 
  Building, 
  ShoppingCart 
} from "lucide-react";

const useCases = [
  {
    icon: Building2,
    title: "Banks & NBFCs",
    description: "Extend reach with agent banking, enable digital payments, and streamline customer onboarding with verified data."
  },
  {
    icon: Smartphone,
    title: "Fintech Startups",
    description: "Launch financial products faster with ready-to-use APIs. Focus on your core product, not infrastructure."
  },
  {
    icon: CreditCard,
    title: "Payment Service Providers",
    description: "Offer comprehensive payment solutions to merchants with our white-label infrastructure."
  },
  {
    icon: Plane,
    title: "Travel & Insurance",
    description: "Verify customer identities seamlessly for bookings, claims processing, and policy issuance."
  },
  {
    icon: Building,
    title: "Enterprises",
    description: "Automate vendor verification, streamline employee onboarding, and manage bulk payouts efficiently."
  },
  {
    icon: ShoppingCart,
    title: "E-commerce & Lending",
    description: "Enable instant credit decisions with real-time verification and secure payment processing."
  },
];

export const UseCasesSection = () => {
  return (
    <SectionContainer id="use-cases">
      <SectionHeader
        badge="Use Cases"
        title="Built for Every Industry"
        subtitle="From startups to enterprises, Eko powers financial operations across sectors."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {useCases.map((useCase, index) => (
          <UseCaseCard 
            key={useCase.title} 
            {...useCase}
          />
        ))}
      </div>
    </SectionContainer>
  );
};
