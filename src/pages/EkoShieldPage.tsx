import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Shield, Zap, ShieldCheck, Eye, TrendingDown,
  Landmark, CreditCard, Users, Truck, ShoppingBag, Plane, Leaf, Building2,
  X, CheckCircle, AlertTriangle, Sparkles, Phone, MapPin, Mail,
} from "lucide-react";
// import heroDashboard from "@/assets/hero-dashboard.jpg";
import heroDashboard from "@/assets/ekoshield/ekoshield-mockup-01.png";
import ekoShieldLogo from "@/assets/eko-shield-logo.png";

/* ─── Data ─── */

const stats = [
  { value: "99.9%", label: "Verified Accuracy" },
  { value: "<1s", label: "Response Time" },
  { value: "500+", label: "Businesses Trust Us" },
];

const valueProps = [
  { icon: Zap, title: "Sub-Second Verification", desc: "Every check completes in under 1 second. Aadhaar, PAN, Bank, GST, DL, RC — all instant." },
  { icon: ShieldCheck, title: "Centralized Compliance", desc: "One dashboard for audit logs, branch-level visibility, and regulatory compliance tracking." },
  { icon: Eye, title: "Operational Control", desc: "No-code dashboard to manage verification workflows. Role-based access across teams and branches." },
  { icon: TrendingDown, title: "Fraud Reduction", desc: "Catch fake identities, expired documents, and mismatched bank details before they cost you." },
];

const steps = [
  { num: "01", title: "Connect", desc: "Integrate via API or use our no-code dashboard. Go live in under 30 minutes." },
  { num: "02", title: "Verify", desc: "Run Aadhaar, PAN, Bank Account, GST, DL, RC, and 50+ checks in real-time." },
  { num: "03", title: "Control", desc: "Monitor all verifications from one dashboard. Set roles, branches, and audit trails." },
  { num: "04", title: "Scale", desc: "From 100 to 100,000 verifications per month. Pricing grows with you." },
];

const industries = [
  { icon: Landmark, name: "NBFC & Lending", tagline: "Branch-level KYC with audit control", pain: "Slow KYC processing, RBI audit pressure, and fragmented branch-level verification workflows cause TAT delays and compliance exposure.", solution: "Eko Shield centralizes branch-level KYC with audit logs, reducing loan processing TAT by up to 30%. Automated Aadhaar, PAN, and bank verification ensures RBI compliance without hiring more staff.", benefits: ["Reduce loan TAT by 30%", "Centralized audit trail for all branches", "Automated RBI compliance checks", "Real-time fraud detection on applications"] },
  { icon: CreditCard, name: "Fintech & Neobanks", tagline: "API + compliance dashboard", pain: "Multiple API vendors, no centralized compliance visibility, and growing regulatory pressure make scaling risky and expensive.", solution: "Eko Shield replaces fragmented API chaos with one verification infrastructure. Your compliance team gets a real-time dashboard while developers get sub-second APIs.", benefits: ["One API for 50+ verification types", "Real-time compliance dashboard", "Sub-second response times", "SOC 2 & ISO 27001 compliant"] },
  { icon: Users, name: "Staffing & HR", tagline: "Verify before you deploy", pain: "Fake candidates with forged documents slip through manual verification, creating liability for staffing agencies and their clients.", solution: "Eko Shield verifies identity, education, and criminal records instantly before deployment. Faster verification means faster billing cycles.", benefits: ["Instant candidate verification", "Reduce deployment delays", "Eliminate fake candidate risk", "Bulk verification workflows"] },
  { icon: Truck, name: "Logistics & Delivery", tagline: "Driver & fleet verification", pain: "One unverified driver with an expired DL can shut down your fleet operations, result in insurance claim rejection, and cause regulatory penalties.", solution: "Eko Shield automates DL, RC, and identity verification for your entire fleet. Get alerts before documents expire and maintain compliance across all hubs.", benefits: ["Automated DL & RC verification", "Document expiry alerts", "Hub-level compliance tracking", "Insurance claim readiness"] },
  { icon: ShoppingBag, name: "Marketplaces & E-commerce", tagline: "Vendor onboarding checks", pain: "Fake sellers and unverified vendors lead to wrong payouts, customer fraud, and marketplace trust erosion.", solution: "Eko Shield verifies vendor identity, bank accounts, and GST before onboarding. Stop wrong payouts before they happen.", benefits: ["Prevent fraudulent vendor signups", "Bank account verification", "GST & PAN validation", "Automated onboarding workflows"] },
  { icon: Plane, name: "Travel & Hospitality", tagline: "Booking fraud prevention", pain: "Fraudulent bookings with stolen identities cost travel companies revenue and damage customer trust.", solution: "Eko Shield adds a verification layer for high-value bookings, confirming traveler identity in seconds before confirmation.", benefits: ["Real-time identity verification", "High-value booking protection", "Reduce chargeback fraud", "Seamless customer experience"] },
  { icon: Leaf, name: "Agro Platforms", tagline: "Secure procurement payments", pain: "Bank account mismatches in farmer payments lead to failed transfers, procurement delays, and financial leakage.", solution: "Eko Shield validates farmer bank accounts and identity before procurement payments, ensuring every payment reaches the right person.", benefits: ["Bank account validation", "Farmer identity verification", "Reduce payment failures", "Regional compliance support"] },
  { icon: Building2, name: "Insurance", tagline: "Instant claim verification", pain: "Fraudulent claims with fake documents cost insurers millions annually. Manual verification creates claim processing backlogs.", solution: "Eko Shield automates claimant identity and document verification, enabling instant claim processing while catching fraud before payout.", benefits: ["Instant claimant verification", "Document fraud detection", "Reduce claim processing time", "Automated audit compliance"] },
];



