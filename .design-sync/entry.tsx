// design-sync bundle entry (synth-from-src): re-exports exactly the branded
// component set + the preview provider into window.EkoDS. Narrow on purpose —
// keeps the IIFE small and the surface curated (no app chrome / infra leaks).
export { DSProvider } from "./provider";

export { EkoLogo } from "@/components/EkoLogo";
export { FeatureCard, ProductCard, StatCard, UseCaseCard } from "@/components/Cards";
export { IndustryCard } from "@/components/IndustryCard";
export { SolutionCard } from "@/components/SolutionCard";
export { SectionContainer, SectionHeader } from "@/components/SectionContainer";
export { ApiChip } from "@/components/ApiChip";
export { CodeBlock } from "@/components/CodeBlock";
export { DropdownGrid, MenuItemLink, DropdownColumnHeader } from "@/components/DropdownGrid";
export { default as Picture } from "@/components/Picture";
export { BreadcrumbNav } from "@/components/BreadcrumbNav";

// Page layout surfaces (route-composition; ship functional, floor-carded).
export { IndustryPageLayout } from "@/components/IndustryPageLayout";
export { ProductPageLayout } from "@/components/ProductPageLayout";
export { SolutionPageLayout } from "@/components/SolutionPageLayout";
export { default as LegalPageLayout, SectionHeading, SectionDivider } from "@/components/LegalPageLayout";

// Branded sections.
export { HeroSection } from "@/components/sections/HeroSection";
export { PageHero } from "@/components/sections/PageHero";
export { CTASection } from "@/components/sections/CTASection";
export { WhyEkoSection } from "@/components/sections/WhyEkoSection";
export { TrustStrip } from "@/components/sections/TrustStrip";
export { ComplianceSection } from "@/components/sections/ComplianceSection";
export { CaseStudiesSection } from "@/components/sections/CaseStudiesSection";
export { DeveloperSection } from "@/components/sections/DeveloperSection";
export { FaqSection } from "@/components/sections/FaqSection";
export { IntegrationStepperSection } from "@/components/sections/IntegrationStepperSection";
export { LeadCaptureSection } from "@/components/sections/LeadCaptureSection";
export { LeadFormCTASection } from "@/components/sections/LeadFormCTASection";
export { ProductsSection } from "@/components/sections/ProductsSection";
export { UseCasesSection } from "@/components/sections/UseCasesSection";

// Pricing (representative branded views; deep internal rows omitted).
export { PricingTable } from "@/components/pricing/PricingTable";
export { PricingTabs } from "@/components/pricing/PricingTabs";
export { PricingCalculator } from "@/components/pricing/PricingCalculator";
export { ApiPicker } from "@/components/pricing/ApiPicker";
export { QuoteSummary } from "@/components/pricing/QuoteSummary";
