import { API_PRODUCT_PAGES } from "@/lib/data/api-product-pages";
import { ACTIVE_PRODUCTS_MAP, API_PRODUCTS_MAP } from "@/lib/data/api-products";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Briefcase,
  FileText,
  Fingerprint,
  Globe,
  Receipt,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

/** Slim reference stored per solution — name, icon, href are resolved at runtime */
export interface PackApiRef {
  /** references API_PRODUCTS_MAP key */
  apiId: string;
  what: string;
  why: string;
  /** Override the default product name (e.g. "Bank Account Verification (Penny Drop)") */
  nameOverride?: string;
  /** Override the default product icon */
  iconOverride?: LucideIcon;
}

/** Fully-resolved pack API item for rendering */
export interface ResolvedPackApi {
  apiId: string;
  name: string;
  shortName: string;
  icon: LucideIcon;
  what: string;
  why: string;
  href: string;
}

/** Resolve a PackApiRef into a full rendering object */
export function resolvePackApi(ref: PackApiRef): ResolvedPackApi | null {
  const product = API_PRODUCTS_MAP[ref.apiId];
  if (!product) return null;
  const page = API_PRODUCT_PAGES[ref.apiId];
  return {
    apiId: ref.apiId,
    name: ref.nameOverride ?? product.name,
    shortName: product.shortName ?? product.name,
    icon: ref.iconOverride ?? page?.icon ?? FileText,
    what: ref.what,
    why: ref.why,
    href: product.href,
  };
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
  trustStrip: string[];
  jobStatement: string;
  packApis: PackApiRef[];
  howItWorksSteps: HowItWorksStep[];
  industriesUsingSlugs: string[];
  // exampleCode: { language: string; fileName: string; code: string }[];
  comparisonRows: ComparisonRow[];
  pricingBlurb: string;
  faqs: SolutionFAQ[];
  relatedSolutions: RelatedSolution[];
  seo: { title: string; description: string; keywords: string };
  /** Short description for cards / nav */
  tagline: string;
  navDescription: string;
  icon: LucideIcon;
  category:
    | "lending-credit"
    | "onboarding"
    | "agent-banking"
    | "hr-workforce"
    | "fleet-motor";
  /** 1 = featured in header nav, 2 = available, 3 = hidden/draft */
  priority: 1 | 2 | 3;
}

