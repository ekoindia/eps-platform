import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Receipt, Shield, Zap, CheckCircle, Building, FileText, Search, Database } from "lucide-react";

const GstVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>GST Verification API - GSTIN Validation | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify GST registration and compliance status with Eko's GST Verification API. GSTIN validation, filing status, business details for vendor and customer verification." 
        />
        <meta name="keywords" content="GST verification API, GSTIN validation API, GST compliance check, GST filing status API, business verification API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/gst-verification-api" />
        <meta property="og:title" content="GST Verification API - GSTIN Validation | Eko" />
        <meta property="og:description" content="Verify GST registration and compliance status for vendor and customer verification." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="GST Verification API"
        description="Verify GST registration and compliance status instantly"
        heroTitle="GST Verification API"
        heroSubtitle="Verify GST registration, compliance status, and business details instantly. Essential for vendor onboarding, B2B transactions, and regulatory compliance."
        category="verification"
        docsUrl="https://developers.eko.in/docs/gst-verification"
        features={[
          {
            title: "GSTIN Validation",
            description: "Verify if GSTIN is valid, active, and registered with GST network.",
            icon: CheckCircle
          },
          {
            title: "Filing Status",
            description: "Check GST return filing status and compliance history.",
            icon: FileText
          },
          {
            title: "Business Details",
            description: "Get registered business name, address, and constitution type.",
            icon: Building
          },
          {
            title: "Tax Payer Type",
            description: "Identify if registered as regular, composition, or casual taxpayer.",
            icon: Receipt
          },
          {
            title: "HSN/SAC Codes",
            description: "Get principal place of business and nature of business activities.",
            icon: Search
          },
          {
            title: "Bulk Verification",
            description: "Verify multiple GSTINs in a single API call for bulk operations.",
            icon: Database
          }
        ]}
        benefits={[
          {
            title: "Vendor Compliance",
            description: "Ensure vendors are GST-compliant before onboarding or transactions.",
            icon: CheckCircle
          },
          {
            title: "Input Tax Credit",
            description: "Verify supplier GSTIN to ensure eligible input tax credit claims.",
            icon: Receipt
          },
          {
            title: "Reduce Risk",
            description: "Avoid transacting with cancelled or suspended GST registrations.",
            icon: Shield
          },
          {
            title: "Instant Results",
            description: "Real-time verification from GST network for quick decisions.",
            icon: Zap
          },
          {
            title: "Automated Compliance",
            description: "Integrate into procurement workflow for automated compliance checks.",
            icon: Building
          },
          {
            title: "Detailed Reports",
            description: "Generate compliance reports for audit and regulatory purposes.",
            icon: FileText
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App."
          },
          {
            step: 2,
            title: "Get Credentials",
            description: "Receive sandbox and production API credentials."
          },
          {
            step: 3,
            title: "Integrate",
            description: "Add GST verification to your vendor onboarding flow."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with sample GSTINs in sandbox environment."
          },
          {
            step: 5,
            title: "Deploy",
            description: "Go live with production credentials."
          }
        ]}
        useCases={[
          "Vendor Onboarding",
          "Procurement Systems",
          "E-invoicing Validation",
          "B2B Marketplaces",
          "Lending Platforms",
          "Trade Finance",
          "Supply Chain Verification",
          "Compliance Audits"
        ]}
        faqs={[
          {
            question: "What information can I verify with GST API?",
            answer: "You can verify GSTIN validity, registration status, business name, address, constitution type, taxpayer category, filing compliance, and principal place of business."
          },
          {
            question: "Is the data from official GST network?",
            answer: "Yes, all verification is done against the official GSTN (GST Network) database to ensure authentic and up-to-date information."
          },
          {
            question: "Can I check GST filing status?",
            answer: "Yes, you can check the return filing status to verify if the taxpayer has been filing returns regularly and is compliant."
          },
          {
            question: "How often is the data updated?",
            answer: "Our API fetches real-time data from GSTN, so you always get the latest registration and compliance status."
          },
          {
            question: "Is there rate limiting?",
            answer: "API rate limits depend on your plan. Contact our team to discuss high-volume requirements."
          }
        ]}
      />
    </>
  );
};

export default GstVerificationPage;
