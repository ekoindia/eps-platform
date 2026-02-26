import { useState } from "react";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/Cards";
import { 
  CreditCard, 
  Fingerprint, 
  LayoutDashboard, 
  ShieldCheck,
  Banknote,
  Smartphone,
  Receipt,
  Wallet,
  Send,
  FileCheck,
  User,
  Building,
  Car,
  Plane,
  FolderCheck,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProductTab = "payments" | "verification" | "shield";

const productTabs: { id: ProductTab; label: string; icon: any }[] = [
  { id: "payments", label: "Payment APIs", icon: CreditCard },
  { id: "verification", label: "Verification APIs", icon: Fingerprint },
  { id: "shield", label: "Eko Shield", icon: ShieldCheck },
];

const paymentProducts = [
  {
    title: "Domestic Money Transfer",
    icon: Banknote,
    description: "Enable instant money transfers across India with real-time settlements.",
    features: ["IMPS & NEFT support", "Real-time status updates", "Pan-India coverage"]
  },
  {
    title: "AePS Services",
    icon: Fingerprint,
    description: "Aadhaar-enabled payment services for rural and underbanked segments.",
    features: ["Cash withdrawal", "Balance enquiry", "Mini statement"]
  },
  {
    title: "BBPS Integration",
    icon: Receipt,
    description: "Complete bill payment ecosystem with 200+ biller categories.",
    features: ["Electricity & gas", "DTH & broadband", "Insurance premiums"]
  },
  {
    title: "Payment Gateway",
    icon: CreditCard,
    description: "Accept payments via cards, UPI, net banking, and wallets.",
    features: ["Multi-mode support", "Instant settlements", "Smart routing"]
  },
  {
    title: "Payouts API",
    icon: Send,
    description: "Bulk disbursements to bank accounts, UPI, and wallets.",
    features: ["Batch processing", "Scheduled payouts", "Real-time webhooks"]
  },
];

const verificationProducts = [
  {
    title: "PAN Verification",
    icon: FileCheck,
    description: "Instant PAN card verification with name matching.",
    features: ["Real-time verification", "Name match score", "Status check"]
  },
  {
    title: "Aadhaar Verification",
    icon: User,
    description: "Secure Aadhaar-based identity verification.",
    features: ["OTP verification", "Demographic check", "eKYC support"]
  },
  {
    title: "Bank Account Verification",
    icon: Building,
    description: "Verify bank account details instantly.",
    features: ["Penny drop verification", "IFSC validation", "Account status"]
  },
  {
    title: "GST Verification",
    icon: Receipt,
    description: "Verify GST registration and compliance status.",
    features: ["GSTIN validation", "Filing status", "Business details"]
  },
  {
    title: "Vehicle Verification",
    icon: Car,
    description: "RC and driving license verification for mobility.",
    features: ["RC verification", "DL validation", "Chassis number check"]
  },
  {
    title: "DigiLocker Integration",
    icon: FolderCheck,
    description: "Access verified documents from DigiLocker.",
    features: ["Document fetch", "Consent-based", "Multiple doc types"]
  },
];

export const ProductsSection = () => {
  const [activeTab, setActiveTab] = useState<ProductTab>("payments");

  return (
    <SectionContainer id="products">
      <SectionHeader
        badge="Our Products"
        title="Complete Financial Infrastructure"
        subtitle="From payments to verifications, everything you need to build robust financial applications."
      />

      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {productTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-eko-gold text-eko-navy shadow-gold"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "payments" && (
        <div className="animate-fade-up">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paymentProducts.map((product) => (
              <ProductCard key={product.title} {...product} />
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-10">
            <Button variant="gold" size="lg" asChild>
              <a href="https://developers.eko.in" target="_blank" rel="noopener noreferrer">
                View Documentation
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="navy-outline" size="lg" onClick={() => window.dispatchEvent(new CustomEvent("open-get-started"))}>
              Request Access
            </Button>
          </div>
        </div>
      )}

      {activeTab === "verification" && (
        <div className="animate-fade-up">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {verificationProducts.map((product) => (
              <ProductCard key={product.title} {...product} />
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-10">
            <Button variant="gold" size="lg" asChild>
              <a href="https://developers.eko.in" target="_blank" rel="noopener noreferrer">
                View Documentation
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="navy-outline" size="lg" onClick={() => window.dispatchEvent(new CustomEvent("open-get-started"))}>
              Request Access
            </Button>
          </div>
        </div>
      )}

      {activeTab === "shield" && (
        <div className="animate-fade-up">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
              <div className="relative bg-card border border-border/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  <ShieldCheck className="w-5 h-5 text-eko-gold" />
                  <span className="font-semibold">Eko Shield Portal</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["PAN", "Aadhaar", "Bank", "GST", "DL", "RC", "Passport", "Employee"].map((item) => (
                    <div key={item} className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-xs text-muted-foreground mb-1">Verify</div>
                      <div className="font-medium text-sm">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Unified Verification Suite
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                One single portal for all verifications across industries. 
                Eko Shield simplifies compliance with a unified interface for all your verification needs.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: Building, label: "Banks & NBFCs" },
                  { icon: Smartphone, label: "Fintech Startups" },
                  { icon: Plane, label: "Travel & Insurance" },
                  { icon: Wallet, label: "E-commerce & Lending" },
                ].map((useCase) => (
                  <div key={useCase.label} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <useCase.icon className="w-5 h-5 text-eko-gold" />
                    <span className="text-sm font-medium">{useCase.label}</span>
                  </div>
                ))}
              </div>
              <Button variant="gold" size="lg">
                Request Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </SectionContainer>
  );
};
