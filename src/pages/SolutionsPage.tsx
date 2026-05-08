import { Helmet } from "react-helmet-async";
import { Footer } from "@/components/Footer";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { SolutionCard } from "@/components/SolutionCard";
import { ACTIVE_SOLUTIONS_LIST } from "@/lib/data/solutions";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { SITE_URL } from "@/lib/config/site";
import { FadeIn } from "@/components/FadeIn";

const CATEGORY_LABELS: Record<string, string> = {
  "lending-credit": "Lending & Credit",
  "onboarding": "Onboarding",
  "agent-banking": "Agent Banking",
  "hr-workforce": "HR & Workforce",
  "fleet-motor": "Fleet & Motor",
};

const SolutionsPage = () => {
  const categories = [...new Set(ACTIVE_SOLUTIONS_LIST.map((s) => s.category))];

  return (
    <>
      <Helmet>
        <title>Solutions | Eko Platform Services</title>
        <meta name="description" content="Pre-bundled API packs for common business workflows — lending KYC, agent banking, merchant onboarding, fleet compliance, and more. Sandbox in minutes." />
        <link rel="canonical" href={`${SITE_URL}/solutions`} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <main>
          <section className="relative pt-32 pb-16 bg-eko-navy overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
              <div className="text-left">
                <BreadcrumbNav crumbs={[
                  { label: "Home", href: "/" },
                  { label: "Use Cases", href: "/use-cases" },
                  { label: "Solutions" },
                ]} />
              </div>
              <FadeIn onView={false} delay={100} className="text-center">
                <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-white/10 text-white/90">
                  Solutions
                </span>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Pre-bundled API packs</h1>
              </FadeIn>
              <FadeIn onView={false} delay={200} className="text-center">
                <p className="text-xl text-white/70 max-w-2xl mx-auto">
                  Each pack bundles the exact APIs you need for a specific workflow — one integration, one contract, one dashboard.
                </p>
              </FadeIn>
            </div>
          </section>

          {categories.map((cat, i) => (
            <SectionContainer key={cat} variant={i % 2 === 1 ? "muted" : "default"}>
              <SectionHeader title={CATEGORY_LABELS[cat] || cat} />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {ACTIVE_SOLUTIONS_LIST.filter((s) => s.category === cat).map((sol, i) => (
                  <SolutionCard key={sol.slug} solution={sol} delay={i * 100} />
                ))}
              </div>
            </SectionContainer>
          ))}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SolutionsPage;
