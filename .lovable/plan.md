

# Implementation Plan: Founder Feedback - Phase 1

Based on the corrected interpretation, here are the changes grouped by file.

---

## 1. Hero Section (`HeroSection.tsx`)

- **Tag (h1)**: Change to `"APIs & Platform for MSMEs to scale their business everyday"`
- **Sub-tag (p)**: Change to `"BC, Identity, Payment & Collection solutions & APIs for MSMEs to scale their business across Tier 2 and beyond"`
- **Trust badge**: Remove "ISO 27001" badge (keep RBI Compliant and 99.9% Uptime)
- **"Talk to Sales" button**: Change to open Zoho chat or call (matching the CTA consolidation pattern)

## 2. Why Choose Eko Section (`WhyEkoSection.tsx`)

- Change `"Since 2008"` to `"Since 2007"`
- Change section title to align with mission: `"Built for Developers from Bharat"`
- Update subtitle to include mantra: `"Grow Every Entrepreneur Daily"`
- Change `"Enterprise APIs" / "Built for banks, fintechs, and large enterprises"` to mention working with multiple banks, AAs & PAs, bringing services to Tier 2 and beyond, and list partner brands (FINO, Airtel Payments Bank, etc.)
- Add card for `"Dedicated Relationship Managers and Customer Support Representatives"`

## 3. Products Section (`ProductsSection.tsx`)

- Change heading from `"Complete Financial Infrastructure"` to `"APIs to Build Your Own Fintech Business"`
- Reorganize tabs from 3 (Payments / Verification / Shield) to 4: **BC APIs** (DMT, AePS), **Payment APIs** (Payment Gateway, QR Payment, UPI Payout), **Collection APIs** (BBPS, CMS), **Verification APIs** (all verification products)
- Keep Eko Shield as a separate tab or featured banner
- Change "Request Access" buttons to open Zoho SalesIQ chat instead of form

## 4. Header Nav (`Header.tsx`)

- Reorganize Products dropdown from 2 columns (Payment APIs / Verification APIs) to 4 columns: **BC APIs**, **Payment APIs**, **Collection APIs**, **Verification APIs**
- Merge "Blog" and "Press" into single "Blogs & Media" link in company dropdown
- Mobile menu: same reorganization

## 5. Compliance Section (`ComplianceSection.tsx`)

- Remove ISO 27001, PCI DSS, SOC 2 cards
- Replace with: **RBI Compliant**, **KYC Compliant**, **AML/CFT Compliant** (3 cards instead of 4)

## 6. Use Cases Section (`UseCasesSection.tsx`)

- Reframe from enterprise/bank focus to MSME/Bharat focus
- Mention typical business size, geography (Tier 2+)
- Replace "Banks & NBFCs" and "Enterprises" with MSME-relevant segments (Kirana/Retail stores, CSP/BC agents, small NBFCs/MFIs, travel agents, distributors, etc.)

## 7. Lead Capture Section (`LeadCaptureSection.tsx`)

- Change "Custom pricing for enterprise needs" to "Custom pricing basis needs of MSMEs"
- Replace Zoho form iframe with Chat + Call CTA buttons

## 8. CTA Section (`CTASection.tsx`)

- "Get Started" button: open Zoho SalesIQ chat
- "Talk to Sales" button: change to direct call (`tel:+919311019477`)

## 9. Footer (`Footer.tsx`)

- Merge Blog + Press into "Blogs & Media" link
- Update Products section to match new 4-category structure (BC APIs, Payment APIs, Collection APIs, Verification APIs)

## 10. Blog & Press Merge

- Create a combined "Blogs & Media" page or rename the existing routes
- Update `App.tsx` routing accordingly

---

## Files Modified

1. `src/components/sections/HeroSection.tsx` - copy + badge changes
2. `src/components/sections/WhyEkoSection.tsx` - mission-aligned rewrite
3. `src/components/sections/ProductsSection.tsx` - 4-tab reorganization + heading
4. `src/components/Header.tsx` - dropdown restructure, Blog+Press merge
5. `src/components/sections/ComplianceSection.tsx` - remove unverified certs, add KYC/AML
6. `src/components/sections/UseCasesSection.tsx` - MSME/Bharat reframe
7. `src/components/sections/LeadCaptureSection.tsx` - replace form with chat/call
8. `src/components/sections/CTASection.tsx` - CTA to chat/call
9. `src/components/Footer.tsx` - product categories + blog/press merge
10. `src/pages/BlogPage.tsx` - merge press content into this page (rename to "Blogs & Media")
11. `src/App.tsx` - update routes (redirect /press to /blog or combined page)

