# EPS Website: Industry & Pack Pages Plan

A complete plan to extend `eps.eko.in` with dedicated Use Case pages — covering information architecture, URL structure, page templates, microcopy, SEO, and a phased rollout.

---

## 1. Strategic foundation

### Goals (in priority order)
1. **SEO / organic acquisition** — capture intent searches like "lending KYC API India", "AePS API for kirana", "MFI digital collection", "BBPS API for NBFC EMI"
2. **Sales enablement** — give the sales team shareable, vertical-specific landing pages for outbound and demo follow-ups
3. **Self-serve developer signups** — convert problem-aware visitors into sandbox signups via clear "what to integrate" guidance

### Two-axis architecture
The same content gets organized along two intersecting axes — every Pack belongs to one or more Industries, and every Industry uses one or more Packs. This creates a dense internal-link graph that is excellent for SEO and helps visitors navigate from "I am X" thinking to "I need Y" thinking.

```
INDUSTRIES  ───┐         ┌───  PACKS
(who you are)  │         │  (what you build)
               ▼         ▼
         ┌─────────────────────┐
         │     USE CASES       │ ← cross-linked grid
         │  (intersection of   │
         │   industry × pack)  │
         └─────────────────────┘
                  │
                  ▼
              API PRODUCTS
              (existing pages)
```

---

## 2. URL structure

Following the existing `/products/<name>` pattern, use these new patterns:

| Page type | URL pattern | Example |
| --- | --- | --- |
| Use Cases hub | `/use-cases` | `/use-cases` |
| Industry hub | `/industries` | `/industries` |
| Industry detail | `/industries/<slug>` | `/industries/lending-nbfc` |
| Solutions/Packs hub | `/solutions` | `/solutions` |
| Solution/Pack detail | `/solutions/<slug>` | `/solutions/lending-kyc-pack` |

**Why these names:**
- **`/industries/`** is unambiguous, plural-noun, and SEO-friendly ("lending nbfc api solutions")
- **`/solutions/`** instead of `/packs/` because "solution" is a higher-intent search term and aligns with B2B SaaS conventions (Razorpay, Cashfree, Setu all use `/solutions/`). The on-page label can still say "Pack" as branding.
- **`/use-cases`** stays as the umbrella hub that the existing top-nav link points to

**Slug examples:**

Industries (17):
```
/industries/lending-nbfc
/industries/microfinance
/industries/insurance
/industries/agent-networks-csp
/industries/kirana-retail
/industries/marketplaces
/industries/saas-platforms
/industries/staffing-hr
/industries/logistics-fleet
/industries/e-commerce
/industries/agriculture
/industries/automotive
/industries/travel
/industries/education
/industries/healthcare
/industries/real-estate
/industries/accounting-tax
```

Solutions / Packs (start with top 12, expand to 26):
```
/solutions/lending-kyc-pack
/solutions/msme-credit-assessment-pack
/solutions/merchant-onboarding-pack
/solutions/employee-bgv-pack
/solutions/gig-worker-onboarding-pack
/solutions/fleet-compliance-pack
/solutions/motor-insurance-pack
/solutions/assisted-banking-agent-pack
/solutions/rural-financial-services-pack
/solutions/mfi-field-operations-pack
/solutions/dbt-cashout-pack
/solutions/migrant-remittance-hub-pack
```

---

## 3. Menu changes

### Top navigation (current → proposed)

**Current:** `Products ▾  |  Use Cases  |  Developers  |  Company ▾`

**Proposed:** `Products ▾  |  Solutions ▾  |  Industries ▾  |  Developers  |  Company ▾`

The current "Use Cases" link goes to a homepage anchor — replace it with two proper mega-menu dropdowns. Reasoning: "Use Cases" is too vague for first-time visitors. Splitting it into Solutions (what you build) and Industries (who you are) doubles the entry points and matches how visitors actually think.

#### Solutions mega-menu (mirrors the Products mega-menu pattern)

```
┌────────────────────────────────────────────────────────────┐
│  ⭐ FEATURED                                                │
│  Assisted Banking Agent Pack                            →  │
│  AePS + DMT + BBPS + PPI for kirana & CSP networks         │
├────────────────────────────────────────────────────────────┤
│  LENDING & CREDIT      │ ONBOARDING       │ AGENT BANKING  │
│  Lending KYC Pack      │ Merchant         │ Assisted       │
│  MSME Credit Pack      │ Onboarding Pack  │ Banking Pack   │
│  Co-lending Pack       │ Marketplace      │ Rural Services │
│                        │ Seller Pack      │ Pack           │
│                        │                  │ MFI Field Ops  │
│                        │                  │ DBT Cashout    │
│                        │                  │                │
│  HR & WORKFORCE        │ FLEET & MOTOR    │ More...        │
│  Employee BGV Pack     │ Fleet Compliance │                │
│  Gig Worker Pack       │ Vehicle Finance  │                │
│  Blue-collar Pack      │ Motor Insurance  │                │
└────────────────────────────────────────────────────────────┘
```

