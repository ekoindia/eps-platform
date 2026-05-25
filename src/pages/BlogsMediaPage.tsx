import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CalendarDays, ExternalLink } from "lucide-react";

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

const pressItems = [
  {
    title: "Eko Platform Services Expands API Suite for NBFCs",
    source: "The Economic Times",
    date: "January 2026",
    url: "#",
  },
  {
    title: "How Eko Is Enabling Financial Inclusion Through Technology",
    source: "YourStory",
    date: "December 2025",
    url: "#",
  },
  {
    title: "Eko Crosses 50 Million Customers Milestone",
    source: "Business Standard",
    date: "November 2025",
    url: "#",
  },
];

const BlogsMediaPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Blogs & Media | Eko Platform Services</title>
        <meta name="description" content="Insights, guides, updates, and media coverage on fintech APIs, payments, KYC verification, and India's financial infrastructure from Eko Platform Services." />
      </Helmet>

      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Blogs & Media</h1>
            <p className="text-lg text-muted-foreground">
              Insights, developer guides, updates, and media coverage from the Eko Platform Services team.
            </p>
          </div>

          {/* Blog Posts */}
          <div className="max-w-5xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-foreground mb-6">Blog</h2>
            <div className="grid gap-6 md:grid-cols-2">
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
          </div>

          {/* Press / Media */}
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground mb-6">Press & Media</h2>
            <div className="space-y-4">
              {pressItems.map((item) => (
                <a key={item.title} href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <CardDescription className="mt-1">{item.source}</CardDescription>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="w-4 h-4" />
                        {item.date}
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>

            <div className="text-center mt-8">
              <p className="text-muted-foreground mb-2">For media inquiries, contact us at</p>
              <a href="mailto:info@eko.in" className="text-primary font-medium hover:underline cursor-pointer">info@eko.in</a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogsMediaPage;
