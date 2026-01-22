import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { CreditCard, Shield, Zap, CheckCircle, Wallet, Globe, RefreshCw, BarChart3 } from "lucide-react";

const PaymentApiPage = () => {
  return (
    <>
      <Helmet>
        <title>Payment Gateway API - Accept Online Payments | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Accept online payments with Eko's Payment Gateway API. Support for cards, UPI, net banking, and wallets. Fast integration with competitive pricing." 
        />
        <meta name="keywords" content="payment gateway API, online payment API, card payment API, UPI payment, net banking API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/payment-api" />
        <meta property="og:title" content="Payment Gateway API - Accept Online Payments | Eko" />
        <meta property="og:description" content="Accept online payments via cards, UPI, net banking, and wallets." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Payment Gateway API"
        description="Accept online payments across multiple channels"
        heroTitle="Payment Gateway API"
        heroSubtitle="Accept payments through cards, UPI, net banking, and wallets with a single integration. Built for high performance with competitive pricing."
        category="payment"
        docsUrl="https://developers.eko.in/docs/payment-gateway"
        features={[
          {
            title: "Multi-mode Payments",
            description: "Accept Credit/Debit cards, UPI, Net Banking, and Wallets in one integration.",
            icon: CreditCard
          },
          {
            title: "Smart Routing",
            description: "Intelligent payment routing for higher success rates.",
            icon: Zap
          },
          {
            title: "Recurring Payments",
            description: "Set up subscriptions and recurring billing easily.",
            icon: RefreshCw
          },
          {
            title: "International Cards",
            description: "Accept payments from international Visa and Mastercard.",
            icon: Globe
          },
          {
            title: "Instant Refunds",
            description: "Process full or partial refunds with a single API call.",
            icon: Wallet
          },
          {
            title: "Analytics Dashboard",
            description: "Real-time analytics with success rates, trends, and insights.",
            icon: BarChart3
          }
        ]}
        benefits={[
          {
            title: "High Success Rate",
            description: "Optimized payment flows and smart retry logic for maximum conversions.",
            icon: CheckCircle
          },
          {
            title: "Fast Settlement",
            description: "Quick settlement cycles to maintain healthy cash flow.",
            icon: Zap
          },
          {
            title: "PCI DSS Compliant",
            description: "Bank-grade security with full PCI DSS Level 1 compliance.",
            icon: Shield
          },
          {
            title: "Easy Integration",
            description: "Simple APIs, SDKs, and plugins for popular platforms.",
            icon: CreditCard
          },
          {
            title: "Competitive Pricing",
            description: "Transparent pricing with no hidden charges or setup fees.",
            icon: Wallet
          },
          {
            title: "24/7 Support",
            description: "Round-the-clock technical and business support.",
            icon: Globe
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create merchant account with business documents."
          },
          {
            step: 2,
            title: "Get API Keys",
            description: "Receive sandbox and production credentials."
          },
          {
            step: 3,
            title: "Integrate",
            description: "Use our SDKs or direct API integration."
          },
          {
            step: 4,
            title: "Test",
            description: "Test all payment modes in sandbox."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Switch to production and start accepting payments."
          }
        ]}
        useCases={[
          "E-commerce",
          "SaaS Subscriptions",
          "Marketplaces",
          "Travel Booking",
          "Education Fees",
          "Healthcare",
          "Food Delivery",
          "Event Ticketing"
        ]}
        faqs={[
          {
            question: "What payment methods are supported?",
            answer: "We support Credit Cards (Visa, Mastercard, Amex, Rupay), Debit Cards, UPI (all apps), Net Banking (100+ banks), and Wallets (Paytm, PhonePe, Amazon Pay, etc.)."
          },
          {
            question: "What are the transaction charges?",
            answer: "Charges vary by payment mode - typically 1.5-2% for cards and 0% for UPI (as per current regulations). Contact us for custom pricing based on volume."
          },
          {
            question: "How fast is the integration?",
            answer: "With our SDKs and plugins, you can integrate in a few hours. Full custom integration typically takes 1-2 days with our documentation."
          },
          {
            question: "Do you support international cards?",
            answer: "Yes, we accept international Visa and Mastercard. Additional documentation may be required for international payment acceptance."
          },
          {
            question: "What is the settlement cycle?",
            answer: "Standard settlement is T+2 for most merchants. Faster settlement options are available for eligible high-volume merchants."
          }
        ]}
      />
    </>
  );
};

export default PaymentApiPage;
