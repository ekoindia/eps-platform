import type { LucideIcon } from "lucide-react";
import {
  Landmark, Users, Shield, Store, Globe, Building2,
  Briefcase, Truck, ShoppingCart, Sprout, Car, Plane,
  GraduationCap, Heart, Home, Calculator, Zap,
  Fingerprint, FileText, Banknote, Receipt, BarChart3,
  CheckCircle, ShieldCheck, Layers,
} from "lucide-react";
import { API_PRODUCTS, API_PRODUCTS_MAP } from "@/lib/data/api-products";

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
  /** Short tagline for header nav & compact cards */
  tagline: string;
  /** 1 = featured in header nav, 2 = available, 3 = hidden/draft */
  priority: 1 | 2 | 3;
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
  // MARK: Lending NBFC
  {
    slug: "lending-nbfc",
    name: "Lending & NBFC",
    tagline: "KYC, disbursal & EMI collection",
    priority: 1,
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
      // { question: "Can I bulk-verify 50,000 borrowers in a single batch?", answer: "Yes. Eko supports bulk PAN and bank account verification via asynchronous batch APIs with webhook notifications. A batch of 50,000 typically completes in 2–4 hours." },
      { question: "How does Eko's Name Match handle regional name variations?", answer: "Our name-match engine uses fuzzy matching with regional transliteration support, handling variations across Hindi, Tamil, Telugu, Kannada, and Bengali name structures." },
      { question: "What's the typical sandbox-to-production timeline for an NBFC?", answer: "Most NBFCs complete sandbox testing in 1–3 days and go live within 5–7 business days." },
      { question: "Do you support co-lending portfolio reconciliation?", answer: "Yes. Bulk verification APIs support portfolio-level reconciliation for NBFC-bank co-lending workflows." },
      { question: "How does the AePS Cashout option help my rural borrowers?", answer: "Rural borrowers can withdraw disbursed funds at any of Eko's 200K+ agent touchpoints using just Aadhaar + fingerprint — no ATM or bank branch required." },
      { question: "Is there a minimum monthly transaction commitment?", answer: "No minimum commitment. Production accounts have no mandatory minimum." },
    ],
    relatedIndustries: [
      { slug: "microfinance", name: "Microfinance" },
      { slug: "marketplaces", name: "Marketplaces" },
      { slug: "insurance", name: "Insurance" },
    ],
    seo: {
      title: "Lending & NBFC APIs",
      description: "RBI-compliant API stack for digital lenders in India. PAN, bank, DigiLocker, instant disbursal, BBPS collection. Sandbox in minutes.",
      keywords: "lending api india, nbfc api platform, kyc api for lending, digital lending api india, rbi digital lending api",
    },
    icon: Landmark,
    category: "financial-services",
    navDescription: "KYC, disbursal & EMI collection for digital lenders",
  },


  // MARK: Microfinance
  {
    slug: "microfinance",
    name: "Microfinance",
    tagline: "Field collection & disbursal for MFIs",
    priority: 1,
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
      title: "Microfinance APIs",
      description: "Digitize MFI field operations — AePS biometric collection, instant disbursal, group loan management. NPCI compliant. Trusted by 50+ MFIs.",
      keywords: "mfi api india, microfinance digital collection api, aeps for mfi, field collection api india",
    },
    icon: Users,
    category: "financial-services",
    navDescription: "Digitize field collection & disbursal for MFIs",
  },


  // MARK: Insurance
  {
    slug: "insurance",
    name: "Insurance",
    tagline: "Auto-fill proposals & verify policyholders",
    priority: 1,
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
      { slug: "motor-insurance-pack", name: "Motor Insurance Pack", description: "Instant motor proposals with auto-filled vehicle RC + DL details.", apis: ["Vehicle & RC Verification", "DL Verification", "PAN"], featured: true },
    ],
    apiGrid: [
      { apiId: "rc", name: "Vehicle & RC Verification", description: "Auto-fill vehicle details, RC status & insurance from registration number", href: "/products/vehicle-rc-verification-api", relevance: "H" },
      { apiId: "dl", name: "DL Verification", description: "Verify driving licence validity", href: "/products/dl-verification-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "Policyholder identity verification", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "KYC for high-value policies", href: "/products/aadhaar-verification-api", relevance: "M" },
      { apiId: "bank", name: "Bank Verification", description: "Claims payout account validation", href: "/products/bank-verification-api", relevance: "M" },
    ],
    useCaseVignettes: [
      { title: "Instant motor insurance proposal", situation: "An insurer wants to reduce proposal form time from 10 minutes to 30 seconds.", integration: "Vehicle & RC Verification auto-fills vehicle make, model, year, fuel type, and insurance history. DL Verification confirms the driver.", outcome: "90% reduction in proposal time, 3x increase in conversion." },
      { title: "Claims payout verification", situation: "Claims team needs to verify bank account before disbursing claim settlement.", integration: "Bank Verification (penny drop) confirms account is active and name matches the policyholder.", outcome: "Zero fraudulent claims payouts, instant settlement." },
    ],
    whyEko: [
      { title: "Auto-fill proposals", description: "Vehicle & RC Verification API returns make, model, year, fuel, chassis, engine, insurance — one lookup fills the entire form.", icon: Zap },
      { title: "IRDAI compliant", description: "All verification flows designed for insurance regulatory requirements.", icon: Shield },
      { title: "Fraud prevention", description: "Cross-check RC, DL, and PAN to catch identity mismatches before underwriting.", icon: ShieldCheck },
      { title: "Sub-second response", description: "99th percentile latency under 2 seconds for all verification APIs.", icon: Zap },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "IRDAI KYC norms", description: "PAN and Aadhaar verification for policyholder identity." },
      { title: "Motor vehicle regulations", description: "Vehicle RC and DL verification ensure valid registration and licensed drivers." },
    ],
    faqs: [
      { question: "Can Vehicle & RC Verification auto-fill the entire motor proposal?", answer: "Yes. A single Vehicle RC lookup returns vehicle make, model, year, fuel type, registration date, chassis number, engine number, owner name, and insurance details." },
      { question: "Does DL Verification check for violations?", answer: "DL Verification returns licence validity, issue date, expiry, and vehicle classes. Violation history requires a separate RTO integration." },
      { question: "How fast is the verification?", answer: "All verification APIs respond in under 2 seconds. Vehicle RC verification typically completes in 500ms." },
    ],
    relatedIndustries: [
      { slug: "automotive", name: "Automotive" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "logistics-fleet", name: "Logistics & Fleet" },
    ],
    seo: {
      title: "Insurance APIs",
      description: "Instant motor insurance proposals with auto-filled vehicle details. RC, DL, PAN verification. IRDAI compliant. Used by 20+ insurers in India.",
      keywords: "insurance kyc api india, motor insurance verification api, rc api for insurance, irdai api",
    },
    icon: Shield,
    category: "financial-services",
    navDescription: "Auto-fill proposals & verify policyholders instantly",
  },


  // MARK: Agent Networks CSP/BC
  {
    slug: "agent-networks-csp",
    name: "Agent Networks (CSP/BC)",
    tagline: "Scale agent operations at BCNM level",
    priority: 1,
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
      title: "Agent Banking APIs for CSP & BC",
      description: "Scale your agent network with AePS, DMT, and BBPS under Eko's BCNM license. 200K+ agents, dual AePS gateway, daily commission settlement.",
      keywords: "csp api india, bc agent api, white label aeps, agent banking platform india",
    },
    icon: Users,
    category: "agent-retail",
    navDescription: "Scale BC/CSP operations under Eko's BCNM license",
  },


  // MARK: Kirana & Retail
  {
    slug: "kirana-retail",
    name: "Kirana & Retail",
    tagline: "Turn shops into banking touchpoints",
    priority: 1,
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
      title: "Kirana Banking APIs",
      description: "Turn kirana stores into banking touchpoints. AePS cash withdrawal, DMT money transfer, BBPS bill payments. ₹15K–30K/month agent income.",
      keywords: "kirana api india, retail banking api india, digital kirana platform",
    },
    icon: Store,
    category: "agent-retail",
    navDescription: "Turn shops into banking touchpoints for extra income",
  },


  // MARK: Marketplaces
  {
    slug: "marketplaces",
    name: "Marketplaces",
    tagline: "Seller KYB & onboarding",
    priority: 1,
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
      title: "Marketplace Seller Verification APIs",
      description: "Onboard marketplace sellers in 10 minutes. PAN, GST, bank verification. ONDC seller-ready. Used by 500+ marketplaces in India.",
      keywords: "marketplace seller verification api, vendor kyb api india, ondc seller onboarding api",
    },
    icon: Globe,
    category: "digital-tech",
    navDescription: "Seller KYB & onboarding for marketplace platforms",
  },


  // MARK: Staffing HR
  {
    slug: "staffing-hr",
    name: "Staffing & HR",
    tagline: "Background verification for hires",
    priority: 1,
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
        apis: ["Aadhaar Verification", "PAN Verification", "DL Verification", "Vehicle & RC Verification", "Bank Verification"],
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
      title: "Staffing & HR APIs | Background Verification & Onboarding",
      description: "Instant employee background verification & gig worker onboarding APIs for India. EPFO, DL, PAN, DigiLocker, bank — BGV in under 5 minutes. DPDP compliant.",
      keywords: "staffing api india, employee background verification api, bgv api india, hr onboarding api, epfo verification api, gig worker onboarding api",
    },
    icon: Briefcase,
    category: "workforce-fleet",
    navDescription: "Background verification for temp & permanent hires",
  },


  // MARK: Logistics Fleet
  {
    slug: "logistics-fleet",
    name: "Logistics & Fleet",
    tagline: "Driver & vehicle compliance",
    priority: 1,
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
          "Automate vehicle RC, insurance, permit, and DL compliance across your entire fleet — with daily batch checks and 30-day expiry alerts.",
        apis: ["Vehicle & RC Verification", "DL Verification", "Reverse Geocoding"],
        featured: true,
      },
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        description:
          "Onboard delivery riders in under 3 minutes — identity, DL, vehicle RC, and bank account in one mobile flow.",
        apis: ["Aadhaar Verification", "PAN Verification", "DL Verification", "Vehicle & RC Verification", "Bank Verification"],
      },
      {
        slug: "motor-insurance-pack",
        name: "Motor Insurance Pack",
        description:
          "Auto-fill motor insurance proposals using verified vehicle RC data — instant quotes, no manual form filling.",
        apis: ["Vehicle & RC Verification", "DL Verification", "PAN Verification"],
      },
    ],
    apiGrid: [
      { apiId: "rc", name: "Vehicle & RC Verification", description: "Fetch RC details, insurance expiry, owner info, and full vehicle data from VAHAN", href: "/products/vehicle-rc-verification-api", relevance: "H" },
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
          "They run a daily batch job via Eko's Vehicle RC + DL Verification APIs — all 10,000 vehicles checked overnight, non-compliant vehicles flagged before dispatch. 30-day expiry alerts configured.",
        outcome:
          "Zero regulatory incidents in 18 months. Insurance renewal costs reduced 12% by proactive renewal vs. lapse-and-reinstate cycle.",
      },
      {
        title: "3-minute delivery partner onboarding",
        situation:
          "A quick-commerce platform needs to onboard 5,000 new delivery partners before a city expansion launch.",
        integration:
          "Each partner completes a mobile flow: Aadhaar OTP → PAN verify → DL validation → Vehicle RC + insurance check → bank account penny-drop. Eko runs all steps in parallel.",
        outcome:
          "4,800 partners onboarded in 48 hours — 6x faster than the previous manual process. DL fraud rate dropped to zero.",
      },
      {
        title: "Commercial vehicle insurance in 30 seconds",
        situation:
          "A motor insurer wants to offer instant commercial vehicle insurance renewal via a B2B API to fleet operators.",
        integration:
          "Fleet operator enters registration number → Vehicle & RC Verification auto-fills make/model/engine and confirms owner and previous insurer → DL check → instant renewal quote generated.",
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
      title: "Logistics & Fleet APIs | Vehicle Compliance & Driver Verification",
      description: "Fleet compliance & driver verification APIs for India. RC, DL, vehicle verification via VAHAN. Daily batch monitoring, expiry alerts, instant delivery partner onboarding.",
      keywords: "logistics api india, fleet compliance api, rc verification api india, dl verification fleet, vehicle compliance api, delivery partner onboarding api, vahan api india",
    },
    icon: Truck,
    category: "workforce-fleet",
    navDescription: "Driver & vehicle compliance for fleet operators",
  },


  // MARK: SaaS
  {
    slug: "saas-platforms",
    name: "SaaS Platforms",
    tagline: "Embed verification & payments in your SaaS",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "SaaS Platform APIs for embedded verification & payments",
    heroSubtitle:
      "Embed KYC, verification, and payment APIs directly into your SaaS product — give your customers instant onboarding, compliance, and transaction capabilities without building the infrastructure yourself.",
    trustStrip: [
      // "Trusted by 500+ SaaS platforms",
      // "RESTful APIs & SDK support",
      "Trusted by 50,000+ businesses",
      "RBI compliant",
      "99.9% uptime",
    ],
    challengeText:
      "SaaS platforms increasingly need to offer financial and compliance features — KYC for onboarding, bank verification for payouts, GST validation for billing, or lending data for credit-embedded products. Building and maintaining these integrations in-house means managing 6–10 different vendor contracts, disparate APIs, and ongoing compliance updates as regulations change.\n\nEko provides a single API platform that SaaS builders can embed as a backend service — one set of credentials, one dashboard, one contract covering PAN, GST, bank, Aadhaar, DigiLocker, and payment rails. Your product ships faster; your customers get features they'd otherwise build themselves.",
    recommendedPacks: [
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Embed a complete borrower verification flow — OTP, PAN, bank, DigiLocker, GST — into your lending or credit SaaS.",
        apis: ["Mobile OTP", "PAN Advanced", "Bank Verification", "DigiLocker", "GST Verification", "Fund Transfer"],
        featured: true,
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        description: "Add merchant/seller KYB to your SaaS — PAN, GST, bank in one workflow.",
        apis: ["PAN Verification", "GST Verification", "Bank Verification", "Aadhaar Verification"],
      },
      {
        slug: "msme-credit-assessment-pack",
        name: "MSME Credit Assessment Pack",
        description: "Embed alternative credit scoring using GST + ITR data into your fintech or accounting SaaS.",
        apis: ["GST Verification", "PAN Advanced", "Bank Verification", "DigiLocker"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Embed identity verification for user onboarding, admin KYC, or contractor compliance", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate payout accounts before disbursing wages, refunds, or commissions", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "gst", name: "GST Verification", description: "Validate business registrations and filing status within your B2B platform", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Add address verification to user or agent onboarding flows", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "digilocker", name: "DigiLocker", description: "Pull ITRs, Aadhaar, driving licences, and education certificates paperlessly", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Embed bill payment collection for fee collection or subscription billing", href: "/products/bbps-api", relevance: "M" },
      { apiId: "upi-payout", name: "UPI Payout", description: "Programmatic payouts to users, vendors, or partners from within your platform", href: "/products/upi-payout-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Embedded BGV in an HR SaaS",
        situation: "An HR software company wants to offer 'instant employee BGV' as a premium feature — without building verification infrastructure.",
        integration: "They embed Eko's PAN + Employee Verification + DigiLocker APIs via a single SDK. Customers click 'Run BGV' inside the HR tool; Eko handles every step.",
        outcome: "New premium tier launched in 3 weeks. 40% of enterprise customers upgraded for the BGV feature.",
      },
      {
        title: "Fintech SaaS adds MSME credit scoring",
        situation: "An accounting SaaS for CAs wants to add a 'loan eligibility' widget for their SME clients.",
        integration: "MSME Credit Assessment Pack: GST history fetch → PAN identity link → bank account validation. The SaaS presents a credit score to CAs in-app.",
        outcome: "NBFC partner secured within 2 months. ₹50 Cr in loan applications generated in the first quarter.",
      },
      {
        title: "Marketplace SaaS automates seller KYB",
        situation: "A white-label marketplace platform needs every client's sellers to complete KYB before listing products.",
        integration: "Merchant Onboarding Pack embedded as an API call within the seller registration webhook. PAN + GST + bank happen automatically on signup.",
        outcome: "Zero failed payouts from unverified accounts. Marketplace clients see 80% fewer KYB support tickets.",
      },
    ],
    whyEko: [
      { title: "One API, all compliance features", description: "PAN, GST, bank, Aadhaar, DigiLocker, payments — one key, one contract, one dashboard.", icon: Layers },
      { title: "Embed in days, not quarters", description: "RESTful APIs with detailed SDKs — typical SaaS integration completed in 3–5 days.", icon: Zap },
      { title: "Usage-based pricing", description: "Pay per API call — no minimum commitment. Pass costs to customers or absorb in your margin.", icon: Banknote },
      { title: "99.9% uptime SLA", description: "Enterprise-grade reliability with dedicated support for SaaS platform partners.", icon: ShieldCheck },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      // { title: "Data minimisation (DPDP Act)", description: "Eko's APIs return only verified claims — your platform stores minimal raw PII." },
      // { title: "RBI PA/PG guidelines", description: "Core payment APIs (UPI Payout, BBPS) are RBI-compliant and cover your downstream customers." },
    ],
    faqs: [
      { question: "Can I white-label Eko's verification flows inside my SaaS?", answer: "Yes. The APIs are headless — you build the UI, Eko powers the data layer. Your customers see your brand throughout." },
      { question: "How do I handle user consent for verification?", answer: "Eko's API responses include a consent token. You capture consent in your UI and pass it with the API call — Eko logs it for audit under the DPDP Act." },
      { question: "Is there a per-seat or platform fee?", answer: "No platform fee. Billing is purely per API call. Volume pricing tiers kick in at 1,000+ monthly calls." },
      { question: "Can my SaaS customers get their own API credentials?", answer: "Yes. Eko supports multi-tenant API key issuance for SaaS platforms — each of your customers gets their own credentials, billing rolls up under your master account." },
      { question: "What's the sandbox-to-production timeline?", answer: "Sandbox is available immediately on signup. Production go-live takes 3–5 business days after platform KYC submission." },
    ],
    relatedIndustries: [
      { slug: "marketplaces", name: "Marketplaces" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "accounting-tax", name: "Accounting & Tax" },
    ],
    seo: {
      title: "SaaS Platform APIs | Embed KYC, Verification & Payments",
      description: "Embed PAN, GST, bank, Aadhaar, and payment APIs into your SaaS product. One integration, full compliance coverage. Sandbox in minutes. Used by 500+ platforms.",
      keywords: "saas verification api india, embed kyc api saas, pan verification api for saas, bank verification api india, fintech api platform india",
    },
    icon: Building2,
    category: "digital-tech",
    navDescription: "Embed verification & payments in your SaaS product",
  },


  // MARK: E-commerce
  {
    slug: "e-commerce",
    name: "E-commerce",
    tagline: "Seller KYB & delivery partner verification",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "E-commerce APIs for seller onboarding & delivery operations",
    heroSubtitle:
      "Onboard sellers with automated KYB, verify delivery partner credentials instantly, and secure every payout account — Eko gives e-commerce platforms the verification and payment APIs to scale without fraud.",
    trustStrip: [
      "ONDC Seller-Ready",
      "Trusted by 500+ platforms",
      "RBI Compliant",
    ],
    challengeText:
      "E-commerce platforms face a dual compliance challenge: every new seller must be vetted (PAN, GST, bank account) to prevent marketplace fraud, and every delivery partner must have a valid driving licence, insured vehicle, and verified bank account before going on-road. Manual review creates days of onboarding delay at scale.\n\nONDC regulations mandate structured KYB for all network participants, and RBI PA/PG guidelines require settlement account verification before disbursing marketplace payments. Eko consolidates seller KYB, driver onboarding, and payout verification into a single API integration.",
    recommendedPacks: [
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        description: "Onboard sellers with PAN, GST, and bank verification in under 10 minutes — ONDC compliant.",
        apis: ["PAN Verification", "GST Verification", "Bank Verification", "Aadhaar Verification"],
        featured: true,
      },
      {
        slug: "gig-worker-onboarding-pack",
        name: "Gig Worker Onboarding Pack",
        description: "Verify delivery riders — DL, vehicle RC, Aadhaar, and bank account — in under 3 minutes.",
        apis: ["Aadhaar Verification", "PAN Verification", "DL Verification", "Vehicle & RC Verification", "Bank Verification"],
      },
      {
        slug: "fleet-compliance-pack",
        name: "Fleet Compliance Pack",
        description: "Monitor active delivery partner RC and DL validity daily — automated compliance without manual tracking.",
        apis: ["Vehicle & RC Verification", "DL Verification", "Reverse Geocoding"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Seller and delivery partner identity verification for TDS compliance", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "gst", name: "GST Verification", description: "Validate seller business registration and filing status for KYB", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Verify seller settlement accounts before disbursing marketplace payments", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "dl", name: "DL Verification", description: "Confirm delivery rider licence validity and suspension status", href: "/products/dl-verification-api", relevance: "H" },
      { apiId: "rc", name: "Vehicle & RC Verification", description: "Verify delivery vehicles are registered and insured", href: "/products/vehicle-rc-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Identity for sellers without GST and informal delivery workers", href: "/products/aadhaar-verification-api", relevance: "M" },
      { apiId: "upi-payout", name: "UPI Payout", description: "Instant seller payouts and delivery commission disbursals", href: "/products/upi-payout-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "ONDC seller onboarding at scale",
        situation: "An ONDC buyer app needs to verify and activate 50,000 new sellers across 200 cities.",
        integration: "Merchant Onboarding Pack: mobile OTP → PAN verify → GST validate → bank penny-drop. Webhook triggers seller activation on success.",
        outcome: "Seller activation from 5 days to 8 minutes. Zero fraudulent sellers in first 3 months.",
      },
      {
        title: "Delivery partner onboarding pre-launch",
        situation: "A D2C brand building a 10-minute delivery service needs to onboard 2,000 riders in 2 weeks.",
        integration: "Gig Worker Onboarding Pack verifies Aadhaar + PAN identity, DL validity, vehicle RC and insurance, plus bank account — all in one parallel API call.",
        outcome: "All 2,000 riders onboarded in 6 days. Zero on-road incidents from uninsured or unlicensed riders.",
      },
      {
        title: "COD payout verification",
        situation: "A marketplace collects cash-on-delivery payments via delivery partners who need daily bank settlement.",
        integration: "Bank Account Verification confirms each delivery partner's payout account is active before the settlement batch runs.",
        outcome: "Failed payout rate reduced from 4.2% to under 0.1%. Settlement disputes eliminated.",
      },
    ],
    whyEko: [
      { title: "ONDC pre-certified KYB", description: "Merchant Onboarding Pack is pre-validated for ONDC seller KYB — one integration covers all ONDC buyer app requirements.", icon: CheckCircle },
      { title: "Seller + rider in one platform", description: "Same API covers seller KYB, delivery partner onboarding, and fleet compliance — no separate vendors.", icon: Layers },
      { title: "Fraud prevention built in", description: "Name Match cross-checks PAN, GST, and bank holder names — catches mismatches manual review misses.", icon: ShieldCheck },
      // { title: "Scales to millions", description: "Bulk verification APIs handle 100,000+ verifications per day with async processing and webhooks.", icon: Building2 },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "ONDC seller verification", description: "PAN + GST + Bank verification meets all ONDC Network Participant KYB obligations." },
      { title: "RBI Payment Aggregator guidelines", description: "Settlement account verification is mandatory under RBI PA guidelines before disbursing marketplace payments." },
    ],
    faqs: [
      { question: "Does the Merchant Onboarding Pack work for sellers without GST?", answer: "Yes. For sole proprietors below the GST threshold, the pack falls back to PAN + Aadhaar verification. The bank account penny-drop still runs to activate settlement." },
      { question: "How frequently should I re-verify delivery partner credentials?", answer: "Most platforms re-verify DL and RC validity monthly. Insurance expiry is typically checked weekly via the Fleet Compliance Pack batch job." },
      { question: "Can I run bulk seller verification for a marketplace migration?", answer: "Yes. Bulk PAN and bank account verification support async batch processing with webhooks. Batches of 50,000 complete in 2–4 hours." },
      { question: "Does Eko support instant seller payouts after order completion?", answer: "Yes. UPI Payout and IMPS APIs support real-time disbursals to verified settlement accounts — same-day settlement for marketplace transactions." },
    ],
    relatedIndustries: [
      { slug: "marketplaces", name: "Marketplaces" },
      { slug: "logistics-fleet", name: "Logistics & Fleet" },
      { slug: "staffing-hr", name: "Staffing & HR" },
    ],
    seo: {
      title: "E-commerce APIs | Seller Onboarding & Delivery Verification",
      description: "ONDC-ready seller KYB, delivery partner verification, and payout APIs for e-commerce. PAN, GST, bank, DL, RC in one integration. Sandbox in minutes.",
      keywords: "ecommerce seller verification api india, ondc seller onboarding api, delivery partner verification api, kyb api ecommerce india",
    },
    icon: ShoppingCart,
    category: "digital-tech",
    navDescription: "Seller KYB & delivery partner verification",
  },


  // MARK: Agriculture
  {
    slug: "agriculture",
    name: "Agriculture",
    tagline: "Financial services for farmers & FPOs",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Agriculture APIs for rural financial services & farmer payments",
    heroSubtitle:
      "Connect India's 140 million farming households to financial services — DBT cashout, last-mile money transfer, cooperative KYC, and FPO payments — using only Aadhaar and a biometric device.",
    trustStrip: [
      // "Covers All DBT Schemes",
      // "Works Without Smartphones",
      // "NPCI & RBI Compliant",
      "Trusted by 50,000+ businesses",
      "RBI compliant",
      "99.9% uptime",
    ],
    challengeText:
      "India's agricultural sector receives over ₹2.5 lakh crore annually in government transfers — PM-KISAN, MGNREGA, PM Fasal Bima Yojana, and state DBT programs — yet millions of farmers still travel 20–30 km to the nearest bank branch to access their own money. Biometric cashout at local agent points solves this, but requires certified AePS infrastructure that most agri platforms lack.\n\nFor agri-fintech, FPO lending platforms, and input finance companies, the challenge is assessing creditworthiness of farmers with no credit bureau history and verifying Jan Dhan accounts with minimal transaction history. Eko's agriculture stack addresses both the access problem and the credit assessment problem from one integration.",
    recommendedPacks: [
      {
        slug: "rural-financial-services-pack",
        name: "Rural Financial Services Pack",
        description: "AePS cashout, Aadhaar KYC, and money transfer for rural platforms — works without a smartphone.",
        apis: ["AePS Cashout", "Aadhaar Verification", "Bank Verification", "Fund Transfer"],
        featured: true,
      },
      {
        slug: "dbt-cashout-pack",
        name: "DBT Cashout Pack",
        description: "Enable farmers to withdraw PM-KISAN, MGNREGA, and state-DBT benefits at local agent points.",
        apis: ["AePS Cashout", "Aadhaar Verification", "Bank Verification"],
      },
      {
        slug: "mfi-field-operations-pack",
        name: "MFI Field Operations Pack",
        description: "Digitize Kisan credit disbursals and field collections for agricultural MFIs.",
        apis: ["AePS Cashout", "DMT", "Bank Verification", "PAN Verification"],
      },
    ],
    apiGrid: [
      { apiId: "aeps", name: "AePS Cashout", description: "Biometric DBT withdrawal — farmers access PM-KISAN, MGNREGA at village agent points", href: "/products/aeps-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "eKYC for farmer onboarding — most farmers have only Aadhaar as ID", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate Jan Dhan and cooperative bank accounts before DBT or payout routing", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "dmt", name: "DMT", description: "Instant cash-to-bank remittance for seasonal migrants and rural wages", href: "/products/dmt-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "Farmer identity for input credit and cooperative KYC", href: "/products/pan-verification-api", relevance: "M" },
      { apiId: "bbps", name: "BBPS", description: "Collect loan EMIs and cooperative dues digitally from rural borrowers", href: "/products/bbps-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "PM-KISAN cashout at village level",
        situation: "An agri-platform wants to enable farmers in 500 villages to withdraw PM-KISAN instalments without travel to banks.",
        integration: "AePS-enabled village agents at local kirana stores. Farmers use Aadhaar + fingerprint; agents earn commission per transaction.",
        outcome: "80,000 farmer withdrawals per month across 500 villages. Average travel time reduced from 2 hours to 5 minutes.",
      },
      {
        title: "Input finance disbursals to FPO members",
        situation: "A seed company extends input credit to 10,000 FPO members and needs to disburse directly to individual farmer accounts.",
        integration: "Bank Account Verification confirms Jan Dhan accounts for all 10,000 farmers. Fund Transfer disburses credit directly — no cash handling by FPO managers.",
        outcome: "Input credit disbursal time from 3 weeks to same-day. Zero misappropriation incidents.",
      },
      {
        title: "Agricultural MFI field collection",
        situation: "A Kisan credit cooperative collects weekly EMIs from 5,000 farmers across 50 villages.",
        integration: "Field officers use AePS biometric collection app. Each repayment is biometrically authenticated and instantly reconciled.",
        outcome: "Cash handling eliminated. Collection efficiency improved from 78% to 96%.",
      },
    ],
    whyEko: [
      // { title: "Works without smartphones", description: "AePS requires only Aadhaar + fingerprint — the farmer needs nothing. The agent handles all technology.", icon: Fingerprint },
      // { title: "Covers every DBT scheme", description: "All Aadhaar-seeded schemes — PM-KISAN, MGNREGA, PM Fasal Bima, state DBT — via a single AePS integration.", icon: CheckCircle },
      // { title: "200K+ rural touchpoints", description: "Eko's agent network covers Tier 3–5 towns and villages where bank branches are absent.", icon: Users },
      // { title: "2G-ready infrastructure", description: "AePS and DMT transactions complete on minimal bandwidth — designed for rural India's network conditions.", icon: Zap },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "NPCI AePS guidelines", description: "Eko's dual-gateway AePS (FingPay + FINO) meets all NPCI OC 88/91 compliance requirements." },
      { title: "RBI BC framework", description: "Village agents operate under Eko's BCNM licence — no separate bank license required." },
    ],
    faqs: [
      // { question: "Which DBT schemes can farmers access via AePS?", answer: "All Aadhaar-seeded DBT schemes: PM-KISAN, MGNREGA, PM Ujjwala, PMAY, PM Fasal Bima, scholarships, and all state-level DBT programs." },
      { question: "Does AePS work in areas without 4G connectivity?", answer: "Yes. AePS needs only a minimal 2G data connection. Eko's dual gateway (FingPay + FINO) provides fallback for maximum success rates in low-connectivity zones." },
      { question: "How do village agents earn commissions?", answer: "Agents earn ₹5–25 per AePS transaction and ₹10–30 per DMT transfer, settled daily to their Eko wallet or bank account." },
      { question: "Can I assess farmer creditworthiness without a bureau score?", answer: "Yes. AePS transaction history and bank account verification can proxy income signals. For FPO lending, GST verification of the FPO entity supports credit assessment." },
    ],
    relatedIndustries: [
      { slug: "microfinance", name: "Microfinance" },
      { slug: "agent-networks-csp", name: "Agent Networks (CSP/BC)" },
      { slug: "kirana-retail", name: "Kirana & Retail" },
    ],
    seo: {
      title: "Agriculture APIs | Rural Payments & Farmer DBT Cashout",
      description: "AePS DBT cashout, rural money transfer, and FPO payout APIs for India's agricultural sector. Works without smartphones. Covers PM-KISAN, MGNREGA, all DBT schemes.",
      keywords: "agriculture api india, farmer dbt cashout api, pm-kisan withdrawal api, aeps agriculture, rural fintech api india",
    },
    icon: Sprout,
    category: "sector-specific",
    navDescription: "Financial services for farmers & FPOs",
  },


  // MARK:  Automotive
  {
    slug: "automotive",
    name: "Automotive",
    tagline: "Vehicle financing & insurance verification",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Automotive APIs for vehicle verification, financing & insurance",
    heroSubtitle:
      "Auto-fill insurance proposals, verify vehicle ownership for financing, and check fleet credentials in seconds — Eko's automotive APIs connect directly to the VAHAN and Sarathi national databases.",
    trustStrip: [
      "VAHAN National Database",
      "Sub-2-Second Response",
      "99.9% Uptime",
    ],
    challengeText:
      "India's automotive sector processes millions of insurance renewals, vehicle loan disbursals, and used-car transactions every year — all requiring accurate vehicle data that customers often misremember or misrepresent. Manual RC lookups and physical document verification add hours or days to what should be instant transactions.\n\nEko's Vehicle & RC Verification API taps directly into VAHAN 4.0 — returning verified make, model, engine, chassis, ownership, insurance status, blacklist, and permit details in under 2 seconds. This enables instant insurance quotes, fraud-proof loan origination, and automated fleet compliance at scale.",
    recommendedPacks: [
      {
        slug: "motor-insurance-pack",
        name: "Motor Insurance Pack",
        description: "Auto-fill vehicle details, verify ownership, and check DL risk profile — instant motor insurance quotes without manual data entry.",
        apis: ["Vehicle & RC Verification", "DL Verification", "PAN Verification"],
        featured: true,
      },
      {
        slug: "fleet-compliance-pack",
        name: "Fleet Compliance Pack",
        description: "Maintain vehicle RC, insurance, and DL compliance across vehicle fleets with daily automated checks.",
        apis: ["Vehicle & RC Verification", "DL Verification", "Reverse Geocoding"],
      },
    ],
    apiGrid: [
      { apiId: "rc", name: "Vehicle & RC Verification", description: "Fetch make, model, fuel type, chassis, engine, owner, insurance, and blacklist status from VAHAN", href: "/products/vehicle-rc-verification-api", relevance: "H" },
      { apiId: "dl", name: "DL Verification", description: "Validate driver licence validity, vehicle categories, and suspension status", href: "/products/dl-verification-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "Policyholder and loan applicant identity verification", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate EMI payout and claims settlement accounts", href: "/products/bank-verification-api", relevance: "M" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "KYC for loan applicants and policy purchasers", href: "/products/aadhaar-verification-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Instant motor insurance renewal",
        situation: "An insurer wants to let customers renew two-wheeler insurance in under 60 seconds via a mobile app.",
        integration: "Customer enters registration number → Vehicle & RC Verification auto-fills make/model/year, confirms previous policy and NCB → instant premium calculated → policy issued.",
        outcome: "Renewal flow time cut from 8 minutes to 45 seconds. Renewal conversion rate doubled.",
      },
      {
        title: "Used-car loan origination without RC fraud",
        situation: "An auto-finance NBFC processes 5,000 used-car loan applications per month and sees 3% fraud from misrepresented vehicles.",
        integration: "Vehicle & RC Verification API confirms chassis, engine, and hypothecation status on application submission — before any field visit.",
        outcome: "Vehicle fraud rate reduced to near zero. Field visit requirement eliminated for 80% of applications.",
      },
      {
        title: "Dealership service contract verification",
        situation: "An auto dealership network verifies vehicle ownership before each service appointment to prevent unauthorised servicing.",
        integration: "Vehicle & RC Verification confirms current registered owner matches the customer. DL Verification checks driver's licence for liability purposes.",
        outcome: "Unauthorised service claims eliminated. Duplicate warranty fraud reduced 90%.",
      },
    ],
    whyEko: [
      { title: "Direct VAHAN 4.0 integration", description: "99%+ coverage of India's 300+ million registered vehicles across all 36 state RTOs.", icon: CheckCircle },
      { title: "Auto-fill everything", description: "One registration lookup fills make, model, fuel, engine, chassis, owner, and insurance history.", icon: Zap },
      { title: "Stolen & hypothecated check", description: "Vehicle & RC Verification returns blacklist and hypothecation status — critical for used-car lending.", icon: ShieldCheck },
      // { title: "Insurance sector pricing", description: "Dedicated volume pricing tiers for high-volume insurers and auto-finance platforms.", icon: Banknote },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "IRDAI KYC norms", description: "PAN and Aadhaar verification meet IRDAI policyholder identity requirements for all motor policy types." },
      { title: "Motor Vehicles Act 2019", description: "RC and DL data sourced from authoritative VAHAN/Sarathi databases — same data used by traffic enforcement." },
    ],
    faqs: [
      { question: "What data does the Vehicle & RC Verification API return?", answer: "Make, model, fuel type, engine number, chassis number, registration date, owner name, hypothecation status, financing institution, insurance details, blacklist status, and permit info — 50+ fields in a single call." },
      { question: "Does the API check for stolen vehicles?", answer: "Yes. Vehicle & RC Verification returns VAHAN's blacklist status — stolen vehicles registered in the system are flagged in the API response." },
      { question: "Can I check vehicles registered in any state?", answer: "Yes. VAHAN is a national database — vehicle RC data for any registration number, regardless of originating state, is accessible via a single API call." },
      { question: "How current is the insurance data?", answer: "Insurance data in VAHAN is typically updated within 24–72 hours of a policy being issued or renewed." },
    ],
    relatedIndustries: [
      { slug: "insurance", name: "Insurance" },
      { slug: "logistics-fleet", name: "Logistics & Fleet" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
    ],
    seo: {
      title: "Automotive APIs | Vehicle Verification, Insurance & Fleet",
      description: "RC, vehicle verification, and DL APIs for India's automotive sector. VAHAN national database. Sub-2-second response. Motor insurance, auto finance, fleet compliance.",
      keywords: "automotive api india, vehicle rc verification api india, rc api for auto finance, motor insurance api, vahan api india, used car verification api",
    },
    icon: Car,
    category: "sector-specific",
    navDescription: "Vehicle financing & insurance verification APIs",
  },


  // MARK: Travel
  {
    slug: "travel",
    name: "Travel",
    tagline: "Agent KYB & payment verification",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Travel Industry APIs for agent onboarding & payment verification",
    heroSubtitle:
      "Onboard travel agents and tour operators quickly, verify business credentials, and secure every commission payout — Eko gives travel aggregators and OTAs the KYB and payment APIs to scale their agent networks.",
    trustStrip: [
      "Trusted by 50,000+ businesses",
      "RBI Compliant",
      "99.9% Uptime",
    ],
    challengeText:
      "India's travel industry relies on a vast network of independent agents — over 60,000 registered IATA agents and millions of informal resellers. OTAs and travel aggregators onboarding new agents face the same KYB challenge as any marketplace: verify identity, validate the business, confirm the payout account. Doing this manually blocks agent activation for days.\n\nOn the payment side, travel platforms must settle with hotels, airlines, and activity providers across India — often in real time. Verified settlement accounts and instant payment rails are critical to maintaining supplier relationships and agent trust.",
    recommendedPacks: [
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        description: "Onboard travel agents with PAN, GST, and bank verification — activate them for commissions in under 10 minutes.",
        apis: ["PAN Verification", "GST Verification", "Bank Verification", "Aadhaar Verification"],
        featured: true,
      },
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Extend travel credit or BNPL to customers — full KYC and bank verification in one flow.",
        apis: ["Mobile OTP", "PAN Advanced", "Bank Verification", "DigiLocker", "Fund Transfer"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Travel agent and corporate client identity verification", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "gst", name: "GST Verification", description: "Validate agency business registration and filing status", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Confirm agent commission payout and supplier settlement accounts", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Identity for individual agents without GST registration", href: "/products/aadhaar-verification-api", relevance: "M" },
      { apiId: "bbps", name: "BBPS", description: "Collect travel EMIs and booking advance payments via Bharat Connect", href: "/products/bbps-api", relevance: "M" },
      { apiId: "upi-payout", name: "UPI Payout", description: "Real-time commission and supplier settlement disbursals", href: "/products/upi-payout-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "OTA agent network expansion",
        situation: "An OTA wants to onboard 10,000 travel agents across Tier 2–3 cities as business partners.",
        integration: "Merchant Onboarding Pack: mobile OTP → PAN verify → GST check → bank penny-drop → instant activation for booking and commissions.",
        outcome: "Agent activation from 5 days to 8 minutes. 3,000 new agents activated in the first month.",
      },
      {
        title: "Travel BNPL for corporate clients",
        situation: "A B2B travel platform wants to offer 30-day credit to corporate clients for flight and hotel bookings.",
        integration: "Lending KYC Pack verifies company PAN, DigiLocker pulls ITR, bank account confirmed. Fund Transfer issues approved credit to the booking account.",
        outcome: "Corporate GMV increased 60% within 3 months of BNPL launch.",
      },
    ],
    whyEko: [
      { title: "Fast agent activation", description: "PAN + GST + Bank penny-drop completes in under 10 minutes — agents start booking and earning same day.", icon: Zap },
      { title: "Supports informal agents", description: "For agents without GST, PAN + Aadhaar + bank provides a compliant onboarding path.", icon: CheckCircle },
      { title: "Real-time settlement", description: "UPI Payout and IMPS disburse commissions and supplier payments instantly — no T+2 delays.", icon: Banknote },
      { title: "One integration, all checks", description: "PAN, GST, bank, Aadhaar — single API integration covers every KYB requirement.", icon: Layers },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "RBI Payment Aggregator guidelines", description: "Settlement account verification before disbursing collected payments meets RBI PA/PG requirements." },
      { title: "GST compliance", description: "GST Verification confirms agency TCS and input tax credit eligibility for B2B travel transactions." },
    ],
    faqs: [
      { question: "Can I onboard travel agents without GST registration?", answer: "Yes. The pack falls back to PAN + Aadhaar for individual agents below the GST threshold. Bank verification still runs to configure their payout account." },
      { question: "How fast is the bank penny-drop verification?", answer: "Typically under 3 seconds. The API returns account holder name and active/inactive status in the same call." },
      { question: "Can I use Eko for collecting customer advance payments?", answer: "Yes. BBPS supports advance payment collection. For card and UPI collections, Eko's payment gateway partners integrate alongside the verification APIs." },
    ],
    relatedIndustries: [
      { slug: "marketplaces", name: "Marketplaces" },
      { slug: "saas-platforms", name: "SaaS Platforms" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
    ],
    seo: {
      title: "Travel Industry APIs | Agent Onboarding & Payment Verification",
      description: "KYB and payment APIs for travel OTAs, aggregators, and agent networks. PAN, GST, bank verification for agent onboarding. RBI compliant. Sandbox in minutes.",
      keywords: "travel agent verification api india, ota agent onboarding api, travel industry kyb api, travel payment api india",
    },
    icon: Plane,
    category: "sector-specific",
    navDescription: "Agent KYB & payment verification for travel platforms",
  },


  // MARK: Education
  {
    slug: "education",
    name: "Education",
    tagline: "Student loan KYC & fee collection",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Education APIs for student loans, fee collection & institution KYB",
    heroSubtitle:
      "Disburse student loans instantly, collect fees via BBPS, verify educational institutions, and pull academic records directly from DigiLocker — Eko gives edtech and education finance platforms the complete API stack.",
    trustStrip: [
      "RBI Compliant",
      "DigiLocker Integration",
      "99.9% Uptime",
    ],
    challengeText:
      "India's education finance market is growing at 20%+ annually — yet education NBFCs still disburse through manual bank transfers and collect via cheques, creating reconciliation nightmares and delayed access for students.\n\nFor EdTech platforms, the challenge is institution onboarding: verifying a coaching centre or university partner is legitimate before enabling payments. For education lenders, the challenge is documentation — pulling IT returns, Aadhaar, and mark sheets from students who may have all of these in DigiLocker but won't physically submit them.",
    recommendedPacks: [
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Onboard student loan applicants in under 90 seconds — OTP, PAN, Aadhaar, DigiLocker, bank, instant disbursal.",
        apis: ["Mobile OTP", "PAN Advanced", "DigiLocker", "Aadhaar Verification", "Bank Verification", "Fund Transfer"],
        featured: true,
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        description: "Verify coaching institutes and university partners — PAN, GST, bank in one automated KYB flow.",
        apis: ["PAN Verification", "GST Verification", "Bank Verification", "Aadhaar Verification"],
      },
    ],
    apiGrid: [
      { apiId: "digilocker", name: "DigiLocker", description: "Pull mark sheets, degree certificates, Aadhaar, and ITR-V directly — eliminates document forgery", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification", description: "Student and guardian identity verification for loan KYC", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Address and biometric identity for student onboarding", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate student and institution disbursal accounts before transferring loans or fee payments", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Enable school and college fee EMI collection on Bharat Connect", href: "/products/bbps-api", relevance: "H" },
      { apiId: "gst", name: "GST Verification", description: "Verify institution business registration for EdTech partner KYB", href: "/products/gst-verification-api", relevance: "M" },
      { apiId: "upi-payout", name: "UPI Payout", description: "Disburse student loan amounts instantly to verified bank accounts", href: "/products/upi-payout-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Student loan disbursal in 90 seconds",
        situation: "An education NBFC wants to disburse personal loans for coaching fees before students drop off to a competitor.",
        integration: "Lending KYC Pack: student submits mobile → OTP → PAN → DigiLocker auto-pulls Aadhaar + mark sheet → bank penny-drop → fund transfer to institution account immediately.",
        outcome: "Application-to-disbursal time cut from 3 days to 90 seconds. Conversion improved 3.5x.",
      },
      {
        title: "School fee BBPS integration",
        situation: "A school management SaaS wants to collect fees via BBPS so parents can pay from any bank, wallet, or UPI app.",
        integration: "BBPS API registers the school as a biller. Parents pay via any BBPS-enabled app — funds credited to school account next day.",
        outcome: "On-time fee collection improved from 62% to 91%. Cash and cheque collection eliminated entirely.",
      },
      {
        title: "EdTech partner institution KYB",
        situation: "An online learning platform partners with 5,000 offline coaching institutes and must verify each before activation.",
        integration: "Merchant Onboarding Pack: GST verify → PAN confirms promoter identity → bank penny-drop confirms payout account.",
        outcome: "Institute activation from 2 weeks to same-day. Fraudulent signups eliminated.",
      },
    ],
    whyEko: [
      { title: "Paperless document collection", description: "DigiLocker pulls mark sheets, certificates, and ITR-V from the source — no physical scans, no forgery risk.", icon: FileText },
      { title: "BBPS fee collection", description: "Enable parents to pay fees from any bank, UPI app, or wallet via India's Bharat Connect network.", icon: Receipt },
      { title: "Instant loan disbursal", description: "UPI and IMPS payment rails disburse approved loan amounts within seconds of bank account verification.", icon: Zap },
      { title: "RBI compliant lending flows", description: "Fund Transfer, bank verification, and KYC stack designed for RBI Digital Lending Direction compliance.", icon: Shield },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      // { title: "RBI Digital Lending Directions", description: "Direct disbursal to verified student accounts with full audit trails — meets RBI DLD requirements." },
      // { title: "DPDP Act 2023", description: "Student consent flows for DigiLocker and Aadhaar lookups are DPDP-compliant with logged consent records." },
    ],
    faqs: [
      { question: "Can DigiLocker pull educational documents like marksheets?", answer: "Yes. DigiLocker stores CBSE, university, and state board marksheets, degree certificates, and diplomas — fetchable with student consent via Eko's DigiLocker API." },
      { question: "Is BBPS fee collection available for all types of institutions?", answer: "Yes. Schools, colleges, coaching institutes, and universities can register as BBPS billers. Parents pay from any BBPS-enabled app, bank, or counter." },
      { question: "How does the student loan KYC flow work?", answer: "PAN + Aadhaar for identity, DigiLocker for academic documents, and bank penny-drop for the disbursement account — all steps run in parallel for speed." },
      { question: "Can I verify if a university is a legitimate institution before partnering?", answer: "GST and PAN verification confirm the institution's legal business entity. For NAAC/UGC-specific accreditation checks, supplementary lookups are available via our enterprise team." },
    ],
    relatedIndustries: [
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "saas-platforms", name: "SaaS Platforms" },
      { slug: "marketplaces", name: "Marketplaces" },
    ],
    seo: {
      title: "Education APIs | Student Loan, Fee Collection & KYB",
      description: "Student loan disbursal, BBPS fee collection, DigiLocker document verification, and institution KYB APIs for India's education sector. RBI compliant. Sandbox in minutes.",
      keywords: "education loan api india, student loan disbursal api, bbps fee collection api, digilocker education api, edtech kyb api india",
    },
    icon: GraduationCap,
    category: "sector-specific",
    navDescription: "Student loan APIs & BBPS fee collection",
  },


  // MARK: Healthcare
  {
    slug: "healthcare",
    name: "Healthcare",
    tagline: "Staff BGV & patient verification",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Healthcare APIs for staff verification, patient KYC & payments",
    heroSubtitle:
      "Verify doctors, nurses, and hospital staff instantly — background checks, council registration validation, and employment history — with the same platform handling patient payments and medical credit.",
    trustStrip: [
      // "DPDP Act Compliant",
      "EPFO & DigiLocker Integration",
      "RBI Compliant",
      "99.9% Uptime",
    ],
    challengeText:
      "India's healthcare sector employs over 7 million people — yet it faces an acute credential fraud problem. Fake nursing and medical degrees are prevalent; without verified employment history and council registration, hospitals face regulatory and liability risk from unqualified practitioners.\n\nOn the payment side, healthcare NBFCs offering medical credit need the same KYC flow as any digital lender — PAN, Aadhaar, bank account — but with medical document overlays via DigiLocker. Patient identity verification during hospital admission increasingly needs digital, API-driven flows as insurance pre-authorisations move online.",
    recommendedPacks: [
      {
        slug: "employee-bgv-pack",
        name: "Employee BGV Pack",
        description: "Instant BGV for healthcare hires — PAN, Aadhaar, EPFO employment history, education certificates, and address in under 5 minutes.",
        apis: ["PAN Verification", "Aadhaar Verification", "Employee Verification (EPFO)", "DigiLocker", "DL Verification", "Reverse Geocoding"],
        featured: true,
      },
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Medical credit and healthcare BNPL — patient KYC, bank verification, and instant disbursal in one flow.",
        apis: ["Mobile OTP", "PAN Advanced", "Bank Verification", "DigiLocker", "Fund Transfer"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Doctor and staff identity for employment and contractor compliance", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Address and biometric identity for patient onboarding and health insurance KYC", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "employee", name: "Employee Verification (EPFO)", description: "Verify employment history of doctors, nurses, and paramedics at prior institutions", href: "/products/employee-verification-api", relevance: "H" },
      { apiId: "digilocker", name: "DigiLocker", description: "Pull degree certificates, nursing council registrations, and medical diplomas — eliminates fake credentials", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Verify doctor payout and patient insurance claim accounts", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "bbps", name: "BBPS", description: "Collect patient EMI payments and hospital subscription fees on Bharat Connect", href: "/products/bbps-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Hospital chain mass hiring verification",
        situation: "A 50-hospital chain hires 2,000 nurses and paramedics quarterly. Fake nursing council registrations are a recurring problem.",
        integration: "Employee BGV Pack: DigiLocker fetches nursing council certificates at source → EPFO confirms prior employment at registered hospitals → PAN + Aadhaar confirm identity.",
        outcome: "Fake credential rate dropped from 4% to zero. Hiring decision same-day instead of 10 business days.",
      },
      {
        title: "Medical credit / healthcare BNPL",
        situation: "A hospital group partners with an NBFC to offer EMI financing for surgeries. Patients need KYC before discharge.",
        integration: "Lending KYC Pack at bedside: patient scans Aadhaar QR → PAN verified → bank account confirmed → loan disbursed to hospital account within the admission window.",
        outcome: "70% of eligible patients opted for EMI financing. Hospital bad debt from unpaid bills reduced 40%.",
      },
      {
        title: "Locum doctor credential verification",
        situation: "A healthtech staffing platform places locum doctors and needs to verify medical registration within hours of a request.",
        integration: "PAN + DigiLocker confirm medical degree and NMC registration. EPFO lookup checks prior hospital employment. Bank account verified for fee settlement.",
        outcome: "Locum placement time from 3 days to 4 hours. Liability from unregistered doctors eliminated.",
      },
    ],
    whyEko: [
      { title: "Source-verified credentials", description: "DigiLocker pulls certificates directly from issuing universities and nursing councils — impossible to forge.", icon: ShieldCheck },
      { title: "EPFO employment history", description: "Verify every hospital a doctor or nurse has been registered with — no reference calls required.", icon: CheckCircle },
      // { title: "DPDP Act compliant", description: "All credential and employment lookups require and record patient/employee consent — full audit trail.", icon: Shield },
      { title: "Healthcare-specific KYC flows", description: "Pre-built flows for doctor onboarding, patient credit, and nursing staff BGV — not generic verification.", icon: Layers },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      // { title: "DPDP Act 2023 (patient data)", description: "All patient identity data is fetched with explicit consent. Eko stores no raw PII — only verified claim tokens." },
      // { title: "NMC compliance", description: "DigiLocker integration fetches doctor registration certificates from NMC-affiliated sources for authentic credential verification." },
    ],
    faqs: [
      { question: "Can DigiLocker fetch nursing council and medical degree certificates?", answer: "Yes. DigiLocker stores credentials from NMC, state nursing councils, and accredited universities — all fetchable with employee consent via Eko's DigiLocker API." },
      { question: "What if a nurse worked at a small clinic not registered with EPFO?", answer: "For informal employment, the BGV relies on DigiLocker credentials + Aadhaar address verification. The EPFO check flags gaps for your manual review workflow." },
      { question: "Can I use Eko for patient identity verification during hospital admission?", answer: "Yes. Aadhaar OTP verification confirms patient identity and current address at admission. PAN verification is used for high-value insurance pre-authorisations." },
      { question: "Is bulk BGV supported for a hospital chain?", answer: "Yes. All verification APIs support bulk batch mode." },
    ],
    relatedIndustries: [
      { slug: "staffing-hr", name: "Staffing & HR" },
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "insurance", name: "Insurance" },
    ],
    seo: {
      title: "Healthcare APIs | Staff BGV, Patient KYC & Medical Payments",
      description: "Background verification, credential check, and payment APIs for India's healthcare sector. EPFO, DigiLocker, PAN, Aadhaar for doctor and nurse BGV. DPDP compliant.",
      keywords: "healthcare bgv api india, doctor verification api, nurse credential verification api, healthcare kyc api india, medical credit api",
    },
    icon: Heart,
    category: "sector-specific",
    navDescription: "Staff BGV & patient verification for hospitals",
  },


  // MARK: Real Estate
  {
    slug: "real-estate",
    name: "Real Estate",
    tagline: "Home loan KYC & broker verification",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Real Estate APIs for home loan KYC, tenant verification & broker onboarding",
    heroSubtitle:
      "From home loan KYC to tenant background checks to developer and broker verification — Eko gives housing finance companies, proptech platforms, and real estate marketplaces the APIs to close deals faster.",
    trustStrip: [
      "RBI Compliant",
      "DigiLocker ITR Fetch",
      "99.9% Uptime",
    ],
    challengeText:
      "Real estate transactions involve India's largest personal financial commitments. Home loan KYC still relies on physical document submission and manual scrutiny that takes weeks. Housing finance companies are under RBI pressure to digitise borrower onboarding while maintaining robust fraud prevention.\n\nFor proptech platforms onboarding brokers and developers, the KYB challenge mirrors marketplaces: PAN, GST, and bank account must be verified before enabling listing and commission settlement. Tenant verification for rental platforms adds employment and identity verification on top.",
    recommendedPacks: [
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Full home loan applicant KYC — OTP, PAN, Aadhaar, DigiLocker for ITR, bank penny-drop, instant disbursal.",
        apis: ["Mobile OTP", "PAN Advanced", "DigiLocker", "Aadhaar Verification", "Bank Verification", "Fund Transfer"],
        featured: true,
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        description: "Onboard real estate developers and brokers — PAN, GST, and bank verification for commission payouts.",
        apis: ["PAN Verification", "GST Verification", "Bank Verification", "Aadhaar Verification"],
      },
    ],
    apiGrid: [
      { apiId: "pan", name: "PAN Verification", description: "Home loan applicant and property buyer identity verification", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Address and identity for KYC — confirms current residence matches application", href: "/products/aadhaar-verification-api", relevance: "H" },
      { apiId: "digilocker", name: "DigiLocker", description: "Pull ITR-V, Form 16, and Aadhaar from source — paperless loan documentation", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate EMI debit and broker payout accounts", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "gst", name: "GST Verification", description: "Verify developer and broker business registration and GST compliance", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "employee", name: "Employee Verification (EPFO)", description: "Verify employment and income for tenant screening and loan underwriting", href: "/products/employee-verification-api", relevance: "M" },
      { apiId: "upi-payout", name: "UPI Payout", description: "Instant broker commission disbursals after deal closure", href: "/products/upi-payout-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "Digital home loan KYC",
        situation: "A housing finance company wants to move from physical document submission to fully digital loan applications.",
        integration: "Lending KYC Pack: applicant submits Aadhaar OTP → PAN fetch → DigiLocker pulls ITR-V and Form 16 → bank penny-drop for EMI account → loan processing begins instantly.",
        outcome: "Application processing from 14 days to same-day. Document fraud dropped to near zero.",
      },
      {
        title: "Proptech broker onboarding",
        situation: "A proptech marketplace onboards 1,000 brokers per month and needs to verify them before enabling listing and commission settlement.",
        integration: "Merchant Onboarding Pack: mobile OTP → PAN verify → GST check → bank penny-drop. Brokers activated for listing and disbursals.",
        outcome: "Broker activation from 5 days to under 10 minutes. Commission payout failures from 6% to 0.2%.",
      },
      {
        title: "Tenant employment screening",
        situation: "A co-living platform screens thousands of tenant applications per month and needs employment verification alongside ID checks.",
        integration: "PAN + Aadhaar confirm identity and address. EPFO lookup verifies current employment and income. Bank verification confirms deposit refund account.",
        outcome: "Rental fraud (fake employment letters) dropped 85% after EPFO verification was introduced.",
      },
    ],
    whyEko: [
      { title: "Paperless loan documentation", description: "DigiLocker fetches ITR, salary slips, and Aadhaar from source — no physical copies needed at any stage.", icon: FileText },
      { title: "EPFO income verification", description: "Verify employment and income from authoritative EPFO records — fake salary slips can't pass.", icon: ShieldCheck },
      { title: "RBI compliant", description: "KYC, bank verification, and disbursal stack designed for NHB/RBI housing finance requirements.", icon: Shield },
      { title: "Instant broker commissions", description: "UPI Payout disburses broker commissions on deal closure — same-day settlement improves broker retention.", icon: Banknote },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "RBI Housing Finance Directions (NHB)", description: "KYC and bank verification stack meets NHB/RBI requirements for housing loan origination." },
      { title: "RERA compliance", description: "GST + PAN verification of developers cross-validates business entity before listing projects on proptech platforms." },
    ],
    faqs: [
      { question: "Can DigiLocker pull ITR and salary slips for home loan KYC?", answer: "Yes. DigiLocker stores ITR-V filed via the income tax portal, Form 26AS, and salary certificates from EPFO-registered employers — all fetchable with applicant consent." },
      { question: "Does EPFO verification work for self-employed applicants?", answer: "Self-employed applicants without EPFO records are verified via GST filing history and bank statement via DigiLocker — alternative income proof paths supported." },
      // { question: "How does broker commission settlement work?", answer: "After KYB completion, broker bank accounts are verified via penny-drop. Post-deal closure, UPI Payout disburses commissions instantly to those verified accounts." },
      { question: "Can I verify a developer's RERA registration?", answer: "GST and PAN verification confirm the developer's business entity. RERA-specific database lookups are available as a custom integration — contact our enterprise team." },
    ],
    relatedIndustries: [
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "marketplaces", name: "Marketplaces" },
      { slug: "staffing-hr", name: "Staffing & HR" },
    ],
    seo: {
      title: "Real Estate APIs | Home Loan KYC, Broker & Tenant Verification",
      description: "Home loan KYC, broker onboarding, and tenant verification APIs for India's real estate sector. DigiLocker ITR fetch, EPFO employment check, bank verification. RBI compliant.",
      keywords: "real estate api india, home loan kyc api, broker verification api india, tenant screening api, digilocker itr api, proptech api india",
    },
    icon: Home,
    category: "sector-specific",
    navDescription: "Home loan KYC & broker verification APIs",
  },


  // MARK: Accounting Tax
  {
    slug: "accounting-tax",
    name: "Accounting & Tax",
    tagline: "GST data & MSME credit assessment for CAs",
    priority: 2,
    eyebrow: "INDUSTRY",
    h1: "Accounting & Tax APIs for GST, ITR & MSME credit assessment",
    heroSubtitle:
      "Give your CA firm, accounting SaaS, or tax platform the data APIs to pull GST filing history, verify PAN identities, fetch ITR records, and assess MSME creditworthiness — all from a single integration.",
    trustStrip: [
      // "12 Quarters of GST History",
      "CBDT ITR Data via DigiLocker",
      "RBI Compliant",
      "99.9% Uptime",
    ],
    challengeText:
      "Chartered accountants and tax professionals spend enormous time manually verifying client business details, cross-checking GST filing compliance, and gathering financial documents for loan applications. With 14 million GST-registered businesses and 80+ million ITR filers in India, the volume of data lookups is enormous — yet most CA firms still do this manually through the GST portal, creating hours of non-billable work per client.\n\nFor accounting SaaS platforms, the opportunity is to embed these data APIs as premium features. For MSME lending platforms, GST filing history and ITR data from DigiLocker are the best available credit score substitute for the 40+ million MSMEs that have no bureau score.",
    recommendedPacks: [
      {
        slug: "msme-credit-assessment-pack",
        name: "MSME Credit Assessment Pack",
        description: "Assess MSME creditworthiness using GST filing patterns, ITR history, and bank account validation — no traditional credit score required.",
        apis: ["GST Verification", "PAN Advanced", "Bank Verification", "DigiLocker"],
        featured: true,
      },
      {
        slug: "merchant-onboarding-pack",
        name: "Merchant Onboarding Pack",
        description: "Onboard business clients with PAN, GST, and bank verification — activate them for billing and service access.",
        apis: ["PAN Verification", "GST Verification", "Bank Verification", "Aadhaar Verification"],
      },
      {
        slug: "lending-kyc-pack",
        name: "Lending KYC Pack",
        description: "Full KYC for MSME loan applicants — PAN, DigiLocker ITR, GST history, bank account, instant disbursal.",
        apis: ["PAN Advanced", "DigiLocker", "GST Verification", "Bank Verification", "Fund Transfer"],
      },
    ],
    apiGrid: [
      { apiId: "gst", name: "GST Verification (Advanced)", description: "Fetch up to 12 quarters of filing history, turnover trends, and compliance score", href: "/products/gst-verification-api", relevance: "H" },
      { apiId: "pan", name: "PAN Verification (Advanced)", description: "Verify taxpayer identity and check PAN-GST linkage for business clients", href: "/products/pan-verification-api", relevance: "H" },
      { apiId: "digilocker", name: "DigiLocker", description: "Pull ITR-V, Form 26AS, and financial statements directly from CBDT with taxpayer consent", href: "/products/digilocker-api", relevance: "H" },
      { apiId: "bank", name: "Bank Account Verification", description: "Validate client payout and tax refund accounts", href: "/products/bank-verification-api", relevance: "H" },
      { apiId: "aadhaar", name: "Aadhaar Verification", description: "Individual taxpayer identity and address verification", href: "/products/aadhaar-verification-api", relevance: "M" },
      { apiId: "name-match", name: "Name Match", description: "Cross-validate PAN name, GST trade name, and bank account holder — catch discrepancies for ITC fraud detection", href: "/products/name-match-api", relevance: "M" },
    ],
    useCaseVignettes: [
      {
        title: "CA practice: one-click client GST due diligence",
        situation: "A CA firm serving 500 SME clients needs to review each client's GST filing compliance and turnover quarterly for tax planning.",
        integration: "Eko's GST Verification API fetches 12 quarters of filing history, return status, and taxable turnover per call. CA dashboard shows compliance trends in real time.",
        outcome: "Client review time per filing cycle from 2 hours to 5 minutes. CAs launched a new 'compliance monitoring' premium tier.",
      },
      {
        title: "MSME credit assessment without bureau score",
        situation: "A fintech lender wants to offer working capital loans to 50,000 small manufacturers who have no CIBIL score.",
        integration: "MSME Credit Assessment Pack: GSTIN entered → 8 quarters of filing data → PAN links promoter identity → DigiLocker pulls ITR-V → bank account validated. Real-time credit score generated.",
        outcome: "₹200 Cr disbursed to credit-invisible MSMEs in 6 months. Default rate within CIBIL-scored benchmark.",
      },
      {
        title: "Accounting SaaS adds vendor KYB",
        situation: "An accounts payable SaaS wants to auto-verify vendor bank accounts before releasing payments to new suppliers.",
        integration: "Merchant Onboarding Pack as a webhook: new vendor added → PAN verify → GST check → bank penny-drop → payment terms activated.",
        outcome: "Fraudulent vendor additions dropped 94%. AP team eliminated manual bank detail verification entirely.",
      },
    ],
    whyEko: [
      // { title: "12 quarters of GST history", description: "GST Verification returns 3 years of filing patterns — the richest proxy for MSME business health available.", icon: BarChart3 },
      { title: "CBDT & DigiLocker integration", description: "Pull ITR-V and Form 26AS from the income tax department directly with taxpayer consent.", icon: FileText },
      { title: "Name Match for ITC fraud detection", description: "Fuzzy matching across PAN, GST, and bank records catches fake invoice fraud that manual review misses.", icon: ShieldCheck },
      { title: "Pay per lookup", description: "No retainer. CA firms and accounting SaaS pay per API call — costs scale with your client base.", icon: Banknote },
    ],
    integrationSteps: DEFAULT_INTEGRATION_STEPS,
    complianceItems: [
      { title: "GSTN data access", description: "All GST data fetched from GSTN's official APIs — authoritative, real-time filing data only." },
      { title: "CBDT / DigiLocker consent flow", description: "ITR and Form 26AS access requires taxpayer consent — Eko's DigiLocker integration includes a DPDP-compliant consent capture step." },
    ],
    faqs: [
      { question: "How many quarters of GST data can I fetch per call?", answer: "Eko's Advanced GST API provides up to 12 quarters (3 years) of filing history including return status, taxable value, and compliance score per GSTIN." },
      { question: "Can I fetch a client's ITR directly from the CBDT system?", answer: "Yes. DigiLocker stores ITR-V acknowledgements and Form 26AS filed through the income tax portal — fetchable with the taxpayer's explicit DigiLocker consent." },
      { question: "Can I use GST history as a credit scoring signal?", answer: "Yes. GST filing regularity, turnover trend, and compliance score are used by multiple NBFCs as primary credit indicators for MSMEs with no bureau history." },
      { question: "Does the Name Match API work for GST trade names vs. PAN legal names?", answer: "Yes. Name Match uses fuzzy matching with transliteration support — handles regional name variations and GST trade name abbreviations versus full legal PAN names." },
      { question: "Is this useful for GST ITC fraud detection?", answer: "Yes. Cross-validating supplier PAN, GSTIN, and bank account holder names against purchase invoices using Name Match catches a significant portion of fake invoice fraud." },
    ],
    relatedIndustries: [
      { slug: "lending-nbfc", name: "Lending & NBFC" },
      { slug: "saas-platforms", name: "SaaS Platforms" },
      { slug: "marketplaces", name: "Marketplaces" },
    ],
    seo: {
      title: "Accounting & Tax APIs | GST Verification, ITR & MSME Credit",
      description: "GST filing history, ITR data pull, PAN verification, and MSME credit assessment APIs for CAs, accounting SaaS, and tax platforms. 12 quarters of GST data. Sandbox free.",
      keywords: "gst verification api india, itr api india, msme credit assessment api, accounting api india, ca gst data api, pan gst verification india",
    },
    icon: Calculator,
    category: "sector-specific",
    navDescription: "GST filing data & MSME credit assessment for CAs",
  },
];

