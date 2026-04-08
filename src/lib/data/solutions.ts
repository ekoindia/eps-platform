import type { LucideIcon } from "lucide-react";
import {
  Banknote, Fingerprint, Receipt, Wallet, MessageSquare, Phone,
  CheckCircle, FileText, Users, Building2, Store, Truck,
  ShieldCheck, Layers, BarChart3, Briefcase, Globe,
} from "lucide-react";

export interface PackApiItem {
  /** references API_PRODUCTS_MAP key */
  apiId: string;
  name: string;
  icon: LucideIcon;
  what: string;
  why: string;
  href: string;
}

export interface HowItWorksStep {
  step: number;
  label: string;
  apiId?: string;
}

export interface ComparisonRow {
  aspect: string;
  diy: string;
  eko: string;
}

export interface SolutionFAQ {
  question: string;
  answer: string;
}

export interface RelatedSolution {
  slug: string;
  name: string;
  tagline: string;
}

export interface SolutionData {
  slug: string;
  name: string;
  eyebrow: string;
  heroSubtitle: string;
  apiChips: { name: string; apiId?: string; href?: string }[];
  trustStrip: string[];
  jobStatement: string;
  packApis: PackApiItem[];
  howItWorksSteps: HowItWorksStep[];
  industriesUsingSlugs: string[];
  exampleCode: { language: string; fileName: string; code: string }[];
  comparisonRows: ComparisonRow[];
  pricingBlurb: string;
  faqs: SolutionFAQ[];
  relatedSolutions: RelatedSolution[];
  seo: { title: string; description: string; keywords: string };
  /** Short description for cards / nav */
  tagline: string;
  navDescription: string;
  icon: LucideIcon;
  category: "lending-credit" | "onboarding" | "agent-banking" | "hr-workforce" | "fleet-motor";
}

/* ─────────────────────────────────────────────────────────────── */
/*  SOLUTIONS DATA                                                  */
/* ─────────────────────────────────────────────────────────────── */

