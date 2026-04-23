import { Helmet } from "react-helmet-async";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface LegalPageLayoutProps {
  title: string;
  description?: string;
  subtitle?: string;
  breadcrumb?: string;
  children: React.ReactNode;
}

const LegalPageLayout = ({ title, description, subtitle, breadcrumb, children }: LegalPageLayoutProps) => {
  return (
    <>
      <Helmet>
        <title>{title} | Eko</title>
        <meta name="description" content={description || title} />
      </Helmet>

      {/* Hero Section */}
      {(subtitle || breadcrumb) && (
        <section className="relative overflow-hidden bg-eko-navy py-32 lg:py-40">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-eko-gold rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-eko-gold rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-6 text-center relative z-10">
            <div className="max-w-3xl mx-auto">
              {breadcrumb && (
                <span className="inline-block px-4 py-1.5 rounded-full bg-eko-gold/20 text-eko-gold text-sm font-semibold mb-6">
                  {breadcrumb}
                </span>
              )}
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-lg text-white/75 leading-relaxed max-w-2xl mx-auto">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <main className={subtitle || breadcrumb ? "py-16" : "pt-28 pb-16"}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Breadcrumb */}
          {/* {breadcrumb && (
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <Link to="/company" className="hover:text-foreground transition-colors">Company</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground font-medium">{breadcrumb}</span>
            </nav>
          )} */}

          {/* Title for simple layout */}
          {!subtitle && !breadcrumb && (
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">{title}</h1>
          )}

          {/* Content */}
          <div className="space-y-8">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

/* Helper Components */
export const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{children}</h2>
);

export const SectionDivider = () => (
  <hr className="border-t border-border my-8" />
);

export { LegalPageLayout };
export default LegalPageLayout;
