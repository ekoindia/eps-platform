import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Building, Shield, Zap, CheckCircle, CreditCard, FileText, Clock, Database, Hash, User } from "lucide-react";
import bankImg from "@/assets/bank-verification.svg";

const BankVerificationPage = () => {
  return (
    <>
      <Helmet>
        <title>Bank Account Verification API - Penny Drop & IFSC | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Verify bank account details instantly with Eko's Bank Verification API. Penny drop verification, IFSC validation, and account holder name matching for secure payouts." 
        />
        <meta name="keywords" content="bank account verification API, penny drop API, IFSC validation API, bank verification, account verification, Eko API" />
        <link rel="canonical" href="https://eko.in/products/bank-verification-api" />
        <meta property="og:title" content="Bank Account Verification API - Penny Drop & IFSC | Eko" />
        <meta property="og:description" content="Verify bank account details instantly with penny drop and IFSC validation." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Bank Account Verification API"
        description="Verify bank account details instantly with penny drop verification"
        heroTitle="Bank Account Verification"
        heroSubtitle="Verify bank account details before payouts to prevent failed transactions and reduce operational costs. Instant verification with penny drop and account holder name matching."
        category="verification"
        docsUrl="https://developers.eko.in/docs/bank-verification"
        features={[
          {
            title: "Penny Drop Verification",
            description: "Send ₹1 to verify account exists and is active before large payouts.",
            icon: CreditCard
          },
          {
            title: "Account Status Check",
            description: "Verify if the account is active, dormant, or closed.",
            icon: CheckCircle
          },
          {
            title: "Name Matching",
            description: "Get account holder name for verification against provided details.",
            icon: FileText
          },
          {
            title: "IFSC Validation",
            description: "Validate IFSC codes and get bank branch details.",
            icon: Building
          },
          {
            title: "Real-time Results",
            description: "Get verification results within seconds for seamless workflows.",
            icon: Zap
          },
          {
            title: "Bulk Verification",
            description: "Verify multiple accounts in a single API call for batch processing.",
            icon: Database
          }
        ]}
        benefits={[
          {
            title: "Reduce Failed Payouts",
            description: "Verify accounts before disbursement to minimize transaction failures and reversals.",
            icon: CheckCircle
          },
          {
            title: "Prevent Fraud",
            description: "Match account holder names to prevent payouts to wrong accounts.",
            icon: Shield
          },
          {
            title: "Lower Operational Costs",
            description: "Reduce cost of failed transactions, reversals, and manual reconciliation.",
            icon: CreditCard
          },
          {
            title: "Instant Verification",
            description: "Real-time results for seamless customer and vendor onboarding.",
            icon: Zap
          },
          {
            title: "All Banks Supported",
            description: "Verify accounts across all major banks in India through a single API.",
            icon: Building
          },
          {
            title: "24/7 Availability",
            description: "Round-the-clock verification service with 99.9% uptime.",
            icon: Clock
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account on Connect App and get API credentials."
          },
          {
            step: 2,
            title: "Submit KYC",
            description: "Complete business verification process."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Implement bank verification in your payout workflow."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with sandbox accounts before going live."
          },
          {
            step: 5,
            title: "Go Live",
            description: "Start verifying real bank accounts before payouts."
          }
        ]}
        useCases={[
          "Salary Disbursement",
          "Vendor Payments",
          "Loan Disbursement",
          "Insurance Claims",
          "Refund Processing",
          "Incentive Payouts",
          "Commission Payments",
          "E-commerce Seller Onboarding"
        ]}
        faqs={[
          {
            question: "What is penny drop verification?",
            answer: "Penny drop is a method where a small amount (₹1) is transferred to verify the account is active and details are correct. The account holder name is returned for matching."
          },
          {
            question: "Do customers receive the ₹1?",
            answer: "Yes, the ₹1 is credited to the verified account. This is a real transaction that confirms the account is active and can receive funds."
          },
          {
            question: "How accurate is name matching?",
            answer: "Our intelligent name matching algorithm handles variations, abbreviations, and common spelling differences with 99%+ accuracy."
          },
          {
            question: "Which banks are supported?",
            answer: "We support all major banks in India including SBI, HDFC, ICICI, Axis, Kotak, Yes Bank, and 100+ other banks."
          },
          {
            question: "What if verification fails?",
            answer: "Failed verifications return specific error codes indicating the reason - invalid account, closed account, incorrect IFSC, etc. - helping you take appropriate action."
          }
        ]}
        inputOutputPreview={{
          apiName: "Bank Verification",
          inputs: [
            { label: "Account Number", value: "1234567890", icon: Hash },
            { label: "Bank Name", value: "State Bank of India", icon: Building },
            { label: "IFSC Code", value: "SBIN0001234", icon: CreditCard },
          ],
          outputs: [
            { label: "Account Holder Name", value: "Rajesh Kumar", icon: User },
          ],
        }}
      />
    </>
  );
};

export default BankVerificationPage;
