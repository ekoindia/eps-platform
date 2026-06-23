/**
 * Shared building blocks for the technical REST API specification layer.
 *
 * This module holds everything that is COMMON across Eko's REST APIs so that
 * individual {@link ApiSpec} entries (in `api-specs.ts`) only declare what is
 * unique to them. The reusable pieces (auth headers, common request params,
 * response envelope, error codes) live here and in the sibling `api-auth.ts`
 * and `api-error-codes.ts` files — never duplicated per API.
 *
 * The data here is rich enough to render a developer API reference portal.
 */
import { AUTH_HEADERS } from "./api-auth";
import type {
	ApiProductCategory,
	ApiProductId,
	ApiProductRelevance,
} from "./api-products";
import { API_PRODUCTS_MAP } from "./api-products";

// ---------------------------------------------------------------------------
// Primitive shapes
// ---------------------------------------------------------------------------

/** A single request parameter (header / path / query / body field). */
export interface ApiParam {
	name: string;
	label?: string;
	in: "path" | "query" | "header" | "body";
	type: string;
	required: boolean;
	description?: string;
	example?: unknown;
}

/**
 * A node in a (possibly nested) response field tree.
 *
 * `imp: true` flags a field as important for verification products — the
 * "What can you verify?" data — and can appear on nested fields too.
 */
export interface ResponseField {
	name: string;
	label?: string;
	type: "string" | "number" | "boolean" | "object" | "array" | "null";
	description?: string;
	/** Highlight as an important verifiable field ("What can you verify?"). */
	imp?: boolean;
	example?: unknown;
	/** Child fields for `object`, or the element shape for `array` of objects. */
	children?: ResponseField[];
}

