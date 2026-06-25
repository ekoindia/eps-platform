# API Technical Specifications

> See also: [docs/ai-agent-platform.md](./ai-agent-platform.md) for the AI-agent artifact layer (`/agent/*`) generated from these specs.

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
| `src/lib/data/api-auth.ts` | `AUTH_HEADERS`, `API_ENVIRONMENTS` (sandbox/production base URLs), `API_AUTH_INFO` (token-gen notes) |
| `src/lib/data/api-error-codes.ts` | `HTTP_STATUS_CODES`, `RESPONSE_STATUS_CODES`, `getErrorCodeMeaning()` |
| `src/lib/data/api-spec-previews.ts` | Adapters that turn specs into product-page previews + docs links |

## DRY: deltas + resolvers

An `ApiSpec` stores **only what is unique** to that endpoint:

- `extraRequestParams` — API-specific params only. The common body params
  (`initiator_id`, `client_ref_id`) and all auth headers are **not** repeated
  here. (`user_code` is no longer a common param — endpoints that need it, e.g.
  AePS, declare it explicitly in `extraRequestParams`.)
- `responseData` — only the `data` subtree. The response envelope
  (`status`, `response_status_id`, `message`, `response_type_id`, plus
  `tx_status`/`txstatus_desc` for financial APIs) is **not** repeated here.
- `financial: true` opts an endpoint into the financial response envelope
  (`tx_status`/`txstatus_desc`).

To reconstruct a full view (for a portal or preview), use the resolvers in
`api-specs-common.ts` — they merge the shared layer back in:

```ts
import { getSpecsForProduct } from "@/lib/data/api-specs";
import {
  resolveHeaders,        // AUTH_HEADERS
  resolveRequestParams,  // method-applicable COMMON_REQUEST_PARAMS (− omitted/overridden) + extraRequestParams
  buildSampleRequest,    // request body example: override or generated from in:"body" examples
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
  description?: string;       // short text (used by .md twin / OpenAPI / agent bundle)
  descriptionFile?: string;   // rich .md file basename (used by the docs page). Both may be set.
  // category is NOT stored here — it is derived from the product via
  // categoryForSpec(spec) (productId -> API_PRODUCTS[…].category).
  relevance?: "H" | "M" | "L";
  bestFor?: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;               // relative; full URL = environment baseUrl + path
  docsUrl: string;            // developer-portal reference link
  financial?: boolean;        // adds the financial response envelope
  extraRequestParams: ApiParam[];   // API-specific; same name overrides a common param
  omitCommonParams?: string[];      // rare: drop a common param
  sampleRequest?: Record<string, unknown>;  // optional override; else generated from in:"body" examples
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

## Rich descriptions (markdown)

Description content is **GFM markdown**. It supports callouts, section headings
(`h2`–`h4`), ordered/unordered lists, tables, inline code, and
syntax-highlighted fenced code blocks. Two resolvers in `endpoint-descriptions.ts`
pick the right variant per sink:

| Resolver | Precedence | Used by |
|----------|-----------|---------|
| `resolveDescription` | **file** → inline (rich wins) | Docs HTML page only |
| `resolveShortDescription` | **inline** → file (short wins) | `.md` twin, OpenAPI/Scalar, agent/MCP bundle |

So a spec can carry BOTH: a long, rich `descriptionFile` for the docs page and a
short inline `description` for the text sinks. With only one set, both resolvers
fall back to it.

| Sink | Resolver | How it renders |
|------|----------|----------------|
| Docs page (middle pane) | `resolveDescription` | `MarkdownProse.tsx` — `react-markdown` + `remark-gfm` + `remarkCallout`; code via `MarkdownCodeBlock.tsx` (prism, own `--mdc-*` theme), callouts via `Callout.tsx`. `h1` is stripped (the endpoint title owns it). |
| `.md` twin (`render-doc.ts`) | `resolveShortDescription` | inserted raw — any callouts stay native GitHub-alert blockquotes |
| OpenAPI → Scalar (`build-openapi.ts`) | `resolveShortDescription` | CommonMark in the operation `description` (primary spec only for grouped path+method variants) |
| Agent bundle / MCP (`build-agent-bundle.ts`) | `resolveShortDescription` | raw string |

**Callouts** use GitHub-alert syntax (no dependency — `remark-callout.ts` is a
hand-rolled mdast transform):

```md
> [!WARNING]
> You need to **encrypt the Aadhaar number** before passing it.
```

Supported types: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`, `DANGER`.

**Fenced code blocks** are highlighted (prism); register any extra grammar in
`src/lib/docs/prism-setup.ts` (e.g. `java` is registered there). Unknown
languages fall back to plain text — they never throw.

### Inline vs external (`descriptionFile`)

For short descriptions use the inline `description` string. For long/rich ones
(callouts + code), author a markdown file under
`src/content/docs/endpoints/<name>.md` and set `descriptionFile: "<name>.md"`.
This keeps `api-specs.ts` lean and gives real markdown editing. Set **both** when
the docs page should show the rich file but the `.md` twin / OpenAPI / agent
bundle should stay concise.

> Note: MDX is excluded from `content/docs/endpoints/**` (`ssg/mdx-options.ts`)
> so these files load as raw text, not compiled components.

## Authentication

Every call sends the same auth headers (`developer_key`, `secret-key`,
`secret-key-timestamp`, `content-type`). The `secret-key` is
`base64(HMAC-SHA256(timestamp, base64(access_key)))`. Full details + key types + environments are in
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
3. Set `financial: true` for money-debit endpoints (adds the financial response envelope).
4. For a rich description (callouts, code, headings), author
   `src/content/docs/endpoints/<name>.md` and set `descriptionFile: "<name>.md"`
   — optionally alongside a short inline `description` for the `.md` twin /
   OpenAPI / agent bundle. See [Rich descriptions](#rich-descriptions-markdown).
5. Verify: `npx tsc --noEmit`, `npm run test`, then `npm run build` and check the
   product's `.md` twin (e.g. `dist/products/<slug>.md`) renders the new preview.

## Data provenance & caveat

`API_SPECS` was initially populated by scraping
<https://developers.eko.in>. Some response shapes — for JavaScript-rendered or
rate-limited portal pages — were seeded from curated samples rather than the live
page. Treat those as best-effort and reconcile against live API calls before
relying on them as authoritative.
