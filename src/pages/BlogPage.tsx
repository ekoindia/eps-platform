import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const blogPosts = [
  {
    title: "How Fintech APIs Are Transforming Rural Banking in India",
    description: "Discover how API-driven financial services are bridging the banking gap for underserved communities across India.",
    date: "February 20, 2026",
    category: "Industry Insights",
  },
  {
    title: "A Developer's Guide to Aadhaar-Based eKYC Verification",
    description: "Step-by-step walkthrough of integrating Aadhaar verification APIs into your fintech application.",
    date: "February 10, 2026",
    category: "Developer Guide",
  },
  {
    title: "UPI Payouts at Scale: Best Practices for Enterprises",
    description: "Learn how to handle high-volume UPI disbursements reliably with Eko's Payout APIs.",
    date: "January 28, 2026",
    category: "Product",
  },
  {
    title: "Compliance-First API Design: Why It Matters for Indian Fintech",
    description: "Understanding RBI guidelines and how Eko ensures every API meets regulatory standards.",
    date: "January 15, 2026",
    category: "Compliance",
  },
];

const BlogPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Blog | Eko Platform Services</title>
        <meta name="description" content="Insights, guides, and updates on fintech APIs, payments, KYC verification, and India's financial infrastructure from Eko Platform Services." />
      </Helmet>
      <Header />

      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Blog</h1>
            <p className="text-lg text-muted-foreground">
              Insights, developer guides, and updates from the Eko Platform Services team.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            {blogPosts.map((post) => (
              <Card key={post.title} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">{post.category}</span>
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                  <CardDescription>{post.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-4 h-4" />
                    {post.date}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground">More articles coming soon. Stay tuned!</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPage;
