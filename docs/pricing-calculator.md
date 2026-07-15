# Pricing Calculator (`/pricing`)

One page, three client-side tabs:

1. **Verification APIs** — interactive COST calculator + crawlable rate card
   (you pay per call).
2. **Payments & BC APIs** — interactive EARNINGS calculator + commission rate
   card for DMT, AePS and BBPS (these products pay the partner a commission
   per transaction — inverted semantics vs. verification).
3. **Connected Banking** — COST calculator (one-time setup per bank per user
   + per-transaction charges).

DigiKhata is intentionally out of scope.

## Architecture

```
src/lib/data/api-pricing.ts                ← verification config + pure quote math (no React)
src/lib/data/payments-pricing.ts           ← DMT/AePS/BBPS commission config + earnings math (no React)
src/lib/data/connected-banking-pricing.ts  ← Connected Banking config + cost math (no React)
src/lib/data/bbps-operators.ts             ← full BBPS operator list (Excel-ONLY — never imported client-side)
src/pages/PricingPage.tsx                  ← page assembly, SEO, tabs, combined FAQ
src/components/pricing/
  PricingTabs.tsx                          ← tab shell: ?tab= sync, forceMount panels
  PricingCalculator.tsx                    ← verification orchestrator: state + URL sync
  ApiPicker.tsx                            ← searchable grouped multi-select
  SelectedApiRow.tsx                       ← volume slider + numeric input per API
  QuoteSummary.tsx                         ← live cost estimate (desktop sidebar + mobile drawer)
  MobileSummaryBar.tsx                     ← MobileEstimateBar (generic sticky bottom bar) + cost wrapper
  PricingTable.tsx                         ← static SSG-rendered verification rate card (SEO)
  payments/
    PaymentsCalculator.tsx                 ← earnings orchestrator: state + ?pay= URL sync
    PaymentsPicker.tsx                     ← grouped multi-select (DMT / AePS / BBPS)
    EarningsProductRow.tsx                 ← txn-count slider + avg-amount input per product
    EarningsSummary.tsx                    ← live earnings estimate (gross + after-TDS)
    PaymentsRateTable.tsx                  ← static commission tables (DMT slabs, AePS, BBPS categories)
  banking/
    ConnectedBankingCalculator.tsx         ← inputs + setup/monthly blocks + ?cb= URL sync + static rate card
src/lib/utils/json-ld.ts                   ← generatePricingJsonLd() (OfferCatalogs + FAQPage)
```

## Tab architecture (SEO-safe)

`PricingTabs.tsx` wraps shadcn/Radix Tabs with **`forceMount` +
`data-[state=inactive]:hidden`** on every `TabsContent`:

- All three panels stay in the prerendered HTML → every product's rates are
  crawlable from the single `/pricing` URL.
- Calculator state survives tab switches for free (nothing unmounts).
- `display:none` also hides each inactive tab's `position:fixed` mobile
  summary bar, so only the active tab's bar is ever visible.
- The tab bar is `sticky top-0 z-40` — the fixed site header (z-50)
  auto-hides on scroll-down, so the tab bar surfaces at the top while reading.

Active tab mirrors to `?tab=` (`payments` / `banking`; **`verification` is
the canonical default and never written**). Deep links with `?tab=` produce
the same accepted recoverable hydration mismatch as `?sel=` (see
docs/ssg-hydration.md); the param-less URL stays mismatch-free.

## Pricing config

### Verification (`src/lib/data/api-pricing.ts`)

Each sellable API is a `PricedApi`:

| Field | Meaning |
|---|---|
| `id` | URL-stable id used in query params (e.g. `pan-lite`). Never rename once shipped — breaks shared links. |
| `name` | Display name |
| `productId` | Optional — maps to `ApiProductRef.id` in `api-products.ts`. One product → many priced APIs (`pan` → PAN Lite / Bulk / Status / Comprehensive). Omit when no product page exists (e.g. `ckyc-download`). |
| `group` | Section heading; ordered by `PRICING_GROUP_ORDER` |
| `tiers` | Volume slabs, ascending; last has `upTo: null`. Flat rate = single entry. |
| `tierMode` | `"volume"` (default — matched slab rate applies to all units) or `"graduated"` (each slab priced separately) |
| `unitLabel` | e.g. `"per lookup"`; defaults to `"per verification"` |
| `popular` | Shows the Popular badge + quick-add chip eligibility |
| `setupFee` | One-time activation fee (INR, excl. GST). Omit when none. |
| `isBulk` | Bulk APIs (billed per individual verification inside the bulk request) — renders an asterisk + footnote; list bulk APIs **after** non-bulk APIs within their group |

