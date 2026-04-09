import type { LucideIcon } from "lucide-react";
import {
  Landmark, Users, Shield, Store, Globe, Building2,
  Briefcase, Truck, ShoppingCart, Sprout, Car, Plane,
  GraduationCap, Heart, Home, Calculator, Zap,
  Fingerprint, FileText, Banknote, Receipt, BarChart3,
  CheckCircle, ShieldCheck, Layers,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────── */
/*  TYPES                                                          */
/* ─────────────────────────────────────────────────────────────── */

export interface ApiGridItem {
  apiId: string;
  name: string;
  description: string;
  href: string;
  relevance: "H" | "M" | "L";
}

export interface RecommendedPack {
  slug: string;
  name: string;
  description: string;
  apis: string[];
  featured?: boolean;
}

export interface UseCaseVignette {
  title: string;
  situation: string;
  integration: string;
  outcome: string;
}

export interface WhyEkoDiff {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface ComplianceItem {
  title: string;
  description: string;
}

export interface IndustryFAQ {
  question: string;
  answer: string;
}

export interface RelatedIndustry {
  slug: string;
  name: string;
}

export type IndustryCategory =
  | "financial-services"
  | "agent-retail"
  | "digital-tech"
  | "workforce-fleet"
  | "sector-specific";

export interface IndustryData {
  slug: string;
  name: string;
  eyebrow: string;
  h1: string;
  heroSubtitle: string;
  trustStrip: string[];
  challengeText: string;
  recommendedPacks: RecommendedPack[];
  apiGrid: ApiGridItem[];
  useCaseVignettes: UseCaseVignette[];
  whyEko: WhyEkoDiff[];
  integrationSteps: { step: number; title: string; description: string }[];
  complianceItems: ComplianceItem[];
  faqs: IndustryFAQ[];
  relatedIndustries: RelatedIndustry[];
  seo: { title: string; description: string; keywords: string };
  /** For cards & nav */
  icon: LucideIcon;
  category: IndustryCategory;
  navDescription: string;
}

/* ─────────────────────────────────────────────────────────────── */
/*  SHARED INTEGRATION STEPS (same 5-step strip as DMT page)       */
/* ─────────────────────────────────────────────────────────────── */

const DEFAULT_INTEGRATION_STEPS = [
  { step: 1, title: "Sign Up", description: "Create an account on Connect App and get your sandbox credentials." },
  { step: 2, title: "Submit KYC", description: "Complete your business KYC verification process." },
  { step: 3, title: "Integrate APIs", description: "Use our comprehensive documentation to integrate the APIs." },
  { step: 4, title: "Test in Sandbox", description: "Test your integration thoroughly in our sandbox environment." },
  { step: 5, title: "Go Live", description: "Get production credentials and start processing real transactions." },
];

/* ─────────────────────────────────────────────────────────────── */
/*  INDUSTRIES DATA                                                 */
/* ─────────────────────────────────────────────────────────────── */

export const INDUSTRIES_LIST: IndustryData[] = [
  /* ── 1. Lending & NBFC ──────────────────────────────────────── */
  {
    slug: "lending-nbfc",
    name: "Lending & NBFC",
    eyebrow: "INDUSTRY",
    h1: "Lending & NBFC APIs for India's digital lenders",
    heroSubtitle:
      "From borrower onboarding to instant disbursal to digital collections — Eko gives NBFCs, fintech lenders, and co-lending partners a single API stack that's RBI-compliant out of the box.",
    trustStrip: [
    //   "Trusted by 200+ lenders",
      "RBI Digital Lending compliant",
      "99.9% uptime",
    //   "₹15,000 Cr+ disbursed monthly through Eko rails",
    ],
    challengeText:
      "India has 63 million underserved MSMEs and 500+ million credit-eligible adults — but onboarding them, assessing their creditworthiness, and disbursing funds compliantly has been a six-vendor, six-contract problem. The RBI's Digital Lending Directions add a layer of complexity around verified bank accounts, direct disbursal, and borrower KYC that small NBFCs struggle to meet without dedicated tech teams.\n\nEko consolidates the entire lending workflow — KYC, credit assessment, disbursal, and collection — into a single API platform with one contract, one dashboard, and one integration partner.",
    recommendedPacks: [
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Everything a digital lender needs to onboard a borrower in under 90 seconds.",
        apis: ["PAN Advanced", "Bank Verification", "DigiLocker", "Aadhaar Verification", "GST Verification", "Fund Transfer"],
        featured: true,
      },
      {
        slug: "msme-credit-assessment-pack",
        name: "MSME Credit Assessment Pack",
        description: "Assess MSME creditworthiness using GST filing patterns, ITR history, and bank account validation — no traditional credit score required.",
        apis: ["GSTIN Verify", "PAN Advanced", "Bank Verification", "GST Verification"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification (Advanced)", description: "Fetch full borrower identity in <2 seconds", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification (Penny Drop)", description: "Confirm payout account before disbursal", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "digilocker", name: "DigiLocker", description: "Pull Aadhaar, driving licence, marksheets paperlessly", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Cross-check identity to prevent mule accounts", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "payment", name: "Fund Transfer (NEFT/IMPS/UPI)", description: "Disburse loans instantly to verified accounts", href: "/products/payment-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Collect EMIs nationwide via Bharat Connect", href: "/products/bbps-api", relevance: "H" },
      { apiId: "gst", name: "GSTIN Verification", description: "For MSME credit assessment", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "aeps", name: "AePS Cashout", description: "Enable rural borrowers to withdraw disbursed funds at agent points", href: "/products/aeps-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Personal loan onboarding in 90 seconds",
        situation: "A digital lender wants to onboard a salaried borrower from app download to disbursal in under two minutes.",
        integration: "They integrate the Lending KYC Pack: borrower enters mobile → OTP → PAN → DigiLocker auto-pulls Aadhaar → bank account penny-drop → loan disbursed via UPI.",
        outcome: "4x conversion improvement, 60% drop in fraud applications.",
      },
      {
        title: "MSME working capital, no credit score needed",
        situation: "A new-age NBFC wants to lend to kirana stores that have no credit history.",
        integration: "They use the MSME Credit Assessment Pack to pull GST filing patterns (a cash-flow proxy) plus bank account validation.",
        outcome: "₹10 Cr disbursed in 3 months to previously rejected borrowers.",
      },
      {
        title: "Co-lending portfolio verification",
        situation: "A bank partnering with a fintech lender under RBI co-lending guidelines must verify every borrower in a 50,000-loan portfolio.",
        integration: "They use Bulk PAN + Bulk Bank Account Verification to reconcile the portfolio overnight.",
        outcome: "Monthly compliance reporting that took 2 weeks now takes 2 hours.",
      },
      {
        title: "Rural disbursal with AePS withdrawal",
        situation: "A rural-focused NBFC disburses loans to farmers' bank accounts but borrowers struggle to withdraw without nearby ATMs.",
        integration: "They add AePS Cashout to their stack — borrowers withdraw at any of Eko's 200K+ agent touchpoints using fingerprint.",
        outcome: "30% improvement in customer satisfaction, faster recycling of working capital.",
      },
    ],
    whyEko: [
      { title: "Instant disbursal across all rails", description: "UPI, IMPS, NEFT, RTGS with smart routing for highest success rates.", icon: Zap },
      { title: "RBI Digital Lending compliant", description: "Direct RE-to-borrower disbursal, verified bank accounts, full audit trail.", icon: Shield },
      { title: "Built-in fraud prevention", description: "Name Match, IP velocity checks, GST cross-validation, biometric authentication.", icon: ShieldCheck },
      { title: "Scales from startup to enterprise", description: "Same APIs power 5-loan-a-day pilots and 50,000-loan-a-day production systems.", icon: Building2 },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "RBI Digital Lending Directions", description: "Eko's Fund Transfer, Bank Verification, and KYC stack are designed for direct RE-to-borrower flows." },
      { title: "CKYC upload within 3 days", description: "Automated via Eko's KYC bundle." },
      { title: "PMLA/AML compliance", description: "Name Match, IP Verification, and Reverse Geocoding for enhanced due diligence." },
    ],
    faqs: [
      { question: "Is Eko's Fund Transfer API compliant with RBI Digital Lending Directions?", answer: "Yes. Eko's fund transfer API is designed for direct RE-to-borrower disbursals with full audit trails meeting RBI Digital Lending Direction requirements." },
      { question: "Can I bulk-verify 50,000 borrowers in a single batch?", answer: "Yes. Eko supports bulk PAN and bank account verification via asynchronous batch APIs with webhook notifications. A batch of 50,000 typically completes in 2–4 hours." },
      { question: "How does Eko's Name Match handle regional name variations?", answer: "Our name-match engine uses fuzzy matching with regional transliteration support, handling variations across Hindi, Tamil, Telugu, Kannada, and Bengali name structures." },
      { question: "What's the typical sandbox-to-production timeline for an NBFC?", answer: "Most NBFCs complete sandbox testing in 1–3 days and go live within 5–7 business days." },
      { question: "Do you support co-lending portfolio reconciliation?", answer: "Yes. Bulk verification APIs support portfolio-level reconciliation for NBFC-bank co-lending workflows." },
      { question: "How does the AePS Cashout option help my rural borrowers?", answer: "Rural borrowers can withdraw disbursed funds at any of Eko's 200K+ agent touchpoints using just Aadhaar + fingerprint — no ATM or bank branch required." },
      { question: "Is there a minimum monthly transaction commitment?", answer: "No minimum commitment. Production accounts have no mandatory minimum, though volume pricing tiers start at 1,000 monthly API calls." },
    ],
    relatedIndustries: [
      { slug: "microfinance", name: "Microfinance" },
      { slug: "marketplaces", name: "Marketplaces" },
      { slug: "insurance", name: "Insurance" },
    ],
    seo: {
      title: "Lending & NBFC APIs | Eko Platform Services",
      description: "RBI-compliant API stack for digital lenders in India. PAN, bank, DigiLocker, instant disbursal, BBPS collection. Sandbox in minutes.",
      keywords: "lending api india, nbfc api platform, kyc api for lending, digital lending api india, rbi digital lending api",
    },
    icon: Landmark,
    category: "financial-services",
    navDescription: "KYC, disbursal & EMI collection for digital lenders",
  },

  /* ── 2. Microfinance ────────────────────────────────────────── */
  {
    slug: "microfinance",
    name: "Microfinance",
    eyebrow: "INDUSTRY",
    h1: "Microfinance APIs for India's MFIs",
    heroSubtitle: "Digitize field operations — from group loan disbursals to biometric collections — with a single API stack built for India's microfinance sector.",
    trustStrip: [
		// "Trusted by 50+ MFIs",
		"NPCI compliant",
		"99.9% uptime"
	],
    challengeText: "India's 10,000+ MFIs serve over 60 million borrowers — yet most still rely on cash collection, paper receipts, and manual reconciliation. The result is high operational costs, fraud risk, and delayed reporting. Eko brings MFI field operations into the digital age with biometric authentication, instant disbursals, and digital collection rails.",
    recommendedPacks: [
      { slug: "mfi-field-operations-pack", name: "MFI Field Operations Pack", description: "Digitize field collection and disbursal with AePS + DMT.", apis: ["AePS", "DMT", "Bank Verification", "Mobile OTP"], featured: true },
      { slug: "lending-kyc-pack", name: "Lending KYC Pack", description: "Full borrower KYC for group and individual loans.", apis: ["PAN Advanced", "Bank Verification", "DigiLocker", "Aadhaar"] },
      { slug: "rural-financial-services-pack", name: "Rural Financial Services Pack", description: "Bring banking to underserved areas.", apis: ["AePS", "DMT", "BBPS", "PAN"] },
    ],
    apiGrid: [
      { apiId: "aeps", name: "AePS Cashout", description: "Biometric cash withdrawal for borrowers and field agents", href: "/products/aeps-api", relevance: "H" },
      { apiId: "dmt", name: "DMT", description: "Instant loan disbursals to borrower bank accounts", href: "/products/dmt-api", relevance: "H" },
      { apiId: "bank", name: "Bank Verification", description: "Verify borrower accounts before disbursal", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "KYC identity check for borrowers", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Biometric-linked identity for rural borrowers", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Digital EMI collection via Bharat Connect", href: "/products/bbps-api", relevance: "M" },
    ],
    useCaseVignettes: [
      { title: "Digital group loan disbursal", situation: "An MFI disburses group loans to 500 borrowers weekly.", integration: "DMT API sends funds directly to verified bank accounts. AePS enables cash withdrawal at local agents.", outcome: "Disbursal time cut from 3 days to same-day. 40% reduction in cash handling costs." },
      { title: "Biometric field collection", situation: "Field officers collect EMIs door-to-door with cash.", integration: "AePS-based biometric collection replaces cash. Each repayment is instantly recorded and reconciled.", outcome: "Zero cash leakage, real-time portfolio reporting, 25% lower operational cost." },
    ],
    whyEko: [
      { title: "Built for rural India", description: "AePS works with just Aadhaar + fingerprint — no smartphone needed.", icon: Fingerprint },
      { title: "Real-time reconciliation", description: "Every disbursal and collection is instantly logged — no end-of-day manual reconciliation.", icon: BarChart3 },
      { title: "Dual AePS gateway", description: "FingPay + FINO gateways ensure high success rates even in low-connectivity areas.", icon: Layers },
      { title: "Field-tested at scale", description: "Powering 200K+ agent touchpoints across Tier 2–5 India.", icon: Users },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "RBI NBFC-MFI Directions", description: "Eko's stack supports group lending workflows with verified borrower accounts." },
      { title: "PMLA/AML compliance", description: "Aadhaar verification and biometric authentication for enhanced due diligence." },
    ],
    faqs: [
      { question: "Does AePS work in areas with poor connectivity?", answer: "Yes. AePS transactions require minimal bandwidth and Eko's dual-gateway ensures fallback routing for maximum success rates." },
      { question: "Can field officers use their own biometric devices?", answer: "Eko supports 5 STQC-certified devices. Field officers can use any supported device with the Eko agent app." },
      { question: "How does bulk disbursal work for group loans?", answer: "Upload a batch of beneficiaries via API. Eko verifies accounts and disburses via DMT/IMPS with webhook status updates." },
    ],
    relatedIndustries: [
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "agent-networks-csp", name: "Agent Networks (CSP/BC)" },
      { slug: "agriculture", name: "Agriculture" },
    ],
    seo: {
      title: "Microfinance APIs | Eko Platform Services",
      description: "Digitize MFI field operations — AePS biometric collection, instant disbursal, group loan management. NPCI compliant. Trusted by 50+ MFIs.",
      keywords: "mfi api india, microfinance digital collection api, aeps for mfi, field collection api india",
    },
    icon: Users,
    category: "financial-services",
    navDescription: "Digitize field collection & disbursal for MFIs",
  },

  /* ── 3. Insurance ───────────────────────────────────────────── */
  {
    slug: "insurance",
    name: "Insurance",
    eyebrow: "INDUSTRY",
    h1: "Insurance APIs for India's insurers & InsurTech",
    heroSubtitle: "Verify policyholders, auto-fill motor proposals, and accelerate claims with instant verification APIs — IRDAI compliant.",
    trustStrip: [
		// "Used by 20+ insurers",
		"Trusted by 50,000+ businesses",
		// "IRDAI compliant",
		"RBI compliant",
		"99.9% uptime"],
    challengeText: "Insurance underwriting and claims still involve manual document collection. Motor insurance proposals require 5–10 minutes of data entry. Eko's verification APIs auto-fill vehicle details, verify identity, and cross-check driving licences — reducing proposal time to seconds.",
    recommendedPacks: [
      { slug: "motor-insurance-pack", name: "Motor Insurance Pack", description: "Instant motor proposals with auto-filled RC + DL details.", apis: ["RC Verification", "Vehicle Verification", "DL Verification", "PAN"], featured: true },
    ],
    apiGrid: [
      { apiId: "rc", name: "RC Verification", description: "Auto-fill vehicle details from registration number", href: "/products/rc-verification-api", relevance: "H" },
      { apiId: "vehicle", name: "Vehicle Verification", description: "Comprehensive chassis & engine details", href: "/products/vehicle-verification-api", relevance: "H" },
      { apiId: "dl", name: "DL Verification", description: "Verify driving licence validity", href: "/products/dl-verification-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "Policyholder identity verification", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "KYC for high-value policies", href: "/products/aadhaar-verification-api", relevance: "M" },
      { apiId: "bank", name: "Bank Verification", description: "Claims payout account validation", href: "/products/bank-verification-api", relevance: "M" },
    ],
    useCaseVignettes: [
      { title: "Instant motor insurance proposal", situation: "An insurer wants to reduce proposal form time from 10 minutes to 30 seconds.", integration: "RC Verification auto-fills vehicle make, model, year, fuel type. DL Verification confirms the driver.", outcome: "90% reduction in proposal time, 3x increase in conversion." },
      { title: "Claims payout verification", situation: "Claims team needs to verify bank account before disbursing claim settlement.", integration: "Bank Verification (penny drop) confirms account is active and name matches the policyholder.", outcome: "Zero fraudulent claims payouts, instant settlement." },
    ],
    whyEko: [
      { title: "Auto-fill proposals", description: "RC and vehicle APIs return make, model, year, fuel, chassis, engine — one lookup fills the entire form.", icon: Zap },
      { title: "IRDAI compliant", description: "All verification flows designed for insurance regulatory requirements.", icon: Shield },
      { title: "Fraud prevention", description: "Cross-check RC, DL, and PAN to catch identity mismatches before underwriting.", icon: ShieldCheck },
      { title: "Sub-second response", description: "99th percentile latency under 2 seconds for all verification APIs.", icon: Zap },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "IRDAI KYC norms", description: "PAN and Aadhaar verification for policyholder identity." },
      { title: "Motor vehicle regulations", description: "RC and DL verification ensure valid registration and licensed drivers." },
    ],
    faqs: [
      { question: "Can RC Verification auto-fill the entire motor proposal?", answer: "Yes. A single RC lookup returns vehicle make, model, year, fuel type, registration date, chassis number, engine number, and owner name." },
      { question: "Does DL Verification check for violations?", answer: "DL Verification returns licence validity, issue date, expiry, and vehicle classes. Violation history requires a separate RTO integration." },
      { question: "How fast is the verification?", answer: "All verification APIs respond in under 2 seconds. RC and vehicle verification typically complete in 500ms." },
    ],
    relatedIndustries: [
      { slug: "automotive", name: "Automotive" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "logistics-fleet", name: "Logistics & Fleet" },
    ],
    seo: {
      title: "Insurance APIs | Eko Platform Services",
      description: "Instant motor insurance proposals with auto-filled vehicle details. RC, DL, PAN verification. IRDAI compliant. Used by 20+ insurers in India.",
      keywords: "insurance kyc api india, motor insurance verification api, rc api for insurance, irdai api",
    },
    icon: Shield,
    category: "financial-services",
    navDescription: "Auto-fill proposals & verify policyholders instantly",
  },

  /* ── 4. Agent Networks (CSP/BC) ─────────────────────────────── */
  {
    slug: "agent-networks-csp",
    name: "Agent Networks (CSP/BC)",
    eyebrow: "INDUSTRY",
    h1: "Agent Banking APIs for CSP & BC networks",
    heroSubtitle: "Scale your agent network with AePS, DMT, and BBPS — all under Eko's BCNM license. No separate licensing required for individual agents.",
    trustStrip: [
		"200K+ agents served",
		// "BCNM licensed",
		"NPCI & RBI compliant",
		"99.9% uptime",
		// "1.5 Cr+ txn/month"
	],
    challengeText: "Running a BC/CSP network means juggling NPCI compliance, biometric device management, agent onboarding, commission settlement, and multi-gateway routing — all while maintaining 99%+ transaction success rates. Eko provides the complete infrastructure so you focus on distribution, not technology.",
    recommendedPacks: [
      { slug: "assisted-banking-agent-pack", name: "Assisted Banking Agent Pack", description: "AePS + DMT + BBPS for complete agent banking.", apis: ["AePS", "DMT", "BBPS", "PPI DigiKhata", "Mobile OTP", "SMS"], featured: true },
      { slug: "rural-financial-services-pack", name: "Rural Financial Services Pack", description: "Lighter agent stack with PAN + Bank Verification add-ons.", apis: ["AePS", "DMT", "PAN", "Bank Verification"] },
      { slug: "migrant-remittance-hub-pack", name: "Migrant Remittance Hub Pack", description: "Optimized for urban migrant remittance corridors.", apis: ["DMT", "AePS", "Mobile OTP"] },
    ],
    apiGrid: [
      { apiId: "aeps", name: "AePS Cashout", description: "Biometric cash withdrawal — the core agent service", href: "/products/aeps-api", relevance: "H" },
      { apiId: "dmt", name: "DMT", description: "Cash-to-bank remittance for walk-in customers", href: "/products/dmt-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Bill payments that drive daily footfall", href: "/products/bbps-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "Agent and customer KYC", href: "/products/pan-verification-api", relevance: "M" },
      { apiId: "bank", name: "Bank Verification", description: "Validate beneficiary accounts", href: "/products/bank-verification-api", relevance: "M" },
    ],
    useCaseVignettes: [
      { title: "Scale from 100 to 10,000 agents", situation: "A BCNM distributor wants to rapidly scale their network.", integration: "Eko's Assisted Banking Pack provides the complete tech stack. The distributor focuses on recruitment and field support.", outcome: "10x agent growth in 6 months with zero additional engineering headcount." },
      { title: "Urban remittance corridor", situation: "Agents near industrial hubs serve migrant workers sending money home.", integration: "DMT API handles instant IMPS transfers. AePS enables recipients to withdraw at village-level agents.", outcome: "₹50 Cr monthly remittance volume, ₹3 avg cost per transaction." },
    ],
    whyEko: [
      { title: "No separate BC license needed", description: "Eko is the BCNM — individual agents operate under Eko's licence.", icon: Shield },
      { title: "Dual AePS gateway", description: "FingPay + FINO gateways for highest success rates with automatic failover.", icon: Layers },
      { title: "Commission engine built-in", description: "Configurable multi-tier commission structure with daily settlement.", icon: Banknote },
      { title: "5 pre-integrated biometric devices", description: "Mantra, Morpho, Startek and more — no device integration needed.", icon: Fingerprint },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "RBI BC Directions", description: "Eko provides the BCNM infrastructure — agents operate as sub-agents under regulatory cover." },
      { title: "NPCI AePS guidelines (OC 88/91)", description: "Dual-gateway architecture and daily auth comply with NPCI circular requirements." },
    ],
    faqs: [
      { question: "Do agents need individual BC licenses?", answer: "No. Under Eko's BCNM license, individual agents are onboarded as Eko sub-agents. No separate RBI registration required." },
      { question: "What's the agent onboarding process?", answer: "Agent KYC (PAN + Aadhaar + photo), biometric device registration, and daily authentication. Typical activation in 24–48 hours." },
      { question: "How does commission settlement work?", answer: "Eko settles agent commissions daily to their registered bank account or Eko wallet. Configurable multi-tier commission structures for distributors." },
    ],
    relatedIndustries: [
      { slug: "kirana-retail", name: "Kirana & Retail" },
      { slug: "microfinance", name: "Microfinance" },
      { slug: "agriculture", name: "Agriculture" },
    ],
    seo: {
      title: "Agent Banking APIs for CSP & BC | Eko Platform Services",
      description: "Scale your agent network with AePS, DMT, and BBPS under Eko's BCNM license. 200K+ agents, dual AePS gateway, daily commission settlement.",
      keywords: "csp api india, bc agent api, white label aeps, agent banking platform india",
    },
    icon: Users,
    category: "agent-retail",
    navDescription: "Scale BC/CSP operations under Eko's BCNM license",
  },

  /* ── 5. Kirana & Retail ─────────────────────────────────────── */
  {
    slug: "kirana-retail",
    name: "Kirana & Retail",
    eyebrow: "INDUSTRY",
    h1: "Banking APIs for India's kirana stores",
    heroSubtitle: "Turn any neighbourhood shop into a banking touchpoint with cash withdrawal, money transfer, and bill payments — all from a single app.",
    trustStrip: [
		"200K+ retail touchpoints",
		"Pan-India coverage",
		"99.9% uptime",
		// "₹2–25 per txn agent income"
	],
    challengeText: "India's 12 million kirana stores are the most trusted touchpoints in Tier 2–5 India. Yet most can only sell goods. Eko enables any kirana owner to offer banking services — biometric cash withdrawal, money transfer, and bill payments — earning additional income while serving the community.",
    recommendedPacks: [
      { slug: "assisted-banking-agent-pack", name: "Assisted Banking Agent Pack", description: "Complete banking suite — AePS + DMT + BBPS.", apis: ["AePS", "DMT", "BBPS", "PPI DigiKhata", "OTP", "SMS"], featured: true },
      { slug: "migrant-remittance-hub-pack", name: "Migrant Remittance Hub Pack", description: "Optimized for shops near factories and industrial zones.", apis: ["DMT", "AePS", "Mobile OTP"] },
    ],
    apiGrid: [
      { apiId: "aeps", name: "AePS Cashout", description: "Turn your counter into a micro-ATM", href: "/products/aeps-api", relevance: "H" },
      { apiId: "dmt", name: "DMT", description: "Money transfer for walk-in customers", href: "/products/dmt-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Bill payments that bring customers daily", href: "/products/bbps-api", relevance: "H" },
    ],
    useCaseVignettes: [
      { title: "Neighbourhood bank", situation: "A kirana store owner in a Tier 3 town wants extra income.", integration: "Assisted Banking Agent Pack turns the shop into a banking point. AePS, DMT, and BBPS all run from one app.", outcome: "₹15,000–30,000/month additional income from banking commissions." },
    ],
    whyEko: [
      { title: "One app, all services", description: "AePS, DMT, BBPS, and wallet — all from a single agent app on the shop owner's phone.", icon: Store },
      { title: "Earn on every transaction", description: "₹2–25 commission per transaction with daily settlement.", icon: Banknote },
      { title: "No bank branch needed", description: "Serve customers who have no access to banks or ATMs.", icon: Building2 },
      { title: "Brand trust", description: "Eko's RBI-compliant platform builds customer trust in your shop.", icon: Shield },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "RBI BC Directions", description: "Kirana operators work as sub-agents under Eko's BCNM license." },
    ],
    faqs: [
      { question: "How much can a kirana store earn?", answer: "Active agents typically earn ₹15,000–30,000/month in commissions from AePS withdrawals, DMT transfers, and BBPS bill payments." },
      { question: "What equipment is needed?", answer: "A smartphone and a STQC-certified biometric device (₹2,000–3,000). No other infrastructure needed." },
      { question: "Is training provided?", answer: "Yes. Eko provides video tutorials, in-app guidance, and distributor-level field support for agent onboarding." },
    ],
    relatedIndustries: [
      { slug: "agent-networks-csp", name: "Agent Networks (CSP/BC)" },
      { slug: "microfinance", name: "Microfinance" },
      { slug: "agriculture", name: "Agriculture" },
    ],
    seo: {
      title: "Kirana Banking APIs | Eko Platform Services",
      description: "Turn kirana stores into banking touchpoints. AePS cash withdrawal, DMT money transfer, BBPS bill payments. ₹15K–30K/month agent income.",
      keywords: "kirana api india, retail banking api india, digital kirana platform",
    },
    icon: Store,
    category: "agent-retail",
    navDescription: "Turn shops into banking touchpoints for extra income",
  },

  /* ── 6. Marketplaces ────────────────────────────────────────── */
  {
    slug: "marketplaces",
    name: "Marketplaces",
    eyebrow: "INDUSTRY",
    h1: "Marketplace & seller verification APIs",
    heroSubtitle: "Onboard merchants and sellers in minutes with automated KYB — PAN, GST, bank verification, and ONDC-ready compliance in one stack.",
    trustStrip: [
		// "500+ marketplaces",
		"ONDC seller-ready",
		"RBI compliant",
		"99.9% uptime"
	],
    challengeText: "Marketplace platforms must verify thousands of sellers quickly while meeting ONDC and RBI guidelines. Manual KYB takes days and creates onboarding friction. Eko automates the entire flow — PAN, GST, bank account — in minutes.",
    recommendedPacks: [
      { slug: "merchant-onboarding-pack", name: "Merchant Onboarding Pack", description: "Complete seller KYB in under 10 minutes.", apis: ["PAN", "GST", "Bank Verification", "Aadhaar"], featured: true },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Seller identity verification", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "gst", name: "GST Verification", description: "Business validation & filing status", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Verification", description: "Settlement account validation", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Identity for sole proprietors without GST", href: "/products/aadhaar-verification-api", relevance: "M" },
    ],
    useCaseVignettes: [
      { title: "ONDC seller onboarding", situation: "An ONDC buyer app needs to verify 10,000 sellers.", integration: "Merchant Onboarding Pack verifies PAN, GST, and bank account in a single API workflow .", outcome: "Seller onboarding time drops from 5 days to 10 minutes." },
    ],
    whyEko: [
      { title: "ONDC pre-certified", description: "KYB workflow meets all ONDC seller verification requirements.", icon: CheckCircle },
      { title: "Sub-10-minute onboarding", description: "Automated PAN, GST, and bank verification — no manual review.", icon: Zap },
      { title: "Fraud prevention", description: "Cross-check PAN name, GST business name, and bank account holder to catch mismatches.", icon: ShieldCheck },
      { title: "Scales to millions", description: "Batch APIs and webhooks handle high-volume seller onboarding.", icon: Globe },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "ONDC seller verification", description: "PAN + GST + Bank verification meets ONDC KYB requirements." },
      { title: "RBI PA/PG guidelines", description: "Settlement account verification for payment aggregator compliance." },
    ],
    faqs: [
      { question: "Is this pack ONDC compliant?", answer: "Yes. The Merchant Onboarding Pack is pre-validated for ONDC seller KYB requirements." },
      { question: "Can I onboard sellers without GST?", answer: "Yes. For sole proprietors, the pack falls back to PAN + Aadhaar verification." },
    ],
    relatedIndustries: [
      { slug: "e-commerce", name: "E-commerce" },
      { slug: "saas-platforms", name: "SaaS Platforms" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
    ],
    seo: {
      title: "Marketplace Seller Verification APIs | Eko Platform Services",
      description: "Onboard marketplace sellers in 10 minutes. PAN, GST, bank verification. ONDC seller-ready. Used by 500+ marketplaces in India.",
      keywords: "marketplace seller verification api, vendor kyb api india, ondc seller onboarding api",
    },
    icon: Globe,
    category: "digital-tech",
    navDescription: "Seller KYB & onboarding for marketplace platforms",
  },

  /* ── 7. Staffing & HR ───────────────────────────────────────── */
  {
    slug: "staffing-hr",
    name: "Staffing & HR",
    eyebrow: "INDUSTRY",
    h1: "Staffing & HR APIs for background verification & workforce onboarding",
    heroSubtitle:
      "From mass hiring BGV to gig worker onboarding — Eko gives staffing firms, HR platforms, and enterprise HR teams instant verification APIs that cover identity, employment history, education, and bank accounts.",
    trustStrip: [
      // "DPDP Act Compliant",
      // "Bulk BGV Supported",
      "Trusted by 50,000+ businesses",
      "RBI compliant",
      "99.9% uptime",
      "5-Minute Onboarding SLA",
    ],
    challengeText:
      "India onboards millions of new employees and gig workers every month — yet most HR teams still rely on manual reference calls, physical document checks, and third-party BGV agencies that take 5–10 business days and cost ₹500–2,000 per hire. For staffing firms running high-volume hiring cycles, this creates a bottleneck that delays time-to-deploy and inflates pre-employment costs.\n\nFor gig and delivery platforms, the challenge is different but equally acute: onboarding a driver or rider requires verifying a driving licence, vehicle registration, Aadhaar identity, and bank account — often in a single mobile session — before the worker can start earning. Eko's API stack handles both use cases from one integration.",
    recommendedPacks: [
      {
        slug: "employee-bgv-pack",
        name: "Employee BGV Pack",
        description:
          "Run instant background verification on new hires — identity, EPFO employment history, education, and address in under 5 minutes.",
        apis: ["PAN Verification", "Aadhaar Verification", "Employee Verification (EPFO)", "DL Verification", "DigiLocker", "Reverse Geocoding"],
        featured: true,
      },
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        description:
          "Onboard delivery riders and gig workers in under 3 minutes — identity, DL, vehicle RC, and bank account in one flow.",
        apis: ["Aadhaar Verification", "PAN Verification", "DL Verification", "RC Verification", "Bank Verification"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Verify employee identity for tax compliance (TDS Section 192/194C)", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Confirm address and biometric identity for blue-collar & field workers", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "employee", name: "Employee Verification (EPFO)", description: "Fetch full employment history from EPFO PRAN — replaces reference calls", href: "/products/employee-verification-api", relevance: "H" },
      { apiId: "dl", name: "DL Verification", description: "Verify driving licence for delivery riders, drivers, and field staff", href: "/products/dl-verification-api", relevance: "H" },
      { apiId: "digilocker", name: "DigiLocker", description: "Pull degree certificates and marksheets directly — eliminates document fraud", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate payout account before onboarding is complete", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "geocoding", name: "Reverse Geocoding", description: "Validate employee's stated address against GPS coordinates", href: "/products/reverse-geocoding-api", relevance: "M" },
      { apiId: "name-match", name: "Name Match", description: "Fuzzy name matching across ID documents to catch discrepancies", href: "/products/name-match-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Mass hiring BGV at 1,000 hires/day",
        situation:
          "A large staffing firm onboards 1,000 contract workers daily across manufacturing plants in 5 states. Manual BGV takes 7–10 days and costs ₹800 per hire.",
        integration:
          "They integrate the Employee BGV Pack: each worker submits Aadhaar + PAN on a mobile form → EPFO employment history fetched automatically → DigiLocker pulls educational certificates → bank account verified. All in parallel.",
        outcome:
          "BGV time reduced from 7 days to 6 minutes. Cost per BGV cut from ₹800 to under ₹50. 40% of applications cleared same-hour.",
      },
      {
        title: "Delivery rider onboarding at scale",
        situation:
          "A quick-commerce startup needs to onboard 10,000 delivery riders in 30 cities before a festival season peak. Manual DL + RC checks take 3 days.",
        integration:
          "They use the Gig Worker Onboarding Pack: rider enters mobile + Aadhaar → PAN verified → DL validated against Sarathi DB → vehicle RC + insurance confirmed → bank account registered. 3 minutes per rider.",
        outcome:
          "Fully onboarded 8,500 riders in 2 days — 5x faster than previous cycle. Zero suspended-licence riders on network.",
      },
      {
        title: "Healthcare temp staff BGV",
        situation:
          "A hospital group hires 500 temp nurses and paramedics quarterly and must verify nursing council registration and educational credentials.",
        integration:
          "DigiLocker fetches nursing council certificates. PAN + Aadhaar confirm identity. EPFO lookup checks prior employment at other facilities.",
        outcome: "Zero fraudulent credential submissions in 3 consecutive hiring cycles.",
      },
      {
        title: "Field sales team background check",
        situation:
          "A BFSI company onboards 200 field sales agents monthly and needs address verification against a physical location.",
        integration:
          "Aadhaar OTP confirms current address. Reverse Geocoding validates GPS coordinates match the stated address during the onboarding field visit. PAN cross-checks identity.",
        outcome: "Address fraud rate dropped 70% after introducing geocoding-based address validation.",
      },
    ],
    whyEko: [
      { title: "BGV in under 5 minutes", description: "Parallel API calls — PAN, EPFO, DigiLocker, bank — run simultaneously for the fastest possible onboarding.", icon: CheckCircle },
      // { title: "DPDP Act 2023 compliant", description: "Built-in consent flows ensure every verification meets India's Digital Personal Data Protection Act requirements.", icon: ShieldCheck },
      { title: "Bulk async processing", description: "Verify multiple employees in a single batch.", icon: BarChart3 },
      { title: "Pay per verification", description: "No BGV agency retainers. No minimum commitment. Pay only for API calls you make — sandbox is free.", icon: Banknote },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      // { title: "DPDP Act 2023", description: "All verification APIs include consent capture and data minimisation — aligned with India's Digital Personal Data Protection Act." },
      // { title: "EPFO Data Access", description: "Employee Verification uses EPFO's official PRAN lookup — employee consent is mandatory and logged for audit." },
    ],
    faqs: [
      { question: "Is employee consent required for EPFO and DigiLocker lookups?", answer: "Yes. Every data fetch requires explicit employee consent captured digitally. The consent log is available for audit, as required under the DPDP Act 2023." },
      { question: "What if a candidate doesn't have EPFO registration?", answer: "Many informal and first-time workers lack EPFO records. For these cases, the pack uses Aadhaar verification for address + identity, and DigiLocker for educational documents as fallbacks." },
      { question: "Can I run bulk BGV in a batch of multiple employees?", answer: "Yes. PAN, bank account, and employee verification APIs all support bulk mode with async processing." },
      { question: "How long does sandbox-to-production onboarding take for an HR platform?", answer: "Most HR platforms complete sandbox integration in 1–2 days and go live within 5 business days after submitting platform documentation." },
      { question: "Can I periodically re-verify DL validity for active delivery workers?", answer: "Yes. Many gig platforms re-verify DLs monthly to catch expirations or suspensions. The DL Verification API can be called at any frequency — pricing is per API call." },
      { question: "Does the bank verification confirm the account is active?", answer: "Yes. Eko's penny-drop bank verification returns both account holder name and active/inactive status in a single real-time call." },
    ],
    relatedIndustries: [
      { slug: "logistics-fleet", name: "Logistics & Fleet" },
      { slug: "e-commerce", name: "E-commerce" },
      { slug: "healthcare", name: "Healthcare" },
    ],
    seo: {
      title: "Staffing & HR APIs | Background Verification & Onboarding | Eko",
      description: "Instant employee background verification & gig worker onboarding APIs for India. EPFO, DL, PAN, DigiLocker, bank — BGV in under 5 minutes. DPDP compliant.",
      keywords: "staffing api india, employee background verification api, bgv api india, hr onboarding api, epfo verification api, gig worker onboarding api",
    },
    icon: Briefcase,
    category: "workforce-fleet",
    navDescription: "Background verification for temp & permanent hires",
  },

  /* ── 8. Logistics & Fleet ───────────────────────────────────── */
  {
    slug: "logistics-fleet",
    name: "Logistics & Fleet",
    eyebrow: "INDUSTRY",
    h1: "Logistics & Fleet APIs for vehicle compliance & driver verification",
    heroSubtitle:
      "From daily fleet compliance monitoring to delivery partner onboarding — Eko gives logistics operators, fleet managers, and motor insurers real-time vehicle and driver verification APIs backed by the national VAHAN database.",
    trustStrip: [
      "All-India RTO Coverage (VAHAN)",
      // "Daily Batch Monitoring",
      "Trusted by 50,000+ businesses",
      "99.9% Uptime",
    ],
    challengeText:
      "India has 12+ million registered commercial vehicles and 5+ million active delivery partners — yet most fleet operators still track RC expiries, DL validity, and insurance renewals in spreadsheets, discovering compliance gaps only when a vehicle is stopped on road. The Motor Vehicles (Amendment) Act 2019 raised penalties significantly — an expired insurance or suspended driver licence now carries fines of ₹2,000–25,000 per incident.\n\nFor delivery and logistics platforms, the onboarding challenge compounds the compliance problem: each new driver must be verified for identity, licence validity, and vehicle insurance before they can start earning — a process that takes 2–3 days manually. Eko's Fleet Compliance Pack + Gig Worker Onboarding Pack close both gaps from a single API integration.",
    recommendedPacks: [
      {
        slug: "fleet-compliance-pack",
        name: "Fleet Compliance Pack",
        description:
          "Automate RC, insurance, permit, and DL compliance across your entire fleet — with daily batch checks and 30-day expiry alerts.",
        apis: ["RC Verification", "Vehicle Verification", "DL Verification", "Reverse Geocoding"],
        featured: true,
      },
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        description:
          "Onboard delivery riders in under 3 minutes — identity, DL, vehicle RC, and bank account in one mobile flow.",
        apis: ["Aadhaar Verification", "PAN Verification", "DL Verification", "RC Verification", "Bank Verification"],
      },
      {
        slug: "motor-insurance-pack",
        name: "Motor Insurance Pack",
        description:
          "Auto-fill motor insurance proposals using verified vehicle and RC data — instant quotes, no manual form filling.",
        apis: ["Vehicle Verification", "RC Verification", "DL Verification", "PAN Verification"],
      },
    ],
    apiGrid: [
      { apiId: "rc", name: "RC Verification", description: "Fetch RC details, insurance expiry, and owner info from VAHAN", href: "/products/rc-verification-api", relevance: "H" },
      { apiId: "vehicle", name: "Vehicle Verification", description: "Full vehicle data — chassis, engine, blacklist status, financier", href: "/products/vehicle-verification-api", relevance: "H" },
      { apiId: "dl", name: "DL Verification", description: "Validate driving licence, vehicle categories authorised, suspension status", href: "/products/dl-verification-api", relevance: "H" },
      { apiId: "geocoding", name: "Reverse Geocoding", description: "GPS to address — geofence routes, verify driver locations, permit-zone compliance", href: "/products/reverse-geocoding-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Driver identity and address verification during onboarding", href: "/products/aadhaar-verification-api", relevance: "M" },
      { apiId: "pan", name: "PAN Verification", description: "Verify driver PAN for TDS deduction on delivery earnings", href: "/products/pan-verification-api", relevance: "M" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate payout account before registering driver for earnings", href: "/products/bank-verification-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Daily fleet compliance batch for 10,000 vehicles",
        situation:
          "A logistics company with 10,000 commercial vehicles needs to ensure every RC and DL is valid before dispatching vehicles each morning.",
        integration:
          "They run a daily batch job via Eko's RC + DL Verification APIs — all 10,000 vehicles checked overnight, non-compliant vehicles flagged before dispatch. 30-day expiry alerts configured.",
        outcome:
          "Zero regulatory incidents in 18 months. Insurance renewal costs reduced 12% by proactive renewal vs. lapse-and-reinstate cycle.",
      },
      {
        title: "3-minute delivery partner onboarding",
        situation:
          "A quick-commerce platform needs to onboard 5,000 new delivery partners before a city expansion launch.",
        integration:
          "Each partner completes a mobile flow: Aadhaar OTP → PAN verify → DL validation → vehicle RC + insurance check → bank account penny-drop. Eko runs all steps in parallel.",
        outcome:
          "4,800 partners onboarded in 48 hours — 6x faster than the previous manual process. DL fraud rate dropped to zero.",
      },
      {
        title: "Commercial vehicle insurance in 30 seconds",
        situation:
          "A motor insurer wants to offer instant commercial vehicle insurance renewal via a B2B API to fleet operators.",
        integration:
          "Fleet operator enters registration number → Vehicle Verification auto-fills make/model/engine → RC Verification confirms owner and previous insurer → DL check → instant renewal quote generated.",
        outcome:
          "Policy issuance time cut from 24 hours to 8 minutes. Drop-off rate on the renewal flow fell 55%.",
      },
      {
        title: "Permit-zone geofencing for 3-wheelers",
        situation:
          "A 3-wheeler logistics operator must ensure vehicles only operate in permit-authorised zones across city boundaries.",
        integration:
          "Reverse Geocoding API converts live GPS data to administrative zone codes, checked against each vehicle's permit at every trip start.",
        outcome: "Permit violations eliminated — compliance cost from traffic fines reduced 80%.",
      },
    ],
    whyEko: [
      { title: "VAHAN national database", description: "All RC and vehicle data sourced from VAHAN — 99% coverage of registered vehicles across all 36 state RTOs.", icon: CheckCircle },
      // { title: "Automated expiry alerts", description: "Configure 30/15/7 day advance alerts for insurance, DL, and RC renewals — eliminate fire-fighting compliance.", icon: ShieldCheck },
      { title: "Sub-2-second responses", description: "Real-time RC, DL, and vehicle lookups return in under 2 seconds — fast enough for trip-start compliance gates.", icon: Zap },
      { title: "Fleet-scale batch processing", description: "Verify multiple vehicles via bulk API.", icon: BarChart3 },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      // { title: "Motor Vehicles Act (MVA 2019)", description: "Eko's RC, DL, and Vehicle Verification APIs are sourced from VAHAN/Sarathi — the same databases used by traffic enforcement authorities." },
      // { title: "MORTH Digital Integration", description: "Direct integration with the Ministry of Road Transport & Highways' VAHAN 4.0 and Sarathi 4.0 national databases for real-time, authoritative data." },
    ],
    faqs: [
      { question: "Which database does Eko use for RC and vehicle verification?", answer: "Eko's RC and Vehicle Verification APIs connect to VAHAN 4.0 — the Ministry of Road Transport & Highways' national vehicle registration database with 99%+ coverage for all registered vehicles." },
      { question: "Can I check vehicles registered across multiple states?", answer: "Yes. VAHAN is a national database covering all 36 state RTOs. A single API call fetches data for any registration number regardless of the issuing state." },
      // { question: "How does the daily fleet compliance batch work?", answer: "You send a list of registration numbers and DL numbers to the batch API. Eko processes them asynchronously and sends a webhook when results are ready — typically overnight for batches up to 50,000 vehicles." },
      // { question: "Can I set up expiry alerts for insurance and DL renewals?", answer: "Yes. Each API response includes expiry dates for insurance, registration, and DL. Your system can trigger alerts based on these dates — many operators configure 30-day and 7-day reminders." },
      { question: "How fast are real-time vehicle lookups?", answer: "Typically under 2 seconds for RC and vehicle verification. DL verification via Sarathi is usually under 3 seconds. Both are fast enough for trip-start compliance gates." },
      { question: "Does the Gig Worker Onboarding Pack also verify vehicle ownership?", answer: "Yes. RC Verification confirms that the vehicle registration is valid, insured, and that the registered owner matches the gig worker — preventing workers from using unregistered or borrowed vehicles." },
    ],
    relatedIndustries: [
      { slug: "staffing-hr", name: "Staffing & HR" },
      { slug: "automotive", name: "Automotive" },
      { slug: "insurance", name: "Insurance" },
    ],
    seo: {
      title: "Logistics & Fleet APIs | Vehicle Compliance & Driver Verification | Eko",
      description: "Fleet compliance & driver verification APIs for India. RC, DL, vehicle verification via VAHAN. Daily batch monitoring, expiry alerts, instant delivery partner onboarding.",
      keywords: "logistics api india, fleet compliance api, rc verification api india, dl verification fleet, vehicle compliance api, delivery partner onboarding api, vahan api india",
    },
    icon: Truck,
    category: "workforce-fleet",
    navDescription: "Driver & vehicle compliance for fleet operators",
  },

  /* ── Placeholder industries with minimal data ──────────────── */
  ...([
    { slug: "saas-platforms", name: "SaaS Platforms", icon: Building2, category: "digital-tech" as IndustryCategory, navDescription: "Embed verification & payments in your SaaS product" },
    { slug: "e-commerce", name: "E-commerce", icon: ShoppingCart, category: "digital-tech" as IndustryCategory, navDescription: "Seller onboarding & payout verification" },
    { slug: "agriculture", name: "Agriculture", icon: Sprout, category: "sector-specific" as IndustryCategory, navDescription: "Financial services for farmers & FPOs" },
    { slug: "automotive", name: "Automotive", icon: Car, category: "sector-specific" as IndustryCategory, navDescription: "Vehicle financing & insurance verification" },
    { slug: "travel", name: "Travel", icon: Plane, category: "sector-specific" as IndustryCategory, navDescription: "Merchant onboarding for travel aggregators" },
    { slug: "education", name: "Education", icon: GraduationCap, category: "sector-specific" as IndustryCategory, navDescription: "Student loan & fee collection APIs" },
    { slug: "healthcare", name: "Healthcare", icon: Heart, category: "sector-specific" as IndustryCategory, navDescription: "Employee & vendor verification for hospitals" },
    { slug: "real-estate", name: "Real Estate", icon: Home, category: "sector-specific" as IndustryCategory, navDescription: "Tenant & property verification APIs" },
    { slug: "accounting-tax", name: "Accounting & Tax", icon: Calculator, category: "sector-specific" as IndustryCategory, navDescription: "MSME credit assessment data for CAs" },
  ] as const).map((ind) => ({
    slug: ind.slug,
    name: ind.name,
    eyebrow: "INDUSTRY",
    h1: `${ind.name} APIs & solutions`,
    heroSubtitle: `Eko provides the API infrastructure ${ind.name.toLowerCase()} businesses need to verify, transact, and grow — all from a single platform.`,
    trustStrip: [
		"Trusted by 50,000+ businesses",
		"RBI compliant",
		"99.9% uptime"
	],
    challengeText: `The ${ind.name.toLowerCase()} sector faces unique verification and payment challenges. Eko's API platform simplifies onboarding, compliance, and transactions with a single integration.`,
    recommendedPacks: [] as RecommendedPack[],
    apiGrid: [] as ApiGridItem[],
    useCaseVignettes: [] as UseCaseVignette[],
    whyEko: [
      { title: "Single integration", description: "One API platform for verification, payments, and compliance.", icon: Zap },
      { title: "RBI compliant", description: "Built-in regulatory compliance for Indian financial regulations.", icon: Shield },
      { title: "Enterprise-grade", description: "99.9% uptime with enterprise SLAs and dedicated support.", icon: Building2 },
      { title: "Pay per use", description: "No setup fees. Pay only for what you use. Sandbox is free.", icon: Banknote },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [] as ComplianceItem[],
    faqs: [] as IndustryFAQ[],
    relatedIndustries: [] as RelatedIndustry[],
    seo: {
      title: `${ind.name} APIs | Eko Platform Services`,
      description: `API solutions for India's ${ind.name.toLowerCase()} sector. Verification, payments, and compliance — all from one platform. Sandbox in minutes.`,
      keywords: `${ind.name.toLowerCase()} api india, ${ind.slug} api`,
    },
    icon: ind.icon,
    category: ind.category,
    navDescription: ind.navDescription,
  } satisfies IndustryData)),
];

export const INDUSTRIES_MAP: Record<string, IndustryData> = Object.fromEntries(
  INDUSTRIES_LIST.map((i) => [i.slug, i])
);

/** Group industries by category for display */
export const INDUSTRY_CATEGORIES: { label: string; key: IndustryCategory; industries: IndustryData[] }[] = [
  { label: "Financial Services", key: "financial-services", industries: INDUSTRIES_LIST.filter((i) => i.category === "financial-services") },
  { label: "Agent & Retail", key: "agent-retail", industries: INDUSTRIES_LIST.filter((i) => i.category === "agent-retail") },
  { label: "Digital / Tech", key: "digital-tech", industries: INDUSTRIES_LIST.filter((i) => i.category === "digital-tech") },
  { label: "Workforce & Fleet", key: "workforce-fleet", industries: INDUSTRIES_LIST.filter((i) => i.category === "workforce-fleet") },
  { label: "Sector-Specific", key: "sector-specific", industries: INDUSTRIES_LIST.filter((i) => i.category === "sector-specific") },
];
