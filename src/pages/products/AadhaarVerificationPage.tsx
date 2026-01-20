import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Fingerprint, Shield, Zap, CheckCircle, Users, Lock, FileText, MessageSquare } from "lucide-react";

const AadhaarVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Aadhaar Verification API - eKYC & Authentication | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Secure Aadhaar-based identity verification with Eko's eKYC API. OTP verification, demographic check, biometric authentication for compliant customer onboarding." 
        />
        <meta name="keywords" content="Aadhaar verification API, eKYC API, Aadhaar eKYC, Aadhaar OTP verification, UIDAI API, identity verification, Eko API" />
        <link rel="canonical" href="https://eko.in/products/aadhaar-verification-api" />
        <meta property="og:title" content="Aadhaar Verification API - eKYC & Authentication | Eko" />
        <meta property="og:description" content="Secure Aadhaar-based identity verification with OTP and biometric authentication." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Aadhaar Verification API"
        description="Secure Aadhaar-based identity verification for compliant onboarding"
        heroTitle="Aadhaar eKYC Verification"
        heroSubtitle="Verify customer identity instantly with UIDAI-powered Aadhaar verification. Support for OTP-based eKYC, demographic verification, and biometric authentication."
        category="verification"
        docsUrl="https://developers.eko.in/docs/identity"
        features={[
          {
            title: "OTP-based eKYC",
            description: "Verify Aadhaar using OTP sent to registered mobile number for paperless KYC.",
            icon: MessageSquare
          },
          {
            title: "Demographic Verification",
            description: "Verify name, date of birth, gender, and address against Aadhaar records.",
            icon: Users
          },
          {
            title: "Biometric Authentication",
            description: "Fingerprint and iris-based verification for high-security use cases.",
            icon: Fingerprint
          },
          {
            title: "UIDAI Certified",
            description: "Direct integration with UIDAI for authentic and reliable verification.",
            icon: Shield
          },
          {
            title: "Consent Management",
            description: "Built-in consent workflow compliant with UIDAI and data protection regulations.",
            icon: CheckCircle
          },
          {
            title: "Secure Data Handling",
            description: "Data encrypted in transit and at rest, with no storage of Aadhaar numbers.",
            icon: Lock
          }
        ]}
        benefits={[
          {
            title: "Instant Verification",
            description: "Complete eKYC in seconds with real-time UIDAI authentication.",
            icon: Zap
          },
          {
            title: "Regulatory Compliant",
            description: "Fully compliant with RBI, UIDAI, and data protection regulations.",
            icon: Shield
          },
          {
            title: "Paperless Onboarding",
            description: "Eliminate paper-based KYC with digital Aadhaar verification.",
            icon: FileText
          },
          {
            title: "Reduced Fraud",
            description: "Prevent identity fraud with authentic UIDAI-verified data.",
            icon: Lock
          },
          {
            title: "Better Conversion",
            description: "Faster onboarding leads to higher customer conversion rates.",
            icon: Users
          },
          {
            title: "Multiple Modes",
            description: "Choose between OTP, biometric, or demographic verification based on use case.",
            icon: CheckCircle
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Register on Connect App and submit business details."
          },
          {
            step: 2,
            title: "Get AUA/KUA License",
            description: "Obtain necessary UIDAI certification (we can guide you)."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Implement our Aadhaar verification API in your application."
          },
          {
            step: 4,
            title: "Setup Consent",
            description: "Configure consent workflow as per UIDAI guidelines."
          },
          {
            step: 5,
            title: "Test & Launch",
            description: "Complete UAT testing and go live with production credentials."
          }
        ]}
        useCases={[
          "Bank Account Opening",
          "Loan Disbursement",
          "Insurance Onboarding",
          "Mutual Fund KYC",
          "Telecom SIM Activation",
          "Government Schemes",
          "Employee Verification",
          "Property Registration"
        ]}
        faqs={[
          {
            question: "What is Aadhaar eKYC?",
            answer: "Aadhaar eKYC (electronic Know Your Customer) is a paperless identity verification process using Aadhaar. It allows instant verification through OTP or biometrics, eliminating the need for physical document submission."
          },
          {
            question: "Is OTP-based eKYC legally valid?",
            answer: "Yes, OTP-based Aadhaar eKYC is legally valid for most use cases as per RBI and UIDAI guidelines. However, some regulated entities may require additional verification."
          },
          {
            question: "What data is returned in eKYC?",
            answer: "eKYC returns masked Aadhaar number, full name, date of birth, gender, address, and photograph (in case of biometric verification). Mobile and email may be included based on consent."
          },
          {
            question: "Do you store Aadhaar data?",
            answer: "No, we do not store Aadhaar numbers or any sensitive personal information. All data handling is compliant with UIDAI regulations and data protection laws."
          },
          {
            question: "What is the success rate?",
            answer: "Our Aadhaar verification service has a 98%+ success rate, depending on the quality of mobile number linking and customer cooperation during OTP entry."
          }
        ]}
      />
    </>
  );
};

export default AadhaarVerificationPage;
