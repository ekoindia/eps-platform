import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { QrCode, Shield, Zap, CheckCircle, Smartphone, CreditCard, BarChart3, RefreshCw } from "lucide-react";

const QrPaymentApiPage = () => {
  return (
    <>
      <Helmet>
        <title>QR Payment API - UPI QR Code Payments | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Accept UPI payments via QR codes with Eko's QR Payment API. Dynamic QR generation, real-time notifications, and seamless payment collection for merchants." 
        />
        <meta name="keywords" content="QR payment API, UPI QR API, dynamic QR code, QR code payments, merchant payments API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/qr-payment-api" />
        <meta property="og:title" content="QR Payment API - UPI QR Code Payments | Eko" />
        <meta property="og:description" content="Accept UPI payments via dynamic QR codes with real-time notifications." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="QR Payment API"
        description="Accept UPI payments via dynamic QR codes"
        heroTitle="QR Payment API"
        heroSubtitle="Enable seamless UPI payments through dynamic QR codes. Perfect for retail stores, restaurants, and any business accepting digital payments."
        category="payment"
        docsUrl="https://developers.eko.in/docs/qr-payment"
        features={[
          {
            title: "Dynamic QR Generation",
            description: "Generate unique QR codes for each transaction with custom amounts and references.",
            icon: QrCode
          },
          {
            title: "Real-time Notifications",
            description: "Instant webhooks and callbacks when payment is received.",
            icon: Zap
          },
          {
            title: "Multi-app Support",
            description: "Works with all UPI apps - Google Pay, PhonePe, Paytm, BHIM, and more.",
            icon: Smartphone
          },
          {
            title: "Static QR Support",
            description: "Generate static QR codes for fixed collection points.",
            icon: QrCode
          },
          {
            title: "Transaction Tracking",
            description: "Complete transaction history and reconciliation reports.",
            icon: BarChart3
          },
          {
            title: "Refund Management",
            description: "Process refunds directly through the API when needed.",
            icon: RefreshCw
          }
        ]}
        benefits={[
          {
            title: "Zero Hardware Cost",
            description: "No POS machine required - customers scan and pay using their phones.",
            icon: Smartphone
          },
          {
            title: "Instant Settlement",
            description: "Fast settlement cycles to ensure healthy cash flow.",
            icon: Zap
          },
          {
            title: "Lower MDR",
            description: "Benefit from competitive merchant discount rates on UPI transactions.",
            icon: CreditCard
          },
          {
            title: "Easy Integration",
            description: "Simple REST APIs with comprehensive documentation and SDKs.",
            icon: CheckCircle
          },
          {
            title: "Secure Transactions",
            description: "Bank-grade security with encrypted QR codes and secure callbacks.",
            icon: Shield
          },
          {
            title: "Analytics Dashboard",
            description: "Track payments, view trends, and download reports easily.",
            icon: BarChart3
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App."
          },
          {
            step: 2,
            title: "Get Credentials",
            description: "Receive your API keys and merchant ID."
          },
          {
            step: 3,
            title: "Generate QR",
            description: "Use API to generate dynamic or static QR codes."
          },
          {
            step: 4,
            title: "Display QR",
            description: "Show QR to customers on screen or print."
          },
          {
            step: 5,
            title: "Receive Payments",
            description: "Get instant notifications on successful payments."
          }
        ]}
        useCases={[
          "Retail Stores",
          "Restaurants & Cafes",
          "E-commerce COD",
          "Street Vendors",
          "Service Providers",
          "Subscription Payments",
          "Event Ticketing",
          "Donation Collection"
        ]}
        faqs={[
          {
            question: "What is a dynamic QR code?",
            answer: "A dynamic QR code contains a unique transaction ID and amount for each payment. This allows automatic reconciliation and instant payment confirmation without manual verification."
          },
          {
            question: "Which UPI apps are supported?",
            answer: "Our QR codes work with all UPI-enabled apps including Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, and bank-specific UPI apps."
          },
          {
            question: "How fast are payment notifications?",
            answer: "Payment notifications are sent in real-time, typically within 1-2 seconds of successful payment. We support both webhooks and polling mechanisms."
          },
          {
            question: "Can I customize the QR code appearance?",
            answer: "Yes, you can add your logo, change colors, and customize the QR code design while maintaining scannability."
          },
          {
            question: "What are the settlement timelines?",
            answer: "Standard settlement is T+1 (next business day). Faster settlement options are available for eligible merchants."
          }
        ]}
      />
    </>
  );
};

export default QrPaymentApiPage;
