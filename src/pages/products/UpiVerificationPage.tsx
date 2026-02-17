import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";

const UpiVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>UPI ID Verification API | Verify UPI ID & Retrieve via Phone Number | Eko</title>
        <meta name="description" content="Verify UPI IDs in real time and retrieve UPI ID using phone number through a secure, well-documented API." />
        <meta name="keywords" content="UPI ID Verification API, UPI ID check API, Verify UPI ID, Retrieve UPI ID using phone number, VPA verification API, UPI verification API" />
        <link rel="canonical" href="https://eko.in/products/upi-verification-api" />
        <meta property="og:title" content="UPI ID Verification API | Verify UPI ID & Retrieve via Phone Number | Eko" />
        <meta property="og:description" content="Validate UPI IDs in real time and retrieve a UPI ID using a phone number to reduce failures." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="UPI ID Verification API"
        description="Verify UPI IDs and retrieve via phone number"
        heroTitle="UPI ID Verification API – Verify UPI ID with Ease"
        heroSubtitle="Validate UPI IDs in real time and retrieve a UPI ID using a phone number to reduce failures and improve payment accuracy."
        category="verification"
        docsUrl="https://eko.in/developers/eps/upi-id-verification-api/"
        overview="Eko's UPI ID Verification API is designed for payment systems that need real-time UPI ID validation. It supports verifying a UPI ID and retrieving a UPI ID using a phone number—helping you confirm payee identifiers before initiating transactions."
        keyBenefits={[
          "Real-time UPI ID verification",
          "Retrieve UPI ID using phone number",
          "Reduces wrong-handle payment attempts",
          "Well-documented integration flow",
          "24×7 manual integration support"
        ]}
        features={[
          { title: "Check UPI ID", description: "Validate whether a UPI ID is correct and usable before initiating a transfer." },
          { title: "Retrieve UPI ID Using Phone Number", description: "Fetch associated UPI ID details using a phone number to simplify payee discovery." },
          { title: "Secure, Simple and Robust", description: "Built for production-grade stability with straightforward integration steps." }
        ]}
        useCases={[
          "Pre-payment validation for UPI transfers",
          "Reducing payout/payment failures caused by incorrect UPI IDs",
          "Customer onboarding where UPI ID discovery is required",
          "Assisted payments (agent or retailer-led transactions)"
        ]}
        trustAndCompliance={[
          "Every API call is secured with one-time-use tokens generated using asymmetric cryptography",
          "Open-source libraries available to simplify and reduce integration errors"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Sign up on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents." },
          { step: 3, title: "Integrate API", description: "Integrate UPI ID Verification API." },
          { step: 4, title: "Go Live", description: "Start validating UPI IDs." }
        ]}
        leadForm={{
          title: "Get UPI ID Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "use_case", label: "Primary Use Case", type: "select", options: ["Pre-payment UPI ID Validation", "UPI ID Retrieval via Phone Number", "Assisted Payments (Agent/Retail)", "Multiple Use Cases"] },
            { name: "expected_volume", label: "Expected Monthly Verifications", type: "select", options: ["Less than 10,000", "10,000 – 100,000", "100,000 – 1,000,000", "1,000,000+"] }
          ],
          cta: "Request UPI ID Verification API"
        }}
        faqs={[
          { question: "Can I retrieve a UPI ID using a phone number?", answer: "Yes, the API supports fetching associated UPI ID details using a phone number to simplify payee discovery." },
          { question: "How is the API secured?", answer: "Every API call is secured with one-time-use tokens generated using asymmetric cryptography." },
          { question: "Is 24×7 support available?", answer: "Yes, 24×7 manual integration support is available to help you integrate smoothly." },
          { question: "What use cases does it support?", answer: "Pre-payment validation, payout failure reduction, customer onboarding with UPI ID discovery, and assisted agent/retailer payments." }
        ]}
        inputOutputPreview={{
          apiName: "UPI Verification",
          inputs: [],
          outputs: [],
          comingSoon: true,
        }}
      />
    </>
  );
};

export default UpiVerificationPage;