All rates: **INR per transaction, exclusive of GST @ 18%** (`GST_RATE`).
Money math runs in integer paise to avoid float drift (`calcQuote`, `calcLineCost`).

### Payments & BC (`src/lib/data/payments-pricing.ts`)

Commission products keyed on **transaction amount** (not monthly volume):

- `DMT_SLABS` — 17 contiguous `DmtSlab` rows (`from`/`upTo`/`ekoPricing`/
  `commission`). The ascending `from` column doubles as the Excel VLOOKUP key.
  Constants: `DMT_SENDER_KYC_FEE` (₹11), `DMT_CUSTOMER_FEE_PCT` (1%, min
  `DMT_CUSTOMER_FEE_MIN` ₹10 — paid by the sender), `DMT_MAX_TXN_AMOUNT` (₹5,000).
- `AEPS_CASHOUT_SLABS` (0.40% ≤ ₹3,000; ₹13 flat ₹3,001–₹10,000),
  `AEPS_MINI_STATEMENT_COMMISSION` (₹0.75), `AEPS_SETTLEMENT_CHARGES`
  (₹5/₹10 + GST — informational cost, never netted into earnings).
- `BBPS_CATEGORIES` — ~14 `BbpsCategory` entries with `AmountSlab[]`. Where
  operator rates vary (prepaid, DTH, municipal, FASTag general), the
  **lowest** rate is used (conservative estimate) and `rangeNote` carries the
  spread. The full operator table lives only in the Excel workbook.
- `EARNINGS_PRODUCTS` / `EARNINGS_GROUPS` — the unified product list the
  calculator iterates (`dmt`, `aeps-cashout`, `aeps-mini`, `bbps-*`).
  `needsAmount: false` only for `aeps-mini`.
- Math: `commissionPerTxn(productId, avgAmount)`, `calcEarningsQuote(sel)` →
  `{ lines, total, totalAfterTds, totalTxns }`. `TDS_RATE` (2%) is applied as
  an indicative payout line — the headline stays GROSS (excl. GST).
- Estimates use the **average** txn amount; real earnings depend on the
  amount distribution — disclaimer copy lives in the summary, Excel and
  /pricing.md.

### Connected Banking (`src/lib/data/connected-banking-pricing.ts`)

`CB_SETUP_FEE` (₹75,000 + GST per bank per user), `CB_BANKS` (HDFC, IDFC
FIRST, RBL, SLICE), `CB_TXN_SLABS` (₹8 up to ₹25,000; ₹15 up to ₹50,000).
`calcCbQuote({ bankUsers, monthlyTxns, avgAmount })` returns separate
**one-time** (`setupFee`/`setupGst`/`setupTotal`) and **monthly**
(`perTxn`/`monthlySubtotal`/`monthlyGst`/`monthlyTotal`) blocks.

### BBPS operators (`src/lib/data/bbps-operators.ts`)

~135 `BbpsOperator` rows (`operator`, `category`, `commAbove5k`,
`commUpTo5k`, `type: "fixed" | "pct"`; pct values are percent numbers, e.g.
`2.56` = 2.56%). **Excel-only payload** — loaded via `ssrLoadModule` by
`vite-plugin-generate-xlsx.ts`, never imported by client code. To update the
operator list, edit this file; the workbook regenerates on the next build.

### Setup fees & limited-time waiver (verification)

- `SETUP_FEE_WAIVED = true` waives all one-time fees site-wide and shows the
  "₹0 setup fee — limited-time offer" marketing (hero chip, summary badge,
  FAQ). **To end the offer, flip it to `false`** — configured fees become
  payable and the offer copy disappears automatically.
- Per-API fee: set `setupFee` on the `PricedApi`.
- Discounted bundles: add to `SETUP_FEE_PACKS` (`{ id, name, apiIds, fee }`).
  A pack applies when ALL its `apiIds` are selected and its `fee` beats the
  sum of those APIs' individual fees (greedy, declared order, each API
  counted once) — see `calcSetupFee`.
- The setup fee is always a **separate one-time line** in the summary, never
  added into the monthly total.

### Volume-discount visibility

`HAS_VOLUME_DISCOUNTS` is **derived** — true only when some API has more than
one tier. All "volume discount" UI (hero chip, FAQ entry, rate-card footnote,
summary microcopy, per-line "volume discount" hint) appears automatically when
multi-tier rates are added and is hidden while all rates are flat. No separate
flag to keep in sync.

