import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Building, FileText } from "lucide-react";

const GstVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>GST Verification API | Real-Time GSTIN Validation | Eko</title>
        <meta name="description" content="Integrate GST Verification API to validate GSTIN details instantly for vendor onboarding, compliance, and fraud prevention." />
        <meta name="keywords" content="GST Verification API, GSTIN Verification API, GST Check API, Business Verification API, GST Validation API" />
        <link rel="canonical" href="https://eko.in/products/gst-verification-api" />
        <meta property="og:title" content="GST Verification API | Real-Time GSTIN Validation | Eko" />
        <meta property="og:description" content="Verify GSTIN details in real time to ensure compliant and trustworthy business onboarding." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="GST Verification API"
        description="Validate GSTIN details instantly"
        heroTitle="GST Verification API for Business Identity Validation"
        heroSubtitle="Verify GSTIN details in real time to ensure compliant and trustworthy business onboarding."
        category="verification"
        docsUrl="https://eko.in/developers/eps/gst-verification-api/"
        overview="The GST Verification API enables businesses to validate GSTIN details instantly. It is designed for compliance-driven onboarding, vendor verification, and business identity checks where accuracy and traceability are critical."
        keyBenefits={[
          "Instant GSTIN verification",
          "Improves vendor and merchant onboarding accuracy",
          "Reduces compliance and fraud risk",
          "Automates business verification workflows",
          "Scales for high-volume verification needs"
        ]}
        features={[
          { title: "Real-Time GSTIN Validation", description: "Verify GST registration details instantly with structured responses." },
          { title: "Business Identity Confirmation", description: "Validate legal business information before onboarding or payouts." },
          { title: "Automation Ready", description: "Easily integrate into KYB and compliance pipelines." },
          { title: "High-Volume Support", description: "Built to handle large verification volumes reliably." }
        ]}
        whoShouldUse={[
          "Marketplaces and B2B platforms",
          "Fintechs onboarding merchants or vendors",
          "Enterprises with supplier verification needs",
          "Compliance-driven organizations"
        ]}
        useCases={[
          "Vendor and supplier onboarding",
          "Merchant verification for platforms",
          "Compliance and due diligence checks",
          "B2B onboarding workflows"
        ]}
        trustAndCompliance={[
          "Secure API authentication",
          "Encrypted verification communication",
          "Compliance-aligned data handling",
          "Audit-ready verification records"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents for activation." },
          { step: 3, title: "Integrate API", description: "Integrate GST Verification API." },
          { step: 4, title: "Go Live", description: "Start verifying GSTIN details in production." }
        ]}
        leadForm={{
          title: "Get GST Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "verification_volume", label: "Expected Monthly GST Verifications", type: "select", options: ["Less than 1,000", "1,000 – 10,000", "10,000 – 100,000", "100,000+"] }
          ],
          cta: "Request GST Verification API"
        }}
        faqs={[
          { question: "What details are returned in GST verification?", answer: "The API returns GSTIN status, legal business name, trade name, registration date, and compliance filing status." },
          { question: "Can I verify multiple GSTINs?", answer: "Yes, the API supports high-volume verification for batch processing needs." },
          { question: "Is the data real-time?", answer: "Yes, GSTIN details are verified in real time against official records." },
          { question: "How do I get started?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and start verifying." }
        ]}
        inputOutputPreview={{
          apiName: "GST Verification",
          inputs: [
            { label: "GST Number", value: "29ABCDE1234F1Z5", icon: FileText },
            { label: "Company Name", value: "Acme Pvt Ltd", icon: Building },
          ],
          outputs: [
            { label: "Legal Name", value: "Acme Private Limited" },
            { label: "Address", value: "123, MG Road, Bangalore" },
            { label: "Registration Date", value: "01/07/2017" },
            { label: "GST Status", value: "Active" },
            { label: "Constitution", value: "Private Limited" },
            { label: "Nature of Business", value: "Wholesale" },
            { label: "Taxpayer Type", value: "Regular" },
            { label: "Status Code", value: "ACT" },
          ],
        }}
      />
    </>
  );
};

export default GstVerificationPage;
