import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { FileKey, Shield, Zap, CheckCircle, Files, Lock, UserCheck, Smartphone } from "lucide-react";

const DigilockerApiPage = () => {
  return (
    <>
      <Helmet>
        <title>DigiLocker API - Digital Document Verification | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Access authentic government documents via DigiLocker API. Verify Aadhaar, PAN, DL, RC, and more directly from government sources for paperless KYC." 
        />
        <meta name="keywords" content="DigiLocker API, digital document verification, government document API, paperless KYC, eKYC API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/digilocker-api" />
        <meta property="og:title" content="DigiLocker API - Digital Document Verification | Eko" />
        <meta property="og:description" content="Access authentic government documents via DigiLocker for paperless KYC." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="DigiLocker API"
        description="Access government documents digitally via DigiLocker"
        heroTitle="DigiLocker API"
        heroSubtitle="Access authentic government-issued documents directly from DigiLocker. Enable paperless KYC with verified documents including Aadhaar, PAN, DL, RC, and more."
        category="verification"
        docsUrl="https://developers.eko.in/docs/digilocker"
        features={[
          {
            title: "Multi-Document Access",
            description: "Access Aadhaar, PAN, DL, RC, Marksheets, and 50+ document types.",
            icon: Files
          },
          {
            title: "Government Verified",
            description: "Documents directly from issuing authorities via DigiLocker.",
            icon: Shield
          },
          {
            title: "Consent-based",
            description: "User authorizes access via OTP - fully compliant process.",
            icon: Lock
          },
          {
            title: "Paperless KYC",
            description: "Complete verification without physical document submission.",
            icon: CheckCircle
          },
          {
            title: "Document Download",
            description: "Retrieve digitally signed documents as PDF or XML.",
            icon: FileKey
          },
          {
            title: "Mobile OTP Flow",
            description: "Seamless OTP-based authorization for document access.",
            icon: Smartphone
          }
        ]}
        benefits={[
          {
            title: "100% Authentic",
            description: "Documents sourced directly from government - no fake documents.",
            icon: Shield
          },
          {
            title: "Faster Onboarding",
            description: "No document uploads - customers just authorize with OTP.",
            icon: Zap
          },
          {
            title: "Reduced Fraud",
            description: "Eliminate document forgery with verified government records.",
            icon: Lock
          },
          {
            title: "Compliance Ready",
            description: "Meets RBI and SEBI requirements for digital document verification.",
            icon: CheckCircle
          },
          {
            title: "Cost Savings",
            description: "No manual document verification - fully automated process.",
            icon: UserCheck
          },
          {
            title: "Better Experience",
            description: "Customers complete KYC in minutes without scanning documents.",
            icon: Smartphone
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create account and apply for DigiLocker access."
          },
          {
            step: 2,
            title: "Get Approval",
            description: "Complete verification for DigiLocker partner access."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Implement DigiLocker consent flow in your app."
          },
          {
            step: 4,
            title: "User Authorization",
            description: "Users authorize document access via OTP."
          },
          {
            step: 5,
            title: "Retrieve Documents",
            description: "Fetch verified documents for KYC completion."
          }
        ]}
        useCases={[
          "Bank Account Opening",
          "Loan Applications",
          "Insurance KYC",
          "Employee Onboarding",
          "Education Verification",
          "Government Services",
          "Telecom KYC",
          "Securities Account"
        ]}
        faqs={[
          {
            question: "What documents can be accessed?",
            answer: "You can access Aadhaar, PAN, Driving License, Vehicle RC, Class 10/12 Marksheets, Degree Certificates, Insurance Policies, and 50+ other government-issued documents."
          },
          {
            question: "How does user consent work?",
            answer: "Users receive an OTP on their DigiLocker-registered mobile number. Upon entering the OTP, they authorize your application to access specific documents. The consent is logged and auditable."
          },
          {
            question: "Is this compliant with regulations?",
            answer: "Yes, DigiLocker is a government-approved platform under the Information Technology Act. Documents fetched are legally valid and accepted by RBI, SEBI, IRDAI, and other regulators."
          },
          {
            question: "Can we store the documents?",
            answer: "Yes, you can download and store digitally signed documents as per your compliance requirements. Documents include digital signatures for authenticity verification."
          },
          {
            question: "What if a user doesn't have DigiLocker?",
            answer: "Users can create a DigiLocker account instantly using their Aadhaar number and mobile OTP. The process takes less than a minute."
          }
        ]}
      />
    </>
  );
};

export default DigilockerApiPage;
