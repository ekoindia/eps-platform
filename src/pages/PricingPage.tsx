import { AiHint } from "@/components/AiHint";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import { PricingTable } from "@/components/pricing/PricingTable";
import {
  SectionContainer,
  SectionHeader,
} from "@/components/SectionContainer";
import { FaqSection } from "@/components/sections/FaqSection";
import { LeadFormCTASection } from "@/components/sections/LeadFormCTASection";
import { PageHero } from "@/components/sections/PageHero";
import { SITE_URL } from "@/lib/config/site";
import {
  HAS_VOLUME_DISCOUNTS,
  PRICING_FAQS,
  SETUP_FEE_WAIVED,
} from "@/lib/data/api-pricing";
import { generatePricingJsonLd } from "@/lib/utils/json-ld";
import {
  BadgeCheck,
  IndianRupee,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

const TRUST_CHIPS = [
  { icon: IndianRupee, label: "Per-transaction billing" },
  { icon: Zap, label: "No monthly minimums" },
  ...(HAS_VOLUME_DISCOUNTS
    ? [{ icon: TrendingDown, label: "Volume discounts" }]
    : []),
  { icon: BadgeCheck, label: "Only successful calls billed" },
];

const PricingPage = () => {
  const jsonLdSchemas = generatePricingJsonLd(PRICING_FAQS);

  return (
    <>
      <Helmet>
        <title>Verification API Pricing & Calculator | Eko Platform Services</title>
        <meta
          name="description"
          content="Transparent pay-per-use pricing for PAN, Aadhaar, bank account, GST, UPI and 25+ verification APIs. Estimate your monthly cost with our interactive pricing calculator."
        />
        <meta
          name="keywords"
          content="verification API pricing, PAN verification API price, bank account verification API cost, KYC API pricing India, identity verification API rates"
        />
        <link rel="canonical" href={`${SITE_URL}/pricing`} />
        <link rel="alternate" type="text/markdown" href={`${SITE_URL}/pricing.md`} />
        {jsonLdSchemas.map((schema, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(schema)}
          </script>
        ))}
      </Helmet>

      <AiHint mdPath="/pricing.md" />

      <div className="min-h-screen bg-background">
        {/* pb keeps the mobile sticky summary bar from covering the footer */}
        <main className="pb-16 lg:pb-0">
          {/* Hero */}
          <PageHero className="pb-16">
            <BreadcrumbNav
              crumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
            />
            <FadeIn onView={false} delay={100} className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
                Transparent, pay-per-use API pricing
              </h1>
              <p className="text-xl text-white/70 max-w-2xl mx-auto mb-8">
                {SETUP_FEE_WAIVED
                  ? "Setup fee waived for a limited time. No monthly minimums. Pay only for successful verifications."
                  : "No monthly minimums. Pay only for successful verifications."}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {SETUP_FEE_WAIVED && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-eko-gold/20 border border-eko-gold/40 text-sm font-semibold text-eko-gold">
                    <Sparkles className="w-4 h-4" />
                    ₹0 setup fee — limited-time offer
                  </span>
                )}
                {TRUST_CHIPS.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-white/90"
                  >
                    <chip.icon className="w-4 h-4 text-eko-gold" />
                    {chip.label}
                  </span>
                ))}
              </div>
            </FadeIn>
          </PageHero>

          {/* Calculator */}
          <SectionContainer id="calculator" className="scroll-mt-24">
            <SectionHeader
              badge="Pricing Calculator"
              title="Estimate your monthly cost"
              subtitle="Pick the APIs you need, set your monthly volumes, and see your cost instantly."
            />
            <PricingCalculator />
          </SectionContainer>

          {/* Full rate card */}
          <SectionContainer variant="muted" id="rate-card">
            <SectionHeader
              title="Full rate card"
              subtitle="Every verification API at a glance — per transaction, exclusive of GST @ 18%."
            />
            <PricingTable />
          </SectionContainer>

          {/* FAQ */}
          <FaqSection faqs={PRICING_FAQS} variant="default" />

          {/* Bottom CTA */}
          <LeadFormCTASection
            heading="Start verifying today"
            formTitle="Get API Access"
            description="Sign up now, test in the free sandbox, and go live in days — not weeks."
          />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default PricingPage;
