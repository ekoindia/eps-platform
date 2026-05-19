# Eko EPS Website — UI/UX Improvement Plan

> Plan generated 2026-05-16. Focus: Homepage + Hero and Product/API detail pages. Informed by Mobbin patterns (Stripe, Unsplash, ElevenLabs, Resend, GitBook, Supabase, Adaline, Assembly, Contra, Fey, Savee).

## Context

Eko Platform Services site (Vite + React + shadcn + Tailwind) sells API products (AEPS, lending, payments, BC, verification APIs) to Indian MSMEs and fintechs. Existing pages are visually polished but have several conversion, scannability, and developer-experience gaps. Header is mid-refactor (full-width dropdown w/ animation).

Two-part output: **Section A — Quick Wins list** (prioritized), **Section B — Deep-dive specs** on top 5.

---

## Section A — Quick Wins (prioritized by impact × ease)

Impact: H/M/L. Effort: S/M/L (hours/days).

### Homepage

| # | Item | Impact | Effort | File(s) |
|---|------|--------|--------|---------|
| H1 | Show code/terminal block on **mobile hero** (currently hidden `lg:block`) — collapse to swipeable card below CTAs | H | S | `HeroSection.tsx` |
| H2 | Differentiate **dual hero CTAs** semantically: primary "Get Sandbox Access" (gold filled) + secondary "Talk to Sales" (ghost). Drop one of the two outline variants. | H | S | `HeroSection.tsx` |
| H3 | Add **customer-logo strip** directly under hero (Stripe pattern). Source: Airtel, Fino, Razorpay logos already in compliance carousel — move/duplicate above the fold | H | S | `HeroSection.tsx`, `ComplianceSection.tsx` |
| H4 | Replace claim "50,000+ businesses" with **3 anchored stats** (Unsplash pattern): "X API calls/month • Y partners • Z transactions/day" — even rough numbers beat unsourced claim | H | M | `HeroSection.tsx` + new data const |
| H5 | Render the actually-empty `CaseStudiesSection` or **delete it** — empty section adds vertical scroll w/ zero value | H | S | `CaseStudiesSection.tsx`, `Index.tsx` |
| H6 | Collapse **redundant CTA sections** (`LeadCaptureSection` + `CTASection` are near-duplicate) into one consolidated final-CTA band | H | M | `Index.tsx`, `CTASection.tsx`, `LeadCaptureSection.tsx` |
| H7 | Products tabs: **show all categories at once** on desktop (3-up cards w/ category headers) so users can scan breadth without clicking. Tabs only on mobile. | M | M | `ProductsSection.tsx` |
| H8 | `WhyEkoSection` cards — bullet-list overflow inside small cards is cramped. Move long bullets into a **modal/expandable** or tighten to ≤3 bullets per card | M | S | `WhyEkoSection.tsx` |
| H9 | Add **search affordance** in header (cmd+K) — already have `cmdk` dep — search across APIs/industries/solutions | M | M | `Header.tsx` |
| H10 | `DeveloperSection` — name the 3 steps explicitly ("1. Get API key → 2. Call sandbox → 3. Go live"), drop generic "Code/Key/Zap" labels | M | S | `DeveloperSection.tsx` |
| H11 | `UseCasesSection` — every card should **link to its detail page** (currently text-only); add hover lift + arrow icon affordance | M | S | `UseCasesSection.tsx` |
| H12 | Partner logo carousel: add **role tags** ("Banking partner", "Payment rail", "ID verification") below logos — bare logos lack context | M | M | `ComplianceSection.tsx` |
| H13 | Header mobile drawer is 3-level nested accordion — flatten to **2 levels** or convert to grouped link list w/ horizontal scroll for sub-items | M | M | `Header.tsx` |
| H14 | Footer 8-col grid — uneven on tablet. Move to **4-col tablet / 2-col mobile** w/ explicit grouping; add newsletter signup | L | S | `Footer.tsx` |
| H15 | Hero scroll-indicator: replace mouse-icon (desktop bias) w/ subtle chevron + skip-link a11y | L | S | `HeroSection.tsx` |

### Product/API pages

