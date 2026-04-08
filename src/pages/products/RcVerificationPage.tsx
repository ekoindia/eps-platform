import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Car } from "lucide-react";

const RcVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>RC Verification API | Vehicle Registration Validation | Eko</title>
        <meta name="description" content="Integrate RC Verification API to validate vehicle registration details instantly for compliance, onboarding, and fraud prevention." />
        <meta name="keywords" content="RC Verification API, Vehicle RC Verification API, Vehicle Registration Check API, RC Validation API, Vehicle Verification API" />
        {/* <link rel="canonical" href="https://eko.in/products/rc-verification-api" /> */}
        <meta property="og:title" content="RC Verification API | Vehicle Registration Validation | Eko" />
        <meta property="og:description" content="Verify vehicle registration details in real time to ensure compliance and reduce fraud." />
        <meta property="og:type" content="website" />
      </Helmet>

      <ProductPageLayout
        title="RC Verification API"
        description="Vehicle registration validation"
        heroTitle="RC Verification API for Vehicle Identity Validation"
        heroSubtitle="Verify vehicle registration details in real time to ensure compliance and reduce fraud."
        category="verification"
        docsUrl="https://eko.in/developers/eps/rc-verification-api/"
        overview="The RC Verification API enables businesses to validate vehicle registration certificate (RC) details instantly. It is designed for platforms that onboard drivers, vehicles, or assets where vehicle authenticity and ownership verification are critical."
        keyBenefits={[
          "Instant RC verification",
          "Confirms vehicle ownership and registration status",
          "Reduces vehicle-related fraud",
          "Improves onboarding accuracy",
          "Automation-ready for digital workflows"
        ]}
        features={[
          { title: "Real-Time RC Validation", description: "Verify vehicle registration details instantly with structured response data." },
          { title: "Vehicle Identity Confirmation", description: "Validate ownership and registration information before onboarding or activation." },
          { title: "Automation Friendly", description: "Seamlessly integrates into digital onboarding and verification pipelines." },
          { title: "High-Volume Ready", description: "Designed to support large-scale verification needs reliably." }
        ]}
        whoShouldUse={[
          "Mobility and ride-hailing platforms",
          "Logistics and delivery companies",
          "Fleet operators",
          "Enterprises verifying vehicle assets"
        ]}
        useCases={[
          "Driver and vehicle onboarding",
          "Logistics and mobility platforms",
          "Asset and fleet verification",
          "Compliance and due diligence checks"
        ]}
        trustAndCompliance={[
          "Secure API authentication",
          "Encrypted verification communication",
          "Compliance-aligned data handling",
          "Audit-ready verification logs"
        ]}
        integrationSteps={[
          { step: 1, title: "Sign Up", description: "Create an account on Connect App." },
          { step: 2, title: "Submit Documents", description: "Submit necessary documents for activation." },
          { step: 3, title: "Integrate API", description: "Add RC verification to your workflow." },
          { step: 4, title: "Go Live", description: "Start verifying vehicle registrations in production." }
        ]}
        leadForm={{
          title: "Get RC Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "verification_volume", label: "Expected Monthly RC Verifications", type: "select", options: ["Less than 1,000", "1,000 – 10,000", "10,000 – 100,000", "100,000+"] }
          ],
          cta: "Request RC Verification API"
        }}
        faqs={[
          { question: "What details are returned?", answer: "Vehicle registration number, owner name, make/model, registration status, and more." },
          { question: "Is pan-India coverage available?", answer: "Yes, we cover all states and union territories through official database integration." },
          { question: "Can I verify commercial vehicles?", answer: "Yes, commercial vehicles return additional details like permit type and fitness status." },
          { question: "How do I get started?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." }
        ]}
        inputOutputPreview={{
          apiName: "RC Verification",
          inputs: [
            { label: "Vehicle Number", value: "MH01AB1234", icon: Car },
          ],
          outputs: [
            { label: "Owner Name", value: "Rajesh Kumar" },
            { label: "Vehicle Category", value: "LMV" },
            { label: "Address", value: "Mumbai, Maharashtra" },
            { label: "RC Status", value: "Active" },
            { label: "Vehicle Color", value: "White" },
            { label: "RC Expiry Date", value: "15/06/2035" },
            { label: "Body Type", value: "Sedan" },
            { label: "Manufacturer", value: "Maruti Suzuki" },
            { label: "Model", value: "Swift Dzire" },
            { label: "Chassis Number", value: "MA3FJEB1S00****" },
            { label: "Engine Number", value: "K12MN****" },
            { label: "Manufacturing Year", value: "2020" },
            { label: "Insurance Company", value: "ICICI Lombard" },
            { label: "Insurance Valid Upto", value: "20/12/2025" },
            { label: "Registration Date", value: "15/06/2020" },
          ],
        }}
      />
    </>
  );
};

export default RcVerificationPage;
