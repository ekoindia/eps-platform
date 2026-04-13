import type { LucideIcon } from "lucide-react";
import {
  // DMT
  Banknote, Globe, RefreshCw, Clock, Users, Building, CheckCircle,
  // AePS
  Fingerprint, Wallet, FileText, Shield,
  // BBPS
  Receipt, CreditCard, Smartphone, Car, Droplets, Flame, Wifi,
  // QR
  QrCode, BarChart3,
  // Payout
  Send,
  // UPI Payout (re-uses Send, Zap, Users, Clock, CheckCircle, FileText, Wallet, Shield — all above)
  // Bank Verification
  Hash, Database,
  // GST / DL
  // (Building, FileText, CreditCard already imported)
  // Vehicle
  Search,
  // Employee
  Phone,
  // Reverse Geocoding
  MapPin,
  // Pan Verification
  User, Calendar,
  // Zap (used everywhere)
  Zap,
} from "lucide-react";

import type { ProductPageLayoutProps } from "@/components/ProductPageLayout";

// ---------------------------------------------------------------------------
// Hero image assets
// ---------------------------------------------------------------------------
import moneyTransferImg from "@/assets/money-transfer-api.svg";
import aepsImg from "@/assets/aeps-main.svg";
import bbpsImg from "@/assets/utility-bill-payment.svg";
import qrImg from "@/assets/qr-payment.png";
import cmsImg from "@/assets/assisted-cash-management.svg";
import payoutImg from "@/assets/salary-disbursal.svg";
// upi-payout reuses payoutImg
import panImg from "@/assets/pan-verification.svg";
import aadhaarImg from "@/assets/aadhaar-verification.svg";
import bankImg from "@/assets/bank-verification.svg";
import gstImg from "@/assets/gst-verification.png";
import dlImg from "@/assets/dl-verification-2.png";
import upiVerifyImg from "@/assets/upi-hero.png";

// ---------------------------------------------------------------------------
// SEO helper type + full page config type
// ---------------------------------------------------------------------------
export interface ProductPageSeo {
  title: string;
  description: string;
  keywords: string;
  ogTitle?: string;
  ogDescription?: string;
  /** Optional JSON-LD structured data object (serialised by ProductDetailPage) */
  jsonLd?: object;
}

export interface ProductPageData extends ProductPageLayoutProps {
  seo: ProductPageSeo;
}

// ---------------------------------------------------------------------------
// Shared helpers / constants to reduce duplication in the config map
// ---------------------------------------------------------------------------

/** Shared first-2 steps for verification API products */
const VERIFICATION_STEPS_BASE = [
  { title: "Sign Up", description: "Create an account on Connect App." },
  { title: "Submit Documents", description: "Submit necessary documents for activation." },
] as const;

/** Placeholder for APIs whose I/O preview is not yet available */
// const comingSoonPreview = (apiName: string) =>
//   ({ apiName, inputs: [], outputs: [], comingSoon: true });

/** PAN entry FAQs — also used to generate jsonLd FAQPage below */
const PAN_FAQS = [
  { question: "How fast is PAN verification?", answer: "PAN verification is real-time with sub-second response times for instant identity validation." },
  { question: "What details are returned?", answer: "The API returns validated PAN holder name, PAN status, and other relevant identity details." },
  { question: "Is it suitable for high volumes?", answer: "Yes, the API is designed to handle large-scale verification volumes reliably without performance degradation." },
  { question: "How do I get started?", answer: "Sign up on Connect App, submit necessary documents, integrate the API, and start verifying PAN details." },
];