### Self-serve funnel

No "Talk to Sales" buttons in the calculators — the only CTAs are
"Get Started" (Zoho chat), "Copy estimate link" and the Excel download.

### How to update rates

1. Verification: edit `tiers` in `PRICED_APIS`. Payments: edit `DMT_SLABS`,
   `AEPS_*`, `BBPS_CATEGORIES` (and `bbps-operators.ts` for the Excel list).
   Connected Banking: edit `CB_*` constants.
2. No other file changes needed — calculators, rate cards, JSON-LD,
   `/pricing.md` and the Excel workbook all derive from these configs.

## Product-page integration

`ProductPageLayout` shows a hero "View Pricing" CTA (deep link
`/pricing?apis={productId}`) and a "Starts at ₹X per verification" line when
`getPricedApisForProduct(productId)` is non-empty. Products without priced
APIs (e.g. `ip`) automatically show neither.

## URL param scheme

| Param | Owner | Example | Meaning |
|---|---|---|---|
| `tab` | PricingTabs | `tab=payments` | Active tab (`payments` / `banking`). Absent = verification (never written). |
| `sel` | PricingCalculator | `sel=pan-lite:50000,bank-pennydrop:10000` | Verification state — `apiId:volume` pairs. |
| `apis` | PricingCalculator | `apis=pan` | Deep-link entry. Accepts priced-API ids OR product ids (expands at `DEFAULT_VOLUME`). Normalised into `sel` after load. |
| `gst` | PricingCalculator | `gst=1` | Verification headline total includes GST |
| `pay` | PaymentsCalculator | `pay=dmt:5000:2500,bbps-electricity:1000:1500` | Earnings state — `productId:monthlyTxns:avgAmount` (avgAmount omitted for `aeps-mini`). |
| `cb` | ConnectedBankingCalculator | `cb=2:5000:10000` | `bankUsers:monthlyTxns:avgAmount`. Written only after the user touches an input. |

Every writer uses the **functional `setSearchParams` updater** (debounced
300 ms, `replace: true`, `preventScrollReset: true`) and deletes/sets **only
its own keys** — UTM/tracking params and the other calculators' state always
survive. Unknown ids are dropped, duplicates deduped, values clamped.
Garbage params never crash the page.

## Cross-component handoff

- Verification rate card "+": dispatches `pricing:add-api`
  (`detail.apiId`), scrolls to `#calculator`; `PricingCalculator` listens.
- Payments rate card "+": dispatches `pricing:add-earnings-product`
  (`detail.productId`), scrolls to `#payments-calculator`;
  `PaymentsCalculator` listens.

## Lead attribution (Google Ads / UTM / calculator interest)

Implemented in `src/hooks/use-tracking-params.ts`:

- **Capture matcher** `isTrackingParam`: prefixes `utm_*`, `gad_*`, `gcl_*` +
  exact keys (`gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`,
  `twclid`, `li_fat_id`, `campaign_name`, `adgroup`, `matchtype`, `network`,
  `keyword`). Captured to sessionStorage, first-touch (stored values win).
- **URL re-append**: `useCaptureTrackingParams` (App root) re-appends stored
  tracking params to the URL after every internal navigation (replace, no
  history spam) — Zoho SalesIQ records page URLs, so attribution survives
  any link click. Works for plain `Link`s; no per-link wrapper needed.
- **Calculators never wipe foreign params**: each URL write-back only
  rewrites its own keys (see table above).
- **Calculator context**: verification selection is mirrored to
  sessionStorage (`saveCalculatorContext`) so leads capture API interest
  after the user leaves /pricing. (Payments/CB interest is NOT yet carried
  into lead context — known follow-up.)
- **Zoho form**: `buildLeadWebsiteUrl()` builds the CRM `Website` field
  (max 450 chars). Priority: origin+path → tracking params → calculator
  selection; degrades full `sel` → `apis=` ids only → no calculator;
  tracking params are never dropped.
- **SalesIQ chat**: `openZohoChat` pushes `visitor.info` with tracking
  params + `apis_interested` before opening (best-effort). For a logged-in
  user it also pushes `visitor.name/email/contactnumber` so the operator sees
  a named visitor: `AuthProvider` keeps the identity in a module store via
  `setChatIdentity(chatIdentity(state))`, and `openZohoChat` applies it at
  open time (the widget lazy-loads, so it rarely exists when `/me` resolves).
  Logging out clears it. Requires `VITE_SHOW_USER_LOGIN=true` to be reachable.