#### Industries mega-menu

```
┌────────────────────────────────────────────────────────────┐
│  ⭐ FEATURED                                                │
│  Built for Bharat                                       →  │
│  See how we power 50,000+ MSMEs across Tier 2 and beyond   │
├────────────────────────────────────────────────────────────┤
│  FINANCIAL SERVICES   │ AGENT & RETAIL    │ DIGITAL/TECH   │
│  Lending & NBFC       │ Kirana & Retail   │ SaaS Platforms │
│  Microfinance         │ Agent Networks    │ Marketplaces   │
│  Insurance            │ (CSP / BC)        │ E-commerce     │
│                       │                   │                │
│  WORKFORCE & FLEET    │ SECTOR-SPECIFIC   │                │
│  Staffing & HR        │ Agriculture       │  See all →     │
│  Logistics & Fleet    │ Automotive        │                │
│                       │ Travel            │                │
│                       │ Education         │                │
└────────────────────────────────────────────────────────────┘
```

### Footer changes

Add a new column **"Solutions"** between Products and Developers:

```
PRODUCTS       SOLUTIONS              INDUSTRIES        DEVELOPERS    LEGAL    COMPANY
BC APIs        Lending KYC Pack       Lending & NBFC    Documentation Privacy  About Us
Payments APIs  Assisted Banking Pack  Microfinance      Guides        T&C      Grievance
Verif APIs     Employee BGV Pack      Kirana & Retail   API Reference Refund   Signup
Eko Shield     Fleet Compliance Pack  Agent Networks                  Compl.
               See all solutions →    See all industries →
```

This gives both axes prominent footer real estate and creates ~30 new internal links from every page on the site (a significant SEO boost).

---

## 4. Page templates

### 4.1 Use Cases hub page (`/use-cases`)

The existing homepage section becomes a full hub page. The current homepage section should remain (as a teaser linking here).

**Sections, top to bottom:**

1. **Hero** — Headline: "Find the right Eko stack for your business" / Sub: "Browse by industry to see how teams like yours use Eko, or by solution pack to see pre-bundled APIs for common workflows."
2. **Two big choice cards** — "I'm building for an industry →" and "I need a specific solution →" (visual fork)
3. **Featured solutions grid** (6 cards) — Lending KYC Pack, Assisted Banking Agent Pack, Merchant Onboarding Pack, MFI Field Ops Pack, Employee BGV Pack, Fleet Compliance Pack
4. **Industries grid** (the existing 6 cards from homepage, now expanded to all 17 with category headers: Financial Services / Agent & Retail / Digital / Workforce & Fleet / Sector-Specific)
5. **"How it works" strip** — 3 steps: Pick industry or solution → Review APIs in the bundle → Get sandbox access
6. **Stats bar** — "50,000+ businesses · 200K+ agent touchpoints · 99.9% uptime · RBI compliant"
7. **CTA** — "Talk to our solutions team" + "Explore APIs"

---

### 4.2 Industry detail page template (`/industries/<slug>`)

Goal of this template: a visitor arriving from Google for "BBPS API for NBFC" or "AePS API for microfinance" should immediately see (a) yes we serve you, (b) here's the exact bundle we recommend, (c) here's what other companies like you build, (d) start now.

**Sections, top to bottom:**

1. **Breadcrumb** — `Home → Industries → Lending & NBFC`
2. **Hero**
   - **Eyebrow tag**: "INDUSTRY" (small pill, gold)
   - **H1**: `[Industry] APIs & solutions for India's MSMEs` (e.g., "Lending & NBFC APIs for India's MSMEs")
   - **Sub-headline**: 2-line description of what Eko does for this industry
   - **Trust strip**: "Trusted by 200+ NBFCs" / "RBI compliant" / "99.9% uptime"
   - **Primary CTA**: "Get sandbox access" + Secondary: "Talk to sales"
   - **Right side**: Industry-relevant illustration or 3-API code snippet (matching the existing DMT page style)
