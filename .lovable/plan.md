

## Plan: Comprehensive Eko Platform Services Update

This is a large multi-part update covering branding, SEO, navigation, compliance, footer, form, and UX fixes. Here's the implementation plan broken into tasks:

---

### 1. Copy Logo Asset & Update Branding

- Copy `user-uploads://EKO_Platform_Services.svg` to `src/assets/eko-platform-services.svg`
- Update `EkoLogo.tsx` to use the new logo as the default
- Replace the plain "eko" text in the Footer with the logo component

### 2. Update Hero Section Headline

In `HeroSection.tsx`:
- Change headline from "Powering India's Financial Infrastructure" to **"APIs & Platforms Powering India's Financial Infrastructure"**
- The sub-heading already matches the requested text ("APIs and platforms for Payments, Identity, and Verification...")

### 3. Update SEO Title & Meta Description

In `index.html`:
- Title: **"Fintech APIs & Platforms for KYC, Verification & Transactions in India | Eko Platform Services"**
- Meta description: **"Compliant fintech APIs built for India. Power KYC, verification, payouts, and financial workflows for NBFCs, fintech startups, and developers."**
- Update OG and Twitter meta tags to match

### 4. Navigation & Header Fixes

In `Header.tsx`:
- Add `cursor-pointer` to all nav link buttons/anchors
- Add `bg-white/95 backdrop-blur-md` to mobile menu container (fix transparent background on mobile)
- Add **Company submenu** with: About Us (`/about-us`), Blog (`#`), Press (`#`) — similar dropdown pattern to Products
- **Remove "Ekonic Platform →"** link from the Products dropdown bottom section
- Add state management for Company dropdown (desktop + mobile)

### 5. Compliance Section Updates

In `ComplianceSection.tsx`:
- Change "RBI Authorized" to **"RBI Compliant"**
- Update description to include bullet points: ISO 27001 / PCI DSS / SOC2, Data residency: India, Audit & reporting details

### 6. Footer Updates

In `Footer.tsx`:
- Change company name from "Eko India Financial Services Pvt. Ltd." to **"Eko Bharat Ventures Private Limited"**
- Replace plain "eko" text with `<EkoLogo>` component (with `isLight` prop)
- Update email/phone to be clickable (`mailto:` and `tel:` links)
- Wrap location in a Google Maps link
- Move social links below the contact info section
- Remove "Ekonic Platform" from footer product links

### 7. Lead Capture Form Updates

In `LeadCaptureSection.tsx`:
- Change form heading from "Request a Demo" to **"Get Started with Eko Platform Services"**

Also update the Get Started dialog in `Header.tsx`:
- Change dialog title to **"Get Started with Eko Platform Services"**

### 8. Products Section Cleanup

In `ProductsSection.tsx`:
- Remove the "Ekonic Platform" tab from `productTabs` array
- Remove the entire `activeTab === "ekonic"` content block
- Update the `ProductTab` type to remove `"ekonic"`

### 9. UX Polish

- Ensure all interactive elements have `cursor-pointer`
- Verify mobile menu has solid background (not transparent)
- Consistency check on button styles (already using design system)

---

### Technical Details

**Files to modify:**
1. `index.html` — SEO meta tags
2. `src/components/EkoLogo.tsx` — new logo import
3. `src/components/sections/HeroSection.tsx` — headline change
4. `src/components/Header.tsx` — nav fixes, Company submenu, remove Ekonic, mobile bg fix, cursor fix, dialog title
5. `src/components/sections/ComplianceSection.tsx` — RBI text + details
6. `src/components/Footer.tsx` — company name, logo, clickable contacts, social links position, remove Ekonic
7. `src/components/sections/LeadCaptureSection.tsx` — form heading
8. `src/components/sections/ProductsSection.tsx` — remove Ekonic tab
9. `src/components/sections/CTASection.tsx` — no changes needed

**New file:**
- `src/assets/eko-platform-services.svg` (copied from upload)

