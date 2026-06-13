import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  // DMT
  Banknote,
  BarChart3,
  Briefcase,
  Building,
  Building2,
  Calendar,
  Car,
  CheckCircle,
  Clock,
  CreditCard,
  Database,
  Droplets,
  FileText,
  // AePS
  Fingerprint,
  Flame,
  FolderCheck,
  Globe,
  Globe2,
  // UPI Payout (re-uses Send, Zap, Users, Clock, CheckCircle, FileText, Wallet, Shield — all above)
  // Bank Verification
  Hash,
  IdCard,
  IndianRupee,
  Info,
  Landmark,
  Leaf,
  Mail,
  MailCheck,
  // Reverse Geocoding
  MapPin,
  // GST / DL
  // (Building, FileText, CreditCard already imported)
  // Vehicle
  Palette,
  // Employee
  Phone,
  Plane,
  // QR
  QrCode,
  // BBPS
  Receipt,
  RefreshCw,
  ScanText,
  // Payout
  Send,
  Shield,
  // Product-level icons (used by solutions resolver)
  ShieldCheck,
  Smartphone,
  TicketCheck,
  Truck,
  // Pan Verification
  User,
  Users,
  Utensils,
  // New verification product icons
  Vote,
  Wallet,
  Wifi,
  // Zap (used everywhere)
  Zap,
} from "lucide-react";

import type {
  FAQ,
  ProductPageLayoutProps,
} from "@/components/ProductPageLayout";

// ---------------------------------------------------------------------------
// Hero image assets
// ---------------------------------------------------------------------------
import aepsImg from "@/assets/aeps-main.svg";
import cmsImg from "@/assets/assisted-cash-management.svg";
import moneyTransferImg from "@/assets/money-transfer-api.svg";
import qrImg from "@/assets/qr-payment.png?w=256;512&format=avif;webp&as=picture";
import payoutImg from "@/assets/salary-disbursal.svg";
import bbpsImg from "@/assets/utility-bill-payment.svg";
// upi-payout reuses payoutImg
import aadhaarImg from "@/assets/aadhaar-verification.svg";
import bankImg from "@/assets/bank-verification.svg";
// import dlImg from "@/assets/dl-verification-2.png?w=256;512&format=avif;webp&as=picture";
import employeeImg from "@/assets/employee_verification.png?w=256;512&format=avif;webp&as=picture";
// import gstImg from "@/assets/gst-verification.png?w=256;512&format=avif;webp&as=picture";
import panImg from "@/assets/pan-verification.svg";
import revGeoImg from "@/assets/reverse-geocoding.png?w=256;512&format=avif;webp&as=picture";
import upiVerifyImg from "@/assets/upi-hero.png?w=256;512&format=avif;webp&as=picture";

// ---------------------------------------------------------------------------
// SEO helper type + full page config type
// ---------------------------------------------------------------------------
export interface ProductPageSeo {
  title: string;
  description: string;
  keywords: string;
  ogTitle?: string;
  ogDescription?: string;
}

export interface ProductPageData extends ProductPageLayoutProps {
  seo: ProductPageSeo;
}

// ---------------------------------------------------------------------------
// Shared helpers / constants to reduce duplication in the config map
// ---------------------------------------------------------------------------

/** Shared first-2 steps for verification API products */
const VERIFICATION_STEPS_BASE = [
  {
    title: "Sign Up",
    desc: "Create an account on Connect App and get your sandbox credentials.", // TODO: Signup with your mobile number (complete OTP verification in future). SHOW "Sign Up Now" CTA that links to Zoho Chat with pre-filled message "Hi, I want to integrate [API_NAME]."
    // tip: "Takes less than a minute",
  },
  {
    title: "Submit KYC",
    desc: "Complete your KYC verification process by submitting the required documents.", // TODO: Our team will call you and guide you through the simple KYC process (document submission, video call, etc.) How long does it take for our team to verify docs???
  },
  {
    title: "Integrate API",
    desc: "Use our comprehensive documentation to integrate the APIs.",
  },
  {
    title: "Test in Sandbox",
    desc: "Test your integration thoroughly in our sandbox environment.",
  },
  // {
  //   title: "IP Whitelisting",
  //   desc: "Get your production IPs whitelisted for extra security (India only).",
  // },
] as const;

/** Placeholder for APIs whose I/O preview is not yet available */
// const comingSoonPreview = (apiName: string) =>
//   ({ apiName, inputs: [], outputs: [], comingSoon: true });

/** FAQs appended to every API product page after product-specific FAQs */
export const COMMON_API_FAQS: FAQ[] = [
  {
    q: "Can the API handle high volumes?",
    a: "Yes. The API is designed to handle large-scale volumes reliably without performance degradation.",
  },
  {
    q: "How does API authentication work?",
    a: "Every API call is secured with one-time-use tokens generated using asymmetric cryptography. After signing up, you will receive your developer-key and secret-key for both UAT and production environments, which you can use to generate tokens for authenticating your API requests.",
  },
  {
    q: "How are errors and failures reported?",
    a: "Every response includes a status code and a human-readable message. Failed requests return specific error codes indicating the reason, so you can handle each case programmatically.",
  },
  {
    q: "Is there a sandbox environment for testing?",
    a: "Yes. A full sandbox environment is available immediately on signup. You can test your integration end-to-end before going live — no commitment required.",
  },
  {
    q: "How is API usage billed?",
    a: "Usage is billed per successful API call with no minimum commitment. Volume-based pricing tiers are available — contact our team for detailed rates.",
  },
  // TODO: Confirm, cleanup and re-enable these FAQs if relevant across multiple products
  // {
  //   q: "How long does integration take?",
  //   a: "With our well-documented APIs and sandbox environment, most partners complete integration within 2-4 weeks including testing and certification.",
  // },
  // {
  //   q: "How fast is DL verification?",
  //   a: "Verification is real-time with instant structured responses for driving license details.",
  // },
  // {
  //   q: "What is the rate limit?",
  //   a: "Rate limits depend on your plan. Contact us for higher throughput requirements.",
  // },
  {
    q: "How do I get started?",
    a: "Sign up on Connect App, submit the required documents, integrate the REST API using our sandbox environment, and go live.",
  },
];

