import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Handshake, ShoppingBag, Lightbulb, Shield, Heart, Zap, Lock, Star, UserCheck, Swords, Target, Quote } from "lucide-react";
import { FadeIn } from "@/components/FadeIn";

const roles = [
  { title: "Influencers", description: "Helping customers choose the right product or service.", icon: Users, gradient: "from-eko-gold-light to-eko-gold-light/20" },
  { title: "Facilitators", description: "Assisting customers with onboarding, documentation and transactions.", icon: Handshake, gradient: "from-secondary to-secondary/30" },
  { title: "Resellers", description: "Offering products and services while earning commissions.", icon: ShoppingBag, gradient: "from-accent/10 to-accent/5" },
];

const values = [  { name: "Curiosity", synonyms: ["जिज्ञासा", "ఆసక్తి", "जिज्ञासा", "কৌতূহল", "تجسس"], icon: Lightbulb, color: "text-eko-gold", bg: "bg-eko-gold-light", body: "Curiosity drives innovation at Eko. We constantly question existing systems and explore better ways to solve problems — understanding how people actually use financial services, studying local behaviours, experimenting with new ideas, and learning continuously from customers, partners and entrepreneurs." },
  { name: "Resilience", synonyms: ["लचीलापन", "స్థైర్యం", "चिकाटी", "স্থিতিস্থাপকতা", "استقامت"], icon: Shield, color: "text-eko-navy", bg: "bg-secondary", body: "Creating meaningful financial inclusion takes patience and persistence. We stay committed to our mission even when challenges arise, continuously improve our systems, learn from failures, and build durable platforms that scale over time." },
  { name: "Empathy", synonyms: ["सहानुभूति", "సహానుభూతి", "सहानुभूती", "সহানুভূতি", "ہمدردی"], icon: Heart, color: "text-destructive", bg: "bg-destructive/10", body: "Our technology serves entrepreneurs and customers across diverse communities. Empathy helps us design tools that are simple and practical, build products that respect people's time and trust, and create systems that work for everyone — not just the digitally fluent." },
  { name: "Agility", synonyms: ["फुर्ती", "చురుకుదనం", "चपळता", "द्रुतता", "پھرتی"], icon: Zap, color: "text-eko-gold", bg: "bg-eko-gold-light", body: "The financial ecosystem is constantly evolving. Agility means iterating rapidly on products, adapting to regulatory and market changes, collaborating across teams, and making decisions with speed and clarity." },
  { name: "Trust", synonyms: ["विश्वास", "విశ్వాసం", "विश्वास", "বিশ্বাস", "اعتماد"], icon: Lock, color: "text-eko-navy", bg: "bg-secondary", body: "Trust is the foundation of financial services. We build trust by maintaining strong compliance and security standards, designing transparent systems, delivering consistent platform performance, and building long-term relationships with communities and institutions." },
  { name: "Excellence", synonyms: ["उत्कृष्टता", "శ్రేష్ఠత", "उत्कृष्टता", "উৎকর্ษতা", "اتکرجتا"], icon: Star, color: "text-eko-gold", bg: "bg-eko-gold-light", body: "Excellence means striving to be the best version of ourselves in everything we do — setting ambitious goals, surpassing ordinary standards, continuously improving our work, and delivering quality and impact every time." },
  { name: "Ownership", synonyms: ["जिम्मेदारी", "బాధ్యత", "जबाबदारी", "দায়িত্ব", "ذمہ داری"], icon: UserCheck, color: "text-eko-navy", bg: "bg-secondary", body: "Ownership means we take responsibility not just for tasks, but for results. We act like builders, not operators — solving problems end-to-end, taking initiative, and being accountable for the impact of our work." },
  { name: "Courage", synonyms: ["साहस", "ధైర్యం", "धैर्य", "সাहस", "ہمت"], icon: Swords, color: "text-destructive", bg: "bg-destructive/10", body: "Courage means doing what is right even when it is difficult. At Eko, courage is about speaking up, sharing honest perspectives and taking decisions in the face of uncertainty. As Churchill said: \"Courage is what it takes to stand up and speak; courage is also what it takes to sit down and listen.\"" },
];