/* ───────────────────────────────────────────────────────────────
    MARK: SOLUTIONS
  ─────────────────────────────────────────────────────────────── */
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
    priority: 1,
    trustStrip: [
      "Powering 200K+ agent touchpoints",
      // "1.5 Cr+ transactions/month",
      "NPCI & RBI compliant",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Enable any retailer in India to offer assisted banking services to walk-in customers — biometric cash withdrawal, instant money transfer, utility bill payments, and prepaid wallets — from a single integration. No bank branch required.",
    packApis: [
      {
        apiId: "aeps",
        nameOverride: "AePS Cashout",
        what: "Aadhaar-authenticated biometric cash withdrawal at agent points via FingPay & FINO gateways.",
        why: "The core service that turns a retail counter into a micro-ATM. Serves the 200–300 million Indians who can't use UPI or mobile banking.",
      },
      {
        apiId: "dmt",
        nameOverride: "Domestic Money Transfer (DMT)",
        what: "Cash-to-bank-account remittance via IMPS/NEFT under RBI's BC model.",
        why: "Lets agents accept cash from migrant workers and transfer it to family bank accounts in real time. Pairs with AePS to complete the urban-to-rural remittance loop.",
      },
      {
        apiId: "bbps",
        nameOverride: "Bill Payment (BBPS / Bharat Connect)",
        what: "Pay 25+ biller categories — electricity, gas, DTH, broadband, EMI, insurance — through a single integration.",
        why: "Drives footfall and frequency. Bills are paid every month, so customers come back every month.",
      },
      {
        apiId: "ppi",
        nameOverride: "PPI DigiKhata (Prepaid Wallet)",
        what: "Issue and manage RBI-compliant prepaid wallets for end customers.",
        why: "Lets agents onboard customers into a digital wallet, opening up gift cards, loyalty, and recurring payments.",
      },
      {
        apiId: "otp",
        nameOverride: "Mobile OTP",
        what: "Send and verify OTPs across telecom networks.",
        why: "Required for daily agent authentication, customer verification, and transaction confirmation.",
      },
      {
        apiId: "sms",
        nameOverride: "Send SMS",
        what: "Transactional SMS delivery for receipts, alerts, and notifications.",
        why: "Every transaction generates a customer receipt — critical for trust and dispute resolution in cash-handling environments.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Customer walks into agent shop" },
      {
        step: 2,
        label: "Agent identifies service: Withdraw / Send / Pay Bill",
      },
      {
        step: 3,
        label:
          "AePS: Aadhaar + biometric → instant cash; DMT: Beneficiary + amount → instant transfer; BBPS: Biller + customer ID → bill paid",
      },
      { step: 4, label: "Customer gets SMS receipt" },
      { step: 5, label: "Agent earns commission, settled to wallet" },
    ],
    industriesUsingSlugs: [
      "kirana-retail",
      "agent-networks-csp",
      "microfinance",
      "agriculture",
    ],
    comparisonRows: [
      {
        aspect: "Vendor contracts",
        diy: "4–6 separate vendors",
        eko: "1 contract",
      },
      {
        aspect: "BC license",
        diy: "Apply separately, 6+ months",
        eko: "Eko is the BCNM — included",
      },
      {
        aspect: "AePS gateway",
        diy: "Direct NPCI relationship needed",
        eko: "FingPay + FINO dual-gateway included",
      },
      {
        aspect: "Compliance (RBI ATO, NPCI OC 88/91)",
        diy: "Your team's burden",
        eko: "Built into the platform",
      },
      {
        aspect: "Time to first transaction",
        diy: "6–9 months",
        eko: "7–14 days",
      },
      {
        aspect: "Biometric device support",
        diy: "DIY integration",
        eko: "5 STQC-certified models pre-integrated",
      },
    ],
    pricingBlurb:
      "Pay-per-transaction. No setup fee. Sandbox is free. Agents earn ₹2–25 per transaction depending on service and amount. Eko shares interchange revenue with you under a transparent multi-tier structure.",
    faqs: [
      {
        question: "How long does AePS agent activation take?",
        answer:
          "Agent activation typically takes 24–48 hours after KYC submission. The sandbox environment is available immediately upon signup.",
      },
      {
        question: "Which biometric devices does Eko support?",
        answer:
          "Eko supports 5 STQC-certified biometric devices including Mantra MFS100, Morpho MSO1300, and Startek FM220U, among others.",
      },
      // { question: "What's the daily AePS withdrawal limit per customer?", answer: "Per NPCI guidelines, the daily AePS withdrawal limit is ₹10,000 per customer per bank account. Multiple bank accounts can be used in a single day." },
      {
        question:
          "How does Eko's dual-gateway (FingPay + FINO) improve success rates?",
        answer:
          "When one gateway experiences downtime or congestion, the system automatically routes to the other, maintaining high transaction success rates even during peak periods.",
      },
      {
        question: "Can I white-label this entire stack under my own brand?",
        answer:
          "Yes. Eko offers full white-labeling options. Your branding on the agent app, receipts, and customer-facing touchpoints. Contact our sales team for licensing details.",
      },
      {
        question: "Do agents need a BC license individually?",
        answer:
          "No. Under Eko's BCNM (Business Correspondent Network Manager) license, individual agents operate as sub-agents of Eko. They need to complete Eko's onboarding and KYC process.",
      },
      {
        question: "How does commission settlement work?",
        answer:
          "Agent commissions are settled daily to their registered bank accounts or Eko wallet. The settlement cycle is T+1 for most transaction types.",
      },
    ],
    relatedSolutions: [
      {
        slug: "rural-financial-services-pack",
        name: "Rural Financial Services Pack",
        tagline: "Lighter version with PAN Lite + Bank Verification add-ons",
      },
      {
        slug: "migrant-remittance-hub-pack",
        name: "Migrant Remittance Hub Pack",
        tagline: "Optimized for urban migrant corridors",
      },
      {
        slug: "mfi-field-operations-pack",
        name: "MFI Field Operations Pack",
        tagline: "For microfinance field collection & disbursals",
      },
    ],
    seo: {
      title: "Assisted Banking Agent Pack — AePS, DMT, BBPS APIs",
      description:
        "Turn kirana stores & CSP agents into banking touchpoints. AePS biometric withdrawal + DMT remittance + BBPS bill payment in one integrated bundle. RBI & NPCI compliant.",
      keywords:
        "aeps dmt bbps bundle, agent banking api bundle india, white label bc api, csp api platform, kirana banking api",
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
    priority: 1,
    trustStrip: [
      // "Used by 200+ lenders",
      "RBI compliant",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Onboard a digital loan applicant in under 90 seconds with verified identity, income, and a payout-ready bank account.",
    packApis: [
      {
        apiId: "pan",
        nameOverride: "PAN Verification (Advanced)",
        what: "Fetch full borrower identity including name, DOB, and PAN status in <2 seconds.",
        why: "The first verification in every lending journey — confirms identity and links to income data.",
      },
      {
        apiId: "bank",
        nameOverride: "Bank Account Verification (Penny Drop)",
        what: "Confirm the borrower's bank account is active and the name matches.",
        why: "RBI Digital Lending Directions require verified bank accounts before disbursal. Penny drop is the industry standard.",
      },
      {
        apiId: "digilocker",
        what: "Pull Aadhaar, driving licence, and ITR documents paperlessly via DIPP integration.",
        why: "Eliminates document upload friction — borrower consents once and all docs are fetched automatically.",
      },
      {
        apiId: "aadhaar",
        what: "Verify address and identity using Aadhaar number + OTP.",
        why: "Adds a biometric-linked identity layer on top of PAN — the combination prevents most synthetic identity fraud.",
      },
      {
        apiId: "gst",
        what: "Validate GSTIN and pull filing patterns as a cash-flow proxy.",
        why: "For MSME borrowers with no credit score, GST filing history is the most reliable income signal.",
      },
      {
        apiId: "upi-payout",
        nameOverride: "Fund Transfer (UPI/IMPS/NEFT)",
        what: "Disburse loans instantly to the verified bank account.",
        why: "Closes the loop — once all verifications pass, the disbursal fires automatically in the same workflow.",
      },
      {
        apiId: "name-match",
        what: "Fuzzy name matching across PAN, Aadhaar, bank, and GST records.",
        why: "Catches synthetic identity fraud by detecting name discrepancies across documents — replaces custom ML models.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Mobile OTP — authenticate borrower" },
      {
        step: 2,
        label: "PAN Advanced — fetch identity & status",
        apiId: "pan",
      },
      {
        step: 3,
        label: "DigiLocker — pull Aadhaar & ITR paperlessly",
        apiId: "digilocker",
      },
      {
        step: 4,
        label: "Bank Account Verification — penny-drop confirmation",
        apiId: "bank",
      },
      {
        step: 5,
        label: "GST Verification — income & cash-flow assessment",
        apiId: "gst",
      },
      {
        step: 6,
        label: "Fund Transfer — instant disbursal to verified account",
        apiId: "upi-payout",
      },
    ],
    industriesUsingSlugs: [
      "lending-nbfc",
      "microfinance",
      "saas-platforms",
      "marketplaces",
    ],
    comparisonRows: [
      {
        aspect: "Vendor contracts",
        diy: "3–5 separate KYC vendors",
        eko: "1 contract",
      },
      {
        aspect: "RBI Digital Lending compliance",
        diy: "Build & maintain yourself",
        eko: "Compliant by default",
      },
      {
        aspect: "Name-match across sources",
        diy: "Custom ML model required",
        eko: "Built-in cross-document matching",
      },
      {
        aspect: "Disbursal integration",
        diy: "Separate payment gateway contract",
        eko: "Same platform, same dashboard",
      },
      {
        aspect: "Sandbox testing",
        diy: "Prod credentials only from vendors",
        eko: "Full sandbox on day 1",
      },
      { aspect: "Time to integrate", diy: "3–6 months", eko: "1–3 days" },
    ],
    pricingBlurb:
      "Pay-per-verification. Sandbox is free. Single invoice, single dashboard — no multi-vendor billing.",
    faqs: [
      // { question: "Is Eko's Fund Transfer API compliant with RBI Digital Lending Directions?", answer: "Yes. Eko's fund transfer API is designed for direct RE-to-borrower disbursals, with full audit trails meeting RBI Digital Lending Direction requirements on traceability and direct credit." },
      // { question: "Can I bulk-verify 50,000 borrowers in a single batch?", answer: "Yes. The Lending KYC Pack supports bulk PAN and bank account verification via asynchronous batch APIs with webhook notifications on completion. Typical batch of 50,000 completes in 2–4 hours." },
      {
        question:
          "How does Eko's name matching handle regional name variations?",
        answer:
          "Our name-match engine uses fuzzy matching with regional transliteration support, handling variations across Hindi, Tamil, Telugu, Kannada, and Bengali name structures.",
      },
      {
        question:
          "What's the typical sandbox-to-production timeline for an NBFC?",
        answer:
          "Most NBFCs complete sandbox testing in 1–3 days and go live in 5–7 business days after NBFC-specific KYC documentation is submitted.",
      },
      {
        question: "Do you support co-lending portfolio reconciliation?",
        answer:
          "Yes. Our bulk verification APIs support portfolio-level reconciliation, with the Co-lending Compliance Pack providing additional batch tools for NBFC-bank co-lending workflows.",
      },
      {
        question: "Is there a minimum monthly transaction commitment?",
        answer:
          "No minimum commitment for the sandbox. Production accounts have no mandatory minimum, though volume pricing tiers start at 1,000 monthly API calls.",
      },
    ],
    relatedSolutions: [
      {
        slug: "msme-credit-assessment-pack",
        name: "MSME Credit Assessment Pack",
        tagline: "Assess MSME creditworthiness via GST + ITR patterns",
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        tagline: "KYB + payment setup for merchants & sellers",
      },
      {
        slug: "mfi-field-operations-pack",
        name: "MFI Field Operations Pack",
        tagline: "Field collection & disbursal for microfinance",
      },
    ],
    seo: {
      title: "Lending KYC Pack — Digital Lending API Bundle",
      description:
        "RBI-compliant API stack for digital lenders in India. PAN, bank, DigiLocker, instant disbursal, BBPS collection. Sandbox in minutes. Trusted by 200+ lenders.",
      keywords:
        "lending kyc api bundle india, digital lending kyc package, nbfc kyc api stack, kyc api for lending",
    },
  },

  /* ── 3. Merchant Onboarding Pack ────────────────────────────── */
  {
    slug: "merchant-onboarding-pack",
    name: "Merchant Onboarding Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Verify, onboard, and activate merchants and sellers with a pre-built KYB workflow — PAN, GST, bank, and business checks in one bundle.",
    tagline: "KYB + payment activation for merchants & sellers",
    navDescription: "Onboard merchants with KYB checks in hours, not days",
    icon: Briefcase,
    category: "onboarding",
    priority: 1,
    trustStrip: [
      // "Used by 500+ marketplaces",
      "ONDC seller-ready",
      "RBI compliant",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Verify a merchant's identity, business, and bank account — and activate them for payments — in under 10 minutes, with zero manual document review.",
    packApis: [
      {
        apiId: "pan",
        what: "Verify the merchant proprietor's or director's PAN and fetch identity details.",
        why: "First step in any KYB flow — confirms who owns the business before verifying the business itself.",
      },
      {
        apiId: "gst",
        what: "Validate GSTIN and fetch business name, address, and filing status.",
        why: "GST number is the fastest way to verify a business's existence, category, and compliance standing.",
      },
      {
        apiId: "bank",
        nameOverride: "Bank Verification (Penny Drop)",
        what: "Confirm the merchant's settlement bank account is active and the name matches.",
        why: "Required before activating payment settlements — prevents fraudulent account substitution.",
      },
      {
        apiId: "aadhaar",
        what: "Verify the merchant's identity with Aadhaar OTP for sole proprietors.",
        why: "Adds biometric-linked identity for unregistered merchants and sole proprietors who may not have GST.",
      },
      {
        apiId: "digilocker",
        what: "Access and verify documents stored in DigiLocker, such as Aadhaar, PAN, and business registration certificates.",
        why: "Provides a secure and convenient way to verify documents without physical copies.",
      },
      {
        apiId: "cin",
        what: "Validate Company Identification Number and fetch company details from MCA.",
        why: "For incorporated merchants, CIN verification confirms the company is active and fetches director details — faster than manual MCA portal checks.",
      },
      {
        apiId: "name-match",
        what: "Cross-check merchant name across PAN, GST trade name, and bank account holder.",
        why: "Catches mismatches that indicate fraudulent merchant registrations — the GST trade name often differs from the PAN legal name.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Merchant enters mobile number — OTP authentication" },
      { step: 2, label: "PAN Verification — confirm proprietor identity" },
      {
        step: 3,
        label: "GST Verification — validate business & filing status",
      },
      {
        step: 4,
        label: "Bank Account Verification — penny-drop settlement account",
      },
      {
        step: 5,
        label:
          "Merchant activated for payments — instant settlement configured",
      },
    ],
    industriesUsingSlugs: [
      "marketplaces",
      "e-commerce",
      "saas-platforms",
      "accounting-tax",
    ],
    comparisonRows: [
      { aspect: "KYB checks", diy: "3–4 vendor integrations", eko: "1 bundle" },
      // { aspect: "ONDC compliance", diy: "Custom implementation", eko: "Pre-certified" },
      {
        aspect: "Rejection handling",
        diy: "Build retry workflows",
        eko: "Built-in fallback checks",
      },
      {
        aspect: "Time to live merchant",
        diy: "2–5 days manual review",
        eko: "Under 10 minutes",
      },
    ],
    pricingBlurb:
      "Pay-per-verification. No setup fee. Sandbox is free. Volume pricing available for 10,000+ monthly onboardings.",
    faqs: [
      {
        question: "Does this pack work for ONDC seller onboarding?",
        answer:
          "Yes. The Merchant Onboarding Pack is pre-validated for ONDC seller KYB requirements including GST validation, PAN verification, and bank account confirmation.",
      },
      {
        question: "Can I onboard unregistered merchants without GST?",
        answer:
          "Yes. For sole proprietors without GST, the pack falls back to PAN + Aadhaar verification (via DigiLocker) for identity and the bank verification for payment activation.",
      },
      {
        question: "How fast is the penny-drop bank verification?",
        answer:
          "Real-time, typically under 3 seconds. The API returns account holder name and active status in the same call.",
      },
      {
        question: "Is there directory lookup for business type?",
        answer:
          "GST verification returns business type (proprietor, partnership, LLP, etc.), registration date, and address — no separate MCA lookup needed for most cases.",
      },
    ],
    relatedSolutions: [
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        tagline: "Full KYC for borrower onboarding & disbursal",
      },
      {
        slug: "employee-bgv-pack",
        name: "Employee BGV Pack",
        tagline: "Instant background verification for employees",
      },
    ],
    seo: {
      title: "Merchant Onboarding Pack — KYB API Bundle",
      description:
        "Verify and activate merchants instantly. PAN, GST, bank verification in one bundle. ONDC seller-ready, RBI compliant. Used by 500+ companies across India.",
      keywords:
        "merchant onboarding api india, kyb api india, payment aggregator merchant onboarding, ondc seller verification",
    },
  },

  /* ── 4. MSME Credit Assessment Pack ─────────────────────────── */
  {
    slug: "msme-credit-assessment-pack",
    name: "MSME Credit Assessment Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Assess MSME creditworthiness using GST filing patterns, ITR history, and bank account validation — no traditional credit score required.",
    tagline: "Credit scoring via GST & ITR data",
    navDescription: "Alternative credit scoring for MSMEs via GST & ITR data",
    icon: BarChart3,
    category: "lending-credit",
    priority: 1,
    trustStrip: [
      "Used by new-age NBFCs",
      // "No credit bureau dependency",
      "RBI compliant",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Assess an MSME's creditworthiness in minutes using GST filing patterns, ITR history, and bank validation — enabling lending to 63 million underserved businesses with no credit history.",
    packApis: [
      {
        apiId: "gst",
        nameOverride: "GST Verification & Filing History",
        what: "Fetch GSTIN details, filing patterns, and turnover trends across quarters.",
        why: "GST compliance patterns are the best proxy for MSME cash flow — replacing the monthly bank statement request with an automated data pull.",
      },
      {
        apiId: "pan",
        nameOverride: "PAN Verification (Advanced)",
        what: "Fetch promoter identity, PAN category, and cross-link to business PAN.",
        why: "Links the business identity to the promoter — essential for sole proprietors and personal-guarantee lending.",
      },
      {
        apiId: "bank",
        what: "Validate the MSME's primary operating account via penny drop.",
        why: "Confirms the settlement account exists and the business name matches — prevents mule account disbursals.",
      },
      {
        apiId: "digilocker",
        nameOverride: "DigiLocker (ITR Documents)",
        what: "Fetch ITR-V and Form-26AS documents directly from the borrower's DigiLocker.",
        why: "Provides verified income history without relying on self-submitted PDFs — eliminates document forgery risk.",
      },
      {
        apiId: "itr",
        nameOverride: "ITR Compliance Check",
        what: "Check income tax return filing status and compliance via PAN.",
        why: "Quick pre-screen before pulling full ITR documents — confirms the borrower has filed returns and is tax-compliant.",
      },
      {
        apiId: "cin",
        what: "Validate Company Identification Number for incorporated MSMEs.",
        why: "For Pvt Ltd and LLP borrowers, CIN check confirms the entity is active and not struck off — a basic corporate due diligence step.",
      },
    ],
    howItWorksSteps: [
      {
        step: 1,
        label: "MSME enters GSTIN — system fetches 8 quarters of filing data",
      },
      {
        step: 2,
        label: "PAN verification — link promoter identity to business",
      },
      { step: 3, label: "DigiLocker — pull ITR-V & Form-26AS" },
      {
        step: 4,
        label: "Bank Account Verification — validate operating account",
      },
      { step: 5, label: "Credit model scores the MSME — loan offer generated" },
    ],
    industriesUsingSlugs: ["lending-nbfc", "microfinance", "saas-platforms"],
    comparisonRows: [
      {
        aspect: "Credit bureau dependency",
        diy: "Bureau subscription + integration",
        eko: "Bureau-free alternative scoring",
      },
      {
        aspect: "MSME data sources",
        diy: "Manual ITR & bank statements",
        eko: "Automated GST + DigiLocker pull",
      },
      {
        aspect: "Decision speed",
        diy: "2–5 days manual underwriting",
        eko: "Minutes",
      },
    ],
    pricingBlurb: "Pay-per-assessment. No setup fee. Sandbox is free.",
    faqs: [
      {
        question: "How many quarters of GST data can I access?",
        answer:
          "Eko's GST verification API provides up to 12 quarters of filing history including return filing status, taxable value trends, and compliance score.",
      },
      {
        question: "Does this work for MSMEs with turnover below GST threshold?",
        answer:
          "For MSMEs below the ₹40 lakh GST threshold, the pack falls back to Aadhaar (DigiLocker) + PAN + bank statement via DigiLocker.",
      },
    ],
    relatedSolutions: [
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        tagline: "Full KYC for borrower onboarding & disbursal",
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        tagline: "KYB + payment activation for merchants",
      },
    ],
    seo: {
      title: "MSME Credit Assessment Pack",
      description:
        "Assess MSME creditworthiness using GST filing patterns and ITR — no credit bureau needed. Lend to 63 million underserved businesses. RBI compliant.",
      keywords:
        "msme credit assessment api, gst based lending india, alternative credit scoring msme, nbfc msme api",
    },
  },

  /* ── 5. MFI Field Operations Pack ───────────────────────────── */
  {
    slug: "mfi-field-operations-pack",
    name: "MFI Field Operations Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Digital tools for microfinance field officers — paperless KYC, biometric collections, and instant disbursals for JLG and SHG lending models.",
    tagline: "Paperless KYC & biometric collections for MFIs",
    navDescription: "Replace cash collection with digital ops for microfinance",
    icon: Fingerprint,
    category: "agent-banking",
    priority: 1,
    trustStrip: [
      // "Used by 50+ MFIs",
      // "JLG & SHG ready",
      // "NaBFID & RBI compliant"
      "RBI compliant",
      // "NaBFID aligned",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Enable MFI field officers to collect repayments biometrically, disburse loans directly to borrower accounts, and complete KYC paperlessly — all from a mobile device in the field.",
    packApis: [
      {
        apiId: "aeps",
        nameOverride: "AePS Cashout",
        what: "Aadhaar-authenticated biometric repayment collection at borrower's doorstep.",
        why: "Replaces cash collection with biometric proof — eliminates misappropriation and provides an instant audit trail for every EMI.",
      },
      {
        apiId: "aadhaar",
        what: "Verify borrower identity with Aadhaar OTP for KYC compliance.",
        why: "RBI KYC norms require Aadhaar-based identity for MFI borrowers. OTP-based verification works even without biometric devices.",
      },
      {
        apiId: "bank",
        what: "Validate borrower's bank account before disbursal.",
        why: "Many JLG borrowers receive their first formal bank account for MFI lending — verifying it prevents disbursal failures.",
      },
      {
        apiId: "upi-payout",
        nameOverride: "Fund Transfer (Disbursal)",
        what: "Instant loan disbursal directly to borrower's bank account.",
        why: "RBI mandates direct bank account disbursal for microfinance — cash disbursal through field officers is non-compliant.",
      },
      {
        apiId: "digilocker",
        what: "Fetch Aadhaar, ration card, and other KYC documents paperlessly.",
        why: "MFI field officers can complete full KYC from a mobile without physical document collection or storage.",
      },
    ],
    howItWorksSteps: [
      {
        step: 1,
        label: "Field officer visits borrower — mobile app initiates session",
      },
      {
        step: 2,
        label: "Aadhaar Verification — borrower identity confirmed via OTP",
      },
      {
        step: 3,
        label: "Bank Account Verification — disbursal account validated",
      },
      {
        step: 4,
        label: "Fund Transfer — loan amount sent directly to bank account",
      },
      {
        step: 5,
        label: "AePS collection — biometric EMI collection at next visit",
      },
    ],
    industriesUsingSlugs: ["microfinance", "lending-nbfc", "agriculture"],
    comparisonRows: [
      {
        aspect: "EMI collection",
        diy: "Cash + manual ledger",
        eko: "Biometric + instant digital receipt",
      },
      {
        aspect: "Disbursal compliance",
        diy: "Cash = RBI non-compliant",
        eko: "Direct bank transfer = compliant",
      },
      {
        aspect: "KYC documentation",
        diy: "Physical forms + scanning",
        eko: "Paperless via Aadhaar + DigiLocker",
      },
      {
        aspect: "Field officer fraud",
        diy: "High risk with cash",
        eko: "Biometric audit trail eliminates it",
      },
    ],
    pricingBlurb:
      "Pay-per-transaction. No setup fee. Sandbox is free. Special MFI pricing tiers available.",
    faqs: [
      {
        question: "Does AePS work in areas with poor internet connectivity?",
        answer:
          "AePS requires a minimal data connection for biometric authentication. Eko's SDK supports offline queuing — transactions are submitted when connectivity resumes.",
      },
      {
        question:
          "Can one field officer serve borrowers at multiple different banks?",
        answer:
          "Yes. Eko's AePS integration covers NPCI's interoperable network — a single device can process withdrawals from all Aadhaar-linked bank accounts regardless of bank.",
      },
      {
        question: "How does the JLG model work with AePS collection?",
        answer:
          "The system supports group-level session management — a field officer can process multiple borrower collections in a single visit with each Aadhaar (DigiLocker) authentication creating a separate receipt.",
      },
    ],
    relatedSolutions: [
      {
        slug: "assisted-banking-agent-pack",
        name: "Assisted Banking Agent Pack",
        tagline: "Full agent banking bundle for kirana & CSP",
      },
      {
        slug: "rural-financial-services-pack",
        name: "Rural Financial Services Pack",
        tagline: "Rural disbursals + basic KYC verification",
      },
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        tagline: "Full KYC for borrower onboarding",
      },
    ],
    seo: {
      title: "MFI Field Operations Pack",
      description:
        "Digital field operations for microfinance — biometric EMI collection via AePS, paperless KYC, RBI-compliant disbursals. NABFID & RBI ready.",
      keywords:
        "mfi field collection api, microfinance digital collection, aeps for microfinance, mfi api india",
    },
  },

  /* ── 6. Employee BGV Pack ────────────────────────────────────── */
  {
    slug: "employee-bgv-pack",
    name: "Employee BGV Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Run instant background verification on new hires — identity, address, employment history, criminal records, and education — in one API bundle.",
    tagline: "Instant employee background checks in one API call",
    navDescription: "Identity + employment + address verification for HR teams",
    icon: ShieldCheck,
    category: "hr-workforce",
    priority: 1,
    trustStrip: [
      // "Used by 200+ HR platforms",
      "Used by 500+ companies",
      "DPDP aligned",
      "Instant results",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Complete a new employee's background verification — identity, address, employment history, and education — in under 5 minutes, with zero manual effort.",
    packApis: [
      {
        apiId: "pan",
        what: "Verify the employee's PAN for identity and tax compliance.",
        why: "Required for TDS compliance on salary and is the primary government-issued identity for employment records.",
      },
      {
        apiId: "aadhaar",
        what: "Confirm current address and biometric identity.",
        why: "Provides address verification and biometric identity in one step — critical for field employees and delivery workers.",
      },
      {
        apiId: "employee",
        nameOverride: "Employee Verification (EPFO)",
        what: "Verify employment history via EPFO PRAN records.",
        why: "Checks all past employers registered with EPFO — no need to call previous employers manually.",
      },
      {
        apiId: "dl",
        nameOverride: "Driving Licence Verification",
        what: "Verify DL authenticity and traffic violation history.",
        why: "Mandatory for driver, delivery, and field workforce roles. Catches fake or suspended licences before onboarding.",
      },
      {
        apiId: "digilocker",
        nameOverride: "DigiLocker (Educational Documents)",
        what: "Fetch degree certificates and marksheets directly from DigiLocker.",
        why: "Eliminates educational document forgery — the leading form of BGV fraud in India.",
      },
      {
        apiId: "geocoding",
        what: "Convert GPS coordinates to verifiable address for field employee visits.",
        why: "Validates that the address provided during onboarding matches the physical location — critical for blue-collar workers.",
      },
      {
        apiId: "voter-id",
        what: "Verify Voter ID (EPIC) for additional identity confirmation.",
        why: "An alternative government-issued ID when employees don't have PAN or Aadhaar — common for informal sector workers.",
      },
      {
        apiId: "passport",
        what: "Verify passport details for employees in international or travel roles.",
        why: "Mandatory for roles involving international travel — confirms document validity and matches holder identity.",
      },
      {
        apiId: "name-match",
        what: "Fuzzy name matching across all submitted identity documents.",
        why: "Catches name discrepancies across PAN, Aadhaar, DL, and employment records that indicate identity fraud.",
      },
      {
        apiId: "email",
        what: "Verify employee email address deliverability.",
        why: "Confirms the contact email is valid and reachable — important for offer letters, payroll communications, and DPDP consent.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Employee submits mobile number" }, //Employee submits mobile number + Aadhaar — OTP authentication
      { step: 2, label: "PAN — identity confirmed" },
      { step: 3, label: "DigiLocker — Aadhaar fetched for verification" },
      { step: 4, label: "EPFO lookup — employment history verified" },
      { step: 5, label: "DigiLocker — education documents fetched" },
      { step: 6, label: "BGV report generated — hire/no-hire recommendation" },
    ],
    industriesUsingSlugs: [
      "staffing-hr",
      "logistics-fleet",
      "e-commerce",
      "healthcare",
    ],
    comparisonRows: [
      {
        aspect: "Verification time",
        diy: "5–10 business days",
        eko: "Under 5 minutes",
      },
      {
        aspect: "Employment history source",
        diy: "Reference calls",
        eko: "EPFO PRAN records — authoritative",
      },
      {
        aspect: "Education verification",
        diy: "University email + waiting",
        eko: "DigiLocker — tamper-proof",
      },
      {
        aspect: "Cost per BGV",
        diy: "₹500–2000 per hire",
        eko: "Pay-per-API — <₹50 total",
      },
    ],
    pricingBlurb:
      "Pay-per-verification. No setup fee. Sandbox is free. Volume pricing at 1,000+ monthly BGVs.",
    faqs: [
      {
        question: "Is consent required for EPFO lookup?",
        answer:
          "Yes. Eko's Employee Verification API includes a consent flow compliant with DPDP Act 2023. The employee provides explicit consent before any employment data is fetched.",
      },
      {
        question: "What if an employee hasn't registered with EPFO?",
        answer:
          "For informal workers without EPFO records, the pack falls back to reference check support via our partner network and address verification via Aadhaar (DigiLocker).",
      },
      // { question: "Can I run bulk BGV for 1,000 new hires?", answer: "Yes. All verification APIs support batch mode with async processing and webhook notifications. Bulk runs of 1,000 complete in 30-60 minutes." },
    ],
    relatedSolutions: [
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        tagline: "Fast onboarding for gig & delivery workers",
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        tagline: "KYB verification for merchants & sellers",
      },
    ],
    seo: {
      title: "Employee BGV Pack — Background Verification APIs",
      description:
        "Instant employee background verification — identity, EPFO employment history, education, DL in under 5 minutes. Used by 500+ companies across India.",
      keywords:
        "employee background verification api india, bgv api, epfo verification api, hr onboarding api india",
    },
  },

  /* ── 7. Rural Financial Services Pack ───────────────────────── */
  {
    slug: "rural-financial-services-pack",
    name: "Rural Financial Services Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "A lighter financial services bundle for rural-focused platforms — AePS cashout, basic KYC, and instant transfers for last-mile financial access.",
    tagline: "Last-mile financial access for Tier 3+ markets",
    navDescription: "AePS + basic KYC bundle for rural & last-mile platforms",
    icon: Globe,
    category: "agent-banking",
    priority: 2,
    trustStrip: [
      "Serves Tier 3 & beyond",
      "Works with 2G connectivity",
      "NPCI & RBI compliant",
    ],
    jobStatement:
      "Bring cash withdrawal, instant money transfer, and basic KYC to rural India — using only Aadhaar and a biometric device, with no smartphone required for the end user.",
    packApis: [
      {
        apiId: "aeps",
        nameOverride: "AePS Cashout",
        what: "Aadhaar-authenticated biometric cash withdrawal at any agent point.",
        why: "The primary financial service for rural Indians — withdraw government subsidies (DBT), wages, and loan disbursals without a bank branch.",
      },
      {
        apiId: "aadhaar",
        what: "Basic identity verification for new account and wallet onboarding.",
        why: "Aadhaar-based eKYC is the cheapest and fastest onboarding path for rural customers with no other documents.",
      },
      {
        apiId: "bank",
        what: "Validate Jan Dhan or any rural bank account via penny drop.",
        why: "Confirms PM-JDY account is active before routing DBT or salary transfers.",
      },
      {
        apiId: "upi-payout",
        nameOverride: "Fund Transfer",
        what: "Route DBT, wages, or loan disbursals directly to verified accounts.",
        why: "Closes the last mile — money is deposited into the account that the customer can then withdraw via AePS.",
      },
      {
        apiId: "digilocker",
        what: "Pull Aadhaar, driving licence, and ITR documents paperlessly via DIPP integration.",
        why: "Eliminates document upload friction — borrower consents once and all docs are fetched automatically.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Rural customer visits local agent (kirana / CSP)" },
      {
        step: 2,
        label: "Agent identifies service: DBT withdrawal / money transfer",
      },
      {
        step: 3,
        label: "AePS — Aadhaar + fingerprint → instant cash or transfer",
      },
      { step: 4, label: "Customer receives SMS receipt" },
      { step: 5, label: "Agent earns commission" },
    ],
    industriesUsingSlugs: [
      "agriculture",
      "kirana-retail",
      "microfinance",
      "agent-networks-csp",
    ],
    comparisonRows: [
      {
        aspect: "End-user device needed",
        diy: "Smartphone + internet",
        eko: "Just Aadhaar + fingerprint",
      },
      {
        aspect: "Bank branch proximity",
        diy: "Required",
        eko: "Any kirana shop within 1km",
      },
      {
        aspect: "DBT withdrawal",
        diy: "ATM only (long queue)",
        eko: "Agent point — instant",
      },
    ],
    pricingBlurb:
      "Pay-per-transaction. No setup fee. Sandbox is free. Special rural pricing tiers available for NGOs and SHG platforms.",
    faqs: [
      {
        question: "Works in areas without smartphones?",
        answer:
          "Yes. AePS only requires the customer's Aadhaar number and fingerprint. The agent handles all the technology — the customer needs nothing.",
      },
      {
        question: "Which government schemes use Aadhaar-linked accounts?",
        answer:
          "PM-KISAN, MGNREGA, PM Ujjwala, Pradhan Mantri Awas Yojana, and State DBT programs — all route funds to Aadhaar-linked accounts that can be accessed via AePS.",
      },
    ],
    relatedSolutions: [
      {
        slug: "assisted-banking-agent-pack",
        name: "Assisted Banking Agent Pack",
        tagline: "Full agent banking bundle with BBPS + wallet",
      },
      {
        slug: "dbt-cashout-pack",
        name: "DBT Cashout Pack",
        tagline: "Optimized for government benefit distribution",
      },
    ],
    seo: {
      title: "Rural Financial Services Pack",
      description:
        "Last-mile financial access for Tier 3+ India. AePS cashout + DBT cashout + basic KYC bundle. Works with Aadhaar only — no smartphone needed.",
      keywords:
        "rural banking api india, dbt cashout api, aeps for rural india, jan dhan api, last mile banking api",
    },
  },

  /* ── 8. DBT Cashout Pack ─────────────────────────────────────── */
  {
    slug: "dbt-cashout-pack",
    name: "DBT Cashout Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Enable citizens to withdraw government DBT benefits at agent points — biometric cashout from PM-KISAN, MGNREGA, and all state DBT schemes.",
    tagline: "Government DBT withdrawal at agent points via AePS",
    navDescription: "Enable PM-KISAN, MGNREGA & DBT benefit cashout at agents",
    icon: Receipt,
    category: "agent-banking",
    priority: 1,
    trustStrip: [
      "Critical DBT infrastructure",
      "Used in 500+ districts",
      // "BSC & NPCI certified",
      "RBI compliant",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Let any citizen withdraw their government benefit at the nearest kirana store — using only their Aadhaar number and fingerprint — in under 30 seconds.",
    packApis: [
      {
        apiId: "aeps",
        nameOverride: "AePS Cashout",
        what: "Biometric cash withdrawal from any Aadhaar-linked government scheme account.",
        why: "The only way rural beneficiaries can access DBT funds without an ATM card — serves 100 million+ Jan Dhan account holders.",
      },
      {
        apiId: "aadhaar",
        what: "Verify beneficiary identity before cashout.",
        why: "Prevents impersonation fraud in DBT withdrawals — every transaction is tied to a biometric record.",
      },
      {
        apiId: "bank",
        what: "Confirm seeding of Aadhaar to the DBT recipient bank account.",
        why: "Validates that the correct bank account is linked to the Aadhaar before routing the cashout.",
      },
      {
        apiId: "digilocker",
        what: "Pull Aadhaar, driving licence, and ITR documents paperlessly via DIPP integration.",
        why: "Eliminates document upload friction — borrower consents once and all docs are fetched automatically.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Beneficiary visits agent with Aadhaar number" },
      { step: 2, label: "AePS authentication — fingerprint scan" },
      { step: 3, label: "Balance check — DBT credit confirmed" },
      {
        step: 4,
        label: "Cash dispensed — agent debited, beneficiary credited",
      },
      { step: 5, label: "SMS receipt sent to beneficiary's registered mobile" },
    ],
    industriesUsingSlugs: [
      "agriculture",
      "kirana-retail",
      "agent-networks-csp",
    ],
    comparisonRows: [
      {
        aspect: "Access to DBT",
        diy: "ATM + debit card needed",
        eko: "Aadhaar + fingerprint only",
      },
      {
        aspect: "Outlet density",
        diy: "Bank branch/ATM density",
        eko: "200K+ agent touchpoints",
      },
      {
        aspect: "Transaction time",
        diy: "5–10 min queue at ATM",
        eko: "Under 30 seconds at agent",
      },
    ],
    pricingBlurb:
      "Per-transaction pricing. No setup fee. Sandbox free. Special state government rates available.",
    faqs: [
      {
        question: "Which DBT schemes work with AePS cashout?",
        answer:
          "All Aadhaar-seeded DBT schemes including PM-KISAN, MGNREGA, PM Ujjwala, Pradhan Mantri Awas Yojana, scholarship schemes, and state-level DBT programs.",
      },
      {
        question: "What if the biometric scan fails?",
        answer:
          "Eko's AePS API includes biometric retry logic and UIDAI fallback OTP authentication for elderly customers with worn fingerprints.",
      },
    ],
    relatedSolutions: [
      {
        slug: "rural-financial-services-pack",
        name: "Rural Financial Services Pack",
        tagline: "Full rural banking bundle",
      },
      {
        slug: "assisted-banking-agent-pack",
        name: "Assisted Banking Agent Pack",
        tagline: "Complete agent banking stack",
      },
    ],
    seo: {
      title: "DBT Cashout Pack — Government Benefit Withdrawal API",
      description:
        "Enable DBT benefit cashout at agent points via AePS. PM-KISAN, MGNREGA, and all Aadhaar-linked government schemes. 200K+ agent touchpoints.",
      keywords:
        "dbt cashout api, pm kisan cashout api, mgnrega payment api, aadhaar dbt withdrawal, government benefit disbursement api",
    },
  },

  /* ── 9. Migrant Remittance Hub Pack ─────────────────────────── */
  {
    slug: "migrant-remittance-hub-pack",
    name: "Migrant Remittance Hub Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Optimized for urban migrant corridors — instant cash-to-bank remittance with AePS withdrawal at the receiving end and full compliance.",
    tagline: "Urban-to-rural cash remittance for migrant workers",
    navDescription: "Best-in-class DMT + AePS loop for migrant remittance",
    icon: Banknote,
    category: "agent-banking",
    priority: 2,
    trustStrip: [
      // "₹4,000 Cr+ remitted monthly",
      "Urban → rural in <60 seconds",
      "RBI BC model compliant",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Let a migrant worker send money home from an urban agent and have their family withdraw it at a rural agent — the entire corridor in under 60 seconds.",
    packApis: [
      {
        apiId: "dmt",
        nameOverride: "Domestic Money Transfer (DMT)",
        what: "Cash-to-bank account transfers via IMPS under RBI's BC model.",
        why: "The urban sending leg — migrant gives cash to agent, who sends it to the rural family bank account instantly.",
      },
      {
        apiId: "aeps",
        nameOverride: "AePS Cashout",
        what: "Rural family withdraws at nearest agent using Aadhaar + fingerprint.",
        why: "Closes the remittance loop — the receiving family doesn't need a smartphone, debit card, or bank branch.",
      },
      {
        apiId: "bank",
        what: "Validate beneficiary bank account before registration.",
        why: "Prevents remittance to wrong accounts — one-time verification per beneficiary.",
      },
      {
        apiId: "aadhaar",
        what: "KYC verification for sender and beneficiary registration.",
        why: "RBI BC guidelines require sender KYC for money remittance.",
      },
      {
        apiId: "digilocker",
        what: "Pull Aadhaar, driving licence, and ITR documents paperlessly via DIPP integration.",
        why: "Eliminates document upload friction — borrower consents once and all docs are fetched automatically.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Migrant worker walks into urban agent shop" },
      { step: 2, label: "Beneficiary registered — bank account verified once" },
      { step: 3, label: "DMT — cash accepted, IMPS transfer fires instantly" },
      { step: 4, label: "Family notified via SMS" },
      { step: 5, label: "Family withdraws at rural agent via AePS" },
    ],
    industriesUsingSlugs: [
      "kirana-retail",
      "agent-networks-csp",
      "microfinance",
    ],
    comparisonRows: [
      {
        aspect: "Transfer speed",
        diy: "Bank transfer T+1",
        eko: "IMPS in <30 seconds",
      },
      {
        aspect: "Receiving end",
        diy: "Debit card + ATM needed",
        eko: "AePS — Aadhaar only",
      },
      {
        aspect: "Corridor coverage",
        diy: "Urban bank density only",
        eko: "200K+ agents urban + rural",
      },
    ],
    pricingBlurb:
      "Per-transaction fee. No setup cost. Sandbox free. Volume tiers for high-volume corridors.",
    faqs: [
      // { question: "What is the daily DMT transfer limit?", answer: "Per RBI guidelines, DMT allows up to ₹25,000 per transaction and ₹1 lakh per month per sender for basic KYC customers. Full KYC customers get higher limits." },
      // { question: "Is the sender KYC required for every transaction?", answer: "Sender KYC (Aadhaar + mobile) is required once during registration. Subsequent transactions only require mobile OTP confirmation." },
    ],
    relatedSolutions: [
      {
        slug: "assisted-banking-agent-pack",
        name: "Assisted Banking Agent Pack",
        tagline: "Full agent banking — AePS + DMT + BBPS",
      },
      {
        slug: "rural-financial-services-pack",
        name: "Rural Financial Services Pack",
        tagline: "Rural-focused banking bundle",
      },
    ],
    seo: {
      title: "Migrant Remittance Hub Pack",
      description:
        "Urban-to-rural remittance bundle. DMT for sending, AePS for cashout at village level. Sub-60-second corridor. RBI BC model compliant.",
      keywords:
        "migrant remittance api india, dmt aeps bundle, urban rural remittance api, domestic money transfer rural cashout",
    },
  },

  /* ── 10. Gig Worker Onboarding Pack ─────────────────────────── */
  {
    slug: "gig-worker-onboarding-pack",
    name: "Gig Worker Onboarding Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Fast, compliant onboarding for delivery riders, agents, and gig workers — identity, DL, address, and bank verification in under 3 minutes.",
    tagline: "Onboard delivery & gig workers in under 3 minutes",
    navDescription: "DL + identity + bank verification for gig platforms",
    icon: Truck,
    category: "hr-workforce",
    priority: 2,
    trustStrip: [
      "Trusted by 500+ companies",
      "DPDP aligned",
      "RBI compliant",
      "5-minute onboarding SLA",
    ],
    jobStatement:
      "Onboard a delivery rider or gig worker in under 3 minutes — verify identity, driving licence, vehicle ownership, and payment account in a single mobile flow.",
    packApis: [
      {
        apiId: "aadhaar",
        what: "Verify identity and current address via Aadhaar OTP.",
        why: "Simplest KYC path for gig workers — most have only Aadhaar + phone as identity.",
      },
      {
        apiId: "pan",
        what: "Verify PAN for TDS deduction on gig earnings.",
        why: "Mandatory for platforms deducting TDS Section 194C on payments to gig workers.",
      },
      {
        apiId: "dl",
        nameOverride: "Driving Licence Verification",
        what: "Validate DL authenticity, expiry, and vehicle category.",
        why: "Critical for delivery platforms — ensures only licensed riders are onboarded. Checks for suspension.",
      },
      {
        apiId: "rc",
        what: "Verify vehicle registration certificate, insurance validity, and complete vehicle details.",
        why: "Platforms face liability if uninsured vehicles are on their network — RC check prevents this.",
      },
      {
        apiId: "bank",
        what: "Validate the worker's payout bank account.",
        why: "Gig workers switch bank accounts frequently — verify before each earnings cycle to avoid failed payouts.",
      },
      {
        apiId: "digilocker",
        what: "Pull Aadhaar, driving licence, and ITR documents paperlessly via DIPP integration.",
        why: "Eliminates document upload friction — borrower consents once and all docs are fetched automatically.",
      },
      {
        apiId: "e-challan",
        what: "Check pending traffic challans for the rider's vehicle.",
        why: "Identifies riders with unresolved traffic violations before onboarding — reduces platform liability for reckless drivers.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Worker opens app — enters mobile number" },
      { step: 2, label: "PAN — identity verified" },
      { step: 3, label: "DigiLocker — Aadhaar fetched for verification" },
      { step: 4, label: "DL + RC — vehicle eligibility confirmed" },
      {
        step: 5,
        label: "Bank Account Verification — payout account registered",
      },
      { step: 6, label: "Worker approved and active on platform" },
    ],
    industriesUsingSlugs: ["logistics-fleet", "e-commerce", "staffing-hr"],
    comparisonRows: [
      {
        aspect: "Onboarding time",
        diy: "2–3 days manual review",
        eko: "Under 3 minutes",
      },
      {
        aspect: "DL fake check",
        diy: "Manual scan + police check",
        eko: "Real-time Sarathi database",
      },
      {
        aspect: "Vehicle insurance check",
        diy: "Physical document scan",
        eko: "Automated via RC API",
      },
    ],
    pricingBlurb:
      "Pay-per-verification. No setup fee. Sandbox free. Volume tiers at 1,000+ weekly onboardings.",
    faqs: [
      {
        question: "Can I re-verify DL validity periodically?",
        answer:
          "Yes. The DL Verification API can be called at any frequency — many platforms re-verify monthly to catch expired or suspended licences.",
      },
      {
        question: "What happens if the RC insurance has expired?",
        answer:
          "The RC Verification returns insurance expiry date. Your platform can configure automatic partner deactivation on expiry — Eko provides the data, the business logic stays with you.",
      },
    ],
    relatedSolutions: [
      {
        slug: "employee-bgv-pack",
        name: "Employee BGV Pack",
        tagline: "Full background check for salaried employees",
      },
      {
        slug: "fleet-compliance-pack",
        name: "Fleet Compliance Pack",
        tagline: "Vehicle compliance for fleet operators",
      },
    ],
    seo: {
      title: "Gig Worker Onboarding Pack",
      description:
        "Onboard delivery riders & gig workers in 3 minutes — DL, RC, Aadhaar, bank verification. Used by 500+ companies across India.",
      keywords:
        "gig worker onboarding api, delivery driver verification api india, dl verification api, gig platform kyc india",
    },
  },

  /* ── 11. Fleet Compliance Pack ───────────────────────────────── */
  {
    slug: "fleet-compliance-pack",
    name: "Fleet Compliance Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Maintain regulatory compliance for vehicle fleets — RC, insurance, permit, and driver licence verification in one API bundle.",
    tagline: "RC + DL + insurance compliance for fleet operators",
    navDescription:
      "Automated fleet compliance — RC, insurance & driver checks",
    icon: Truck,
    category: "fleet-motor",
    priority: 1,
    trustStrip: [
      // "Used by 100+ fleet operators",
      // "MORTH database connected",
      // "Daily compliance monitoring",
      "Trusted by 50,000+ businesses",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Automate fleet regulatory compliance — verify and monitor RC, insurance, permits, and driver licences across your entire fleet daily, with alerts before expiry.",
    packApis: [
      {
        apiId: "rc",
        what: "Fetch complete vehicle data — RC status, owner, insurance expiry, chassis, engine, blacklist status, and financier.",
        why: "Core compliance check — identifies uninsured, expired, stolen, or financed vehicles before adding them to a fleet.",
      },
      {
        apiId: "dl",
        nameOverride: "Driving Licence Verification",
        what: "Validate driver licence and check suspension status.",
        why: "Fleet operators are liable for accidents involving drivers with expired or suspended licences.",
      },
      {
        apiId: "geocoding",
        what: "Convert GPS coordinates to address for driver location verification.",
        why: "Enables geofencing and route compliance — verify drivers are operating in permitted zones.",
      },
      {
        apiId: "e-challan",
        what: "Check pending traffic challans across all fleet vehicles.",
        why: "Identifies vehicles with unresolved challans — unpaid challans can lead to impounding during compliance checks.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Vehicle onboarded — RC number fetched & verified" },
      {
        step: 2,
        label: "Driver assigned — DL verified & active status confirmed",
      },
      {
        step: 3,
        label: "Daily batch job — all RCs & DLs re-checked for expiry",
      },
      { step: 4, label: "Alerts fired 30 days before insurance / DL expiry" },
      { step: 5, label: "Compliance dashboard updated in real time" },
    ],
    industriesUsingSlugs: ["logistics-fleet", "automotive", "e-commerce"],
    comparisonRows: [
      {
        aspect: "Compliance monitoring",
        diy: "Manual tracking in spreadsheets",
        eko: "Automated daily API batch",
      },
      {
        aspect: "Expiry alerts",
        diy: "None — discover on road",
        eko: "30-day advance warnings",
      },
      {
        aspect: "Stolen vehicle check",
        diy: "Police inquiry",
        eko: "Real-time blacklist check via API",
      },
    ],
    pricingBlurb:
      "Pay-per-look-up. No setup fee. Sandbox free. Bulk pricing for fleets of 1,000+ vehicles.",
    faqs: [
      {
        question: "Can I check vehicles across multiple states?",
        answer:
          "Yes. Eko's Vehicle & RC Verification API covers all state RTOs via the VAHAN national database, with 99% coverage of registered vehicles.",
      },
      {
        question: "How often can I run compliance checks?",
        answer:
          "Daily batch runs are most common. Some premium fleet operators run real-time checks at every trip start. Pricing is per-API call.",
      },
    ],
    relatedSolutions: [
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        tagline: "Onboarding for delivery & gig workers",
      },
      {
        slug: "employee-bgv-pack",
        name: "Employee BGV Pack",
        tagline: "Full background verification for drivers",
      },
    ],
    seo: {
      title: "Fleet Compliance Pack — Vehicle RC & DL Verification API",
      description:
        "Automate fleet regulatory compliance — vehicle RC, insurance, DL verification daily. Automated expiry alerts. Covers all state RTOs via VAHAN database.",
      keywords:
        "fleet compliance api india, vehicle rc verification api, vehicle insurance check api, dl verification fleet, fleet management api",
    },
  },

  /* ── 12. Motor Insurance Pack ────────────────────────────────── */
  {
    slug: "motor-insurance-pack",
    name: "Motor Insurance Pack",
    eyebrow: "SOLUTION PACK",
    heroSubtitle:
      "Pre-built verification bundle for motor insurance workflows — vehicle RC details, ownership, insurance history, and driver verification in minutes.",
    tagline: "Vehicle RC + owner verification for motor insurance",
    navDescription: "Vehicle RC + driver KYC for motor insurers",
    icon: ShieldCheck,
    category: "fleet-motor",
    priority: 2,
    trustStrip: [
      // "Used by 20+ insurers",
      // "IRDAI data norms compliant",
      "Sub-30-second verification",
      "Reliable, high-volume workflows",
    ],
    jobStatement:
      "Verify vehicle details, ownership, and driver eligibility in under 30 seconds — enabling instant motor insurance quotes and policy issuance without manual form filling.",
    packApis: [
      {
        apiId: "rc",
        what: "Fetch complete vehicle data from VAHAN — chassis, engine, make/model, fuel type, ownership, RC status, and previous insurance.",
        why: "Pre-fills the policy application with verified vehicle data and checks previous insurance history — required for accurate premium calculation and lapse detection.",
      },
      {
        apiId: "dl",
        nameOverride: "Driving Licence Verification",
        what: "Verify the policyholder's driving licence validity and suspensions.",
        why: "Affects risk underwriting — suspended or invalid licences change the risk profile significantly.",
      },
      {
        apiId: "pan",
        what: "Verify policyholder identity for premium above ₹50,000.",
        why: "IRDAI mandates PAN verification for high-premium policies and for tax deductions on claims.",
      },
      {
        apiId: "e-challan",
        what: "Fetch pending traffic challans and violation history for the vehicle.",
        why: "Challan history indicates driving behavior risk — affects premium calculation and underwriting decisions.",
      },
    ],
    howItWorksSteps: [
      { step: 1, label: "Customer enters vehicle registration number" },
      {
        step: 2,
        label:
          "Vehicle & RC Verification — make, model, engine, ownership & insurance pre-filled",
      },
      { step: 3, label: "DL Verification — driver risk profile assessed" },
      { step: 4, label: "Instant quote generated — policy issued in minutes" },
    ],
    industriesUsingSlugs: ["insurance", "automotive", "logistics-fleet"],
    comparisonRows: [
      {
        aspect: "Vehicle data collection",
        diy: "Manual form fill by customer",
        eko: "Auto-fetched from VAHAN",
      },
      {
        aspect: "Previous insurance check",
        diy: "Self-declaration (fraud risk)",
        eko: "Verified from Vehicle RC record",
      },
      {
        aspect: "Policy issuance time",
        diy: "24 hours",
        eko: "Under 10 minutes",
      },
    ],
    pricingBlurb:
      "Pay-per-verification. No setup fee. Sandbox free. Insurance-sector volume pricing available.",
    faqs: [
      {
        question: "Does Eko provide claims verification too?",
        answer:
          "Currently the Motor Insurance Pack covers the underwriting/onboarding workflow. Claims verification APIs are on the roadmap. Contact sales for early access.",
      },
      {
        question: "What data does the Vehicle & RC Verification API return?",
        answer:
          "Make, model, fuel type, engine number, chassis number, registration date, owner name, registration state, insurance details, blacklist status, permit info, and financing status — 50+ fields in a single call.",
      },
    ],
    relatedSolutions: [
      {
        slug: "fleet-compliance-pack",
        name: "Fleet Compliance Pack",
        tagline: "Ongoing fleet RC & DL compliance monitoring",
      },
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        tagline: "Vehicle & driver onboarding for gig platforms",
      },
    ],
    seo: {
      title: "Motor Insurance Pack — Vehicle & RC Verification API",
      description:
        "Instant motor insurance with auto-filled vehicle details. Vehicle RC, DL, PAN verification in 30 seconds. Used by 500+ companies across India.",
      keywords:
        "motor insurance verification api, vehicle rc verification api india, rc api for insurance, irdai api india",
    },
  },
];

/** Strip references to products not in the active products list */
function stripInactiveApis(solution: SolutionData): SolutionData {
  const isActive = (apiId?: string) => !apiId || !!ACTIVE_PRODUCTS_MAP[apiId];
  return {
    ...solution,
    packApis: solution.packApis.filter((a) => isActive(a.apiId)),
    howItWorksSteps: solution.howItWorksSteps.filter((s) => isActive(s.apiId)),
  };
}

/** Map of solution slug to SolutionData, with inactive product references stripped */
export const SOLUTIONS_MAP: Record<string, SolutionData> = Object.fromEntries(
  SOLUTIONS_LIST.map((s) => [s.slug, stripInactiveApis(s)]),
);

/** SOLUTIONS_LIST with inactive product references stripped, and solutions with no remaining APIs excluded */
export const ACTIVE_SOLUTIONS_LIST: SolutionData[] = SOLUTIONS_LIST.map(
  stripInactiveApis,
).filter((s) => s.packApis.length > 0);

/**
 * Return up to `maxCount` solution packs whose `packApis` include the given API id,
 * shuffled randomly so the selection varies across page loads.
 */
export function getSolutionPacksForApi(
  apiId: string,
  maxCount = 3,
): SolutionData[] {
  const matching = ACTIVE_SOLUTIONS_LIST.filter((s) =>
    s.packApis.some((a) => a.apiId === apiId),
  );
  // Fisher-Yates shuffle
  for (let i = matching.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matching[i], matching[j]] = [matching[j], matching[i]];
  }
  return matching.slice(0, maxCount);
}