3. **"The challenge" strip** — A short, visitor-validating description of the pain points this industry faces (regulatory, operational, cost). 3 short paragraph cards. Builds credibility and aligns search intent.
4. **"Recommended solution packs"** — 1-3 packs that map to this industry, displayed as large cards with: pack name, one-line description, list of APIs included (chips), "Explore pack →" link to `/solutions/<pack>`. **This is the most important section** — it bridges Industry → Pack → API.
5. **"All APIs you'll need"** — Grid of every individual Eko API relevant to this industry (each linking to its `/products/<name>` page), grouped by BC / Payments / Verification. Each card has a tiny H/M/L relevance badge using the matrix from the research report.
6. **"Real-world use cases"** — 4-6 concrete scenarios written in plain language. Each scenario is a 3-line vignette: situation → what they integrate → outcome. (Microcopy samples below.)
7. **"Why Eko for [Industry]"** — 4 differentiators specific to this industry. For Lending it might be: instant disbursal, RBI Digital Lending compliant, co-lending support, Bulk PAN/Bank for portfolios. For Agent Networks it would be: AePS dual-gateway, pan-India BC license, commission engine, biometric device support.
8. **"How to integrate"** — 5-step horizontal strip (matches existing DMT page style)
9. **Compliance & regulatory** — A short 2-3 bullet section listing the RBI/IRDAI/NPCI mandates this industry must meet, and which Eko APIs help satisfy each. Builds enterprise trust.
10. **FAQ** — 5-7 industry-specific questions
11. **Related industries** — 3 cards linking to adjacent industries (e.g., Lending links to Microfinance, MSME marketplaces, Insurance)
12. **Bottom CTA** — Same as DMT page: "Get API Access" form on the right, benefits checklist on the left

---

### 4.3 Solution/Pack detail page template (`/solutions/<slug>`)

Goal: a visitor arriving from a sales conversation, a comparison search ("Razorpay vs Eko KYC stack"), or a "lending KYC API bundle" search should see (a) what's in the box, (b) how it solves a specific job, (c) pricing/commercial model signal, (d) which industries use it.

**Sections, top to bottom:**

1. **Breadcrumb** — `Home → Solutions → Lending KYC Pack`
2. **Hero**
   - **Eyebrow tag**: "SOLUTION PACK"
   - **H1**: Pack name (e.g., "Lending KYC Pack")
   - **Sub-headline**: One sentence — "Everything a digital lender needs to onboard, verify, and disburse — in one bundle."
   - **API chip row** — Visual chips showing the APIs included: `PAN Advanced` `Bank Verification` `Name Match` `ITR` `DigiLocker`. Each chip is a link to the product page.
   - **Trust strip**: "Used by 100+ lenders" / "RBI Digital Lending compliant"
   - **CTAs**: "Get sandbox access" + "Download integration guide"
3. **"The job this pack does"** — Single bold paragraph stating exactly which workflow this pack enables, in business language not technical language. One line. (E.g., "Onboard a digital loan applicant in under 90 seconds with verified identity, income, and a payout-ready bank account.")
4. **"What's inside the pack"** — A vertical list of every API in the pack. Each row shows:
   - API name (linked to its `/products/` page)
   - One-line explanation of what it does
   - One-line explanation of *why it's in this pack* (the role it plays)
   - A small icon
   - This is the most informative section. Microcopy sample below.
5. **"How it works" — sequence diagram or numbered flow** — Shows the typical integration order. For Lending KYC Pack: `1. Mobile OTP → 2. PAN Advanced → 3. DigiLocker → 4. Bank Account Verification → 5. Name Match cross-check → 6. ITR Compliance → 7. Ready to disburse via Fund Transfer`. Each step shows which API is called and what the response unlocks.
6. **"Industries using this pack"** — 3-5 industry cards linking to `/industries/<slug>`. This is the cross-link back to the Industry axis.
7. **"Example integration"** — A code snippet block (matching the homepage hero style — terminal-themed with verify.js). Shows actual API calls in sequence. Has a tab switcher: cURL / Node.js / Python / PHP. This is high-value for developers and signals technical credibility.
8. **"Why this pack vs. building it yourself"** — A short comparison table: DIY (months of integration, multiple vendor contracts, compliance overhead) vs. Eko Pack (single contract, single dashboard, RBI compliant, 1-day integration).
9. **Pricing model** — Even if exact prices aren't shown, signal the commercial model: "Pay-per-use, no setup fee. Volume discounts available. Sandbox is free." This addresses the #1 silent question of every B2B visitor.
10. **FAQ** — 5-7 pack-specific questions
11. **Related solutions** — 3 cards linking to complementary packs (e.g., Lending KYC Pack links to MSME Credit Assessment Pack, Co-lending Compliance Pack)
12. **Bottom CTA** — Identical to industry pages

