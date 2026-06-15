import { AiHint } from "@/components/AiHint";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import { ConnectedBankingCalculator } from "@/components/pricing/banking/ConnectedBankingCalculator";
import { PaymentsCalculator } from "@/components/pricing/payments/PaymentsCalculator";
import { PaymentsRateTable } from "@/components/pricing/payments/PaymentsRateTable";
import { PricingCalculator } from "@/components/pricing/PricingCalculator";
import { PricingTable } from "@/components/pricing/PricingTable";
import { PricingTabs } from "@/components/pricing/PricingTabs";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { FaqSection } from "@/components/sections/FaqSection";
import { LeadFormCTASection } from "@/components/sections/LeadFormCTASection";
import { PageHero } from "@/components/sections/PageHero";
import { SITE_URL } from "@/lib/config/site";
import {
	HAS_VOLUME_DISCOUNTS,
	PRICING_FAQS,
	SETUP_FEE_WAIVED,
} from "@/lib/data/api-pricing";
import { CB_FAQS } from "@/lib/data/connected-banking-pricing";
import { PAYMENTS_FAQS } from "@/lib/data/payments-pricing";
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

/** All pricing FAQs — verification, payments & BC, connected banking */
const ALL_FAQS = [...PRICING_FAQS, ...PAYMENTS_FAQS, ...CB_FAQS];

const PricingPage = () => {
	const jsonLdSchemas = generatePricingJsonLd(ALL_FAQS);

	return (
		<>
			<Helmet>
				<title>
					API Pricing & Commissions Calculator | Eko Platform Services
				</title>
				<meta
					name="description"
					content="Transparent pricing for 25+ verification APIs, partner commissions for DMT, AePS and BBPS, and Connected Banking charges. Estimate your monthly cost or earnings with our interactive calculators."
				/>
				<link rel="canonical" href={`${SITE_URL}/pricing`} />
				<link
					rel="alternate"
					type="text/markdown"
					href={`${SITE_URL}/pricing.md`}
				/>
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
								Transparent API pricing & partner commissions
							</h1>
							<p className="text-xl text-white/70 max-w-2xl mx-auto mb-8">
								{SETUP_FEE_WAIVED
									? "Pay per use for verification APIs — setup fee waived for a limited time. Earn commission on every DMT, AePS and BBPS transaction."
									: "Pay per use for verification APIs. Earn commission on every DMT, AePS and BBPS transaction."}
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

					<PricingTabs
						verification={
							<>
								{/* Calculator */}
								<SectionContainer
									id="calculator"
									className="scroll-mt-24 pt-10 lg:pt-14"
								>
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
							</>
						}
						payments={
							<>
								{/* Earnings calculator */}
								<SectionContainer
									id="payments-calculator"
									className="scroll-mt-24 pt-10 lg:pt-14"
								>
									<SectionHeader
										badge="Earnings Calculator"
										title="Estimate your monthly earnings"
										subtitle="DMT, AePS and BBPS pay you a commission per transaction. Set your volumes and average amounts to see your estimated monthly earnings."
									/>
									<PaymentsCalculator />
								</SectionContainer>

								{/* Commission rate card */}
								<SectionContainer variant="muted" id="payments-rates">
									<SectionHeader
										title="Commission rate card"
										subtitle="DMT, AePS and BBPS commissions at a glance — per transaction, exclusive of GST @ 18%."
									/>
									<PaymentsRateTable />
								</SectionContainer>
							</>
						}
						banking={
							<SectionContainer
								id="banking-calculator"
								className="scroll-mt-24 pt-10 lg:pt-14"
							>
								<SectionHeader
									badge="Connected Banking"
									title="Virtual accounts & BaaS pricing"
									subtitle="One-time setup per bank per user, plus simple per-transaction charges."
								/>
								<ConnectedBankingCalculator />
							</SectionContainer>
						}
					/>

					{/* FAQ — shared across tabs (matches the FAQPage JSON-LD) */}
					<FaqSection faqs={ALL_FAQS} variant="default" />

					{/* Bottom CTA */}
					<LeadFormCTASection
						heading="Start building today"
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
