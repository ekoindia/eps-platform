import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { IndustryCard } from "@/components/IndustryCard";
import { INDUSTRIES_LIST, INDUSTRY_CATEGORIES } from "@/lib/data/industries";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { SITE_URL } from "@/lib/config/site";

const IndustriesPage = () => {
  return (
    <>
      <Helmet>
        <title>Industries | Eko Platform Services</title>
        <meta name="description" content="Explore Eko's API solutions for every industry — lending, microfinance, insurance, retail, logistics, and more. Find the right stack for your business." />
        <link rel="canonical" href={`${SITE_URL}/industries`} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <section className="relative pt-32 pb-16 bg-eko-navy overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-eko-navy via-eko-navy to-eko-navy-light opacity-90" />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
              <div className="text-left">
                <BreadcrumbNav crumbs={[
                  { label: "Home", href: "/" },
                  { label: "Use Cases", href: "/use-cases" },
                  { label: "Industries" },
                ]} />
              </div>
              <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4 bg-white/10 text-white/90">
                Industries
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Find the right APIs for your industry</h1>
              <p className="text-xl text-white/70 max-w-2xl mx-auto">
                See how businesses in your sector use Eko's APIs to verify, transact, and grow.
              </p>
            </div>
          </section>

          {INDUSTRY_CATEGORIES.map((cat) => (
            <SectionContainer key={cat.key} variant={cat.key === "agent-retail" || cat.key === "workforce-fleet" ? "muted" : "default"}>
              <SectionHeader title={cat.label} />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {cat.industries.map((ind) => (
                  <IndustryCard key={ind.slug} industry={ind} />
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

export default IndustriesPage;