/* ─── Page Component ─── */

const EkoShieldPage = () => {
  const [selectedIndustry, setSelectedIndustry] = useState<typeof industries[0] | null>(null);



  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Eko Shield - Unified Verification Platform | Eko</title>
        <meta name="description" content="One platform for all identity, financial & compliance verifications. Real-time KYC checks with a unified control dashboard." />
      </Helmet>

      <Header />

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden hero-gradient hero-pattern pt-32 pb-20 md:pt-40 md:pb-32">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                <Zap className="w-4 h-4 text-eko-gold" />
                <span className="text-sm font-medium text-white">India's Verification Infrastructure</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                One Platform. Complete Control.
                <br />
                <span className="text-gradient-gold">Zero Compliance Gaps.</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Replace fragmented verification processes with one scalable trust infrastructure.
                Real-time identity, financial & compliance checks with a unified control dashboard.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Button variant="gold" size="xl" onClick={() => document.getElementById('shield-demo')?.scrollIntoView({ behavior: 'smooth' })}>
                  Request a Demo <ArrowRight className="w-5 h-5" />
                </Button>
                <Button variant="hero-outline" size="xl" onClick={() => document.getElementById('shield-products')?.scrollIntoView({ behavior: 'smooth' })}>
                  View Products
                </Button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="flex flex-wrap items-center justify-center gap-6 pt-8 border-t border-white/20">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-white/90">
                    <Shield className="w-5 h-5 text-eko-gold" />
                    <span className="text-sm font-medium">{s.value} {s.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}
              className="max-w-5xl mx-auto mt-16 relative">
              <div className="absolute inset-0 bg-eko-gold/10 blur-[80px] rounded-3xl" />
              <div className="relative rounded-2xl overflow-hidden">
                <img src={heroDashboard} alt="Eko Shield verification dashboard" className="w-full h-auto" loading="eager" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── Value Props ─── */}
        <section id="shield-products" className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Why Growing Companies Choose Eko Shield</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">One contract. Multiple verifications. Complete operational control.</p>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {valueProps.map((p, i) => (
                <motion.div key={p.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="group p-6 rounded-xl bg-card border border-border hover:border-eko-gold/40 hover:shadow-lg transition-all duration-300">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-eko-navy to-eko-navy-light flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <p.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Industries ─── */}
        <section className="py-20 lg:py-28 hero-gradient hero-pattern relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Built for Every Growing Industry</h2>
              <p className="text-white/80 max-w-xl mx-auto">Click on any industry to see how Eko Shield reduces risk and ensures compliance.</p>
            </motion.div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {industries.map((ind, i) => (
                <motion.button key={ind.name} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedIndustry(ind)}
                  className="group p-5 rounded-xl bg-white/5 border border-white/10 hover:border-eko-gold/50 hover:bg-white/10 transition-all duration-300 text-left cursor-pointer">
                  <ind.icon className="h-8 w-8 text-eko-gold mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold text-white mb-1">{ind.name}</h3>
                  <p className="text-xs text-white/60">{ind.tagline}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs text-eko-gold font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn more <ArrowRight className="w-3 h-3" />
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Industry Modal */}
          <AnimatePresence>
            {selectedIndustry && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm"
                onClick={() => setSelectedIndustry(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-eko-navy to-eko-navy-light flex items-center justify-center">
                          <selectedIndustry.icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{selectedIndustry.name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedIndustry.tagline}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedIndustry(null)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-semibold text-destructive">The Challenge</span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{selectedIndustry.pain}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-eko-gold/5 border border-eko-gold/20 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-eko-gold" />
                        <span className="text-sm font-semibold text-eko-gold">How Eko Shield Helps</span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{selectedIndustry.solution}</p>
                    </div>
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-foreground mb-3">Key Benefits</h4>
                      <ul className="space-y-2">
                        {selectedIndustry.benefits.map((b) => (
                          <li key={b} className="flex items-center gap-2 text-sm text-foreground/80">
                            <CheckCircle className="h-4 w-4 text-eko-gold shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button variant="gold" className="w-full" size="lg" onClick={() => {
                      setSelectedIndustry(null);
                      setTimeout(() => document.getElementById('shield-demo')?.scrollIntoView({ behavior: 'smooth' }), 300);
                    }}>
                      Request a Demo for {selectedIndustry.name}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ─── How It Works ─── */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Live in 30 Minutes</h2>
              <p className="text-muted-foreground">No complex integration. No vendor lock-in.</p>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <motion.div key={s.num} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="relative p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-all duration-300">
                  <span className="text-5xl font-bold text-eko-gold/15 absolute top-4 right-4">{s.num}</span>
                  <div className="relative z-10">
                    <h3 className="text-xl font-semibold text-card-foreground mb-2 mt-4">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                  {i < steps.length - 1 && <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-eko-gold/30" />}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Demo Section ─── */}
        <section id="shield-demo" className="py-20 lg:py-28 hero-gradient hero-pattern relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                  <Sparkles className="w-4 h-4 text-eko-gold" />
                  <span className="text-sm font-medium text-white">Start Your Free Trial</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Take Control of Your Verifications?</h2>
                <p className="text-lg text-white/80 mb-8">Start your 7-day industry trial. See how Eko Shield replaces fragmented verification with one scalable trust infrastructure.</p>
                <ul className="space-y-3 mb-8">
                  {["No credit card required", "Setup in under 30 minutes", "Full dashboard access", "Dedicated onboarding support"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-white/90">
                      <CheckCircle className="h-5 w-5 text-eko-gold shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div className="bg-background rounded-2xl p-6 shadow-2xl overflow-hidden">
                  <h3 className="text-xl font-bold text-foreground mb-4">Get Started with Eko Shield</h3>
                  <iframe
                    aria-label="New Eko.in API Signup"
                    frameBorder="0"
                    allow="geolocation;"
                    style={{ height: "500px", width: "100%", border: "none" }}
                    src="https://forms.zohopublic.in/ekoindiafinancialservicespvtlt/form/NewEkoinAPISignup/formperma/JmSIq1OIg5-iNmPq-fcqHv9g9_QBNvM2VQ2DC3XetvQ"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EkoShieldPage;
