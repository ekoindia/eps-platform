import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Shield, Clock, Users, Server } from "lucide-react";

const trustPillars = [
  {
    icon: Users,
    value: "Since 2008",
    label: "Trusted by businesses",
    description: "Building India's financial infrastructure for over 15 years"
  },
  {
    icon: Shield,
    value: "RBI Compliant",
    label: "Regulatory adherence",
    description: "Fully compliant with Reserve Bank of India guidelines"
  },
  {
    icon: Clock,
    value: "99.9%",
    label: "Platform uptime",
    description: "Enterprise-grade reliability you can count on"
  },
  {
    icon: Server,
    value: "Scalable",
    label: "Enterprise APIs",
    description: "Built for banks, fintechs, and large enterprises"
  }
];

export const WhyEkoSection = () => {
  return (
    <SectionContainer id="why-eko" className="border-b border-border">
      <SectionHeader
        badge="Why Choose Eko"
        title="Built for Enterprise Scale"
        subtitle="India's most trusted financial infrastructure provider, powering millions of transactions every day."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {trustPillars.map((pillar, index) => (
          <div 
            key={pillar.label}
            className="group text-center p-8 rounded-2xl bg-card border border-border/50 card-hover"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="icon-container mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
              <pillar.icon className="w-6 h-6 text-eko-gold" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              {pillar.value}
            </div>
            <div className="text-sm font-medium text-eko-gold mb-3">
              {pillar.label}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>
    </SectionContainer>
  );
};
