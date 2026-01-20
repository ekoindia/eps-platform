import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Banknote, Zap, Shield, RefreshCw, Globe, Clock, Users, Building, CheckCircle } from "lucide-react";

const DmtApiPage = () => {
  return (
    <>
      <Helmet>
        <title>Domestic Money Transfer API (DMT) | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Enable instant money transfers across India with Eko's DMT API. Real-time IMPS & NEFT settlements, pan-India coverage, and 99.9% uptime. Integrate in minutes." 
        />
        <meta name="keywords" content="DMT API, domestic money transfer API, IMPS API, NEFT API, money transfer India, remittance API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/dmt-api" />
        <meta property="og:title" content="Domestic Money Transfer API (DMT) | Eko" />
        <meta property="og:description" content="Enable instant money transfers across India with real-time settlements and pan-India coverage." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Domestic Money Transfer API"
        description="Enable instant money transfers across India with Eko's DMT API"
        heroTitle="Instant Domestic Money Transfers"
        heroSubtitle="Enable real-time money transfers across India with our robust DMT API. Power remittances for millions of customers with IMPS, NEFT, and RTGS support."
        category="payment"
        docsUrl="https://developers.eko.in/docs/money-transfer"
        features={[
          {
            title: "Real-time Transfers",
            description: "Instant money transfers via IMPS with real-time status updates and confirmations.",
            icon: Zap
          },
          {
            title: "NEFT & RTGS Support",
            description: "Support for NEFT and RTGS for high-value transfers with guaranteed settlements.",
            icon: Banknote
          },
          {
            title: "Pan-India Coverage",
            description: "Transfer money to any bank account across India with 99.9% success rate.",
            icon: Globe
          },
          {
            title: "Real-time Webhooks",
            description: "Receive instant notifications for transaction status updates via webhooks.",
            icon: RefreshCw
          },
          {
            title: "Secure Transactions",
            description: "Bank-grade encryption and security for all transactions with audit trails.",
            icon: Shield
          },
          {
            title: "24/7 Availability",
            description: "Round-the-clock availability with 99.9% uptime guarantee.",
            icon: Clock
          }
        ]}
        benefits={[
          {
            title: "Seamless Integration",
            description: "Well-documented APIs with SDKs in multiple languages. Get started in minutes with 24x7 support.",
            icon: CheckCircle
          },
          {
            title: "Best Success Rate",
            description: "Industry-leading success rates with smart routing and automatic retries.",
            icon: Zap
          },
          {
            title: "Earn Commission",
            description: "Earn attractive commissions on every successful transaction processed through your platform.",
            icon: Banknote
          },
          {
            title: "Scalable Infrastructure",
            description: "Handle millions of transactions with our enterprise-grade infrastructure.",
            icon: Building
          },
          {
            title: "Retailer Network",
            description: "Build and manage a network of retailers for cash-in and cash-out services.",
            icon: Users
          },
          {
            title: "Regulatory Compliant",
            description: "Fully RBI-compliant infrastructure with all necessary licenses and certifications.",
            icon: Shield
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App and get your sandbox credentials."
          },
          {
            step: 2,
            title: "Submit KYC",
            description: "Complete your business KYC verification process."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Use our comprehensive documentation to integrate the DMT API."
          },
          {
            step: 4,
            title: "Test in Sandbox",
            description: "Test your integration thoroughly in our sandbox environment."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Get production credentials and start processing real transactions."
          }
        ]}
        useCases={[
          "Retail Banking Apps",
          "Fintech Platforms",
          "Remittance Services",
          "Kirana Stores",
          "Agent Banking",
          "Corporate Payouts",
          "E-commerce Refunds"
        ]}
        faqs={[
          {
            question: "What is the DMT API?",
            answer: "The DMT (Domestic Money Transfer) API enables instant money transfers to any bank account across India using IMPS, NEFT, or RTGS. It's designed for businesses that want to offer remittance services to their customers."
          },
          {
            question: "What is the transaction limit?",
            answer: "Individual transaction limits vary based on the mode of transfer. IMPS supports up to ₹5 lakh per transaction, while NEFT and RTGS support higher limits for bulk transfers."
          },
          {
            question: "How long does a transfer take?",
            answer: "IMPS transfers are instant (within seconds). NEFT transfers are processed in batches throughout the day, and RTGS transfers are processed in real-time during banking hours."
          },
          {
            question: "What documents are required for integration?",
            answer: "You'll need business registration documents, PAN card, bank account details, and relevant licenses based on your business type. Our team will guide you through the complete process."
          },
          {
            question: "Is there a settlement delay?",
            answer: "Settlement timelines depend on your agreement. Most partners receive T+1 settlements, with options for same-day settlements for high-volume partners."
          }
        ]}
      />
    </>
  );
};

export default DmtApiPage;
