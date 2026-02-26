import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ExternalLink, CalendarDays } from "lucide-react";

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

const PressPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Press & Media | Eko Platform Services</title>
        <meta name="description" content="Latest news, press releases, and media coverage about Eko Platform Services and India's fintech infrastructure." />
      </Helmet>
      <Header />

      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Press & Media</h1>
            <p className="text-lg text-muted-foreground">
              News, press releases, and media coverage about Eko Platform Services.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {pressItems.map((item) => (
              <a key={item.title} href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription className="mt-1">{item.source}</CardDescription>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
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

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-2">For media inquiries, contact us at</p>
            <a href="mailto:info@eko.in" className="text-primary font-medium hover:underline cursor-pointer">info@eko.in</a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PressPage;
