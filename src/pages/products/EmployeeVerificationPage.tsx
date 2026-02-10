import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";

const EmployeeVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Employee Verification API | Workforce Background Checks | Eko</title>
        <meta name="description" content="Integrate Employee Verification API to verify employee identity and details digitally for hiring, compliance, and risk management." />
        <meta name="keywords" content="Employee Verification API, Employee Background Check API, Workforce Verification API, HR Verification API, Employee KYC API" />
        <link rel="canonical" href="https://eko.in/products/employee-verification-api" />
        <meta property="og:title" content="Employee Verification API | Workforce Background Checks | Eko" />
        <meta property="og:description" content="Verify employee identity and details digitally to reduce hiring risk and ensure compliance." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Employee Verification API"
        description="Digital employee identity verification"
        heroTitle="Employee Verification API for Trusted Workforce Onboarding"
        heroSubtitle="Verify employee identity and details digitally to reduce hiring risk and ensure compliance."
        category="verification"
        docsUrl="https://eko.in/developers/eps/employee-verification-api/"
        overview="The Employee Verification API enables organizations to verify employee identity and related details digitally during hiring and onboarding. It is designed to reduce hiring risk, improve compliance, and streamline workforce verification workflows."
        keyBenefits={[
          "Digital employee verification",
          "Reduced hiring and impersonation risk",
          "Faster onboarding cycles",
          "Automation-ready HR workflows",
          "Scalable for large hiring volumes"
        ]}
        features={[
          { title: "Employee Identity Verification", description: "Verify employee identity details digitally as part of onboarding." },
          { title: "Hiring Risk Reduction", description: "Detect inconsistencies early to reduce impersonation and compliance risk." },
          { title: "Automation Friendly", description: "Integrates seamlessly into HRMS, ATS, and onboarding platforms." },
          { title: "High-Volume Support", description: "Designed to support large-scale hiring and verification needs." }
        ]}
        whoShouldUse={[
          "Enterprises and large employers",
          "HR tech platforms",
          "Gig economy and staffing companies",
          "Organizations with compliance-driven hiring"
        ]}
        useCases={[
          "Pre-employment verification",
          "Contractor and gig worker onboarding",
          "Workforce compliance checks",
          "Enterprise HR verification workflows"
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
          { step: 3, title: "Integrate API", description: "Integrate Employee Verification API." },
          { step: 4, title: "Go Live", description: "Start verifying employees in production." }
        ]}
        leadForm={{
          title: "Get Employee Verification API Access",
          fields: [
            { name: "company_name", label: "Company Name", type: "text", required: true },
            { name: "contact_person", label: "Contact Person", type: "text", required: true },
            { name: "email", label: "Business Email", type: "email", required: true },
            { name: "mobile", label: "Mobile Number", type: "tel", required: true },
            { name: "hiring_volume", label: "Expected Monthly Verifications", type: "select", options: ["Less than 100", "100 – 1,000", "1,000 – 10,000", "10,000+"] }
          ],
          cta: "Request Employee Verification API"
        }}
        faqs={[
          { question: "What can be verified?", answer: "Employee identity details including name, ID documents, and related information can be verified digitally." },
          { question: "Does it integrate with HRMS?", answer: "Yes, the API integrates seamlessly into HRMS, ATS, and onboarding platforms." },
          { question: "Can it handle large hiring volumes?", answer: "Yes, the API is designed to support large-scale hiring and verification needs." },
          { question: "How do I get started?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and start verifying." }
        ]}
      />
    </>
  );
};

export default EmployeeVerificationPage;
