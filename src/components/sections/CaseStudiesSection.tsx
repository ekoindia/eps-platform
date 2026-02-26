import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const caseStudies = [
{
  category: "Payments",
  title: "Scaling DMT with Eko APIs",
  description: "How a leading fintech processed 10M+ monthly transactions with 99.9% success rate.",
  result: "10M+ transactions/month",
  gradient: "from-blue-500/20 to-purple-500/20"
},
{
  category: "Verification",
  title: "Automating KYC with Eko Shield",
  description: "A digital lending platform reduced customer onboarding time from days to minutes.",
  result: "95% faster onboarding",
  gradient: "from-orange-500/20 to-red-500/20"
},
{
  category: "Platform",
  title: "Building Merchant Networks with Ekonic",
  description: "A banking correspondent scaled to 50,000+ retail points using Ekonic platform.",
  result: "50,000+ retail points",
  gradient: "from-green-500/20 to-teal-500/20"
}];


export const CaseStudiesSection = () => {
  return (
    <SectionContainer className="border-b border-border">
      <SectionHeader
        badge="Success Stories"
        title="Real Impact, Real Results"
        subtitle="See how businesses are transforming their operations with Eko's infrastructure." />


      































      <div className="text-center mt-10">
        <Button variant="navy-outline" size="lg">
          View All Case Studies
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </SectionContainer>);

};