## JSON-LD

`generatePricingJsonLd(faqs)` emits:

- Verification `OfferCatalog` (`#offers`) — one Offer per priced API.
- Connected Banking `OfferCatalog` (`#banking-offers`) — setup-fee Offer
  ("one-time, per bank per user") + per-txn-slab Offers.
- **No Offers for DMT/AePS/BBPS commissions** — they are income to the buyer,
  so Offer semantics would be wrong/misleading for rich results. They are
  covered by the FAQPage entries instead.
- FAQPage — grows automatically: the page passes
  `[...PRICING_FAQS, ...PAYMENTS_FAQS, ...CB_FAQS]` (the same combined array
  rendered in the visible FAQ section, keeping HTML and schema consistent).

## Markdown version (`/pricing.md`)

`src/lib/markdown/render-pricing.ts` generates an AI-agent-friendly Markdown
document from the same data modules (see docs/markdown-generation.md): the
verification rate card, the DMT slab table, AePS commissions + settlement
charges, the BBPS category table (with a pointer to the Excel operator list)
and the Connected Banking section, plus the combined FAQ set. Rate edits flow
into `/pricing.md` automatically.

## Offline Excel calculator (`/eps-pricing-calculator.xlsx`)

A downloadable companion workbook generated at build time from the same data
modules. **Seven sheets, in tab order:**

| Sheet | Purpose |
|---|---|
| `Index` | First tab: what's inside + internal hyperlinks (`{ text, hyperlink: "#'Sheet Name'!A1" }`) to every sheet |
| `Verification Calculator` | Monthly COST estimate — usage inputs, line/subtotal/GST formulas |
| `Payments Earnings` | Monthly EARNINGS estimate — avg-amount + txn inputs; gross / TDS / net payout summary |
| `Connected Banking` | Setup (₹75,000 × banks + GST) and monthly (per-txn slab IF + GST) blocks |
| `Verification Rate Card` | Static verification reference |
| `Payments Rate Card` | Static DMT slab table (the VLOOKUP source), AePS, BBPS categories |
| `BBPS Operator Rates` | Full operator list, frozen header + auto-filter |

- **Renderer**: `ssg/render-pricing-xlsx.ts` — pure `renderPricingXlsx(data)`
  → `Buffer` (unit-tested in `src/test/render-pricing-xlsx.test.ts`). It
  orchestrates per-sheet builders in `ssg/xlsx/` (`shared.ts` holds brand
  styling, the `PricingXlsxData` contract and the `SHEETS` name constants).
  Worksheets are created up-front so **tab order is independent of build
  order** — the Payments Rate Card is BUILT before the earnings sheet to hand
  over its DMT VLOOKUP range (`buildPaymentsRateCardSheet` returns
  `dmtLookupRange`), but appears later in the tabs.
- **DMT formula**: `IF(C="","",VLOOKUP(C, 'Payments Rate Card'!$A$x:$D$y, 4,
  TRUE))` — approximate match over the ascending `From (₹)` column; input
  validation (₹100–₹5,000) keeps the lookup in range. AePS/BBPS slab products
  use nested `IF`s generated from their `AmountSlab[]`.
- **Plugin**: `vite-plugin-generate-xlsx.ts` (registered in `vite.config.ts`)
  mirrors the markdown plugin — `closeBundle` writes
  `dist/eps-pricing-calculator.xlsx`; dev middleware serves the route on the
  fly during `npm run dev`. All five data modules are loaded via
  `ssrLoadModule`, so the `exceljs` devDependency never reaches the client
  bundle (exceljs is CJS-only — the renderer loads it via `createRequire`
  because named ESM imports of CJS fail inside the node-ESM Vite config
  bundle).
- **Protection**: every sheet is protected **without a password** — only the
  light-gold input cells are editable. The goal is preventing accidental
  edits, not access control; "Unprotect Sheet" works without a prompt.
- **Entry points**: "Download Excel calculator" links in `QuoteSummary.tsx`
  and `EarningsSummary.tsx`, plus the operator-list pointer in
  `PaymentsRateTable.tsx`.

## Route registration (3 places)

`src/App.tsx` (lazy), `src/AppServer.tsx` (eager — `React.lazy` unsupported in
`renderToString`), `ssg/routes.ts` (`ROUTE_CHUNK_MAP` + `PRERENDER_ROUTES`,
which also feeds sitemap.xml). The tabs are client-side only — no new routes.