/** Set of display names of disabled products (for filtering recommendedPacks.apis strings) */
const DISABLED_PRODUCT_NAMES: Set<string> = new Set(
  API_PRODUCTS.filter((p) => p.disabled).map((p) => p.name)
);

/** Strip references to disabled products from an industry's API lists */
function stripDisabledApis(industry: IndustryData): IndustryData {
  return {
    ...industry,
    apiGrid: industry.apiGrid.filter((a) => !API_PRODUCTS_MAP[a.apiId]?.disabled),
    recommendedPacks: industry.recommendedPacks.map((pack) => ({
      ...pack,
      apis: pack.apis.filter((name) => !DISABLED_PRODUCT_NAMES.has(name)),
    })),
  };
}

/** INDUSTRIES_LIST with disabled product references stripped, and industries with no remaining APIs excluded */
export const ACTIVE_INDUSTRIES_LIST: IndustryData[] = INDUSTRIES_LIST.map(stripDisabledApis).filter((i) => i.apiGrid.length > 0);

export const INDUSTRIES_MAP: Record<string, IndustryData> = Object.fromEntries(
  ACTIVE_INDUSTRIES_LIST.map((i) => [i.slug, i])
);

/** Group industries by category for display */
export const INDUSTRY_CATEGORIES: { label: string; key: IndustryCategory; industries: IndustryData[] }[] = [
  { label: "Financial Services", key: "financial-services", industries: ACTIVE_INDUSTRIES_LIST.filter((i) => i.category === "financial-services") },
  { label: "Agent & Retail", key: "agent-retail", industries: ACTIVE_INDUSTRIES_LIST.filter((i) => i.category === "agent-retail") },
  { label: "Digital / Tech", key: "digital-tech", industries: ACTIVE_INDUSTRIES_LIST.filter((i) => i.category === "digital-tech") },
  { label: "Workforce & Fleet", key: "workforce-fleet", industries: ACTIVE_INDUSTRIES_LIST.filter((i) => i.category === "workforce-fleet") },
  { label: "Sector-Specific", key: "sector-specific", industries: ACTIVE_INDUSTRIES_LIST.filter((i) => i.category === "sector-specific") },
];