const AboutPage = () => {
  return (
    <>
      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden bg-eko-navy py-24 lg:py-32">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-eko-gold rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-eko-gold rounded-full blur-3xl" />
          </div>
          <FadeIn onView={false} className="container mx-auto px-6 text-center max-w-3xl relative z-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-eko-gold/20 text-eko-gold text-sm font-semibold mb-6">
              About Eko
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Building the infrastructure for community-powered finance
            </h1>
            <p className="text-lg text-white/75 leading-relaxed max-w-2xl mx-auto">
              Eko is a financial technology platform helping brands, banks, and fintech companies reach customers through trusted micro-entrepreneurs embedded in their communities across Bharat.
            </p>
          </FadeIn>
        </section>

        {/* Body Intro */}
        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-6 max-w-3xl space-y-5">
            {[
              "Across Bharat, millions of people prefer accessing financial services through someone they trust — their neighbourhood shopkeeper, a local entrepreneur, or a community agent who understands their needs and aspirations. Eko enables this ecosystem.",
              "Through a combination of distribution infrastructure, fintech APIs, and simple digital tools, we connect institutions with a vast network of micro-entrepreneurs — many of them women — who bring financial services closer to their communities.",
              "Today, Eko powers a nationwide network serving tens of millions of customers across thousands of towns and villages, enabling banking services, digital transactions, and financial products through entrepreneurs deeply embedded in local markets.",
            ].map((text, i) => (
              <FadeIn
                key={i}
                as="p"
                delay={i * 100}
                className="text-muted-foreground leading-relaxed text-base text-justify"
              >
                {text}
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Mission Quote */}
        <section className="pb-10 lg:pb-12">
          <FadeIn className="container mx-auto px-0 max-w-3xl">
            <div className="relative">
              <Quote strokeWidth={0} className="absolute -top-4 -left-2 w-20 h-20 lg:w-28 lg:h-28 text-eko-gold/15 pointer-events-none" fill="currentColor" style={{ transform: 'scaleX(-1) translateX(30%) translateY(-0%)' }} />
              <blockquote className="text-2xl lg:text-2xl font-bold text-foreground opacity-80 text-justify leading-relaxed italic rounded-lg p-8 relative z-10">
                Eko's mission is to provide Distribution as a Service for brands to reach the next billion customers through deeply embedded-in-the-community micro-entrepreneurs as influencers, facilitators and resellers. We use simple digital tools to help these entrepreneurs earn more, get fair access to capital and run & grow their businesses better every day.
              </blockquote>
            </div>
          </FadeIn>
        </section>

        {/* Our Mission */}
        <section className="py-16 lg:py-20 bg-gradient-to-br from-secondary via-muted/40 to-secondary/50">
          <FadeIn className="container mx-auto px-6 max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-eko-navy flex items-center justify-center">
                <Target className="w-6 h-6 text-eko-gold" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Expanding access to opportunity</h2>
            </div>
            <div className="space-y-5 text-muted-foreground leading-relaxed text-justify">
              <p>Our mission is to help brands reach the next billion customers through trusted community entrepreneurs — while empowering those entrepreneurs to grow sustainable businesses.</p>
              <p>We do this by building <span className="font-semibold text-foreground">Distribution-as-a-Service</span>, a platform that connects institutions with local micro-entrepreneurs who serve as trusted access points for financial services.</p>
              <p>Through simple digital tools, these entrepreneurs can serve customers, earn more and build a stronger economic future for themselves and their communities.</p>
              <p className="border-l-4 border-eko-gold pl-4 italic text-foreground/80">
                In short, Eko connects brands, entrepreneurs and customers — creating a financial ecosystem that is more inclusive, accessible and scalable.
              </p>
            </div>
          </FadeIn>
        </section>

        {/* What This Means in Practice */}
        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-6 max-w-4xl">
            <FadeIn>
              <h2 className="text-3xl font-bold text-foreground mb-4 text-center">What This Means in Practice</h2>
              <p className="text-muted-foreground leading-relaxed mb-12 text-justify max-w-2xl mx-auto">
                Many institutions struggle to reach customers beyond large cities. Building physical networks is expensive and difficult. Eko solves this by enabling brands to work with trusted local entrepreneurs who already serve their communities.
              </p>
            </FadeIn>
            <div className="grid sm:grid-cols-3 gap-6 mb-12">
              {roles.map((role, i) => {
                const Icon = role.icon;
                return (
                  <FadeIn
                    key={role.title}
                    delay={i * 100}
                  >
                    <Card className={`border-0 shadow-lg bg-gradient-to-br ${role.gradient} h-full hover:shadow-xl transition-shadow`}>
                      <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-eko-navy flex items-center justify-center mx-auto mb-5 shadow-md">
                          <Icon className="w-7 h-7 text-eko-gold" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-3">{role.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                      </CardContent>
                    </Card>
                  </FadeIn>
                );
              })}
            </div>
            <FadeIn
              as="p"
              className="text-muted-foreground leading-relaxed text-center max-w-2xl mx-auto bg-muted/60 rounded-xl p-6 border border-border/40"
            >
              With Eko's platform, these entrepreneurs gain access to tools that help them manage transactions, track income, expand services and access working capital — allowing them to grow their businesses every day.
            </FadeIn>
          </div>
        </section>

        {/* The Future We Are Building */}
        <section className="relative py-20 lg:py-24 bg-eko-navy overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-80 h-80 bg-eko-gold rounded-full blur-3xl" />
          </div>
          <FadeIn className="container mx-auto px-6 max-w-3xl text-center relative z-10">
            <h2 className="text-3xl font-bold text-white mb-6">The Future We Are Building</h2>
            <p className="text-lg text-white/75 leading-relaxed">
              Financial services will not be built through apps alone. They will be built through technology, trust and local entrepreneurship working together. Eko is building the infrastructure that makes this possible.
            </p>
          </FadeIn>
        </section>

        {/* Our Values */}
        <section className="py-16 lg:py-24 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <FadeIn className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 rounded-full bg-eko-navy text-eko-gold text-sm font-semibold mb-4">
                Our Culture
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Our Values</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-justify">Financial liberty to a business is like pop-corns to a movie theatre. You can live without it, but the experience is never the same.  At Eko Bharat Ventures, we want to take this experience home to every micro entrepreneur.</p>

              <p className="text-foreground font-semibold max-w-2xl mx-auto mb-2 text-justify">
                We call it CREATE — Curiosity, Resilience, Empathy, Agility, Trust, Excellence — with Ownership &amp; Courage.
              </p>
              <p className="text-muted-foreground max-w-2xl mx-auto text-justify">
                At Eko, our values guide how we build technology, work with partners and serve communities. They shape how we think, how we act and how we create long-term impact.
              </p>
            </FadeIn>
            <div className="grid sm:grid-cols-2 gap-5">
              {values.map((v, i) => {
                const Icon = v.icon;
                return (
                  <FadeIn
                    key={v.name}
                    delay={i * 100}
                  >
                    <Card className="border-border/40 hover:border-eko-gold/30 hover:shadow-lg transition-all h-full">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl ${v.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${v.color}`} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{v.name}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {v.synonyms.map((synonym, idx) => {
                                const colors = [
                                  "bg-amber-100 text-amber-900",
                                  "bg-blue-100 text-blue-900",
                                  "bg-green-100 text-green-900",
                                  "bg-pink-100 text-pink-900",
                                  "bg-purple-100 text-purple-900",
                                ];
                                // Randomize starting color based on value name
                                const randomOffset = v.name.charCodeAt(0) % colors.length;
                                const colorClass = colors[(randomOffset + idx) % colors.length];
                                return (
                                  <span
                                    key={idx}
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                                  >
                                    {synonym}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed text-justify">{v.body}</p>
                      </CardContent>
                    </Card>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default AboutPage;
