import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/config/site";
import { HeroSection } from "@/components/sections/HeroSection";
import { WhyEkoSection } from "@/components/sections/WhyEkoSection";
import { ProductsSection } from "@/components/sections/ProductsSection";
import { DeveloperSection } from "@/components/sections/DeveloperSection";
import { UseCasesSection } from "@/components/sections/UseCasesSection";
import { ComplianceSection } from "@/components/sections/ComplianceSection";

import { LeadCaptureSection } from "@/components/sections/LeadCaptureSection";
import { CTASection } from "@/components/sections/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <link rel="canonical" href={SITE_URL} />
      </Helmet>
      <Header />
      
      <main>
        <HeroSection />
        <WhyEkoSection />
        <ProductsSection />
        <DeveloperSection />
        <UseCasesSection />
        <ComplianceSection />
        
        <LeadCaptureSection />
        <CTASection />
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
