import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Fingerprint, Wallet, FileText, Shield, Users, Building, Clock, CheckCircle, Zap } from "lucide-react";
import aepsImg from "@/assets/aeps-main.svg";

const AepsApiPage = () => {
  return (
    <>
      <Helmet>
        <title>AePS API - Aadhaar Enabled Payment System | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Enable Aadhaar-based banking services with Eko's AePS API. Cash withdrawal, balance enquiry, mini statements, and fund transfers using Aadhaar authentication." 
        />
        <meta name="keywords" content="AePS API, Aadhaar enabled payment system, Aadhaar banking API, biometric payment API, rural banking API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/aeps-api" />
        <meta property="og:title" content="AePS API - Aadhaar Enabled Payment System | Eko" />
        <meta property="og:description" content="Enable Aadhaar-based banking services for rural and underbanked segments." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="AePS API"
        description="Aadhaar-enabled payment services for rural and underbanked segments"
        heroTitle="Aadhaar Enabled Payment System"
        heroSubtitle="Bring banking services to every corner of India with AePS. Enable cash withdrawals, balance enquiries, and fund transfers using just Aadhaar and fingerprint authentication."
        category="payment"
        docsUrl="https://developers.eko.in/docs/aeps"
        heroImage={aepsImg}
        features={[
          {
            title: "Cash Withdrawal",
            description: "Enable customers to withdraw cash from any bank account using Aadhaar and biometric authentication.",
            icon: Wallet
          },
          {
            title: "Balance Enquiry",
            description: "Check account balance instantly using Aadhaar number and fingerprint verification.",
            icon: FileText
          },
          {
            title: "Mini Statement",
            description: "Retrieve the last few transactions for any Aadhaar-linked bank account.",
            icon: FileText
          },
          {
            title: "Fund Transfer",
            description: "Transfer funds between Aadhaar-linked accounts securely and instantly.",
            icon: Fingerprint
          },
          {
            title: "Biometric Authentication",
            description: "Secure transactions with Aadhaar-based biometric verification using UIDAI.",
            icon: Shield
          },
          {
            title: "Multi-Bank Support",
            description: "Connect to all major banks in India through a single integration.",
            icon: Building
          }
        ]}
        benefits={[
          {
            title: "Financial Inclusion",
            description: "Bring banking services to rural and underbanked populations without traditional infrastructure.",
            icon: Users
          },
          {
            title: "No Debit Card Required",
            description: "Customers only need their Aadhaar number and fingerprint - no cards or PINs needed.",
            icon: Fingerprint
          },
          {
            title: "Secure & Compliant",
            description: "UIDAI-certified biometric authentication ensures secure and compliant transactions.",
            icon: Shield
          },
          {
            title: "Build Retailer Network",
            description: "Enable local retailers to become banking points and earn commissions.",
            icon: Building
          },
          {
            title: "24/7 Operations",
            description: "Provide banking services round the clock, even in areas without bank branches.",
            icon: Clock
          },
          {
            title: "Easy Integration",
            description: "Simple REST APIs with comprehensive documentation and sandbox environment.",
            icon: CheckCircle
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App and submit your business details."
          },
          {
            step: 2,
            title: "Get Certified",
            description: "Complete UIDAI certification for AePS operations."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Integrate our AePS API with your application using our documentation."
          },
          {
            step: 4,
            title: "Setup Biometric Devices",
            description: "Configure certified biometric devices for fingerprint capture."
          },
          {
            step: 5,
            title: "Onboard Retailers",
            description: "Start onboarding retailers to offer AePS services."
          },
          {
            step: 6,
            title: "Go Live",
            description: "Launch your AePS services and start serving customers."
          }
        ]}
        useCases={[
          "Banking Correspondents",
          "Rural Financial Services",
          "Kirana Store Banking",
          "CSC Centers",
          "Microfinance Institutions",
          "Government Disbursements"
        ]}
        faqs={[
          {
            question: "What is AePS?",
            answer: "AePS (Aadhaar Enabled Payment System) is a bank-led model that allows online financial transactions at Micro ATM through Aadhaar authentication. It uses NPCI infrastructure and enables customers to use Aadhaar for bank transactions."
          },
          {
            question: "What biometric devices are supported?",
            answer: "We support all UIDAI-certified biometric devices including Morpho, Mantra, Startek, and others. Contact our team for the complete list of supported devices."
          },
          {
            question: "What is the transaction limit for AePS?",
            answer: "Cash withdrawal limits vary by bank but typically range from ₹10,000 to ₹50,000 per transaction. Some banks allow higher limits for specific use cases."
          },
          {
            question: "Do I need special certification?",
            answer: "Yes, you need to be a certified AePS operator. Eko can help you with the certification process and provide all necessary support."
          },
          {
            question: "How is commission calculated?",
            answer: "Commission is earned on every successful transaction. The exact rates depend on your agreement and transaction volumes. Contact our team for detailed pricing."
          }
        ]}
      />
    </>
  );
};

export default AepsApiPage;
