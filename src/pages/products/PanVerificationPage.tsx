import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { CreditCard, User, Calendar, CheckCircle, Fingerprint } from "lucide-react";
import panImg from "@/assets/pan-verification.svg";

const PanVerificationPage = () => {
  const faqData = [
    { question: "How fast is PAN verification?", answer: "PAN verification is real-time with sub-second response times for instant identity validation." },
    { question: "What details are returned?", answer: "The API returns validated PAN holder name, PAN status, and other relevant identity details." },
    { question: "Is it suitable for high volumes?", answer: "Yes, the API is designed to handle large-scale verification volumes reliably without performance degradation." },
    { question: "How do I get started?", answer: "Sign up on Connect App, submit necessary documents, integrate the API, and start verifying PAN details." }
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "PAN Verification API",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web API",
        "description": "Instantly verify PAN details in real-time with 99.9% accuracy. Strengthen KYC compliance and reduce fraud for Fintechs and NBFCs.",
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqData.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>PAN Verification API | Real-Time PAN Validation | Eko</title>
        <meta name="description" content="Instantly verify PAN details in real-time with 99.9% accuracy. Strengthen KYC compliance and reduce fraud for Fintechs and NBFCs." />
        <meta name="keywords" content="PAN Verification API, PAN Validation API, KYC PAN API, PAN Check API, Identity Verification API" />
        <link rel="canonical" href="https://eko.in/products/pan-verification-api" />
        <meta property="og:title" content="PAN Verification API | Real-Time PAN Validation | Eko" />
        <meta property="og:description" content="Instantly verify PAN details in real-time with 99.9% accuracy. Strengthen KYC compliance and reduce fraud for Fintechs and NBFCs." />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      
      <ProductPageLayout
        title="PAN Verification API"
        description="Verify PAN details in real time"
        heroTitle="PAN Verification API for Instant Identity Validation"
        heroSubtitle="Verify PAN details in real time to strengthen KYC, reduce fraud, and accelerate onboarding."
        category="verification"
        docsUrl="https://eko.in/developers/eps/pan-verification-api/"
        overview="The PAN Verification API enables businesses to validate Permanent Account Number (PAN) details instantly. It is designed for compliance-driven onboarding, fraud prevention, and identity verification use cases across financial and enterprise platforms."
        keyBenefits={[
          "Instant PAN validation",
          "Improves KYC accuracy and speed",
          "Reduces onboarding fraud",
          "API-driven, automation-ready workflows",
          "Suitable for high-volume verifications"
        ]}
        features={[
          { title: "Real-Time PAN Validation", description: "Verify PAN details instantly with structured responses." },
          { title: "High Accuracy Responses", description: "Returns validated PAN information for reliable identity checks." },
          { title: "Automation Friendly", description: "Easily integrate into digital onboarding and KYC pipelines." },
          { title: "Scalable Verification", description: "Designed to support large volumes without performance impact." }
        ]}
        whoShouldUse={[
          "Fintech and financial institutions",
          "Marketplaces and platforms",
          "NBFCs and lenders",
          "Enterprises with KYC requirements"
        ]}
        useCases={[
          "Customer KYC verification",
          "Merchant and vendor onboarding",
          "Account opening workflows",
          "Compliance and due diligence checks"
        ]}
        trustAndCompliance={[
          "Compliance-aligned verification workflows",
          "Secure API authentication",
          "Encrypted data transmission",
          "Audit-ready verification logs"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App.", tip: "Takes less than 2 minutes" },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents for activation.", tip: "KYC docs verified in 24 hours" },
          { step: 3, title: "Integrate API", description: "Integrate PAN Verification API into your system.", tip: "API keys generated instantly" },
          { step: 4, title: "Go Live", description: "Start validating PAN details in production.", tip: "Sandbox available for testing" }
        ]}
        leadForm={{
          title: "Get PAN Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "verification_volume", label: "Expected Monthly Verifications", type: "select", options: ["Less than 1,000", "1,000 – 10,000", "10,000 – 100,000", "100,000+"] }
          ],
          cta: "Request PAN Verification API"
        }}
        faqs={faqData}
        inputOutputPreview={{
          apiName: "PAN Verification",
          inputs: [
            { label: "PAN Number", value: "ABCDE1234F", icon: CreditCard },
            { label: "Full Name", value: "Rajesh Kumar", icon: User },
            { label: "Date of Birth", value: "29/08/1994", icon: Calendar },
          ],
          outputs: [
            { label: "PAN Match", value: "✓ Matched" },
            { label: "Name Match", value: "✓ Matched" },
            { label: "DOB Match", value: "✓ Matched" },
            { label: "Gender", value: "Male" },
            { label: "Aadhaar Seeding Status", value: "Seeded", icon: Fingerprint },
          ],
        }}
      />
    </>
  );
};

export default PanVerificationPage;
