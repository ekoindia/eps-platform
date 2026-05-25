import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Shield, Clock, Users, Handshake, HeadphonesIcon } from "lucide-react";
import { FadeIn } from "@/components/FadeIn";

const trustPillars = [
  {
    icon: Users,
    value: "Since 2007",
    label: "Powering Bharat's MSMEs",
    description: "Building India's financial infrastructure for micro-entrepreneurs across Tier 2 and beyond",
  },
  {
    icon: Shield,
    value: "RBI Compliant",
    label: "Regulatory adherence",
    description: [
      "KYC & AML/CFT compliant",
      "Data residency: India",
      "Audit & reporting: logs, reconciliation, settlement reports",
    ],
  },
  {
    icon: Handshake,
    value: "50+",
    label: "Banks, AAs & PAs",
    description: "Working with FINO, Airtel Payments Bank, and many more to bring services to Tier 2 and beyond",
  },
  {
    icon: Clock,
    value: "99.9%",
    label: "Platform uptime",
    description: "Enterprise-grade reliability you can count on",
  },
  {
    icon: HeadphonesIcon,
    value: "Dedicated",
    label: "Support & RMs",
    description: "Dedicated Relationship Managers and Customer Support Representatives for every partner",
  },
];

export const WhyEkoSection = () => {
  return (
    <SectionContainer id="why-eko" className="border-b border-border">
      <FadeIn>
        <SectionHeader
          badge="Why Choose Eko"
          title="Built for Developers from Bharat"
          subtitle="Grow Every Entrepreneur Daily — India's most trusted financial infrastructure provider, powering millions of transactions every day."
        />
      </FadeIn>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {trustPillars.map((pillar, index) => (
          <FadeIn
            key={pillar.label}
            delay={index * 100}
            className="group text-center p-6 rounded-2xl bg-card border border-border/50 card-hover"
          >
            <div className="icon-container mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
              <pillar.icon className="w-6 h-6 text-eko-gold" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{pillar.value}</div>
            <div className="text-sm font-medium text-eko-gold mb-3">{pillar.label}</div>
            {Array.isArray(pillar.description) ? (
              <ul className="text-muted-foreground text-sm leading-relaxed flex flex-col gap-1 text-left">
                {pillar.description.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-eko-gold mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">{pillar.description}</p>
            )}
          </FadeIn>
        ))}
      </div>
    </SectionContainer>
  );
};