---

## 5. Microcopy library

Below are full text samples for two pages — one industry, one pack — that you can copy directly. Other pages should follow the same voice and structure.

### 5.1 Sample: `/industries/lending-nbfc`

**Eyebrow:** INDUSTRY

**H1:** Lending & NBFC APIs for India's digital lenders

**Sub-headline:** From borrower onboarding to instant disbursal to digital collections — Eko gives NBFCs, fintech lenders, and co-lending partners a single API stack that's RBI-compliant out of the box.

**Trust strip:** Trusted by 200+ lenders · RBI Digital Lending compliant · 99.9% uptime · ₹15,000 Cr+ disbursed monthly through Eko rails

**Primary CTA:** Get sandbox access
**Secondary CTA:** Talk to a lending solutions specialist

---

**Section: The challenge for India's lenders**

> India has 63 million underserved MSMEs and 500+ million credit-eligible adults — but onboarding them, assessing their creditworthiness, and disbursing funds compliantly has been a six-vendor, six-contract problem. The RBI's Digital Lending Directions add a layer of complexity around verified bank accounts, direct disbursal, and borrower KYC that small NBFCs struggle to meet without dedicated tech teams.
>
> Eko consolidates the entire lending workflow — KYC, credit assessment, disbursal, and collection — into a single API platform with one contract, one dashboard, and one integration partner.

---

**Section: Recommended solution packs**

**Pack 1: Lending KYC Pack** ⭐ Most popular
Everything a digital lender needs to onboard a borrower in under 90 seconds.
Includes: PAN Advanced · Bank Verification · DigiLocker · Name Match · ITR Compliance · Mobile OTP
[Explore pack →]

**Pack 2: MSME Credit Assessment Pack**
Assess MSME creditworthiness using GST filing patterns, ITR history, and bank account validation — no traditional credit score required.
Includes: GSTIN Verify · Advance GST · PAN Advanced · Bank Verification · ITR Compliance · CIN
[Explore pack →]

**Pack 3: Co-lending Compliance Pack**
Bulk verify portfolios shared between NBFC and bank partners under RBI co-lending guidelines.
Includes: Bulk PAN · Bulk Bank Verification · Name Match · GSTIN · CIN
[Explore pack →]

---

**Section: All APIs you'll need**

(Grid with H/M/L badges. Each card is 1-line.)

- **PAN Verification (Advanced)** — Fetch full borrower identity in <2 seconds [HIGH]
- **Bank Account Verification (Penny Drop)** — Confirm payout account before disbursal [HIGH]
- **DigiLocker** — Pull Aadhaar, driving licence, marksheets paperlessly [HIGH]
- **Name Match** — Cross-check name across PAN, bank, Aadhaar to prevent mule accounts [HIGH]
- **ITR Compliance** — Validate declared income and filing history [HIGH]
- **Fund Transfer (NEFT/IMPS/UPI)** — Disburse loans instantly to verified accounts [HIGH]
- **BBPS** — Collect EMIs nationwide via Bharat Connect [HIGH]
- **GSTIN Verification** — For MSME credit assessment [HIGH]
- **AePS Cashout** — Enable rural borrowers to withdraw disbursed funds at agent points [MEDIUM]
- **Mobile OTP** — Authenticate every step of the journey [HIGH]

---

**Section: Real-world use cases**

**Personal loan onboarding in 90 seconds**
A digital lender wants to onboard a salaried borrower from app download to disbursal in under two minutes. They integrate the Lending KYC Pack: borrower enters mobile → OTP → PAN → DigiLocker auto-pulls Aadhaar → bank account penny-drop → ITR check → loan disbursed via UPI. Result: 4x conversion improvement, 60% drop in fraud applications.

**MSME working capital, no credit score needed**
A new-age NBFC wants to lend to kirana stores that have no credit history. They use the MSME Credit Assessment Pack to pull GST filing patterns (an excellent cash-flow proxy) plus ITR history plus bank statement validation. Result: ₹10 Cr disbursed in 3 months to previously rejected borrowers.

**Co-lending portfolio verification**
A bank partnering with a fintech lender under RBI co-lending guidelines must independently verify every borrower in a 50,000-loan portfolio. They use Bulk PAN + Bulk Bank Account Verification to reconcile the portfolio overnight. Result: monthly compliance reporting that took 2 weeks now takes 2 hours.

