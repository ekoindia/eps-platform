import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { UserCheck, Shield, Zap, CheckCircle, Briefcase, Building, FileText, Users } from "lucide-react";

const EmployeeVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Employee Verification API - Background Check | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Comprehensive employee background verification with Eko's API. Verify identity, education, employment history, and criminal records for secure hiring." 
        />
        <meta name="keywords" content="employee verification API, background check API, employment verification, education verification API, hiring verification, Eko API" />
        <link rel="canonical" href="https://eko.in/products/employee-verification-api" />
        <meta property="og:title" content="Employee Verification API - Background Check | Eko" />
        <meta property="og:description" content="Comprehensive employee background verification for secure hiring." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Employee Verification API"
        description="Comprehensive background verification for hiring"
        heroTitle="Employee Verification API"
        heroSubtitle="Verify employee backgrounds comprehensively - identity, education, employment history, and more. Make informed hiring decisions with authentic verification."
        category="verification"
        docsUrl="https://developers.eko.in/docs/employee-verification"
        features={[
          {
            title: "Identity Verification",
            description: "Verify PAN, Aadhaar, and other identity documents.",
            icon: UserCheck
          },
          {
            title: "Education Check",
            description: "Verify degrees, diplomas, and educational qualifications.",
            icon: FileText
          },
          {
            title: "Employment History",
            description: "Verify previous employment, designations, and tenure.",
            icon: Briefcase
          },
          {
            title: "Address Verification",
            description: "Physical address verification through field visits.",
            icon: Building
          },
          {
            title: "Criminal Records",
            description: "Check court records and criminal background.",
            icon: Shield
          },
          {
            title: "Reference Check",
            description: "Contact previous employers for reference verification.",
            icon: Users
          }
        ]}
        benefits={[
          {
            title: "Reduce Hiring Risk",
            description: "Identify discrepancies before making hiring decisions.",
            icon: Shield
          },
          {
            title: "Faster Onboarding",
            description: "Parallel verification reduces overall hiring time.",
            icon: Zap
          },
          {
            title: "Compliance Ready",
            description: "Meet regulatory requirements for employee verification.",
            icon: CheckCircle
          },
          {
            title: "Scalable Solution",
            description: "From 10 to 10,000 verifications - we scale with you.",
            icon: Users
          },
          {
            title: "Centralized Dashboard",
            description: "Track all verifications from a single dashboard.",
            icon: Building
          },
          {
            title: "Detailed Reports",
            description: "Comprehensive verification reports with findings.",
            icon: FileText
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create account and select verification types."
          },
          {
            step: 2,
            title: "Submit Request",
            description: "Upload candidate details via API or dashboard."
          },
          {
            step: 3,
            title: "Verification",
            description: "Our team conducts thorough verification."
          },
          {
            step: 4,
            title: "Get Report",
            description: "Receive detailed verification report."
          },
          {
            step: 5,
            title: "Take Action",
            description: "Make informed hiring decisions."
          }
        ]}
        useCases={[
          "Corporate Hiring",
          "IT & ITES Companies",
          "BFSI Sector",
          "Gig Economy",
          "Staffing Agencies",
          "Healthcare",
          "Education Sector",
          "Government Contractors"
        ]}
        faqs={[
          {
            question: "What types of verification are included?",
            answer: "We offer identity verification (PAN, Aadhaar), education verification, employment history, address verification, criminal records check, reference checks, and drug tests (optional)."
          },
          {
            question: "How long does verification take?",
            answer: "Digital verifications (identity, education) complete within 24-48 hours. Field verifications (address) take 3-5 days. Criminal record checks take 5-7 days depending on jurisdiction."
          },
          {
            question: "Is consent required from candidates?",
            answer: "Yes, candidate consent is mandatory. We provide consent management through digital authorization that candidates can complete on their mobile devices."
          },
          {
            question: "What if discrepancies are found?",
            answer: "Discrepancies are clearly highlighted in the report with details. We recommend allowing candidates to explain discrepancies before making final decisions."
          },
          {
            question: "Can we customize the verification package?",
            answer: "Yes, you can select specific verification types based on job role, industry requirements, and company policy. Custom packages are available for enterprise customers."
          }
        ]}
      />
    </>
  );
};

export default EmployeeVerificationPage;
