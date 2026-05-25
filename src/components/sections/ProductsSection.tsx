import { useState } from "react";
import { openZohoChat } from "@/lib/zoho-chat";
import { Link } from "react-router-dom";
import { SectionContainer, SectionHeader } from "@/components/SectionContainer";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/Cards";
import { FadeIn } from "@/components/FadeIn";
import {
  // CreditCard,
  Fingerprint,
  ShieldCheck,
  Banknote,
  Smartphone,
  Receipt,
  // IndianRupee,
  // Send,
  FileCheck,
  // User,
  Building,
  Car,
  Plane,
  FolderCheck,
  ArrowRight,
  Landmark,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProductTab = "bc" | "payments" | "bbps" | "collection" | "verification"; // | "shield"

const productTabs: { id: ProductTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "verification", label: "Verification APIs", icon: Fingerprint },
  // { id: "payments", label: "Payment APIs", icon: CreditCard },
  { id: "bbps", label: "Payments APIs", icon: Receipt },
  // { id: "collection", label: "Collection APIs", icon: IndianRupee },
  { id: "bc", label: "BC APIs", icon: Landmark },
  // { id: "shield", label: "Eko Shield", icon: ShieldCheck },
];

const bcProducts = [
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
];

const paymentProducts: typeof bcProducts = [
  // {
  //   title: "Payout / UPI Payout",
  //   icon: Send,
  //   description: "Bulk disbursements to bank accounts, UPI, and wallets.",
  //   features: ["Batch processing", "Scheduled payouts", "Real-time webhooks"]
  // },
];

const bbpsProducts = [
  {
    title: "BBPS Integration",
    icon: Receipt,
    description: "Complete bill payment ecosystem with 200+ biller categories.",
    features: ["Electricity & gas", "DTH & broadband", "Insurance premiums"]
  },
  {
    title: "CMS API",
    icon: Wallet,
    description: "Cash Management System for streamlined cash collection and reconciliation.",
    features: ["Multi-channel collection", "Automated reconciliation", "Real-time tracking"]
  },
];

const collectionProducts = [
  // {
  //   title: "QR Payment",
  //   icon: Smartphone,
  //   description: "Generate and manage QR codes for seamless payment collection.",
  //   features: ["Dynamic QR codes", "UPI integration", "Real-time notifications"]
  // },
];

const verificationProducts = [
  {
    title: "PAN Verification",
    icon: FileCheck,
    description: "Instant PAN card verification with name matching.",
    features: ["Real-time verification", "Name match score", "Status check"]
  },
  // {
  //   title: "Aadhaar Verification",
  //   icon: User,
  //   description: "Secure Aadhaar-based identity verification.",
  //   features: ["OTP verification", "Demographic check", "eKYC support"]
  // },
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
    title: "Vehicle & RC Verification",
    icon: Car,
    description: "Complete vehicle registration, ownership & insurance check.",
    features: ["RC status & expiry", "Owner & vehicle details", "Insurance & blacklist check"]
  },
  {
    title: "DigiLocker Integration",
    icon: FolderCheck,
    description: "Access verified documents from DigiLocker.",
    features: ["Document fetch", "Consent-based", "Multiple doc types"]
  },
];

const handleChat = () => {
  openZohoChat();
};

const ProductTabContent = ({ products }: { products: typeof bcProducts }) => (
  <div>
    <div className={cn(
      "grid gap-6",
      products.length <= 2
        ? "md:grid-cols-2 max-w-2xl mx-auto"
        : "md:grid-cols-2 lg:grid-cols-3"
    )}>
      {products.map((product, i) => (
        <FadeIn key={product.title} delay={i * 100}>
          <ProductCard {...product} />
        </FadeIn>
      ))}
    </div>
    <div className="flex flex-wrap justify-center gap-4 mt-10">
      <Button variant="gold" size="lg" asChild>
        <a href="https://developers.eko.in" target="_blank" rel="noopener noreferrer">
          View Documentation
          <ArrowRight className="w-4 h-4" />
        </a>
      </Button>
      <Button
        id="btn-chat-section-products"
        variant="navy-outline" size="lg" onClick={handleChat}>
        Chat with Us
      </Button>
    </div>
  </div>
);

export const ProductsSection = () => {
  const [activeTab, setActiveTab] = useState<ProductTab>("verification");

  return (
    <SectionContainer id="products">
      <FadeIn>
        <SectionHeader
          badge="Our Products"
          title="APIs to Integrate to Grow your Business"
          subtitle="From BC services to payments and verifications, everything you need to build and scale your fintech operations."
        />
      </FadeIn>

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
      {activeTab === "bc" && <ProductTabContent products={bcProducts} />}
      {activeTab === "payments" && <ProductTabContent products={paymentProducts} />}
      {activeTab === "bbps" && <ProductTabContent products={bbpsProducts} />}
      {activeTab === "collection" && <ProductTabContent products={collectionProducts} />}
      {activeTab === "verification" && <ProductTabContent products={verificationProducts} />}

      {/* {activeTab === "shield" && (
        <div>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-linear-to-br from-eko-gold/10 to-eko-navy/5 rounded-2xl blur-2xl" />
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
            </FadeIn>
            <FadeIn delay={200} className="order-1 lg:order-2">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Unified Verification Suite
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                One single portal for all verifications across industries.
                Eko Shield simplifies compliance with a unified interface for all your verification needs.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: Building, label: "Small NBFCs & MFIs" },
                  { icon: Smartphone, label: "Fintech Builders" },
                  { icon: Plane, label: "Travel & Insurance" },
                  { icon: Wallet, label: "Lending & E-commerce" },
                ].map((useCase) => (
                  <div key={useCase.label} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <useCase.icon className="w-5 h-5 text-eko-gold" />
                    <span className="text-sm font-medium">{useCase.label}</span>
                  </div>
                ))}
              </div>
              <Button variant="gold" size="lg" asChild>
                <Link to="/products/eko-shield">
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </FadeIn>
          </div>
        </div>
      )} */}
    </SectionContainer>
  );
};
