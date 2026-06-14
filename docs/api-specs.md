# API Technical Specifications

The single source of truth for **endpoint-level REST details** of every Eko API
— method, path, headers, request params, request/response examples, nested
response field trees (with verification `imp` flags), and error scenarios. Rich
enough to drive product-page API previews, the LLM Markdown twins, and a future
standalone developer reference portal.

This data is kept **separate from product-page marketing content**
(`api-product-pages.ts`) so each concern has one home.

## Why a separate layer

Previously, partial technical data (`docsUrl`, `inputOutputPreview(s)`) was
embedded inside `api-product-pages.ts`, mixing marketing copy with API specs and
duplicating shared elements. It now lives in a dedicated, **DRY** config layer:
shared pieces (auth, common params, response envelope, error codes) are defined
once and composed; each API entry declares only what is unique to it.

## The model

```
one product (api-products.ts)  ──<  many APIs (api-specs.ts)
   e.g. "pan"                         pan-lite, pan-advanced, pan-bulk-verify
```

`ApiSpec.productId` is a foreign key into `API_PRODUCTS` (`api-products.ts`).

## Files

| File | Responsibility |
|------|---------------|
| `src/lib/data/api-specs.ts` | `API_SPECS: ApiSpec[]` (registry), `API_SPECS_MAP`, `getSpecsForProduct(productId)` |
| `src/lib/data/api-specs-common.ts` | Types (`ApiSpec`, `ResponseField`, `ApiParam`), `COMMON_REQUEST_PARAMS`, `COMMON_RESPONSE_ENVELOPE`, `FINANCIAL_RESPONSE_ENVELOPE`, and resolvers |
| `src/lib/data/api-auth.ts` | `AUTH_HEADERS`, `FINANCIAL_AUTH_HEADERS`, `API_ENVIRONMENTS` (sandbox/production base URLs), `API_AUTH_INFO` (token-gen notes) |
| `src/lib/data/api-error-codes.ts` | `HTTP_STATUS_CODES`, `RESPONSE_STATUS_CODES`, `getErrorCodeMeaning()` |
| `src/lib/data/api-spec-previews.ts` | Adapters that turn specs into product-page previews + docs links |

## DRY: deltas + resolvers

An `ApiSpec` stores **only what is unique** to that endpoint:

- `extraRequestParams` — API-specific params only. The four common body params
  (`initiator_id`, `user_code`, `client_ref_id`, `source`) and all auth headers
  are **not** repeated here.
- `responseData` — only the `data` subtree. The response envelope
  (`status`, `response_status_id`, `message`, `response_type_id`, plus
  `tx_status`/`txstatus_desc` for financial APIs) is **not** repeated here.
- `financial: true` opts an endpoint into the `request_hash` header and the
  financial response envelope.

To reconstruct a full view (for a portal or preview), use the resolvers in
`api-specs-common.ts` — they merge the shared layer back in:

```ts
import { getSpecsForProduct } from "@/lib/data/api-specs";
import {
  resolveHeaders,        // AUTH_HEADERS (+ request_hash if financial)
  resolveRequestParams,  // COMMON_REQUEST_PARAMS (− omitted) + extraRequestParams
  resolveResponseFields, // envelope with data = responseData
} from "@/lib/data/api-specs-common";

const spec = getSpecsForProduct("pan")[0];
const headers = resolveHeaders(spec);
const params  = resolveRequestParams(spec);
const fields  = resolveResponseFields(spec);
```

## The `ApiSpec` shape

```ts
interface ApiSpec {
  id: string;                 // unique kebab id, e.g. "pan-lite"
  productId: string;          // FK -> API_PRODUCTS.id
  name: string;               // "PAN Lite"
  slug: string;
  summary: string;
  description?: string;
  category: "bc" | "payment" | "verification";
  relevance?: "H" | "M" | "L";
  bestFor?: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;               // relative; full URL = environment baseUrl + path
  docsUrl: string;            // developer-portal reference link
  financial?: boolean;        // adds request_hash header + financial envelope
  extraRequestParams: ApiParam[];   // API-specific only
  omitCommonParams?: string[];      // rare: drop a common param
  sampleRequest: Record<string, unknown>;
  responseData: ResponseField[];    // the `data` subtree only
  sampleSuccessResponse: Record<string, unknown>;
  errorScenarios?: { scenario: string; statusCode?: number; example: object }[];
}
```

### `imp` flags ("What can you verify?")

`ResponseField` is a recursive tree (`children` for objects / arrays). Any field
— including deeply nested ones — can set `imp: true` to mark it as an important
verifiable field. Verification product pages surface these as the highlighted
"What can you verify?" outputs.

## Authentication

Every call sends the same auth headers (`developer_key`, `secret-key`,
`secret-key-timestamp`, `content-type`); financial (money-debit) APIs add
`request_hash`. The `secret-key` is `base64(HMAC-SHA256(timestamp,
base64(access_key)))`. Full details + key types + environments are in
`api-auth.ts` (`API_AUTH_INFO`), sourced from
<https://developers.eko.in/docs/auth>. **Never** hard-code an `access_key` in
source.

## How consumers use it

- **Product pages** — `ProductDetailPage.tsx` calls `getApiPreviewsForProduct()`
  and `getProductDocsUrl()` (from `api-spec-previews.ts`) and passes the derived
  previews + docs link into `ProductPageLayout`. The on-page preview is capped;
  the full set powers the developer reference.
- **Markdown / LLM twins** — `render-product.ts` and `render-products-index.ts`
  take the product's specs as an optional argument (default = registry lookup),
  so they stay pure and unit-testable. See [markdown-generation.md](markdown-generation.md).

## Add or edit an API

1. Add/modify an `ApiSpec` object in `api-specs.ts`. Set `productId` to an
   existing `API_PRODUCTS` id; declare **deltas only** (skip common params, auth
   headers, and the response envelope — the resolvers add them).
2. For verification APIs, mark the verifiable response fields with `imp: true`.
3. Set `financial: true` for money-debit endpoints (adds `request_hash`).
4. Verify: `npx tsc --noEmit`, `npm run test`, then `npm run build` and check the
   product's `.md` twin (e.g. `dist/products/<slug>.md`) renders the new preview.

## Data provenance & caveat

`API_SPECS` was initially populated by scraping
<https://developers.eko.in>. Some response shapes — for JavaScript-rendered or
rate-limited portal pages — were seeded from curated samples rather than the live
page. Treat those as best-effort and reconcile against live API calls before
relying on them as authoritative.