**Rural disbursal with AePS withdrawal**
A rural-focused NBFC disburses loans to farmers' bank accounts but borrowers struggle to withdraw without nearby ATMs. They add AePS Cashout to their stack — borrowers can now withdraw at any of Eko's 200K+ agent touchpoints using just their fingerprint. Result: 30% improvement in customer satisfaction, faster recycling of working capital.

---

**Section: Why Eko for lenders**

- **Instant disbursal across all rails** — UPI, IMPS, NEFT, RTGS with smart routing for highest success rates
- **RBI Digital Lending compliant** — Direct RE-to-borrower disbursal, verified bank accounts, full audit trail
- **Built-in fraud prevention** — Name Match, IP velocity checks, GST cross-validation, biometric authentication
- **Scales from startup to enterprise** — Same APIs power 5-loan-a-day pilots and 50,000-loan-a-day production systems

---

**Section: How to integrate**

(5-step strip identical to existing DMT page)

`1. Sign Up` → `2. Submit KYC` → `3. Integrate APIs` → `4. Test in Sandbox` → `5. Go Live`

[View Documentation →]

---

**Section: Compliance & regulatory**

- **RBI Digital Lending Directions** — Eko's Fund Transfer, Bank Verification, and KYC stack are designed for direct RE-to-borrower flows
- **CKYC upload within 3 days** — Automated via Eko's KYC bundle
- **PMLA/AML compliance** — Name Match, IP Verification, and Reverse Geocoding for enhanced due diligence

---

**Section: FAQ for lenders**

- Is Eko's Fund Transfer API compliant with RBI Digital Lending Directions?
- Can I bulk-verify 50,000 borrowers in a single batch?
- How does Eko's Name Match handle regional name variations?
- What's the typical sandbox-to-production timeline for an NBFC?
- Do you support co-lending portfolio reconciliation?
- How does the AePS Cashout option help my rural borrowers?
- Is there a minimum monthly transaction commitment?

---

### 5.2 Sample: `/solutions/assisted-banking-agent-pack`

**Eyebrow:** SOLUTION PACK

**H1:** Assisted Banking Agent Pack

**Sub-headline:** Turn any kirana, CSP, or retail counter into a complete banking touchpoint — cash withdrawal, money transfer, bill payments, and wallet services in one integrated bundle.

**API chips:** `AePS Cashout` `DMT` `BBPS` `PPI DigiKhata` `Mobile OTP` `SMS`

**Trust strip:** Powering 200K+ agent touchpoints · 1.5 Cr+ transactions/month · NPCI & RBI compliant

**CTAs:** Get sandbox access · Download integration guide

---

**Section: The job this pack does**

> Enable any retailer in India to offer assisted banking services to walk-in customers — biometric cash withdrawal, instant money transfer, utility bill payments, and prepaid wallets — from a single integration. No bank branch required.

---

**Section: What's inside the pack**

**🔐 AePS Cashout**
*What it does:* Aadhaar-authenticated biometric cash withdrawal at agent points via FingPay & FINO gateways.
*Why it's in this pack:* The core service that turns a retail counter into a micro-ATM. Serves the 200–300 million Indians who can't use UPI or mobile banking.
[See API docs →]

**💸 Domestic Money Transfer (DMT)**
*What it does:* Cash-to-bank-account remittance via IMPS/NEFT under RBI's BC model.
*Why it's in this pack:* Lets agents accept cash from migrant workers and transfer it to family bank accounts in real time. Pairs with AePS to complete the urban-to-rural remittance loop.
[See API docs →]

**🧾 Bill Payment (BBPS / Bharat Connect)**
*What it does:* Pay 25+ biller categories — electricity, gas, DTH, broadband, EMI, insurance — through a single integration.
*Why it's in this pack:* Drives footfall and frequency. Bills are paid every month, so customers come back every month.
[See API docs →]

**👛 PPI DigiKhata (Prepaid Wallet)**
*What it does:* Issue and manage RBI-compliant prepaid wallets for end customers.
*Why it's in this pack:* Lets agents onboard customers into a digital wallet, opening up gift cards, loyalty, and recurring payments.
[See API docs →]

**📱 Mobile OTP**
*What it does:* Send and verify OTPs across telecom networks.
*Why it's in this pack:* Required for daily agent authentication, customer verification, and transaction confirmation.
[See API docs →]

**💬 Send SMS**
*What it does:* Transactional SMS delivery for receipts, alerts, and notifications.
*Why it's in this pack:* Every transaction generates a customer receipt — critical for trust and dispute resolution in cash-handling environments.
[See API docs →]