| # | Item | Impact | Effort | File(s) |
|---|------|--------|--------|---------|
| P1 | **Re-enable sticky CTA bar** (currently commented out) — persistent "Get Sandbox Access" + "Docs" floating on scroll past hero | H | S | `ProductPageLayout.tsx` |
| P2 | `ApiInputOutputPreview` — add **language tabs** (cURL, Node.js, Python, Go) on top of JSON request panel (Resend/ElevenLabs pattern) | H | L | `ApiInputOutputPreview.tsx`, `CodeBlock.tsx`, data files |
| P3 | **Copy-to-clipboard** button on every code/JSON block w/ ✓ feedback (Mobbin: visible top-right in ElevenLabs, Glide) | H | S | `CodeBlock.tsx`, `ApiInputOutputPreview.tsx` |
| P4 | Render the existing `BreadcrumbNav` on every product page — currently defined but never instantiated | H | S | `ProductPageLayout.tsx` |
| P5 | Hero: drop **duplicate 99.9% Uptime badge** (appears in hero trust band AND `trustAndCompliance` section) | H | S | `ProductPageLayout.tsx` |
| P6 | Add **quick-reference table** mid-page: endpoint, method, rate limit, auth type, latency p95 — scannable spec block | H | M | `ProductPageLayout.tsx` + new component |
| P7 | Integration stepper on mobile shrinks to 10px circles — redesign as **vertical timeline** w/ readable numbers + descriptions | M | M | `ProductPageLayout.tsx` |
| P8 | FAQ `<details>` element — add **slide-down animation** + chevron rotation (use Radix Accordion already in deps) | M | S | `ProductPageLayout.tsx` |
| P9 | Add **"Try it free" or "Open in Sandbox" button** on `ApiInputOutputPreview` (even a docs link is fine — currently the section ends w/o action) | M | M | `ApiInputOutputPreview.tsx` |
| P10 | Solution Packs section at page bottom — add a **"Related APIs"** sibling block w/ 3 cards (cross-sell) | M | M | `ProductPageLayout.tsx` |
| P11 | Hero `ApiChip` row wraps awkwardly on mobile — convert to **horizontal scroll-snap** chip carousel | M | S | `ApiChip.tsx`, hero block in layout |
| P12 | Lead-form variant: when hero has image, lead form duplicates at bottom — **single canonical lead form** at consistent position | M | M | `ProductPageLayout.tsx` |
| P13 | Trust/compliance section — add **outbound verification links** to ISO/PCI/RBI certs (PDF/registry); badges alone read defensive | M | M | `ProductPageLayout.tsx`, data |
| P14 | `CodeBlock` lacks **line numbers + syntax theme toggle** (light/dark) — match GitBook polish | L | S | `CodeBlock.tsx` |
| P15 | Add **anchor links** beside H2 section headings (hover ⛓️) for shareable deep-links | L | S | `SectionContainer.tsx` |

---

## Section B — Deep-dive specs (top 5)

Prioritized: P1, P3, P2, H1+H4 combined, H6.

### B1. Sticky CTA bar (P1) — `ProductPageLayout.tsx`

**Problem:** users scroll past hero, want to convert but must scroll back. Mobbin Stripe/ElevenLabs/Resend all keep CTAs persistent.

