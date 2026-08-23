# Pricing Calculator (`/pricing`)

One page, four client-side tabs:

1. **Verification APIs** — interactive COST calculator + crawlable rate card
   (you pay per call).
2. **Money Transfer (DMT)** — per-transaction LEDGER calculator + RCM
   explainer + crawlable rate card. DMT does not fit the slab-commission
   model: the customer fee is GST-*inclusive*, GST is carved back *out* of
   it, Eko's flat ₹2.80 comes off the taxable value, then TDS.
3. **AePS & BBPS** — interactive EARNINGS calculator + commission rate card
   (these products pay the partner a commission per transaction — inverted
   semantics vs. verification).
4. **Connected Banking** — COST calculator (one-time setup per bank per user
   + per-transaction charges).

DigiKhata is intentionally out of scope.

## Architecture

```
src/lib/data/api-pricing.ts                ← verification config + pure quote math (no React)
src/lib/data/payments-pricing.ts           ← AePS/BBPS commission config + earnings math (no React)
src/lib/data/dmt-pricing.ts                ← DMT ledger config + per-txn/monthly math (no React)
src/lib/data/product-earnings.ts           ← getEarningsHighlight() — spans both, so it lives in neither
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
    PaymentsPicker.tsx                     ← grouped multi-select (AePS / BBPS)
    EarningsProductRow.tsx                 ← txn-count slider + avg-amount input per product
    EarningsSummary.tsx                    ← live earnings estimate (gross + after-TDS)
    PaymentsRateTable.tsx                  ← static commission tables (AePS, BBPS categories)
  dmt/
    DmtCalculator.tsx                      ← DMT ledger orchestrator: state + ?dmt= URL sync
    RcmExplainer.tsx                       ← forward-charge vs reverse-charge comparison (live figures)
    DmtRateTable.tsx                       ← static DMT rate card, DERIVED from calcDmtTxn (SEO)
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

### Setup fees & the discount campaign

**The fees**

- Verification: `VERIFICATION_SETUP_FEE` (₹6,000, excl. GST) applies **per
  priced API**. A `PricedApi` that omits `setupFee` inherits it; set
  `setupFee: 0` to exempt one deliberately (`setupFeeFor` resolves this, and
  a test asserts no API gets exempted by accident).
- BC/Payments: `BC_SETUP_FEE` (₹20,000, excl. GST) in `payments-pricing.ts`,
  charged **once per API family** — DMT, AePS and BBPS are one API each, so
  enabling six BBPS bill categories still carries a single BBPS fee. See
  `calcPaymentsSetupFee`.
- Connected Banking's `CB_SETUP_FEE` is separate and **never discounted**.
- Discounted bundles: add to `SETUP_FEE_PACKS` (`{ id, name, apiIds, fee }`).
  A pack applies when ALL its `apiIds` are selected and its `fee` beats the
  sum of those APIs' individual fees (greedy, declared order, each API
  counted once) — see `calcSetupFee`. Not modelled in the Excel workbook.

**The discount** — `SETUP_FEE_DISCOUNT_PERCENT` (currently `50`) in
`api-pricing.ts` is the **single source of truth for every setup-fee claim on
the site**. It has three states, and all copy follows automatically:

| Value | Copy | Payable |
| ----- | ---- | ------- |
| `100` | "No setup fee." / "₹0 setup fee — limited-time offer" | ₹0 |
| `1`–`99` | "50% off setup fee." / "50% off setup fee — limited-time offer" | fee × (1 − pct) |
| `0` | no offer copy at all | full fee |

Change the number and nothing else. It drives the pricing hero chip and
subtitle, both calculator summaries, the pricing and payments FAQs, the 12
solution `pricingBlurb`s, the industries platform-fee FAQ, `/pricing.md`,
`/products.md` and both Excel calculator sheets.

- Builders live in `api-pricing.ts`: `setupFeeClause` (blurb sentence),
  `setupFeeOfferLabel` (chip/badge), `setupFeeFaqAnswer`, and
  `applySetupFeeDiscount` (paise-exact). Each **clamps its own input** via
  `clampDiscountPercent`, so no caller can emit "0% off" or "33.4% off".
- Both builders return `""` at 0, and data files compose with `sentences(...)`
  so a dropped clause leaves no double space.
- A "full waiver against a higher monthly volume commitment" is a **standing
  commercial term**, not campaign copy — it stays in the FAQ answers at 0%.

**Activation semantics** — an API attracts its setup fee only once it has
**non-zero volume** (`calcQuote` filters before calling `calcSetupFee`;
`calcEarningsQuote` filters on `monthlyTxns`). The Excel formulas gate on the
same condition, so a row parked at zero costs nothing in either place.

- The setup fee is always a **separate one-time line** (`SetupFeeLine`, shared
  by both summaries), never added into the monthly total or netted off
  commission. It carries its own GST (`SetupFeeQuote.gst` / `.total`) and
  respects the summary's incl./excl.-GST toggle.

### Volume-discount visibility

`HAS_VOLUME_DISCOUNTS` is **derived** — true only when some API has more than
one tier. All "volume discount" UI (hero chip, FAQ entry, rate-card footnote,
summary microcopy, per-line "volume discount" hint) appears automatically when
multi-tier rates are added and is hidden while all rates are flat. No separate
flag to keep in sync.

### Self-serve funnel

No "Talk to Sales" buttons in the calculators — the only CTAs are
"Get Started", "Copy estimate link" and the Excel download.

"Get Started" is `GetStartedButton` (`src/components/GetStartedButton.tsx`),
the shared primary CTA also used by the header and the Products mega-menu.
Where it goes depends on `VITE_SHOW_USER_LOGIN`:

- **off** (prod default) — opens the Zoho chat, as before.
- **on** — links to `/console`, so a returning developer logs in and a new one
  starts onboarding. Those clicks then create no Zoho lead and push no
  `apis_interested` context; self-serve console signup replaces that path.
  Carrying calculator context into the console onboarding record is a known
  follow-up.

### DMT (`src/lib/data/dmt-pricing.ts`)

DMT is a closed-form **ledger**, not a slab table:

```
fee = max(₹10, 1% × amount)          ← GST-INCLUSIVE; nothing is added on top
taxable = round(fee ÷ 1.18)          ← round HERE, before the next step
gross   = taxable − ₹2.80            ← EKO_DMT_CHARGE, deducted exactly ONCE
tds     = round(gross × 2%)
```

- `calcDmtTxn(amount)` → `DmtTxnBreakdown`. `rcmGst` (18% of `gross`) is what
  Eko pays under reverse charge; `ekoGst` takes the rounding residual so
  `rcmGst + ekoGst === gstInFee` exactly.
- `calcDmtQuote(input)` → monthly projection. **TDS is withheld on the monthly
  aggregate**, not per transaction (₹367.80 vs ₹370.00 at 1,000 × ₹2,500).
- Add-ons are debited from the partner's wallet: `DMT_SENDER_KYC_FEE` (₹11 +
  GST = ₹12.98, per new sender), `DMT_RECIPIENT_VERIFY_FEE` (₹3.25 incl. GST,
  per new **recipient**, not per transfer). `recoverChargesFromCustomer` adds
  an **offsetting credit** — it never zeroes the debit, because the wallet is
  debited either way.
- `dmtRateCardRows()` derives the rate card from `calcDmtTxn`, so the table,
  `/pricing.md` and the Excel sheet cannot drift.

> Superseded 2026-08-22: the old `DMT_SLABS` table deducted the ₹2.80 Eko
> charge **twice** (its `ekoPricing` column was in fact the correct gross
> commission) and resolved every amount to its slab's upper bound. The
> formula fixes both; the published "Earn up to" figure moved ₹36.77 → ₹39.57.

### How to update rates

1. Verification: edit `tiers` in `PRICED_APIS`. DMT: edit the constants in
   `dmt-pricing.ts` (the ledger derives). AePS/BBPS: edit `AEPS_*`,
   `BBPS_CATEGORIES` (and `bbps-operators.ts` for the Excel list).
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
| `tab` | PricingTabs | `tab=dmt` | Active tab (`dmt` / `payments` / `banking`). Absent = verification (never written). |
| `sel` | PricingCalculator | `sel=pan-lite:50000,bank-pennydrop:10000` | Verification state — `apiId:volume` pairs. |
| `apis` | PricingCalculator | `apis=pan` | Deep-link entry. Accepts priced-API ids OR product ids (expands at `DEFAULT_VOLUME`). Normalised into `sel` after load. |
| `gst` | PricingCalculator | `gst=1` | Verification headline total includes GST |
| `pay` | PaymentsCalculator | `pay=dmt:5000:2500,bbps-electricity:1000:1500` | Earnings state — `productId:monthlyTxns:avgAmount` (avgAmount omitted for `aeps-mini`). |
| `dmt` | DmtCalculator | `dmt=2500:1000:50:80:0` | `amount:monthlyTxns:newSenders:newRecipients:recover` (recover = `1`/`0`). Written only after the user touches an input. |
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
modules. **Eight sheets, in tab order:**

| Sheet | Purpose |
|---|---|
| `Index` | First tab: what's inside + internal hyperlinks (`{ text, hyperlink: "#'Sheet Name'!A1" }`) to every sheet |
| `Verification Calculator` | Monthly COST estimate — usage inputs, line/subtotal/GST formulas |
| `DMT Calculator` | Per-txn ledger + monthly take-home — **all live formulas** (closed-form, no lookup table) |
| `Payments Earnings` | Monthly EARNINGS estimate for AePS/BBPS — avg-amount + txn inputs; gross / TDS / net payout summary |
| `Connected Banking` | Setup (₹75,000 × banks + GST) and monthly (per-txn slab IF + GST) blocks |
| `Verification Rate Card` | Static verification reference |
| `Payments Rate Card` | Static AePS and BBPS category reference |
| `BBPS Operator Rates` | Full operator list, frozen header + auto-filter |

- **Renderer**: `ssg/render-pricing-xlsx.ts` — pure `renderPricingXlsx(data)`
  → `Buffer` (unit-tested in `src/test/render-pricing-xlsx.test.ts`). It
  orchestrates per-sheet builders in `ssg/xlsx/` (`shared.ts` holds brand
  styling, the `PricingXlsxData` contract and the `SHEETS` name constants).
  Worksheets are created up-front so **tab order is independent of build
  order**.
- **DMT formulas**: fully closed-form, so there is no VLOOKUP and no
  cross-sheet range threading. `ROUND` must sit at the SAME points as
  `calcDmtTxn` — `ROUND(MAX(10,amt*1%),2)` → `ROUND(fee/(1+0.18),2)` →
  `−2.8` → `−ROUND(gross*0.02,2)` — or the workbook and the site disagree.
  AePS/BBPS slab products use nested `IF`s generated from their
  `AmountSlab[]`.
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