---

**Section: How it works**

```
1. Customer walks into agent shop
   ↓
2. Agent identifies service: Withdraw / Send / Pay Bill
   ↓
3. AePS: Aadhaar + biometric → instant cash
   DMT: Beneficiary + amount → instant transfer
   BBPS: Biller + customer ID → bill paid
   ↓
4. Customer gets SMS receipt
   ↓
5. Agent earns commission, settled to wallet
```

---

**Section: Industries using this pack**

- **Kirana & Retail** — Single shops becoming the "neighbourhood bank" [Explore →]
- **Agent Networks (CSP / BC)** — Distributors and BCNMs scaling 1,000+ agent operations [Explore →]
- **Microfinance** — Field officers replacing cash collection with biometric authentication [Explore →]
- **Agriculture** — FPOs and agri-cooperatives offering financial services to farmers [Explore →]
- **Rural NBFCs** — Last-mile borrower disbursal and collection [Explore →]

---

**Section: Example integration**

(Tabbed code block matching the homepage hero style)

```javascript
// Initialize Eko API Client
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
console.log(withdrawal.commission); // "12"
```

---

**Section: Why this pack vs. building it yourself**

| | **DIY** | **Eko Assisted Banking Pack** |
|---|---|---|
| Vendor contracts | 4–6 separate vendors | 1 |
| BC license | Apply separately, 6+ months | Eko is the BCNM |
| AePS gateway | Direct NPCI relationship needed | FingPay + FINO dual-gateway included |
| Compliance (RBI ATO directions, NPCI OC 88/91) | Your team's burden | Built into the platform |
| Time to first transaction | 6–9 months | 7–14 days |
| Biometric device support | DIY integration | 5 STQC-certified models pre-integrated |

---

**Section: Commercial model**

> **Pay-per-transaction. No setup fee. Sandbox is free.**
> Agents earn ₹2–25 per transaction depending on service and amount. Eko shares interchange revenue with you under a transparent multi-tier structure. Volume discounts kick in at 10,000+ monthly transactions.
>
> [Get pricing →]

---

**Section: FAQ**

- How long does AePS agent activation take?
- Which biometric devices does Eko support?
- What's the daily AePS withdrawal limit per customer?
- How does Eko's dual-gateway (FingPay + FINO) improve success rates?
- Can I white-label this entire stack under my own brand?
- Do agents need a BC license individually?
- How does commission settlement work?

---

**Section: Related solutions**

- **Rural Financial Services Pack** — Lighter version with PAN Lite + Bank Verification add-ons [Explore →]
- **Migrant Remittance Hub Pack** — Optimized for urban migrant corridors [Explore →]
- **MFI Field Operations Pack** — For microfinance field collection [Explore →]

---

## 6. SEO strategy

### 6.1 Target keyword map (per page)

| Page | Primary keyword | Secondary keywords |
| --- | --- | --- |
| `/use-cases` | "fintech api use cases india" | "eko platform use cases", "msme api solutions india" |
| `/industries/lending-nbfc` | "lending api india", "nbfc api platform" | "kyc api for lending", "digital lending api india", "rbi digital lending api" |
| `/industries/microfinance` | "mfi api india", "microfinance digital collection api" | "aeps for mfi", "field collection api india" |
| `/industries/agent-networks-csp` | "csp api india", "bc agent api" | "white label aeps", "agent banking platform india" |
| `/industries/kirana-retail` | "kirana api india" | "retail banking api india", "digital kirana platform" |
| `/industries/marketplaces` | "marketplace seller verification api" | "vendor kyb api india", "ondc seller onboarding api" |
| `/industries/insurance` | "insurance kyc api india" | "motor insurance verification api", "irdai api" |
| `/solutions/lending-kyc-pack` | "lending kyc api bundle india" | "digital lending kyc package", "nbfc kyc api stack" |
| `/solutions/assisted-banking-agent-pack` | "aeps dmt bbps bundle" | "agent banking api bundle india", "white label bc api" |
| `/solutions/mfi-field-operations-pack` | "mfi field collection api" | "microfinance digital collection", "aeps for microfinance" |
| `/solutions/merchant-onboarding-pack` | "merchant onboarding api india" | "kyb api india", "payment aggregator merchant onboarding" |

### 6.2 Per-page SEO essentials

Every Industry and Pack page should ship with:

1. **Meta title** — `<Pack/Industry name> | Eko Platform Services` (≤60 chars). Examples:
   - `Lending & NBFC APIs | Eko Platform Services`
   - `Assisted Banking Agent Pack — AePS, DMT, BBPS | Eko`