**Design:**
- Appears after user scrolls past hero (`useScrollDirection` already exists at `src/hooks/use-scroll-direction.ts` — reuse)
- Bottom-fixed on mobile (full-width band, 56px tall, brand-navy bg w/ gold primary button)
- Top-floating on desktop (under header, slim 48px bar, blurred bg `bg-navy/80 backdrop-blur`)
- Contents: API name (left), "Docs ↗" outline (mid), "Get Sandbox Access" gold (right)
- Hide on scroll-down past 80% page-height (don't compete w/ footer CTA)
- a11y: `role="region"` + `aria-label="Quick actions"`, focusable, tab order after main content

**Implementation:** uncomment existing sticky-bar block, wire to `use-scroll-direction` hook, swap to Radix `Portal` for z-index stability.

### B2. Language tabs on API Input/Output Preview (P2) — `ApiInputOutputPreview.tsx`, `CodeBlock.tsx`

**Problem:** developers compare APIs across SDKs; JSON-only blocks force them to leave the page to find SDK syntax. Resend/ElevenLabs/Adaline all show Node/Python/cURL/Go side-by-side.

**Design:**
- Tab strip above request panel: `cURL` (default) • `Node.js` • `Python` • `Go` • `PHP`
- State persists via URL hash (`#lang=python`) for deep-linking and dev-blog sharing
- Each tab renders a templated snippet built from endpoint metadata in `api-product-pages.ts`:
  ```
  curl -X POST {endpoint} \
    -H "Authorization: Bearer $EKO_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{requestBody}'
  ```
- Templates centralized: new `src/lib/code-templates/{curl,node,python,go,php}.ts`
- Fallback: if no SDK exists yet for a lang, show "Coming soon — use cURL" hint
- Response panel unchanged (always JSON)

**Data model addition:**
```ts
// api-product-pages.ts entry
sample: {
  endpoint: "/v3/aeps/balance-enquiry",
  method: "POST",
  body: { /* JSON */ },
  response: { /* JSON */ }
}
```
Code templates auto-generated from this — no hand-written per-language strings.

### B3. Copy-to-clipboard everywhere (P3) — `CodeBlock.tsx`

**Problem:** developers can't copy snippets. High-friction.

**Design:**
- Add `<button>` top-right of `CodeBlock` (icon-only on hover, label "Copy" on focus)
- On click: `navigator.clipboard.writeText(...)`, icon swaps to ✓ for 1.5s, aria-live="polite" announces "Copied"
- Apply to: `CodeBlock`, `ApiInputOutputPreview` JSON panels (both request and response), hero code block in `HeroSection.tsx`
- Reuse existing `lucide-react` `Copy` and `Check` icons
- a11y: button has accessible name ("Copy code"), keyboard-reachable, focus-visible ring

**Implementation:** small custom hook `useCopyToClipboard` returning `{copied, copy}`. Single component change ripples everywhere.

### B4. Hero rebuild — code block + stats + dual CTA hierarchy (H1 + H2 + H4) — `HeroSection.tsx`

**Problem:** desktop hero has rich code preview; mobile shows nothing. CTAs visually identical. Trust claim unsourced.

**Design (mobile-first):**

```
┌─────────────────────────────┐
│ [API for India's MSMEs]     │  eyebrow
│                              │
│ APIs that scale              │  H1 — 5xl → 7xl
│ business everyday            │
│                              │
│ Sub-tagline 2 lines          │  body-lg
│                              │
│ [▶ Get Sandbox Access]       │  primary gold
│  View Documentation          │  ghost link
│                              │
│ ┌──── stats row ────┐        │
│ │ 50M+   │ 50+      │ 99.9%  │
│ │ txn/mo │ banks    │ uptime │
│ └────────┴──────────┴────────┘
│                              │
│ ┌── code preview ─────┐      │  newly visible on mobile
│ │ $ curl -X POST ...  │      │  swipeable cURL → Node tabs
│ └─────────────────────┘      │
│                              │
│ Trusted by ──                │
│ [Airtel] [Fino] [Razorpay]   │  logo strip
└─────────────────────────────┘
```

**Desktop:** 2-col split — left: eyebrow + H1 + sub + CTAs + stats; right: code preview card (tabbed cURL/Node). Logo strip full-width below.

**CTA hierarchy:**
- Primary: gold filled button "Get Sandbox Access" → opens Zoho chat (existing behavior)
- Secondary: text link w/ arrow "View Documentation →" → external
- Drop the third outline variant — one primary, one secondary, done

**Stats data:** add `src/lib/data/site-stats.ts` constant — easy to update centrally:
```ts
export const SITE_STATS = [
  { value: "50M+", label: "API calls/month" },
  { value: "50+",  label: "bank & NBFC partners" },
  { value: "99.9%", label: "uptime SLA" },
]
```

**Logo strip:** reuse data from `ComplianceSection` partner array — extract to `src/lib/data/partners.ts`, render 6 grayscale logos w/ hover-color.

### B5. Consolidate final CTA sections (H6) — `Index.tsx`, `CTASection.tsx`, `LeadCaptureSection.tsx`

**Problem:** `LeadCaptureSection` and `CTASection` sit back-to-back with near-identical purpose (book demo / talk to sales). Repetition dilutes urgency and lengthens the scroll w/o conversion lift.

**Design — single final-CTA band:**

```
┌─────────────────────────────────────────────┐
│                                              │
│   Ready to ship faster?                      │  H2
│   Sandbox in 5 min · Live in 5 days          │  sub
│                                              │
│ ┌───────────────┬──────────────────────────┐ │
│ │ Self-serve    │   Talk to sales          │ │
│ │ developers    │   Custom enterprise      │ │
│ │               │                          │ │
│ │ • Free        │ • Volume pricing         │ │
│ │   sandbox     │ • Dedicated TAM          │ │
│ │ • 50 free     │ • SLA contracts          │ │
│ │   calls/day   │ • RBI-licensed onboard   │ │
│ │ • Self-serve  │                          │ │
│ │   docs        │                          │ │
│ │               │                          │ │
│ │ [Sign up →]   │ [Chat] [Call] [Email]    │ │
│ └───────────────┴──────────────────────────┘ │
│                                              │
│   Available 9 AM – 7 PM IST · Mon–Fri        │  footnote
└─────────────────────────────────────────────┘
```

**Two clear paths** (developer self-serve vs enterprise sales) instead of one fuzzy combined CTA — solves the "which CTA do I take?" persona problem flagged in homepage audit.

**Implementation:** create `src/components/sections/FinalCtaSection.tsx`, remove `LeadCaptureSection` + `CTASection` from `Index.tsx`, keep individual components alive for product-page reuse (they're imported there too — verify before deletion).

---

## Critical files to modify

**Homepage:**
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/ProductsSection.tsx`
- `src/components/sections/WhyEkoSection.tsx`
- `src/components/sections/DeveloperSection.tsx`
- `src/components/sections/UseCasesSection.tsx`
- `src/components/sections/ComplianceSection.tsx`
- `src/components/sections/CaseStudiesSection.tsx` (decide: build or delete)
- `src/components/sections/LeadCaptureSection.tsx` + `CTASection.tsx` → consolidate into new `FinalCtaSection.tsx`
- `src/pages/Index.tsx`
- `src/components/Header.tsx`, `Footer.tsx`

**Product/API pages:**
- `src/components/ProductPageLayout.tsx`
- `src/components/ApiInputOutputPreview.tsx`
- `src/components/ApiChip.tsx`
- `src/components/CodeBlock.tsx`
- `src/components/BreadcrumbNav.tsx` (instantiate)
- `src/lib/data/api-product-pages.ts` (add `sample` field)

**New files:**
- `src/lib/data/site-stats.ts`
- `src/lib/data/partners.ts`
- `src/lib/code-templates/{curl,node,python,go,php}.ts`
- `src/hooks/use-copy-to-clipboard.ts`
- `src/components/QuickReferenceTable.tsx` (for P6)
- `src/components/sections/FinalCtaSection.tsx`

**Existing utilities to reuse (do not duplicate):**
- `src/hooks/use-scroll-direction.ts` — for sticky CTA bar
- `lucide-react` `Copy`, `Check` icons
- Radix Accordion (already in `@radix-ui/react-accordion`) — for FAQ animation
- `cmdk` (already a dep) — for header search

---

## Mobbin references (for visual matching)

- **Hero + code + stats:** Unsplash Developers `https://mobbin.com/screens/51fbfae8-e2c2-441a-af33-a777645bf43c`
- **Hero + logos under fold:** Stripe `https://mobbin.com/screens/8f976fd1-ad38-4978-824d-a22e0e0b2ee4`
- **Language tabs + copy button:** ElevenLabs `https://mobbin.com/screens/fff7b2c5-a015-4027-ab22-901ef51647f2`, Adaline `https://mobbin.com/screens/c3062a6a-f986-4b8f-bf59-979472c210ab`, Resend `https://mobbin.com/screens/ef0821a0-d518-4319-a215-7be2f320a3e5`
- **Quickstart card pattern:** ElevenLabs Overview
- **Testimonial / trust cards:** Contra `https://mobbin.com/screens/030281b9-475b-4cc8-9629-4b1bcca9c181`, Savee, Fey, Assembly
- **Customer-logo strip:** Stripe, Savee

---

## Verification plan

1. **Dev server:** `npm run dev` (or `bun dev`), open `http://localhost:5173`
2. **Manual flows to test after each change:**
   - Homepage: scroll top → bottom, click each CTA, switch tabs in Products section, open header dropdowns, resize 320px / 768px / 1280px
   - Product page (e.g. `/products/aeps-api`): hero CTA click → Zoho opens, scroll → sticky bar appears, language tab switch persists in URL, copy button feedback, breadcrumb renders, FAQ animates
3. **Lighthouse:** before/after on homepage and one product page — track LCP, CLS, accessibility score
4. **Mobile-only checks** (Chrome DevTools → iPhone 13): hero code block visibility, dual-CTA stacking, stats wrap, integration stepper readability
5. **a11y sweep:** keyboard-only nav of homepage + product page; verify copy-button label, sticky-CTA tab order, breadcrumb landmark
6. **Linting/types:** `npm run lint`, `tsc --noEmit` clean
7. **Build:** `npm run build` succeeds, SSG output renders code blocks (no client-only rendering breakage)

---

## Suggested rollout order

1. **Phase 1 (quick polish, 1-2 days):** P3 (copy-to-clipboard), P4 (breadcrumb), P5 (dedupe badge), H5 (empty section), H15 — pure cleanup, low risk
2. **Phase 2 (hero rebuild, 2-3 days):** B4 (H1+H2+H4 combined), H3 (logo strip)
3. **Phase 3 (developer experience, 3-5 days):** B1 (sticky CTA), B2 (lang tabs), P6 (quick-ref table), P7 (mobile stepper)
4. **Phase 4 (conversion consolidation, 2-3 days):** B5 (final CTA), H7 (products tabs rework), H10 (developer steps), H11 (use-case links)
5. **Phase 5 (polish, 1-2 days):** remaining M/L items as time allows
