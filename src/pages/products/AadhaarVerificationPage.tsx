import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import aadhaarImg from "@/assets/aadhaar-verification.svg";

const AadhaarVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Aadhaar Verification API | Secure Identity Verification | Eko</title>
        <meta name="description" content="Integrate Aadhaar Verification API to verify identity securely with consent-based, compliance-ready workflows." />
        <meta name="keywords" content="Aadhaar Verification API, Aadhaar KYC API, Identity Verification API, UIDAI Verification API, Digital KYC API" />
        <link rel="canonical" href="https://eko.in/products/aadhaar-verification-api" />
        <meta property="og:title" content="Aadhaar Verification API | Secure Identity Verification | Eko" />
        <meta property="og:description" content="Verify Aadhaar details through consent-based, real-time verification workflows." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Aadhaar Verification API"
        description="Verify Aadhaar details securely"
        heroTitle="Aadhaar Verification API for Secure Digital Identity"
        heroSubtitle="Verify Aadhaar details through consent-based, real-time verification workflows."
        category="verification"
        docsUrl="https://developers.eko.in/reference/aadhaar-verification-apis"
        heroImage={aadhaarImg}
        overview="The Aadhaar Verification API enables businesses to validate Aadhaar details securely as part of identity verification and KYC processes. It is designed for regulated onboarding, fraud prevention, and compliance-driven use cases."
        keyBenefits={[
          "Consent-based Aadhaar verification",
          "Faster customer onboarding",
          "Improved identity accuracy",
          "Reduced fraud and impersonation risk",
          "Scalable for high-volume KYC operations"
        ]}
        features={[
          { title: "Consent-Based Verification", description: "Aadhaar verification flows designed with user consent at the core." },
          { title: "Real-Time Responses", description: "Instant verification results with structured response payloads." },
          { title: "Automation Ready", description: "Seamlessly integrate into digital onboarding and KYC systems." },
          { title: "Scalable Architecture", description: "Built to handle large verification volumes reliably." }
        ]}
        whoShouldUse={[
          "Fintech companies and lenders",
          "Banks and NBFCs",
          "Marketplaces and platforms",
          "Enterprises with regulated onboarding requirements"
        ]}
        useCases={[
          "Customer KYC onboarding",
          "User identity verification",
          "Account opening workflows",
          "Compliance and due diligence checks"
        ]}
        trustAndCompliance={[
          "Consent-first verification approach",
          "Secure API authentication",
          "Encrypted data transmission",
          "Audit-ready verification logs"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents for activation." },
          { step: 3, title: "Integrate API", description: "Integrate Aadhaar Verification API." },
          { step: 4, title: "Go Live", description: "Start verifying Aadhaar details in production." }
        ]}
        leadForm={{
          title: "Get Aadhaar Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "kyc_volume", label: "Expected Monthly Aadhaar Verifications", type: "select", options: ["Less than 1,000", "1,000 – 10,000", "10,000 – 100,000", "100,000+"] }
          ],
          cta: "Request Aadhaar Verification API"
        }}
        faqs={[
          { question: "Is Aadhaar verification consent-based?", answer: "Yes, all Aadhaar verification flows are designed with explicit user consent at the core, ensuring transparency and compliance." },
          { question: "How fast is the verification?", answer: "Verification is real-time with instant results returned in structured response payloads." },
          { question: "Can it handle high volumes?", answer: "Yes, the architecture is built to handle large-scale KYC verification volumes reliably." },
          { question: "How do I integrate?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." }
        ]}
        inputOutputPreview={{
          apiName: "Aadhaar Verification",
          inputs: [],
          outputs: [],
          comingSoon: true,
        }}
      />
    </>
  );
};

export default AadhaarVerificationPage;
