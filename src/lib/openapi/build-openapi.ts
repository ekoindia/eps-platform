/**
 * OpenAPI 3.1 serializer — derives a public, linkable `openapi.json` from the
 * in-repo spec layer (`api-specs.ts` + shared auth/common resolvers).
 *
 * This is a GENERATED ARTIFACT, not a second source of truth: the docs UI
 * renders from the richer `api-specs.ts` resolvers directly, while this doc
 * exists for external tooling and to feed an (optional) embedded API client.
 *
 * Auth note: Eko signs requests with a per-request HMAC `secret-key`, which an
 * OpenAPI `securityScheme` cannot express faithfully. We therefore model the
 * auth headers as explicit required header PARAMETERS plus a prose description,
 * and intentionally do NOT advertise a security scheme that would imply a
 * generated client can authenticate on its own.
 *
 * Pure + deterministic (no I/O, no Date) so it unit-tests cleanly and produces
 * byte-stable output for a given spec set.
 *
 * Schemas are assembled as plain JSON objects (the `openapi-types` 3.0/3.1
 * unions are too strict for incremental construction); the finished document is
 * cast to `OpenAPIV3_1.Document` at the boundary.
 */
import type { OpenAPIV3_1 } from "openapi-types";

import {
	API_DEFAULT_VERSION,
	SITE_ORG_NAME,
	SITE_URL,
} from "@/lib/config/site";
import { API_AUTH_DOCS_URL, API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import type {
	ApiParam,
	ApiSpec,
	ResponseField,
} from "@/lib/data/api-specs-common";
import {
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
} from "@/lib/data/api-specs-common";
import {
	CATEGORY_ORDER,
	CATEGORY_TITLES,
	type DocCategory,
	endpointSlug,
} from "@/lib/data/docs-registry";

/** Loose JSON-schema / OpenAPI object during construction. */
type Json = Record<string, unknown>;

/** OpenAPI vendor extension key carrying the docs route slug. */
const X_DOCS_SLUG = "x-docs-slug";

const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean"]);

/** Map a freeform `ApiParam.type` onto a JSON-Schema scalar type. */
const paramSchema = (param: ApiParam): Json => {
	const t = param.type.toLowerCase();
	const schema: Json = { type: SCALAR_TYPES.has(t) ? t : "string" };
	if (param.description) schema.description = param.description;
	if (param.example !== undefined) schema.example = param.example;
	return schema;
};

/** Recursively convert a response-field tree into a JSON schema. */
const responseFieldSchema = (field: ResponseField): Json => {
	const base: Json = {};
	if (field.description) base.description = field.description;
	if (field.example !== undefined) base.example = field.example;

	switch (field.type) {
		case "object":
			return { ...base, type: "object", ...childrenToObject(field.children) };
		case "array":
			return {
				...base,
				type: "array",
				items: field.children
					? { type: "object", ...childrenToObject(field.children) }
					: {},
			};
		default:
			return { ...base, type: field.type };
	}
};

const childrenToObject = (children?: ResponseField[]): Json => {
	if (!children?.length) return {};
	const properties: Json = {};
	for (const child of children)
		properties[child.name] = responseFieldSchema(child);
	return { properties };
};

/** Tooling-friendly operationId (camelCase of the kebab-case spec id). */
export const operationIdFor = (spec: Pick<ApiSpec, "id">): string =>
	spec.id.replace(/[-_]+(.)?/g, (_, c: string | undefined) =>
		c ? c.toUpperCase() : "",
	);

const productNameFor = (spec: ApiSpec): string =>
	ACTIVE_PRODUCTS_MAP[spec.productId]?.name ?? spec.productId;

/**
 * Auth headers that the interactive (Scalar) client supplies itself: the signing
 * headers are injected by the `beforeRequest` plugin and `developer_key` /
 * `access_key` are modeled as apiKey security schemes — so they are omitted from
 * the interactive operation's header parameters to avoid duplicate inputs.
 */
const INTERACTIVE_SIGNING_HEADERS = new Set([
	"developer_key",
	"secret-key",
	"secret-key-timestamp",
]);

/** Split request params into OpenAPI `parameters` vs a JSON-body schema. */
const buildOperationParams = (
	spec: ApiSpec,
	interactive: boolean,
): { parameters: Json[]; requestBody?: Json } => {
	const parameters: Json[] = [];

	// Resolve the body first so we know whether to keep the `content-type` header
	// param (Scalar derives it from the JSON body when a request body exists).
	const bodyProps: Json = {};
	const bodyRequired: string[] = [];
	const nonBodyParams: Json[] = [];
	for (const param of resolveRequestParams(spec)) {
		if (param.in === "body") {
			bodyProps[param.name] = paramSchema(param);
			if (param.required) bodyRequired.push(param.name);
		} else {
			nonBodyParams.push({
				name: param.name,
				in: param.in,
				required: param.in === "path" ? true : param.required,
				description: param.description,
				schema: paramSchema(param),
			});
		}
	}
	const hasBody = Object.keys(bodyProps).length > 0;

	for (const header of resolveHeaders()) {
		if (interactive) {
			if (INTERACTIVE_SIGNING_HEADERS.has(header.name)) continue;
			if (header.name === "content-type" && hasBody) continue;
		}
		parameters.push({
			name: header.name,
			in: "header",
			required: header.required,
			description: header.description,
			schema: paramSchema(header),
		});
	}

	parameters.push(...nonBodyParams);

	if (!hasBody) return { parameters };

	const schema: Json = { type: "object", properties: bodyProps };
	if (bodyRequired.length) schema.required = bodyRequired;

	return {
		parameters,
		requestBody: {
			required: true,
			content: { "application/json": { schema, example: spec.sampleRequest } },
		},
	};
};

const exampleKey = (scenario: string, existing: Json): string => {
	const base =
		scenario
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "") || "error";
	let key = base;
	let i = 2;
	while (key in existing) key = `${base}_${i++}`;
	return key;
};