// ---------------------------------------------------------------------------
// Config map keyed by API_PRODUCTS id
// ---------------------------------------------------------------------------
export const API_PRODUCT_PAGES: Record<string, ProductPageData> = {

  // -------------------------------------------------------------------------
  // DMT
  // -------------------------------------------------------------------------
  dmt: {
    seo: {
      title: "Domestic Money Transfer API (DMT)",
      description: "Enable instant money transfers across India with Eko's DMT API. Real-time IMPS & NEFT settlements, pan-India coverage, and 99.9% uptime. Integrate in minutes.",
      keywords: "DMT API, domestic money transfer API, IMPS API, NEFT API, money transfer India, remittance API, Eko API",
      ogTitle: "Domestic Money Transfer API (DMT)",
      ogDescription: "Enable instant money transfers across India with real-time settlements and pan-India coverage.",
    },
    title: "Domestic Money Transfer API",
    description: "Enable instant money transfers across India with Eko's DMT API",
    heroTitle: "Instant Domestic Money Transfers",
    heroSubtitle: "Enable real-time money transfers across India with our robust DMT API. Power remittances for millions of customers with IMPS, NEFT, and RTGS support.",
    category: "payment",
    docsUrl: "https://developers.eko.in/docs/money-transfer",
    heroImage: moneyTransferImg,
    features: [
      { title: "Real-time Transfers", description: "Instant money transfers via IMPS with real-time status updates and confirmations.", icon: Zap },
      { title: "NEFT & RTGS Support", description: "Support for NEFT and RTGS for high-value transfers with guaranteed settlements.", icon: Banknote },
      { title: "Pan-India Coverage", description: "Transfer money to any bank account across India with 99.9% success rate.", icon: Globe },
      { title: "Real-time Webhooks", description: "Receive instant notifications for transaction status updates via webhooks.", icon: RefreshCw },
      { title: "Secure Transactions", description: "Bank-grade encryption and security for all transactions with audit trails.", icon: Shield },
      { title: "24/7 Availability", description: "Round-the-clock availability with 99.9% uptime guarantee.", icon: Clock },
    ],
    benefits: [
      { title: "Seamless Integration", description: "Well-documented APIs with SDKs in multiple languages. Get started in minutes with 24x7 support.", icon: CheckCircle },
      { title: "Best Success Rate", description: "Industry-leading success rates with smart routing and automatic retries.", icon: Zap },
      { title: "Earn Commission", description: "Earn attractive commissions on every successful transaction processed through your platform.", icon: Banknote },
      { title: "Scalable Infrastructure", description: "Handle millions of transactions with our enterprise-grade infrastructure.", icon: Building },
      { title: "Retailer Network", description: "Build and manage a network of retailers for cash-in and cash-out services.", icon: Users },
      { title: "Regulatory Compliant", description: "Fully RBI-compliant infrastructure with all necessary licenses and certifications.", icon: Shield },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App and get your sandbox credentials." },
      { title: "Submit KYC", description: "Complete your business KYC verification process." },
      { title: "Integrate API", description: "Use our comprehensive documentation to integrate the DMT API." },
      { title: "Test in Sandbox", description: "Test your integration thoroughly in our sandbox environment." },
      { title: "Go Live", description: "Get production credentials and start processing real transactions." },
    ],
    useCases: ["Retail Banking Apps", "Fintech Platforms", "Remittance Services", "Kirana Stores", "Agent Banking", "Corporate Payouts", "E-commerce Refunds"],
    faqs: [
      { question: "What is the DMT API?", answer: "The DMT (Domestic Money Transfer) API enables instant money transfers to any bank account across India using IMPS, NEFT, or RTGS. It's designed for businesses that want to offer remittance services to their customers." },
      { question: "What is the transaction limit?", answer: "Individual transaction limits vary based on the mode of transfer. IMPS supports up to ₹5 lakh per transaction, while NEFT and RTGS support higher limits for bulk transfers." },
      { question: "How long does a transfer take?", answer: "IMPS transfers are instant (within seconds). NEFT transfers are processed in batches throughout the day, and RTGS transfers are processed in real-time during banking hours." },
      { question: "What documents are required for integration?", answer: "You'll need business registration documents, PAN card, bank account details, and relevant licenses based on your business type. Our team will guide you through the complete process." },
      { question: "Is there a settlement delay?", answer: "Settlement timelines depend on your agreement. Most partners receive T+1 settlements, with options for same-day settlements for high-volume partners." },
    ],
  },

  // -------------------------------------------------------------------------
  // AePS
  // -------------------------------------------------------------------------
  aeps: {
    seo: {
      title: "AePS API - Aadhaar Enabled Payment System",
      description: "Enable Aadhaar-based banking services with Eko's AePS API. Cash withdrawal, balance enquiry, mini statements, and fund transfers using Aadhaar authentication.",
      keywords: "AePS API, Aadhaar enabled payment system, Aadhaar banking API, biometric payment API, rural banking API, Eko API",
      ogTitle: "AePS API - Aadhaar Enabled Payment System",
      ogDescription: "Enable Aadhaar-based banking services for rural and underbanked segments.",
    },
    title: "AePS API",
    description: "Aadhaar-enabled payment services for rural and underbanked segments",
    heroTitle: "Aadhaar Enabled Payment System",
    heroSubtitle: "Bring banking services to every corner of India with AePS. Enable cash withdrawals, balance enquiries, and fund transfers using just Aadhaar and fingerprint authentication.",
    category: "payment",
    docsUrl: "https://developers.eko.in/docs/aeps",
    heroImage: aepsImg,
    features: [
      { title: "Cash Withdrawal", description: "Enable customers to withdraw cash from any bank account using Aadhaar and biometric authentication.", icon: Wallet },
      { title: "Balance Enquiry", description: "Check account balance instantly using Aadhaar number and fingerprint verification.", icon: FileText },
      { title: "Mini Statement", description: "Retrieve the last few transactions for any Aadhaar-linked bank account.", icon: FileText },
      { title: "Fund Transfer", description: "Transfer funds between Aadhaar-linked accounts securely and instantly.", icon: Fingerprint },
      { title: "Biometric Authentication", description: "Secure transactions with Aadhaar-based biometric verification using UIDAI.", icon: Shield },
      { title: "Multi-Bank Support", description: "Connect to all major banks in India through a single integration.", icon: Building },
    ],
    benefits: [
      { title: "Financial Inclusion", description: "Bring banking services to rural and underbanked populations without traditional infrastructure.", icon: Users },
      { title: "No Debit Card Required", description: "Customers only need their Aadhaar number and fingerprint - no cards or PINs needed.", icon: Fingerprint },
      { title: "Secure & Compliant", description: "UIDAI-certified biometric authentication ensures secure and compliant transactions.", icon: Shield },
      { title: "Build Retailer Network", description: "Enable local retailers to become banking points and earn commissions.", icon: Building },
      { title: "24/7 Operations", description: "Provide banking services round the clock, even in areas without bank branches.", icon: Clock },
      { title: "Easy Integration", description: "Simple REST APIs with comprehensive documentation and sandbox environment.", icon: CheckCircle },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App and submit your business details." },
      // { title: "Get Certifiexd", description: "Complete UIDAI certification for AePS operations." },
      { title: "Integrate API", description: "Integrate our AePS API with your application using our documentation." },
      { title: "Setup Biometric Devices", description: "Configure certified biometric devices for fingerprint capture." },
      { title: "Onboard Retailers", description: "Start onboarding retailers to offer AePS services." },
      { title: "Go Live", description: "Launch your AePS services and start serving customers." },
    ],
    useCases: ["Banking Correspondents", "Rural Financial Services", "Kirana Store Banking", "CSC Centers", "Microfinance Institutions", "Government Disbursements"],
    faqs: [
      { question: "What is AePS?", answer: "AePS (Aadhaar Enabled Payment System) is a bank-led model that allows online financial transactions at Micro ATM through Aadhaar authentication. It uses NPCI infrastructure and enables customers to use Aadhaar for bank transactions." },
      { question: "What biometric devices are supported?", answer: "We support all UIDAI-certified biometric devices including Morpho, Mantra, Startek, and others. Contact our team for the complete list of supported devices." },
      { question: "What is the transaction limit for AePS?", answer: "Cash withdrawal limits vary by bank but typically range from ₹10,000 to ₹50,000 per transaction. Some banks allow higher limits for specific use cases." },
      { question: "Do I need special certification?", answer: "Yes, you need to be a certified AePS operator. Eko can help you with the certification process and provide all necessary support." },
      { question: "How is commission calculated?", answer: "Commission is earned on every successful transaction. The exact rates depend on your agreement and transaction volumes. Contact our team for detailed pricing." },
    ],
  },

  // -------------------------------------------------------------------------
  // BBPS
  // -------------------------------------------------------------------------
  bbps: {
    seo: {
      title: "BBPS API - Bharat Bill Payment System",
      description: "Integrate BBPS API to enable bill payments for electricity, gas, water, DTH, broadband, insurance, and 200+ biller categories. RBI-compliant infrastructure.",
      keywords: "BBPS API, bill payment API, Bharat Bill Payment System, utility bill API, electricity bill API, Eko API",
      ogTitle: "BBPS API - Bharat Bill Payment System",
      ogDescription: "Enable seamless bill payments for 200+ biller categories with Eko's BBPS API.",
    },
    title: "BBPS API",
    description: "Complete bill payment ecosystem with 200+ biller categories",
    heroTitle: "Help Customers Pay Their Utility Bills!",
    heroSubtitle: "The BBPS API enables seamless integration for bill payments in India. Whether you're a financial institution, fintech, or service provider, offer your customers convenient bill payment services.",
    category: "payment",
    docsUrl: "https://developers.eko.in/reference/bbps-get-operators",
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
      { title: "200+ Biller Categories", description: "Access to extensive biller network covering electricity, gas, water, insurance, and more.", icon: Receipt },
      { title: "Instant Bill Fetch", description: "Fetch outstanding bill amounts in real-time before payment processing.", icon: Zap },
      { title: "Unified API", description: "Single API integration for all biller categories - no separate integrations needed.", icon: CheckCircle },
      { title: "Transaction Tracking", description: "Complete visibility into transaction status with detailed reporting.", icon: Receipt },
      { title: "Secure Payments", description: "PCI-DSS compliant infrastructure with end-to-end encryption.", icon: Shield },
      { title: "Receipt Generation", description: "Auto-generated receipts for every successful transaction.", icon: Receipt },
    ],
    benefits: [
      { title: "Simplified Integration", description: "Easy-to-read API documentation and 24x7 integration support for quick go-live.", icon: CheckCircle },
      { title: "Best Success Rate", description: "Industry-leading success rates with smart retry mechanisms.", icon: Zap },
      { title: "Earn Commission", description: "Attractive commissions on all types of bill payments processed through your platform.", icon: Receipt },
      { title: "Extensive Biller Network", description: "Access to 20,000+ billers across all major categories in India.", icon: Building },
      { title: "Real-time Confirmation", description: "Instant payment confirmation with transaction reference numbers.", icon: Zap },
      { title: "Customer Retention", description: "Keep customers engaged with recurring bill payment reminders and services.", icon: Users },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App and get sandbox access." },
      { title: "Submit KYC", description: "Complete business KYC verification process." },
      { title: "UAT Testing", description: "Complete UAT testing with all biller categories." },
      { title: "API Integration", description: "Finalize your BBPS API integration." },
      // { title: "IP Whitelisting", description: "Get your production IPs whitelisted (India only)." },
      { title: "Go Live", description: "Launch with production credentials and start billing!" },
    ],
    useCases: ["Banking Apps", "Fintech Platforms", "Payment Aggregators", "E-commerce Platforms", "Retail Networks", "Agent Banking", "Corporate Solutions"],
    faqs: [
      { question: "What is BBPS API?", answer: "BBPS (Bharat Bill Payment System) API is an RBI-mandated online bill payment system that enables customers to pay bills easily and securely. Our API allows you to integrate bill payment services into your platform." },
      { question: "How many billers are supported?", answer: "Eko's BBPS API provides access to 20,000+ billers across 200+ categories including electricity, gas, water, DTH, broadband, insurance, EMI, FASTag, and more." },
      { question: "What are the commission rates?", answer: "Commission rates vary by biller category and transaction volume. Contact our sales team for detailed pricing and commission structures." },
      { question: "Is BBPS API available 24/7?", answer: "Yes, BBPS services are available 24/7. However, some billers may have specific operating hours for payment processing." },
      { question: "How long does integration take?", answer: "With our well-documented APIs and sandbox environment, most partners complete integration within 2-4 weeks including testing and certification." },
    ],
  },

  // -------------------------------------------------------------------------
  // QR Payment
  // -------------------------------------------------------------------------
  "qr-payment": {
    seo: {
      title: "QR Payment API - UPI QR Code Payments",
      description: "Accept UPI payments via QR codes with Eko's QR Payment API. Dynamic QR generation, real-time notifications, and seamless payment collection for merchants.",
      keywords: "QR payment API, UPI QR API, dynamic QR code, QR code payments, merchant payments API, Eko API",
      ogTitle: "QR Payment API - UPI QR Code Payments",
      ogDescription: "Accept UPI payments via dynamic QR codes with real-time notifications.",
    },
    title: "QR Payment API",
    description: "Accept UPI payments via dynamic QR codes",
    heroTitle: "QR Payment API",
    heroSubtitle: "Enable seamless UPI payments through dynamic QR codes. Perfect for retail stores, restaurants, and any business accepting digital payments.",
    category: "payment",
    docsUrl: "https://developers.eko.in/reference/upi-generate-static-qr",
    heroImage: qrImg,
    features: [
      { title: "Dynamic QR Generation", description: "Generate unique QR codes for each transaction with custom amounts and references.", icon: QrCode },
      { title: "Real-time Notifications", description: "Instant webhooks and callbacks when payment is received.", icon: Zap },
      { title: "Multi-app Support", description: "Works with all UPI apps - Google Pay, PhonePe, Paytm, BHIM, and more.", icon: Smartphone },
      { title: "Static QR Support", description: "Generate static QR codes for fixed collection points.", icon: QrCode },
      { title: "Transaction Tracking", description: "Complete transaction history and reconciliation reports.", icon: BarChart3 },
      { title: "Refund Management", description: "Process refunds directly through the API when needed.", icon: RefreshCw },
    ],
    benefits: [
      { title: "Zero Hardware Cost", description: "No POS machine required - customers scan and pay using their phones.", icon: Smartphone },
      { title: "Instant Settlement", description: "Fast settlement cycles to ensure healthy cash flow.", icon: Zap },
      { title: "Lower MDR", description: "Benefit from competitive merchant discount rates on UPI transactions.", icon: CreditCard },
      { title: "Easy Integration", description: "Simple REST APIs with comprehensive documentation and SDKs.", icon: CheckCircle },
      { title: "Secure Transactions", description: "Bank-grade security with encrypted QR codes and secure callbacks.", icon: Shield },
      { title: "Analytics Dashboard", description: "Track payments, view trends, and download reports easily.", icon: BarChart3 },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App." },
      { title: "Get Credentials", description: "Receive your API keys and merchant ID." },
      { title: "Generate QR", description: "Use API to generate dynamic or static QR codes." },
      { title: "Display QR", description: "Show QR to customers on screen or print." },
      { title: "Receive Payments", description: "Get instant notifications on successful payments." },
    ],
    useCases: ["Retail Stores", "Restaurants & Cafes", "E-commerce COD", "Street Vendors", "Service Providers", "Subscription Payments", "Event Ticketing", "Donation Collection"],
    faqs: [
      { question: "What is a dynamic QR code?", answer: "A dynamic QR code contains a unique transaction ID and amount for each payment. This allows automatic reconciliation and instant payment confirmation without manual verification." },
      { question: "Which UPI apps are supported?", answer: "Our QR codes work with all UPI-enabled apps including Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, and bank-specific UPI apps." },
      { question: "How fast are payment notifications?", answer: "Payment notifications are sent in real-time, typically within 1-2 seconds of successful payment. We support both webhooks and polling mechanisms." },
      { question: "Can I customize the QR code appearance?", answer: "Yes, you can add your logo, change colors, and customize the QR code design while maintaining scannability." },
      { question: "What are the settlement timelines?", answer: "Standard settlement is T+1 (next business day). Faster settlement options are available for eligible merchants." },
    ],
  },

  // -------------------------------------------------------------------------
  // CMS
  // -------------------------------------------------------------------------
  cms: {
    seo: {
      title: "CMS Cash Collection API - Cash Management Services",
      description: "Digitize cash collection with Eko's CMS API. Enable field agents to collect cash and instantly credit customer accounts. Perfect for NBFCs, insurance, and utilities.",
      keywords: "CMS API, cash collection API, cash management services, field collection API, NBFC collection API, Eko API",
      ogTitle: "CMS Cash Collection API",
      ogDescription: "Digitize cash collection with instant account credits through field agents.",
    },
    title: "CMS Cash Collection API",
    description: "Digitize cash collection with field agents",
    heroTitle: "Cash Collection API",
    heroSubtitle: "Enable your field agents to collect cash and instantly credit customer accounts. Reduce collection costs, improve efficiency, and provide real-time visibility.",
    category: "payment",
    docsUrl: "https://developers.eko.in/docs/cms",
    heroImage: cmsImg,
    features: [
      { title: "Field Agent App", description: "White-label mobile app for field agents to collect payments and issue receipts.", icon: Users },
      { title: "Real-time Credits", description: "Instant account credit upon cash collection with digital confirmation.", icon: Zap },
      { title: "GPS Tracking", description: "Track agent location and collection points for complete visibility.", icon: MapPin },
      { title: "Digital Receipts", description: "Auto-generated digital receipts sent to customers via SMS.", icon: FileText },
      { title: "Cash Limit Management", description: "Set daily and per-transaction cash limits for each agent.", icon: Banknote },
      { title: "Reconciliation", description: "Automated reconciliation with detailed collection reports.", icon: Clock },
    ],
    benefits: [
      { title: "Reduce Collection Cost", description: "Lower operational costs with efficient agent management and routing.", icon: Banknote },
      { title: "Faster Realization", description: "Instant account credits eliminate delays in payment realization.", icon: Zap },
      { title: "Fraud Prevention", description: "GPS tracking, photo proof, and digital receipts prevent collection fraud.", icon: Shield },
      { title: "Customer Convenience", description: "Doorstep collection improves customer experience and retention.", icon: Users },
      { title: "Complete Visibility", description: "Real-time dashboard showing collection status across all agents.", icon: CheckCircle },
      { title: "Easy Integration", description: "Simple API integration with your existing loan or billing system.", icon: FileText },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account and submit KYC documents." },
      { title: "Configure", description: "Set up collection accounts and agent limits." },
      { title: "Onboard Agents", description: "Register field agents and distribute the app." },
      { title: "Integrate", description: "Connect with your billing/loan system via API." },
      { title: "Go Live", description: "Start collecting with real-time tracking and credits." },
    ],
    useCases: ["NBFC Loan Collection", "Insurance Premium Collection", "Utility Bill Collection", "Microfinance", "Chit Fund Collection", "Society Maintenance", "Subscription Collection", "Rental Collection"],
    faqs: [
      { question: "How does the agent app work?", answer: "Agents download our white-label app, log in with credentials, and can immediately start collecting. The app shows assigned customers, amounts due, and allows cash/digital collection with instant receipts." },
      { question: "Is there a limit on collection amount?", answer: "You can configure daily limits and per-transaction limits for each agent based on your risk policy. Higher limits require additional verification." },
      { question: "How is fraud prevented?", answer: "Multiple layers including GPS location logging, photo capture of cash, digital receipts sent directly to customers, and real-time reconciliation. Any discrepancy is flagged immediately." },
      { question: "Can we use our own collection app?", answer: "Yes, our APIs can be integrated into your existing mobile app. We provide SDKs and complete documentation for custom integration." },
      { question: "What reports are available?", answer: "Daily collection summary, agent-wise reports, location-based analytics, pending collections, and reconciliation reports. All reports can be exported or accessed via API." },
    ],
  },

  // -------------------------------------------------------------------------
  // Payout (payment-api)
  // -------------------------------------------------------------------------
  payment: {
    seo: {
      title: "Payout API - Salary & Vendor Payments",
      description: "Make instant salary disbursals and vendor payments using Eko's Payout API. Pay employees and vendors directly from your e-wallet balance with high success rates.",
      keywords: "payout API, salary disbursal API, vendor payment API, fund transfer API, e-wallet payout, Eko API",
      ogTitle: "Payout API - Salary & Vendor Payments",
      ogDescription: "Instant salary disbursals and vendor payments using your e-wallet balance.",
    },
    title: "Payout API",
    description: "Make salary & vendor payments easily",
    heroTitle: "Payout API",
    heroSubtitle: "Pay your employees and vendors directly from your digital wallet balance. Easy-to-use, reliable, and secure fund transfer API for instant salary disbursals and vendor payments.",
    category: "payment",
    docsUrl: "https://developers.eko.in/docs/fund-transfer",
    heroImage: payoutImg,
    features: [
      { title: "Easy Salary Disbursals", description: "Pay wages to your employees directly into their bank accounts instantly.", icon: Users },
      { title: "Instant Vendor Payments", description: "Settle outstanding dues with vendors in one go through a hassle-free process.", icon: Building },
      { title: "Track Payments", description: "Maintain a record of every payment transaction to avoid conflicts.", icon: FileText },
      { title: "E-Wallet Payments", description: "Use your e-wallet balance to make payments — no bank account needed.", icon: Wallet },
      { title: "High Success Rate", description: "Best-in-class success rates, as reliable as banks themselves.", icon: CheckCircle },
      { title: "Secure Transfers", description: "Every API call is secured with one-time-use tokens using asymmetric cryptography.", icon: Shield },
    ],
    benefits: [
      { title: "24x7 Availability", description: "Make payments anytime — not confined to banking hours.", icon: Clock },
      { title: "Use E-Money", description: "Pay directly from your e-wallet balance — much easier and faster than bank transfers.", icon: Wallet },
      { title: "Best Success Rate", description: "Transaction failures occur rarely. We ensure the best success rate for every transaction.", icon: Zap },
      { title: "Simple Documentation", description: "Comprehensive and constantly updated API documentation with full technical support.", icon: FileText },
      { title: "Open-Source Libraries", description: "Easy and error-proof integration with Eko's open-source libraries.", icon: RefreshCw },
      { title: "Bank-Grade Security", description: "Same APIs used internally at Eko, secured with asymmetric cryptography.", icon: Shield },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Sign up on Connect App at connect.eko.in." },
      { title: "Submit Documents", description: "Submit the necessary KYC and business documents." },
      { title: "Integrate API", description: "Integrate the Payout API using our documentation." },
      { title: "Start Paying", description: "Start making salary and vendor payments instantly." },
    ],
    useCases: ["Salary Disbursement", "Vendor Payments", "Contractor Payments", "Gig Worker Payouts", "Commission Payments", "Refund Processing", "Incentive Payouts", "Bulk Disbursements"],
    faqs: [
      { question: "How does the Payout API work?", answer: "You load your digital wallet balance and use the Payout API to transfer funds directly to any bank account in India. Payments are processed via IMPS/NEFT for instant or near-instant settlements." },
      { question: "Do I need a bank account to make payments?", answer: "No, you can use your e-wallet balance to make payments. This is much easier and faster than traditional bank transfers." },
      { question: "Is the Payout API available 24x7?", answer: "Yes, unlike banks, our Payout API works 24x7 including weekends and holidays, so you can make payments anytime." },
      { question: "What is the success rate?", answer: "We maintain one of the highest success rates in the industry. Transaction failures are extremely rare, and we are as reliable as banks themselves." },
      { question: "What use cases are not allowed?", answer: "The Payout API is strictly not for gaming, trading, betting, or any unauthorized/illegal activity." },
    ],
  },

  // -------------------------------------------------------------------------
  // UPI Payout
  // -------------------------------------------------------------------------
  "upi-payout": {
    seo: {
      title: "UPI Payout API - Instant UPI Transfers",
      description: "Send instant payouts to any UPI ID with Eko's UPI Payout API. Instant transfers, bulk payouts, and real-time status updates for businesses.",
      keywords: "UPI payout API, instant payout API, UPI transfer API, bulk UPI payout, vendor payout API, Eko API",
      ogTitle: "UPI Payout API - Instant UPI Transfers",
      ogDescription: "Send instant payouts to any UPI ID with real-time status updates.",
    },
    title: "UPI Payout API",
    description: "Send instant payouts to any UPI ID",
    heroTitle: "UPI Payout API",
    heroSubtitle: "Send money instantly to any UPI ID - VPAs, mobile numbers, or linked bank accounts. Perfect for vendor payments, refunds, and disbursements.",
    category: "payment",
    docsUrl: "https://developers.eko.in/reference/upi-vpa-payment",
    heroImage: payoutImg,
    features: [
      { title: "Instant Transfers", description: "Send money to any UPI ID with instant credit, 24x7.", icon: Zap },
      { title: "VPA & Mobile Support", description: "Pay to UPI IDs, mobile numbers, or bank account-linked VPAs.", icon: Send },
      { title: "Bulk Payouts", description: "Process thousands of payouts in a single API batch.", icon: Users },
      { title: "Real-time Status", description: "Instant webhook notifications for successful transfers.", icon: Clock },
      { title: "Auto-retry Logic", description: "Intelligent retry mechanism for failed transactions.", icon: CheckCircle },
      { title: "Detailed Reports", description: "Transaction-level reports with UTR and status details.", icon: FileText },
    ],
    benefits: [
      { title: "Zero Bank Holidays", description: "UPI works 24x7x365, including weekends and holidays.", icon: Clock },
      { title: "Lower Cost", description: "More cost-effective than NEFT/IMPS for small-value payouts.", icon: Wallet },
      { title: "No Account Details", description: "Just need UPI ID - no need to collect bank account details.", icon: Users },
      { title: "Instant Confirmation", description: "Know immediately if the transfer succeeded or failed.", icon: Zap },
      { title: "High Success Rate", description: "99%+ success rate with intelligent routing.", icon: CheckCircle },
      { title: "Secure Transfers", description: "Bank-grade encryption and secure API authentication.", icon: Shield },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account and complete verification." },
      { title: "Add Funds", description: "Load your payout wallet with working capital." },
      { title: "Integrate API", description: "Use our simple REST API to initiate payouts." },
      { title: "Test", description: "Test with small amounts in production." },
      { title: "Scale", description: "Process bulk payouts as your business grows." },
    ],
    useCases: ["Vendor Payments", "Salary Disbursement", "Refunds & Cashbacks", "Gig Worker Payments", "Insurance Claims", "Loan Disbursement", "Contest Winnings", "Affiliate Payouts"],
    faqs: [
      { question: "What UPI IDs are supported?", answer: "We support all UPI IDs across banks - user@upi, user@paytm, user@ybl, mobile@upi, and any other valid VPA format." },
      { question: "What is the maximum payout limit?", answer: "Individual UPI payouts can be up to ₹1 lakh per transaction. Higher limits are available for verified business accounts." },
      { question: "How do I handle failed payouts?", answer: "Failed payouts are automatically retried based on error type. You receive webhook notifications for all status changes. Funds are returned to your wallet for non-recoverable failures." },
      { question: "Is there a minimum payout amount?", answer: "Minimum payout is ₹1. There's no limit on number of payouts, making it ideal for micro-transactions." },
      { question: "How do I verify UPI ID before payout?", answer: "Use our UPI ID Verification API to validate the UPI ID and get beneficiary name before initiating payout." },
    ],
  },

  // -------------------------------------------------------------------------
  // PAN Verification
  // -------------------------------------------------------------------------
  pan: {
    seo: {
      title: "PAN Verification API | Real-Time PAN Validation",
      description: "Instantly verify PAN details in real-time with 99.9% accuracy. Strengthen KYC compliance and reduce fraud for Fintechs and NBFCs.",
      keywords: "PAN Verification API, PAN Validation API, KYC PAN API, PAN Check API, Identity Verification API",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "SoftwareApplication",
            "name": "PAN Verification API",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web API",
            "description": "Instantly verify PAN details in real-time with 99.9% accuracy. Strengthen KYC compliance and reduce fraud for Fintechs and NBFCs.",
            "offers": { "@type": "Offer", "availability": "https://schema.org/InStock" },
          },
          {
            "@type": "FAQPage",
            "mainEntity": PAN_FAQS.map((f) => ({
              "@type": "Question",
              "name": f.question,
              "acceptedAnswer": { "@type": "Answer", "text": f.answer },
            })),
          },
        ],
      },
    },
    title: "PAN Verification API",
    description: "Verify PAN details in real time",
    heroTitle: "PAN Verification API for Instant Identity Validation",
    heroSubtitle: "Verify PAN details in real time to strengthen KYC, reduce fraud, and accelerate onboarding.",
    category: "verification",
    docsUrl: "https://developers.eko.in/reference/pan-lite",
    heroImage: panImg,
    overview: "The PAN Verification API enables businesses to validate Permanent Account Number (PAN) details instantly. It is designed for compliance-driven onboarding, fraud prevention, and identity verification use cases across financial and enterprise platforms.",
    keyBenefits: [
      "Instant PAN validation",
      "Improves KYC accuracy and speed",
      "Reduces onboarding fraud",
      "API-driven, automation-ready workflows",
      "Suitable for high-volume verifications",
    ],
    features: [
      { title: "Real-Time PAN Validation", description: "Verify PAN details instantly with structured responses." },
      { title: "High Accuracy Responses", description: "Returns validated PAN information for reliable identity checks." },
      { title: "Automation Friendly", description: "Easily integrate into digital onboarding and KYC pipelines." },
      { title: "Scalable Verification", description: "Designed to support large volumes without performance impact." },
    ],
    whoShouldUse: ["Fintech and financial institutions", "Marketplaces and platforms", "NBFCs and lenders", "Enterprises with KYC requirements"],
    useCases: ["Customer KYC verification", "Merchant and vendor onboarding", "Account opening workflows", "Compliance and due diligence checks"],
    trustAndCompliance: ["Compliance-aligned verification workflows", "Secure API authentication", "Encrypted data transmission", "Audit-ready verification logs"],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App.", tip: "Takes less than 2 minutes" },
      { title: "Submit Documents", description: "Submit necessary documents for activation.", tip: "KYC docs verified in 24 hours" },
      { title: "Integrate API", description: "Integrate PAN Verification API into your system.", tip: "API keys generated instantly" },
      { title: "Go Live", description: "Start validating PAN details in production.", tip: "Sandbox available for testing" },
    ],
    leadForm: {
      title: "Get PAN Verification API Access",
    },
    faqs: PAN_FAQS,
    inputOutputPreview: {
      apiName: "PAN Verification",
      inputs: [
        { label: "PAN Number", value: "ABCDE1234F", icon: CreditCard },
        { label: "Full Name", value: "Rajesh Kumar", icon: User },
        { label: "Date of Birth", value: "29/08/1994", icon: Calendar },
      ],
      outputs: [
        { label: "PAN Match", value: "✓ Matched" },
        { label: "Name Match", value: "✓ Matched" },
        { label: "DOB Match", value: "✓ Matched" },
        { label: "Gender", value: "Male" },
        { label: "Aadhaar Seeding Status", value: "Seeded", icon: Fingerprint },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Aadhaar Verification
  // -------------------------------------------------------------------------
  aadhaar: {
    seo: {
      title: "Aadhaar Verification API | Secure Identity Verification",
      description: "Integrate Aadhaar Verification API to verify identity securely with consent-based, compliance-ready workflows.",
      keywords: "Aadhaar Verification API, Aadhaar KYC API, Identity Verification API, UIDAI Verification API, Digital KYC API",
    },
    title: "Aadhaar Verification API",
    description: "Verify Aadhaar details securely",
    heroTitle: "Aadhaar Verification API for Secure Digital Identity",
    heroSubtitle: "Verify Aadhaar details through consent-based, real-time verification workflows.",
    category: "verification",
    docsUrl: "https://developers.eko.in/reference/aadhaar-verification-apis",
    heroImage: aadhaarImg,
    overview: "The Aadhaar Verification API enables businesses to validate Aadhaar details securely as part of identity verification and KYC processes. It is designed for regulated onboarding, fraud prevention, and compliance-driven use cases.",
    keyBenefits: [
      "Consent-based Aadhaar verification",
      "Faster customer onboarding",
      "Improved identity accuracy",
      "Reduced fraud and impersonation risk",
      "Scalable for high-volume KYC operations",
    ],
    features: [
      { title: "Consent-Based Verification", description: "Aadhaar verification flows designed with user consent at the core." },
      { title: "Real-Time Responses", description: "Instant verification results with structured response payloads." },
      { title: "Automation Ready", description: "Seamlessly integrate into digital onboarding and KYC systems." },
      { title: "Scalable Architecture", description: "Built to handle large verification volumes reliably." },
    ],
    whoShouldUse: ["Fintech companies and lenders", "Banks and NBFCs", "Marketplaces and platforms", "Enterprises with regulated onboarding requirements"],
    useCases: ["Customer KYC onboarding", "User identity verification", "Account opening workflows", "Compliance and due diligence checks"],
    trustAndCompliance: ["Consent-first verification approach", "Secure API authentication", "Encrypted data transmission", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Integrate API", description: "Integrate Aadhaar Verification API." },
      { title: "Go Live", description: "Start verifying Aadhaar details in production." },
    ],
    leadForm: {
      title: "Get Aadhaar Verification API Access",
    },
    faqs: [
      { question: "Is Aadhaar verification consent-based?", answer: "Yes, all Aadhaar verification flows are designed with explicit user consent at the core, ensuring transparency and compliance." },
      { question: "How fast is the verification?", answer: "Verification is real-time with instant results returned in structured response payloads." },
      { question: "Can it handle high volumes?", answer: "Yes, the architecture is built to handle large-scale KYC verification volumes reliably." },
      { question: "How do I integrate?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
    ],
    // inputOutputPreview: comingSoonPreview("Aadhaar Verification"),
  },

  // -------------------------------------------------------------------------
  // Bank Verification
  // -------------------------------------------------------------------------
  bank: {
    seo: {
      title: "Bank Account Verification API - Penny Drop & IFSC",
      description: "Verify bank account details instantly with Eko's Bank Verification API. Penny drop verification, IFSC validation, and account holder name matching for secure payouts.",
      keywords: "bank account verification API, penny drop API, IFSC validation API, bank verification, account verification, Eko API",
    },
    title: "Bank Account Verification API",
    description: "Verify bank account details instantly with penny drop verification",
    heroTitle: "Bank Account Verification",
    heroSubtitle: "Verify bank account details before payouts to prevent failed transactions and reduce operational costs. Instant verification with penny drop and account holder name matching.",
    category: "verification",
    docsUrl: "https://developers.eko.in/reference/bank-account-verification-pennydrop",
    heroImage: bankImg,
    features: [
      { title: "Penny Drop Verification", description: "Send ₹1 to verify account exists and is active before large payouts.", icon: CreditCard },
      { title: "Account Status Check", description: "Verify if the account is active, dormant, or closed.", icon: CheckCircle },
      { title: "Name Matching", description: "Get account holder name for verification against provided details.", icon: FileText },
      { title: "IFSC Validation", description: "Validate IFSC codes and get bank branch details.", icon: Building },
      { title: "Real-time Results", description: "Get verification results within seconds for seamless workflows.", icon: Zap },
      { title: "Bulk Verification", description: "Verify multiple accounts in a single API call for batch processing.", icon: Database },
    ],
    benefits: [
      { title: "Reduce Failed Payouts", description: "Verify accounts before disbursement to minimize transaction failures and reversals.", icon: CheckCircle },
      { title: "Prevent Fraud", description: "Match account holder names to prevent payouts to wrong accounts.", icon: Shield },
      { title: "Lower Operational Costs", description: "Reduce cost of failed transactions, reversals, and manual reconciliation.", icon: CreditCard },
      { title: "Instant Verification", description: "Real-time results for seamless customer and vendor onboarding.", icon: Zap },
      { title: "All Banks Supported", description: "Verify accounts across all major banks in India through a single API.", icon: Building },
      { title: "24/7 Availability", description: "Round-the-clock verification service with 99.9% uptime.", icon: Clock },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App and get API credentials." },
      { title: "Submit KYC", description: "Complete business verification process." },
      { title: "Integrate API", description: "Implement bank verification in your payout workflow." },
      { title: "Test", description: "Test with sandbox accounts before going live." },
      { title: "Go Live", description: "Start verifying real bank accounts before payouts." },
    ],
    useCases: ["Salary Disbursement", "Vendor Payments", "Loan Disbursement", "Insurance Claims", "Refund Processing", "Incentive Payouts", "Commission Payments", "E-commerce Seller Onboarding"],
    faqs: [
      { question: "What is penny drop verification?", answer: "Penny drop is a method where a small amount (₹1) is transferred to verify the account is active and details are correct. The account holder name is returned for matching." },
      { question: "Do customers receive the ₹1?", answer: "Yes, the ₹1 is credited to the verified account. This is a real transaction that confirms the account is active and can receive funds." },
      { question: "How accurate is name matching?", answer: "Our intelligent name matching algorithm handles variations, abbreviations, and common spelling differences with 99%+ accuracy." },
      { question: "Which banks are supported?", answer: "We support all major banks in India including SBI, HDFC, ICICI, Axis, Kotak, Yes Bank, and 100+ other banks." },
      { question: "What if verification fails?", answer: "Failed verifications return specific error codes indicating the reason - invalid account, closed account, incorrect IFSC, etc. - helping you take appropriate action." },
    ],
    inputOutputPreview: {
      apiName: "Bank Verification",
      inputs: [
        { label: "Account Number", value: "1234567890", icon: Hash },
        { label: "Bank Name", value: "State Bank of India", icon: Building },
        { label: "IFSC Code", value: "SBIN0001234", icon: CreditCard },
      ],
      outputs: [
        { label: "Account Holder Name", value: "Rajesh Kumar", icon: User },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // GST Verification
  // -------------------------------------------------------------------------
  gst: {
    seo: {
      title: "GST Verification API | Real-Time GSTIN Validation",
      description: "Integrate GST Verification API to validate GSTIN details instantly for vendor onboarding, compliance, and fraud prevention.",
      keywords: "GST Verification API, GSTIN Verification API, GST Check API, Business Verification API, GST Validation API",
    },
    title: "GST Verification API",
    description: "Validate GSTIN details instantly",
    heroTitle: "GST Verification API for Business Identity Validation",
    heroSubtitle: "Verify GSTIN details in real time to ensure compliant and trustworthy business onboarding.",
    category: "verification",
    docsUrl: "https://developers.eko.in/reference/advance-gst",
    heroImage: gstImg,
    overview: "The GST Verification API enables businesses to validate GSTIN details instantly. It is designed for compliance-driven onboarding, vendor verification, and business identity checks where accuracy and traceability are critical.",
    keyBenefits: [
      "Instant GSTIN verification",
      "Improves vendor and merchant onboarding accuracy",
      "Reduces compliance and fraud risk",
      "Automates business verification workflows",
      "Scales for high-volume verification needs",
    ],
    features: [
      { title: "Real-Time GSTIN Validation", description: "Verify GST registration details instantly with structured responses." },
      { title: "Business Identity Confirmation", description: "Validate legal business information before onboarding or payouts." },
      { title: "Automation Ready", description: "Easily integrate into KYB and compliance pipelines." },
      { title: "High-Volume Support", description: "Built to handle large verification volumes reliably." },
    ],
    whoShouldUse: ["Marketplaces and B2B platforms", "Fintechs onboarding merchants or vendors", "Enterprises with supplier verification needs", "Compliance-driven organizations"],
    useCases: ["Vendor and supplier onboarding", "Merchant verification for platforms", "Compliance and due diligence checks", "B2B onboarding workflows"],
    trustAndCompliance: ["Secure API authentication", "Encrypted verification communication", "Compliance-aligned data handling", "Audit-ready verification records"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Integrate API", description: "Integrate GST Verification API." },
      { title: "Go Live", description: "Start verifying GSTIN details in production." },
    ],
    leadForm: {
      title: "Get GST Verification API Access",
    },
    faqs: [
      { question: "What details are returned in GST verification?", answer: "The API returns GSTIN status, legal business name, trade name, registration date, and compliance filing status." },
      { question: "Can I verify multiple GSTINs?", answer: "Yes, the API supports high-volume verification for batch processing needs." },
      { question: "Is the data real-time?", answer: "Yes, GSTIN details are verified in real time against official records." },
      { question: "How do I get started?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and start verifying." },
    ],
    inputOutputPreview: {
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
    },
  },

  // -------------------------------------------------------------------------
  // UPI Verification
  // -------------------------------------------------------------------------
  upi: {
    seo: {
      title: "UPI ID Verification API | Verify UPI ID & Retrieve via Phone Number",
      description: "Verify UPI IDs in real time and retrieve UPI ID using phone number through a secure, well-documented API.",
      keywords: "UPI ID Verification API, UPI ID check API, Verify UPI ID, Retrieve UPI ID using phone number, VPA verification API, UPI verification API",
    },
    title: "UPI ID Verification API",
    description: "Verify UPI IDs and retrieve via phone number",
    heroTitle: "UPI ID Verification API – Verify UPI ID with Ease",
    heroSubtitle: "Validate UPI IDs in real time and retrieve a UPI ID using a phone number to reduce failures and improve payment accuracy.",
    category: "verification",
    docsUrl: "https://eko.in/developers/eps/upi-id-verification-api/",
    heroImage: upiVerifyImg,
    overview: "Eko's UPI ID Verification API is designed for payment systems that need real-time UPI ID validation. It supports verifying a UPI ID and retrieving a UPI ID using a phone number—helping you confirm payee identifiers before initiating transactions.",
    keyBenefits: [
      "Real-time UPI ID verification",
      "Retrieve UPI ID using phone number",
      "Reduces wrong-handle payment attempts",
      "Well-documented integration flow",
      "24×7 manual integration support",
    ],
    features: [
      { title: "Check UPI ID", description: "Validate whether a UPI ID is correct and usable before initiating a transfer." },
      { title: "Retrieve UPI ID Using Phone Number", description: "Fetch associated UPI ID details using a phone number to simplify payee discovery." },
      { title: "Secure, Simple and Robust", description: "Built for production-grade stability with straightforward integration steps." },
    ],
    useCases: [
      "Pre-payment validation for UPI transfers",
      "Reducing payout/payment failures caused by incorrect UPI IDs",
      "Customer onboarding where UPI ID discovery is required",
      "Assisted payments (agent or retailer-led transactions)",
    ],
    trustAndCompliance: [
      "Every API call is secured with one-time-use tokens generated using asymmetric cryptography",
      "Open-source libraries available to simplify and reduce integration errors",
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Sign up on Connect App." },
      { title: "Submit Documents", description: "Submit necessary documents." },
      { title: "Integrate API", description: "Integrate UPI ID Verification API." },
      { title: "Go Live", description: "Start validating UPI IDs." },
    ],
    leadForm: {
      title: "Get UPI ID Verification API Access",
    },
    faqs: [
      { question: "Can I retrieve a UPI ID using a phone number?", answer: "Yes, the API supports fetching associated UPI ID details using a phone number to simplify payee discovery." },
      { question: "How is the API secured?", answer: "Every API call is secured with one-time-use tokens generated using asymmetric cryptography." },
      { question: "Is 24×7 support available?", answer: "Yes, 24×7 manual integration support is available to help you integrate smoothly." },
      { question: "What use cases does it support?", answer: "Pre-payment validation, payout failure reduction, customer onboarding with UPI ID discovery, and assisted agent/retailer payments." },
    ],
    // inputOutputPreview: comingSoonPreview("UPI Verification"),
  },

  // -------------------------------------------------------------------------
  // DL Verification
  // -------------------------------------------------------------------------
  dl: {
    seo: {
      title: "Driving License Verification API | Real-Time DL Validation",
      description: "Integrate Driving License Verification API to validate driving license details instantly for KYC, onboarding, and compliance checks.",
      keywords: "Driving License Verification API, DL Verification API, Driving Licence Check API, Identity Verification API, KYC DL API",
    },
    title: "Driving License Verification API",
    description: "Real-time DL validation",
    heroTitle: "Driving License Verification API for Identity Validation",
    heroSubtitle: "Verify driving license details in real time to strengthen KYC and reduce identity fraud.",
    category: "verification",
    docsUrl: "https://developers.eko.in/reference/driving-license",
    heroImage: dlImg,
    overview: "The Driving License Verification API enables businesses to validate driving license details instantly as part of identity verification and onboarding workflows. It helps confirm user identity, reduce impersonation risk, and meet compliance requirements.",
    keyBenefits: [
      "Instant driving license verification",
      "Improves identity validation accuracy",
      "Reduces impersonation and document fraud",
      "Supports digital KYC workflows",
      "Scales for high-volume verification needs",
    ],
    features: [
      { title: "Real-Time DL Validation", description: "Verify driving license details instantly with structured verification responses." },
      { title: "Identity Confirmation", description: "Use DL data as a trusted identity signal during onboarding." },
      { title: "Automation Ready", description: "Seamlessly integrates into digital KYC and onboarding pipelines." },
      { title: "High-Volume Support", description: "Built to handle large verification volumes reliably." },
    ],
    whoShouldUse: ["Fintech and lending platforms", "Mobility and logistics companies", "Marketplaces onboarding drivers or agents", "Enterprises with identity verification needs"],
    useCases: ["Customer identity verification", "KYC onboarding workflows", "Driver or delivery partner onboarding", "Compliance and due diligence checks"],
    trustAndCompliance: ["Secure API authentication", "Encrypted data transmission", "Compliance-aligned verification workflows", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Integrate API", description: "Integrate DL Verification API." },
      { title: "Go Live", description: "Start verifying driving licenses in production." },
    ],
    leadForm: {
      title: "Get Driving License Verification API Access",
    },
    faqs: [
      { question: "How fast is DL verification?", answer: "Verification is real-time with instant structured responses for driving license details." },
      { question: "Can I use it for driver onboarding?", answer: "Yes, it's ideal for onboarding drivers, delivery partners, and agents requiring identity confirmation." },
      { question: "Does it support high volumes?", answer: "Yes, the API is built to handle large verification volumes reliably." },
      { question: "How do I integrate?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
    ],
    inputOutputPreview: {
      apiName: "DL Verification",
      inputs: [
        { label: "Driving License Number", value: "MH0220190001234", icon: CreditCard },
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
    },
  },

  // -------------------------------------------------------------------------
  // RC Verification
  // -------------------------------------------------------------------------
  rc: {
    seo: {
      title: "RC Verification API | Vehicle Registration Validation",
      description: "Integrate RC Verification API to validate vehicle registration details instantly for compliance, onboarding, and fraud prevention.",
      keywords: "RC Verification API, Vehicle RC Verification API, Vehicle Registration Check API, RC Validation API, Vehicle Verification API",
    },
    title: "RC Verification API",
    description: "Vehicle registration validation",
    heroTitle: "RC Verification API for Vehicle Identity Validation",
    heroSubtitle: "Verify vehicle registration details in real time to ensure compliance and reduce fraud.",
    category: "verification",
    docsUrl: "https://eko.in/developers/eps/rc-verification-api/",
    overview: "The RC Verification API enables businesses to validate vehicle registration certificate (RC) details instantly. It is designed for platforms that onboard drivers, vehicles, or assets where vehicle authenticity and ownership verification are critical.",
    keyBenefits: [
      "Instant RC verification",
      "Confirms vehicle ownership and registration status",
      "Reduces vehicle-related fraud",
      "Improves onboarding accuracy",
      "Automation-ready for digital workflows",
    ],
    features: [
      { title: "Real-Time RC Validation", description: "Verify vehicle registration details instantly with structured response data." },
      { title: "Vehicle Identity Confirmation", description: "Validate ownership and registration information before onboarding or activation." },
      { title: "Automation Friendly", description: "Seamlessly integrates into digital onboarding and verification pipelines." },
      { title: "High-Volume Ready", description: "Designed to support large-scale verification needs reliably." },
    ],
    whoShouldUse: ["Mobility and ride-hailing platforms", "Logistics and delivery companies", "Fleet operators", "Enterprises verifying vehicle assets"],
    useCases: ["Driver and vehicle onboarding", "Logistics and mobility platforms", "Asset and fleet verification", "Compliance and due diligence checks"],
    trustAndCompliance: ["Secure API authentication", "Encrypted verification communication", "Compliance-aligned data handling", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Integrate API", description: "Add RC verification to your workflow." },
      { title: "Go Live", description: "Start verifying vehicle registrations in production." },
    ],
    leadForm: {
      title: "Get RC Verification API Access",
    },
    faqs: [
      { question: "What details are returned?", answer: "Vehicle registration number, owner name, make/model, registration status, and more." },
      { question: "Is pan-India coverage available?", answer: "Yes, we cover all states and union territories through official database integration." },
      { question: "Can I verify commercial vehicles?", answer: "Yes, commercial vehicles return additional details like permit type and fitness status." },
      { question: "How do I get started?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
    ],
    inputOutputPreview: {
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
    },
  },

  // -------------------------------------------------------------------------
  // Vehicle Verification
  // -------------------------------------------------------------------------
  vehicle: {
    seo: {
      title: "Vehicle Verification API - RC & DL Verification",
      description: "Verify vehicle RC and driving license with Eko's Vehicle Verification API. Registration certificate validation, DL verification, chassis number check for mobility services.",
      keywords: "vehicle verification API, RC verification API, driving license API, DL verification, registration certificate API, Eko API",
      ogTitle: "Vehicle Verification API - RC & DL Verification",
      ogDescription: "Verify vehicle RC and driving license for mobility and logistics services.",
    },
    title: "Vehicle Verification API",
    description: "Verify vehicle RC and driving license for mobility services",
    heroTitle: "Vehicle & Driver Verification",
    heroSubtitle: "Verify vehicle registration certificates and driving licenses instantly. Essential for ride-hailing, logistics, insurance, and fleet management operations.",
    category: "verification",
    docsUrl: "https://developers.eko.in/docs/vehicle-verification",
    features: [
      { title: "RC Verification", description: "Verify vehicle registration certificate with owner details and vehicle information.", icon: Car },
      { title: "DL Verification", description: "Validate driving license with class, validity, and holder details.", icon: FileText },
      { title: "Chassis Verification", description: "Verify chassis number to validate vehicle authenticity.", icon: Search },
      { title: "Owner Details", description: "Get registered owner name and address for vehicle.", icon: Users },
      { title: "Validity Check", description: "Check if RC/DL is valid, expired, or suspended.", icon: CheckCircle },
      { title: "Insurance Status", description: "Verify if vehicle has active insurance coverage.", icon: Shield },
    ],
    benefits: [
      { title: "Driver Onboarding", description: "Verify driver documents before onboarding for ride-hailing and delivery platforms.", icon: Users },
      { title: "Fleet Compliance", description: "Ensure all fleet vehicles have valid RC, insurance, and fitness certificates.", icon: CheckCircle },
      { title: "Insurance Verification", description: "Verify vehicle details for motor insurance underwriting and claims.", icon: Shield },
      { title: "Fraud Prevention", description: "Detect fake or invalid documents during verification process.", icon: Shield },
      { title: "Instant Results", description: "Real-time verification from RTO databases across India.", icon: Zap },
      { title: "Loan Verification", description: "Verify vehicle details for vehicle finance and loan applications.", icon: CreditCard },
    ],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App." },
      { title: "Get Credentials", description: "Receive API credentials for sandbox testing." },
      { title: "Integrate API", description: "Add vehicle verification to your onboarding flow." },
      { title: "Test", description: "Test with sample RC/DL numbers in sandbox." },
      { title: "Go Live", description: "Deploy with production credentials." },
    ],
    useCases: ["Ride-Hailing Platforms", "Delivery Services", "Fleet Management", "Vehicle Insurance", "Vehicle Finance", "Used Car Marketplaces", "Parking Solutions", "Toll Management"],
    faqs: [
      { question: "What RC details can be verified?", answer: "You can verify registration number, owner name, vehicle class, fuel type, registration date, chassis number, engine number, insurance validity, and fitness certificate status." },
      { question: "Which states are supported?", answer: "We support RC and DL verification across all states in India through integration with VAHAN and SARATHI databases." },
      { question: "Can I verify commercial vehicle permits?", answer: "Yes, for commercial vehicles, you can also verify permits, fitness certificates, and tax status along with RC details." },
      { question: "How accurate is the verification?", answer: "All verifications are done against official RTO databases (VAHAN/SARATHI), ensuring 100% accuracy of returned data." },
      { question: "Is real-time verification available?", answer: "Yes, all verifications are performed in real-time with sub-second response times for most queries." },
    ],
    inputOutputPreview: {
      apiName: "Vehicle Verification",
      inputs: [
        { label: "Vehicle Number", value: "MH01AB1234", icon: Car },
      ],
      outputs: [
        { label: "Owner Name", value: "Rajesh Kumar" },
        { label: "Vehicle Category", value: "LMV" },
        { label: "RC Status", value: "Active" },
        { label: "Vehicle Color", value: "White" },
        { label: "Manufacturer", value: "Maruti Suzuki" },
        { label: "Model", value: "Swift Dzire" },
        { label: "Manufacturing Year", value: "2020" },
        { label: "Registration Date", value: "15/06/2020" },
        { label: "Insurance Valid Upto", value: "20/12/2025" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // DigiLocker
  // -------------------------------------------------------------------------
  digilocker: {
    seo: {
      title: "DigiLocker API | Secure Digital Document Access",
      description: "Integrate DigiLocker API to access and verify user documents securely through consent-based digital workflows.",
      keywords: "DigiLocker API, Digital Document Verification API, Consent Based Document Access, Paperless KYC API, Government Document API",
    },
    title: "DigiLocker API",
    description: "Secure digital document verification",
    heroTitle: "DigiLocker API for Secure Digital Document Verification",
    heroSubtitle: "Access and verify user documents digitally through consent-driven, paperless workflows.",
    category: "verification",
    docsUrl: "https://eps.eko.in/developers/eps/digilocker-api/",
    overview: "The DigiLocker API enables businesses to fetch and verify user documents digitally with explicit consent. It eliminates manual document collection, reduces fraud, and accelerates onboarding through trusted digital records.",
    keyBenefits: [
      "Paperless document verification",
      "Consent-based access to user documents",
      "Faster onboarding and KYC completion",
      "Reduced document fraud and forgery risk",
      "Improved user experience",
    ],
    features: [
      { title: "Consent-Based Document Access", description: "Fetch documents only after explicit user consent, ensuring transparency and trust." },
      { title: "Digital Document Retrieval", description: "Access verified digital documents without physical copies." },
      { title: "Automation Ready", description: "Integrates seamlessly into digital onboarding and compliance systems." },
      { title: "Scalable Architecture", description: "Designed to handle high-volume document access reliably." },
    ],
    whoShouldUse: ["Banks and NBFCs", "Fintech and lending platforms", "Enterprises with digital onboarding", "Platforms requiring document verification"],
    useCases: ["Digital KYC and onboarding", "Loan and credit processing", "Customer identity verification", "Compliance and due diligence workflows"],
    trustAndCompliance: ["Consent-first data access", "Secure API authentication", "Encrypted document transmission", "Audit-ready access logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Integrate API", description: "Integrate DigiLocker API into your system." },
      { title: "Go Live", description: "Start accessing digital documents in production." },
    ],
    leadForm: {
      title: "Get DigiLocker API Access",
    },
    faqs: [
      { question: "Is DigiLocker access consent-based?", answer: "Yes, documents are fetched only after explicit user consent, ensuring full transparency." },
      { question: "What documents can be accessed?", answer: "You can access government-issued digital documents like Aadhaar, PAN, driving license, and more through DigiLocker." },
      { question: "Does it eliminate physical document collection?", answer: "Yes, the API enables fully paperless document verification, eliminating manual collection." },
      { question: "How do I integrate?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
    ],
    // inputOutputPreview: comingSoonPreview("DigiLocker"),
  },

  // -------------------------------------------------------------------------
  // Employee Verification
  // -------------------------------------------------------------------------
  employee: {
    seo: {
      title: "Employee Verification API | Workforce Background Checks",
      description: "Integrate Employee Verification API to verify employee identity and details digitally for hiring, compliance, and risk management.",
      keywords: "Employee Verification API, Employee Background Check API, Workforce Verification API, HR Verification API, Employee KYC API",
    },
    title: "Employee Verification API",
    description: "Digital employee identity verification",
    heroTitle: "Employee Verification API for Trusted Workforce Onboarding",
    heroSubtitle: "Verify employee identity and details digitally to reduce hiring risk and ensure compliance.",
    category: "verification",
    docsUrl: "https://eko.in/developers/eps/employee-verification-api/",
    overview: "The Employee Verification API enables organizations to verify employee identity and related details digitally during hiring and onboarding. It is designed to reduce hiring risk, improve compliance, and streamline workforce verification workflows.",
    keyBenefits: [
      "Digital employee verification",
      "Reduced hiring and impersonation risk",
      "Faster onboarding cycles",
      "Automation-ready HR workflows",
      "Scalable for large hiring volumes",
    ],
    features: [
      { title: "Employee Identity Verification", description: "Verify employee identity details digitally as part of onboarding." },
      { title: "Hiring Risk Reduction", description: "Detect inconsistencies early to reduce impersonation and compliance risk." },
      { title: "Automation Friendly", description: "Integrates seamlessly into HRMS, ATS, and onboarding platforms." },
      { title: "High-Volume Support", description: "Designed to support large-scale hiring and verification needs." },
    ],
    whoShouldUse: ["Enterprises and large employers", "HR tech platforms", "Gig economy and staffing companies", "Organizations with compliance-driven hiring"],
    useCases: ["Pre-employment verification", "Contractor and gig worker onboarding", "Workforce compliance checks", "Enterprise HR verification workflows"],
    trustAndCompliance: ["Secure API authentication", "Encrypted data transmission", "Compliance-aligned verification workflows", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Integrate API", description: "Integrate Employee Verification API." },
      { title: "Go Live", description: "Start verifying employees in production." },
    ],
    leadForm: {
      title: "Get Employee Verification API Access",
    },
    faqs: [
      { question: "What can be verified?", answer: "Employee identity details including name, ID documents, and related information can be verified digitally." },
      { question: "Does it integrate with HRMS?", answer: "Yes, the API integrates seamlessly into HRMS, ATS, and onboarding platforms." },
      { question: "Can it handle large hiring volumes?", answer: "Yes, the API is designed to support large-scale hiring and verification needs." },
      { question: "How do I get started?", answer: "Sign up on Connect App, submit documents, integrate the REST API, and start verifying." },
    ],
    inputOutputPreview: {
      apiName: "Employee Verification",
      inputs: [
        { label: "Phone Number", value: "+91 98765 43210", icon: Phone },
      ],
      outputs: [
        { label: "Employee Name", value: "Rajesh Kumar" },
        { label: "Date of Birth", value: "29/08/1994" },
        { label: "PAN Number", value: "ABCDE1234F" },
        { label: "UAN", value: "1001234567890" },
        { label: "Member ID", value: "MH/BOM/12345" },
        { label: "Company Name", value: "Acme Pvt Ltd" },
        { label: "Joining Date", value: "01/04/2019" },
        { label: "Exit Date", value: "30/06/2023" },
        { label: "Exit Reason", value: "Resignation" },
        { label: "PF Filing", value: "Up to date" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Reverse Geocoding
  // -------------------------------------------------------------------------
  geocoding: {
    seo: {
      title: "Reverse Geocoding API | Location to Address Resolution",
      description: "Integrate Reverse Geocoding API to convert latitude and longitude into accurate, structured address data for verification and compliance.",
      keywords: "Reverse Geocoding API, Location Verification API, Address Resolution API, Latitude Longitude to Address API, Geo Verification API",
    },
    title: "Reverse Geocoding API",
    description: "Convert coordinates to addresses",
    heroTitle: "Reverse Geocoding API for Location-Based Verification",
    heroSubtitle: "Convert geo-coordinates into precise address data to strengthen verification and compliance workflows.",
    category: "verification",
    docsUrl: "https://eko.in/developers/eps/reverse-geocoding-api/",
    overview: "The Reverse Geocoding API enables businesses to translate latitude and longitude coordinates into structured address information. It is designed for address validation, geo-compliance checks, and location-based risk assessment.",
    keyBenefits: [
      "Accurate latitude-to-address conversion",
      "Improves address and location verification",
      "Supports geo-compliance and risk checks",
      "Automation-ready for digital workflows",
      "Scales for high-volume location lookups",
    ],
    features: [
      { title: "Coordinate to Address Resolution", description: "Convert latitude and longitude into structured, readable address data." },
      { title: "Location Accuracy", description: "Helps validate whether users or devices are operating from expected locations." },
      { title: "Automation Friendly", description: "Integrates easily into onboarding, verification, and monitoring systems." },
      { title: "High-Volume Ready", description: "Designed to handle frequent and large-scale geolocation queries." },
    ],
    whoShouldUse: ["Fintechs and regulated platforms", "Enterprises verifying customer locations", "Field service and agent-based operations", "Platforms performing geo-risk analysis"],
    useCases: ["Address verification during onboarding", "Geo-compliance and location validation", "Fraud detection and risk assessment", "Field agent or device location checks"],
    trustAndCompliance: ["Secure API authentication", "Encrypted request and response handling", "Compliance-aligned data processing", "Audit-ready lookup records"],
    integrationSteps: [
      { title: "Sign Up", description: "Create an account on Connect App." },
      { title: "Submit Documents", description: "Submit necessary documents." },
      { title: "Integrate API", description: "Pass latitude and longitude to our API." },
      { title: "Go Live", description: "Start resolving addresses in production." },
    ],
    leadForm: {
      title: "Get Reverse Geocoding API Access",
    },
    faqs: [
      { question: "How accurate is the address returned?", answer: "Accuracy depends on GPS precision. With standard coordinates, we return correct locality, city, and pincode." },
      { question: "What address components are returned?", answer: "We return formatted address, area/locality, city, district, state, pincode, and country." },
      { question: "Can I use this for fraud detection?", answer: "Yes, you can cross-check customer-provided addresses against GPS-derived addresses for fraud prevention." },
      { question: "What is the rate limit?", answer: "Rate limits depend on your plan. Contact us for higher throughput requirements." },
    ],
    inputOutputPreview: {
      apiName: "Reverse Geocoding",
      inputs: [
        { label: "Latitude", value: "19.0760", icon: MapPin },
        { label: "Longitude", value: "72.8777", icon: MapPin },
      ],
      outputs: [
        { label: "Address", value: "Chhatrapati Shivaji Terminus" },
        { label: "City", value: "Mumbai" },
        { label: "State", value: "Maharashtra" },
        { label: "PIN Code", value: "400001" },
      ],
    },
  },
};

// Suppress unused-variable warnings for icons that are imported but only used
// inside object literals (TypeScript sees them as referenced).
void (Banknote as LucideIcon);
