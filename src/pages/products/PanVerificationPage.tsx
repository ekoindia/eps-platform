import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { FileCheck, Shield, Zap, CheckCircle, Users, Building, Clock, Database } from "lucide-react";

const PanVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>PAN Verification API - Instant PAN Card Validation | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify PAN cards instantly with Eko's NSDL-powered PAN Verification API. Real-time validation, name matching, and fraud prevention for seamless customer onboarding." 
        />
        <meta name="keywords" content="PAN verification API, PAN card verification, NSDL PAN API, KYC API, identity verification API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/pan-verification-api" />
        <meta property="og:title" content="PAN Verification API - Instant PAN Card Validation | Eko" />
        <meta property="og:description" content="Verify PAN cards instantly with NSDL-powered real-time validation and name matching." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="PAN Verification API"
        description="Instant PAN card verification with name matching and fraud prevention"
        heroTitle="PAN Verification Made Easy"
        heroSubtitle="Customer onboarding & verification simplified with Eko's NSDL-powered PAN Verification API. Validate PAN cards instantly and prevent fraud with real-time verification."
        category="verification"
        docsUrl="https://developers.eko.in/docs/identity"
        features={[
          {
            title: "Real-time Verification",
            description: "Instant PAN validation with NSDL database lookup and real-time response.",
            icon: Zap
          },
          {
            title: "Name Matching",
            description: "Get the name associated with PAN for identity verification and fraud prevention.",
            icon: Users
          },
          {
            title: "PAN Status Check",
            description: "Verify if PAN is active, inactive, or flagged for any issues.",
            icon: CheckCircle
          },
          {
            title: "Fraud Prevention",
            description: "Detect fake or invalid PAN numbers before onboarding customers.",
            icon: Shield
          },
          {
            title: "Bulk Verification",
            description: "Process multiple PAN verifications in a single API call for bulk operations.",
            icon: Database
          },
          {
            title: "Detailed Response",
            description: "Get comprehensive PAN details including category, holder type, and more.",
            icon: FileCheck
          }
        ]}
        benefits={[
          {
            title: "Seamless Integration",
            description: "Well-documented API that's easy to understand. We provide 24x7 manual integration support.",
            icon: CheckCircle
          },
          {
            title: "Robust & Authentic",
            description: "Backend powered by robust code, proactively maintained to keep your API running.",
            icon: Building
          },
          {
            title: "NSDL Powered",
            description: "Direct integration with NSDL database for authentic and reliable verification.",
            icon: Shield
          },
          {
            title: "High Accuracy",
            description: "99.9% accuracy rate with intelligent name matching algorithms.",
            icon: Zap
          },
          {
            title: "Fast Response",
            description: "Sub-second response times for seamless user experience.",
            icon: Clock
          },
          {
            title: "Cost Effective",
            description: "Competitive pricing with volume-based discounts for high-volume partners.",
            icon: FileCheck
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App to get started."
          },
          {
            step: 2,
            title: "Submit Documents",
            description: "Complete the KYC process with necessary business documents."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Use our documentation to integrate the PAN Verification API."
          },
          {
            step: 4,
            title: "Go Live",
            description: "Start verifying PAN cards and onboarding customers."
          }
        ]}
        useCases={[
          "Customer Onboarding",
          "KYC Verification",
          "Loan Applications",
          "Account Opening",
          "Insurance Verification",
          "Employee Verification",
          "Vendor Onboarding",
          "E-commerce Sellers"
        ]}
        faqs={[
          {
            question: "How does PAN verification work?",
            answer: "Simply enter the PAN number in your application. Our API sends it to NSDL, which returns the name and other details associated with the PAN. The entire process takes less than a second."
          },
          {
            question: "Is the verification real-time?",
            answer: "Yes, all verifications are performed in real-time against NSDL's database. You get instant results within milliseconds."
          },
          {
            question: "What information is returned?",
            answer: "The API returns PAN holder name, PAN status (active/inactive), PAN category (individual/company), and other relevant details for verification."
          },
          {
            question: "Is there a limit on API calls?",
            answer: "API call limits depend on your plan. We offer flexible plans based on your verification volume requirements."
          },
          {
            question: "Is this service compliant with regulations?",
            answer: "Yes, our PAN verification service is fully compliant with RBI and government regulations for KYC and identity verification."
          }
        ]}
      />
    </>
  );
};

export default PanVerificationPage;
