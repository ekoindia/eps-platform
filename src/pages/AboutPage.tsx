import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Handshake, ShoppingBag, Lightbulb, Shield, Heart, Zap, Lock, Star, UserCheck, Swords, Target } from "lucide-react";
import { motion } from "framer-motion";

const roles = [
  { title: "Influencers", description: "Helping customers choose the right product or service.", icon: Users, gradient: "from-eko-gold-light to-eko-gold-light/20" },
  { title: "Facilitators", description: "Assisting customers with onboarding, documentation and transactions.", icon: Handshake, gradient: "from-secondary to-secondary/30" },
  { title: "Resellers", description: "Offering products and services while earning commissions.", icon: ShoppingBag, gradient: "from-accent/10 to-accent/5" },
];

const values = [
  { name: "Curiosity", icon: Lightbulb, color: "text-eko-gold", bg: "bg-eko-gold-light", body: "Curiosity drives innovation at Eko. We constantly question existing systems and explore better ways to solve problems — understanding how people actually use financial services, studying local behaviours, experimenting with new ideas, and learning continuously from customers, partners and entrepreneurs." },
  { name: "Resilience", icon: Shield, color: "text-eko-navy", bg: "bg-secondary", body: "Creating meaningful financial inclusion takes patience and persistence. We stay committed to our mission even when challenges arise, continuously improve our systems, learn from failures, and build durable platforms that scale over time." },
  { name: "Empathy", icon: Heart, color: "text-destructive", bg: "bg-destructive/10", body: "Our technology serves entrepreneurs and customers across diverse communities. Empathy helps us design tools that are simple and practical, build products that respect people's time and trust, and create systems that work for everyone — not just the digitally fluent." },
  { name: "Agility", icon: Zap, color: "text-eko-gold", bg: "bg-eko-gold-light", body: "The financial ecosystem is constantly evolving. Agility means iterating rapidly on products, adapting to regulatory and market changes, collaborating across teams, and making decisions with speed and clarity." },
  { name: "Trust", icon: Lock, color: "text-eko-navy", bg: "bg-secondary", body: "Trust is the foundation of financial services. We build trust by maintaining strong compliance and security standards, designing transparent systems, delivering consistent platform performance, and building long-term relationships with communities and institutions." },
  { name: "Excellence", icon: Star, color: "text-eko-gold", bg: "bg-eko-gold-light", body: "Excellence means striving to be the best version of ourselves in everything we do — setting ambitious goals, surpassing ordinary standards, continuously improving our work, and delivering quality and impact every time." },
  { name: "Ownership", icon: UserCheck, color: "text-eko-navy", bg: "bg-secondary", body: "Ownership means we take responsibility not just for tasks, but for results. We act like builders, not operators — solving problems end-to-end, taking initiative, and being accountable for the impact of our work." },
  { name: "Courage", icon: Swords, color: "text-destructive", bg: "bg-destructive/10", body: "Courage means doing what is right even when it is difficult. At Eko, courage is about speaking up, sharing honest perspectives and taking decisions in the face of uncertainty. As Churchill said: \"Courage is what it takes to stand up and speak; courage is also what it takes to sit down and listen.\"" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const AboutPage = () => {
  return (
    <>
      <Header />
      <main className="pt-20 lg:pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden bg-eko-navy py-24 lg:py-32">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-eko-gold rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-eko-gold rounded-full blur-3xl" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="container mx-auto px-6 text-center max-w-3xl relative z-10"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-eko-gold/20 text-eko-gold text-sm font-semibold mb-6">
              About Eko
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Building the infrastructure for community-powered finance
            </h1>
            <p className="text-lg text-white/75 leading-relaxed max-w-2xl mx-auto">
              Eko is a financial technology platform helping brands, banks, and fintech companies reach customers through trusted micro-entrepreneurs embedded in their communities across Bharat.
            </p>
          </motion.div>
        </section>

        {/* Body Intro */}
        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-6 max-w-3xl space-y-5">
            {[
              "Across Bharat, millions of people prefer accessing financial services through someone they trust — their neighbourhood shopkeeper, a local entrepreneur, or a community agent who understands their needs and aspirations. Eko enables this ecosystem.",
              "Through a combination of distribution infrastructure, fintech APIs, and simple digital tools, we connect institutions with a vast network of micro-entrepreneurs — many of them women — who bring financial services closer to their communities.",
              "Today, Eko powers a nationwide network serving tens of millions of customers across thousands of towns and villages, enabling banking services, digital transactions, and financial products through entrepreneurs deeply embedded in local markets.",
            ].map((text, i) => (
              <motion.p
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="text-muted-foreground leading-relaxed text-base"
              >
                {text}
              </motion.p>
            ))}
          </div>
        </section>

        {/* Our Mission */}
        <section className="py-16 lg:py-20 bg-gradient-to-br from-secondary via-muted/40 to-secondary/50">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="container mx-auto px-6 max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-eko-navy flex items-center justify-center">
                <Target className="w-6 h-6 text-eko-gold" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Expanding access to opportunity</h2>
            </div>
            <div className="space-y-5 text-muted-foreground leading-relaxed">
              <p>Our mission is to help brands reach the next billion customers through trusted community entrepreneurs — while empowering those entrepreneurs to grow sustainable businesses.</p>
              <p>We do this by building <span className="font-semibold text-foreground">Distribution-as-a-Service</span>, a platform that connects institutions with local micro-entrepreneurs who serve as trusted access points for financial services.</p>
              <p>Through simple digital tools, these entrepreneurs can serve customers, earn more and build a stronger economic future for themselves and their communities.</p>
              <p className="border-l-4 border-eko-gold pl-4 italic text-foreground/80">
                In short, Eko connects brands, entrepreneurs and customers — creating a financial ecosystem that is more inclusive, accessible and scalable.
              </p>
            </div>
          </motion.div>
        </section>

        {/* What This Means in Practice */}
        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-6 max-w-4xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl font-bold text-foreground mb-4 text-center">What This Means in Practice</h2>
              <p className="text-muted-foreground leading-relaxed mb-12 text-center max-w-2xl mx-auto">
                Many institutions struggle to reach customers beyond large cities. Building physical networks is expensive and difficult. Eko solves this by enabling brands to work with trusted local entrepreneurs who already serve their communities.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-3 gap-6 mb-12">
              {roles.map((role, i) => {
                const Icon = role.icon;
                return (
                  <motion.div
                    key={role.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    custom={i}
                    variants={fadeUp}
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
                  </motion.div>
                );
              })}
            </div>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-muted-foreground leading-relaxed text-center max-w-2xl mx-auto bg-muted/60 rounded-xl p-6 border border-border/40"
            >
              With Eko's platform, these entrepreneurs gain access to tools that help them manage transactions, track income, expand services and access working capital — allowing them to grow their businesses every day.
            </motion.p>
          </div>
        </section>

        {/* The Future We Are Building */}
        <section className="relative py-20 lg:py-24 bg-eko-navy overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-80 h-80 bg-eko-gold rounded-full blur-3xl" />
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="container mx-auto px-6 max-w-3xl text-center relative z-10"
          >
            <h2 className="text-3xl font-bold text-white mb-6">The Future We Are Building</h2>
            <p className="text-lg text-white/75 leading-relaxed">
              Financial services will not be built through apps alone. They will be built through technology, trust and local entrepreneurship working together. Eko is building the infrastructure that makes this possible.
            </p>
          </motion.div>
        </section>

        {/* Our Values */}
        <section className="py-16 lg:py-24 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-6 max-w-5xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 rounded-full bg-eko-navy text-eko-gold text-sm font-semibold mb-4">
                Our Culture
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Our Values</h2>
              <p className="text-foreground font-semibold mb-2">
                We call it CREATE — Curiosity, Resilience, Empathy, Agility, Trust, Excellence — with Ownership &amp; Courage.
              </p>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                At Eko, our values guide how we build technology, work with partners and serve communities. They shape how we think, how we act and how we create long-term impact.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-5">
              {values.map((v, i) => {
                const Icon = v.icon;
                return (
                  <motion.div
                    key={v.name}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    custom={i}
                    variants={fadeUp}
                  >
                    <Card className="border-border/40 hover:border-eko-gold/30 hover:shadow-lg transition-all h-full">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl ${v.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${v.color}`} />
                          </div>
                          <h3 className="text-lg font-bold text-foreground">{v.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{v.body}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
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
