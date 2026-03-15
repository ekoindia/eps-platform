import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { CreditCard } from "lucide-react";
import dlImg from "@/assets/dl-verification-2.png";

const DlVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Driving License Verification API | Real-Time DL Validation | Eko</title>
        <meta name="description" content="Integrate Driving License Verification API to validate driving license details instantly for KYC, onboarding, and compliance checks." />
        <meta name="keywords" content="Driving License Verification API, DL Verification API, Driving Licence Check API, Identity Verification API, KYC DL API" />
        <link rel="canonical" href="https://eko.in/products/dl-verification-api" />
        <meta property="og:title" content="Driving License Verification API | Real-Time DL Validation | Eko" />
        <meta property="og:description" content="Verify driving license details in real time to strengthen KYC and reduce identity fraud." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Driving License Verification API"
        description="Real-time DL validation"
        heroTitle="Driving License Verification API for Identity Validation"
        heroSubtitle="Verify driving license details in real time to strengthen KYC and reduce identity fraud."
        category="verification"
        docsUrl="https://developers.eko.in/reference/driving-license"
        heroImage={dlImg}
        overview="The Driving License Verification API enables businesses to validate driving license details instantly as part of identity verification and onboarding workflows. It helps confirm user identity, reduce impersonation risk, and meet compliance requirements."
        keyBenefits={[
          "Instant driving license verification",
          "Improves identity validation accuracy",
          "Reduces impersonation and document fraud",
          "Supports digital KYC workflows",
          "Scales for high-volume verification needs"
        ]}
        features={[
          { title: "Real-Time DL Validation", description: "Verify driving license details instantly with structured verification responses." },
          { title: "Identity Confirmation", description: "Use DL data as a trusted identity signal during onboarding." },
          { title: "Automation Ready", description: "Seamlessly integrates into digital KYC and onboarding pipelines." },
          { title: "High-Volume Support", description: "Built to handle large verification volumes reliably." }
        ]}
        whoShouldUse={[
          "Fintech and lending platforms",
          "Mobility and logistics companies",
          "Marketplaces onboarding drivers or agents",
          "Enterprises with identity verification needs"
        ]}
        useCases={[
          "Customer identity verification",
          "KYC onboarding workflows",
          "Driver or delivery partner onboarding",
          "Compliance and due diligence checks"
        ]}
        trustAndCompliance={[
          "Secure API authentication",
          "Encrypted data transmission",
          "Compliance-aligned verification workflows",
          "Audit-ready verification logs"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents for activation." },
          { step: 3, title: "Integrate API", description: "Integrate DL Verification API." },
          { step: 4, title: "Go Live", description: "Start verifying driving licenses in production." }
        ]}
        leadForm={{
          title: "Get Driving License Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "verification_volume", label: "Expected Monthly DL Verifications", type: "select", options: ["Less than 1,000", "1,000 – 10,000", "10,000 – 100,000", "100,000+"] }
          ],
          cta: "Request DL Verification API"
        }}
        faqs={[
          { question: "How fast is DL verification?", answer: "Verification is real-time with instant structured responses for driving license details." },
          { question: "Can I use it for driver onboarding?", answer: "Yes, it's ideal for onboarding drivers, delivery partners, and agents requiring identity confirmation." },
          { question: "Does it support high volumes?", answer: "Yes, the API is built to handle large verification volumes reliably." },
          { question: "How do I integrate?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." }
        ]}
        inputOutputPreview={{
          apiName: "DL Verification",
          inputs: [
            { label: "Driving License Number", value: "MH0220190001234", icon: CreditCard },
          ],
          outputs: [
            { label: "Name", value: "Rajesh Kumar" },
            { label: "Date of Birth", value: "29/08/1994" },
            { label: "Address", value: "123, Andheri West, Mumbai" },
            { label: "Date of Issue", value: "15/03/2019" },
            { label: "DL Validity", value: "14/03/2039" },
            { label: "Father's/Husband's Name", value: "Suresh Kumar" },
            { label: "Badge Details", value: "Transport" },
            { label: "COV Details", value: "LMV, MCWG" },
          ],
        }}
      />
    </>
  );
};

export default DlVerificationPage;
