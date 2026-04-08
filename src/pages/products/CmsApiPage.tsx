import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Banknote, Shield, Zap, CheckCircle, Users, MapPin, FileText, Clock } from "lucide-react";
import cmsImg from "@/assets/assisted-cash-management.svg";

const CmsApiPage = () => {
  return (
    <>
      <Helmet>
        <title>CMS Cash Collection API - Cash Management Services | Eko India Financial Services</title>
        <meta
          name="description"
          content="Digitize cash collection with Eko's CMS API. Enable field agents to collect cash and instantly credit customer accounts. Perfect for NBFCs, insurance, and utilities."
        />
        <meta name="keywords" content="CMS API, cash collection API, cash management services, field collection API, NBFC collection API, Eko API" />
        {/* <link rel="canonical" href="https://eps.eko.in/products/cms-api" /> */}
        <meta property="og:title" content="CMS Cash Collection API | Eko" />
        <meta property="og:description" content="Digitize cash collection with instant account credits through field agents." />
        <meta property="og:type" content="website" />
      </Helmet>

      <ProductPageLayout
        title="CMS Cash Collection API"
        description="Digitize cash collection with field agents"
        heroTitle="Cash Collection API"
        heroSubtitle="Enable your field agents to collect cash and instantly credit customer accounts. Reduce collection costs, improve efficiency, and provide real-time visibility."
        category="payment"
        docsUrl="https://developers.eko.in/docs/cms"
        heroImage={cmsImg}
        features={[
          {
            title: "Field Agent App",
            description: "White-label mobile app for field agents to collect payments and issue receipts.",
            icon: Users
          },
          {
            title: "Real-time Credits",
            description: "Instant account credit upon cash collection with digital confirmation.",
            icon: Zap
          },
          {
            title: "GPS Tracking",
            description: "Track agent location and collection points for complete visibility.",
            icon: MapPin
          },
          {
            title: "Digital Receipts",
            description: "Auto-generated digital receipts sent to customers via SMS.",
            icon: FileText
          },
          {
            title: "Cash Limit Management",
            description: "Set daily and per-transaction cash limits for each agent.",
            icon: Banknote
          },
          {
            title: "Reconciliation",
            description: "Automated reconciliation with detailed collection reports.",
            icon: Clock
          }
        ]}
        benefits={[
          {
            title: "Reduce Collection Cost",
            description: "Lower operational costs with efficient agent management and routing.",
            icon: Banknote
          },
          {
            title: "Faster Realization",
            description: "Instant account credits eliminate delays in payment realization.",
            icon: Zap
          },
          {
            title: "Fraud Prevention",
            description: "GPS tracking, photo proof, and digital receipts prevent collection fraud.",
            icon: Shield
          },
          {
            title: "Customer Convenience",
            description: "Doorstep collection improves customer experience and retention.",
            icon: Users
          },
          {
            title: "Complete Visibility",
            description: "Real-time dashboard showing collection status across all agents.",
            icon: CheckCircle
          },
          {
            title: "Easy Integration",
            description: "Simple API integration with your existing loan or billing system.",
            icon: FileText
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account and submit KYC documents."
          },
          {
            step: 2,
            title: "Configure",
            description: "Set up collection accounts and agent limits."
          },
          {
            step: 3,
            title: "Onboard Agents",
            description: "Register field agents and distribute the app."
          },
          {
            step: 4,
            title: "Integrate",
            description: "Connect with your billing/loan system via API."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Start collecting with real-time tracking and credits."
          }
        ]}
        useCases={[
          "NBFC Loan Collection",
          "Insurance Premium Collection",
          "Utility Bill Collection",
          "Microfinance",
          "Chit Fund Collection",
          "Society Maintenance",
          "Subscription Collection",
          "Rental Collection"
        ]}
        faqs={[
          {
            question: "How does the agent app work?",
            answer: "Agents download our white-label app, log in with credentials, and can immediately start collecting. The app shows assigned customers, amounts due, and allows cash/digital collection with instant receipts."
          },
          {
            question: "Is there a limit on collection amount?",
            answer: "You can configure daily limits and per-transaction limits for each agent based on your risk policy. Higher limits require additional verification."
          },
          {
            question: "How is fraud prevented?",
            answer: "Multiple layers including GPS location logging, photo capture of cash, digital receipts sent directly to customers, and real-time reconciliation. Any discrepancy is flagged immediately."
          },
          {
            question: "Can we use our own collection app?",
            answer: "Yes, our APIs can be integrated into your existing mobile app. We provide SDKs and complete documentation for custom integration."
          },
          {
            question: "What reports are available?",
            answer: "Daily collection summary, agent-wise reports, location-based analytics, pending collections, and reconciliation reports. All reports can be exported or accessed via API."
          }
        ]}
      />
    </>
  );
};

export default CmsApiPage;