2. **Meta description** — 150-160 chars, contains primary keyword + value prop + soft CTA. Example:
   - "RBI-compliant API stack for digital lenders in India. PAN, bank, DigiLocker, instant disbursal, BBPS collection. Sandbox in minutes."
3. **H1** — Matches the page H1 microcopy above. One H1 per page.
4. **Open Graph + Twitter cards** — Custom OG image per industry/pack with the pack name and APIs included
5. **Canonical tag** — Self-referencing
6. **Breadcrumb structured data** (JSON-LD)
7. **FAQ structured data** (JSON-LD) — The FAQ section on every page should emit `FAQPage` schema. This frequently triggers rich results in Google and is one of the highest-ROI SEO additions.
8. **Product/Service structured data** — Each Pack page can emit `Product` schema with `category`, `brand: Eko`, and `offers` (even without a price, this helps).
9. **Internal links** — Every Industry page links to 3+ Pack pages and 8+ Product pages. Every Pack page links to 3+ Industry pages and every API in the pack. This dense internal linking is essential.
10. **`hreflang`** if you eventually localize to Hindi (the existing site has a language switcher — plan for it)

### 6.3 Sitemap & robots

- Add all new URLs to `sitemap.xml` with `priority: 0.8` for Industry/Pack hubs, `0.7` for detail pages
- Confirm `robots.txt` allows `/industries/` and `/solutions/`
- Submit updated sitemap to Google Search Console after launch

### 6.4 Content depth target

- **Industry pages**: 1,200–1,800 words (the sample above is ~900 words; expand by adding more use cases and a longer "challenge" section)
- **Pack pages**: 1,000–1,500 words
- **Use Cases hub**: 600–900 words
- These lengths balance thin-content penalties against bounce-rate risk for B2B audiences

---

## 7. Cross-linking model

This is what makes the two-axis structure work for SEO:

```
Industry page  ──→  links to 1-3 Pack pages
                ──→  links to 8+ Product (API) pages
                ──→  links to 2-3 related Industry pages

Pack page      ──→  links to every API in the pack (Product pages)
                ──→  links to 3-5 Industry pages where this pack applies
                ──→  links to 2-3 related Pack pages

Product page   ──→  links to 2-3 Pack pages it belongs to (NEW)
                ──→  links to 2-4 Industry pages where it's used (NEW)

Homepage       ──→  Use Cases hub (existing nav)
                ──→  Top 3 Industries in the hero (NEW)
                ──→  Top 3 Solutions in the homepage section (UPDATED)

Footer         ──→  4-5 Industries + 4-5 Solutions on every page
```

The existing `/products/<api>` pages should be lightly updated with two new sections: **"Solutions that include this API"** and **"Industries that use this API"**. This is a low-effort, high-SEO-value change.

---

## 8. Content production checklist (per page)

For each Industry and Pack page, the writer/PM needs:

- [ ] H1, sub-headline, and trust strip text
- [ ] 3-paragraph "challenge" or "what this pack does" copy
- [ ] List of recommended Packs (for Industry pages) or APIs included (for Pack pages)
- [ ] 4-6 real-world use case vignettes (3 lines each)
- [ ] 4-6 differentiators
- [ ] 5-7 FAQs with answers
- [ ] One code snippet (Pack pages only)
- [ ] Meta title + meta description
- [ ] OG image (designer task)
- [ ] Internal link list (3 industries + 3 solutions + 6+ products to link to)
- [ ] Schema JSON-LD blocks generated

Estimate: a strong B2B copywriter can produce **2 industry pages or 3 pack pages per week** with this template. Full content production for all 17 industries + 26 packs = ~12-15 weeks of writing.

---

## 9. Phased rollout

### Phase 1 — Foundation (Week 1-2)
- Build the page templates (Industry detail, Pack detail, Use Cases hub)
- Add `/use-cases`, `/industries`, `/solutions` hub pages with placeholder grids
- Update top nav and footer with Solutions and Industries dropdowns
- Update `/products/<api>` pages with the two new cross-link sections
- Implement schema, sitemap, OG images

### Phase 2 — Tier-1 launch (Week 3-6)
**Top 5 industries** (highest propensity to pay): Lending & NBFC, Microfinance, Agent Networks (CSP/BC), Kirana & Retail, Marketplaces

**Top 6 packs** (highest demand): Lending KYC Pack, Assisted Banking Agent Pack, Merchant Onboarding Pack, MSME Credit Assessment Pack, MFI Field Operations Pack, Employee BGV Pack