/** A documented non-success / edge-case response example. */
export interface ApiErrorScenario {
	scenario: string;
	statusCode?: number;
	example: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// The core API specification — DELTAS ONLY
// ---------------------------------------------------------------------------

/**
 * One REST API. Common pieces (auth headers, common request params, response
 * envelope, error-code table) are inherited via the resolvers below and MUST
 * NOT be duplicated here. Declare only what is unique to this endpoint.
 */
export interface ApiSpec {
	/** Unique kebab-case id, e.g. "pan-lite". */
	id: string;
	/** FK to `API_PRODUCTS.id` — many APIs map to one product. Typed as the
	 * literal id union so a bad reference is a compile error. */
	productId: ApiProductId;
	/** Display name, e.g. "PAN Lite". */
	name: string;
	/** Portal route slug. */
	slug: string;
	/** Short one-line summary of the API */
	summary: string;
	/** Short description (plain GFM markdown). Used by the `.md` twin,
	 * OpenAPI/Scalar and the agent bundle. If {@link descriptionFile} is also set,
	 * the docs page shows the richer file while these text sinks use this string. */
	description?: string;
	/** OPTIONAL: basename of a markdown file under
	 * `src/content/docs/endpoints/` holding this endpoint's RICH description
	 * (callouts, headings, code blocks) — e.g. "aeps-biometric-ekyc.md". Rendered
	 * on the docs page; may be combined with a short inline {@link description}.
	 * Resolved via `resolveDescription` / `resolveShortDescription` in
	 * `endpoint-descriptions.ts`. */
	descriptionFile?: string;
	relevance?: ApiProductRelevance;
	/** OPTIONAL sub-product grouping for products with multiple integration
	 * providers (e.g. Fino & Levin" for DMT).
	 * Format: "<product short name> – <provider>" (Eg: "DMT – Fino")
	 * Unset ⇒ the spec sits directly under its product in the docs nav.
	 * Nav + data only — never part of the URL. */
	provider?: string;
	/** OPTIONAL purpose-group within a provider (or product) — e.g. "Sender",
	 * "Recipients", "Transaction". Unset ⇒ the spec sits directly under its
	 * provider (or product). Nav + data only — never part of the URL. */
	group?: string;
	bestFor?: string;
	method: "GET" | "POST" | "PUT" | "DELETE";
	/** Relative path; full URL = environment baseUrl + path. */
	path: string;
	/**
	 * @deprecated External legacy developer-portal reference link. No longer
	 * used by product pages, markdown or the agent bundle — these now link to the
	 * internal `/docs/<slug>` page derived from `slug`. Kept temporarily for
	 * old-vs-new comparison; slated for removal (see docs-migration follow-up).
	 */
	docsUrl: string;
	/** API reference URL from the source website (actual provider of the API) */
	sourceDoc?: string;
	/** Money-debit API: returns the financial response envelope (tx_status, etc.). */
	financial?: boolean;
	/** API-specific request params ONLY (common ones are inherited).
	 * A param whose `name` matches a {@link COMMON_REQUEST_PARAMS} entry OVERRIDES
	 * that common param (to change its example / required / description / location). */
	extraRequestParams: ApiParam[];
	/** Rare: drop a common request param that does not apply to this API. */
	omitCommonParams?: string[];
	/** OPTIONAL override for the request-body example. When unset, the body is
	 * auto-generated from the `in:"body"` param examples via {@link buildSampleRequest}. */
	sampleRequest?: Record<string, unknown>;
	/** ONLY the `data` subtree of the response, with `imp` markers. */
	responseData: ResponseField[];
	/** Full success response example (envelope + data). */
	sampleSuccessResponse: Record<string, unknown>;
	errorScenarios?: ApiErrorScenario[];
}

// ---------------------------------------------------------------------------
// Common request params — defined ONCE
// ---------------------------------------------------------------------------

/** HTTP methods an `ApiSpec` may use. */
export type HttpMethod = ApiSpec["method"];

/**
 * A common request param shared across APIs. Unlike {@link ApiParam}, it does
 * NOT fix a location: it declares which HTTP methods it applies to, and its
 * `in` is derived per request (GET → query, otherwise → body) at resolve time.
 */
export interface CommonRequestParam extends Omit<ApiParam, "in"> {
	/** HTTP methods this common param applies to; skipped on others. */
	allowedMethods: HttpMethod[];
}

/** Every HTTP method — common params that apply everywhere. */
const ALL_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE"];

export const COMMON_REQUEST_PARAMS: CommonRequestParam[] = [
	{
		name: "initiator_id",
		allowedMethods: ALL_METHODS,
		type: "string",
		required: true,
		description:
			"Registered mobile number of the API user (see Platform Credentials).",
		example: "9962981729",
	},
	{
		name: "user_code",
		allowedMethods: ALL_METHODS,
		type: "string",
		required: false,
		description:
			"Unique code of your user/agent/retailer the service is run for. Use `Onboard Agent` API to register your users",
		example: "20810200",
	},
	{
		name: "client_ref_id",
		// Write methods only — a GET has no state to reference idempotently.
		allowedMethods: ["POST", "PUT", "DELETE"],
		type: "string",
		required: false,
		description: "Unique reference id per API call, generated by your system.",
		example: "REQ-20260101-001",
	},
];

// ---------------------------------------------------------------------------
// Common response envelope — defined ONCE (only `data` is API-specific)
// ---------------------------------------------------------------------------

export const COMMON_RESPONSE_ENVELOPE: ResponseField[] = [
	{
		name: "status",
		type: "number",
		description: "Primary success indicator (0 = success).",
		example: 0,
	},
	{
		name: "message",
		type: "string",
		description: "Human-readable response / error message.",
		example: "Verification successful",
	},
	{
		name: "response_status_id",
		type: "number",
		description: "Granular status id; see the shared error-codes table.",
		example: 0,
	},
	{
		name: "response_type_id",
		type: "number",
		description:
			"A unique id for every possible response shape (success or error) — useful for client logic branching and analytics.",
		example: 1388,
	},
];

/** Financial APIs additionally return transaction-state fields. */
export const FINANCIAL_RESPONSE_ENVELOPE: ResponseField[] = [
	...COMMON_RESPONSE_ENVELOPE,
	{
		name: "tx_status",
		type: "string",
		description:
			"Transaction state: 0=Success, 1=Fail, 2=Awaited, 3=Refund Pending, 4=Refunded, 5=On Hold.",
		example: "0",
	},
	{
		name: "txstatus_desc",
		type: "string",
		description: "Human-readable transaction status.",
		example: "Success",
	},
];

// ---------------------------------------------------------------------------
// Resolvers — reassemble full views without storing duplicates
// ---------------------------------------------------------------------------

/**
 * The category a spec belongs to, derived from its FK product. This replaces a
 * per-spec `category` field: a spec's category IS its product's category, with
 * no separate source to drift. Uses {@link API_PRODUCTS_MAP} (all products,
 * including disabled) since `productId` is FK-typed against every product; the
 * `?? "bc"` is unreachable for a valid spec and only satisfies the index type.
 */
export const categoryForSpec = (spec: ApiSpec): ApiProductCategory =>
	API_PRODUCTS_MAP[spec.productId]?.category ?? "bc";

/** Full auth header set for an API — identical on every request. */
export const resolveHeaders = (): ApiParam[] => AUTH_HEADERS;

/** Location of a common param for a given method: GET → query, else → body. */
const commonLocationFor = (method: HttpMethod): ApiParam["in"] =>
	method === "GET" ? "query" : "body";

/**
 * Full request param list for an API: applicable common params (location
 * derived from the method) followed by the API-specific ones.
 *
 * A common param is included only when the spec's method is in its
 * `allowedMethods`, it is not listed in `omitCommonParams`, and it is not
 * OVERRIDDEN by a same-named entry in `extraRequestParams` (which then wins).
 */
export const resolveRequestParams = (spec: ApiSpec): ApiParam[] => {
	const omit = new Set(spec.omitCommonParams ?? []);
	const overridden = new Set(spec.extraRequestParams.map((p) => p.name));
	const location = commonLocationFor(spec.method);
	const common: ApiParam[] = COMMON_REQUEST_PARAMS.filter(
		(p) =>
			p.allowedMethods.includes(spec.method) &&
			!omit.has(p.name) &&
			!overridden.has(p.name),
	).map(({ allowedMethods, ...rest }) => ({ ...rest, in: location }));
	return [...common, ...spec.extraRequestParams];
};

/**
 * The JSON request-body example for an endpoint.
 *
 * Returns the spec's `sampleRequest` override verbatim when set; otherwise
 * generates it from the resolved params — every `in:"body"` param that has an
 * `example`, as `{ name: example }`, in resolver order. Path/query/header/auth
 * params are excluded (they are not part of the JSON body), so GET endpoints
 * yield `{}`. The param examples ARE the single source of truth.
 */
export const buildSampleRequest = (spec: ApiSpec): Record<string, unknown> => {
	if (spec.sampleRequest !== undefined) return spec.sampleRequest;
	const body: Record<string, unknown> = {};
	for (const p of resolveRequestParams(spec)) {
		if (p.in === "body" && p.example !== undefined) body[p.name] = p.example;
	}
	return body;
};

/** Full response tree: envelope with `data` set to the API-specific subtree. */
export const resolveResponseFields = (spec: ApiSpec): ResponseField[] => {
	const envelope = spec.financial
		? FINANCIAL_RESPONSE_ENVELOPE
		: COMMON_RESPONSE_ENVELOPE;
	return [
		...envelope,
		{
			name: "data",
			type: "object",
			description: "API-specific response payload.",
			children: spec.responseData,
		},
	];
};
