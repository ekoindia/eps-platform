import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";

const DigilockerApiPage = () => {
  return (
    <>
      <Helmet>
        <title>DigiLocker API | Secure Digital Document Access | Eko</title>
        <meta name="description" content="Integrate DigiLocker API to access and verify user documents securely through consent-based digital workflows." />
        <meta name="keywords" content="DigiLocker API, Digital Document Verification API, Consent Based Document Access, Paperless KYC API, Government Document API" />
        <link rel="canonical" href="https://eko.in/products/digilocker-api" />
        <meta property="og:title" content="DigiLocker API | Secure Digital Document Access | Eko" />
        <meta property="og:description" content="Access and verify user documents digitally through consent-driven, paperless workflows." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="DigiLocker API"
        description="Secure digital document verification"
        heroTitle="DigiLocker API for Secure Digital Document Verification"
        heroSubtitle="Access and verify user documents digitally through consent-driven, paperless workflows."
        category="verification"
        docsUrl="https://eko.in/developers/eps/digilocker-api/"
        overview="The DigiLocker API enables businesses to fetch and verify user documents digitally with explicit consent. It eliminates manual document collection, reduces fraud, and accelerates onboarding through trusted digital records."
        keyBenefits={[
          "Paperless document verification",
          "Consent-based access to user documents",
          "Faster onboarding and KYC completion",
          "Reduced document fraud and forgery risk",
          "Improved user experience"
        ]}
        features={[
          { title: "Consent-Based Document Access", description: "Fetch documents only after explicit user consent, ensuring transparency and trust." },
          { title: "Digital Document Retrieval", description: "Access verified digital documents without physical copies." },
          { title: "Automation Ready", description: "Integrates seamlessly into digital onboarding and compliance systems." },
          { title: "Scalable Architecture", description: "Designed to handle high-volume document access reliably." }
        ]}
        whoShouldUse={[
          "Banks and NBFCs",
          "Fintech and lending platforms",
          "Enterprises with digital onboarding",
          "Platforms requiring document verification"
        ]}
        useCases={[
          "Digital KYC and onboarding",
          "Loan and credit processing",
          "Customer identity verification",
          "Compliance and due diligence workflows"
        ]}
        trustAndCompliance={[
          "Consent-first data access",
          "Secure API authentication",
          "Encrypted document transmission",
          "Audit-ready access logs"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents for activation." },
          { step: 3, title: "Integrate API", description: "Integrate DigiLocker API into your system." },
          { step: 4, title: "Go Live", description: "Start accessing digital documents in production." }
        ]}
        leadForm={{
          title: "Get DigiLocker API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "document_use_case", label: "Primary Document Use Case", type: "select", options: ["KYC / Onboarding", "Loan Processing", "Compliance Verification", "Multiple Use Cases"] }
          ],
          cta: "Request DigiLocker API Access"
        }}
        faqs={[
          { question: "Is DigiLocker access consent-based?", answer: "Yes, documents are fetched only after explicit user consent, ensuring full transparency." },
          { question: "What documents can be accessed?", answer: "You can access government-issued digital documents like Aadhaar, PAN, driving license, and more through DigiLocker." },
          { question: "Does it eliminate physical document collection?", answer: "Yes, the API enables fully paperless document verification, eliminating manual collection." },
          { question: "How do I integrate?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." }
        ]}
        inputOutputPreview={{
          apiName: "DigiLocker",
          inputs: [],
          outputs: [],
          comingSoon: true,
        }}
      />
    </>
  );
};

export default DigilockerApiPage;