const buildResponses = (spec: ApiSpec): Json => {
	const successSchema: Json = {
		type: "object",
		...childrenToObject(resolveResponseFields(spec)),
	};

	const responses: Json = {
		"200": {
			description: "Successful response.",
			content: {
				"application/json": {
					schema: successSchema,
					examples: { success: { value: spec.sampleSuccessResponse } },
				},
			},
		},
	};

	for (const scenario of spec.errorScenarios ?? []) {
		const code = String(scenario.statusCode ?? 200);
		const existing = responses[code] as Json | undefined;
		const media = (existing?.content as Json | undefined)?.[
			"application/json"
		] as Json | undefined;
		const examples: Json = { ...((media?.examples as Json) ?? {}) };
		examples[exampleKey(scenario.scenario, examples)] = {
			summary: scenario.scenario,
			value: scenario.example,
		};

		if (media) {
			media.examples = examples;
		} else {
			responses[code] = {
				description:
					code === "200" ? "Business-level error." : scenario.scenario,
				content: { "application/json": { examples } },
			};
		}
	}

	return responses;
};

export interface BuildOpenApiOptions {
	/** Override the document version (defaults to the site API version). */
	version?: string;
	/**
	 * Emit a variant tuned for the embedded Scalar "Try it" client: model
	 * `developer_key` / `access_key` as apiKey security schemes (so the modal
	 * renders auth fields) and drop the signing headers from operation params
	 * (the `beforeRequest` plugin injects them). The public `openapi.json` is
	 * built WITHOUT this flag and stays byte-stable.
	 */
	interactive?: boolean;
}

/** apiKey header security schemes used only by the interactive client. */
const INTERACTIVE_SECURITY_SCHEMES: Json = {
	developerKey: {
		type: "apiKey",
		in: "header",
		name: "developer_key",
		description: "Your UAT/sandbox developer key, sent on every request.",
	},
	accessKey: {
		type: "apiKey",
		in: "header",
		name: "access_key",
		description:
			"Your UAT/sandbox access key. Used only to compute the per-request " +
			"HMAC signature locally in your browser; it is stripped before the " +
			"request is sent and never leaves your machine.",
	},
};

/** Per-operation requirement: both keys (AND) for the interactive client. */
const INTERACTIVE_OPERATION_SECURITY: Json[] = [
	{ developerKey: [], accessKey: [] },
];

/**
 * Build a complete OpenAPI 3.1 document from the given specs. Callers should
 * pass the documented set (`getDocumentedSpecs()` — active product, non
 * `-status`).
 */
