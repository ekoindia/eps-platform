# Pricing Calculator (`/pricing`)

Interactive pricing calculator + crawlable rate card for Verification APIs.
Fintech APIs (DMT, AePS, BBPS, DigiKhata, Connected Banking) are commission-based
and intentionally out of scope (future phase 2).

## Architecture

```
src/lib/data/api-pricing.ts          ← pricing config + pure quote math (no React)
src/pages/PricingPage.tsx            ← page assembly, SEO, FAQ
src/components/pricing/
  PricingCalculator.tsx              ← orchestrator: state + URL sync
  ApiPicker.tsx                      ← searchable grouped multi-select
  SelectedApiRow.tsx                 ← volume slider + numeric input per API
  QuoteSummary.tsx                   ← live estimate (desktop sidebar + mobile drawer)
  MobileSummaryBar.tsx               ← sticky bottom bar (mobile) opening a drawer
  PricingTable.tsx                   ← static SSG-rendered rate card (SEO)
src/lib/utils/json-ld.ts             ← generatePricingJsonLd() (OfferCatalog + FAQPage)
```

## Pricing config (`src/lib/data/api-pricing.ts`)

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

### Setup fees & limited-time waiver

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

No "Talk to Sales" buttons in the calculator — the only CTAs are
"Get Started" (Zoho chat) and "Copy estimate link".

### How to update rates

1. Edit the relevant `tiers` array in `PRICED_APIS`.
2. Volume discounts later: add slabs, e.g.
   `tiers: [{ upTo: 50_000, rate: 1.2 }, { upTo: null, rate: 1.0 }]`.
3. No other file changes needed — calculator, rate card, JSON-LD, and the
   product-page "Starts at ₹X" line all derive from this config.

## Product-page integration

`ProductPageLayout` shows a hero "View Pricing" CTA (deep link
`/pricing?apis={productId}`) and a "Starts at ₹X per verification" line when
`getPricedApisForProduct(productId)` is non-empty. Products without priced
APIs (e.g. `ip`) automatically show neither.

## URL param scheme

| Param | Example | Meaning |
|---|---|---|
| `sel` | `sel=pan-lite:50000,bank-pennydrop:10000` | Canonical state — `apiId:volume` pairs. Written back (debounced 300 ms, `replace: true`). |
| `apis` | `apis=pan` or `apis=pan-lite,gst-basic` | Deep-link entry. Accepts priced-API ids OR product ids (product id expands to all its priced APIs at `DEFAULT_VOLUME`). Normalised into `sel` after load. |
| `gst` | `gst=1` | Headline total includes GST |

Unknown ids are dropped, duplicates deduped, volumes clamped to
`[0, MAX_VOLUME]`. Garbage params never crash the page.

## Cross-component handoff

The rate card's "+" buttons dispatch `pricing:add-api` (`CustomEvent` with
`detail.apiId`) and scroll to `#calculator`; `PricingCalculator` listens and
adds the API. `QuoteSummary`'s "Talk to Sales" dispatches the existing
`open-talk-to-sales` event handled by `Header`.

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
- **Calculator never wipes foreign params**: the URL write-back in
  `PricingCalculator` only rewrites its own keys (`sel`, `apis`, `gst`).
- **Calculator context**: selection is mirrored to sessionStorage
  (`saveCalculatorContext`) so leads capture API interest after the user
  leaves /pricing — URLs off /pricing stay clean.
- **Zoho form**: `buildLeadWebsiteUrl()` builds the CRM `Website` field
  (max 450 chars). Priority: origin+path → tracking params → calculator
  selection; degrades full `sel` → `apis=` ids only → no calculator;
  tracking params are never dropped.
- **SalesIQ chat**: `openZohoChat` pushes `visitor.info` with tracking
  params + `apis_interested` before opening (best-effort).

## Route registration (3 places)

`src/App.tsx` (lazy), `src/AppServer.tsx` (eager — `React.lazy` unsupported in
`renderToString`), `ssg/routes.ts` (`ROUTE_CHUNK_MAP` + `PRERENDER_ROUTES`,
which also feeds sitemap.xml).