// ---------------------------------------------------------------------------
// Config map keyed by API_PRODUCTS id
// ---------------------------------------------------------------------------
export const API_PRODUCT_PAGES: Record<string, ProductPageData> = {
  // -------------------------------------------------------------------------
  // MARK: DMT
  // -------------------------------------------------------------------------
  dmt: {
    seo: {
      title: "DMT API India | Domestic Money Transfer API for IMPS & NEFT",
      description:
        "Enable instant money transfers across India with Eko's DMT API. Real-time IMPS & NEFT settlements with pan-India coverage. Integrate in minutes.",
      keywords:
        "DMT API, domestic money transfer API, IMPS API, NEFT API, money transfer India, remittance API, Eko API",
      ogTitle: "Domestic Money Transfer API (DMT)",
      ogDescription:
        "Enable instant money transfers across India with real-time settlements and pan-India coverage.",
    },
    title: "Domestic Money Transfer API",
    desc: "Enable instant money transfers across India with Eko's DMT API",
    heroTitle:
      "Domestic Money Transfer API for Assisted Cash Remittance in India",
    heroSubtitle:
      "Enable assisted domestic money transfers through retailers, agents, CSPs, and fintech platforms. Let customers send money to bank accounts across India using IMPS and NEFT, with real-time status updates and transaction receipts.",
    category: "payment",
    icon: Banknote,
    docsUrl: "https://developers.eko.in/reference/fino-dmt-flow",
    heroImage: moneyTransferImg,
    features: [
      {
        title: "Real-time Transfers",
        desc: "Instant money transfers via IMPS with real-time status updates and confirmations.",
        icon: Zap,
      },
      // {
      //   title: "NEFT & RTGS Support",
      //   desc: "Support for NEFT and RTGS for high-value transfers with guaranteed settlements.",
      //   icon: Banknote,
      // },
      {
        title: "Pan-India Coverage",
        desc: "Transfer money to any bank account across India with high success rate.",
        icon: Globe,
      },
      {
        title: "Real-time Webhooks",
        desc: "Receive instant notifications for transaction status updates via webhooks.",
        icon: RefreshCw,
      },
      {
        title: "Secure Transactions",
        desc: "Bank-grade encryption and security for all transactions with audit trails.",
        icon: Shield,
      },
      {
        title: "24/7 Availability",
        desc: "Round-the-clock availability with reliable, high-volume workflows.",
        icon: Clock,
      },
    ],
    benefits: [
      // {
      //   title: "Seamless Integration",
      //   desc: "Well-documented APIs with SDKs in multiple languages. Get started in minutes with 24x7 support.",
      //   icon: CheckCircle,
      // },
      {
        title: "Best Success Rate",
        desc: "Industry-leading success rates with smart routing and automatic retries.",
        icon: Zap,
      },
      {
        title: "Earn Commission",
        desc: "Earn attractive commissions on every successful transaction processed through your platform.",
        icon: Banknote,
      },
      {
        title: "Scalable Infrastructure",
        desc: "Handle millions of transactions with our enterprise-grade infrastructure.",
        icon: Building,
      },
      {
        title: "Retailer Network",
        desc: "Build and manage a network of retailers for cash-in and cash-out services.",
        icon: Users,
      },
      {
        title: "Regulatory Compliant",
        desc: "Built for regulated domestic money transfer workflows with partner onboarding, KYC, audit trails, and transaction controls.",
        icon: Shield,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Get production credentials and start processing real transactions.",
      },
    ],
    useCases: [
      "Retail Banking Apps",
      // "Fintech Platforms",
      "Remittance Services",
      "Kirana Stores",
      "Agent Banking",
      "Assisted Banking Networks",
      "CSP/BC networks",
      // "Corporate Payouts",
      // "E-commerce Refunds",
    ],
    faqs: [
      // {
      //   q: "What is the DMT API?",
      //   a: "The DMT (Domestic Money Transfer) API enables instant money transfers to any bank account across India using IMPS and NEFT. It's designed for businesses that want to offer remittance services to their customers.",
      // },
      // {
      //   q: "What is the transaction limit?",
      //   a: "Individual transaction limits vary based on the mode of transfer. IMPS supports up to ₹5 lakh per transaction, while NEFT and RTGS support higher limits for bulk transfers.",
      // },
      {
        q: "How long does a transfer take?",
        a: "IMPS transfers are instant (within seconds). NEFT transfers are processed in batches throughout the day.",
      },
      // {
      //   q: "What documents are required for integration?",
      //   a: "You'll need business registration documents, PAN card, bank account details, and relevant licenses based on your business type. Our team will guide you through the complete process.",
      // },
      {
        q: "Is there a settlement delay?",
        a: "Settlement timelines depend on your agreement. Most partners receive T+1 settlements, with options for same-day settlements for high-volume partners.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: AePS
  // -------------------------------------------------------------------------
  aeps: {
    seo: {
      title:
        "AePS API India | Cash Withdrawal, Balance Enquiry & Mini Statement",
      description:
        "Integrate Eko’s AePS APIs for Aadhaar-based cash withdrawal, balance enquiry and mini statement services. Built for fintechs, BC networks, CSPs and assisted banking platforms in India.",
      keywords:
        "AePS API, Aadhaar enabled payment system, Aadhaar banking API, biometric payment API, rural banking API, Eko API",
      ogTitle: "AePS API - Aadhaar Enabled Payment System",
      ogDescription:
        "Enable Aadhaar-based banking services for rural and underbanked segments.",
    },
    title: "AePS API",
    desc: "Aadhaar-enabled payment services for rural and underbanked segments",
    heroTitle: "AePS API for Cash Withdrawal, Balance Enquiry & Mini Statement",
    heroSubtitle:
      "Enable Aadhaar-based banking services through secure AePS APIs. Let your retailers, agents, or assisted-service network offer cash withdrawal, balance enquiry, and mini statement services using Aadhaar authentication.",
    category: "payment",
    icon: Fingerprint,
    docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
    heroImage: aepsImg,
    features: [
      {
        title: "Cash Withdrawal",
        desc: "Enable customers to withdraw cash from any bank account using Aadhaar and biometric authentication.",
        icon: Wallet,
      },
      {
        title: "Balance Enquiry",
        desc: "Check account balance instantly using Aadhaar number and fingerprint verification.",
        icon: FileText,
      },
      {
        title: "Mini Statement",
        desc: "Retrieve the last few transactions for any Aadhaar-linked bank account.",
        icon: FileText,
      },
      // {
      //   title: "Fund Transfer",
      //   desc: "Transfer funds between Aadhaar-linked accounts securely and instantly.",
      //   icon: Fingerprint,
      // },
      {
        title: "Biometric Authentication",
        desc: "Secure transactions with Aadhaar-based biometric verification using UIDAI.",
        icon: Shield,
      },
      {
        title: "Multi-Bank Support",
        desc: "Connect to all major banks in India through a single integration.",
        icon: Building,
      },
    ],
    benefits: [
      {
        title: "Financial Inclusion",
        desc: "Bring banking services to rural and underbanked populations without traditional infrastructure.",
        icon: Users,
      },
      {
        title: "No Debit Card Required",
        desc: "Customers only need their Aadhaar number and fingerprint - no cards or PINs needed.",
        icon: Fingerprint,
      },
      {
        title: "Secure & Compliant",
        desc: "UIDAI-certified biometric authentication ensures secure and compliant transactions.",
        icon: Shield,
      },
      {
        title: "Build Retailer Network",
        desc: "Enable local retailers to become banking points and earn commissions.",
        icon: Building,
      },
      {
        title: "24/7 Operations",
        desc: "Provide banking services round the clock, even in areas without bank branches.",
        icon: Clock,
      },
      {
        title: "Easy Integration",
        desc: "Simple REST APIs with comprehensive documentation and sandbox environment.",
        icon: CheckCircle,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      // { title: "Setup Biometric Devices", desc: "Configure certified biometric devices for fingerprint capture." },
      {
        title: "Onboard Retailers",
        desc: "Start onboarding retailers to offer AePS services.",
      },
      {
        title: "Go Live",
        desc: "Launch your AePS services and start serving customers.",
      },
    ],
    useCases: [
      "Banking Correspondents",
      "Rural Financial Services",
      "Kirana Store Banking",
      "CSC Centers",
      "Microfinance Institutions",
      "Government Disbursements",
    ],
    faqs: [
      // {
      //   q: "What is AePS?",
      //   a: "AePS (Aadhaar Enabled Payment System) is a bank-led model that allows online financial transactions through Aadhaar authentication. It uses NPCI infrastructure and enables customers to use their Aadhaar for bank transactions.",
      // },
      {
        q: "What biometric devices are supported?",
        a: "We support all UIDAI-certified biometric devices including Morpho, Mantra, Startek, and others.",
      },
      // {
      //   q: "What is the transaction limit for AePS?",
      //   a: "Cash withdrawal limits vary by bank but typically range from ₹10,000 to ₹50,000 per transaction. Some banks allow higher limits for specific use cases.",
      // },
      // {
      //   q: "Do I need special certification?",
      //   a: "Yes, you need to be a certified AePS operator. Eko can help you with the certification process and provide all necessary support.",
      // },
      // {
      //   q: "How is commission calculated?",
      //   a: "Commission is earned on every successful transaction. The exact rates depend on your agreement and transaction volumes. Contact our team for detailed pricing.",
      // },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: BBPS
  // -------------------------------------------------------------------------
  bbps: {
    seo: {
      title: "BBPS API / Bharat Connect API for Bill Payments in India",
      description:
        "Integrate BBPS API to enable bill payments for electricity, gas, water, DTH, broadband, insurance, and 200+ biller categories. RBI-compliant infrastructure.",
      keywords:
        "BBPS API, bill payment API, Bharat Bill Payment System, utility bill API, electricity bill API, Eko API",
      ogTitle: "BBPS API - Bharat Bill Payment System",
      ogDescription:
        "Enable seamless bill payments for 200+ biller categories with Eko's BBPS API.",
    },
    title: "BBPS API",
    desc: "Complete bill payment ecosystem with 200+ biller categories",
    heroTitle: "BBPS API for Utility Bill Payments in India",
    heroSubtitle:
      "Integrate Eko’s BBPS API to let customers fetch bills, pay utility bills, and track transaction status across electricity, gas, water, DTH, broadband, FASTag, insurance, credit card, EMI, LPG, and loan repayment categories.",
    category: "payment",
    icon: Receipt,
    docsUrl: "https://developers.eko.in/reference/bbps-pay",
    heroImage: bbpsImg,
    types: [
      { label: "Electricity", icon: Zap },
      { label: "Gas", icon: Flame },
      { label: "Water", icon: Droplets },
      { label: "DTH", icon: Wifi },
      { label: "Broadband", icon: Wifi },
      { label: "Mobile Recharge", icon: Smartphone },
      { label: "Fastag", icon: Car },
      { label: "Insurance", icon: Shield },
      { label: "Credit Card", icon: CreditCard },
      { label: "EMI", icon: Receipt },
      { label: "LPG Gas", icon: Flame },
      { label: "Loan Repayment", icon: Building },
    ],
    features: [
      {
        title: "200+ Biller Categories",
        desc: "Access to extensive biller network covering electricity, gas, water, insurance, and more.",
        icon: Receipt,
      },
      {
        title: "Instant Bill Fetch",
        desc: "Fetch outstanding bill amounts in real-time before payment processing.",
        icon: Zap,
      },
      {
        title: "Unified API",
        desc: "Single API integration for all biller categories - no separate integrations needed.",
        icon: CheckCircle,
      },
      {
        title: "Transaction Tracking",
        desc: "Complete visibility into transaction status with detailed reporting.",
        icon: Receipt,
      },
      // {
      //   title: "Secure Payments",
      //   desc: "PCI-DSS compliant infrastructure with end-to-end encryption.",
      //   icon: Shield,
      // },
      {
        title: "Receipt Generation",
        desc: "Auto-generated receipts for every successful transaction.",
        icon: Receipt,
      },
    ],
    benefits: [
      {
        title: "Simplified Integration",
        desc: "Easy-to-read API documentation and 24x7 integration support for quick go-live.",
        icon: CheckCircle,
      },
      {
        title: "Best Success Rate",
        desc: "Industry-leading success rates with smart retry mechanisms.",
        icon: Zap,
      },
      {
        title: "Earn Commission",
        desc: "Attractive commissions on all types of bill payments processed through your platform.",
        icon: Receipt,
      },
      {
        title: "Extensive Biller Network",
        desc: "Access to 20,000+ billers across all major categories in India.",
        icon: Building,
      },
      {
        title: "Real-time Confirmation",
        desc: "Instant payment confirmation with transaction reference numbers.",
        icon: Zap,
      },
      {
        title: "Customer Retention",
        desc: "Keep customers engaged with recurring bill payment reminders and services.",
        icon: Users,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "UAT Testing",
        desc: "Complete UAT testing with all biller categories.",
      },
      // { title: "IP Whitelisting", desc: "Get your production IPs whitelisted (India only)." },
      {
        title: "Go Live",
        desc: "Launch with production credentials and start billing!",
      },
    ],
    useCases: [
      "Banking Apps",
      "Fintech Platforms",
      "Payment Aggregators",
      "E-commerce Platforms",
      "Retail Networks",
      "Agent Banking",
      "Corporate Solutions",
    ],
    faqs: [
      // {
      //   q: "What is BBPS API?",
      //   a: "BBPS (Bharat Bill Payment System) API is an RBI-mandated online bill payment system that enables customers to pay bills easily and securely. Our API allows you to integrate bill payment services into your platform.",
      // },
      // {
      //   q: "How many billers are supported?",
      //   a: "Eko's BBPS API provides access to 20,000+ billers across 200+ categories including electricity, gas, water, DTH, broadband, insurance, EMI, FASTag, and more.",
      // },
      // {
      //   q: "What are the commission rates?",
      //   a: "Commission rates vary by biller category and transaction volume. Contact our sales team for detailed pricing and commission structures.",
      // },
      {
        q: "Is BBPS API available 24/7?",
        a: "Yes, BBPS services are available 24/7. However, some billers may have specific operating hours for payment processing.",
      },
      // {
      //   q: "How long does integration take?",
      //   a: "With our well-documented APIs and sandbox environment, most partners complete integration within 2-4 weeks including testing and certification.",
      // },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: QR Payment
  // -------------------------------------------------------------------------
  "qr-payment": {
    seo: {
      title: "QR Payment API India | UPI QR Code Payments",
      description:
        "Accept UPI payments via QR codes with Eko's QR Payment API. Dynamic QR generation, real-time notifications, and seamless payment collection for merchants.",
      keywords:
        "QR payment API, UPI QR API, dynamic QR code, QR code payments, merchant payments API, Eko API",
      ogTitle: "QR Payment API - UPI QR Code Payments",
      ogDescription:
        "Accept UPI payments via dynamic QR codes with real-time notifications.",
    },
    title: "QR Payment API",
    desc: "Accept UPI payments via dynamic QR codes",
    heroTitle: "QR Payment API",
    heroSubtitle:
      "Enable seamless UPI payments through dynamic QR codes. Perfect for retail stores, restaurants, and any business accepting digital payments.",
    category: "payment",
    icon: QrCode,
    docsUrl: "https://developers.eko.in/reference/upi-generate-static-qr",
    heroImage: qrImg,
    features: [
      {
        title: "Dynamic QR Generation",
        desc: "Generate unique QR codes for each transaction with custom amounts and references.",
        icon: QrCode,
      },
      {
        title: "Real-time Notifications",
        desc: "Instant webhooks and callbacks when payment is received.",
        icon: Zap,
      },
      {
        title: "Multi-app Support",
        desc: "Works with all UPI apps - Google Pay, PhonePe, Paytm, BHIM, and more.",
        icon: Smartphone,
      },
      {
        title: "Static QR Support",
        desc: "Generate static QR codes for fixed collection points.",
        icon: QrCode,
      },
      {
        title: "Transaction Tracking",
        desc: "Complete transaction history and reconciliation reports.",
        icon: BarChart3,
      },
      {
        title: "Refund Management",
        desc: "Process refunds directly through the API when needed.",
        icon: RefreshCw,
      },
    ],
    benefits: [
      {
        title: "Zero Hardware Cost",
        desc: "No POS machine required - customers scan and pay using their phones.",
        icon: Smartphone,
      },
      {
        title: "Instant Settlement",
        desc: "Fast settlement cycles to ensure healthy cash flow.",
        icon: Zap,
      },
      {
        title: "Lower MDR",
        desc: "Benefit from competitive merchant discount rates on UPI transactions.",
        icon: CreditCard,
      },
      // {
      //   title: "Easy Integration",
      //   desc: "Simple REST APIs with comprehensive documentation and SDKs.",
      //   icon: CheckCircle,
      // },
      {
        title: "Secure Transactions",
        desc: "Bank-grade security with encrypted QR codes and secure callbacks.",
        icon: Shield,
      },
      {
        title: "Analytics Dashboard",
        desc: "Track payments, view trends, and download reports easily.",
        icon: BarChart3,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Generate QR",
        desc: "Use API to generate dynamic or static QR codes.",
      },
      { title: "Display QR", desc: "Show QR to customers on screen or print." },
      {
        title: "Receive Payments",
        desc: "Get instant notifications on successful payments.",
      },
    ],
    useCases: [
      "Retail Stores",
      "Restaurants & Cafes",
      "E-commerce COD",
      "Street Vendors",
      "Service Providers",
      "Subscription Payments",
      "Event Ticketing",
      "Donation Collection",
    ],
    faqs: [
      {
        q: "What is a dynamic QR code?",
        a: "A dynamic QR code contains a unique transaction ID and amount for each payment. This allows automatic reconciliation and instant payment confirmation without manual verification.",
      },
      {
        q: "Which UPI apps are supported?",
        a: "Our QR codes work with all UPI-enabled apps including Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, and bank-specific UPI apps.",
      },
      {
        q: "How fast are payment notifications?",
        a: "Payment notifications are sent in real-time, typically within 1-2 seconds of successful payment. We support both webhooks and polling mechanisms.",
      },
      {
        q: "Can I customize the QR code appearance?",
        a: "Yes, you can add your logo, change colors, and customize the QR code design while maintaining scannability.",
      },
      {
        q: "What are the settlement timelines?",
        a: "Standard settlement is T+1 (next business day). Faster settlement options are available for eligible merchants.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: CMS
  // -------------------------------------------------------------------------
  cms: {
    seo: {
      title: "CMS Cash Collection API India | Cash Management Services",
      description:
        "Digitize cash collection with Eko's CMS API. Enable field agents to collect cash and instantly credit customer accounts. Perfect for NBFCs, insurance, and utilities.",
      keywords:
        "CMS API, cash collection API, cash management services, field collection API, NBFC collection API, Eko API",
      ogTitle: "CMS Cash Collection API",
      ogDescription:
        "Digitize cash collection with instant account credits through field agents.",
    },
    title: "CMS Cash Collection API",
    desc: "Digitize cash collection with field agents",
    heroTitle: "Cash Collection API",
    heroSubtitle:
      "Enable your field agents to collect cash and instantly credit customer accounts. Reduce collection costs, improve efficiency, and provide real-time visibility.",
    category: "payment",
    icon: Receipt,
    docsUrl: "https://developers.eko.in/v1/reference/get-cms-url",
    heroImage: cmsImg,
    features: [
      {
        title: "Field Agent App",
        desc: "White-label mobile app for field agents to collect payments and issue receipts.",
        icon: Users,
      },
      {
        title: "Real-time Credits",
        desc: "Instant account credit upon cash collection with digital confirmation.",
        icon: Zap,
      },
      {
        title: "GPS Tracking",
        desc: "Track agent location and collection points for complete visibility.",
        icon: MapPin,
      },
      {
        title: "Digital Receipts",
        desc: "Auto-generated digital receipts sent to customers via SMS.",
        icon: FileText,
      },
      {
        title: "Cash Limit Management",
        desc: "Set daily and per-transaction cash limits for each agent.",
        icon: Banknote,
      },
      {
        title: "Reconciliation",
        desc: "Automated reconciliation with detailed collection reports.",
        icon: Clock,
      },
    ],
    benefits: [
      {
        title: "Reduce Collection Cost",
        desc: "Lower operational costs with efficient agent management and routing.",
        icon: Banknote,
      },
      {
        title: "Faster Realization",
        desc: "Instant account credits eliminate delays in payment realization.",
        icon: Zap,
      },
      {
        title: "Fraud Prevention",
        desc: "GPS tracking, photo proof, and digital receipts prevent collection fraud.",
        icon: Shield,
      },
      {
        title: "Customer Convenience",
        desc: "Doorstep collection improves customer experience and retention.",
        icon: Users,
      },
      {
        title: "Complete Visibility",
        desc: "Real-time dashboard showing collection status across all agents.",
        icon: CheckCircle,
      },
      {
        title: "Easy Integration",
        desc: "Simple API integration with your existing loan or billing system.",
        icon: FileText,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Configure",
        desc: "Set up collection accounts and agent limits.",
      },
      {
        title: "Onboard Agents",
        desc: "Register field agents and distribute the app.",
      },
      // { title: "Integrate", desc: "Connect with your billing/loan system via API." },
      {
        title: "Go Live",
        desc: "Start collecting with real-time tracking and credits.",
      },
    ],
    useCases: [
      "NBFC Loan Collection",
      "Insurance Premium Collection",
      "Utility Bill Collection",
      "Microfinance",
      "Chit Fund Collection",
      "Society Maintenance",
      "Subscription Collection",
      "Rental Collection",
    ],
    faqs: [
      // {
      //   q: "Is there a limit on collection amount?",
      //   a: "You can configure daily limits and per-transaction limits for each agent based on your risk policy. Higher limits require additional verification.",
      // },
      // {
      //   q: "How is fraud prevented?",
      //   a: "Multiple layers including GPS location logging, photo capture of cash, digital receipts sent directly to customers, and real-time reconciliation. Any discrepancy is flagged immediately.",
      // },
      // {
      //   q: "Can we use our own collection app?",
      //   a: "Yes, our APIs can be integrated into your existing mobile app. We provide SDKs and complete documentation for custom integration.",
      // },
      {
        q: "What reports are available?",
        a: "Daily collection summary, agent-wise reports, location-based analytics, pending collections, and reconciliation reports. All reports can be exported or accessed via API.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: Payout
  // -------------------------------------------------------------------------
  payment: {
    seo: {
      title: "Payout API India | Salary & Vendor Payments",
      description:
        "Make instant salary disbursals and vendor payments using Eko's Payout API. Pay employees and vendors directly from your e-wallet balance with high success rates.",
      keywords:
        "payout API, salary disbursal API, vendor payment API, fund transfer API, e-wallet payout, Eko API",
      ogTitle: "Payout API - Salary & Vendor Payments",
      ogDescription:
        "Instant salary disbursals and vendor payments using your e-wallet balance.",
    },
    title: "Payout API",
    desc: "Make salary & vendor payments easily",
    heroTitle: "Payout API",
    heroSubtitle:
      "Pay your employees and vendors directly from your digital wallet balance. Easy-to-use, reliable, and secure fund transfer API for instant salary disbursals and vendor payments.",
    category: "payment",
    icon: Send,
    docsUrl: "https://developers.eko.in/docs/fund-transfer",
    heroImage: payoutImg,
    features: [
      {
        title: "Easy Salary Disbursals",
        desc: "Pay wages to your employees directly into their bank accounts instantly.",
        icon: Users,
      },
      {
        title: "Instant Vendor Payments",
        desc: "Settle outstanding dues with vendors in one go through a hassle-free process.",
        icon: Building,
      },
      {
        title: "Track Payments",
        desc: "Maintain a record of every payment transaction to avoid conflicts.",
        icon: FileText,
      },
      {
        title: "E-Wallet Payments",
        desc: "Use your e-wallet balance to make payments — no bank account needed.",
        icon: Wallet,
      },
      {
        title: "High Success Rate",
        desc: "Best-in-class success rates, as reliable as banks themselves.",
        icon: CheckCircle,
      },
      {
        title: "Secure Transfers",
        desc: "Every API call is secured with one-time-use tokens using asymmetric cryptography.",
        icon: Shield,
      },
    ],
    benefits: [
      {
        title: "24x7 Availability",
        desc: "Make payments anytime — not confined to banking hours.",
        icon: Clock,
      },
      {
        title: "Use E-Money",
        desc: "Pay directly from your e-wallet balance — much easier and faster than bank transfers.",
        icon: Wallet,
      },
      {
        title: "Best Success Rate",
        desc: "Transaction failures occur rarely. We ensure the best success rate for every transaction.",
        icon: Zap,
      },
      {
        title: "Simple Documentation",
        desc: "Comprehensive and constantly updated API documentation with full technical support.",
        icon: FileText,
      },
      {
        title: "Open-Source Libraries",
        desc: "Easy and error-proof integration with Eko's open-source libraries.",
        icon: RefreshCw,
      },
      {
        title: "Bank-Grade Security",
        desc: "Same APIs used internally at Eko, secured with asymmetric cryptography.",
        icon: Shield,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Start Paying",
        desc: "Start making salary and vendor payments instantly.",
      },
    ],
    useCases: [
      "Salary Disbursement",
      "Vendor Payments",
      "Contractor Payments",
      "Gig Worker Payouts",
      "Commission Payments",
      "Refund Processing",
      "Incentive Payouts",
      "Bulk Disbursements",
    ],
    faqs: [
      {
        q: "How does the Payout API work?",
        a: "You load your digital wallet balance and use the Payout API to transfer funds directly to any bank account in India. Payments are processed via IMPS/NEFT for instant or near-instant settlements.",
      },
      {
        q: "Do I need a bank account to make payments?",
        a: "No, you can use your e-wallet balance to make payments. This is much easier and faster than traditional bank transfers.",
      },
      {
        q: "Is the Payout API available 24x7?",
        a: "Yes, unlike banks, our Payout API works 24x7 including weekends and holidays, so you can make payments anytime.",
      },
      {
        q: "What is the success rate?",
        a: "We maintain one of the highest success rates in the industry. Transaction failures are extremely rare, and we are as reliable as banks themselves.",
      },
      {
        q: "What use cases are not allowed?",
        a: "The Payout API is strictly not for gaming, trading, betting, or any unauthorized/illegal activity.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: UPI Payout
  // -------------------------------------------------------------------------
  "upi-payout": {
    seo: {
      title: "UPI Payout API India | Instant UPI Transfers",
      description:
        "Send instant payouts to any UPI ID with Eko's UPI Payout API. Instant transfers, bulk payouts, and real-time status updates for businesses.",
      keywords:
        "UPI payout API, instant payout API, UPI transfer API, bulk UPI payout, vendor payout API, Eko API",
      ogTitle: "UPI Payout API - Instant UPI Transfers",
      ogDescription:
        "Send instant payouts to any UPI ID with real-time status updates.",
    },
    title: "UPI Payout API",
    desc: "Send instant payouts to any UPI ID",
    heroTitle: "UPI Payout API",
    heroSubtitle:
      "Send money instantly to any UPI ID - VPAs, mobile numbers, or linked bank accounts. Perfect for vendor payments, refunds, and disbursements.",
    category: "payment",
    icon: Banknote,
    docsUrl: "https://developers.eko.in/reference/upi-vpa-payment",
    heroImage: payoutImg,
    features: [
      {
        title: "Instant Transfers",
        desc: "Send money to any UPI ID with instant credit, 24x7.",
        icon: Zap,
      },
      {
        title: "VPA & Mobile Support",
        desc: "Pay to UPI IDs, mobile numbers, or bank account-linked VPAs.",
        icon: Send,
      },
      {
        title: "Bulk Payouts",
        desc: "Process thousands of payouts in a single API batch.",
        icon: Users,
      },
      {
        title: "Real-time Status",
        desc: "Instant webhook notifications for successful transfers.",
        icon: Clock,
      },
      {
        title: "Auto-retry Logic",
        desc: "Intelligent retry mechanism for failed transactions.",
        icon: CheckCircle,
      },
      {
        title: "Detailed Reports",
        desc: "Transaction-level reports with UTR and status details.",
        icon: FileText,
      },
    ],
    benefits: [
      {
        title: "Zero Bank Holidays",
        desc: "UPI works 24x7x365, including weekends and holidays.",
        icon: Clock,
      },
      {
        title: "Lower Cost",
        desc: "More cost-effective than NEFT/IMPS for small-value payouts.",
        icon: Wallet,
      },
      {
        title: "No Account Details",
        desc: "Just need UPI ID - no need to collect bank account details.",
        icon: Users,
      },
      {
        title: "Instant Confirmation",
        desc: "Know immediately if the transfer succeeded or failed.",
        icon: Zap,
      },
      {
        title: "High Success Rate",
        desc: "99%+ success rate with intelligent routing.",
        icon: CheckCircle,
      },
      {
        title: "Secure Transfers",
        desc: "Bank-grade encryption and secure API authentication.",
        icon: Shield,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Add Funds",
        desc: "Load your payout wallet with working capital.",
      },
      { title: "Scale", desc: "Process bulk payouts as your business grows." },
    ],
    useCases: [
      "Vendor Payments",
      "Salary Disbursement",
      "Refunds & Cashbacks",
      "Gig Worker Payments",
      "Insurance Claims",
      "Loan Disbursement",
      "Contest Winnings",
      "Affiliate Payouts",
    ],
    faqs: [
      {
        q: "What UPI IDs are supported?",
        a: "We support all UPI IDs across banks - user@upi, user@paytm, user@ybl, mobile@upi, and any other valid VPA format.",
      },
      {
        q: "What is the maximum payout limit?",
        a: "Individual UPI payouts can be up to ₹1 lakh per transaction. Higher limits are available for verified business accounts.",
      },
      {
        q: "How do I handle failed payouts?",
        a: "Failed payouts are automatically retried based on error type. You receive webhook notifications for all status changes. Funds are returned to your wallet for non-recoverable failures.",
      },
      {
        q: "Is there a minimum payout amount?",
        a: "Minimum payout is ₹1. There's no limit on number of payouts, making it ideal for micro-transactions.",
      },
      {
        q: "How do I verify UPI ID before payout?",
        a: "Use our UPI ID Verification API to validate the UPI ID and get beneficiary name before initiating payout.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: PAN
  // -------------------------------------------------------------------------
  pan: {
    seo: {
      title:
        "PAN Verification API India | Instant PAN Validation for KYC & Onboarding",
      description:
        "Choose from PAN Lite, PAN Advanced, and Bulk PAN Verification APIs to validate PAN details in real time for customer KYC, lending, merchant onboarding, and compliance workflows for Fintechs and NBFCs.",
      keywords:
        "PAN Verification API, PAN Validation API, KYC PAN API, PAN Check API, Identity Verification API",
    },
    title: "PAN Verification API",
    desc: "Verify PAN details in real time",
    heroTitle: "PAN Verification API for KYC & Onboarding in India",
    heroSubtitle:
      "Choose from PAN Lite, PAN Advanced, and Bulk PAN Verification APIs to validate PAN details in real time for customer KYC, lending, merchant onboarding, and compliance workflows.",
    category: "verification",
    icon: FileText,
    docsUrl: "https://developers.eko.in/reference/pan-lite",
    heroImage: panImg,
    overview:
      "The PAN Verification API enables businesses to validate Permanent Account Number (PAN) details instantly. It is designed for compliance-driven onboarding, fraud prevention, and identity verification use cases across financial and enterprise platforms.",
    keyBenefits: [
      "Instant PAN validation",
      "Improves KYC accuracy and speed",
      "Reduces onboarding fraud",
      "API-driven, automation-ready workflows",
      "Suitable for high-volume verifications",
    ],
    features: [
      {
        title: "Real-Time PAN Validation",
        desc: "Verify PAN details instantly with structured responses.",
      },
      {
        title: "High Accuracy Responses",
        desc: "Returns validated PAN information for reliable identity checks.",
      },
      {
        title: "Automation Friendly",
        desc: "Easily integrate into digital onboarding and KYC pipelines.",
      },
      {
        title: "Scalable Verification",
        desc: "Designed to support large volumes without performance impact.",
      },
    ],
    whoShouldUse: [
      "Fintech and financial institutions",
      "Marketplaces and platforms",
      "NBFCs and lenders",
      "Enterprises with KYC requirements",
    ],
    useCases: [
      "Customer KYC verification",
      "Merchant and vendor onboarding",
      "Account opening workflows",
      "Compliance and due diligence checks",
    ],
    trustAndCompliance: [
      "Compliance-aligned verification workflows",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      // { title: "Sign Up", desc: "Create an account on Connect App.", tip: "Takes less than 2 minutes" },
      // { title: "Submit Documents", desc: "Submit necessary documents for activation.", tip: "KYC docs verified in 24 hours" },
      // { title: "Integrate API", desc: "Integrate PAN Verification API into your system.", tip: "API keys generated instantly" },
      {
        title: "Go Live",
        desc: "Start validating PAN details in production.",
        tip: "Sandbox available for testing",
      },
    ],
    leadForm: {
      title: "Get PAN Verification API Access",
    },
    faqs: [
      {
        q: "How fast is PAN verification?",
        a: "PAN verification is real-time with sub-second response times for instant identity validation.",
      },
      {
        q: "What details are returned?",
        a: "PAN Lite returns PAN status, name match, DOB match, and Aadhaar seeding status. PAN Advanced returns holder name, PAN type, gender, date of birth, masked Aadhaar number, Aadhaar linking status, mobile number, email, and address.",
      },
    ],
    inputOutputPreviews: [
      {
        apiName: "PAN Lite",
        description:
          "Quick PAN validation with match results for basic KYC checks.",
        bestFor: "Basic PAN status checks",
        docsUrl: "https://developers.eko.in/reference/pan-lite",
        endpoint: "/pan-lite",
        inputs: [
          { label: "PAN Number", value: "ABCDE1234F", icon: CreditCard },
          { label: "Full Name", value: "Rajesh Kumar", icon: User },
          { label: "Date of Birth", value: "29/08/1994", icon: Calendar },
        ],
        outputs: [
          { label: "PAN Status", value: "Valid" },
          { label: "Name Match", value: "Matched" },
          { label: "DOB Match", value: "Matched" },
          {
            label: "Aadhaar Seeding Status",
            value: "Seeded",
            icon: Fingerprint,
          },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/pan-lite",
          request: {
            initiator_id: "9876543210",
            pan_number: "ABCDE1234F",
            name: "Rajesh Kumar",
            dob: "1994-08-29",
            client_ref_id: "PAN-REQ-20240101-001",
            user_code: "20810200",
            source: "API",
          },
          response: {
            status: 0,
            response_status_id: 0,
            data: {
              pan: "ABCDE1234F",
              name: "Rajesh Kumar",
              dob: "1994-08-29",
              name_match: "Y",
              dob_match: "Y",
              pan_status: "E",
              status: "VALID",
              aadhaar_seeding_status: "Y",
              aadhaar_seeding_status_desc: "Aadhaar is linked to PAN",
            },
            message: "PAN verification successful",
            response_type_id: 1388,
          },
        },
      },
      {
        apiName: "PAN Advanced",
        description:
          "Detailed PAN data including holder name, category, and Aadhaar seeding status.",
        bestFor: "KYC workflows needing richer match details",
        docsUrl: "https://developers.eko.in/reference/pan-advanced",
        endpoint: "/pan-advanced",
        inputs: [
          { label: "PAN Number", value: "ABCDE1234F", icon: CreditCard },
          { label: "Full Name", value: "Rajesh Kumar", icon: User },
          { label: "Date of Birth", value: "29/08/1994", icon: Calendar },
        ],
        outputs: [
          { label: "Registered Name", value: "Rajesh Kumar", icon: User },
          { label: "PAN Type", value: "Individual" },
          { label: "Gender", value: "Male", icon: User },
          { label: "Date of Birth", value: "29/08/1994", icon: Calendar },
          {
            label: "Masked Aadhaar",
            value: "XXXX-XXXX-1234",
            icon: Fingerprint,
          },
          { label: "Aadhaar Linked?", value: "Yes" },
          { label: "Mobile Number", value: "9876543210", icon: Smartphone },
          { label: "Email", value: "rajesh.kumar@example.com", icon: Mail },
          {
            label: "Address (Full)",
            value: "Woodland Heights, Ghatkopar, Mumbai, Maharashtra 400072",
            icon: MapPin,
          },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/pan-advanced",
          request: {
            initiator_id: "9876543210",
            pan: "ABCDE1234F",
            name: "Rajesh Kumar",
            dob: "1994-08-29",
            client_ref_id: "PAN-ADV-20240101-001",
            user_code: "20810200",
          },
          response: {
            status: 0,
            data: {
              pan: "ABCDE1234F",
              name_provided: "Rajesh Kumar",
              registered_name: "Rajesh Kumar",
              first_name: "Rajesh",
              last_name: "Kumar",
              type: "Individual",
              gender: "M",
              date_of_birth: "1994-08-29",
              masked_aadhaar_number: "XXXX XXXX 1234",
              aadhaar_linked: true,
              email: "rajesh.kumar@example.com",
              mobile_number: "9876543210",
              address: {
                full_address:
                  "Woodland Heights, Ghatkopar, Mumbai, Maharashtra 400072",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: 400072,
              },
            },
            message: "PAN Advanced verification successful",
          },
        },
      },
      {
        apiName: "Bulk PAN Verification",
        description:
          "Verify multiple PANs in a single async batch request for high-volume operations.",
        bestFor: "High-volume PAN verification with async processing",
        docsUrl: "https://developers.eko.in/reference/pan-bulk-verify",
        endpoint: "/pan/bulk",
        inputs: [
          { label: "Entry 1", value: "John (ABCPV1234D)", icon: User },
          { label: "Entry 2", value: "John Doe (ABCPV1234L)", icon: User },
        ],
        outputs: [
          { label: "Status", value: "Processing" },
          { label: "Reference ID", value: "REF123456", icon: Hash },
          { label: "Batch ID", value: "BLK789" },
          {
            label: "Note",
            value: "Poll Bulk PAN Verification Status API for results",
            icon: Info,
          },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/pan/bulk",
          request: {
            initiator_id: "9876543210",
            client_ref_id: "BULK-PAN-20240101-001",
            entries: [
              { pan: "ABCPV1234D", name: "John", source: "API" },
              { pan: "ABCPV1234L", name: "John Doe", source: "API" },
            ],
          },
          response: {
            status: 0,
            data: {
              reference_id: 123456,
            },
            message:
              "Bulk PAN verification request accepted. Poll status API for results.",
          },
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: Aadhaar
  // -------------------------------------------------------------------------
  aadhaar: {
    seo: {
      title: "Aadhaar Verification API India | Secure Identity Verification",
      description:
        "Integrate Aadhaar Verification API to verify identity securely with consent-based, compliance-ready workflows.",
      keywords:
        "Aadhaar Verification API, Aadhaar KYC API, Identity Verification API, UIDAI Verification API, Digital KYC API",
    },
    title: "Aadhaar Verification API",
    desc: "Verify Aadhaar details securely",
    heroTitle: "Aadhaar Verification API for Secure Digital Identity",
    heroSubtitle:
      "Verify Aadhaar details through consent-based, real-time verification workflows.",
    category: "verification",
    icon: ShieldCheck,
    docsUrl: "https://developers.eko.in/reference/aadhaar-verification-apis",
    heroImage: aadhaarImg,
    overview:
      "The Aadhaar Verification API enables businesses to validate Aadhaar details securely as part of identity verification and KYC processes. It is designed for regulated onboarding, fraud prevention, and compliance-driven use cases.",
    keyBenefits: [
      "Consent-based Aadhaar verification",
      "Faster customer onboarding",
      "Improved identity accuracy",
      "Reduced fraud and impersonation risk",
      "Scalable for high-volume KYC operations",
    ],
    features: [
      {
        title: "Consent-Based Verification",
        desc: "Aadhaar verification flows designed with user consent at the core.",
      },
      {
        title: "Real-Time Responses",
        desc: "Instant verification results with structured response payloads.",
      },
      {
        title: "Automation Ready",
        desc: "Seamlessly integrate into digital onboarding and KYC systems.",
      },
      {
        title: "Scalable Architecture",
        desc: "Built to handle large verification volumes reliably.",
      },
    ],
    whoShouldUse: [
      "Fintech companies and lenders",
      "Banks and NBFCs",
      "Marketplaces and platforms",
      "Enterprises with regulated onboarding requirements",
    ],
    useCases: [
      "Customer KYC onboarding",
      "User identity verification",
      "Account opening workflows",
      "Compliance and due diligence checks",
    ],
    trustAndCompliance: [
      "Consent-first verification approach",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start verifying Aadhaar details in production.",
      },
    ],
    leadForm: {
      title: "Get Aadhaar Verification API Access",
    },
    faqs: [
      {
        q: "Is Aadhaar verification consent-based?",
        a: "Yes, all Aadhaar verification flows are designed with explicit user consent at the core, ensuring transparency and compliance.",
      },
    ],
    // inputOutputPreview: comingSoonPreview("Aadhaar Verification"),
  },

  // -------------------------------------------------------------------------
  // MARK: Bank Acc
  // -------------------------------------------------------------------------
  bank: {
    seo: {
      title: "Bank Account Verification API India | Penny Drop & Name Match",
      description:
        "Verify bank account details instantly with Eko's Bank Verification API. Penny drop verification, IFSC validation, and account holder name matching for secure payouts.",
      keywords:
        "bank account verification API, penny drop API, IFSC validation API, bank verification, account verification, Eko API",
    },
    title: "Bank Account Verification API",
    desc: "Verify bank account details instantly with penny-drop verification",
    heroTitle:
      "Bank Account Verification API for Penny Drop & Name Matching in India",
    heroSubtitle:
      "Verify bank account details to prevent failed transactions and reduce operational costs. Instant verification with penny-drop and account holder name matching.",
    category: "verification",
    icon: Building2,
    docsUrl: "https://developers.eko.in/reference/bank-account-verification",
    heroImage: bankImg,
    features: [
      {
        title: "Penny Drop Verification",
        desc: "Send ₹1 to verify account exists and is active before large payouts.",
        icon: CreditCard,
      },
      {
        title: "Account Status Check",
        desc: "Verify if the account is active, dormant, or closed.",
        icon: CheckCircle,
      },
      {
        title: "Name Matching",
        desc: "Get account holder name for verification against provided details.",
        icon: FileText,
      },
      {
        title: "IFSC Validation",
        desc: "Validate IFSC codes and get bank branch details.",
        icon: Building,
      },
      {
        title: "Real-time Results",
        desc: "Get verification results within seconds for seamless workflows.",
        icon: Zap,
      },
      {
        title: "Bulk Verification",
        desc: "Verify multiple accounts in a single API call for batch processing.",
        icon: Database,
      },
    ],
    benefits: [
      {
        title: "Reduce Failed Payouts",
        desc: "Verify accounts before disbursement to minimize transaction failures and reversals.",
        icon: CheckCircle,
      },
      {
        title: "Prevent Fraud",
        desc: "Match account holder names to prevent payouts to wrong accounts.",
        icon: Shield,
      },
      {
        title: "Lower Operational Costs",
        desc: "Reduce cost of failed transactions, reversals, and manual reconciliation.",
        icon: CreditCard,
      },
      {
        title: "Instant Verification",
        desc: "Real-time results for seamless customer and vendor onboarding.",
        icon: Zap,
      },
      {
        title: "All Banks Supported",
        desc: "Verify accounts across all major banks in India through a single API.",
        icon: Building,
      },
      {
        title: "24/7 Availability",
        desc: "Round-the-clock verification service for reliable, high-volume workflows.",
        icon: Clock,
      },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start verifying real bank accounts before payouts.",
      },
    ],
    useCases: [
      "Salary Disbursement",
      "Vendor Payments",
      "Loan Disbursement",
      "Insurance Claims",
      "Refund Processing",
      "Incentive Payouts",
      "Commission Payments",
      "E-commerce Seller Onboarding",
    ],
    faqs: [
      {
        q: "What is penny drop verification?",
        a: "Penny drop is a method where a small amount (₹1) is transferred to verify the account is active and details are correct. The account holder name is returned for matching.",
      },
      {
        q: "Do customers receive the ₹1?",
        a: "Yes, the ₹1 is credited to the verified account. This is a real transaction that confirms the account is active and can receive funds.",
      },
      {
        q: "How accurate is name matching?",
        a: "Our intelligent name matching algorithm handles variations, abbreviations, and common spelling differences with 99%+ accuracy.",
      },
      {
        q: "Which banks are supported?",
        a: "We support all major banks in India including SBI, HDFC, ICICI, Axis, Kotak, Yes Bank, and 100+ other banks.",
      },
      {
        q: "What if verification fails?",
        a: "Failed verifications return specific error codes indicating the reason - invalid account, closed account, incorrect IFSC, etc. - helping you take appropriate action.",
      },
    ],
    inputOutputPreviews: [
      {
        apiName: "Bank Account Verification",
        description:
          "Verify a bank account number by transferring ₹1 to retrieve the name of the account holder",
        docsUrl:
          "https://developers.eko.in/reference/bank-account-verification",
        endpoint: "/bank-account-verification",
        inputs: [
          { label: "Account Number", value: "1234567890", icon: Hash },
          { label: "IFSC Code", value: "SBIN0001234", icon: Hash },
        ],
        outputs: [
          { label: "Account Status", value: "Valid", icon: CheckCircle },
          { label: "Account Holder Name", value: "Rajesh Kumar", icon: User },
          { label: "Bank", value: "State Bank of India", icon: Building },
          { label: "Branch", value: "MG Road Branch", icon: MapPin },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/bank-account/sync",
          request: {
            initiator_id: "9876543210",
            user_code: "20810200",
            bank_account: 1234567890,
            ifsc: "SBIN0001234",
            client_ref_id: "BANK-VER-20240101-001",
          },
          response: {
            status: 0,
            data: {
              account_exists: true,
              account_name: "Rajesh Kumar",
              ifsc: "SBIN0001234",
              bank: "State Bank of India",
              branch: "MG Road Branch",
              utr: "431712345678",
            },
            message: "Bank account verification successful",
          },
        },
      },
      {
        apiName: "Bulk Bank Account Verification",
        description: "Verify multiple bank accounts in a single API call",
        docsUrl:
          "https://developers.eko.in/reference/bulk-bank-account-verification",
        endpoint: "/bulk-bank-account-verification",
        inputs: [
          { label: "Entry 1", value: "1234567890, SBIN0001234", icon: Hash },
          { label: "Entry 2", value: "9876543210, HDFC0005678", icon: Hash },
        ],
        outputs: [
          { label: "Status", value: "Received", icon: CheckCircle },
          { label: "Reference ID", value: "123456", icon: Hash },
          { label: "Bulk Verification ID", value: "3356655212", icon: Hash },
          {
            label: "Note",
            value: "Poll Bulk Bank Account Verification Status API for results",
            icon: Info,
          },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/bank-account/bulk",
          request: {
            initiator_id: "9876543210",
            client_ref_id: "BULK-BANK-20240101-001",
            entries: [
              { bank_account: "1234567890", ifsc: "SBIN0001234" },
              { bank_account: "9876543210", ifsc: "HDFC0005678" },
            ],
          },
          response: {
            status: 0,
            data: {
              reference_id: 123456,
              bulk_verification_id: "3356655212",
            },
            message:
              "Bulk verification request accepted. Poll status API for results.",
          },
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: GST
  // -------------------------------------------------------------------------
  gst: {
    seo: {
      title: "GST Verification API India | Real-Time GSTIN Validation",
      description:
        "Integrate GST Verification API to validate GSTIN details instantly for vendor onboarding, compliance, and fraud prevention.",
      keywords:
        "GST Verification API, GSTIN Verification API, GST Check API, Business Verification API, GSTIN Validation API",
    },
    title: "GST Verification API",
    desc: "Validate GSTIN details instantly",
    heroTitle:
      "GST Verification API for GSTIN Validation & Business Onboarding",
    heroSubtitle:
      "Verify GSTIN status, legal name, trade name, taxpayer type, registration details, and principal address in real time for vendor onboarding, merchant verification, KYB, and compliance workflows.",
    category: "verification",
    icon: BarChart3,
    docsUrl: "https://developers.eko.in/reference/verify-gstin",
    // heroImage: gstImg,
    overview:
      "The GST Verification API enables businesses to validate GSTIN details instantly. It is designed for compliance-driven onboarding, vendor verification, and business identity checks where accuracy and traceability are critical.",
    keyBenefits: [
      "Instant GSTIN verification",
      "Improves vendor and merchant onboarding accuracy",
      "Reduces compliance and fraud risk",
      "Automates business verification workflows",
      "Scales for high-volume verification needs",
    ],
    features: [
      {
        title: "Real-Time GSTIN Validation",
        desc: "Verify GST registration details instantly with structured responses.",
      },
      {
        title: "Business Identity Confirmation",
        desc: "Validate legal business information before onboarding or payouts.",
      },
      {
        title: "Automation Ready",
        desc: "Easily integrate into KYB and compliance pipelines.",
      },
      {
        title: "High-Volume Support",
        desc: "Built to handle large verification volumes reliably.",
      },
    ],
    whoShouldUse: [
      "Marketplaces and B2B platforms",
      "Fintechs onboarding merchants or vendors",
      "Enterprises with supplier verification needs",
      "Compliance-driven organizations",
    ],
    useCases: [
      "Vendor and supplier onboarding",
      "Merchant verification for platforms",
      "Compliance and due diligence checks",
      "B2B onboarding workflows",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted verification communication",
      "Compliance-aligned data handling",
      "Audit-ready verification records",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start verifying GSTIN details in production.",
      },
    ],
    leadForm: {
      title: "Get GST Verification API Access",
    },
    faqs: [
      {
        q: "What details are returned in GST verification?",
        a: "The API returns GSTIN status, legal business name, trade name, constitution of business, taxpayer type, nature of business activities, registration date, last update date, state jurisdiction, and principal place of address.",
      },
      {
        q: "Is the data real-time?",
        a: "Yes, GSTIN details are verified in real time against official records.",
      },
    ],
    inputOutputPreviews: [
      {
        apiName: "GST Verification",
        description:
          "Validate GSTIN details instantly for vendor onboarding and compliance",
        docsUrl: "https://developers.eko.in/reference/verify-gstin",
        endpoint: "/verify-gstin",
        inputs: [
          { label: "GST Number", value: "29ABCDE1234F1Z5", icon: FileText },
          { label: "Business Name", value: "Acme Pvt Ltd", icon: Building },
        ],
        outputs: [
          { label: "GST Status", value: "Active" },
          {
            label: "Legal Name",
            value: "Acme Private Limited",
            icon: Building,
          },
          {
            label: "Trade Name",
            value: "Acme Private Limited",
            icon: Building,
          },
          { label: "Address", value: "123, MG Road, Bangalore", icon: MapPin },
          { label: "Constitution", value: "Private Limited", icon: Building },
          {
            label: "Nature of Business",
            value:
              "Wholesale, Supplier of Services, Recipient of Goods or Services",
            icon: Briefcase,
          },
          { label: "Taxpayer Type", value: "Regular", icon: User },
          { label: "Registration Date", value: "01/07/2017", icon: Calendar },
          { label: "Update Date", value: "01/02/2022", icon: Calendar },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/gstin",
          request: {
            initiator_id: "9876543210",
            client_ref_id: "GST-VER-20240101-001",
            gstin: "29ABCDE1234F1Z5",
            business_name: "Acme Pvt Ltd",
            user_code: "20810200",
          },
          response: {
            status: 0,
            data: {
              gstin: "29ABCDE1234F1Z5",
              gst_in_status: "Active",
              valid: true,
              legal_name_of_business: "Acme Private Limited",
              constitution_of_business: "Private Limited Company",
              taxpayer_type: "Regular",
              nature_of_business_activities: "Wholesale, Supplier of Services",
              date_of_registration: "01/07/2017",
              last_update_date: "01/02/2022",
              state_jurisdiction: "Karnataka",
              principal_place_address:
                "123, MG Road, Bangalore, Karnataka 560001",
            },
            message: "GSTIN verification successful",
          },
        },
      },
      {
        apiName: "Fetch GSTIN with PAN",
        description: "Fetch a list of GSTIN associated with a PAN",
        docsUrl: "https://developers.eko.in/reference/gstin-with-pan",
        endpoint: "/gstin-with-pan",
        inputs: [
          { label: "PAN Number", value: "ABCDE1234F", icon: CreditCard },
        ],
        outputs: [
          {
            label: "GSTIN List",
            value:
              "29ABCDE1234F1Z5 (Maharashtra / Active), 27ABCDE1234F1Z2 (Karnataka / Inactive)",
            icon: FileText,
          },
        ],
        sampleJson: {
          method: "POST",
          endpoint: "/tools/kyc/gstin-with-pan",
          request: {
            initiator_id: "9876543210",
            pan: "ABCDE1234F",
            user_code: "20810200",
            source: "API",
          },
          response: {
            status: 0,
            data: {
              pan: "ABCDE1234F",
              gstin_list: [
                {
                  gstin: "29ABCDE1234F1Z5",
                  status: "Active",
                  state: "Maharashtra",
                },
                {
                  gstin: "27ABCDE1234F1Z2",
                  status: "Inactive",
                  state: "Karnataka",
                },
              ],
            },
            message: "GSTIN fetch successful",
          },
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: UPI VPA
  // -------------------------------------------------------------------------
  upi: {
    seo: {
      title:
        "UPI ID Verification API India | Verify UPI VPA, Mobile & Payee Name",
      description:
        "Verify UPI IDs (VPA) and registered phone numbers in real time. Confirm payee name before initiating UPI transfers to reduce payout failures.",
      keywords:
        "UPI ID Verification API, VPA Verification API, UPI VPA check API, Verify UPI ID, Verify UPI VPA, Virtual Payment Address verification, UPI verification API India",
    },
    title: "UPI ID (VPA) Verification API",
    desc: "Verify UPI IDs (VPA) and registered phone number",
    heroTitle: "UPI ID (VPA) Verification API – Confirm Payee Before Payment",
    heroSubtitle:
      "Validate UPI IDs — also known as Virtual Payment Address (VPA) — and registered phone numbers in real time. Confirm payee name before initiating transfers to reduce payout failures and payment fraud.",
    category: "verification",
    icon: Zap,
    docsUrl: "https://developers.eko.in/reference/upi-validate-vpa",
    heroImage: upiVerifyImg,
    overview:
      "The UPI ID (VPA) Verification API validates Virtual Payment Addresses and registered phone numbers in real time. It returns the verified payee name, VPA, and registered mobile — helping you confirm the recipient before initiating UPI transfers and reducing wrong-payee payment failures.",
    keyBenefits: [
      "Real-time UPI ID (VPA) verification with payee name",
      "Verify registered phone number linked to VPA",
      "Reduces wrong-payee payment failures",
      "Well-documented integration flow",
      "24×7 manual integration support",
    ],
    features: [
      {
        title: "Verify UPI ID (VPA)",
        desc: "Validate whether a UPI ID (VPA) is correct and retrieve the registered payee name before initiating a transfer.",
      },
      {
        title: "Verify Registered Phone Number",
        desc: "Confirm the mobile number registered with the UPI ID (VPA) to strengthen payee verification.",
      },
      {
        title: "Payee Name Confirmation",
        desc: "Returns the verified recipient name linked to the UPI ID (VPA) — enables name-match checks before payment.",
      },
      {
        title: "Secure & Robust",
        desc: "Every API call is secured with one-time-use tokens generated using asymmetric cryptography.",
      },
    ],
    useCases: [
      "Pre-payment UPI ID (VPA) validation for UPI transfers",
      "Reducing payout failures caused by incorrect UPI IDs",
      "Customer onboarding where UPI ID (VPA) discovery is required",
      "Assisted payments (agent or retailer-led transactions)",
      "Payee name confirmation before bulk payouts",
    ],
    trustAndCompliance: [
      "Every API call is secured with one-time-use tokens generated using asymmetric cryptography",
      "Open-source libraries available to simplify and reduce integration errors",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start validating UPI ID (VPAs) in production.",
      },
    ],
    leadForm: {
      title: "Get UPI ID (VPA) Verification API Access",
    },
    faqs: [
      {
        q: "What is a VPA/UPI-ID?",
        a: "VPA (Virtual Payment Address) is the UPI ID used for sending and receiving payments — for example, rajesh@okicici. This API verifies whether a VPA is valid and returns the registered payee name.",
      },
      {
        q: "Can I verify the registered phone number?",
        a: "Yes. The API accepts a UPI ID (VPA) and registered mobile number, and returns the verified payee details including recipient name.",
      },
      {
        q: "What details are returned?",
        a: "The API returns the verified UPI ID (VPA), recipient name, registered mobile number, transaction ID, and verification status.",
      },
    ],
    inputOutputPreview: {
      apiName: "UPI ID (VPA) Verification",
      inputs: [
        { label: "UPI ID (VPA)", value: "rajesh.kumar@okicici", icon: Zap },
        { label: "Mobile Number", value: "9876543210", icon: Phone },
      ],
      outputs: [
        { label: "Status", value: "Transaction Success", icon: CheckCircle },
        { label: "Recipient Name", value: "Rajesh Kumar", icon: User },
        { label: "UPI ID (VPA)", value: "rajesh.kumar@okicici", icon: Zap },
        { label: "Mobile Number", value: "9876543210", icon: Phone },
        { label: "Transaction ID", value: "3560508954", icon: Hash },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/customer/payment/upi/validate-vpa",
        request: {
          initiator_id: "9876543210",
          user_code: "20810200",
          customer_vpa: "rajesh.kumar@okicici",
          client_ref_id: "VPA-VAL-20240101-001",
          recipient_mobile: "9876543210",
          name: "Rajesh Kumar",
          latlong: "28.6139,77.2090",
        },
        response: {
          status: 0,
          data: {
            vpa: "rajesh.kumar@okicici",
            valid: true,
            recipient_name: "Rajesh Kumar",
            mobile_number: "9876543210",
            transaction_id: "3560508954",
          },
          message: "VPA validation successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: DL
  // -------------------------------------------------------------------------
  dl: {
    seo: {
      title: "Driving License Verification API India | Real-Time DL Validation",
      description:
        "Integrate Driving License Verification API to validate driving license details instantly for KYC, onboarding, and compliance checks.",
      keywords:
        "Driving License Verification API, DL Verification API, Driving Licence Check API, Identity Verification API, KYC DL API",
    },
    title: "Driving License Verification API",
    desc: "Real-time DL validation",
    heroTitle: "Driving License Verification API for Driver Onboarding & KYC",
    heroSubtitle:
      "Verify driving license details in real time to strengthen KYC and reduce identity fraud.",
    category: "verification",
    icon: Truck,
    docsUrl: "https://developers.eko.in/reference/driving-license",
    // heroImage: dlImg,
    overview:
      "The Driving License Verification API enables businesses to validate driving license details instantly as part of identity verification and onboarding workflows. It helps confirm user identity, reduce impersonation risk, and meet compliance requirements.",
    keyBenefits: [
      "Instant driving license verification",
      "Improves identity validation accuracy",
      "Reduces impersonation and document fraud",
      "Supports digital KYC workflows",
      "Scales for high-volume verification needs",
    ],
    features: [
      {
        title: "Real-Time DL Validation",
        desc: "Verify driving license details instantly with structured verification responses.",
      },
      {
        title: "Identity Confirmation",
        desc: "Use DL data as a trusted identity signal during onboarding.",
      },
      {
        title: "Automation Ready",
        desc: "Seamlessly integrates into digital KYC and onboarding pipelines.",
      },
      {
        title: "High-Volume Support",
        desc: "Built to handle large verification volumes reliably.",
      },
    ],
    whoShouldUse: [
      "Fintech and lending platforms",
      "Mobility and logistics companies",
      "Marketplaces onboarding drivers or agents",
      "Enterprises with identity verification needs",
    ],
    useCases: [
      "Customer identity verification",
      "KYC onboarding workflows",
      "Driver or delivery partner onboarding",
      "Compliance and due diligence checks",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted data transmission",
      "Compliance-aligned verification workflows",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start verifying driving licenses in production.",
      },
    ],
    leadForm: {
      title: "Get Driving License Verification API Access",
    },
    faqs: [
      {
        q: "DL Verification vs RC Verification?",
        a: "Driving License Verification validates the person’s license details, such as holder name, DOB, validity, address, and vehicle class eligibility. Vehicle RC Verification validates vehicle registration details, ownership, fitness, insurance, and registration status. For complete driver and vehicle onboarding, combine DL Verification with RC Verification.",
      },
      {
        q: "How fast is DL verification?",
        a: "Verification is real-time with instant structured responses for driving license details.",
      },
      {
        q: "Can I use it for driver onboarding?",
        a: "Yes, it's ideal for onboarding drivers, delivery partners, and agents requiring identity confirmation.",
      },
    ],
    inputOutputPreview: {
      apiName: "DL Verification",
      inputs: [
        {
          label: "Driving License Number",
          value: "MH0220190001234",
          icon: CreditCard,
        },
      ],
      outputs: [
        { label: "Name", value: "Rajesh Kumar" },
        { label: "Date of Birth", value: "29/08/1994" },
        { label: "Address", value: "123, Andheri West, Mumbai" },
        { label: "Date of Issue", value: "15/03/2019" },
        { label: "DL Validity", value: "14/03/2039" },
        { label: "Father's/Husband's Name", value: "Suresh Kumar" },
        { label: "Badge Details", value: "Transport" },
        { label: "COV Details", value: "LMV, MCWG" },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/driving-license",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "DL-VER-20240101-001",
          dl_number: "MH0220190001234",
          dob: "1994-08-29",
          user_code: "20810200",
          source: "API",
        },
        response: {
          status: 0,
          data: {
            dl_number: "MH0220190001234",
            dob: "1994-08-29",
            status: "Active",
            details_of_driving_licence: {
              name: "Rajesh Kumar",
              father_or_husband_name: "Suresh Kumar",
              date_of_issue: "2019-03-15",
              status: "Active",
              address_list: [{ complete_address: "123, Andheri West, Mumbai" }],
            },
            dl_validity: {
              non_transport: { from: "2019-03-15", to: "2039-03-14" },
              transport: { from: "2019-03-15", to: "2039-03-14" },
            },
            badge_details: [{ class_of_vehicle: ["LMV", "MCWG"] }],
          },
          message: "DL verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Vehicle+RC
  // -------------------------------------------------------------------------
  rc: {
    seo: {
      title:
        "Vehicle & RC Verification API India | Registration, Ownership & Insurance Check",
      description:
        "Verify vehicle registration certificate (RC) details instantly — owner, chassis, engine, insurance, blacklist status, permits, and more. Pan-India coverage via VAHAN.",
      keywords:
        "Vehicle & RC Verification API, RC Verification API, Vehicle Registration Check API, Vehicle Verification API, RC Validation API, VAHAN API",
    },
    title: "Vehicle & RC Verification API",
    desc: "Complete vehicle registration, ownership & insurance verification",
    heroTitle:
      "Vehicle & RC Verification API for Ownership, Insurance & Compliance Checks",
    heroSubtitle:
      "Get complete vehicle information from a registration number — owner details, chassis, engine, insurance status, blacklist check, permits, and more. Pan-India coverage via VAHAN database.",
    category: "verification",
    icon: Truck,
    docsUrl: "https://developers.eko.in/reference/vehicle-rc",
    overview:
      "The Vehicle & RC Verification API enables businesses to fetch comprehensive vehicle information using a registration number. It returns RC status, owner details, chassis and engine numbers, manufacturer and model, insurance validity, permit details, blacklist and challan status, and more — all in a single API call. Designed for platforms that onboard drivers or vehicles, verify fleet compliance, underwrite motor insurance, or assess vehicle-related risk.",
    keyBenefits: [
      "Complete vehicle details in a single API call",
      "Confirms vehicle ownership and registration status",
      "Returns insurance validity, company, and policy number",
      "Blacklist and challan status check",
      "Permit and fitness certificate details for commercial vehicles",
      "Pan-India coverage via VAHAN database",
    ],
    features: [
      {
        title: "RC & Vehicle Details",
        desc: "Get registration status, make/model, chassis, engine, color, body type, fuel type, and manufacturing year.",
      },
      {
        title: "Owner & Address",
        desc: "Retrieve owner name, father's name, present and permanent address with structured components.",
      },
      {
        title: "Insurance Status",
        desc: "Check insurance company, policy number, and validity — critical for fleet compliance and motor insurance.",
      },
      {
        title: "Blacklist & Challan Check",
        desc: "Identify blacklisted vehicles and pending traffic challans for risk assessment.",
      },
      {
        title: "Permit & Fitness Details",
        desc: "Verify commercial vehicle permits, fitness certificates, and tax validity.",
      },
      {
        title: "Financier Information",
        desc: "Know if the vehicle is under finance and the lending institution — essential for used car and loan platforms.",
      },
    ],
    whoShouldUse: [
      "Mobility and ride-hailing platforms",
      "Logistics and delivery companies",
      "Fleet operators",
      "Motor insurance companies",
      "Vehicle finance and lending platforms",
      "Used car marketplaces",
    ],
    useCases: [
      "Driver and vehicle onboarding",
      "Fleet compliance monitoring",
      "Motor insurance underwriting",
      "Vehicle finance and loan verification",
      "Used car marketplace verification",
      "Logistics and delivery platforms",
      "Parking and toll management",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted verification communication",
      "Compliance-aligned data handling",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start verifying vehicle registrations in production.",
      },
    ],
    leadForm: {
      title: "Get Vehicle & RC Verification API Access",
    },
    faqs: [
      {
        q: "What details are returned?",
        a: "Owner name, RC status, vehicle class, fuel type, manufacturer, model, body type, color, chassis and engine number, registration and expiry dates, insurance company and validity, blacklist status, emission norms, and financier details.",
      },
      {
        q: "Is pan-India coverage available?",
        a: "Yes, we cover all states and union territories through integration with the VAHAN national database.",
      },
      {
        q: "Can I verify commercial vehicles?",
        a: "Yes, commercial vehicles return additional details like permit type, permit validity, fitness certificate status, national permit, and tax status.",
      },
      {
        q: "How accurate is the verification?",
        a: "All verifications are done against official RTO databases (VAHAN). Updates to vehicle information reflect in the source within 15–30 days.",
      },
      {
        q: "Is real-time verification available?",
        a: "Yes, all verifications are performed in real-time with sub-second response times for most queries.",
      },
      {
        q: "Can I check if a vehicle is blacklisted?",
        a: "Yes, the API returns blacklist status along with detailed reasons if the vehicle has been blacklisted.",
      },
      {
        q: "Are all returned fields available for every vehicle?",
        a: "No. Field availability may vary by vehicle type, RTO/source record, partner configuration, and data availability. The API response should be handled programmatically for missing or unavailable fields.",
      },
    ],
    inputOutputPreview: {
      apiName: "Vehicle & RC Verification",
      inputs: [{ label: "Vehicle Number", value: "HR26DA8398", icon: Car }],
      outputs: [
        { label: "Owner Name", value: "Arya ****", icon: User },
        { label: "RC Status", value: "Active", icon: CheckCircle },
        { label: "Blacklist Status", value: "Not Blacklisted", icon: Shield },
        { label: "Vehicle Class", value: "Motor Car", icon: Car },
        { label: "Fuel Type", value: "Petrol", icon: Flame },
        { label: "Manufacturer", value: "Mahindra & Mahindra", icon: Building },
        { label: "Body Type", value: "Hard Top", icon: Car },
        { label: "Vehicle Color", value: "Dark Grey", icon: Palette },
        { label: "Chassis Number", value: "MA1**************", icon: Hash },
        { label: "Engine Number", value: "N**********", icon: Hash },
        { label: "Registration Date", value: "2020", icon: Calendar },
        { label: "RC Expiry Date", value: "2039", icon: Calendar },
        {
          label: "Insurance Company",
          value: "Tata AIG General Insurance",
          icon: Shield,
        },
        { label: "Insurance Valid Upto", value: "2025", icon: Calendar },
        { label: "Emission Norms", value: "Bharat Stage VI", icon: Leaf },
        { label: "Financier", value: "****** Bank Ltd", icon: Building },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/vehicle-rc",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "RC-VER-20240101-001",
          vehicle_number: "HR26DA8398",
          user_code: "20810200",
          source: "API",
        },
        response: {
          status: 0,
          data: {
            reg_no: "HR26DA8398",
            owner: "Arya ****",
            rc_status: "Active",
            class: "Motor Car",
            vehicle_manufacturer_name: "Mahindra & Mahindra",
            model: "XUV300",
            vehicle_color: "Dark Grey",
            chassis: "MA1**************",
            engine: "N**********",
            reg_date: "2020-06-15",
            rc_expiry_date: "2039-06-14",
            vehicle_insurance_company_name: "Tata AIG General Insurance",
            vehicle_insurance_upto: "2025-06-14",
            fuel_type: "Petrol",
            body_type: "Hard Top",
            emission_norms: "Bharat Stage VI",
            financier: "****** Bank Ltd",
            blacklist_status: "Not Blacklisted",
            is_commercial: false,
          },
          message: "Vehicle RC verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: DigiLocker
  // -------------------------------------------------------------------------
  digilocker: {
    seo: {
      title:
        "DigiLocker API India | Consent Based Secure Digital Document Access",
      description:
        "Integrate DigiLocker API to access and verify user documents securely through consent-based digital workflows.",
      keywords:
        "DigiLocker API, Digital Document Verification API, Consent Based Document Access, Paperless KYC API, Government Document API",
    },
    title: "DigiLocker API",
    desc: "Secure digital document verification",
    heroTitle: "DigiLocker API for Consent-Based KYC & Document Verification",
    heroSubtitle:
      "Fetch and verify user-consented digital documents such as Aadhaar, PAN, driving licence, and other DigiLocker-issued records through secure, paperless API workflows for onboarding, lending, and compliance.",
    category: "verification",
    icon: FolderCheck,
    docsUrl: "https://developers.eko.in/reference/create-digilocker-url",
    overview:
      "The DigiLocker API enables businesses to fetch and verify user documents digitally with explicit consent. It eliminates manual document collection, reduces fraud, and accelerates onboarding through trusted digital records.",
    keyBenefits: [
      "Paperless document verification",
      "Consent-based access to user documents",
      "Faster onboarding and KYC completion",
      "Reduced document fraud and forgery risk",
      "Improved user experience",
    ],
    features: [
      {
        title: "Consent-Based Document Access",
        desc: "Fetch documents only after explicit user consent, ensuring transparency and trust.",
      },
      {
        title: "Digital Document Retrieval",
        desc: "Access verified digital documents without physical copies.",
      },
      {
        title: "Automation Ready",
        desc: "Integrates seamlessly into digital onboarding and compliance systems.",
      },
      {
        title: "Scalable Architecture",
        desc: "Designed to handle high-volume document access reliably.",
      },
    ],
    whoShouldUse: [
      "Banks and NBFCs",
      "Fintech and lending platforms",
      "Enterprises with digital onboarding",
      "Platforms requiring document verification",
    ],
    useCases: [
      "Digital KYC and onboarding",
      "Loan and credit processing",
      "Customer identity verification",
      "Compliance and due diligence workflows",
    ],
    trustAndCompliance: [
      "Consent-first data access",
      "Secure API authentication",
      "Encrypted document transmission",
      "Audit-ready access logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start accessing digital documents in production.",
      },
    ],
    leadForm: {
      title: "Get DigiLocker API Access",
    },
    faqs: [
      {
        q: "Does the DigiLocker API use OTP or redirect-based consent?",
        a: "The DigiLocker API uses a redirect-based consent mechanism. The user may authenticate through DigiLocker using the supported login or OTP process and then approve document sharing. Your application receives the verification result through the configured callback or API response.",
      },
      {
        q: "Is DigiLocker access consent-based?",
        a: "Yes, documents are fetched only after explicit user consent, ensuring full transparency.",
      },
      {
        q: "What documents can be accessed?",
        a: "You can access government-issued digital documents like Aadhaar, PAN, driving license, and more through DigiLocker.",
      },
      {
        q: "Does it eliminate physical document collection?",
        a: "Yes, the API enables fully paperless document verification, eliminating manual collection.",
      },
    ],
    inputOutputPreview: {
      apiName: "DigiLocker",
      inputs: [
        { label: "Document Requested", value: "AADHAAR", icon: FileText },
        {
          label: "Redirect URL",
          value: "https://yourapp.com/callback",
          icon: Globe,
        },
      ],
      outputs: [
        { label: "Status", value: "Success", icon: CheckCircle },
        {
          label: "DigiLocker URL",
          value:
            "https://digilocker.gov.in/link-verification?verification_id=123456",
          icon: Globe,
        },
        { label: "Reference ID", value: "12345", icon: Hash },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/digilocker",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "DGL-20240101-001",
          document_requested: ["AADHAAR"],
          redirect_url: "https://yourapp.com/callback",
          user_code: "20810200",
        },
        response: {
          status: 0,
          data: {
            reference_id: 12345,
            url: "https://digilocker.gov.in/link-verification?verification_id=123456",
            document_requested: ["AADHAAR"],
            redirect_url: "https://yourapp.com/callback",
          },
          message: "DigiLocker URL created successfully",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Employee
  // -------------------------------------------------------------------------
  employee: {
    seo: {
      title: "Employee Verification API India | Workforce Background Checks",
      description:
        "Verify employment history using phone number-based employee verification. Retrieve details such as employee name, PAN, UAN, Member ID, employer information, joining and exit dates, exit reason, and PF filing details for hiring, lending, staffing, and workforce onboarding workflows.",
      keywords:
        "Employee Verification API, Employee Background Check API, Workforce Verification API, HR Verification API, Employee KYC API",
    },
    title: "Employee Verification API",
    desc: "Digital employee identity verification",
    heroTitle:
      "Employee Verification API for Employment History Checks in India",
    heroSubtitle:
      "Verify employment history using phone number-based employee verification. Retrieve details such as employee name, PAN, UAN, Member ID, employer information, joining and exit dates, exit reason, and PF filing details for hiring, lending, staffing, and workforce onboarding workflows.",
    category: "verification",
    icon: Briefcase,
    heroImage: employeeImg,
    docsUrl: "https://developers.eko.in/reference/advance-employment",
    overview:
      "The Employee Verification API enables organizations to verify employee identity and related details digitally during hiring and onboarding. It is designed to reduce hiring risk, improve compliance, and streamline workforce verification workflows.",
    keyBenefits: [
      "Digital employee verification",
      "Reduced hiring and impersonation risk",
      "Faster onboarding cycles",
      "Automation-ready HR workflows",
      "Scalable for large hiring volumes",
    ],
    features: [
      {
        title: "Employee Identity Verification",
        desc: "Verify employee identity details digitally as part of onboarding.",
      },
      {
        title: "Hiring Risk Reduction",
        desc: "Detect inconsistencies early to reduce impersonation and compliance risk.",
      },
      {
        title: "Automation Friendly",
        desc: "Integrates seamlessly into HRMS, ATS, and onboarding platforms.",
      },
      {
        title: "High-Volume Support",
        desc: "Designed to support large-scale hiring and verification needs.",
      },
    ],
    whoShouldUse: [
      "Enterprises and large employers",
      "HR tech platforms",
      "Gig economy and staffing companies",
      "Organizations with compliance-driven hiring",
    ],
    useCases: [
      "Pre-employment verification",
      "Contractor and gig worker onboarding",
      "Workforce compliance checks",
      "Enterprise HR verification workflows",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted data transmission",
      "Compliance-aligned verification workflows",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying employees in production." },
    ],
    leadForm: {
      title: "Get Employee Verification API Access",
    },
    faqs: [
      {
        q: "What can be verified?",
        a: "Employee identity details including name, ID documents, and related information can be verified digitally.",
      },
      {
        q: "Does it integrate with HRMS?",
        a: "Yes, the API integrates seamlessly into HRMS, ATS, and onboarding platforms.",
      },
    ],
    inputOutputPreview: {
      apiName: "Employee Verification",
      inputs: [
        { label: "Phone Number", value: "+91 98765 43210", icon: Phone },
      ],
      outputs: [
        { label: "Employee Name", value: "Rajesh Kumar", icon: User },
        { label: "Gender", value: "Male", icon: User },
        { label: "Date of Birth", value: "29/08/1994", icon: Calendar },
        { label: "Aadhaar Verified", value: "No" },
        { label: "PAN Number", value: "ABCDE1234F", icon: IdCard },
        { label: "UAN", value: "1001234567890", icon: IdCard },
        { label: "Member ID", value: "MH/BOM/12345", icon: IdCard },
        { label: "Company Name", value: "Acme Pvt Ltd", icon: Building },
        { label: "Joining Date", value: "01/04/2019", icon: Calendar },
        { label: "Exit Date", value: "30/06/2023", icon: Calendar },
        { label: "Exit Reason", value: "Resignation", icon: Info },
        {
          label: "EPFO Details…",
          value: "PF Filing?, Name Unique?, …",
          icon: Info,
        },
        {
          label: "Employer Info…",
          value: "Name, Setup Date, PF Filing Details, …",
          icon: Info,
        },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/advance-employment",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "EMP-VER-20240101-001",
          phone: "9876543210",
          source: "API",
          user_code: "20810200",
        },
        response: {
          status: 0,
          data: {
            uan_details: [
              {
                uan: "1001234567890",
                basic_details: {
                  employee_name: "Rajesh Kumar",
                  gender: "Male",
                  dob: "1994-08-29",
                  phone: "9876543210",
                  aadhaar_verified: false,
                },
                employment_details: {
                  member_id: "MH/BOM/12345",
                  establishment_name: "Acme Pvt Ltd",
                  joining_date: "2019-04-01",
                  exit_date: "2023-06-30",
                  leave_reason: "Resignation",
                },
              },
            ],
          },
          message: "Employee verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Geocoding
  // -------------------------------------------------------------------------
  geocoding: {
    seo: {
      title: "Reverse Geocoding API India | Convert Coordinates to Address",
      description:
        "Integrate Reverse Geocoding API to convert latitude and longitude into accurate, structured address data for verification and compliance.",
      keywords:
        "Reverse Geocoding API, Location Verification API, Address Resolution API, Latitude Longitude to Address API, Geo Verification API",
    },
    title: "Reverse Geocoding API",
    desc: "Convert coordinates to addresses",
    heroTitle: "Reverse Geocoding API for Address Verification & Geo-Risk",
    heroSubtitle:
      "Convert latitude and longitude into structured Indian address data, including locality, city, state, PIN code, and country, for onboarding, field-agent verification, fraud checks, and compliance workflows.",
    category: "verification",
    icon: Globe,
    heroImage: revGeoImg,
    docsUrl: "https://developers.eko.in/reference/reverse-geocoding",
    overview:
      "The Reverse Geocoding API enables businesses to translate latitude and longitude coordinates into structured address information. It is designed for address validation, geo-compliance checks, and location-based risk assessment.",
    keyBenefits: [
      "Accurate latitude-to-address conversion",
      "Improves address and location verification",
      "Supports geo-compliance and risk checks",
      "Automation-ready for digital workflows",
      "Scales for high-volume location lookups",
    ],
    features: [
      {
        title: "Coordinate to Address Resolution",
        desc: "Convert latitude and longitude into structured, readable address data.",
      },
      {
        title: "Location Accuracy",
        desc: "Helps validate whether users or devices are operating from expected locations.",
      },
      {
        title: "Automation Friendly",
        desc: "Integrates easily into onboarding, verification, and monitoring systems.",
      },
      {
        title: "High-Volume Ready",
        desc: "Designed to handle frequent and large-scale geolocation queries.",
      },
    ],
    whoShouldUse: [
      "Fintechs and regulated platforms",
      "Enterprises verifying customer locations",
      "Field service and agent-based operations",
      "Platforms performing geo-risk analysis",
    ],
    useCases: [
      "Address verification during onboarding",
      "Geo-compliance and location validation",
      "Fraud detection and risk assessment",
      "Field agent or device location checks",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted request and response handling",
      "Compliance-aligned data processing",
      "Audit-ready lookup records",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start resolving addresses in production." },
    ],
    leadForm: {
      title: "Get Reverse Geocoding API Access",
    },
    faqs: [
      {
        q: "How accurate is the address returned?",
        a: "Accuracy depends on GPS precision. With standard coordinates, we return correct locality, city, and pincode.",
      },
      {
        q: "What address components are returned?",
        a: "We return formatted address, area/locality, city, district, state, pincode, and country.",
      },
      {
        q: "Can I use this for fraud detection?",
        a: "Yes, you can cross-check customer-provided addresses against GPS-derived addresses for fraud prevention.",
      },
    ],
    inputOutputPreview: {
      apiName: "Reverse Geocoding",
      inputs: [
        { label: "Latitude", value: "19.0760", icon: MapPin },
        { label: "Longitude", value: "72.8777", icon: MapPin },
      ],
      outputs: [
        {
          label: "Address",
          value: "6/B Mahatyagi Road, Chhatrapati Shivaji Terminus",
          icon: MapPin,
        },
        { label: "City", value: "Mumbai", icon: MapPin },
        { label: "State", value: "Maharashtra", icon: MapPin },
        { label: "PIN Code", value: "400001", icon: MapPin },
        { label: "Country", value: "India", icon: MapPin },
        { label: "State Code", value: "MH", icon: MapPin },
        { label: "Country Code", value: "IN", icon: MapPin },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/reverse-geocoding",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "GEO-20240101-001",
          latitude: "19.0760",
          longitude: "72.8777",
          user_code: "20810200",
          source: "API",
        },
        response: {
          status: 0,
          data: {
            latitude: "19.0760",
            longitude: "72.8777",
            address: "6/B Mahatyagi Road, Chhatrapati Shivaji Terminus",
            city: "Mumbai",
            state: "Maharashtra",
            statecode: "MH",
            countrycode: "IN",
            pincode: "400001",
            score: 0.95,
          },
          message: "Reverse geocoding successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Voter ID
  // -------------------------------------------------------------------------
  "voter-id": {
    seo: {
      title:
        "Voter ID Verification API India | Instant EPIC Validation for KYC",
      description:
        "Verify Voter ID (EPIC) details in real time — name, age, constituency, and address. Integrate Voter ID verification for KYC, onboarding, and identity checks.",
      keywords:
        "Voter ID Verification API, EPIC Verification API, Voter ID KYC API, Electoral Verification API, Identity Verification API India",
    },
    title: "Voter ID Verification API",
    desc: "Verify voter ID (EPIC) details in real time",
    heroTitle: "Voter ID Verification API for EPIC Validation & KYC",
    heroSubtitle:
      "Validate Voter ID (EPIC) card details instantly — fetch name, age, address, and constituency information for identity verification and onboarding workflows.",
    category: "verification",
    icon: Vote,
    docsUrl: "https://developers.eko.in/reference/voter-id",
    overview:
      "The Voter ID Verification API enables businesses to validate Electoral Photo Identity Card (EPIC) details against government records. Use it for identity verification, address confirmation, and compliance workflows.",
    keyBenefits: [
      "Instant EPIC validation against government records",
      "Fetches name, age, address, and constituency details",
      "Supports regional language name retrieval",
      "Suitable for high-volume verification workflows",
      "API-driven, automation-ready",
    ],
    features: [
      {
        title: "Real-Time EPIC Validation",
        desc: "Verify voter ID details instantly with structured responses including name, age, and address.",
      },
      {
        title: "Address Confirmation",
        desc: "Fetch full address with district, state, city, and pincode from voter records.",
      },
      {
        title: "Constituency Details",
        desc: "Returns assembly and parliamentary constituency information for geo-compliance.",
      },
      {
        title: "Regional Language Support",
        desc: "Retrieves voter name in regional language alongside English for cross-verification.",
      },
    ],
    whoShouldUse: [
      "Fintech and financial institutions",
      "Staffing and HR platforms",
      "Government and public sector applications",
      "Enterprises with KYC requirements",
    ],
    useCases: [
      "Customer identity verification",
      "Address verification for onboarding",
      "Employee background checks",
      "Government scheme eligibility validation",
    ],
    trustAndCompliance: [
      "Government source verification",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying Voter IDs in production." },
    ],
    leadForm: {
      title: "Get Voter ID Verification API Access",
    },
    faqs: [
      {
        q: "What details are returned?",
        a: "The API returns voter name (English and regional), age, date of birth, gender, full address, assembly and parliamentary constituency, father/guardian name, and polling station details.",
      },
      {
        q: "How fast is Voter ID verification?",
        a: "Verification is real-time with sub-second response times for instant identity validation.",
      },
      {
        q: "Can I use this for address verification?",
        a: "Yes. The API returns structured address data including district, city, state, and pincode — useful for address verification workflows.",
      },
      {
        q: "Are all fields available for every Voter ID?",
        a: "No. Field availability may vary by record, geography, source availability, and partner configuration. Your integration should handle unavailable or missing fields programmatically.",
      },
    ],
    inputOutputPreview: {
      apiName: "Voter ID Verification",
      inputs: [
        { label: "EPIC Number", value: "ABC1234567", icon: IdCard },
        { label: "Name", value: "Rajesh Kumar", icon: User },
      ],
      outputs: [
        { label: "Name", value: "Rajesh Kumar", icon: User },
        { label: "Name (Regional)", value: "राजेश कुमार" },
        { label: "Age", value: "34", icon: Calendar },
        { label: "Gender", value: "Male", icon: User },
        { label: "Father's Name", value: "Suresh Kumar", icon: User },
        { label: "Address", value: "Ward 12, Sector 5, Noida", icon: MapPin },
        { label: "Assembly Constituency", value: "Noida (62)", icon: MapPin },
        {
          label: "Parliamentary Constituency",
          value: "Gautam Buddha Nagar",
          icon: MapPin,
        },
        {
          label: "Polling Station",
          value: "Govt. School Noida Sec 5",
          icon: MapPin,
        },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/voter-id",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "VOTER-20240101-001",
          epic_number: "ABC1234567",
          name: "Rajesh Kumar",
          source: "API",
          user_code: "20810200",
        },
        response: {
          status: 0,
          data: {
            name: "Rajesh Kumar",
            age: "34",
            dob: "1994-08-29",
            gender: "Male",
            father_name: "Suresh Kumar",
            epic_number: "ABC1234567",
            address: "Ward 12, Sector 5, Noida",
            state: "Uttar Pradesh",
            assembly_constituency: "Noida (62)",
            parliamentary_constituency: "Gautam Buddha Nagar",
            polling_station: "Govt. School Noida Sec 5",
            split_address: {
              district: ["Gautam Buddha Nagar"],
              city: ["Noida"],
              pincode: "201301",
            },
          },
          message: "Voter ID verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Passport
  // -------------------------------------------------------------------------
  passport: {
    seo: {
      title: "Passport Verification API India | File Number & DOB Verification",
      description:
        "Verify Indian passport details using file number and date of birth. Eko’s Passport Verification API returns status, holder name, DOB, application type and application received date for KYC and BGV workflows.",
      keywords:
        "Passport Verification API, Passport KYC API, Passport Validation API, Travel Document Verification API, Identity Verification API India",
    },
    title: "Passport Verification API",
    desc: "Verify Indian passport details in real time",
    heroTitle:
      "Passport Verification API for Indian Passport File Number Checks",
    heroSubtitle:
      "Verify Indian passport application details using passport file number and date of birth. Retrieve verification status, holder name, date of birth, application type, and application received date for KYC, employee BGV, travel, and compliance workflows.",
    category: "verification",
    icon: Plane,
    docsUrl: "https://developers.eko.in/reference/passport",
    overview:
      "The Passport Verification API enables businesses to validate passport holder details using passport file number and date of birth.",
    keyBenefits: [
      "Instant passport detail verification",
      "Confirms holder name and date of birth",
      "Returns application type and status",
      "API-driven, automation-ready workflows",
      "Suitable for travel and compliance use cases",
    ],
    features: [
      {
        title: "Real-Time Passport Validation",
        desc: "Verify Indian passport file number and holder details with instant structured responses.",
      },
      {
        title: "Identity Confirmation",
        desc: "Cross-check holder name and date of birth against passport records.",
      },
      {
        title: "Application Status",
        desc: "Returns application type and received date for processing verification.",
      },
      {
        title: "Automation Friendly",
        desc: "Easily integrate into digital onboarding, KYC, and compliance pipelines.",
      },
    ],
    whoShouldUse: [
      "Travel and hospitality platforms",
      "Staffing and HR platforms",
      "Financial institutions",
      "Government and immigration services",
    ],
    useCases: [
      "Employee background verification",
      "Travel compliance checks",
      "Visa and immigration assistance",
      "Fintech and NBFC KYC",
      "Education / overseas placement",
    ],
    trustAndCompliance: [
      "Government source verification",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying passports in production." },
    ],
    leadForm: {
      title: "Get Passport Verification API Access",
    },
    faqs: [
      {
        q: "Is this passport number verification or file number verification?",
        a: "This API verifies Indian passport details using passport file number and date of birth. It is not a passport-number-only verification flow.",
      },
      {
        q: "What inputs are required?",
        a: "The required inputs are passport file number and date of birth. A unique verification ID is also used for request tracking. Name may be used depending on the verification flow.",
      },
      {
        q: "Does this API support foreign passports?",
        a: "No. This API supports Indian passport verification only.",
      },
      {
        q: "What details are returned?",
        a: "The API can return verification status, passport file number, holder name, date of birth, application type, and the application received date.",
      },
      {
        q: "Does it return passport issue date or expiry date?",
        a: "No, not as part of the standard source response shown in the current API documentation. Do not rely on issue date or expiry date unless separately enabled in your Eko API response.",
      },
      {
        q: "Does it verify scanned passport images?",
        a: "No. This is not an OCR or MRZ scan-verification API. It verifies passport details using structured input fields.",
      },
      {
        q: "What happens if the details are invalid?",
        a: "The API returns an invalid status. Your workflow should ask the user to verify the file number, date of birth, and name before retrying.",
      },
      {
        q: "How fast is passport verification?",
        a: "Verification is real-time with sub-second response times.",
      },
    ],
    inputOutputPreview: {
      apiName: "Passport Verification",
      inputs: [
        {
          label: "Passport File Number",
          value: "PA1079341954215",
          icon: FileText,
        },
        { label: "Date of Birth", value: "1994-08-29", icon: Calendar },
        { label: "Name", value: "Rajesh Kumar", icon: User },
      ],
      outputs: [
        { label: "File Number", value: "PA1079341954215", icon: FileText },
        { label: "Name", value: "Rajesh Kumar", icon: User },
        { label: "Date of Birth", value: "1994-08-29", icon: Calendar },
        { label: "Application Type", value: "Normal" },
        { label: "Application Received Date", value: "2023-01-15" },
        { label: "Status", value: "VALID", icon: CheckCircle },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/passport",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "PASS-20240101-001",
          file_number: "J8369854",
          dob: "1994-08-29",
          name: "Rajesh Kumar",
          user_code: "20810200",
          source: "API",
        },
        response: {
          status: 0,
          data: {
            file_number: "J8369854",
            name: "Rajesh Kumar",
            dob: "1994-08-29",
            application_type: "Normal",
            application_received_date: "2023-01-15",
          },
          message: "Passport verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: CIN
  // -------------------------------------------------------------------------
  cin: {
    seo: {
      title: "CIN Verification API India | Company Identity Validation via MCA",
      description:
        "Verify Company Identification Number (CIN) details instantly. Fetch company name, incorporation date, directors, and status from MCA records for KYB and compliance.",
      keywords:
        "CIN Verification API, Company Verification API, MCA Verification API, KYB API India, Corporate Identity API",
    },
    title: "CIN Verification API",
    desc: "Validate Company Identification Numbers via MCA",
    heroTitle: "CIN Verification API for KYB & Corporate Due Diligence",
    heroSubtitle:
      "Verify Company Identification Numbers (CIN) instantly — fetch company name, registration number, incorporation date, directors, and status from Ministry of Corporate Affairs records.",
    category: "verification",
    icon: Landmark,
    docsUrl: "https://developers.eko.in/reference/cin",
    overview:
      "The CIN Verification API enables businesses to validate Company Identification Numbers against MCA records. Use it for KYB workflows, corporate due diligence, vendor verification, and compliance checks.",
    keyBenefits: [
      "Instant CIN validation against MCA records",
      "Returns company name, directors, and incorporation details",
      "Confirms CIN status (active/struck-off/dormant)",
      "Supports KYB and corporate compliance workflows",
      "API-driven, automation-ready",
    ],
    features: [
      {
        title: "Real-Time CIN Validation",
        desc: "Verify CIN details instantly with structured responses including company name and status.",
      },
      {
        title: "Director Information",
        desc: "Fetch director details including name, DIN, designation, and date of birth.",
      },
      {
        title: "Incorporation Details",
        desc: "Returns registration number, incorporation date, and country of incorporation.",
      },
      {
        title: "Status Verification",
        desc: "Confirms whether the company is active, struck-off, dormant, or under liquidation.",
      },
    ],
    whoShouldUse: [
      "Lending and financial institutions",
      "Marketplace and e-commerce platforms",
      "Accounting and compliance firms",
      "Enterprises performing vendor due diligence",
    ],
    useCases: [
      "Merchant and vendor KYB",
      "Corporate due diligence",
      "Lending to corporate borrowers",
      "Supply chain partner verification",
    ],
    trustAndCompliance: [
      "MCA source verification",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying CINs in production." },
    ],
    leadForm: {
      title: "Get CIN Verification API Access",
    },
    faqs: [
      {
        q: "Can I verify LLPs with this API?",
        a: "CIN is specific to companies registered under the Companies Act. LLPs use LLPIN — contact us for LLP verification availability.",
      },
      {
        q: "What details are returned?",
        a: "The API returns company name, CIN, registration number, incorporation date, CIN status, email, incorporation country, and an array of director details (name, DIN, designation, and date of birth).",
      },
      {
        q: "How fast is CIN verification?",
        a: "Verification is real-time with sub-second response times.",
      },
      {
        q: "Is director information included?",
        a: "Yes. The API returns director details including name, DIN, designation, and date of birth for all directors listed in MCA records.",
      },
      {
        q: "Are all fields available for every CIN?",
        a: "No. Field availability may vary by MCA record, company type, data availability, and partner configuration. Your integration should handle unavailable or missing fields programmatically.",
      },
    ],
    inputOutputPreview: {
      apiName: "CIN Verification",
      inputs: [
        { label: "CIN", value: "U72900KA2015PTC082988", icon: Building },
      ],
      outputs: [
        {
          label: "Company Name",
          value: "Acme Technologies Pvt Ltd",
          icon: Building,
        },
        { label: "CIN Status", value: "Active", icon: CheckCircle },
        { label: "Registration Number", value: "82987", icon: Hash },
        { label: "Incorporation Date", value: "2015-09-23", icon: Calendar },
        { label: "Email", value: "contact@acmetech.in", icon: Mail },
        { label: "Incorporation Country", value: "India", icon: Globe },
        {
          label: "Director 1",
          value: "Rahul Mehta (DIN: 07168822) — Director",
          icon: User,
        },
        {
          label: "Director 2",
          value: "Priya Sharma (DIN: 07168826) — Director",
          icon: User,
        },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/cin",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "CIN-20240101-001",
          cin: "U72900KA2015PTC082988",
          user_code: "20810200",
          source: "API",
        },
        response: {
          status: 0,
          data: {
            cin: "U72900KA2015PTC082988",
            company_name: "Acme Technologies Pvt Ltd",
            registration_number: 82987,
            incorporation_date: "2015-09-23",
            cin_status: "Active",
            email: "contact@acmetech.in",
            incorporation_country: "India",
            director_details: [
              {
                name: "Rahul Mehta",
                din: "07168822",
                designation: "Director",
                dob: "1985-03-12",
              },
              {
                name: "Priya Sharma",
                din: "07168826",
                designation: "Director",
                dob: "1988-07-25",
              },
            ],
          },
          message: "CIN verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: IP Verification
  // -------------------------------------------------------------------------
  ip: {
    seo: {
      title: "IP Verification API India | IP Geolocation & Risk Scoring",
      description:
        "Verify IP addresses with geolocation, proxy detection, and risk scoring. Prevent fraud and enforce geo-compliance with real-time IP intelligence.",
      keywords:
        "IP Verification API, IP Geolocation API, IP Risk Score API, Proxy Detection API, Fraud Prevention API India",
    },
    title: "IP Verification API",
    desc: "Geo-locate and risk-score IP addresses",
    heroTitle: "IP Verification API for Fraud Prevention & Geo-Compliance",
    heroSubtitle:
      "Verify IP addresses in real time — detect proxies, geo-locate users, and assess risk scores for fraud prevention and geo-compliance workflows.",
    category: "verification",
    icon: Globe2,
    docsUrl: "https://developers.eko.in/reference/ip",
    overview:
      "The IP Verification API enables businesses to geo-locate IP addresses, detect proxies and VPNs, and assess risk scores. Use it for fraud prevention, geo-compliance, and user location verification.",
    keyBenefits: [
      "Real-time IP geolocation with city-level accuracy",
      "Proxy and VPN detection",
      "City and proxy-type risk scoring",
      "Supports geo-compliance enforcement",
      "API-driven, automation-ready",
    ],
    features: [
      {
        title: "IP Geolocation",
        desc: "Resolve IP addresses to country, region, and city for location-based decisions.",
      },
      {
        title: "Proxy & VPN Detection",
        desc: "Identify proxy type and category to flag suspicious connection sources.",
      },
      {
        title: "Risk Scoring",
        desc: "Get city-level and proxy-type risk scores for fraud assessment.",
      },
      {
        title: "Real-Time Processing",
        desc: "Instant IP intelligence for inline fraud checks during transactions.",
      },
    ],
    whoShouldUse: [
      "Fintech and digital lending platforms",
      "E-commerce and marketplace platforms",
      "SaaS and subscription platforms",
      "Insurance and compliance platforms",
    ],
    useCases: [
      "Transaction fraud detection",
      "Geo-compliance enforcement",
      "User location verification during KYC",
      "Bot and scraping detection",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted data transmission",
      "DPDP-aligned data processing",
      "Audit-ready lookup records",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying IP addresses in production." },
    ],
    leadForm: {
      title: "Get IP Verification API Access",
    },
    faqs: [
      {
        q: "What details are returned?",
        a: "The API returns IP address, proxy type, country code and name, region, city, city risk score, and proxy-type risk score.",
      },
      {
        q: "Can it detect VPNs?",
        a: "Yes. The API identifies proxy type including VPN, residential proxy, data center proxy, and other classifications.",
      },
      {
        q: "How is the risk score calculated?",
        a: "Risk scores are based on factors like cybersecurity threats, proxy type classification, and historical threat intelligence for the city and connection type.",
      },
      {
        q: "Is this suitable for real-time fraud checks?",
        a: "Yes. The API is designed for inline transaction-level fraud checks with sub-second response times.",
      },
    ],
    inputOutputPreview: {
      apiName: "IP Verification",
      inputs: [{ label: "IP Address", value: "103.21.58.193", icon: Globe2 }],
      outputs: [
        { label: "Country", value: "India (IN)", icon: Globe2 },
        { label: "Region", value: "Maharashtra", icon: MapPin },
        { label: "City", value: "Mumbai", icon: MapPin },
        { label: "Proxy Type", value: "None", icon: Shield },
        { label: "City Risk Score", value: "12 / 100", icon: AlertTriangle },
        { label: "Proxy Risk Score", value: "0 / 100", icon: AlertTriangle },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/ip",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "IP-20240101-001",
          ip_address: "103.21.58.193",
          source: "API",
          user_code: "20810200",
        },
        response: {
          status: 0,
          data: {
            ip_address: "103.21.58.193",
            proxy_type: "None",
            country_code: "IN",
            country_name: "India",
            region_name: "Maharashtra",
            city_name: "Mumbai",
            city_risk_score: "12",
            proxy_type_risk_score: "0",
          },
          message: "IP verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Name Match
  // -------------------------------------------------------------------------
  "name-match": {
    seo: {
      title:
        "Name Match API India | AI-Powered Name Matching for KYC & Compliance",
      description:
        "AI-powered name matching API trained on 100M+ Indian name records. Compare names across identity documents — handles initials, phonetic variants, regional spellings, and salutations.",
      keywords:
        "Name Match API, AI Name Matching API, Fuzzy Name Matching API, Name Comparison API, KYC Name Verification API, Identity Matching API India",
    },
    title: "Name Match API",
    desc: "AI-powered name matching across identity documents",
    heroTitle: "Name Match API for Cross-Document Identity Verification",
    heroSubtitle:
      "AI-powered name comparison trained on 100M+ Indian name records. Compare names across PAN, Aadhaar, bank, and GST records — get a match score (0–1) and category (Direct Match, Partial Match, No Match) for automated KYC decisions.",
    category: "verification",
    icon: ScanText,
    docsUrl: "https://developers.eko.in/reference/name-match",
    overview:
      "Name Match is an AI-powered name comparison API built for India's complex naming conventions. Trained on over 100 million Indian name records, it handles initials, abbreviations, phonetic and regional spelling variants, salutation patterns, and subset matching — returning a match score (0 to 1) and match category for automated decision-making.",
    keyBenefits: [
      "AI-powered, trained on 100M+ Indian name records",
      "Returns score (0–1) and match category for rule-based decisions",
      "Handles initials, abbreviations, phonetic and regional spelling variants",
      "Reduces false mismatches and manual review overhead",
      "Real-time and scalable",
    ],
    features: [
      {
        title: "Indian Name Intelligence",
        desc: "Handles initials, middle names, abbreviations, and subset matching (e.g. Harsh Kishore → HKishore) with high accuracy.",
      },
      {
        title: "Phonetic & Regional Variants",
        desc: "Understands phonetic similarities and regional spelling variations across Indian languages and naming conventions.",
      },
      {
        title: "Context-Aware Matching",
        desc: "Considers name sequence, gender, regional norms, and salutation patterns (e.g. S/O, D/O) for accurate results.",
      },
      {
        title: "Score + Category Response",
        desc: "Returns a 0–1 score with match categories: Direct Match (1.0), Good Partial (0.85–0.99), Moderate Partial (0.60–0.84), Poor Partial (0.34–0.59), No Match (0–0.33).",
      },
    ],
    whoShouldUse: [
      "Lending and financial institutions",
      "Accounting and tax platforms",
      "Marketplace and e-commerce platforms",
      "Enterprises performing KYC/KYB",
    ],
    useCases: [
      "Cross-document KYC name validation",
      "ITC fraud detection via GST-PAN-bank name checks",
      "Lending name match for fraud prevention",
      "Merchant onboarding name consistency checks",
      "Payout reconciliation",
      "Risk and fraud prevention",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready match records",
      "Compliance-aligned verification workflows",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start matching names in production." },
    ],
    leadForm: {
      title: "Get Name Match API Access",
    },
    faqs: [
      {
        q: "How does the matching work?",
        a: "Name Match uses AI trained on 100M+ Indian name records. It handles initials, phonetic variants, regional spellings, salutation patterns (S/O, D/O), subset matching, and name ordering variations.",
      },
      {
        q: "What is the score range?",
        a: "The API returns a score from 0 to 1: Direct Match (1.0), Good Partial Match (0.85–0.99), Moderate Partial Match (0.60–0.84), Poor Partial Match (0.34–0.59), No Match (0–0.33). Set your own threshold based on risk tolerance.",
      },
      {
        q: "What examples of Indian name variations does it handle?",
        a: "Initials (S K Mishra → Satish Kumar Mishra), subsets (Harsh Kishore → HKishore), salutations (Aditya Roy S/O Jatin), missing middle names, extra spaces, and phonetic/regional spelling variants.",
      },
      {
        q: "Can I use this for GST ITC fraud detection?",
        a: "Yes. Cross-validating supplier PAN name, GST trade name, and bank account holder name catches fake invoice fraud that manual review misses.",
      },
    ],
    inputOutputPreview: {
      apiName: "Good Partial Match",
      inputs: [
        { label: "Name 1", value: "S K Mishra", icon: User },
        { label: "Name 2", value: "Satish Kumar Mishra", icon: User },
      ],
      outputs: [
        { label: "Status", value: "Success", icon: CheckCircle },
        { label: "Match Score", value: "0.92" },
        {
          label: "Match Category",
          value: "Good Partial Match",
          icon: CheckCircle,
        },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/name-match",
        request: {
          initiator_id: "9876543210",
          client_ref_id: "NAME-20240101-001",
          name_1: "S K Mishra",
          name_2: "Satish Kumar Mishra",
          source: "API",
          user_code: "20810200",
        },
        response: {
          status: 0,
          data: {
            name_1: "S K Mishra",
            name_2: "Satish Kumar Mishra",
            score: 0.92,
            reason: "Names match with initials expanded",
          },
          message: "Name match successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: ITR Compliance
  // -------------------------------------------------------------------------
  itr: {
    seo: {
      title: "ITR Compliance API India | Income Tax Filing Status Check",
      description:
        "Check income tax return filing and compliance status using PAN number. Verify ITR compliance for lending, credit assessment, and due diligence workflows.",
      keywords:
        "ITR Compliance API, Income Tax Verification API, ITR Status Check API, PAN ITR API, Tax Compliance API India",
    },
    title: "ITR Compliance Check API",
    desc: "Check income tax return filing and compliance status",
    heroTitle: "ITR Compliance API for Lending & Credit Assessment",
    heroSubtitle:
      "Verify income tax return filing and compliance status using PAN — assess borrower and business creditworthiness with real-time ITR data for lending and due diligence workflows.",
    category: "verification",
    icon: IndianRupee,
    docsUrl: "https://developers.eko.in/reference/itr-compliance",
    overview:
      "The ITR Compliance Check API enables businesses to verify income tax return filing status using a PAN number. Use it for credit assessment, lending due diligence, and compliance verification.",
    keyBenefits: [
      "Instant ITR filing status via PAN",
      "Supports credit assessment workflows",
      "Validates tax compliance for lending",
      "API-driven, automation-ready",
      "Suitable for high-volume checks",
    ],
    features: [
      {
        title: "ITR Filing Status",
        desc: "Check whether a PAN holder has filed income tax returns and their compliance standing.",
      },
      {
        title: "PAN-Based Lookup",
        desc: "Simple PAN number input — no additional documents or consent flows required.",
      },
      {
        title: "Credit Assessment Signal",
        desc: "Use ITR filing patterns as a proxy for income verification and creditworthiness.",
      },
      {
        title: "Automation Friendly",
        desc: "Integrate into lending pipelines, onboarding flows, and compliance checks seamlessly.",
      },
    ],
    whoShouldUse: [
      "Lending and NBFC platforms",
      "Accounting and tax firms",
      "Real estate and property platforms",
      "Enterprises performing financial due diligence",
    ],
    useCases: [
      "Borrower credit assessment",
      "MSME income verification",
      "Vendor and supplier due diligence",
      "Tax compliance verification for onboarding",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted data transmission",
      "Compliance-aligned verification workflows",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start checking ITR compliance in production.",
      },
    ],
    leadForm: {
      title: "Get ITR Compliance API Access",
    },
    faqs: [
      {
        q: "What input is required?",
        a: "Only the PAN number is required to check ITR compliance status.",
      },
      {
        q: "What details are returned?",
        a: "The API returns ITR filing status, assessment year, and compliance status for the given PAN number.",
      },
      {
        q: "Can I use this for lending decisions?",
        a: "Yes. ITR compliance status is a strong signal for borrower creditworthiness, especially for MSMEs without traditional credit bureau scores.",
      },
      {
        q: "How fast is the check?",
        a: "The API returns results in real time with sub-second response times.",
      },
    ],
    inputOutputPreview: {
      apiName: "ITR Compliance Check",
      inputs: [{ label: "PAN Number", value: "ABCDE1234F", icon: CreditCard }],
      outputs: [
        { label: "PAN Number", value: "ABCDE1234F", icon: CreditCard },
        { label: "ITR Filing Status", value: "Filed", icon: CheckCircle },
        { label: "Assessment Year", value: "2024-25" },
        { label: "Compliance Status", value: "Compliant", icon: Shield },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/touras/itr-compliance",
        request: {
          initiator_id: "9876543210",
          user_code: "20810200",
          pan_number: "ABCDE1234F",
        },
        response: {
          status: 0,
          data: {
            pan_number: "ABCDE1234F",
            itr_filed: true,
            assessment_year: "2024-25",
            compliance_status: "Compliant",
          },
          message: "ITR compliance check successful",
        },
      },
    },
  },

  // ------------------------------------
  // MARK: DIN
  // ------------------------------------
  din: {
    seo: {
      title:
        "DIN Verification API India | Director Identity Validation via MCA",
      description:
        "Verify Director Identification Number (DIN) details instantly. Validate director identity for corporate due diligence, KYB, and compliance workflows.",
      keywords:
        "DIN Verification API, Director Verification API, MCA Director Check API, Corporate KYB API, Director Identity API India",
    },
    title: "DIN Verification API",
    desc: "Verify Director Identification Numbers via MCA",
    heroTitle: "DIN Verification API for Corporate Due Diligence",
    heroSubtitle:
      "Validate Director Identification Numbers (DIN) against MCA records — verify director identity, designation, and associated companies for KYB and compliance workflows.",
    category: "verification",
    icon: BadgeCheck,
    docsUrl: "https://developers.eko.in/reference/din-verification",
    overview:
      "The DIN Verification API enables businesses to validate Director Identification Numbers against Ministry of Corporate Affairs records. Use it for corporate due diligence, KYB workflows, and director background checks.",
    keyBenefits: [
      "Instant DIN validation against MCA records",
      "Confirms director identity and status",
      "Supports corporate KYB workflows",
      "API-driven, automation-ready",
      "Suitable for high-volume verification",
    ],
    features: [
      {
        title: "Real-Time DIN Validation",
        desc: "Verify DIN details instantly against Ministry of Corporate Affairs records.",
      },
      {
        title: "Director Identity",
        desc: "Confirm director name, designation, and DIN status for due diligence.",
      },
      {
        title: "Corporate Linkage",
        desc: "Identify companies associated with a director for cross-referencing.",
      },
      {
        title: "Automation Friendly",
        desc: "Integrate into KYB pipelines, compliance checks, and onboarding workflows.",
      },
    ],
    whoShouldUse: [
      "Lending and financial institutions",
      "Accounting and compliance firms",
      "Marketplace and e-commerce platforms",
      "Enterprises performing corporate due diligence",
    ],
    useCases: [
      "Director background verification",
      "Corporate KYB workflows",
      "Lending to corporate borrowers",
      "Vendor and supplier due diligence",
    ],
    trustAndCompliance: [
      "MCA source verification",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying DINs in production." },
    ],
    leadForm: {
      title: "Get DIN Verification API Access",
    },
    faqs: [
      {
        q: "What input is required?",
        a: "Only the Director Identification Number (DIN) is required.",
      },
      {
        q: "What details are returned?",
        a: "The API returns director name, DIN status, designation, and associated company information from MCA records.",
      },
      {
        q: "How is DIN different from CIN?",
        a: "DIN identifies individual directors, while CIN identifies companies. Use DIN Verification for director-level checks and CIN Verification for company-level checks.",
      },
      {
        q: "Can I verify multiple directors at once?",
        a: "Each API call verifies one DIN. For bulk verification, you can make parallel API calls.",
      },
    ],
    inputOutputPreview: {
      apiName: "DIN Verification",
      inputs: [{ label: "DIN Number", value: "06731826", icon: BadgeCheck }],
      outputs: [
        { label: "Director Name", value: "Abhishek Sagar", icon: User },
        { label: "DIN Status", value: "Active", icon: CheckCircle },
        { label: "Designation", value: "Director" },
        {
          label: "Associated Company",
          value: "Eko India Financial Services Pvt Ltd",
          icon: Building,
        },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/touras/din-verification",
        request: {
          initiator_id: "9876543210",
          user_code: "20810200",
          din_number: "06731826",
        },
        response: {
          status: 0,
          data: {
            din: "06731826",
            director_name: "Abhishek Sagar",
            din_status: "Active",
            designation: "Director",
            company_name: "Eko India Financial Services Pvt Ltd",
          },
          message: "DIN verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: E-Challan
  // -------------------------------------------------------------------------
  "e-challan": {
    seo: {
      title:
        "E-Challan Verification API India | Traffic Challan Check for Vehicles",
      description:
        "Check pending traffic challans for any vehicle using registration number. Integrate e-challan verification for fleet compliance, insurance, and driver onboarding.",
      keywords:
        "E-Challan API, Traffic Challan API, Vehicle Challan Check API, Fleet Compliance API, Traffic Violation API India",
    },
    title: "E-Challan Verification API",
    desc: "Check pending traffic challans for vehicles",
    heroTitle: "E-Challan Verification API for Fleet & Vehicle Compliance",
    heroSubtitle:
      "Fetch pending traffic challans for any vehicle using its registration number — automate fleet compliance monitoring, insurance risk assessment, and driver onboarding checks.",
    category: "verification",
    icon: TicketCheck,
    docsUrl: "https://developers.eko.in/reference/e-challan",
    overview:
      "The E-Challan Verification API enables businesses to check pending traffic challans for a vehicle using its registration number. Use it for fleet compliance, insurance underwriting, and gig worker onboarding.",
    keyBenefits: [
      "Instant challan status by registration number",
      "Supports fleet compliance monitoring",
      "Identifies traffic violation patterns",
      "API-driven, automation-ready",
      "Suitable for batch and real-time checks",
    ],
    features: [
      {
        title: "Challan Lookup",
        desc: "Fetch pending traffic challans for any vehicle using its registration number.",
      },
      {
        title: "Fleet Compliance",
        desc: "Monitor challan status across entire vehicle fleets for regulatory compliance.",
      },
      {
        title: "Risk Assessment",
        desc: "Identify traffic violation patterns for insurance underwriting and driver scoring.",
      },
      {
        title: "Real-Time Processing",
        desc: "Instant challan status checks for onboarding and compliance workflows.",
      },
    ],
    whoShouldUse: [
      "Fleet operators and logistics companies",
      "Insurance companies",
      "Gig and delivery platforms",
      "Automotive and vehicle marketplace platforms",
    ],
    useCases: [
      "Fleet compliance monitoring",
      "Insurance risk assessment",
      "Delivery rider onboarding checks",
      "Used vehicle pre-purchase checks",
    ],
    trustAndCompliance: [
      "Government source verification",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start checking e-challans in production." },
    ],
    leadForm: {
      title: "Get E-Challan Verification API Access",
    },
    faqs: [
      {
        q: "What input is required?",
        a: "Only the vehicle registration number is required to check pending challans.",
      },
      {
        q: "Does it cover all states?",
        a: "The API covers challans issued via the national e-challan system. Coverage may vary by state adoption.",
      },
      {
        q: "Can I monitor my entire fleet?",
        a: "Yes. You can run batch checks across all vehicle registration numbers in your fleet on a daily or weekly schedule.",
      },
      {
        q: "Is this useful for insurance?",
        a: "Yes. Challan history indicates driving behavior risk — insurers use this data for underwriting and premium calculation.",
      },
    ],
    inputOutputPreview: {
      apiName: "E-Challan Verification",
      inputs: [
        { label: "Registration Number", value: "MH02AB1234", icon: Car },
      ],
      outputs: [
        { label: "Vehicle Number", value: "MH02AB1234", icon: Car },
        { label: "Pending Challans", value: "2", icon: TicketCheck },
        { label: "Total Fine Amount", value: "₹3,500", icon: IndianRupee },
        { label: "Latest Violation", value: "Overspeeding — 2024-12-10" },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/touras/e-challan",
        request: {
          initiator_id: "9876543210",
          user_code: "20810200",
          registration_number: "MH02AB1234",
        },
        response: {
          status: 0,
          data: {
            vehicle_number: "MH02AB1234",
            pending_challans: 2,
            total_fine_amount: 3500,
            challans: [
              {
                violation: "Overspeeding",
                date: "2024-12-10",
                fine: 2000,
                status: "Pending",
              },
              {
                violation: "Red Light Jump",
                date: "2024-11-05",
                fine: 1500,
                status: "Pending",
              },
            ],
          },
          message: "E-Challan check successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: Email Verification
  // -------------------------------------------------------------------------
  email: {
    seo: {
      title: "Email Verification API India | Catch Invalid & Dummy Emails",
      description:
        "Verify email addresses in real time — catch dummy emails, typos, and non-existent domains. Validate domain authenticity and age for onboarding, fraud prevention, and contact verification.",
      keywords:
        "Email Verification API, Email Validation API, Email Check API, Invalid Email Detection API, Dummy Email Check API, Contact Verification API India",
    },
    title: "Email Verification API",
    desc: "Catch invalid, dummy, and non-existent email addresses",
    heroTitle: "Email Verification API for Onboarding & Fraud Prevention",
    heroSubtitle:
      "Catch invalid, dummy, and mistyped email addresses in real time. Verify that an email domain actually exists and can receive messages — reduce bounce rates, block fake signups, and ensure valid contact data during onboarding.",
    category: "verification",
    icon: MailCheck,
    docsUrl: "https://developers.eko.in/reference/email-check",
    overview:
      "The Email Verification API helps businesses catch invalid, dummy, and mistyped email addresses before they enter your system. It checks whether the email domain is real and can receive messages, and returns domain age to help assess trust — a newly created domain with no mail infrastructure is a strong fraud signal.",
    keyBenefits: [
      "Catch invalid, dummy, and mistyped email addresses",
      "Verify domain can actually receive messages",
      "Domain age check to flag suspicious new domains",
      "API-driven, automation-ready",
      "Suitable for high-volume verification",
    ],
    features: [
      {
        title: "Invalid Email Detection",
        desc: "Catch dummy, mistyped, and non-existent email addresses by verifying the domain has real mail infrastructure.",
      },
      {
        title: "Domain Trust Scoring",
        desc: "Returns domain age in days — newly created domains are a strong indicator of fraudulent or disposable email addresses.",
      },
      {
        title: "Mail Server Validation",
        desc: "Checks MX (mail exchange) records to confirm the domain can actually receive emails — not just that the format is valid.",
      },
      {
        title: "Real-Time Processing",
        desc: "Instant email validation for inline onboarding and registration flows.",
      },
    ],
    whoShouldUse: [
      "E-commerce and marketplace platforms",
      "SaaS and subscription platforms",
      "Staffing and HR platforms",
      "Financial institutions",
    ],
    useCases: [
      "Block dummy emails during user onboarding",
      "Catch typos in email addresses at signup",
      "Detect fraudulent signups with new/suspicious domains",
      "Contact database cleaning",
      "Employee contact verification",
    ],
    trustAndCompliance: [
      "Secure API authentication",
      "Encrypted data transmission",
      "DPDP-aligned data processing",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying emails in production." },
    ],
    leadForm: {
      title: "Get Email Verification API Access",
    },
    faqs: [
      {
        q: "What input is required?",
        a: "Only the email address is required for verification.",
      },
      {
        q: "How does it catch dummy emails?",
        a: "The API checks if the email domain has valid mail exchange (MX) records — domains without mail servers can't receive emails, indicating a fake or dummy address.",
      },
      {
        q: "What is the domain age check?",
        a: "The API returns domain age in days. Newly created domains (days or weeks old) are a strong fraud signal — legitimate businesses and email providers have domains that are years old.",
      },
      {
        q: "Can I use this for bulk email list cleaning?",
        a: "Yes. You can validate email lists by making parallel API calls to clean your contact database and remove invalid entries.",
      },
    ],
    inputOutputPreview: {
      apiName: "Email Verification",
      inputs: [
        {
          label: "Email Address",
          value: "rajesh.kumar@example.com",
          icon: Mail,
        },
      ],
      outputs: [
        { label: "Status", value: "Success", icon: MailCheck },
        {
          label: "Message",
          value: "Email verification successful",
          icon: CheckCircle,
        },
        { label: "Domain", value: "example.com", icon: Globe },
        {
          label: "Domain Age",
          value: "6,970 days (~19 years)",
          icon: Calendar,
        },
        {
          label: "MX Records",
          value: "aspmx.l.google.com (+ 4 more)",
          icon: Shield,
        },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/touras/check-email",
        request: {
          initiator_id: "9876543210",
          user_code: "20810200",
          email: "rajesh.kumar@example.com",
        },
        response: {
          status: 0,
          data: {
            email: "rajesh.kumar@example.com",
            domain: "example.com",
            domain_age_days: 6970,
            mx_records: ["aspmx.l.google.com", "alt1.aspmx.l.google.com"],
            is_valid: true,
            is_disposable: false,
          },
          message: "Email verification successful",
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // MARK: FSSAI
  // -------------------------------------------------------------------------
  fssai: {
    seo: {
      title: "FSSAI License Verification API India | Food License Validation",
      description:
        "Verify FSSAI food license details and status in real time. Integrate FSSAI verification for food business onboarding, marketplace compliance, and regulatory checks.",
      keywords:
        "FSSAI Verification API, Food License API, FSSAI License Check API, Food Business Verification API, Food Safety API India",
    },
    title: "FSSAI License Verification API",
    desc: "Verify FSSAI food license details and status",
    heroTitle: "FSSAI License Verification API for Food Business Compliance",
    heroSubtitle:
      "Validate FSSAI food license details and status instantly — verify food business registration for marketplace onboarding, delivery platform compliance, and regulatory checks.",
    category: "verification",
    icon: Utensils,
    docsUrl: "https://developers.eko.in/reference/fssai-verification",
    overview:
      "The FSSAI License Verification API enables businesses to validate Food Safety and Standards Authority of India (FSSAI) license details. Use it for food business onboarding, delivery platform compliance, and food safety regulatory checks.",
    keyBenefits: [
      "Instant FSSAI license validation",
      "Confirms food business registration status",
      "Supports food marketplace compliance",
      "API-driven, automation-ready",
      "Suitable for high-volume verification",
    ],
    features: [
      {
        title: "License Validation",
        desc: "Verify FSSAI license number and retrieve registered business details.",
      },
      {
        title: "Status Check",
        desc: "Confirm whether the food license is active, expired, or suspended.",
      },
      {
        title: "Business Details",
        desc: "Fetch registered business name, address, and license category.",
      },
      {
        title: "Real-Time Processing",
        desc: "Instant validation for food business onboarding and compliance workflows.",
      },
    ],
    whoShouldUse: [
      "Food delivery and aggregator platforms",
      "E-commerce and marketplace platforms",
      "Restaurant management SaaS",
      "Food safety compliance teams",
    ],
    useCases: [
      "Food seller onboarding on marketplaces",
      "Delivery platform restaurant verification",
      "Food safety audit and compliance checks",
      "Cloud kitchen registration verification",
    ],
    trustAndCompliance: [
      "FSSAI source verification",
      "Secure API authentication",
      "Encrypted data transmission",
      "Audit-ready verification logs",
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      {
        title: "Go Live",
        desc: "Start verifying FSSAI licenses in production.",
      },
    ],
    leadForm: {
      title: "Get FSSAI Verification API Access",
    },
    faqs: [
      {
        q: "What input is required?",
        a: "Only the FSSAI license number is required for verification.",
      },
      {
        q: "What details are returned?",
        a: "The API returns FSSAI license status, license category, registered business name, address, state, PIN code, and license expiry date.",
      },
      {
        q: "Is this mandatory for food delivery platforms?",
        a: "Yes. FSSAI regulations require food delivery platforms to verify that all listed restaurants and cloud kitchens have valid FSSAI licenses.",
      },
      {
        q: "How fast is the check?",
        a: "The API returns results in real time with sub-second response times.",
      },
    ],
    inputOutputPreview: {
      apiName: "FSSAI License Verification",
      inputs: [
        {
          label: "FSSAI License Number",
          value: "11521998000045",
          icon: Utensils,
        },
      ],
      outputs: [
        { label: "License Number", value: "11521998000045", icon: Utensils },
        { label: "Status", value: "Active", icon: CheckCircle },
        { label: "License Category", value: "State License" },
        {
          label: "Business Name",
          value: "Spice Garden Restaurant",
          icon: Building,
        },
        {
          label: "Address",
          value: "123 Main Street, Mumbai, Maharashtra",
          icon: MapPin,
        },
        { label: "State", value: "Maharashtra", icon: MapPin },
        { label: "PIN Code", value: "400001", icon: MapPin },
        { label: "Expiry Date", value: "2026-03-15", icon: Calendar },
      ],
      sampleJson: {
        method: "POST",
        endpoint: "/tools/kyc/touras/fetch-fssai",
        request: {
          initiator_id: "9876543210",
          user_code: "20810200",
          fssai: "11521998000045",
        },
        response: {
          status: 0,
          data: {
            fssai_number: "11521998000045",
            license_status: "Active",
            license_category: "State License",
            business_name: "Spice Garden Restaurant",
            address: "123 Main Street, Mumbai, Maharashtra",
            state: "Maharashtra",
            pincode: "400001",
            expiry_date: "2026-03-15",
          },
          message: "FSSAI verification successful",
        },
      },
    },
  },
};

for (const page of Object.values(API_PRODUCT_PAGES)) {
  page.faqs = [...page.faqs, ...COMMON_API_FAQS];
}

// Suppress unused-variable warnings for icons that are imported but only used
// inside object literals (TypeScript sees them as referenced).
void (Banknote as LucideIcon);
