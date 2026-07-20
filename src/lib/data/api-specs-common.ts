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

/** Where a request parameter travels. */
export type ParamLocation = "path" | "query" | "header" | "body";

/** A single request parameter (header / path / query / body field).
 *
 * `in` is an OPTIONAL override: by default the location is derived from the
 * spec (a name matching a `{token}` in the path → `path`; otherwise GET →
 * `query`, else → `body`). Set `in` explicitly only to override that — e.g.
 * for headers, which can't be derived from the path/method.
 *
 * `type` is freeform ("string", "number", "object", …); the special value
 * `"file"` marks a binary upload field, which flips the whole request to
 * `multipart/form-data` (see {@link resolveContentType}). */
export interface ApiParam {
	name: string;
	label?: string;
	in?: ParamLocation;
	type: string;
	required: boolean;
	description?: string;
	example?: unknown;
}

/** An {@link ApiParam} after resolution — its `in` is always concrete, so
 * downstream consumers (OpenAPI, Postman, SDK surface) can rely on it. */
export type ResolvedApiParam = ApiParam & { in: ParamLocation };

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

/**
 * One documented `response_type_id` value: what it means and, when the id is a
 * routing decision, which endpoint to call next.
 *
 * The id space is Eko-wide but the routing is flow-specific — `308` ("not
 * enrolled") leads to a different onboard endpoint in DMT than in PPI — so these
 * live per-spec rather than in a global registry.
 */
export interface ApiResponseType {
	/** The `response_type_id` value. */
	id: number;
	/** What this response means, in one line. */
	meaning: string;
	/** OPTIONAL FK into `API_SPECS.slug` — the endpoint to call next. Resolved
	 * through `docHrefForSlug` at render, so it never produces a 404. */
	next?: string;
}

/**
 * An optional curated "see also" link shown in the endpoint page's Next Steps
 * block. Prefer {@link slug} for internal docs pages — it is resolved through
 * `docHrefForSlug`, which drops the link if no such page exists (never a 404).
 * Use {@link url} for anything else: an absolute external URL, or a site-relative
 * path beginning with `/` (rendered as an in-app link).
 */
