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
  },
];

export const CaseStudiesSection = () => {
  return (
    <SectionContainer className="border-b border-border">
      <SectionHeader
        badge="Success Stories"
        title="Real Impact, Real Results"
        subtitle="See how businesses are transforming their operations with Eko's infrastructure."
      />

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {caseStudies.map((study) => (
          <div 
            key={study.title}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 card-hover"
          >
            {/* Gradient Top */}
            <div className={`h-32 bg-gradient-to-br ${study.gradient}`} />
            
            {/* Content */}
            <div className="p-6 -mt-8 relative">
              <span className="inline-block px-3 py-1 rounded-full bg-background text-xs font-medium text-eko-gold border border-border mb-4">
                {study.category}
              </span>
              <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-eko-gold transition-colors">
                {study.title}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                {study.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <div className="text-xs text-muted-foreground">Result</div>
                  <div className="font-semibold text-foreground">{study.result}</div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-eko-gold opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <Button variant="navy-outline" size="lg">
          View All Case Studies
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </SectionContainer>
  );
};
