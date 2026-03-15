import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Receipt, Zap, Shield, CreditCard, Smartphone, Car, Droplets, Flame, Wifi, Building, CheckCircle, Users } from "lucide-react";
import bbpsImg from "@/assets/utility-bill-payment.svg";

const BbpsApiPage = () => {
  return (
    <>
      <Helmet>
        <title>BBPS API - Bharat Bill Payment System | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Integrate BBPS API to enable bill payments for electricity, gas, water, DTH, broadband, insurance, and 200+ biller categories. RBI-compliant infrastructure." 
        />
        <meta name="keywords" content="BBPS API, bill payment API, Bharat Bill Payment System, utility bill API, electricity bill API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/bbps-api" />
        <meta property="og:title" content="BBPS API - Bharat Bill Payment System | Eko" />
        <meta property="og:description" content="Enable seamless bill payments for 200+ biller categories with Eko's BBPS API." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="BBPS API"
        description="Complete bill payment ecosystem with 200+ biller categories"
        heroTitle="Help Customers Pay Their Utility Bills!"
        heroSubtitle="The BBPS API enables seamless integration for bill payments in India. Whether you're a financial institution, fintech, or service provider, offer your customers convenient bill payment services."
        category="payment"
        docsUrl="https://developers.eko.in/reference/bbps-get-operators"
        heroImage={bbpsImg}
        types={[
          { label: "Electricity", icon: Zap },
          { label: "Gas", icon: Flame },
          { label: "Water", icon: Droplets },
          { label: "DTH", icon: Wifi },
          { label: "Broadband", icon: Wifi },
          { label: "Mobile Recharge", icon: Smartphone },
          { label: "Fastag", icon: Car },
          { label: "Insurance", icon: Shield },
          { label: "Credit Card", icon: CreditCard },
          { label: "EMI", icon: Receipt },
          { label: "LPG Gas", icon: Flame },
          { label: "Loan Repayment", icon: Building }
        ]}
        features={[
          {
            title: "200+ Biller Categories",
            description: "Access to extensive biller network covering electricity, gas, water, insurance, and more.",
            icon: Receipt
          },
          {
            title: "Instant Bill Fetch",
            description: "Fetch outstanding bill amounts in real-time before payment processing.",
            icon: Zap
          },
          {
            title: "Unified API",
            description: "Single API integration for all biller categories - no separate integrations needed.",
            icon: CheckCircle
          },
          {
            title: "Transaction Tracking",
            description: "Complete visibility into transaction status with detailed reporting.",
            icon: Receipt
          },
          {
            title: "Secure Payments",
            description: "PCI-DSS compliant infrastructure with end-to-end encryption.",
            icon: Shield
          },
          {
            title: "Receipt Generation",
            description: "Auto-generated receipts for every successful transaction.",
            icon: Receipt
          }
        ]}
        benefits={[
          {
            title: "Simplified Integration",
            description: "Easy-to-read API documentation and 24x7 integration support for quick go-live.",
            icon: CheckCircle
          },
          {
            title: "Best Success Rate",
            description: "Industry-leading success rates with smart retry mechanisms.",
            icon: Zap
          },
          {
            title: "Earn Commission",
            description: "Attractive commissions on all types of bill payments processed through your platform.",
            icon: Receipt
          },
          {
            title: "Extensive Biller Network",
            description: "Access to 20,000+ billers across all major categories in India.",
            icon: Building
          },
          {
            title: "Real-time Confirmation",
            description: "Instant payment confirmation with transaction reference numbers.",
            icon: Zap
          },
          {
            title: "Customer Retention",
            description: "Keep customers engaged with recurring bill payment reminders and services.",
            icon: Users
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App and get sandbox access."
          },
          {
            step: 2,
            title: "Submit KYC",
            description: "Complete business KYC verification process."
          },
          {
            step: 3,
            title: "UAT Testing",
            description: "Complete UAT testing with all biller categories."
          },
          {
            step: 4,
            title: "API Integration",
            description: "Finalize your BBPS API integration."
          },
          {
            step: 5,
            title: "IP Whitelisting",
            description: "Get your production IPs whitelisted (India only)."
          },
          {
            step: 6,
            title: "Go Live",
            description: "Launch with production credentials and start billing!"
          }
        ]}
        useCases={[
          "Banking Apps",
          "Fintech Platforms",
          "Payment Aggregators",
          "E-commerce Platforms",
          "Retail Networks",
          "Agent Banking",
          "Corporate Solutions"
        ]}
        faqs={[
          {
            question: "What is BBPS API?",
            answer: "BBPS (Bharat Bill Payment System) API is an RBI-mandated online bill payment system that enables customers to pay bills easily and securely. Our API allows you to integrate bill payment services into your platform."
          },
          {
            question: "How many billers are supported?",
            answer: "Eko's BBPS API provides access to 20,000+ billers across 200+ categories including electricity, gas, water, DTH, broadband, insurance, EMI, FASTag, and more."
          },
          {
            question: "What are the commission rates?",
            answer: "Commission rates vary by biller category and transaction volume. Contact our sales team for detailed pricing and commission structures."
          },
          {
            question: "Is BBPS API available 24/7?",
            answer: "Yes, BBPS services are available 24/7. However, some billers may have specific operating hours for payment processing."
          },
          {
            question: "How long does integration take?",
            answer: "With our well-documented APIs and sandbox environment, most partners complete integration within 2-4 weeks including testing and certification."
          }
        ]}
      />
    </>
  );
};

export default BbpsApiPage;