export interface RelatedLink {
	/** Display text. */
	label: string;
	/** Internal `/docs/<slug>` target; 404-guarded via `docHrefForSlug`. */
	slug?: string;
	/** Absolute external URL, or a site-relative `/path`, used when `slug` is unset. */
	url?: string;
	/** Optional one-line subtitle. */
	description?: string;
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
	/** Rare: per-spec header overrides/additions, merged by name over the shared
	 * {@link AUTH_HEADERS} (set `in: "header"` on each). Prefer the derived
	 * defaults — e.g. `content-type` already derives from `type:"file"` params. */
	headers?: ApiParam[];
	/** OPTIONAL override for the request-body example. When unset, the body is
	 * auto-generated from the `in:"body"` param examples via {@link buildSampleRequest}. */
	sampleRequest?: Record<string, unknown>;
	/** ONLY the `data` subtree of the response, with `imp` markers. */
	responseData: ResponseField[];
	/** Full success response example (envelope + data). */
	sampleSuccessResponse: Record<string, unknown>;
	errorScenarios?: ApiErrorScenario[];
	/** OPTIONAL: the `response_type_id` values this endpoint can return, each with
	 * its meaning and the next endpoint to call. Set this instead of hand-writing a
	 * routing table into {@link description} — it renders the response-types table
	 * on the docs page, the `.md` twin and OpenAPI, feeds the agent bundle/MCP, and
	 * annotates every sample payload whose id matches. */
	responseTypes?: ApiResponseType[];
	/** OPTIONAL hand-picked "see also" links shown in the endpoint's Next Steps
	 * block, alongside the auto-computed product / AI / SDK / next-in-group links. */
	relatedLinks?: RelatedLink[];
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
		name: "client_ref_id",
		// Required for POST calls only, but asking for all methods
		// so that it is easier to trace all user requests for debugging
		allowedMethods: ALL_METHODS,
		type: "string",
		required: false,
		description:
			"Unique reference ID per API call, generated by your system (max 20 characters).",
		example: "2026010100123456789",
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

/** True when the endpoint takes binary uploads (any `type:"file"` body param). */
export const isMultipart = (spec: ApiSpec): boolean =>
	resolveRequestParams(spec).some((p) => p.in === "body" && p.type === "file");

/** Request media type, derived from the spec: file uploads → multipart, else
 * JSON. No spec (generic auth docs) → JSON. */
export const resolveContentType = (
	spec?: ApiSpec,
): "application/json" | "multipart/form-data" =>
	spec && isMultipart(spec) ? "multipart/form-data" : "application/json";

/**
 * Full auth header set for an API. The `content-type` value derives from the
 * spec via {@link resolveContentType}; for multipart endpoints the description
 * warns that HTTP clients must set the header themselves (the boundary is
 * client-generated). A spec's rare {@link ApiSpec.headers} entries are merged
 * by name (spec wins) and appended when new. Call with no spec for the
 * generic, endpoint-independent set (auth docs).
 */
export const resolveHeaders = (spec?: ApiSpec): ApiParam[] => {
	const contentType = resolveContentType(spec);
	const base = AUTH_HEADERS.map((h) =>
		h.name === "content-type" && contentType === "multipart/form-data"
			? {
					...h,
					description:
						"multipart/form-data — let your HTTP client set this header itself (it generates the required boundary); do not hardcode the value.",
					example: contentType,
				}
			: h,
	);
	const overrides = spec?.headers;
	if (!overrides?.length) return base;
	const byName = new Map(overrides.map((h) => [h.name, h]));
	const baseNames = new Set(base.map((h) => h.name));
	return [
		...base.map((h) => byName.get(h.name) ?? h),
		...overrides.filter((h) => !baseNames.has(h.name)),
	];
};

/**
 * Names of the `{token}` path variables in a `path`. Token grammar is
 * intentionally limited to the chars EPS uses in path params — alphanumerics,
 * `-` and `_` (e.g. `{customer_id}`, `{transaction-reference}`). Exported so
 * other generators share one definition instead of re-declaring the regex.
 */
export const pathTokens = (path: string | undefined): Set<string> =>
	new Set([...(path ?? "").matchAll(/\{([-_a-zA-Z0-9]+)\}/g)].map((m) => m[1]));

/**
 * Derive a param's location when it isn't explicitly set: a name matching a
 * `{token}` in the path is a path param; otherwise GET → query, else → body.
 * An explicit `in` always wins (e.g. headers).
 */
const deriveLocation = (
	param: ApiParam,
	spec: ApiSpec,
	tokens: Set<string>,
): ParamLocation =>
	param.in ??
	(tokens.has(param.name) ? "path" : spec.method === "GET" ? "query" : "body");

/**
 * Full request param list for an API: applicable common params followed by the
 * API-specific ones, each with a concrete `in` (derived when not set).
 *
 * A common param is included only when the spec's method is in its
 * `allowedMethods`, it is not listed in `omitCommonParams`, and it is not
 * OVERRIDDEN by a same-named entry in `extraRequestParams` (which then wins).
 */
export const resolveRequestParams = (spec: ApiSpec): ResolvedApiParam[] => {
	const omit = new Set(spec.omitCommonParams ?? []);
	const overridden = new Set(spec.extraRequestParams.map((p) => p.name));
	const tokens = pathTokens(spec.path);
	const common: ApiParam[] = COMMON_REQUEST_PARAMS.filter(
		(p) =>
			p.allowedMethods.includes(spec.method) &&
			!omit.has(p.name) &&
			!overridden.has(p.name),
	).map(({ allowedMethods, ...rest }) => rest);
	return [...common, ...spec.extraRequestParams].map((p) => ({
		...p,
		in: deriveLocation(p, spec, tokens),
	}));
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

/**
 * The documented {@link ApiResponseType} matching a sample payload's
 * `response_type_id`, or `undefined` when the spec documents none, the payload
 * carries no id (financial responses often don't), or the id is undocumented.
 *
 * This is what keeps every rendered example in step with the routing table: the
 * annotation beside a sample is looked up, never written twice.
 */
export const responseTypeFor = (
	spec: ApiSpec,
	payload: Record<string, unknown>,
): ApiResponseType | undefined => {
	const id = payload.response_type_id;
	return typeof id === "number"
		? spec.responseTypes?.find((rt) => rt.id === id)
		: undefined;
};

/**
 * Throws if any spec repeats a `response_type_id`, or points `next` at a slug
 * that has no docs page.
 *
 * `knownSlugs` must be the DOCUMENTED slugs (`getAllDocSlugs()`), not every
 * `API_SPECS.slug`: a `next` naming a real-but-undocumented spec would render as
 * dead plain text, which is exactly the silent rot this table exists to replace.
 * Runs at build time via `build-agent-bundle.ts`, alongside `assertRecipeSlugs`.
 */
export const assertResponseTypeSlugs = (
	specs: ApiSpec[],
	knownSlugs: ReadonlySet<string>,
): void => {
	for (const spec of specs) {
		const seen = new Set<number>();
		for (const rt of spec.responseTypes ?? []) {
			if (seen.has(rt.id)) {
				throw new Error(
					`api-specs: spec "${spec.id}" documents response_type_id ${rt.id} twice.`,
				);
			}
			seen.add(rt.id);
			if (rt.next !== undefined && !knownSlugs.has(rt.next)) {
				throw new Error(
					`api-specs: spec "${spec.id}" response_type_id ${rt.id} points next at "${rt.next}", which has no docs page.`,
				);
			}
		}
	}
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
