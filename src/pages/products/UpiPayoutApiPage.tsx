import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Send, Shield, Zap, CheckCircle, Users, Clock, FileText, Wallet } from "lucide-react";
import upiPayoutImg from "@/assets/salary-disbursal.svg";

const UpiPayoutApiPage = () => {
  return (
    <>
      <Helmet>
        <title>UPI Payout API - Instant UPI Transfers | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Send instant payouts to any UPI ID with Eko's UPI Payout API. Instant transfers, bulk payouts, and real-time status updates for businesses." 
        />
        <meta name="keywords" content="UPI payout API, instant payout API, UPI transfer API, bulk UPI payout, vendor payout API, Eko API" />
        <link rel="canonical" href="https://eko.in/products/upi-payout-api" />
        <meta property="og:title" content="UPI Payout API - Instant UPI Transfers | Eko" />
        <meta property="og:description" content="Send instant payouts to any UPI ID with real-time status updates." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="UPI Payout API"
        description="Send instant payouts to any UPI ID"
        heroTitle="UPI Payout API"
        heroSubtitle="Send money instantly to any UPI ID - VPAs, mobile numbers, or linked bank accounts. Perfect for vendor payments, refunds, and disbursements."
        category="payment"
        docsUrl="https://developers.eko.in/reference/upi-vpa-payment"
        heroImage={upiPayoutImg}
        features={[
          {
            title: "Instant Transfers",
            description: "Send money to any UPI ID with instant credit, 24x7.",
            icon: Zap
          },
          {
            title: "VPA & Mobile Support",
            description: "Pay to UPI IDs, mobile numbers, or bank account-linked VPAs.",
            icon: Send
          },
          {
            title: "Bulk Payouts",
            description: "Process thousands of payouts in a single API batch.",
            icon: Users
          },
          {
            title: "Real-time Status",
            description: "Instant webhook notifications for successful transfers.",
            icon: Clock
          },
          {
            title: "Auto-retry Logic",
            description: "Intelligent retry mechanism for failed transactions.",
            icon: CheckCircle
          },
          {
            title: "Detailed Reports",
            description: "Transaction-level reports with UTR and status details.",
            icon: FileText
          }
        ]}
        benefits={[
          {
            title: "Zero Bank Holidays",
            description: "UPI works 24x7x365, including weekends and holidays.",
            icon: Clock
          },
          {
            title: "Lower Cost",
            description: "More cost-effective than NEFT/IMPS for small-value payouts.",
            icon: Wallet
          },
          {
            title: "No Account Details",
            description: "Just need UPI ID - no need to collect bank account details.",
            icon: Users
          },
          {
            title: "Instant Confirmation",
            description: "Know immediately if the transfer succeeded or failed.",
            icon: Zap
          },
          {
            title: "High Success Rate",
            description: "99%+ success rate with intelligent routing.",
            icon: CheckCircle
          },
          {
            title: "Secure Transfers",
            description: "Bank-grade encryption and secure API authentication.",
            icon: Shield
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Create an account and complete verification."
          },
          {
            step: 2,
            title: "Add Funds",
            description: "Load your payout wallet with working capital."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Use our simple REST API to initiate payouts."
          },
          {
            step: 4,
            title: "Test",
            description: "Test with small amounts in production."
          },
          {
            step: 5,
            title: "Scale",
            description: "Process bulk payouts as your business grows."
          }
        ]}
        useCases={[
          "Vendor Payments",
          "Salary Disbursement",
          "Refunds & Cashbacks",
          "Gig Worker Payments",
          "Insurance Claims",
          "Loan Disbursement",
          "Contest Winnings",
          "Affiliate Payouts"
        ]}
        faqs={[
          {
            question: "What UPI IDs are supported?",
            answer: "We support all UPI IDs across banks - user@upi, user@paytm, user@ybl, mobile@upi, and any other valid VPA format."
          },
          {
            question: "What is the maximum payout limit?",
            answer: "Individual UPI payouts can be up to ₹1 lakh per transaction. Higher limits are available for verified business accounts."
          },
          {
            question: "How do I handle failed payouts?",
            answer: "Failed payouts are automatically retried based on error type. You receive webhook notifications for all status changes. Funds are returned to your wallet for non-recoverable failures."
          },
          {
            question: "Is there a minimum payout amount?",
            answer: "Minimum payout is ₹1. There's no limit on number of payouts, making it ideal for micro-transactions."
          },
          {
            question: "How do I verify UPI ID before payout?",
            answer: "Use our UPI ID Verification API to validate the UPI ID and get beneficiary name before initiating payout."
          }
        ]}
      />
    </>
  );
};

export default UpiPayoutApiPage;
