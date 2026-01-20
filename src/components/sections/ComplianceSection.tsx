import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Shield, Lock, FileCheck, Award } from "lucide-react";

const complianceItems = [
  {
    icon: Shield,
    title: "RBI Authorized",
    description: "Authorized by Reserve Bank of India for payment services and banking correspondent operations."
  },
  {
    icon: Lock,
    title: "ISO 27001 Certified",
    description: "International standard for information security management, ensuring your data is protected."
  },
  {
    icon: FileCheck,
    title: "PCI DSS Compliant",
    description: "Payment Card Industry Data Security Standard compliance for secure card transactions."
  },
  {
    icon: Award,
    title: "SOC 2 Type II",
    description: "Independently audited security controls demonstrating our commitment to data protection."
  },
];

export const ComplianceSection = () => {
  return (
    <SectionContainer variant="navy" id="compliance">
      <SectionHeader
        title="Security & Compliance First"
        subtitle="Enterprise-grade security with complete regulatory compliance. Your data and transactions are always protected."
        light
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {complianceItems.map((item) => (
          <div 
            key={item.title}
            className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-eko-gold/20 flex items-center justify-center mb-5">
              <item.icon className="w-6 h-6 text-eko-gold" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>

      {/* Partner Logos Placeholder */}
      <div className="mt-16 pt-12 border-t border-white/10">
        <p className="text-center text-white/50 text-sm mb-8">Trusted by leading financial institutions</p>
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16 opacity-60">
          {["Partner 1", "Partner 2", "Partner 3", "Partner 4", "Partner 5"].map((partner) => (
            <div key={partner} className="text-white/40 text-lg font-semibold">
              {partner}
            </div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
};
