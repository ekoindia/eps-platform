# Single Source of Truth

The docs portal is built on one rule: **declare each fact once, recompose views
at read time.** Auth headers, common request params, the response envelope, and
error codes are defined exactly once. An individual endpoint spec declares *only
its deltas* — its own path, its endpoint-specific params, and its `data` payload.
Resolvers stitch the shared pieces and the deltas back together whenever a view
(detail page, code sample, Markdown twin) needs the full picture.

This is why a single edit to, say, `COMMON_REQUEST_PARAMS` instantly updates every
endpoint's param table, every cURL/JS/Python sample, and every generated `.md`.

## The data files

| File | Holds |
| --- | --- |
| `src/lib/data/api-specs-common.ts` | The `ApiSpec` / `ApiParam` / `ResponseField` types, `COMMON_REQUEST_PARAMS`, the response envelopes, and the resolvers. |
| `src/lib/data/api-auth.ts` | `AUTH_HEADERS`, `API_VERSION`, `API_ENVIRONMENTS` (sandbox + production base URLs). |
| `src/lib/data/api-error-codes.ts` | `HTTP_STATUS_CODES`, `RESPONSE_STATUS_CODES`, `getErrorCodeMeaning()`. |
| `src/lib/data/api-products.ts` | Product + category registry (`ApiProductRef`), the FK target for `spec.productId`. |
| `src/lib/data/api-specs.ts` | The spec database — one `ApiSpec` per endpoint, deltas only. |

## The `ApiSpec` shape

Defined in `api-specs-common.ts` (lines 64–99). The important idea is what it
*omits*: there is no `headers`, no `commonParams`, no `responseEnvelope` field,
because those are inherited.

```typescript
export interface ApiSpec {
	id: string;                              // kebab-case, e.g. "pan-lite"
	productId: ApiProductId;                 // FK → API_PRODUCTS
	name: string;
	slug: string;                            // portal route slug (no method prefix)
	summary: string;
	description?: string;
	category: "bc" | "payment" | "verification";
	relevance?: ApiProductRelevance;         // "H" | "M" | "L" — nav ordering
	bestFor?: string;
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string;                            // relative; full URL = baseUrl + path
	docsUrl: string;
	sourceDoc?: string;
	financial?: boolean;                     // uses the financial response envelope
	extraRequestParams: ApiParam[];          // API-specific params ONLY
	omitCommonParams?: string[];             // drop a common param when N/A
	sampleRequest: Record<string, unknown>;  // copy-paste-ready request example
	responseData: ResponseField[];           // ONLY the `data` subtree
	sampleSuccessResponse: Record<string, unknown>;  // full envelope + data
	errorScenarios?: ApiErrorScenario[];
}
```

Supporting primitives (same file, lines ~19–53):

- **`ApiParam`** — `{ name, label?, in: "path"|"query"|"header"|"body", type, required, description?, example? }`.
- **`ResponseField`** — `{ name, label?, type, description?, imp?, example?, children? }`.
  `imp: true` flags a *verifiable* field (highlighted in the response tree — the
  "what can you verify?" use-case for the verification products). `children`
  nests for `object`/`array` types.
- **`ApiErrorScenario`** — `{ scenario, statusCode?, example }` for non-success edges.

## The shared layers

**Auth headers** (`api-auth.ts`, `AUTH_HEADERS`) — identical on every request:

- `developer_key` — static API key.
- `secret-key` — per-request HMAC-SHA256 signature (see [try-it-now.md](try-it-now.md)).
- `secret-key-timestamp` — milliseconds since epoch.
- `content-type` — always `application/json`.

**Environments** (`api-auth.ts`, `API_ENVIRONMENTS`):

```typescript
sandbox:    https://staging.eko.in:25004/ekoapi/${API_VERSION}   // DEFAULT_BASE_URL
production: https://api.eko.in/ekoapi/${API_VERSION}
```

`DEFAULT_BASE_URL` points at sandbox — code samples and the try-it console use it.

**Common request params** (`api-specs-common.ts`, `COMMON_REQUEST_PARAMS`):
`initiator_id` (required), `user_code` (required), `client_ref_id`, `source`.
An endpoint that doesn't need one lists it in `omitCommonParams`.

**Response envelope** (`api-specs-common.ts`):

```typescript
COMMON_RESPONSE_ENVELOPE     // status, response_status_id, message, response_type_id
FINANCIAL_RESPONSE_ENVELOPE  // = common + tx_status, txstatus_desc
```

A spec with `financial: true` inherits the financial envelope automatically.

**Error codes** (`api-error-codes.ts`): `HTTP_STATUS_CODES` (200/403/404/405/415/500)
and `RESPONSE_STATUS_CODES` (transaction-level: 0 = success, 302 = wrong OTP,
347 = insufficient balance, 463 = user not found, …). `getErrorCodeMeaning(code)`
resolves a code to its description; the Error Codes MDX guide renders these tables.

## The resolvers — recomposition at read time

All three live in `api-specs-common.ts` (lines ~194–218). They are the only
correct way to read a "full" view of a spec — never read the raw spec fields
directly for rendering.

```typescript
/** Auth headers — identical for every API. */
export const resolveHeaders = (): ApiParam[] => AUTH_HEADERS;

/** Common params (minus omitted) followed by the endpoint's own. */
export const resolveRequestParams = (spec: ApiSpec): ApiParam[] => {
	const omit = new Set(spec.omitCommonParams ?? []);
	const common = COMMON_REQUEST_PARAMS.filter((p) => !omit.has(p.name));
	return [...common, ...spec.extraRequestParams];
};

/** Full response tree: envelope with `data` = the endpoint's subtree. */
export const resolveResponseFields = (spec: ApiSpec): ResponseField[] => {
	const envelope = spec.financial
		? FINANCIAL_RESPONSE_ENVELOPE
		: COMMON_RESPONSE_ENVELOPE;
	return [
		...envelope,
		{ name: "data", type: "object", description: "API-specific response payload.", children: spec.responseData },
	];
};
```

A fourth resolver, `resolveEndpointUrl(spec, body?)`, lives in
`src/lib/docs/code-samples.ts` (it depends on the base URL) — it substitutes
`{path_param}` tokens and prefixes `DEFAULT_BASE_URL`. See
[code-samples.md](code-samples.md).

## Grouping & ordering

`api-products.ts` defines categories — `bc` (Banking & Cash), `payment`,
`verification` — and the products within each. `getSpecsForProduct(productId)`
(`api-specs.ts`) returns a product's specs **sorted by relevance** H → M → L:

```typescript
export const getSpecsForProduct = (productId: string): ApiSpec[] => {
	const order: Record<string, number> = { H: 0, M: 1, L: 2 };
	return API_SPECS.filter((s) => s.productId === productId)
		.sort((a, b) => (order[a.relevance ?? "M"] ?? 1) - (order[b.relevance ?? "M"] ?? 1));
};
```

This ordering flows straight into the left nav — see
[navigation-and-categories.md](navigation-and-categories.md).

## Why this matters

- **Zero duplication.** Auth/params/envelope/errors exist once.
- **Always in sync.** Detail pages, code samples, and Markdown twins all derive
  from the same data, so they can never drift apart.
- **SSR/Node-safe.** None of these files import React or `.mdx`, so the SSG route
  enumerator and unit tests can load them directly.
- **Type-checked FKs.** `ApiProductId` is a literal union, so a typo in a spec's
  `productId` fails the build.
</content>
