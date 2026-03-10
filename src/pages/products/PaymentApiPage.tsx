import { ProductPageLayout } from "@/components/ProductPageLayout";
import { Helmet } from "react-helmet-async";
import { Send, Shield, Zap, CheckCircle, Wallet, Clock, FileText, Users, Building, RefreshCw } from "lucide-react";
import payoutImg from "@/assets/salary-disbursal.svg";

const PaymentApiPage = () => {
  return (
    <>
      <Helmet>
        <title>Payout API - Salary & Vendor Payments | Eko India Financial Services</title>
        <meta 
          name="description" 
          content="Make instant salary disbursals and vendor payments using Eko's Payout API. Pay employees and vendors directly from your e-wallet balance with high success rates." 
        />
        <meta name="keywords" content="payout API, salary disbursal API, vendor payment API, fund transfer API, e-wallet payout, Eko API" />
        <link rel="canonical" href="https://eko.in/products/payment-api" />
        <meta property="og:title" content="Payout API - Salary & Vendor Payments | Eko" />
        <meta property="og:description" content="Instant salary disbursals and vendor payments using your e-wallet balance." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <ProductPageLayout
        title="Payout API"
        description="Make salary & vendor payments easily"
        heroTitle="Payout API"
        heroSubtitle="Pay your employees and vendors directly from your digital wallet balance. Easy-to-use, reliable, and secure fund transfer API for instant salary disbursals and vendor payments."
        category="payment"
        docsUrl="https://developers.eko.in/docs/fund-transfer"
        heroImage={payoutImg}
        features={[
          {
            title: "Easy Salary Disbursals",
            description: "Pay wages to your employees directly into their bank accounts instantly.",
            icon: Users
          },
          {
            title: "Instant Vendor Payments",
            description: "Settle outstanding dues with vendors in one go through a hassle-free process.",
            icon: Building
          },
          {
            title: "Track Payments",
            description: "Maintain a record of every payment transaction to avoid conflicts.",
            icon: FileText
          },
          {
            title: "E-Wallet Payments",
            description: "Use your e-wallet balance to make payments — no bank account needed.",
            icon: Wallet
          },
          {
            title: "High Success Rate",
            description: "Best-in-class success rates, as reliable as banks themselves.",
            icon: CheckCircle
          },
          {
            title: "Secure Transfers",
            description: "Every API call is secured with one-time-use tokens using asymmetric cryptography.",
            icon: Shield
          }
        ]}
        benefits={[
          {
            title: "24x7 Availability",
            description: "Make payments anytime — not confined to banking hours.",
            icon: Clock
          },
          {
            title: "Use E-Money",
            description: "Pay directly from your e-wallet balance — much easier and faster than bank transfers.",
            icon: Wallet
          },
          {
            title: "Best Success Rate",
            description: "Transaction failures occur rarely. We ensure the best success rate for every transaction.",
            icon: Zap
          },
          {
            title: "Simple Documentation",
            description: "Comprehensive and constantly updated API documentation with full technical support.",
            icon: FileText
          },
          {
            title: "Open-Source Libraries",
            description: "Easy and error-proof integration with Eko's open-source libraries.",
            icon: RefreshCw
          },
          {
            title: "Bank-Grade Security",
            description: "Same APIs used internally at Eko, secured with asymmetric cryptography.",
            icon: Shield
          }
        ]}
        integrationSteps={[
          {
            step: 1,
            title: "Sign Up",
            description: "Sign up on Connect App at connect.eko.in."
          },
          {
            step: 2,
            title: "Submit Documents",
            description: "Submit the necessary KYC and business documents."
          },
          {
            step: 3,
            title: "Integrate API",
            description: "Integrate the Payout API using our documentation."
          },
          {
            step: 4,
            title: "Start Paying",
            description: "Start making salary and vendor payments instantly."
          }
        ]}
        useCases={[
          "Salary Disbursement",
          "Vendor Payments",
          "Contractor Payments",
          "Gig Worker Payouts",
          "Commission Payments",
          "Refund Processing",
          "Incentive Payouts",
          "Bulk Disbursements"
        ]}
        faqs={[
          {
            question: "How does the Payout API work?",
            answer: "You load your digital wallet balance and use the Payout API to transfer funds directly to any bank account in India. Payments are processed via IMPS/NEFT for instant or near-instant settlements."
          },
          {
            question: "Do I need a bank account to make payments?",
            answer: "No, you can use your e-wallet balance to make payments. This is much easier and faster than traditional bank transfers."
          },
          {
            question: "Is the Payout API available 24x7?",
            answer: "Yes, unlike banks, our Payout API works 24x7 including weekends and holidays, so you can make payments anytime."
          },
          {
            question: "What is the success rate?",
            answer: "We maintain one of the highest success rates in the industry. Transaction failures are extremely rare, and we are as reliable as banks themselves."
          },
          {
            question: "What use cases are not allowed?",
            answer: "The Payout API is strictly not for gaming, trading, betting, or any unauthorized/illegal activity."
          }
        ]}
      />
    </>
  );
};

export default PaymentApiPage;
