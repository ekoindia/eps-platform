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
  Palette, Leaf,
  // Employee
  Phone,
  // Reverse Geocoding
  MapPin,
  // Pan Verification
  User, Calendar,
  // Zap (used everywhere)
  Zap,
  Mail,
  // Product-level icons (used by solutions resolver)
  ShieldCheck, Building2, FolderCheck, Briefcase, Truck,
  Info,
  IdCard,
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
    desc:
      "Create an account on Connect App and get your sandbox credentials.", // TODO: Signup with your mobile number (complete OTP verification in future). SHOW "Sign Up Now" CTA that links to Zoho Chat with pre-filled message "Hi, I want to integrate [API_NAME]."
    tip: "Takes less than a minute",
  },
  {
    title: "Submit KYC",
    desc:
      "Complete your KYC verification process by submitting the required documents.", // TODO: Our team will call you and guide you through the simple KYC process (document submission, video call, etc.) How long does it take for our team to verify docs???
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

/** PAN entry FAQs — also used to generate jsonLd FAQPage below */
const PAN_FAQS = [
  { q: "How fast is PAN verification?", a: "PAN verification is real-time with sub-second response times for instant identity validation." },
  { q: "What details are returned?", a: "The API returns validated PAN holder name, PAN status, and other relevant identity details." },
  { q: "Is it suitable for high volumes?", a: "Yes, the API is designed to handle large-scale verification volumes reliably without performance degradation." },
  { q: "How do I get started?", a: "Sign up on Connect App, submit necessary documents, integrate the API, and start verifying PAN details." },
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
    desc: "Enable instant money transfers across India with Eko's DMT API",
    heroTitle: "Instant Domestic Money Transfers",
    heroSubtitle: "Enable real-time money transfers across India with our robust DMT API. Power remittances for millions of customers with IMPS, NEFT, and RTGS support.",
    category: "payment",
    icon: Banknote,
    docsUrl: "https://developers.eko.in/reference/fino-dmt-flow",
    heroImage: moneyTransferImg,
    features: [
      { title: "Real-time Transfers", desc: "Instant money transfers via IMPS with real-time status updates and confirmations.", icon: Zap },
      { title: "NEFT & RTGS Support", desc: "Support for NEFT and RTGS for high-value transfers with guaranteed settlements.", icon: Banknote },
      { title: "Pan-India Coverage", desc: "Transfer money to any bank account across India with 99.9% success rate.", icon: Globe },
      { title: "Real-time Webhooks", desc: "Receive instant notifications for transaction status updates via webhooks.", icon: RefreshCw },
      { title: "Secure Transactions", desc: "Bank-grade encryption and security for all transactions with audit trails.", icon: Shield },
      { title: "24/7 Availability", desc: "Round-the-clock availability with 99.9% uptime guarantee.", icon: Clock },
    ],
    benefits: [
      { title: "Seamless Integration", desc: "Well-documented APIs with SDKs in multiple languages. Get started in minutes with 24x7 support.", icon: CheckCircle },
      { title: "Best Success Rate", desc: "Industry-leading success rates with smart routing and automatic retries.", icon: Zap },
      { title: "Earn Commission", desc: "Earn attractive commissions on every successful transaction processed through your platform.", icon: Banknote },
      { title: "Scalable Infrastructure", desc: "Handle millions of transactions with our enterprise-grade infrastructure.", icon: Building },
      { title: "Retailer Network", desc: "Build and manage a network of retailers for cash-in and cash-out services.", icon: Users },
      { title: "Regulatory Compliant", desc: "Fully RBI-compliant infrastructure with all necessary licenses and certifications.", icon: Shield },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Get production credentials and start processing real transactions." },
    ],
    useCases: ["Retail Banking Apps", "Fintech Platforms", "Remittance Services", "Kirana Stores", "Agent Banking", "Corporate Payouts", "E-commerce Refunds"],
    faqs: [
      { q: "What is the DMT API?", a: "The DMT (Domestic Money Transfer) API enables instant money transfers to any bank account across India using IMPS, NEFT, or RTGS. It's designed for businesses that want to offer remittance services to their customers." },
      { q: "What is the transaction limit?", a: "Individual transaction limits vary based on the mode of transfer. IMPS supports up to ₹5 lakh per transaction, while NEFT and RTGS support higher limits for bulk transfers." },
      { q: "How long does a transfer take?", a: "IMPS transfers are instant (within seconds). NEFT transfers are processed in batches throughout the day, and RTGS transfers are processed in real-time during banking hours." },
      { q: "What documents are required for integration?", a: "You'll need business registration documents, PAN card, bank account details, and relevant licenses based on your business type. Our team will guide you through the complete process." },
      { q: "Is there a settlement delay?", a: "Settlement timelines depend on your agreement. Most partners receive T+1 settlements, with options for same-day settlements for high-volume partners." },
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
    desc: "Aadhaar-enabled payment services for rural and underbanked segments",
    heroTitle: "Aadhaar Enabled Payment System",
    heroSubtitle: "Bring banking services to every corner of India with AePS. Enable cash withdrawals, balance enquiries, and fund transfers using just Aadhaar and fingerprint authentication.",
    category: "payment",
    icon: Fingerprint,
    docsUrl: "https://developers.eko.in/reference/aeps-fingpay-transaction",
    heroImage: aepsImg,
    features: [
      { title: "Cash Withdrawal", desc: "Enable customers to withdraw cash from any bank account using Aadhaar and biometric authentication.", icon: Wallet },
      { title: "Balance Enquiry", desc: "Check account balance instantly using Aadhaar number and fingerprint verification.", icon: FileText },
      { title: "Mini Statement", desc: "Retrieve the last few transactions for any Aadhaar-linked bank account.", icon: FileText },
      { title: "Fund Transfer", desc: "Transfer funds between Aadhaar-linked accounts securely and instantly.", icon: Fingerprint },
      { title: "Biometric Authentication", desc: "Secure transactions with Aadhaar-based biometric verification using UIDAI.", icon: Shield },
      { title: "Multi-Bank Support", desc: "Connect to all major banks in India through a single integration.", icon: Building },
    ],
    benefits: [
      { title: "Financial Inclusion", desc: "Bring banking services to rural and underbanked populations without traditional infrastructure.", icon: Users },
      { title: "No Debit Card Required", desc: "Customers only need their Aadhaar number and fingerprint - no cards or PINs needed.", icon: Fingerprint },
      { title: "Secure & Compliant", desc: "UIDAI-certified biometric authentication ensures secure and compliant transactions.", icon: Shield },
      { title: "Build Retailer Network", desc: "Enable local retailers to become banking points and earn commissions.", icon: Building },
      { title: "24/7 Operations", desc: "Provide banking services round the clock, even in areas without bank branches.", icon: Clock },
      { title: "Easy Integration", desc: "Simple REST APIs with comprehensive documentation and sandbox environment.", icon: CheckCircle },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      // { title: "Setup Biometric Devices", desc: "Configure certified biometric devices for fingerprint capture." },
      { title: "Onboard Retailers", desc: "Start onboarding retailers to offer AePS services." },
      { title: "Go Live", desc: "Launch your AePS services and start serving customers." },
    ],
    useCases: ["Banking Correspondents", "Rural Financial Services", "Kirana Store Banking", "CSC Centers", "Microfinance Institutions", "Government Disbursements"],
    faqs: [
      { q: "What is AePS?", a: "AePS (Aadhaar Enabled Payment System) is a bank-led model that allows online financial transactions at Micro ATM through Aadhaar authentication. It uses NPCI infrastructure and enables customers to use Aadhaar for bank transactions." },
      { q: "What biometric devices are supported?", a: "We support all UIDAI-certified biometric devices including Morpho, Mantra, Startek, and others. Contact our team for the complete list of supported devices." },
      { q: "What is the transaction limit for AePS?", a: "Cash withdrawal limits vary by bank but typically range from ₹10,000 to ₹50,000 per transaction. Some banks allow higher limits for specific use cases." },
      { q: "Do I need special certification?", a: "Yes, you need to be a certified AePS operator. Eko can help you with the certification process and provide all necessary support." },
      { q: "How is commission calculated?", a: "Commission is earned on every successful transaction. The exact rates depend on your agreement and transaction volumes. Contact our team for detailed pricing." },
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
    desc: "Complete bill payment ecosystem with 200+ biller categories",
    heroTitle: "Help Customers Pay Their Utility Bills!",
    heroSubtitle: "The BBPS API enables seamless integration for bill payments in India. Whether you're a financial institution, fintech, or service provider, offer your customers convenient bill payment services.",
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
      { title: "200+ Biller Categories", desc: "Access to extensive biller network covering electricity, gas, water, insurance, and more.", icon: Receipt },
      { title: "Instant Bill Fetch", desc: "Fetch outstanding bill amounts in real-time before payment processing.", icon: Zap },
      { title: "Unified API", desc: "Single API integration for all biller categories - no separate integrations needed.", icon: CheckCircle },
      { title: "Transaction Tracking", desc: "Complete visibility into transaction status with detailed reporting.", icon: Receipt },
      { title: "Secure Payments", desc: "PCI-DSS compliant infrastructure with end-to-end encryption.", icon: Shield },
      { title: "Receipt Generation", desc: "Auto-generated receipts for every successful transaction.", icon: Receipt },
    ],
    benefits: [
      { title: "Simplified Integration", desc: "Easy-to-read API documentation and 24x7 integration support for quick go-live.", icon: CheckCircle },
      { title: "Best Success Rate", desc: "Industry-leading success rates with smart retry mechanisms.", icon: Zap },
      { title: "Earn Commission", desc: "Attractive commissions on all types of bill payments processed through your platform.", icon: Receipt },
      { title: "Extensive Biller Network", desc: "Access to 20,000+ billers across all major categories in India.", icon: Building },
      { title: "Real-time Confirmation", desc: "Instant payment confirmation with transaction reference numbers.", icon: Zap },
      { title: "Customer Retention", desc: "Keep customers engaged with recurring bill payment reminders and services.", icon: Users },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "UAT Testing", desc: "Complete UAT testing with all biller categories." },
      // { title: "IP Whitelisting", desc: "Get your production IPs whitelisted (India only)." },
      { title: "Go Live", desc: "Launch with production credentials and start billing!" },
    ],
    useCases: ["Banking Apps", "Fintech Platforms", "Payment Aggregators", "E-commerce Platforms", "Retail Networks", "Agent Banking", "Corporate Solutions"],
    faqs: [
      { q: "What is BBPS API?", a: "BBPS (Bharat Bill Payment System) API is an RBI-mandated online bill payment system that enables customers to pay bills easily and securely. Our API allows you to integrate bill payment services into your platform." },
      { q: "How many billers are supported?", a: "Eko's BBPS API provides access to 20,000+ billers across 200+ categories including electricity, gas, water, DTH, broadband, insurance, EMI, FASTag, and more." },
      { q: "What are the commission rates?", a: "Commission rates vary by biller category and transaction volume. Contact our sales team for detailed pricing and commission structures." },
      { q: "Is BBPS API available 24/7?", a: "Yes, BBPS services are available 24/7. However, some billers may have specific operating hours for payment processing." },
      { q: "How long does integration take?", a: "With our well-documented APIs and sandbox environment, most partners complete integration within 2-4 weeks including testing and certification." },
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
    desc: "Accept UPI payments via dynamic QR codes",
    heroTitle: "QR Payment API",
    heroSubtitle: "Enable seamless UPI payments through dynamic QR codes. Perfect for retail stores, restaurants, and any business accepting digital payments.",
    category: "payment",
    icon: QrCode,
    docsUrl: "https://developers.eko.in/reference/upi-generate-static-qr",
    heroImage: qrImg,
    features: [
      { title: "Dynamic QR Generation", desc: "Generate unique QR codes for each transaction with custom amounts and references.", icon: QrCode },
      { title: "Real-time Notifications", desc: "Instant webhooks and callbacks when payment is received.", icon: Zap },
      { title: "Multi-app Support", desc: "Works with all UPI apps - Google Pay, PhonePe, Paytm, BHIM, and more.", icon: Smartphone },
      { title: "Static QR Support", desc: "Generate static QR codes for fixed collection points.", icon: QrCode },
      { title: "Transaction Tracking", desc: "Complete transaction history and reconciliation reports.", icon: BarChart3 },
      { title: "Refund Management", desc: "Process refunds directly through the API when needed.", icon: RefreshCw },
    ],
    benefits: [
      { title: "Zero Hardware Cost", desc: "No POS machine required - customers scan and pay using their phones.", icon: Smartphone },
      { title: "Instant Settlement", desc: "Fast settlement cycles to ensure healthy cash flow.", icon: Zap },
      { title: "Lower MDR", desc: "Benefit from competitive merchant discount rates on UPI transactions.", icon: CreditCard },
      { title: "Easy Integration", desc: "Simple REST APIs with comprehensive documentation and SDKs.", icon: CheckCircle },
      { title: "Secure Transactions", desc: "Bank-grade security with encrypted QR codes and secure callbacks.", icon: Shield },
      { title: "Analytics Dashboard", desc: "Track payments, view trends, and download reports easily.", icon: BarChart3 },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Generate QR", desc: "Use API to generate dynamic or static QR codes." },
      { title: "Display QR", desc: "Show QR to customers on screen or print." },
      { title: "Receive Payments", desc: "Get instant notifications on successful payments." },
    ],
    useCases: ["Retail Stores", "Restaurants & Cafes", "E-commerce COD", "Street Vendors", "Service Providers", "Subscription Payments", "Event Ticketing", "Donation Collection"],
    faqs: [
      { q: "What is a dynamic QR code?", a: "A dynamic QR code contains a unique transaction ID and amount for each payment. This allows automatic reconciliation and instant payment confirmation without manual verification." },
      { q: "Which UPI apps are supported?", a: "Our QR codes work with all UPI-enabled apps including Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, and bank-specific UPI apps." },
      { q: "How fast are payment notifications?", a: "Payment notifications are sent in real-time, typically within 1-2 seconds of successful payment. We support both webhooks and polling mechanisms." },
      { q: "Can I customize the QR code appearance?", a: "Yes, you can add your logo, change colors, and customize the QR code design while maintaining scannability." },
      { q: "What are the settlement timelines?", a: "Standard settlement is T+1 (next business day). Faster settlement options are available for eligible merchants." },
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
    desc: "Digitize cash collection with field agents",
    heroTitle: "Cash Collection API",
    heroSubtitle: "Enable your field agents to collect cash and instantly credit customer accounts. Reduce collection costs, improve efficiency, and provide real-time visibility.",
    category: "payment",
    icon: Receipt,
    docsUrl: "https://developers.eko.in/v1/reference/get-cms-url",
    heroImage: cmsImg,
    features: [
      { title: "Field Agent App", desc: "White-label mobile app for field agents to collect payments and issue receipts.", icon: Users },
      { title: "Real-time Credits", desc: "Instant account credit upon cash collection with digital confirmation.", icon: Zap },
      { title: "GPS Tracking", desc: "Track agent location and collection points for complete visibility.", icon: MapPin },
      { title: "Digital Receipts", desc: "Auto-generated digital receipts sent to customers via SMS.", icon: FileText },
      { title: "Cash Limit Management", desc: "Set daily and per-transaction cash limits for each agent.", icon: Banknote },
      { title: "Reconciliation", desc: "Automated reconciliation with detailed collection reports.", icon: Clock },
    ],
    benefits: [
      { title: "Reduce Collection Cost", desc: "Lower operational costs with efficient agent management and routing.", icon: Banknote },
      { title: "Faster Realization", desc: "Instant account credits eliminate delays in payment realization.", icon: Zap },
      { title: "Fraud Prevention", desc: "GPS tracking, photo proof, and digital receipts prevent collection fraud.", icon: Shield },
      { title: "Customer Convenience", desc: "Doorstep collection improves customer experience and retention.", icon: Users },
      { title: "Complete Visibility", desc: "Real-time dashboard showing collection status across all agents.", icon: CheckCircle },
      { title: "Easy Integration", desc: "Simple API integration with your existing loan or billing system.", icon: FileText },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Configure", desc: "Set up collection accounts and agent limits." },
      { title: "Onboard Agents", desc: "Register field agents and distribute the app." },
      // { title: "Integrate", desc: "Connect with your billing/loan system via API." },
      { title: "Go Live", desc: "Start collecting with real-time tracking and credits." },
    ],
    useCases: ["NBFC Loan Collection", "Insurance Premium Collection", "Utility Bill Collection", "Microfinance", "Chit Fund Collection", "Society Maintenance", "Subscription Collection", "Rental Collection"],
    faqs: [
      { q: "How does the agent app work?", a: "Agents download our white-label app, log in with credentials, and can immediately start collecting. The app shows assigned customers, amounts due, and allows cash/digital collection with instant receipts." },
      { q: "Is there a limit on collection amount?", a: "You can configure daily limits and per-transaction limits for each agent based on your risk policy. Higher limits require additional verification." },
      { q: "How is fraud prevented?", a: "Multiple layers including GPS location logging, photo capture of cash, digital receipts sent directly to customers, and real-time reconciliation. Any discrepancy is flagged immediately." },
      { q: "Can we use our own collection app?", a: "Yes, our APIs can be integrated into your existing mobile app. We provide SDKs and complete documentation for custom integration." },
      { q: "What reports are available?", a: "Daily collection summary, agent-wise reports, location-based analytics, pending collections, and reconciliation reports. All reports can be exported or accessed via API." },
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
    desc: "Make salary & vendor payments easily",
    heroTitle: "Payout API",
    heroSubtitle: "Pay your employees and vendors directly from your digital wallet balance. Easy-to-use, reliable, and secure fund transfer API for instant salary disbursals and vendor payments.",
    category: "payment",
    icon: Send,
    docsUrl: "https://developers.eko.in/docs/fund-transfer",
    heroImage: payoutImg,
    features: [
      { title: "Easy Salary Disbursals", desc: "Pay wages to your employees directly into their bank accounts instantly.", icon: Users },
      { title: "Instant Vendor Payments", desc: "Settle outstanding dues with vendors in one go through a hassle-free process.", icon: Building },
      { title: "Track Payments", desc: "Maintain a record of every payment transaction to avoid conflicts.", icon: FileText },
      { title: "E-Wallet Payments", desc: "Use your e-wallet balance to make payments — no bank account needed.", icon: Wallet },
      { title: "High Success Rate", desc: "Best-in-class success rates, as reliable as banks themselves.", icon: CheckCircle },
      { title: "Secure Transfers", desc: "Every API call is secured with one-time-use tokens using asymmetric cryptography.", icon: Shield },
    ],
    benefits: [
      { title: "24x7 Availability", desc: "Make payments anytime — not confined to banking hours.", icon: Clock },
      { title: "Use E-Money", desc: "Pay directly from your e-wallet balance — much easier and faster than bank transfers.", icon: Wallet },
      { title: "Best Success Rate", desc: "Transaction failures occur rarely. We ensure the best success rate for every transaction.", icon: Zap },
      { title: "Simple Documentation", desc: "Comprehensive and constantly updated API documentation with full technical support.", icon: FileText },
      { title: "Open-Source Libraries", desc: "Easy and error-proof integration with Eko's open-source libraries.", icon: RefreshCw },
      { title: "Bank-Grade Security", desc: "Same APIs used internally at Eko, secured with asymmetric cryptography.", icon: Shield },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Start Paying", desc: "Start making salary and vendor payments instantly." },
    ],
    useCases: ["Salary Disbursement", "Vendor Payments", "Contractor Payments", "Gig Worker Payouts", "Commission Payments", "Refund Processing", "Incentive Payouts", "Bulk Disbursements"],
    faqs: [
      { q: "How does the Payout API work?", a: "You load your digital wallet balance and use the Payout API to transfer funds directly to any bank account in India. Payments are processed via IMPS/NEFT for instant or near-instant settlements." },
      { q: "Do I need a bank account to make payments?", a: "No, you can use your e-wallet balance to make payments. This is much easier and faster than traditional bank transfers." },
      { q: "Is the Payout API available 24x7?", a: "Yes, unlike banks, our Payout API works 24x7 including weekends and holidays, so you can make payments anytime." },
      { q: "What is the success rate?", a: "We maintain one of the highest success rates in the industry. Transaction failures are extremely rare, and we are as reliable as banks themselves." },
      { q: "What use cases are not allowed?", a: "The Payout API is strictly not for gaming, trading, betting, or any unauthorized/illegal activity." },
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
    desc: "Send instant payouts to any UPI ID",
    heroTitle: "UPI Payout API",
    heroSubtitle: "Send money instantly to any UPI ID - VPAs, mobile numbers, or linked bank accounts. Perfect for vendor payments, refunds, and disbursements.",
    category: "payment",
    icon: Banknote,
    docsUrl: "https://developers.eko.in/reference/upi-vpa-payment",
    heroImage: payoutImg,
    features: [
      { title: "Instant Transfers", desc: "Send money to any UPI ID with instant credit, 24x7.", icon: Zap },
      { title: "VPA & Mobile Support", desc: "Pay to UPI IDs, mobile numbers, or bank account-linked VPAs.", icon: Send },
      { title: "Bulk Payouts", desc: "Process thousands of payouts in a single API batch.", icon: Users },
      { title: "Real-time Status", desc: "Instant webhook notifications for successful transfers.", icon: Clock },
      { title: "Auto-retry Logic", desc: "Intelligent retry mechanism for failed transactions.", icon: CheckCircle },
      { title: "Detailed Reports", desc: "Transaction-level reports with UTR and status details.", icon: FileText },
    ],
    benefits: [
      { title: "Zero Bank Holidays", desc: "UPI works 24x7x365, including weekends and holidays.", icon: Clock },
      { title: "Lower Cost", desc: "More cost-effective than NEFT/IMPS for small-value payouts.", icon: Wallet },
      { title: "No Account Details", desc: "Just need UPI ID - no need to collect bank account details.", icon: Users },
      { title: "Instant Confirmation", desc: "Know immediately if the transfer succeeded or failed.", icon: Zap },
      { title: "High Success Rate", desc: "99%+ success rate with intelligent routing.", icon: CheckCircle },
      { title: "Secure Transfers", desc: "Bank-grade encryption and secure API authentication.", icon: Shield },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Add Funds", desc: "Load your payout wallet with working capital." },
      { title: "Scale", desc: "Process bulk payouts as your business grows." },
    ],
    useCases: ["Vendor Payments", "Salary Disbursement", "Refunds & Cashbacks", "Gig Worker Payments", "Insurance Claims", "Loan Disbursement", "Contest Winnings", "Affiliate Payouts"],
    faqs: [
      { q: "What UPI IDs are supported?", a: "We support all UPI IDs across banks - user@upi, user@paytm, user@ybl, mobile@upi, and any other valid VPA format." },
      { q: "What is the maximum payout limit?", a: "Individual UPI payouts can be up to ₹1 lakh per transaction. Higher limits are available for verified business accounts." },
      { q: "How do I handle failed payouts?", a: "Failed payouts are automatically retried based on error type. You receive webhook notifications for all status changes. Funds are returned to your wallet for non-recoverable failures." },
      { q: "Is there a minimum payout amount?", a: "Minimum payout is ₹1. There's no limit on number of payouts, making it ideal for micro-transactions." },
      { q: "How do I verify UPI ID before payout?", a: "Use our UPI ID Verification API to validate the UPI ID and get beneficiary name before initiating payout." },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: PAN
  // -------------------------------------------------------------------------
  pan: {
    seo: {
      title: "PAN Verification API India | Instant PAN Validation for KYC & Onboarding",
      description: "Choose from PAN Lite, PAN Advanced, and Bulk PAN Verification APIs to validate PAN details in real time for customer KYC, lending, merchant onboarding, and compliance workflows for Fintechs and NBFCs.",
      keywords: "PAN Verification API, PAN Validation API, KYC PAN API, PAN Check API, Identity Verification API",
    },
    title: "PAN Verification API",
    desc: "Verify PAN details in real time",
    heroTitle: "PAN Verification API for KYC & Onboarding in India",
    heroSubtitle: "Choose from PAN Lite, PAN Advanced, and Bulk PAN Verification APIs to validate PAN details in real time for customer KYC, lending, merchant onboarding, and compliance workflows.",
    category: "verification",
    icon: FileText,
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
      { title: "Real-Time PAN Validation", desc: "Verify PAN details instantly with structured responses." },
      { title: "High Accuracy Responses", desc: "Returns validated PAN information for reliable identity checks." },
      { title: "Automation Friendly", desc: "Easily integrate into digital onboarding and KYC pipelines." },
      { title: "Scalable Verification", desc: "Designed to support large volumes without performance impact." },
    ],
    whoShouldUse: ["Fintech and financial institutions", "Marketplaces and platforms", "NBFCs and lenders", "Enterprises with KYC requirements"],
    useCases: ["Customer KYC verification", "Merchant and vendor onboarding", "Account opening workflows", "Compliance and due diligence checks"],
    trustAndCompliance: ["Compliance-aligned verification workflows", "Secure API authentication", "Encrypted data transmission", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      // { title: "Sign Up", desc: "Create an account on Connect App.", tip: "Takes less than 2 minutes" },
      // { title: "Submit Documents", desc: "Submit necessary documents for activation.", tip: "KYC docs verified in 24 hours" },
      // { title: "Integrate API", desc: "Integrate PAN Verification API into your system.", tip: "API keys generated instantly" },
      { title: "Go Live", desc: "Start validating PAN details in production.", tip: "Sandbox available for testing" },
    ],
    leadForm: {
      title: "Get PAN Verification API Access",
    },
    faqs: PAN_FAQS,
    inputOutputPreviews: [
      {
        apiName: "PAN Lite",
        description: "Quick PAN validation with match results for basic KYC checks.",
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
          { label: "Aadhaar Seeding Status", value: "Seeded", icon: Fingerprint },
        ],
      },
      {
        apiName: "PAN Advanced",
        description: "Detailed PAN data including holder name, category, and Aadhaar seeding status.",
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
          { label: "Masked Aadhaar", value: "XXXX-XXXX-1234", icon: Fingerprint },
          { label: "Aadhaar Linked?", value: "Yes" },
          { label: "Mobile Number", value: "9876543210", icon: Smartphone },
          { label: "Email", value: "rajesh.kumar@example.com", icon: Mail },
          { label: "Address (Full)", value: "Woodland Heights, Ghatkopar, Mumbai, Maharashtra 400072", icon: MapPin },
        ],
      },
      {
        apiName: "Bulk PAN Verification",
        description: "Verify multiple PANs in a single async batch request for high-volume operations.",
        bestFor: "High-volume PAN verification with async processing",
        docsUrl: "https://developers.eko.in/reference/pan-bulk-verify",
        endpoint: "/pan/bulk",
        inputs: [
          { label: "Entry 1", value: "John (ABCPV1234D)", icon: User },
          { label: "Entry 2", value: "John Doe (ABCPV1234L)", icon: User },
          // { label: "Total Entries", value: "2", icon: Users },
        ],
        outputs: [
          { label: "Status", value: "Processing" },
          { label: "Reference ID", value: "REF123456", icon: Hash },
          { label: "Batch ID", value: "BLK789" },
          { label: "Note", value: "Poll Bulk PAN Verification Status API for results", icon: Info },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: Aadhaar
  // -------------------------------------------------------------------------
  aadhaar: {
    seo: {
      title: "Aadhaar Verification API India | Secure Identity Verification",
      description: "Integrate Aadhaar Verification API to verify identity securely with consent-based, compliance-ready workflows.",
      keywords: "Aadhaar Verification API, Aadhaar KYC API, Identity Verification API, UIDAI Verification API, Digital KYC API",
    },
    title: "Aadhaar Verification API",
    desc: "Verify Aadhaar details securely",
    heroTitle: "Aadhaar Verification API for Secure Digital Identity",
    heroSubtitle: "Verify Aadhaar details through consent-based, real-time verification workflows.",
    category: "verification",
    icon: ShieldCheck,
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
      { title: "Consent-Based Verification", desc: "Aadhaar verification flows designed with user consent at the core." },
      { title: "Real-Time Responses", desc: "Instant verification results with structured response payloads." },
      { title: "Automation Ready", desc: "Seamlessly integrate into digital onboarding and KYC systems." },
      { title: "Scalable Architecture", desc: "Built to handle large verification volumes reliably." },
    ],
    whoShouldUse: ["Fintech companies and lenders", "Banks and NBFCs", "Marketplaces and platforms", "Enterprises with regulated onboarding requirements"],
    useCases: ["Customer KYC onboarding", "User identity verification", "Account opening workflows", "Compliance and due diligence checks"],
    trustAndCompliance: ["Consent-first verification approach", "Secure API authentication", "Encrypted data transmission", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying Aadhaar details in production." },
    ],
    leadForm: {
      title: "Get Aadhaar Verification API Access",
    },
    faqs: [
      { q: "Is Aadhaar verification consent-based?", a: "Yes, all Aadhaar verification flows are designed with explicit user consent at the core, ensuring transparency and compliance." },
      { q: "How fast is the verification?", a: "Verification is real-time with instant results returned in structured response payloads." },
      { q: "Can it handle high volumes?", a: "Yes, the architecture is built to handle large-scale KYC verification volumes reliably." },
      { q: "How do I integrate?", a: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
    ],
    // inputOutputPreview: comingSoonPreview("Aadhaar Verification"),
  },

  // -------------------------------------------------------------------------
  // MARK: Bank Acc
  // -------------------------------------------------------------------------
  bank: {
    seo: {
      title: "Bank Account Verification API India - Penny Drop & IFSC",
      description: "Verify bank account details instantly with Eko's Bank Verification API. Penny drop verification, IFSC validation, and account holder name matching for secure payouts.",
      keywords: "bank account verification API, penny drop API, IFSC validation API, bank verification, account verification, Eko API",
    },
    title: "Bank Account Verification API",
    desc: "Verify bank account details instantly with penny-drop verification",
    heroTitle: "Bank Account Verification",
    heroSubtitle: "Verify bank account details to prevent failed transactions and reduce operational costs. Instant verification with penny-drop and account holder name matching.",
    category: "verification",
    icon: Building2,
    docsUrl: "https://developers.eko.in/reference/bank-account-verification",
    heroImage: bankImg,
    features: [
      { title: "Penny Drop Verification", desc: "Send ₹1 to verify account exists and is active before large payouts.", icon: CreditCard },
      { title: "Account Status Check", desc: "Verify if the account is active, dormant, or closed.", icon: CheckCircle },
      { title: "Name Matching", desc: "Get account holder name for verification against provided details.", icon: FileText },
      { title: "IFSC Validation", desc: "Validate IFSC codes and get bank branch details.", icon: Building },
      { title: "Real-time Results", desc: "Get verification results within seconds for seamless workflows.", icon: Zap },
      { title: "Bulk Verification", desc: "Verify multiple accounts in a single API call for batch processing.", icon: Database },
    ],
    benefits: [
      { title: "Reduce Failed Payouts", desc: "Verify accounts before disbursement to minimize transaction failures and reversals.", icon: CheckCircle },
      { title: "Prevent Fraud", desc: "Match account holder names to prevent payouts to wrong accounts.", icon: Shield },
      { title: "Lower Operational Costs", desc: "Reduce cost of failed transactions, reversals, and manual reconciliation.", icon: CreditCard },
      { title: "Instant Verification", desc: "Real-time results for seamless customer and vendor onboarding.", icon: Zap },
      { title: "All Banks Supported", desc: "Verify accounts across all major banks in India through a single API.", icon: Building },
      { title: "24/7 Availability", desc: "Round-the-clock verification service with 99.9% uptime.", icon: Clock },
    ],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying real bank accounts before payouts." },
    ],
    useCases: ["Salary Disbursement", "Vendor Payments", "Loan Disbursement", "Insurance Claims", "Refund Processing", "Incentive Payouts", "Commission Payments", "E-commerce Seller Onboarding"],
    faqs: [
      { q: "What is penny drop verification?", a: "Penny drop is a method where a small amount (₹1) is transferred to verify the account is active and details are correct. The account holder name is returned for matching." },
      { q: "Do customers receive the ₹1?", a: "Yes, the ₹1 is credited to the verified account. This is a real transaction that confirms the account is active and can receive funds." },
      { q: "How accurate is name matching?", a: "Our intelligent name matching algorithm handles variations, abbreviations, and common spelling differences with 99%+ accuracy." },
      { q: "Which banks are supported?", a: "We support all major banks in India including SBI, HDFC, ICICI, Axis, Kotak, Yes Bank, and 100+ other banks." },
      { q: "What if verification fails?", a: "Failed verifications return specific error codes indicating the reason - invalid account, closed account, incorrect IFSC, etc. - helping you take appropriate action." },
    ],
    inputOutputPreviews: [
      {
        apiName: "Bank Account Verification",
        description: "Verify a bank account number by transferring ₹1 to retrieve the name of the account holder",
        docsUrl: "https://developers.eko.in/reference/bank-account-verification",
        endpoint: "/bank-account-verification",
        inputs: [
          { label: "Account Number", value: "1234567890", icon: Hash },
          // { label: "Bank Name", value: "State Bank of India", icon: Building },
          { label: "IFSC Code", value: "SBIN0001234", icon: Hash },
        ],
        outputs: [
          { label: "Account Status", value: "Valid", icon: CheckCircle },
          { label: "Account Holder Name", value: "Rajesh Kumar", icon: User },
          { label: "Bank", value: "State Bank of India", icon: Building },
          { label: "Branch", value: "MG Road Branch", icon: MapPin },
        ],
      },
      {
        apiName: "Bulk Bank Account Verification",
        description: "Verify multiple bank accounts in a single API call",
        docsUrl: "https://developers.eko.in/reference/bulk-bank-account-verification",
        endpoint: "/bulk-bank-account-verification",
        inputs: [
          { label: "Entry 1", value: "1234567890, SBIN0001234", icon: Hash },
          { label: "Entry 2", value: "9876543210, HDFC0005678", icon: Hash },
          // { label: "Total Entries", value: "2", icon: Users },
        ],
        outputs: [
          { label: "Status", value: "Received", icon: CheckCircle },
          { label: "Reference ID", value: "123456", icon: Hash },
          { label: "Bulk Verification ID", value: "3356655212", icon: Hash },
          { label: "Note", value: "Poll Bulk Bank Account Verification Status API for results", icon: Info },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MARK: GST
  // -------------------------------------------------------------------------
  gst: {
    seo: {
      title: "GST Verification API India | Real-Time GSTIN Validation",
      description: "Integrate GST Verification API to validate GSTIN details instantly for vendor onboarding, compliance, and fraud prevention.",
      keywords: "GST Verification API, GSTIN Verification API, GST Check API, Business Verification API, GST Validation API",
    },
    title: "GST Verification API",
    desc: "Validate GSTIN details instantly",
    heroTitle: "GST Verification API for Business Identity Validation",
    heroSubtitle: "Verify GSTIN details in real time to ensure compliant and trustworthy business onboarding.",
    category: "verification",
    icon: BarChart3,
    docsUrl: "https://developers.eko.in/reference/verify-gstin",
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
      { title: "Real-Time GSTIN Validation", desc: "Verify GST registration details instantly with structured responses." },
      { title: "Business Identity Confirmation", desc: "Validate legal business information before onboarding or payouts." },
      { title: "Automation Ready", desc: "Easily integrate into KYB and compliance pipelines." },
      { title: "High-Volume Support", desc: "Built to handle large verification volumes reliably." },
    ],
    whoShouldUse: ["Marketplaces and B2B platforms", "Fintechs onboarding merchants or vendors", "Enterprises with supplier verification needs", "Compliance-driven organizations"],
    useCases: ["Vendor and supplier onboarding", "Merchant verification for platforms", "Compliance and due diligence checks", "B2B onboarding workflows"],
    trustAndCompliance: ["Secure API authentication", "Encrypted verification communication", "Compliance-aligned data handling", "Audit-ready verification records"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying GSTIN details in production." },
    ],
    leadForm: {
      title: "Get GST Verification API Access",
    },
    faqs: [
      { q: "What details are returned in GST verification?", a: "The API returns GSTIN status, legal business name, trade name, registration date, and compliance filing status." },
      { q: "Can I verify multiple GSTINs?", a: "Yes, the API supports high-volume verification for batch processing needs." },
      { q: "Is the data real-time?", a: "Yes, GSTIN details are verified in real time against official records." },
      { q: "How do I get started?", a: "Sign up on Connect App, submit documents, integrate the REST API, and start verifying." },
    ],
    inputOutputPreviews: [
      {
        apiName: "GST Verification",
        description: "Validate GSTIN details instantly for vendor onboarding and compliance",
        docsUrl: "https://developers.eko.in/reference/verify-gstin",
        endpoint: "/verify-gstin",
        inputs: [
          { label: "GST Number", value: "29ABCDE1234F1Z5", icon: FileText },
          { label: "Business Name", value: "Acme Pvt Ltd", icon: Building },
        ],
        outputs: [
          { label: "GST Status", value: "Active" },
          { label: "Legal Name", value: "Acme Private Limited", icon: Building },
          { label: "Trade Name", value: "Acme Private Limited", icon: Building },
          { label: "Address", value: "123, MG Road, Bangalore", icon: MapPin },
          { label: "Constitution", value: "Private Limited", icon: Building },
          { label: "Nature of Business", value: "Wholesale, Supplier of Services, Recipient of Goods or Services", icon: Briefcase },
          { label: "Taxpayer Type", value: "Regular", icon: User },
          { label: "Registration Date", value: "01/07/2017", icon: Calendar },
          { label: "Update Date", value: "01/02/2022", icon: Calendar },
        ],
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
          { label: "GSTIN List", value: "29ABCDE1234F1Z5 (Maharashtra / Active), 27ABCDE1234F1Z2 (Karnataka / Inactive)", icon: FileText },
        ],
      },
    ],
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
    desc: "Verify UPI IDs and retrieve via phone number",
    heroTitle: "UPI ID Verification API – Verify UPI ID with Ease",
    heroSubtitle: "Validate UPI IDs in real time and retrieve a UPI ID using a phone number to reduce failures and improve payment accuracy.",
    category: "verification",
    icon: Zap,
    docsUrl: "",
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
      { title: "Check UPI ID", desc: "Validate whether a UPI ID is correct and usable before initiating a transfer." },
      { title: "Retrieve UPI ID Using Phone Number", desc: "Fetch associated UPI ID details using a phone number to simplify payee discovery." },
      { title: "Secure, Simple and Robust", desc: "Built for production-grade stability with straightforward integration steps." },
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
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start validating UPI IDs." },
    ],
    leadForm: {
      title: "Get UPI ID Verification API Access",
    },
    faqs: [
      { q: "Can I retrieve a UPI ID using a phone number?", a: "Yes, the API supports fetching associated UPI ID details using a phone number to simplify payee discovery." },
      { q: "How is the API secured?", a: "Every API call is secured with one-time-use tokens generated using asymmetric cryptography." },
      { q: "Is 24×7 support available?", a: "Yes, 24×7 manual integration support is available to help you integrate smoothly." },
      { q: "What use cases does it support?", a: "Pre-payment validation, payout failure reduction, customer onboarding with UPI ID discovery, and assisted agent/retailer payments." },
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
    desc: "Real-time DL validation",
    heroTitle: "Driving License Verification API for Identity Validation",
    heroSubtitle: "Verify driving license details in real time to strengthen KYC and reduce identity fraud.",
    category: "verification",
    icon: Truck,
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
      { title: "Real-Time DL Validation", desc: "Verify driving license details instantly with structured verification responses." },
      { title: "Identity Confirmation", desc: "Use DL data as a trusted identity signal during onboarding." },
      { title: "Automation Ready", desc: "Seamlessly integrates into digital KYC and onboarding pipelines." },
      { title: "High-Volume Support", desc: "Built to handle large verification volumes reliably." },
    ],
    whoShouldUse: ["Fintech and lending platforms", "Mobility and logistics companies", "Marketplaces onboarding drivers or agents", "Enterprises with identity verification needs"],
    useCases: ["Customer identity verification", "KYC onboarding workflows", "Driver or delivery partner onboarding", "Compliance and due diligence checks"],
    trustAndCompliance: ["Secure API authentication", "Encrypted data transmission", "Compliance-aligned verification workflows", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying driving licenses in production." },
    ],
    leadForm: {
      title: "Get Driving License Verification API Access",
    },
    faqs: [
      { q: "How fast is DL verification?", a: "Verification is real-time with instant structured responses for driving license details." },
      { q: "Can I use it for driver onboarding?", a: "Yes, it's ideal for onboarding drivers, delivery partners, and agents requiring identity confirmation." },
      { q: "Does it support high volumes?", a: "Yes, the API is built to handle large verification volumes reliably." },
      { q: "How do I integrate?", a: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
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
  // Vehicle & RC Verification
  // -------------------------------------------------------------------------
  rc: {
    seo: {
      title: "Vehicle & RC Verification API | Registration, Ownership & Insurance Check",
      description: "Verify vehicle registration certificate (RC) details instantly — owner, chassis, engine, insurance, blacklist status, permits, and more. Pan-India coverage via VAHAN.",
      keywords: "Vehicle & RC Verification API, RC Verification API, Vehicle Registration Check API, Vehicle Verification API, RC Validation API, VAHAN API",
    },
    title: "Vehicle & RC Verification API",
    desc: "Complete vehicle registration, ownership & insurance verification",
    heroTitle: "Vehicle & RC Verification API",
    heroSubtitle: "Get complete vehicle information from a registration number — owner details, chassis, engine, insurance status, blacklist check, permits, and more. Pan-India coverage via VAHAN database.",
    category: "verification",
    icon: Truck,
    docsUrl: "https://developers.eko.in/reference/vehicle-rc",
    overview: "The Vehicle & RC Verification API enables businesses to fetch comprehensive vehicle information using a registration number. It returns RC status, owner details, chassis and engine numbers, manufacturer and model, insurance validity, permit details, blacklist and challan status, and more — all in a single API call. Designed for platforms that onboard drivers or vehicles, verify fleet compliance, underwrite motor insurance, or assess vehicle-related risk.",
    keyBenefits: [
      "Complete vehicle details in a single API call",
      "Confirms vehicle ownership and registration status",
      "Returns insurance validity, company, and policy number",
      "Blacklist and challan status check",
      "Permit and fitness certificate details for commercial vehicles",
      "Pan-India coverage via VAHAN database",
    ],
    features: [
      { title: "RC & Vehicle Details", desc: "Get registration status, make/model, chassis, engine, color, body type, fuel type, and manufacturing year." },
      { title: "Owner & Address", desc: "Retrieve owner name, father's name, present and permanent address with structured components." },
      { title: "Insurance Status", desc: "Check insurance company, policy number, and validity — critical for fleet compliance and motor insurance." },
      { title: "Blacklist & Challan Check", desc: "Identify blacklisted vehicles and pending traffic challans for risk assessment." },
      { title: "Permit & Fitness Details", desc: "Verify commercial vehicle permits, fitness certificates, and tax validity." },
      { title: "Financier Information", desc: "Know if the vehicle is under finance and the lending institution — essential for used car and loan platforms." },
    ],
    whoShouldUse: ["Mobility and ride-hailing platforms", "Logistics and delivery companies", "Fleet operators", "Motor insurance companies", "Vehicle finance and lending platforms", "Used car marketplaces"],
    useCases: ["Driver and vehicle onboarding", "Fleet compliance monitoring", "Motor insurance underwriting", "Vehicle finance and loan verification", "Used car marketplace verification", "Logistics and delivery platforms", "Parking and toll management"],
    trustAndCompliance: ["Secure API authentication", "Encrypted verification communication", "Compliance-aligned data handling", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying vehicle registrations in production." },
    ],
    leadForm: {
      title: "Get Vehicle & RC Verification API Access",
    },
    faqs: [
      { q: "What details are returned?", a: "Owner name, RC status, chassis and engine number, manufacturer, model, color, body type, fuel type, registration and expiry dates, insurance company and validity, blacklist status, challan details, permit info, financier, and more — 50+ fields in a single call." },
      { q: "Is pan-India coverage available?", a: "Yes, we cover all states and union territories through integration with the VAHAN national database." },
      { q: "Can I verify commercial vehicles?", a: "Yes, commercial vehicles return additional details like permit type, permit validity, fitness certificate status, national permit, and tax status." },
      { q: "How accurate is the verification?", a: "All verifications are done against official RTO databases (VAHAN), ensuring 100% accuracy of returned data. Updates to vehicle information reflect in the source within 15–30 days." },
      { q: "Is real-time verification available?", a: "Yes, all verifications are performed in real-time with sub-second response times for most queries." },
      { q: "Can I check if a vehicle is blacklisted?", a: "Yes, the API returns blacklist status along with detailed reasons if the vehicle has been blacklisted." },
      { q: "How do I get started?", a: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
    ],
    inputOutputPreview: {
      apiName: "Vehicle & RC Verification",
      inputs: [
        { label: "Vehicle Number", value: "HR26DA8398", icon: Car },
      ],
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
        { label: "Insurance Company", value: "Tata AIG General Insurance", icon: Shield },
        { label: "Insurance Valid Upto", value: "2025", icon: Calendar },
        { label: "Emission Norms", value: "Bharat Stage VI", icon: Leaf },
        { label: "Financier", value: "****** Bank Ltd", icon: Building },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // MARK: DigiLocker
  // -------------------------------------------------------------------------
  digilocker: {
    seo: {
      title: "DigiLocker API | Secure Digital Document Access",
      description: "Integrate DigiLocker API to access and verify user documents securely through consent-based digital workflows.",
      keywords: "DigiLocker API, Digital Document Verification API, Consent Based Document Access, Paperless KYC API, Government Document API",
    },
    title: "DigiLocker API",
    desc: "Secure digital document verification",
    heroTitle: "DigiLocker API for Secure Digital Document Verification",
    heroSubtitle: "Access and verify user documents digitally through consent-driven, paperless workflows.",
    category: "verification",
    icon: FolderCheck,
    docsUrl: "https://developers.eko.in/reference/create-digilocker-url",
    overview: "The DigiLocker API enables businesses to fetch and verify user documents digitally with explicit consent. It eliminates manual document collection, reduces fraud, and accelerates onboarding through trusted digital records.",
    keyBenefits: [
      "Paperless document verification",
      "Consent-based access to user documents",
      "Faster onboarding and KYC completion",
      "Reduced document fraud and forgery risk",
      "Improved user experience",
    ],
    features: [
      { title: "Consent-Based Document Access", desc: "Fetch documents only after explicit user consent, ensuring transparency and trust." },
      { title: "Digital Document Retrieval", desc: "Access verified digital documents without physical copies." },
      { title: "Automation Ready", desc: "Integrates seamlessly into digital onboarding and compliance systems." },
      { title: "Scalable Architecture", desc: "Designed to handle high-volume document access reliably." },
    ],
    whoShouldUse: ["Banks and NBFCs", "Fintech and lending platforms", "Enterprises with digital onboarding", "Platforms requiring document verification"],
    useCases: ["Digital KYC and onboarding", "Loan and credit processing", "Customer identity verification", "Compliance and due diligence workflows"],
    trustAndCompliance: ["Consent-first data access", "Secure API authentication", "Encrypted document transmission", "Audit-ready access logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start accessing digital documents in production." },
    ],
    leadForm: {
      title: "Get DigiLocker API Access",
    },
    faqs: [
      { q: "Is DigiLocker access consent-based?", a: "Yes, documents are fetched only after explicit user consent, ensuring full transparency." },
      { q: "What documents can be accessed?", a: "You can access government-issued digital documents like Aadhaar, PAN, driving license, and more through DigiLocker." },
      { q: "Does it eliminate physical document collection?", a: "Yes, the API enables fully paperless document verification, eliminating manual collection." },
      { q: "How do I integrate?", a: "Sign up on Connect App, submit documents, integrate the REST API, and go live." },
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
    desc: "Digital employee identity verification",
    heroTitle: "Employee Verification API for Trusted Workforce Onboarding",
    heroSubtitle: "Verify employee identity and details digitally to reduce hiring risk and ensure compliance.",
    category: "verification",
    icon: Briefcase,
    docsUrl: "https://developers.eko.in/reference/advance-employment",
    overview: "The Employee Verification API enables organizations to verify employee identity and related details digitally during hiring and onboarding. It is designed to reduce hiring risk, improve compliance, and streamline workforce verification workflows.",
    keyBenefits: [
      "Digital employee verification",
      "Reduced hiring and impersonation risk",
      "Faster onboarding cycles",
      "Automation-ready HR workflows",
      "Scalable for large hiring volumes",
    ],
    features: [
      { title: "Employee Identity Verification", desc: "Verify employee identity details digitally as part of onboarding." },
      { title: "Hiring Risk Reduction", desc: "Detect inconsistencies early to reduce impersonation and compliance risk." },
      { title: "Automation Friendly", desc: "Integrates seamlessly into HRMS, ATS, and onboarding platforms." },
      { title: "High-Volume Support", desc: "Designed to support large-scale hiring and verification needs." },
    ],
    whoShouldUse: ["Enterprises and large employers", "HR tech platforms", "Gig economy and staffing companies", "Organizations with compliance-driven hiring"],
    useCases: ["Pre-employment verification", "Contractor and gig worker onboarding", "Workforce compliance checks", "Enterprise HR verification workflows"],
    trustAndCompliance: ["Secure API authentication", "Encrypted data transmission", "Compliance-aligned verification workflows", "Audit-ready verification logs"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start verifying employees in production." },
    ],
    leadForm: {
      title: "Get Employee Verification API Access",
    },
    faqs: [
      { q: "What can be verified?", a: "Employee identity details including name, ID documents, and related information can be verified digitally." },
      { q: "Does it integrate with HRMS?", a: "Yes, the API integrates seamlessly into HRMS, ATS, and onboarding platforms." },
      { q: "Can it handle large hiring volumes?", a: "Yes, the API is designed to support large-scale hiring and verification needs." },
      { q: "How do I get started?", a: "Sign up on Connect App, submit documents, integrate the REST API, and start verifying." },
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
        { label: "EPFO Details…", value: "PF Filing?, Name Unique?, …", icon: Info },
        { label: "Employer Info…", value: "Name, Setup Date, PF Filing Details, …", icon: Info },
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
    desc: "Convert coordinates to addresses",
    heroTitle: "Reverse Geocoding API for Location-Based Verification",
    heroSubtitle: "Convert geo-coordinates into precise address data to strengthen verification and compliance workflows.",
    category: "verification",
    icon: Globe,
    docsUrl: "https://developers.eko.in/reference/reverse-geocoding",
    overview: "The Reverse Geocoding API enables businesses to translate latitude and longitude coordinates into structured address information. It is designed for address validation, geo-compliance checks, and location-based risk assessment.",
    keyBenefits: [
      "Accurate latitude-to-address conversion",
      "Improves address and location verification",
      "Supports geo-compliance and risk checks",
      "Automation-ready for digital workflows",
      "Scales for high-volume location lookups",
    ],
    features: [
      { title: "Coordinate to Address Resolution", desc: "Convert latitude and longitude into structured, readable address data." },
      { title: "Location Accuracy", desc: "Helps validate whether users or devices are operating from expected locations." },
      { title: "Automation Friendly", desc: "Integrates easily into onboarding, verification, and monitoring systems." },
      { title: "High-Volume Ready", desc: "Designed to handle frequent and large-scale geolocation queries." },
    ],
    whoShouldUse: ["Fintechs and regulated platforms", "Enterprises verifying customer locations", "Field service and agent-based operations", "Platforms performing geo-risk analysis"],
    useCases: ["Address verification during onboarding", "Geo-compliance and location validation", "Fraud detection and risk assessment", "Field agent or device location checks"],
    trustAndCompliance: ["Secure API authentication", "Encrypted request and response handling", "Compliance-aligned data processing", "Audit-ready lookup records"],
    integrationSteps: [
      ...VERIFICATION_STEPS_BASE,
      { title: "Go Live", desc: "Start resolving addresses in production." },
    ],
    leadForm: {
      title: "Get Reverse Geocoding API Access",
    },
    faqs: [
      { q: "How accurate is the address returned?", a: "Accuracy depends on GPS precision. With standard coordinates, we return correct locality, city, and pincode." },
      { q: "What address components are returned?", a: "We return formatted address, area/locality, city, district, state, pincode, and country." },
      { q: "Can I use this for fraud detection?", a: "Yes, you can cross-check customer-provided addresses against GPS-derived addresses for fraud prevention." },
      { q: "What is the rate limit?", a: "Rate limits depend on your plan. Contact us for higher throughput requirements." },
    ],
    inputOutputPreview: {
      apiName: "Reverse Geocoding",
      inputs: [
        { label: "Latitude", value: "19.0760", icon: MapPin },
        { label: "Longitude", value: "72.8777", icon: MapPin },
      ],
      outputs: [
        { label: "Address", value: "6/B Mahatyagi Road, Chhatrapati Shivaji Terminus", icon: MapPin },
        { label: "City", value: "Mumbai", icon: MapPin },
        { label: "State", value: "Maharashtra", icon: MapPin },
        { label: "PIN Code", value: "400001", icon: MapPin },
        { label: "Country", value: "India", icon: MapPin },
        { label: "State Code", value: "MH", icon: MapPin },
        { label: "Country Code", value: "IN", icon: MapPin },
      ],
    },
  },
};

// Suppress unused-variable warnings for icons that are imported but only used
// inside object literals (TypeScript sees them as referenced).
void (Banknote as LucideIcon);
