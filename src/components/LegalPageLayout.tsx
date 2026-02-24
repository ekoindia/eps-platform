import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface LegalPageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const LegalPageLayout = ({ title, description, children }: LegalPageLayoutProps) => {
  return (
    <>
      <Helmet>
        <title>{title} | Eko</title>
        <meta name="description" content={description} />
      </Helmet>
      <Header />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">{title}</h1>
          <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-eko-gold prose-a:no-underline hover:prose-a:underline">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default LegalPageLayout;