export const buildOpenApiDocument = (
	specs: ApiSpec[],
	options: BuildOpenApiOptions = {},
): OpenAPIV3_1.Document => {
	// Guard: operationId collisions (case-insensitive) would corrupt tooling.
	const seenOps = new Map<string, string>();
	for (const spec of specs) {
		const op = operationIdFor(spec).toLowerCase();
		const prior = seenOps.get(op);
		if (prior) {
			throw new Error(
				`build-openapi: operationId collision "${operationIdFor(spec)}" from specs "${prior}" and "${spec.id}".`,
			);
		}
		seenOps.set(op, spec.id);
	}

	// Some endpoints back several logical operations on the SAME path+method,
	// discriminated by a request-body field (e.g. the four AePS operations on
	// POST /customer/collection/aeps-fingpay). OpenAPI permits only one operation
	// per path+method, so we group them: the first spec defines the operation and
	// the rest are listed under `x-eko-variants`. Per-variant docs pages still
	// render from `api-specs.ts` directly.
	const groups = new Map<string, ApiSpec[]>();
	for (const spec of specs) {
		const key = `${spec.method} ${spec.path}`;
		const group = groups.get(key);
		if (group) group.push(spec);
		else groups.set(key, [spec]);
	}

	const interactive = options.interactive ?? false;
	const paths: Json = {};
	for (const group of groups.values()) {
		const [primary] = group;
		const { parameters, requestBody } = buildOperationParams(
			primary,
			interactive,
		);
		const operation: Json = {
			operationId: operationIdFor(primary),
			summary: primary.name,
			description: primary.description ?? primary.summary,
			tags: [productNameFor(primary)],
			[X_DOCS_SLUG]: endpointSlug(primary),
			parameters,
			responses: buildResponses(primary),
		};
		if (requestBody) operation.requestBody = requestBody;
		if (interactive) operation.security = INTERACTIVE_OPERATION_SECURITY;
		if (group.length > 1) {
			operation.description = `${operation.description as string}\n\nThis endpoint backs multiple operations selected by request parameters: ${group
				.map((s) => s.name)
				.join(", ")}.`;
			operation["x-eko-variants"] = group.map((s) => ({
				operationId: operationIdFor(s),
				name: s.name,
				slug: endpointSlug(s),
				summary: s.summary,
			}));
		}

		const pathItem = (paths[primary.path] ??= {}) as Json;
		pathItem[primary.method.toLowerCase()] = operation;
	}

	const { tags, tagGroups } = buildTagging(specs);

	const doc: Json = {
		openapi: "3.1.0",
		info: {
			title: `${SITE_ORG_NAME} REST API`,
			version: options.version ?? API_DEFAULT_VERSION,
			description: [
				"Public reference for Eko's REST APIs.",
				"",
				"**Authentication.** Every request carries `developer_key`, a per-request",
				"`secret-key` (an HMAC-SHA256 signature), and `secret-key-timestamp`",
				"headers. These",
				"are modeled as required header parameters, not a security scheme — a",
				`generated client cannot sign requests on its own. See ${API_AUTH_DOCS_URL}.`,
			].join("\n"),
		},
		servers: [
			{
				url: API_ENVIRONMENTS.sandbox.baseUrl,
				description: API_ENVIRONMENTS.sandbox.label,
			},
			{
				url: API_ENVIRONMENTS.production.baseUrl,
				description: API_ENVIRONMENTS.production.label,
			},
		],
		tags,
		paths,
		externalDocs: { url: `${SITE_URL}/docs`, description: "Developer docs" },
	};
	if (tagGroups.length) doc["x-tagGroups"] = tagGroups;
	if (interactive) {
		doc.components = { securitySchemes: INTERACTIVE_SECURITY_SCHEMES };
	}

	return doc as unknown as OpenAPIV3_1.Document;
};

interface TagGroup {
	name: string;
	tags: string[];
}

/** Tags = product names; x-tagGroups = categories (in canonical order). */
const buildTagging = (
	specs: ApiSpec[],
): { tags: Json[]; tagGroups: TagGroup[] } => {
	const byCategory = new Map<DocCategory, string[]>();
	const tagDescription = new Map<string, string>();

	for (const spec of specs) {
		const productName = productNameFor(spec);
		// Group by the product's canonical category, not the per-spec category. A
		// product maps to a single tag, and a tag must live in exactly one tag group;
		// using spec.category would push one product (e.g. DMT, whose Aadhaar-eKYC
		// specs are `verification` while the rest are `bc`) into two groups, rendering
		// it twice in the Scalar sidebar. Fall back to spec.category for unknown
		// products.
		const category =
			ACTIVE_PRODUCTS_MAP[spec.productId]?.category ?? spec.category;
		const list = byCategory.get(category) ?? [];
		if (!list.includes(productName)) {
			list.push(productName);
			byCategory.set(category, list);
		}
		if (!tagDescription.has(productName)) {
			tagDescription.set(
				productName,
				ACTIVE_PRODUCTS_MAP[spec.productId]?.shortDesc ?? "",
			);
		}
	}

	const tags: Json[] = [];
	const tagGroups: TagGroup[] = [];
	for (const category of CATEGORY_ORDER) {
		const products = byCategory.get(category);
		if (!products?.length) continue;
		tagGroups.push({ name: CATEGORY_TITLES[category], tags: products });
		for (const name of products) {
			const description = tagDescription.get(name);
			tags.push(description ? { name, description } : { name });
		}
	}
	return { tags, tagGroups };
};
