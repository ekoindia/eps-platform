import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { AtSign, Shield, Zap, CheckCircle, Users, Search, FileText, UserCheck } from "lucide-react";

const UpiVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>UPI ID Verification API - VPA Validation | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify UPI IDs instantly with Eko's UPI Verification API. Validate VPAs, get beneficiary name, and ensure accurate payouts before transfers." 
        />
        <meta name="keywords" content="UPI verification API, VPA validation API, UPI ID check, beneficiary verification, payout verification, Eko API" />
        <link rel="canonical" href="https://eko.in/products/upi-verification-api" />
        <meta property="og:title" content="UPI ID Verification API - VPA Validation | Eko" />
        <meta property="og:description" content="Verify UPI IDs and get beneficiary names before making payouts." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="UPI ID Verification API"
        description="Verify UPI IDs and get beneficiary details"
        heroTitle="UPI ID Verification API"
        heroSubtitle="Verify any UPI ID (VPA) instantly and get beneficiary name. Ensure accurate payouts and reduce failed transactions with pre-validation."
        category="verification"
        docsUrl="https://developers.eko.in/docs/upi-verification"
        features={[
          {
            title: "VPA Validation",
            description: "Check if a UPI ID is valid and active across all UPI handles.",
            icon: AtSign
          },
          {
            title: "Beneficiary Name",
            description: "Get the registered name associated with the UPI ID.",
            icon: UserCheck
          },
          {
            title: "Instant Response",
            description: "Real-time verification with sub-second response times.",
            icon: Zap
          },
          {
            title: "All Handles Supported",
            description: "Works with @upi, @paytm, @ybl, @okaxis and all other handles.",
            icon: CheckCircle
          },
          {
            title: "Bulk Verification",
            description: "Verify multiple UPI IDs in a single API call.",
            icon: Users
          },
          {
            title: "Error Details",
            description: "Get specific error codes for invalid or inactive VPAs.",
            icon: FileText
          }
        ]}
        benefits={[
          {
            title: "Reduce Failed Payouts",
            description: "Verify before sending to eliminate failed transaction charges.",
            icon: CheckCircle
          },
          {
            title: "Confirm Beneficiary",
            description: "Display name to user for confirmation before transfer.",
            icon: UserCheck
          },
          {
            title: "Prevent Fraud",
            description: "Verify VPA ownership to reduce misdirected payments.",
            icon: Shield
          },
          {
            title: "Better UX",
            description: "Instant validation improves user experience in payment flows.",
            icon: Zap
          },
          {
            title: "Cost Savings",
            description: "Avoid failed transaction fees by verifying upfront.",
            icon: Search
          },
          {
            title: "Audit Trail",
            description: "Maintain records of verification for compliance.",
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
            title: "Get API Keys",
            description: "Receive sandbox and production credentials."
          },
          {
            step: 3,
            title: "Integrate",
            description: "Add verification before payout initiation."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with various UPI ID formats."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Start verifying in production environment."
          }
        ]}
        useCases={[
          "Payout Pre-validation",
          "Payment Apps",
          "Refund Processing",
          "Vendor Verification",
          "Salary Disbursement",
          "Gaming Withdrawals",
          "Cashback Credits",
          "P2P Transfers"
        ]}
        faqs={[
          {
            question: "How accurate is the verification?",
            answer: "Verification is done against live NPCI/UPI infrastructure, providing 100% accurate results for VPA validity and registered name."
          },
          {
            question: "What information is returned?",
            answer: "The API returns whether the VPA is valid, the registered beneficiary name, and the PSP/bank handle information."
          },
          {
            question: "Are all UPI handles supported?",
            answer: "Yes, we support all UPI handles including @upi, @paytm, @ybl, @okaxis, @okhdfcbank, and 300+ other bank and fintech handles."
          },
          {
            question: "What if the VPA is invalid?",
            answer: "You'll receive an error response indicating the VPA doesn't exist or is inactive. This helps prevent failed transactions."
          },
          {
            question: "Can I verify mobile number-based UPIs?",
            answer: "Yes, you can verify UPI IDs in mobile@upi format, which are automatically created for all mobile numbers linked to UPI."
          }
        ]}
      />
    </>
  );
};

export default UpiVerificationPage;
