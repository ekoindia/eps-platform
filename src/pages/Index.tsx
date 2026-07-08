import { AiHint } from "@/components/AiHint";
import { Footer } from "@/components/Footer";
import { ComplianceSection } from "@/components/sections/ComplianceSection";
import { DeveloperSection } from "@/components/sections/DeveloperSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { ProductsSection } from "@/components/sections/ProductsSection";
import { UseCasesSection } from "@/components/sections/UseCasesSection";
import { WhyEkoSection } from "@/components/sections/WhyEkoSection";
import { SITE_URL } from "@/lib/config/site";
import { Helmet } from "react-helmet-async";

import { CTASection } from "@/components/sections/CTASection";

/** Markdown twin of the homepage — advertised so AI agents/LLMs can discover it. */
const MD_PATH = "/index.md";

const Index = () => {
	return (
		<div className="min-h-screen bg-background">
			<Helmet>
				<link rel="canonical" href={SITE_URL} />
				<link
					rel="alternate"
					type="text/markdown"
					title="Markdown version"
					href={MD_PATH}
				/>
			</Helmet>
			<AiHint mdPath={MD_PATH} />

			<main>
				<HeroSection />
				<WhyEkoSection />
				<ProductsSection />
				<DeveloperSection />
				<UseCasesSection />
				<ComplianceSection />
				{/* <LeadCaptureSection /> */}
				<CTASection />
			</main>

			<Footer />
		</div>
	);
};

export default Index;