export const SOLUTIONS_LIST: SolutionData[] = [
  /* ── 1. Assisted Banking Agent Pack ─────────────────────────── */
  {
    slug: "assisted-banking-agent-pack",
    name: "Assisted Banking Agent Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Turn any kirana, CSP, or retail counter into a complete banking touchpoint — cash withdrawal, money transfer, bill payments, and wallet services in one integrated bundle.",
    tagline: "AePS + DMT + BBPS for kirana & CSP networks",
    navDescription: "Turn any retail counter into a banking touchpoint",
    icon: Store,
    category: "agent-banking",
    apiChips: [
      { name: "AePS Cashout", apiId: "aeps", href: "/products/aeps-api" },
      { name: "DMT", apiId: "dmt", href: "/products/dmt-api" },
      { name: "BBPS", apiId: "bbps", href: "/products/bbps-api" },
      { name: "PPI DigiKhata", href: "#" },
      { name: "Mobile OTP" },
      { name: "SMS" },
    ],
    trustStrip: [
      "Powering 200K+ agent touchpoints",
      // "1.5 Cr+ transactions/month",
      "NPCI & RBI compliant",
      "99.9% uptime",
    ],
    jobStatement:
      "Enable any retailer in India to offer assisted banking services to walk-in customers — biometric cash withdrawal, instant money transfer, utility bill payments, and prepaid wallets — from a single integration. No bank branch required.",
    packApis: [
      {
        apiId: "aeps",
        name: "AePS Cashout",
        icon: Fingerprint,
        what: "Aadhaar-authenticated biometric cash withdrawal at agent points via FingPay & FINO gateways.",
        why: "The core service that turns a retail counter into a micro-ATM. Serves the 200–300 million Indians who can't use UPI or mobile banking.",
        href: "/products/aeps-api",
      },
      {
        apiId: "dmt",
        name: "Domestic Money Transfer (DMT)",
        icon: Banknote,
        what: "Cash-to-bank-account remittance via IMPS/NEFT under RBI's BC model.",
        why: "Lets agents accept cash from migrant workers and transfer it to family bank accounts in real time. Pairs with AePS to complete the urban-to-rural remittance loop.",
        href: "/products/dmt-api",
      },
      {
        apiId: "bbps",
        name: "Bill Payment (BBPS / Bharat Connect)",
        icon: Receipt,
        what: "Pay 25+ biller categories — electricity, gas, DTH, broadband, EMI, insurance — through a single integration.",
        why: "Drives footfall and frequency. Bills are paid every month, so customers come back every month.",
        href: "/products/bbps-api",
      },
      {
        apiId: "ppi",
        name: "PPI DigiKhata (Prepaid Wallet)",
        icon: Wallet,
        what: "Issue and manage RBI-compliant prepaid wallets for end customers.",
        why: "Lets agents onboard customers into a digital wallet, opening up gift cards, loyalty, and recurring payments.",
        href: "#",
      },
      {
        apiId: "otp",
        name: "Mobile OTP",
        icon: Phone,
        what: "Send and verify OTPs across telecom networks.",
        why: "Required for daily agent authentication, customer verification, and transaction confirmation.",
        href: "#",
      },
      {
        apiId: "sms",
        name: "Send SMS",
        icon: MessageSquare,
        what: "Transactional SMS delivery for receipts, alerts, and notifications.",
        why: "Every transaction generates a customer receipt — critical for trust and dispute resolution in cash-handling environments.",
        href: "#",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Customer walks into agent shop" },
      { step: 2, label: "Agent identifies service: Withdraw / Send / Pay Bill" },
      { step: 3, label: "AePS: Aadhaar + biometric → instant cash; DMT: Beneficiary + amount → instant transfer; BBPS: Biller + customer ID → bill paid" },
      { step: 4, label: "Customer gets SMS receipt" },
      { step: 5, label: "Agent earns commission, settled to wallet" },
    ],
    industriesUsingSlugs: ["kirana-retail", "agent-networks-csp", "microfinance", "agriculture"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "agent-banking.js",
        code: `// Initialize Eko API Client
const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// 1. Authenticate the agent (daily)
await eko.aeps.dailyAuth({ agentId: "AGT123" });

// 2. Customer cash withdrawal
const withdrawal = await eko.aeps.cashout({
  aadhaar: "XXXX-XXXX-1234",
  bankIin: "607094",   // Bank IIN code
  amount: 5000,
  biometricData: fingerprintTemplate
});

console.log(withdrawal.status);     // "success"
console.log(withdrawal.balance);    // "2450.50"
console.log(withdrawal.commission); // "12"`,
      },
      {
        language: "bash",
        fileName: "curl-example.sh",
        code: `curl -X POST https://api.eko.in/v3/aeps/cashout \\
  -H "Authorization: Bearer $EKO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "AGT123",
    "aadhaar_number": "XXXXXXXXXXXX",
    "bank_iin": "607094",
    "amount": 5000,
    "biometric_data": "<FMR_DATA>"
  }'`,
      },
    ],
    comparisonRows: [
      { aspect: "Vendor contracts", diy: "4–6 separate vendors", eko: "1 contract" },
      { aspect: "BC license", diy: "Apply separately, 6+ months", eko: "Eko is the BCNM — included" },
      { aspect: "AePS gateway", diy: "Direct NPCI relationship needed", eko: "FingPay + FINO dual-gateway included" },
      { aspect: "Compliance (RBI ATO, NPCI OC 88/91)", diy: "Your team's burden", eko: "Built into the platform" },
      { aspect: "Time to first transaction", diy: "6–9 months", eko: "7–14 days" },
      { aspect: "Biometric device support", diy: "DIY integration", eko: "5 STQC-certified models pre-integrated" },
    ],
    pricingBlurb:
      "Pay-per-transaction. No setup fee. Sandbox is free. Agents earn ₹2–25 per transaction depending on service and amount. Eko shares interchange revenue with you under a transparent multi-tier structure. Volume discounts kick in at 10,000+ monthly transactions.",
    faqs: [
      { question: "How long does AePS agent activation take?", answer: "Agent activation typically takes 24–48 hours after KYC submission. The sandbox environment is available immediately upon signup." },
      { question: "Which biometric devices does Eko support?", answer: "Eko supports 5 STQC-certified biometric devices including Mantra MFS100, Morpho MSO1300, and Startek FM220U, among others." },
      { question: "What's the daily AePS withdrawal limit per customer?", answer: "Per NPCI guidelines, the daily AePS withdrawal limit is ₹10,000 per customer per bank account. Multiple bank accounts can be used in a single day." },
      { question: "How does Eko's dual-gateway (FingPay + FINO) improve success rates?", answer: "When one gateway experiences downtime or congestion, the system automatically routes to the other, maintaining high transaction success rates even during peak periods." },
      { question: "Can I white-label this entire stack under my own brand?", answer: "Yes. Eko offers full white-labeling options. Your branding on the agent app, receipts, and customer-facing touchpoints. Contact our sales team for licensing details." },
      { question: "Do agents need a BC license individually?", answer: "No. Under Eko's BCNM (Business Correspondent Network Manager) license, individual agents operate as sub-agents of Eko. They need to complete Eko's onboarding and KYC process." },
      { question: "How does commission settlement work?", answer: "Agent commissions are settled daily to their registered bank accounts or Eko wallet. The settlement cycle is T+1 for most transaction types." },
    ],
    relatedSolutions: [
      { slug: "rural-financial-services-pack", name: "Rural Financial Services Pack", tagline: "Lighter version with PAN Lite + Bank Verification add-ons" },
      { slug: "migrant-remittance-hub-pack", name: "Migrant Remittance Hub Pack", tagline: "Optimized for urban migrant corridors" },
      { slug: "mfi-field-operations-pack", name: "MFI Field Operations Pack", tagline: "For microfinance field collection & disbursals" },
    ],
    seo: {
      title: "Assisted Banking Agent Pack — AePS, DMT, BBPS | Eko",
      description: "Turn kirana stores & CSP agents into banking touchpoints. AePS biometric withdrawal + DMT remittance + BBPS bill payment in one integrated bundle. RBI & NPCI compliant.",
      keywords: "aeps dmt bbps bundle, agent banking api bundle india, white label bc api, csp api platform, kirana banking api",
    },
  },

  /* ── 2. Lending KYC Pack ─────────────────────────────────────── */
  {
    slug: "lending-kyc-pack",
    name: "Lending KYC Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Everything a digital lender needs to onboard, verify, and disburse — in one bundle.",
    tagline: "Onboard borrowers in under 90 seconds",
    navDescription: "KYC + bank verification + disbursal for digital lenders",
    icon: Banknote,
    category: "lending-credit",
    apiChips: [
      { name: "PAN Advanced", apiId: "pan", href: "/products/pan-verification-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "DigiLocker", apiId: "digilocker", href: "/products/digilocker-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
      { name: "GST Verification", apiId: "gst", href: "/products/gst-verification-api" },
      { name: "Fund Transfer", apiId: "upi-payout", href: "/products/upi-payout-api" },
    ],
    trustStrip: [
      // "Used by 200+ lenders",
      "RBI Digital Lending compliant",
      "99.9% uptime",
    ],
    jobStatement:
      "Onboard a digital loan applicant in under 90 seconds with verified identity, income, and a payout-ready bank account.",
    packApis: [
      {
        apiId: "pan",
        name: "PAN Verification (Advanced)",
        icon: FileText,
        what: "Fetch full borrower identity including name, DOB, and PAN status in <2 seconds.",
        why: "The first verification in every lending journey — confirms identity and links to income data.",
        href: "/products/pan-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification (Penny Drop)",
        icon: Building2,
        what: "Confirm the borrower's bank account is active and the name matches.",
        why: "RBI Digital Lending Directions require verified bank accounts before disbursal. Penny drop is the industry standard.",
        href: "/products/bank-verification-api",
      },
      {
        apiId: "digilocker",
        name: "DigiLocker",
        icon: Layers,
        what: "Pull Aadhaar, driving licence, and ITR documents paperlessly via DIPP integration.",
        why: "Eliminates document upload friction — borrower consents once and all docs are fetched automatically.",
        href: "/products/digilocker-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Verify address and identity using Aadhaar number + OTP.",
        why: "Adds a biometric-linked identity layer on top of PAN — the combination prevents most synthetic identity fraud.",
        href: "/products/aadhaar-verification-api",
      },
      {
        apiId: "gst",
        name: "GST Verification",
        icon: BarChart3,
        what: "Validate GSTIN and pull filing patterns as a cash-flow proxy.",
        why: "For MSME borrowers with no credit score, GST filing history is the most reliable income signal.",
        href: "/products/gst-verification-api",
      },
      {
        apiId: "upi-payout",
        name: "Fund Transfer (UPI/IMPS/NEFT)",
        icon: Banknote,
        what: "Disburse loans instantly to the verified bank account.",
        why: "Closes the loop — once all verifications pass, the disbursal fires automatically in the same workflow.",
        href: "/products/upi-payout-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Mobile OTP — authenticate borrower" },
      { step: 2, label: "PAN Advanced — fetch identity & status", apiId: "pan" },
      { step: 3, label: "DigiLocker — pull Aadhaar & ITR paperlessly", apiId: "digilocker" },
      { step: 4, label: "Bank Account Verification — penny-drop confirmation", apiId: "bank" },
      { step: 5, label: "GST Verification — income & cash-flow assessment", apiId: "gst" },
      { step: 6, label: "Fund Transfer — instant disbursal to verified account", apiId: "upi-payout" },
    ],
    industriesUsingSlugs: ["lending-nbfc", "microfinance", "saas-platforms", "marketplaces"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "lending-kyc.js",
        code: `// Initialize Eko API Client
const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// 1. Verify PAN identity
const pan = await eko.verify.pan({
  panNumber: "ABCDE1234F",
  fullName: "Rajesh Kumar"
});

// 2. Verify bank account (penny drop)
const bank = await eko.verify.bankAccount({
  accountNumber: "1234567890",
  ifsc: "HDFC0001234",
  name: pan.name   // cross-match name
});

// 3. Disburse loan if all checks pass
if (pan.verified && bank.verified) {
  const disbursal = await eko.payments.transfer({
    accountNumber: bank.accountNumber,
    ifsc: bank.ifsc,
    amount: 50000,
    purpose: "loan_disbursal"
  });
  console.log(disbursal.transactionId);
}`,
      },
      {
        language: "bash",
        fileName: "curl-pan.sh",
        code: `# Step 1: Verify PAN
curl -X POST https://api.eko.in/v3/verify/pan \\
  -H "Authorization: Bearer $EKO_API_KEY" \\
  -d '{"pan_number":"ABCDE1234F","full_name":"Rajesh Kumar"}'

# Step 2: Verify bank account
curl -X POST https://api.eko.in/v3/verify/bank-account \\
  -H "Authorization: Bearer $EKO_API_KEY" \\
  -d '{"account_number":"1234567890","ifsc":"HDFC0001234"}'`,
      },
    ],
    comparisonRows: [
      { aspect: "Vendor contracts", diy: "3–5 separate KYC vendors", eko: "1 contract" },
      { aspect: "RBI Digital Lending compliance", diy: "Build & maintain yourself", eko: "Compliant by default" },
      { aspect: "Name-match across sources", diy: "Custom ML model required", eko: "Built-in cross-document matching" },
      { aspect: "Disbursal integration", diy: "Separate payment gateway contract", eko: "Same platform, same dashboard" },
      { aspect: "Sandbox testing", diy: "Prod credentials only from vendors", eko: "Full sandbox on day 1" },
      { aspect: "Time to integrate", diy: "3–6 months", eko: "1–3 days" },
    ],
    pricingBlurb:
      "Pay-per-verification. No setup fee. Sandbox is free. Volume discounts available at 10,000+ monthly verifications. Single invoice, single dashboard — no multi-vendor billing.",
    faqs: [
      { question: "Is Eko's Fund Transfer API compliant with RBI Digital Lending Directions?", answer: "Yes. Eko's fund transfer API is designed for direct RE-to-borrower disbursals, with full audit trails meeting RBI Digital Lending Direction requirements on traceability and direct credit." },
      { question: "Can I bulk-verify 50,000 borrowers in a single batch?", answer: "Yes. The Lending KYC Pack supports bulk PAN and bank account verification via asynchronous batch APIs with webhook notifications on completion. Typical batch of 50,000 completes in 2–4 hours." },
      { question: "How does Eko's name matching handle regional name variations?", answer: "Our name-match engine uses fuzzy matching with regional transliteration support, handling variations across Hindi, Tamil, Telugu, Kannada, and Bengali name structures." },
      { question: "What's the typical sandbox-to-production timeline for an NBFC?", answer: "Most NBFCs complete sandbox testing in 1–3 days and go live in 5–7 business days after NBFC-specific KYC documentation is submitted." },
      { question: "Do you support co-lending portfolio reconciliation?", answer: "Yes. Our bulk verification APIs support portfolio-level reconciliation, with the Co-lending Compliance Pack providing additional batch tools for NBFC-bank co-lending workflows." },
      { question: "Is there a minimum monthly transaction commitment?", answer: "No minimum commitment for the sandbox. Production accounts have no mandatory minimum, though volume pricing tiers start at 1,000 monthly API calls." },
    ],
    relatedSolutions: [
      { slug: "msme-credit-assessment-pack", name: "MSME Credit Assessment Pack", tagline: "Assess MSME creditworthiness via GST + ITR patterns" },
      { slug: "merchant-onboarding-pack", name: "Merchant Onboarding Pack", tagline: "KYB + payment setup for merchants & sellers" },
      { slug: "mfi-field-operations-pack", name: "MFI Field Operations Pack", tagline: "Field collection & disbursal for microfinance" },
    ],
    seo: {
      title: "Lending KYC Pack — Digital Lending API Bundle | Eko",
      description: "RBI-compliant API stack for digital lenders in India. PAN, bank, DigiLocker, instant disbursal, BBPS collection. Sandbox in minutes. Trusted by 200+ lenders.",
      keywords: "lending kyc api bundle india, digital lending kyc package, nbfc kyc api stack, kyc api for lending",
    },
  },

  /* ── 3. Merchant Onboarding Pack ────────────────────────────── */
  {
    slug: "merchant-onboarding-pack",
    name: "Merchant Onboarding Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Verify, onboard, and activate merchants and sellers with a pre-built KYB workflow — PAN, GST, bank, and business checks in one bundle.",
    tagline: "KYB + payment activation for merchants & sellers",
    navDescription: "Onboard merchants with KYB checks in hours, not days",
    icon: Briefcase,
    category: "onboarding",
    apiChips: [
      { name: "PAN Verification", apiId: "pan", href: "/products/pan-verification-api" },
      { name: "GST Verification", apiId: "gst", href: "/products/gst-verification-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
    ],
    trustStrip: [
      // "Used by 500+ marketplaces",
      "ONDC seller-ready",
      "RBI compliant",
      "99.9% uptime"
    ],
    jobStatement:
      "Verify a merchant's identity, business, and bank account — and activate them for payments — in under 10 minutes, with zero manual document review.",
    packApis: [
      {
        apiId: "pan",
        name: "PAN Verification",
        icon: FileText,
        what: "Verify the merchant proprietor's or director's PAN and fetch identity details.",
        why: "First step in any KYB flow — confirms who owns the business before verifying the business itself.",
        href: "/products/pan-verification-api",
      },
      {
        apiId: "gst",
        name: "GST Verification",
        icon: BarChart3,
        what: "Validate GSTIN and fetch business name, address, and filing status.",
        why: "GST number is the fastest way to verify a business's existence, category, and compliance standing.",
        href: "/products/gst-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Verification (Penny Drop)",
        icon: Building2,
        what: "Confirm the merchant's settlement bank account is active and the name matches.",
        why: "Required before activating payment settlements — prevents fraudulent account substitution.",
        href: "/products/bank-verification-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Verify the merchant's identity with Aadhaar OTP for sole proprietors.",
        why: "Adds biometric-linked identity for unregistered merchants and sole proprietors who may not have GST.",
        href: "/products/aadhaar-verification-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Merchant enters mobile number — OTP authentication" },
      { step: 2, label: "PAN Verification — confirm proprietor identity" },
      { step: 3, label: "GST Verification — validate business & filing status" },
      { step: 4, label: "Bank Account Verification — penny-drop settlement account" },
      { step: 5, label: "Merchant activated for payments — instant settlement configured" },
    ],
    industriesUsingSlugs: ["marketplaces", "e-commerce", "saas-platforms", "accounting-tax"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "merchant-onboarding.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// 1. Verify business PAN
const pan = await eko.verify.pan({
  panNumber: "AABCS1234C",
  fullName: "Sharma Traders"
});

// 2. Verify GST number
const gst = await eko.verify.gstin({
  gstin: "07AABCS1234C1Z5"
});

// 3. Validate settlement bank account
const bank = await eko.verify.bankAccount({
  accountNumber: "9876543210",
  ifsc: "SBIN0001234"
});

console.log({ pan: pan.verified, gst: gst.status, bank: bank.verified });`,
      },
    ],
    comparisonRows: [
      { aspect: "KYB checks", diy: "3–4 vendor integrations", eko: "1 bundle" },
      { aspect: "ONDC compliance", diy: "Custom implementation", eko: "Pre-certified" },
      { aspect: "Rejection handling", diy: "Build retry workflows", eko: "Built-in fallback checks" },
      { aspect: "Time to live merchant", diy: "2–5 days manual review", eko: "Under 10 minutes" },
    ],
    pricingBlurb: "Pay-per-verification. No setup fee. Sandbox is free. Volume pricing available for 10,000+ monthly onboardings.",
    faqs: [
      { question: "Does this pack work for ONDC seller onboarding?", answer: "Yes. The Merchant Onboarding Pack is pre-validated for ONDC seller KYB requirements including GST validation, PAN verification, and bank account confirmation." },
      { question: "Can I onboard unregistered merchants without GST?", answer: "Yes. For sole proprietors without GST, the pack falls back to PAN + Aadhaar verification for identity and the bank verification for payment activation." },
      { question: "How fast is the penny-drop bank verification?", answer: "Real-time, typically under 3 seconds. The API returns account holder name and active status in the same call." },
      { question: "Is there directory lookup for business type?", answer: "GST verification returns business type (proprietor, partnership, LLP, etc.), registration date, and address — no separate MCA lookup needed for most cases." },
    ],
    relatedSolutions: [
      { slug: "lending-kyc-pack", name: "Lending KYC Pack", tagline: "Full KYC for borrower onboarding & disbursal" },
      { slug: "employee-bgv-pack", name: "Employee BGV Pack", tagline: "Instant background verification for employees" },
    ],
    seo: {
      title: "Merchant Onboarding Pack — KYB API Bundle | Eko",
      description: "Verify and activate merchants instantly. PAN, GST, bank verification in one bundle. ONDC seller-ready, RBI compliant. Used by 500+ marketplaces in India.",
      keywords: "merchant onboarding api india, kyb api india, payment aggregator merchant onboarding, ondc seller verification",
    },
  },

  /* ── 4. MSME Credit Assessment Pack ─────────────────────────── */
  {
    slug: "msme-credit-assessment-pack",
    name: "MSME Credit Assessment Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Assess MSME creditworthiness using GST filing patterns, ITR history, and bank account validation — no traditional credit score required.",
    tagline: "Assess MSME credit via GST + ITR — no credit score needed",
    navDescription: "Alternative credit scoring for MSMEs via GST & ITR data",
    icon: BarChart3,
    category: "lending-credit",
    apiChips: [
      { name: "GST Verification", apiId: "gst", href: "/products/gst-verification-api" },
      { name: "PAN Advanced", apiId: "pan", href: "/products/pan-verification-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "DigiLocker", apiId: "digilocker", href: "/products/digilocker-api" },
    ],
    trustStrip: [
      "Used by new-age NBFCs",
      // "No credit bureau dependency",
      "RBI compliant",
      "99.9% uptime"
    ],
    jobStatement: "Assess an MSME's creditworthiness in minutes using GST filing patterns, ITR history, and bank validation — enabling lending to 63 million underserved businesses with no credit history.",
    packApis: [
      {
        apiId: "gst",
        name: "GST Verification & Filing History",
        icon: BarChart3,
        what: "Fetch GSTIN details, filing patterns, and turnover trends across quarters.",
        why: "GST compliance patterns are the best proxy for MSME cash flow — replacing the monthly bank statement request with an automated data pull.",
        href: "/products/gst-verification-api",
      },
      {
        apiId: "pan",
        name: "PAN Verification (Advanced)",
        icon: FileText,
        what: "Fetch promoter identity, PAN category, and cross-link to business PAN.",
        why: "Links the business identity to the promoter — essential for sole proprietors and personal-guarantee lending.",
        href: "/products/pan-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification",
        icon: Building2,
        what: "Validate the MSME's primary operating account via penny drop.",
        why: "Confirms the settlement account exists and the business name matches — prevents mule account disbursals.",
        href: "/products/bank-verification-api",
      },
      {
        apiId: "digilocker",
        name: "DigiLocker (ITR Documents)",
        icon: Layers,
        what: "Fetch ITR-V and Form-26AS documents directly from the borrower's DigiLocker.",
        why: "Provides verified income history without relying on self-submitted PDFs — eliminates document forgery risk.",
        href: "/products/digilocker-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "MSME enters GSTIN — system fetches 8 quarters of filing data" },
      { step: 2, label: "PAN verification — link promoter identity to business" },
      { step: 3, label: "DigiLocker — pull ITR-V & Form-26AS" },
      { step: 4, label: "Bank Account Verification — validate operating account" },
      { step: 5, label: "Credit model scores the MSME — loan offer generated" },
    ],
    industriesUsingSlugs: ["lending-nbfc", "microfinance", "saas-platforms"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "msme-credit.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// 1. Fetch GST filing history (8 quarters)
const gst = await eko.verify.gstin({
  gstin: "07AABCS1234C1Z5",
  includeFilingHistory: true
});

// 2. Calculate GST-based cash flow proxy
const avgMonthlyTurnover = gst.filings
  .map(f => f.taxableValue)
  .reduce((a, b) => a + b, 0) / gst.filings.length;

console.log({ avgMonthlyTurnover, filingConsistency: gst.complianceScore });`,
      },
    ],
    comparisonRows: [
      { aspect: "Credit bureau dependency", diy: "Bureau subscription + integration", eko: "Bureau-free alternative scoring" },
      { aspect: "MSME data sources", diy: "Manual ITR & bank statements", eko: "Automated GST + DigiLocker pull" },
      { aspect: "Decision speed", diy: "2–5 days manual underwriting", eko: "Minutes" },
    ],
    pricingBlurb: "Pay-per-assessment. No setup fee. Sandbox is free.",
    faqs: [
      { question: "How many quarters of GST data can I access?", answer: "Eko's GST verification API provides up to 12 quarters of filing history including return filing status, taxable value trends, and compliance score." },
      { question: "Does this work for MSMEs with turnover below GST threshold?", answer: "For MSMEs below the ₹40 lakh GST threshold, the pack falls back to Aadhaar + PAN + bank statement via DigiLocker." },
    ],
    relatedSolutions: [
      { slug: "lending-kyc-pack", name: "Lending KYC Pack", tagline: "Full KYC for borrower onboarding & disbursal" },
      { slug: "merchant-onboarding-pack", name: "Merchant Onboarding Pack", tagline: "KYB + payment activation for merchants" },
    ],
    seo: {
      title: "MSME Credit Assessment Pack | Eko Platform Services",
      description: "Assess MSME creditworthiness using GST filing patterns and ITR — no credit bureau needed. Lend to 63 million underserved businesses. RBI compliant.",
      keywords: "msme credit assessment api, gst based lending india, alternative credit scoring msme, nbfc msme api",
    },
  },

  /* ── 5. MFI Field Operations Pack ───────────────────────────── */
  {
    slug: "mfi-field-operations-pack",
    name: "MFI Field Operations Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Digital tools for microfinance field officers — paperless KYC, biometric collections, and instant disbursals for JLG and SHG lending models.",
    tagline: "Paperless KYC & biometric collections for MFIs",
    navDescription: "Replace cash collection with digital ops for microfinance",
    icon: Users,
    category: "agent-banking",
    apiChips: [
      { name: "AePS Cashout", apiId: "aeps", href: "/products/aeps-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
      { name: "Fund Transfer", apiId: "upi-payout", href: "/products/upi-payout-api" },
      { name: "DigiLocker", apiId: "digilocker", href: "/products/digilocker-api" },
    ],
    trustStrip: [
      // "Used by 50+ MFIs",
      // "JLG & SHG ready",
      // "NaBFID & RBI compliant"
      "RBI compliant",
      // "NaBFID aligned",
      "99.9% uptime"
    ],
    jobStatement: "Enable MFI field officers to collect repayments biometrically, disburse loans directly to borrower accounts, and complete KYC paperlessly — all from a mobile device in the field.",
    packApis: [
      {
        apiId: "aeps",
        name: "AePS Cashout",
        icon: Fingerprint,
        what: "Aadhaar-authenticated biometric repayment collection at borrower's doorstep.",
        why: "Replaces cash collection with biometric proof — eliminates misappropriation and provides an instant audit trail for every EMI.",
        href: "/products/aeps-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Verify borrower identity with Aadhaar OTP for KYC compliance.",
        why: "RBI KYC norms require Aadhaar-based identity for MFI borrowers. OTP-based verification works even without biometric devices.",
        href: "/products/aadhaar-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification",
        icon: Building2,
        what: "Validate borrower's bank account before disbursal.",
        why: "Many JLG borrowers receive their first formal bank account for MFI lending — verifying it prevents disbursal failures.",
        href: "/products/bank-verification-api",
      },
      {
        apiId: "upi-payout",
        name: "Fund Transfer (Disbursal)",
        icon: Banknote,
        what: "Instant loan disbursal directly to borrower's bank account.",
        why: "RBI mandates direct bank account disbursal for microfinance — cash disbursal through field officers is non-compliant.",
        href: "/products/upi-payout-api",
      },
      {
        apiId: "digilocker",
        name: "DigiLocker",
        icon: Layers,
        what: "Fetch Aadhaar, ration card, and other KYC documents paperlessly.",
        why: "MFI field officers can complete full KYC from a mobile without physical document collection or storage.",
        href: "/products/digilocker-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Field officer visits borrower — mobile app initiates session" },
      { step: 2, label: "Aadhaar Verification — borrower identity confirmed via OTP" },
      { step: 3, label: "Bank Account Verification — disbursal account validated" },
      { step: 4, label: "Fund Transfer — loan amount sent directly to bank account" },
      { step: 5, label: "AePS collection — biometric EMI collection at next visit" },
    ],
    industriesUsingSlugs: ["microfinance", "lending-nbfc", "agriculture"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "mfi-collection.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// MFI field officer collects EMI via AePS
const collection = await eko.aeps.cashout({
  aadhaar: borrower.aadhaarNumber,
  bankIin: borrower.bankIin,
  amount: borrower.emiAmount,
  agentId: officer.agentId,
  biometricData: scannedFingerprint
});

// Update loan account on success
if (collection.status === "success") {
  await updateLoanAccount({
    loanId: borrower.loanId,
    txnId: collection.transactionId,
    amount: collection.amount
  });
}`,
      },
    ],
    comparisonRows: [
      { aspect: "EMI collection", diy: "Cash + manual ledger", eko: "Biometric + instant digital receipt" },
      { aspect: "Disbursal compliance", diy: "Cash = RBI non-compliant", eko: "Direct bank transfer = compliant" },
      { aspect: "KYC documentation", diy: "Physical forms + scanning", eko: "Paperless via Aadhaar + DigiLocker" },
      { aspect: "Field officer fraud", diy: "High risk with cash", eko: "Biometric audit trail eliminates it" },
    ],
    pricingBlurb: "Pay-per-transaction. No setup fee. Sandbox is free. Special MFI pricing tiers available.",
    faqs: [
      { question: "Does AePS work in areas with poor internet connectivity?", answer: "AePS requires a minimal data connection for biometric authentication. Eko's SDK supports offline queuing — transactions are submitted when connectivity resumes." },
      { question: "Can one field officer serve borrowers at multiple different banks?", answer: "Yes. Eko's AePS integration covers NPCI's interoperable network — a single device can process withdrawals from all Aadhaar-linked bank accounts regardless of bank." },
      { question: "How does the JLG model work with AePS collection?", answer: "The system supports group-level session management — a field officer can process multiple borrower collections in a single visit with each Aadhaar authentication creating a separate receipt." },
    ],
    relatedSolutions: [
      { slug: "assisted-banking-agent-pack", name: "Assisted Banking Agent Pack", tagline: "Full agent banking bundle for kirana & CSP" },
      { slug: "rural-financial-services-pack", name: "Rural Financial Services Pack", tagline: "Rural disbursals + basic KYC verification" },
      { slug: "lending-kyc-pack", name: "Lending KYC Pack", tagline: "Full KYC for borrower onboarding" },
    ],
    seo: {
      title: "MFI Field Operations Pack | Eko Platform Services",
      description: "Digital field operations for microfinance — biometric EMI collection via AePS, paperless KYC, RBI-compliant disbursals. NABFID & RBI ready.",
      keywords: "mfi field collection api, microfinance digital collection, aeps for microfinance, mfi api india",
    },
  },

  /* ── 6. Employee BGV Pack ────────────────────────────────────── */
  {
    slug: "employee-bgv-pack",
    name: "Employee BGV Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Run instant background verification on new hires — identity, address, employment history, criminal records, and education — in one API bundle.",
    tagline: "Instant employee background checks in one API call",
    navDescription: "Identity + employment + address verification for HR teams",
    icon: CheckCircle,
    category: "hr-workforce",
    apiChips: [
      { name: "PAN Verification", apiId: "pan", href: "/products/pan-verification-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
      { name: "Employee Verification", apiId: "employee", href: "/products/employee-verification-api" },
      { name: "DL Verification", apiId: "dl", href: "/products/dl-verification-api" },
      { name: "DigiLocker", apiId: "digilocker", href: "/products/digilocker-api" },
      { name: "Reverse Geocoding", apiId: "geocoding", href: "/products/reverse-geocoding-api" },
    ],
    trustStrip: [
      "Used by 200+ HR platforms",
      "DPDP aligned",
      "Instant results",
      "99.9% uptime"
    ],
    jobStatement: "Complete a new employee's background verification — identity, address, employment history, and education — in under 5 minutes, with zero manual effort.",
    packApis: [
      {
        apiId: "pan",
        name: "PAN Verification",
        icon: FileText,
        what: "Verify the employee's PAN for identity and tax compliance.",
        why: "Required for TDS compliance on salary and is the primary government-issued identity for employment records.",
        href: "/products/pan-verification-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Confirm current address and biometric identity.",
        why: "Provides address verification and biometric identity in one step — critical for field employees and delivery workers.",
        href: "/products/aadhaar-verification-api",
      },
      {
        apiId: "employee",
        name: "Employee Verification (EPFO)",
        icon: Briefcase,
        what: "Verify employment history via EPFO PRAN records.",
        why: "Checks all past employers registered with EPFO — no need to call previous employers manually.",
        href: "/products/employee-verification-api",
      },
      {
        apiId: "dl",
        name: "Driving Licence Verification",
        icon: Truck,
        what: "Verify DL authenticity and traffic violation history.",
        why: "Mandatory for driver, delivery, and field workforce roles. Catches fake or suspended licences before onboarding.",
        href: "/products/dl-verification-api",
      },
      {
        apiId: "digilocker",
        name: "DigiLocker (Educational Documents)",
        icon: Layers,
        what: "Fetch degree certificates and marksheets directly from DigiLocker.",
        why: "Eliminates educational document forgery — the leading form of BGV fraud in India.",
        href: "/products/digilocker-api",
      },
      {
        apiId: "geocoding",
        name: "Reverse Geocoding",
        icon: Globe,
        what: "Convert GPS coordinates to verifiable address for field employee visits.",
        why: "Validates that the address provided during onboarding matches the physical location — critical for blue-collar workers.",
        href: "/products/reverse-geocoding-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Employee submits mobile number + Aadhaar — OTP authentication" },
      { step: 2, label: "PAN + Aadhaar verification — identity confirmed" },
      { step: 3, label: "EPFO lookup — employment history verified" },
      { step: 4, label: "DigiLocker — education documents fetched" },
      { step: 5, label: "BGV report generated — hire/no-hire recommendation" },
    ],
    industriesUsingSlugs: ["staffing-hr", "logistics-fleet", "e-commerce", "healthcare"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "employee-bgv.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// Run parallel verifications for speed
const [pan, employment, education] = await Promise.all([
  eko.verify.pan({ panNumber: employee.pan }),
  eko.verify.epfo({ uan: employee.uan }),
  eko.digilocker.fetch({
    documentType: "degree_certificate",
    consent: employee.digilockerConsent
  })
]);

const bgvScore = calculateBGVScore({ pan, employment, education });
console.log(bgvScore.recommendation); // "HIRE" | "HOLD" | "REJECT"`,
      },
    ],
    comparisonRows: [
      { aspect: "Verification time", diy: "5–10 business days", eko: "Under 5 minutes" },
      { aspect: "Employment history source", diy: "Reference calls", eko: "EPFO PRAN records — authoritative" },
      { aspect: "Education verification", diy: "University email + waiting", eko: "DigiLocker — tamper-proof" },
      { aspect: "Cost per BGV", diy: "₹500–2000 per hire", eko: "Pay-per-API — <₹50 total" },
    ],
    pricingBlurb: "Pay-per-verification. No setup fee. Sandbox is free. Volume pricing at 1,000+ monthly BGVs.",
    faqs: [
      { question: "Is consent required for EPFO lookup?", answer: "Yes. Eko's Employee Verification API includes a consent flow compliant with DPDP Act 2023. The employee provides explicit consent before any employment data is fetched." },
      { question: "What if an employee hasn't registered with EPFO?", answer: "For informal workers without EPFO records, the pack falls back to reference check support via our partner network and address verification via Aadhaar." },
      { question: "Can I run bulk BGV for 1,000 new hires?", answer: "Yes. All verification APIs support batch mode with async processing and webhook notifications. Bulk runs of 1,000 complete in 30-60 minutes." },
    ],
    relatedSolutions: [
      { slug: "gig-worker-onboarding-pack", name: "Gig Worker Onboarding Pack", tagline: "Fast onboarding for gig & delivery workers" },
      { slug: "merchant-onboarding-pack", name: "Merchant Onboarding Pack", tagline: "KYB verification for merchants & sellers" },
    ],
    seo: {
      title: "Employee BGV Pack — Background Verification API | Eko",
      description: "Instant employee background verification — identity, EPFO employment history, education, DL in under 5 minutes. DPDP Act compliant. Used by 200+ HR platforms.",
      keywords: "employee background verification api india, bgv api, epfo verification api, hr onboarding api india",
    },
  },

  /* ── 7. Rural Financial Services Pack ───────────────────────── */
  {
    slug: "rural-financial-services-pack",
    name: "Rural Financial Services Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "A lighter financial services bundle for rural-focused platforms — AePS cashout, basic KYC, and instant transfers for last-mile financial access.",
    tagline: "Last-mile financial access for Tier 3+ markets",
    navDescription: "AePS + basic KYC bundle for rural & last-mile platforms",
    icon: Globe,
    category: "agent-banking",
    apiChips: [
      { name: "AePS Cashout", apiId: "aeps", href: "/products/aeps-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "Fund Transfer", apiId: "upi-payout", href: "/products/upi-payout-api" },
    ],
    trustStrip: [
      "Serves Tier 3 & beyond",
      "Works with 2G connectivity",
      "NPCI & RBI compliant"
    ],
    jobStatement: "Bring cash withdrawal, instant money transfer, and basic KYC to rural India — using only Aadhaar and a biometric device, with no smartphone required for the end user.",
    packApis: [
      {
        apiId: "aeps",
        name: "AePS Cashout",
        icon: Fingerprint,
        what: "Aadhaar-authenticated biometric cash withdrawal at any agent point.",
        why: "The primary financial service for rural Indians — withdraw government subsidies (DBT), wages, and loan disbursals without a bank branch.",
        href: "/products/aeps-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Basic identity verification for new account and wallet onboarding.",
        why: "Aadhaar-based eKYC is the cheapest and fastest onboarding path for rural customers with no other documents.",
        href: "/products/aadhaar-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification",
        icon: Building2,
        what: "Validate Jan Dhan or any rural bank account via penny drop.",
        why: "Confirms PM-JDY account is active before routing DBT or salary transfers.",
        href: "/products/bank-verification-api",
      },
      {
        apiId: "upi-payout",
        name: "Fund Transfer",
        icon: Banknote,
        what: "Route DBT, wages, or loan disbursals directly to verified accounts.",
        why: "Closes the last mile — money is deposited into the account that the customer can then withdraw via AePS.",
        href: "/products/upi-payout-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Rural customer visits local agent (kirana / CSP)" },
      { step: 2, label: "Agent identifies service: DBT withdrawal / money transfer" },
      { step: 3, label: "AePS — Aadhaar + fingerprint → instant cash or transfer" },
      { step: 4, label: "Customer receives SMS receipt" },
      { step: 5, label: "Agent earns commission" },
    ],
    industriesUsingSlugs: ["agriculture", "kirana-retail", "microfinance", "agent-networks-csp"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "rural-services.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// Rural customer withdraws DBT benefit
const withdrawal = await eko.aeps.cashout({
  aadhaar: customer.aadhaarNumber,
  bankIin: "508505",   // Jan Dhan bank IIN
  amount: 500,         // DBT installment
  biometricData: fingerprint
});

console.log(withdrawal.receiptNumber); // Send SMS to customer`,
      },
    ],
    comparisonRows: [
      { aspect: "End-user device needed", diy: "Smartphone + internet", eko: "Just Aadhaar + fingerprint" },
      { aspect: "Bank branch proximity", diy: "Required", eko: "Any kirana shop within 1km" },
      { aspect: "DBT withdrawal", diy: "ATM only (long queue)", eko: "Agent point — instant" },
    ],
    pricingBlurb: "Pay-per-transaction. No setup fee. Sandbox is free. Special rural pricing tiers available for NGOs and SHG platforms.",
    faqs: [
      { question: "Works in areas without smartphones?", answer: "Yes. AePS only requires the customer's Aadhaar number and fingerprint. The agent handles all the technology — the customer needs nothing." },
      { question: "Which government schemes use Aadhaar-linked accounts?", answer: "PM-KISAN, MGNREGA, PM Ujjwala, Pradhan Mantri Awas Yojana, and State DBT programs — all route funds to Aadhaar-linked accounts that can be accessed via AePS." },
    ],
    relatedSolutions: [
      { slug: "assisted-banking-agent-pack", name: "Assisted Banking Agent Pack", tagline: "Full agent banking bundle with BBPS + wallet" },
      { slug: "dbt-cashout-pack", name: "DBT Cashout Pack", tagline: "Optimized for government benefit distribution" },
    ],
    seo: {
      title: "Rural Financial Services Pack | Eko Platform Services",
      description: "Last-mile financial access for Tier 3+ India. AePS cashout + DBT cashout + basic KYC bundle. Works with Aadhaar only — no smartphone needed.",
      keywords: "rural banking api india, dbt cashout api, aeps for rural india, jan dhan api, last mile banking api",
    },
  },

  /* ── 8. DBT Cashout Pack ─────────────────────────────────────── */
  {
    slug: "dbt-cashout-pack",
    name: "DBT Cashout Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Enable citizens to withdraw government DBT benefits at agent points — biometric cashout from PM-KISAN, MGNREGA, and all state DBT schemes.",
    tagline: "Government DBT withdrawal at agent points via AePS",
    navDescription: "Enable PM-KISAN, MGNREGA & DBT benefit cashout at agents",
    icon: Banknote,
    category: "agent-banking",
    apiChips: [
      { name: "AePS Cashout", apiId: "aeps", href: "/products/aeps-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
    ],
    trustStrip: [
      "Critical DBT infrastructure",
      "Used in 500+ districts",
      // "BSC & NPCI certified",
      "RBI compliant",
      "99.9% uptime"
    ],
    jobStatement: "Let any citizen withdraw their government benefit at the nearest kirana store — using only their Aadhaar number and fingerprint — in under 30 seconds.",
    packApis: [
      {
        apiId: "aeps",
        name: "AePS Cashout",
        icon: Fingerprint,
        what: "Biometric cash withdrawal from any Aadhaar-linked government scheme account.",
        why: "The only way rural beneficiaries can access DBT funds without an ATM card — serves 100 million+ Jan Dhan account holders.",
        href: "/products/aeps-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Verify beneficiary identity before cashout.",
        why: "Prevents impersonation fraud in DBT withdrawals — every transaction is tied to a biometric record.",
        href: "/products/aadhaar-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification",
        icon: Building2,
        what: "Confirm seeding of Aadhaar to the DBT recipient bank account.",
        why: "Validates that the correct bank account is linked to the Aadhaar before routing the cashout.",
        href: "/products/bank-verification-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Beneficiary visits agent with Aadhaar number" },
      { step: 2, label: "AePS authentication — fingerprint scan" },
      { step: 3, label: "Balance check — DBT credit confirmed" },
      { step: 4, label: "Cash dispensed — agent debited, beneficiary credited" },
      { step: 5, label: "SMS receipt sent to beneficiary's registered mobile" },
    ],
    industriesUsingSlugs: ["agriculture", "kirana-retail", "agent-networks-csp"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "dbt-cashout.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// DBT benefit withdrawal
const cashout = await eko.aeps.cashout({
  aadhaar: "XXXXXXXXXXXX",
  bankIin: "508505",
  transactionType: "CASHOUT",
  amount: 2000,
  biometricData: fingerprintTemplate
});

if (cashout.status === "success") {
  // Dispense cash and print receipt
  printer.print(cashout.receipt);
}`,
      },
    ],
    comparisonRows: [
      { aspect: "Access to DBT", diy: "ATM + debit card needed", eko: "Aadhaar + fingerprint only" },
      { aspect: "Outlet density", diy: "Bank branch/ATM density", eko: "200K+ agent touchpoints" },
      { aspect: "Transaction time", diy: "5–10 min queue at ATM", eko: "Under 30 seconds at agent" },
    ],
    pricingBlurb: "Per-transaction pricing. No setup fee. Sandbox free. Special state government rates available.",
    faqs: [
      { question: "Which DBT schemes work with AePS cashout?", answer: "All Aadhaar-seeded DBT schemes including PM-KISAN, MGNREGA, PM Ujjwala, Pradhan Mantri Awas Yojana, scholarship schemes, and state-level DBT programs." },
      { question: "What if the biometric scan fails?", answer: "Eko's AePS API includes biometric retry logic and UIDAI fallback OTP authentication for elderly customers with worn fingerprints." },
    ],
    relatedSolutions: [
      { slug: "rural-financial-services-pack", name: "Rural Financial Services Pack", tagline: "Full rural banking bundle" },
      { slug: "assisted-banking-agent-pack", name: "Assisted Banking Agent Pack", tagline: "Complete agent banking stack" },
    ],
    seo: {
      title: "DBT Cashout Pack — Government Benefit Withdrawal API | Eko",
      description: "Enable DBT benefit cashout at agent points via AePS. PM-KISAN, MGNREGA, and all Aadhaar-linked government schemes. 200K+ agent touchpoints.",
      keywords: "dbt cashout api, pm kisan cashout api, mgnrega payment api, aadhaar dbt withdrawal, government benefit disbursement api",
    },
  },

  /* ── 9. Migrant Remittance Hub Pack ─────────────────────────── */
  {
    slug: "migrant-remittance-hub-pack",
    name: "Migrant Remittance Hub Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Optimized for urban migrant corridors — instant cash-to-bank remittance with AePS withdrawal at the receiving end and full compliance.",
    tagline: "Urban-to-rural cash remittance for migrant workers",
    navDescription: "Best-in-class DMT + AePS loop for migrant remittance",
    icon: Banknote,
    category: "agent-banking",
    apiChips: [
      { name: "DMT", apiId: "dmt", href: "/products/dmt-api" },
      { name: "AePS Cashout", apiId: "aeps", href: "/products/aeps-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
    ],
    trustStrip: [
      // "₹4,000 Cr+ remitted monthly",
      "Urban → rural in <60 seconds",
      "RBI BC model compliant",
      "99.9% uptime"
    ],
    jobStatement: "Let a migrant worker send money home from an urban agent and have their family withdraw it at a rural agent — the entire corridor in under 60 seconds.",
    packApis: [
      {
        apiId: "dmt",
        name: "Domestic Money Transfer (DMT)",
        icon: Banknote,
        what: "Cash-to-bank account transfers via IMPS under RBI's BC model.",
        why: "The urban sending leg — migrant gives cash to agent, who sends it to the rural family bank account instantly.",
        href: "/products/dmt-api",
      },
      {
        apiId: "aeps",
        name: "AePS Cashout",
        icon: Fingerprint,
        what: "Rural family withdraws at nearest agent using Aadhaar + fingerprint.",
        why: "Closes the remittance loop — the receiving family doesn't need a smartphone, debit card, or bank branch.",
        href: "/products/aeps-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification",
        icon: Building2,
        what: "Validate beneficiary bank account before registration.",
        why: "Prevents remittance to wrong accounts — one-time verification per beneficiary.",
        href: "/products/bank-verification-api",
      },
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "KYC verification for sender and beneficiary registration.",
        why: "RBI BC guidelines require sender KYC for remittance above ₹5,000.",
        href: "/products/aadhaar-verification-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Migrant worker walks into urban agent shop" },
      { step: 2, label: "Beneficiary registered — bank account verified once" },
      { step: 3, label: "DMT — cash accepted, IMPS transfer fires instantly" },
      { step: 4, label: "Family notified via SMS" },
      { step: 5, label: "Family withdraws at rural agent via AePS" },
    ],
    industriesUsingSlugs: ["kirana-retail", "agent-networks-csp", "microfinance"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "remittance.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// Urban leg: sender sends money
const transfer = await eko.dmt.transfer({
  senderMobile: "9876543210",
  beneficiaryAccount: "1234567890",
  ifsc: "SBIN0001234",
  amount: 2000,
  agentId: "AGT456"
});

// Rural leg: family withdraws via AePS
// (at receiving agent's terminal)
const withdrawal = await eko.aeps.cashout({
  aadhaar: family.aadhaarNumber,
  bankIin: "508505",
  amount: 2000,
  biometricData: fingerprint
});`,
      },
    ],
    comparisonRows: [
      { aspect: "Transfer speed", diy: "Bank transfer T+1", eko: "IMPS in <30 seconds" },
      { aspect: "Receiving end", diy: "Debit card + ATM needed", eko: "AePS — Aadhaar only" },
      { aspect: "Corridor coverage", diy: "Urban bank density only", eko: "200K+ agents urban + rural" },
    ],
    pricingBlurb: "Per-transaction fee. No setup cost. Sandbox free. Volume tiers for high-volume corridors.",
    faqs: [
      { question: "What is the daily DMT transfer limit?", answer: "Per RBI guidelines, DMT allows up to ₹25,000 per transaction and ₹1 lakh per month per sender for basic KYC customers. Full KYC customers get higher limits." },
      { question: "Is the sender KYC required for every transaction?", answer: "Sender KYC (Aadhaar + mobile) is required once during registration. Subsequent transactions only require mobile OTP confirmation." },
    ],
    relatedSolutions: [
      { slug: "assisted-banking-agent-pack", name: "Assisted Banking Agent Pack", tagline: "Full agent banking — AePS + DMT + BBPS" },
      { slug: "rural-financial-services-pack", name: "Rural Financial Services Pack", tagline: "Rural-focused banking bundle" },
    ],
    seo: {
      title: "Migrant Remittance Hub Pack | Eko Platform Services",
      description: "Urban-to-rural remittance bundle. DMT for sending, AePS for cashout at village level. Sub-60-second corridor. RBI BC model compliant.",
      keywords: "migrant remittance api india, dmt aeps bundle, urban rural remittance api, domestic money transfer rural cashout",
    },
  },

  /* ── 10. Gig Worker Onboarding Pack ─────────────────────────── */
  {
    slug: "gig-worker-onboarding-pack",
    name: "Gig Worker Onboarding Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Fast, compliant onboarding for delivery riders, agents, and gig workers — identity, DL, address, and bank verification in under 3 minutes.",
    tagline: "Onboard delivery & gig workers in under 3 minutes",
    navDescription: "DL + identity + bank verification for gig platforms",
    icon: Truck,
    category: "hr-workforce",
    apiChips: [
      { name: "Aadhaar Verification", apiId: "aadhaar", href: "/products/aadhaar-verification-api" },
      { name: "PAN Verification", apiId: "pan", href: "/products/pan-verification-api" },
      { name: "DL Verification", apiId: "dl", href: "/products/dl-verification-api" },
      { name: "Bank Verification", apiId: "bank", href: "/products/bank-verification-api" },
      { name: "RC Verification", apiId: "rc", href: "/products/rc-verification-api" },
    ],
    trustStrip: [
      "Used by leading gig platforms",
      "DPDP aligned",
      "RBI compliant",
      "5-minute onboarding SLA"
    ],
    jobStatement: "Onboard a delivery rider or gig worker in under 3 minutes — verify identity, driving licence, vehicle ownership, and payment account in a single mobile flow.",
    packApis: [
      {
        apiId: "aadhaar",
        name: "Aadhaar Verification",
        icon: ShieldCheck,
        what: "Verify identity and current address via Aadhaar OTP.",
        why: "Simplest KYC path for gig workers — most have only Aadhaar + phone as identity.",
        href: "/products/aadhaar-verification-api",
      },
      {
        apiId: "pan",
        name: "PAN Verification",
        icon: FileText,
        what: "Verify PAN for TDS deduction on gig earnings.",
        why: "Mandatory for platforms deducting TDS Section 194C on payments to gig workers.",
        href: "/products/pan-verification-api",
      },
      {
        apiId: "dl",
        name: "Driving Licence Verification",
        icon: Truck,
        what: "Validate DL authenticity, expiry, and vehicle category.",
        why: "Critical for delivery platforms — ensures only licensed riders are onboarded. Checks for suspension.",
        href: "/products/dl-verification-api",
      },
      {
        apiId: "rc",
        name: "RC Verification",
        icon: Truck,
        what: "Verify vehicle registration certificate and insurance validity.",
        why: "Platforms face liability if uninsured vehicles are on their network — RC check prevents this.",
        href: "/products/rc-verification-api",
      },
      {
        apiId: "bank",
        name: "Bank Account Verification",
        icon: Building2,
        what: "Validate the worker's payout bank account.",
        why: "Gig workers switch bank accounts frequently — verify before each earnings cycle to avoid failed payouts.",
        href: "/products/bank-verification-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Worker opens app — enters mobile number + Aadhaar" },
      { step: 2, label: "PAN + Aadhaar — identity verified" },
      { step: 3, label: "DL + RC — vehicle eligibility confirmed" },
      { step: 4, label: "Bank Account Verification — payout account registered" },
      { step: 5, label: "Worker approved and active on platform" },
    ],
    industriesUsingSlugs: ["logistics-fleet", "e-commerce", "staffing-hr"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "gig-onboarding.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// Parallel verification for speed
const [identity, licence, vehicle, payment] = await Promise.all([
  eko.verify.aadhaar({ aadhaarNumber: worker.aadhaar, otp: worker.otp }),
  eko.verify.drivingLicence({ dlNumber: worker.dlNumber, dob: worker.dob }),
  eko.verify.rc({ rcNumber: worker.vehicleRC }),
  eko.verify.bankAccount({ accountNumber: worker.accountNumber, ifsc: worker.ifsc })
]);

const approved = identity.verified && licence.valid && vehicle.insured && payment.verified;
console.log({ approved, riskScore: calculateRisk({ identity, licence, vehicle }) });`,
      },
    ],
    comparisonRows: [
      { aspect: "Onboarding time", diy: "2–3 days manual review", eko: "Under 3 minutes" },
      { aspect: "DL fake check", diy: "Manual scan + police check", eko: "Real-time Sarathi database" },
      { aspect: "Vehicle insurance check", diy: "Physical document scan", eko: "Automated via RC API" },
    ],
    pricingBlurb: "Pay-per-verification. No setup fee. Sandbox free. Volume tiers at 1,000+ weekly onboardings.",
    faqs: [
      { question: "Can I re-verify DL validity periodically?", answer: "Yes. The DL Verification API can be called at any frequency — many platforms re-verify monthly to catch expired or suspended licences." },
      { question: "What happens if the RC insurance has expired?", answer: "The RC Verification returns insurance expiry date. Your platform can configure automatic partner deactivation on expiry — Eko provides the data, the business logic stays with you." },
    ],
    relatedSolutions: [
      { slug: "employee-bgv-pack", name: "Employee BGV Pack", tagline: "Full background check for salaried employees" },
      { slug: "fleet-compliance-pack", name: "Fleet Compliance Pack", tagline: "Vehicle compliance for fleet operators" },
    ],
    seo: {
      title: "Gig Worker Onboarding Pack | Eko Platform Services",
      description: "Onboard delivery riders & gig workers in 3 minutes — DL, RC, Aadhaar, bank verification. DPDP Act compliant. Used by leading gig platforms.",
      keywords: "gig worker onboarding api, delivery driver verification api india, dl verification api, gig platform kyc india",
    },
  },

  /* ── 11. Fleet Compliance Pack ───────────────────────────────── */
  {
    slug: "fleet-compliance-pack",
    name: "Fleet Compliance Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Maintain regulatory compliance for vehicle fleets — RC, insurance, permit, and driver licence verification in one API bundle.",
    tagline: "RC + insurance + permit compliance for fleet operators",
    navDescription: "Automated fleet compliance — RC, insurance & driver checks",
    icon: Truck,
    category: "fleet-motor",
    apiChips: [
      { name: "RC Verification", apiId: "rc", href: "/products/rc-verification-api" },
      { name: "Vehicle Verification", apiId: "vehicle", href: "/products/vehicle-verification-api" },
      { name: "DL Verification", apiId: "dl", href: "/products/dl-verification-api" },
      { name: "Reverse Geocoding", apiId: "geocoding", href: "/products/reverse-geocoding-api" },
    ],
    trustStrip: [
      // "Used by 100+ fleet operators",
      // "MORTH database connected",
      // "Daily compliance monitoring"
    ],
    jobStatement: "Automate fleet regulatory compliance — verify and monitor RC, insurance, permits, and driver licences across your entire fleet daily, with alerts before expiry.",
    packApis: [
      {
        apiId: "rc",
        name: "RC Verification",
        icon: Truck,
        what: "Fetch RC details including owner, registration date, and insurance expiry.",
        why: "Core compliance check — an uninsured or expired-registration vehicle exposes operators to liability.",
        href: "/products/rc-verification-api",
      },
      {
        apiId: "vehicle",
        name: "Vehicle Verification",
        icon: Truck,
        what: "Fetch comprehensive vehicle data — chassis, engine, blacklist status, financier.",
        why: "Identifies stolen or financed vehicles before adding them to a fleet — critical for leasing and logistics.",
        href: "/products/vehicle-verification-api",
      },
      {
        apiId: "dl",
        name: "Driving Licence Verification",
        icon: CheckCircle,
        what: "Validate driver licence and check suspension status.",
        why: "Fleet operators are liable for accidents involving drivers with expired or suspended licences.",
        href: "/products/dl-verification-api",
      },
      {
        apiId: "geocoding",
        name: "Reverse Geocoding",
        icon: Globe,
        what: "Convert GPS coordinates to address for driver location verification.",
        why: "Enables geofencing and route compliance — verify drivers are operating in permitted zones.",
        href: "/products/reverse-geocoding-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Vehicle onboarded — RC number fetched & verified" },
      { step: 2, label: "Driver assigned — DL verified & active status confirmed" },
      { step: 3, label: "Daily batch job — all RCs & DLs re-checked for expiry" },
      { step: 4, label: "Alerts fired 30 days before insurance / DL expiry" },
      { step: 5, label: "Compliance dashboard updated in real time" },
    ],
    industriesUsingSlugs: ["logistics-fleet", "automotive", "e-commerce"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "fleet-compliance.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// Daily compliance batch check
const fleet = await getFleetVehicles();

const complianceResults = await Promise.all(
  fleet.map(async (vehicle) => {
    const [rc, dl] = await Promise.all([
      eko.verify.rc({ rcNumber: vehicle.registrationNumber }),
      eko.verify.drivingLicence({ dlNumber: vehicle.driver.dlNumber })
    ]);

    return {
      vehicleId: vehicle.id,
      rcExpiry: rc.insuranceExpiry,
      dlExpiry: dl.expiryDate,
      isCompliant: rc.valid && dl.valid && !dl.suspended
    };
  })
);

const nonCompliant = complianceResults.filter(v => !v.isCompliant);
await sendAlerts(nonCompliant);`,
      },
    ],
    comparisonRows: [
      { aspect: "Compliance monitoring", diy: "Manual tracking in spreadsheets", eko: "Automated daily API batch" },
      { aspect: "Expiry alerts", diy: "None — discover on road", eko: "30-day advance warnings" },
      { aspect: "Stolen vehicle check", diy: "Police inquiry", eko: "Real-time blacklist check via API" },
    ],
    pricingBlurb: "Pay-per-look-up. No setup fee. Sandbox free. Bulk pricing for fleets of 1,000+ vehicles.",
    faqs: [
      { question: "Can I check vehicles across multiple states?", answer: "Yes. Eko's RC and Vehicle Verification APIs cover all state RTOs via the VAHAN national database, with 99% coverage of registered vehicles." },
      { question: "How often can I run compliance checks?", answer: "Daily batch runs are most common. Some premium fleet operators run real-time checks at every trip start. Pricing is per-API call." },
    ],
    relatedSolutions: [
      { slug: "gig-worker-onboarding-pack", name: "Gig Worker Onboarding Pack", tagline: "Onboarding for delivery & gig workers" },
      { slug: "employee-bgv-pack", name: "Employee BGV Pack", tagline: "Full background verification for drivers" },
    ],
    seo: {
      title: "Fleet Compliance Pack — RC, DL & Vehicle API | Eko",
      description: "Automate fleet regulatory compliance — RC, insurance, DL verification daily. Automated expiry alerts. Covers all state RTOs via VAHAN database.",
      keywords: "fleet compliance api india, rc verification api, vehicle insurance check api, dl verification fleet, fleet management api",
    },
  },

  /* ── 12. Motor Insurance Pack ────────────────────────────────── */
  {
    slug: "motor-insurance-pack",
    name: "Motor Insurance Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle: "Pre-built verification bundle for motor insurance workflows — vehicle details, RC, ownership, and driver verification in minutes.",
    tagline: "Vehicle + owner verification for motor insurance",
    navDescription: "RC + vehicle details + driver KYC for motor insurers",
    icon: ShieldCheck,
    category: "fleet-motor",
    apiChips: [
      { name: "Vehicle Verification", apiId: "vehicle", href: "/products/vehicle-verification-api" },
      { name: "RC Verification", apiId: "rc", href: "/products/rc-verification-api" },
      { name: "DL Verification", apiId: "dl", href: "/products/dl-verification-api" },
      { name: "PAN Verification", apiId: "pan", href: "/products/pan-verification-api" },
    ],
    trustStrip: [
      // "Used by 20+ insurers",
      // "IRDAI data norms compliant",
      "Sub-30-second verification",
      "99.9% uptime"
    ],
    jobStatement: "Verify vehicle details, ownership, and driver eligibility in under 30 seconds — enabling instant motor insurance quotes and policy issuance without manual form filling.",
    packApis: [
      {
        apiId: "vehicle",
        name: "Vehicle Verification",
        icon: Truck,
        what: "Fetch chassis, engine, make/model, fuel type, and ownership from VAHAN.",
        why: "Pre-fills the policy application with verified vehicle data — eliminates typographic errors and fraud.",
        href: "/products/vehicle-verification-api",
      },
      {
        apiId: "rc",
        name: "RC Verification",
        icon: CheckCircle,
        what: "Get current RC status, owner details, and last insurance details.",
        why: "Checks previous insurance history — required for accurate premium calculation and lapse detection.",
        href: "/products/rc-verification-api",
      },
      {
        apiId: "dl",
        name: "Driving Licence Verification",
        icon: FileText,
        what: "Verify the policyholder's driving licence validity and suspensions.",
        why: "Affects risk underwriting — suspended or invalid licences change the risk profile significantly.",
        href: "/products/dl-verification-api",
      },
      {
        apiId: "pan",
        name: "PAN Verification",
        icon: Layers,
        what: "Verify policyholder identity for premium above ₹50,000.",
        why: "IRDAI mandates PAN verification for high-premium policies and for tax deductions on claims.",
        href: "/products/pan-verification-api",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Customer enters vehicle registration number" },
      { step: 2, label: "Vehicle Verification — make, model, engine pre-filled" },
      { step: 3, label: "RC Verification — ownership & previous insurance confirmed" },
      { step: 4, label: "DL Verification — driver risk profile assessed" },
      { step: 5, label: "Instant quote generated — policy issued in minutes" },
    ],
    industriesUsingSlugs: ["insurance", "automotive", "logistics-fleet"],
    exampleCode: [
      {
        language: "javascript",
        fileName: "motor-insurance.js",
        code: `const eko = new EkoAPI({ apiKey: process.env.EKO_API_KEY });

// Fetch vehicle details for policy pre-fill
const [vehicle, rc] = await Promise.all([
  eko.verify.vehicle({ regNumber: "DL01AB1234" }),
  eko.verify.rc({ rcNumber: "DL01AB1234" })
]);

// Generate instant quote
const quote = calculatePremium({
  make: vehicle.make,
  model: vehicle.model,
  year: vehicle.year,
  fuelType: vehicle.fuelType,
  previousInsurer: rc.lastInsurer,
  noClaimBonus: rc.nclaimBonus
});`,
      },
    ],
    comparisonRows: [
      { aspect: "Vehicle data collection", diy: "Manual form fill by customer", eko: "Auto-fetched from VAHAN" },
      { aspect: "Previous insurance check", diy: "Self-declaration (fraud risk)", eko: "Verified from RC record" },
      { aspect: "Policy issuance time", diy: "24 hours", eko: "Under 10 minutes" },
    ],
    pricingBlurb: "Pay-per-verification. No setup fee. Sandbox free. Insurance-sector volume pricing available.",
    faqs: [
      { question: "Does Eko provide claims verification too?", answer: "Currently the Motor Insurance Pack covers the underwriting/onboarding workflow. Claims verification APIs are on the roadmap. Contact sales for early access." },
      { question: "What data does the Vehicle Verification API return?", answer: "Make, model, variant, fuel type, engine number, chassis number, registration date, owner name, registration state, and financing status." },
    ],
    relatedSolutions: [
      { slug: "fleet-compliance-pack", name: "Fleet Compliance Pack", tagline: "Ongoing fleet RC & DL compliance monitoring" },
      { slug: "gig-worker-onboarding-pack", name: "Gig Worker Onboarding Pack", tagline: "Vehicle & driver onboarding for gig platforms" },
    ],
    seo: {
      title: "Motor Insurance Pack — Vehicle Verification API | Eko",
      description: "Instant motor insurance with auto-filled vehicle details. RC, vehicle, DL, PAN verification in 30 seconds. IRDAI compliant. Used by 20+ insurers.",
      keywords: "motor insurance verification api, vehicle verification api india, rc api for insurance, irdai api india",
    },
  },
];

export const SOLUTIONS_MAP: Record<string, SolutionData> = Object.fromEntries(
  SOLUTIONS_LIST.map((s) => [s.slug, s])
);