This gives you 11 launch pages — enough to be substantively useful for SEO and sales without waiting for the full set.

### Phase 3 — Tier-2 expansion (Week 7-12)
**Next 6 industries**: Insurance, SaaS Platforms, Staffing & HR, Logistics & Fleet, E-commerce, Agriculture

**Next 8 packs**: Rural Financial Services Pack, DBT Cashout Pack, Migrant Remittance Hub Pack, Gig Worker Onboarding Pack, Fleet Compliance Pack, Vehicle Financing Pack, Motor Insurance Pack, Co-lending Compliance Pack

### Phase 4 — Tier-3 completion (Week 13-16)
Remaining 6 industries (Automotive, Travel, Education, Healthcare, Real Estate, Accounting & Tax) and remaining 12 packs.

### Phase 5 — Optimization (ongoing)
- Add customer logos and case studies (the strongest trust signal)
- A/B test hero CTAs (sandbox vs. talk to sales)
- Add a blog/resources hub (`/resources`) with industry guides — these become the top-of-funnel feeders for the Industry pages
- Localize top 5 Industry pages to Hindi (the language switcher is already in your nav)
- Add a comparison page (`/compare/eko-vs-alternatives`) — a controversial but very high-traffic SEO tactic

---

## 10. Quick decisions you need to make

1. **"Solutions" vs "Packs" as the menu label.** Recommendation: use "Solutions" in the URL (`/solutions/`) and top-nav, but use "Pack" as the on-page brand (e.g., "Lending KYC Pack"). Best of both worlds — SEO-friendly URL, distinctive product branding.
2. **Should the homepage Use Cases section be replaced or kept?** Recommendation: keep it as a teaser, but each card now links to its dedicated `/industries/<slug>` page instead of being a dead anchor.
3. **How prominent should pricing be?** The Pack pages benefit massively from at least signaling commercial model ("pay-per-use, sandbox free"). Recommendation: include the "Commercial model" section with no exact prices in Phase 1, then test exposing per-API rates in Phase 5.
4. **English-only at launch, or bilingual?** Recommendation: English-only at launch (Phase 2), translate top 5 Industry pages to Hindi in Phase 5.
5. **Who writes the content?** Realistic options: (a) in-house PM + product marketer using this plan as the brief, (b) hire a fintech-specialist B2B copywriter for 12 weeks. Either works — the templates above remove most of the heavy thinking.

---

## Appendix: Industry → Pack mapping (for cross-link wiring)

| Industry | Recommended Packs (in order) |
| --- | --- |
| Lending & NBFC | Lending KYC Pack, MSME Credit Assessment Pack, Co-lending Compliance Pack |
| Microfinance | MFI Field Operations Pack, Lending KYC Pack, Rural Financial Services Pack |
| Insurance | Motor Insurance Pack, Life/Health Insurance KYC Pack, AML/CFT Compliance Pack |
| E-commerce | Marketplace Seller Onboarding Pack, Merchant Onboarding Pack |
| Logistics & Fleet | Fleet Compliance Pack, Gig Worker Onboarding Pack, Vehicle Financing Pack |
| Healthcare | Employee BGV Pack, AML/CFT Compliance Pack |
| Education | Student Loan Verification Pack, Employee BGV Pack |
| Real Estate | Tenant/Property Verification Pack, AML/CFT Compliance Pack |
| Staffing & HR | Employee BGV Pack, Blue-collar Workforce Pack, Gig Worker Onboarding Pack |
| Travel | Merchant Onboarding Pack, AML/CFT Compliance Pack |
| Agriculture | Agriculture Financial Hub Pack, DBT Cashout Pack, Rural Financial Services Pack |
| Kirana & Retail | Assisted Banking Agent Pack, Migrant Remittance Hub Pack |
| Automotive | Vehicle Financing Pack, Motor Insurance Pack, Fleet Compliance Pack |
| Legal & Compliance | AML/CFT Compliance Pack, Director/Promoter Due Diligence Pack |
| Accounting & Tax | MSME Credit Assessment Pack, Merchant Onboarding Pack |
| SaaS Platforms | Neobank Onboarding Pack, Lending KYC Pack, Merchant Onboarding Pack |
| Marketplaces | Marketplace Seller Onboarding Pack, Vendor Verification Pack, Merchant Onboarding Pack |
| Agent Networks (CSP/BC) | Assisted Banking Agent Pack, Rural Financial Services Pack, Migrant Remittance Hub Pack |
