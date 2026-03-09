import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { UseCaseCard } from "@/components/Cards";
import { 
  Store, 
  Smartphone, 
  CreditCard, 
  Plane, 
  Building, 
  Users 
} from "lucide-react";

const useCases = [
  {
    icon: Store,
    title: "Kirana & Retail Stores",
    description: "Offer banking services like money transfer, bill payments, and Aadhaar withdrawals right from your shop counter."
  },
  {
    icon: Users,
    title: "CSP / BC Agents",
    description: "Become a banking point for your community with AePS, DMT, and bill collection services powered by Eko APIs."
  },
  {
    icon: Building,
    title: "Small NBFCs & MFIs",
    description: "Automate KYC verification, enable loan disbursements via UPI payouts, and collect repayments digitally."
  },
  {
    icon: Smartphone,
    title: "Micro-Fintech Builders",
    description: "Launch your own fintech product with ready-to-use BC, payment, and verification APIs. Focus on growth, not infrastructure."
  },
  {
    icon: Plane,
    title: "Travel Agents & Distributors",
    description: "Launch your own Travel portal with a ready-to-use Platform for all travel booking need Like Hotel, Fights, Bus and Train."
  },
  {
    icon: CreditCard,
    title: "Payment Service Providers",
    description: "Offer comprehensive payment and collection solutions to your merchant network with our white-label APIs."
  },
];

export const UseCasesSection = () => {
  return (
    <SectionContainer id="use-cases">
      <SectionHeader
        badge="Use Cases"
        title="Built for Bharat's Entrepreneurs"
        subtitle="From kirana stores to micro-fintech builders — Eko powers financial operations for MSMEs across Tier 2 and beyond."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {useCases.map((useCase) => (
          <UseCaseCard 
            key={useCase.title} 
            {...useCase}
          />
        ))}
      </div>
    </SectionContainer>
  );
};
