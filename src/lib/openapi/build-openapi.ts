/**
 * OpenAPI 3.1 serializer — derives a public, linkable `openapi.json` from the
 * in-repo spec layer (`api-specs.ts` + shared auth/common resolvers).
 *
 * This is a GENERATED ARTIFACT, not a second source of truth: the docs UI
 * renders from the richer `api-specs.ts` resolvers directly, while this doc
 * exists for external tooling and to feed an (optional) embedded API client.
 *
 * Auth note: Eko signs requests with a per-request HMAC `secret-key`, which no
 * OpenAPI `securityScheme` type can express. Until 2026-10 the doc therefore
 * advertised NO scheme (only required header params + prose), so that a
 * generated client would not look authenticated when it cannot sign. That
 * silence made every machine reader (scanners, importers, AI agents) classify
 * the API as unauthenticated and discover the 401 the hard way. The doc now
 * declares an `apiKey` scheme on `developer_key` whose description states the
 * signing requirement explicitly, plus a structured `x-eko-signing` root
 * extension (algorithm, headers, test vector, docs). The header PARAMETERS are
 * kept too — they carry the per-header descriptions. Honesty moved from
 * omission into the description, where tools actually surface it.
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
import {
	API_AUTH_DOCS_URL,
	API_AUTH_INFO,
	API_ENVIRONMENTS,
	AUTH_HEADERS,
} from "@/lib/data/api-auth";
import { API_PARAM_FORMATS } from "@/lib/data/api-formats";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import { resolveShortDescription } from "@/lib/data/endpoint-descriptions";
import type {
	ApiParam,
	ApiSpec,
	ResponseField,
} from "@/lib/data/api-specs-common";
import {
	buildMultipartPayload,
	buildSampleRequest,
	categoryForSpec,
	isMultipart,
	MULTIPART_JSON_FIELD,
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
	responseTypeFor,
	splitMultipartBody,
} from "@/lib/data/api-specs-common";
import {
	CATEGORY_ORDER,
	CATEGORY_TITLES,
	docHrefForSlug,
	type DocCategory,
	endpointSlug,
} from "@/lib/data/docs-registry";
import { markdownTable } from "@/lib/markdown/shared";

/** Loose JSON-schema / OpenAPI object during construction. */
type Json = Record<string, unknown>;

/** OpenAPI vendor extension key carrying the docs route slug. */
const X_DOCS_SLUG = "x-docs-slug";

const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean"]);

/** Map a freeform `ApiParam.type` onto a JSON-Schema scalar type.
 * `"file"` (binary upload) → `type: string, format: binary`. Carries every
 * constraint the spec knows (`pattern` from the format registry, `enum`,
 * `minimum`/`maximum`, `maxLength`) so generated clients and agents can
 * validate before calling, exactly as the SDKs do. */
const paramSchema = (param: ApiParam): Json => {
	const t = param.type.toLowerCase();
	const schema: Json = { type: SCALAR_TYPES.has(t) ? t : "string" };
	if (t === "file") schema.format = "binary";
	if (param.description) schema.description = param.description;
	if (param.example !== undefined && t !== "file")
		schema.example = param.example;
	// `format` names are validated against the registry at build time
	// (assertParamFormats), so a missing entry here would already have failed.
	const format = param.format ? API_PARAM_FORMATS[param.format] : undefined;
	if (format) schema.pattern = format.pattern;
	if (param.enum?.length) schema.enum = param.enum;
	if (param.min !== undefined) schema.minimum = param.min;
	if (param.max !== undefined) schema.maximum = param.max;
	if (param.maxLength !== undefined) schema.maxLength = param.maxLength;
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

/** Split request params into OpenAPI `parameters` vs a JSON-body schema. */
const buildOperationParams = (
	spec: ApiSpec,
): { parameters: Json[]; requestBody?: Json } => {
	const parameters: Json[] = [];

	// Resolve the body first, then the header params.
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

	for (const header of resolveHeaders(spec)) {
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

	if (isMultipart(spec))
		return { parameters, requestBody: multipartBody(spec) };

	const schema: Json = { type: "object", properties: bodyProps };
	if (bodyRequired.length) schema.required = bodyRequired;

	return {
		parameters,
		requestBody: {
			required: true,
			content: {
				"application/json": { schema, example: buildSampleRequest(spec) },
			},
		},
	};
};

/**
 * The multipart request body: ONE `form-data` part holding every non-file field
 * as JSON, plus a binary part per upload.
 *
 * `form-data` is modelled as a plain string, not an object, so the try-it client
 * sends it the way Eko documents it — a text part whose content happens to be
 * JSON. An object property would make OpenAPI label that part
 * `application/json`, which is a different request on the wire. The cost is that
 * the per-field schemas live only in the endpoint's own body-param table.
 */
const multipartBody = (spec: ApiSpec): Json => {
	const { files, fields } = splitMultipartBody(resolveRequestParams(spec));
	const payload = buildMultipartPayload(spec);
	const properties: Json = {
		[MULTIPART_JSON_FIELD]: {
			type: "string",
			description: `JSON object carrying every non-file field: ${fields
				.map((f) => `\`${f.name}\``)
				.join(", ")}.`,
			example: JSON.stringify(payload),
		},
	};
	for (const file of files) properties[file.name] = paramSchema(file);

	return {
		required: true,
		content: {
			"multipart/form-data": {
				schema: {
					type: "object",
					properties,
					required: [
						MULTIPART_JSON_FIELD,
						...files.filter((f) => f.required).map((f) => f.name),
					],
				},
				example: {
					[MULTIPART_JSON_FIELD]: JSON.stringify(payload),
					...Object.fromEntries(files.map((f) => [f.name, f.example])),
				},
			},
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

/** An example's summary, prefixed with what its `response_type_id` means when
 * the spec documents that id. */
const exampleSummary = (
	spec: ApiSpec,
	payload: Record<string, unknown>,
	fallback: string,
): string => {
	const responseType = responseTypeFor(spec, payload);
	return responseType
		? `${responseType.id} — ${responseType.meaning}`
		: fallback;
};

/**
 * The `response_type_id` routing table as GFM, appended to the operation
 * description — OpenAPI viewers render tables there. Undefined when the spec documents
 * no response types.
 */
const responseTypesBlock = (spec: ApiSpec): string | undefined => {
	if (!spec.responseTypes?.length) return undefined;
	return [
		"### Response types",
		"",
		"Branch on `response_type_id` to decide the next call:",
		"",
		markdownTable(
			["response_type_id", "Meaning", "Next step"],
			spec.responseTypes.map((rt) => {
				const href = rt.next ? docHrefForSlug(rt.next) : undefined;
				return [
					String(rt.id),
					rt.meaning,
					href ? `[${rt.next}](${SITE_URL}${href})` : (rt.next ?? "—"),
				];
			}),
		),
	].join("\n");
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
					examples: {
						success: {
							summary: exampleSummary(
								spec,
								spec.sampleSuccessResponse,
								"Successful response",
							),
							value: spec.sampleSuccessResponse,
						},
					},
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
			summary: exampleSummary(spec, scenario.example, scenario.scenario),
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
}

/**
 * Build a complete OpenAPI 3.1 document from the given specs. Callers should
 * pass the documented set (`getDocumentedSpecs()` — active product).
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
	// per path+method, so we group them: the primary spec (non-`-status`
	// preferred) defines the operation and all grouped specs are listed under
	// `x-eko-variants`. Per-variant docs pages still
	// render from `api-specs.ts` directly.
	const groups = new Map<string, ApiSpec[]>();
	for (const spec of specs) {
		const key = `${spec.method} ${spec.path}`;
		const group = groups.get(key);
		if (group) group.push(spec);
		else groups.set(key, [spec]);
	}

	const paths: Json = {};
	for (const group of groups.values()) {
		// Stable-sort non-`-status` specs first so a generic endpoint stays the
		// OpenAPI primary over a status poller that shares its path+method.
		const ordered = [...group].sort(
			(a, b) =>
				Number(a.id.endsWith("-status")) - Number(b.id.endsWith("-status")),
		);
		const [primary] = ordered;
		const { parameters, requestBody } = buildOperationParams(primary);
		const operation: Json = {
			operationId: operationIdFor(primary),
			summary: primary.name,
			// NOTE: for grouped path+method variants only the PRIMARY spec's
			// description and responses appear in the OpenAPI operation
			// (variants are summary-only under `x-eko-variants`). A rich
			// description — or a `responseTypes` table — on a non-primary variant
			// won't reach OpenAPI viewers; its `/docs/<slug>` page still renders both. Keep
			// rich descriptions and response types on the primary spec.
			description: [
				resolveShortDescription(primary) ?? primary.summary,
				responseTypesBlock(primary),
			]
				.filter(Boolean)
				.join("\n\n"),
			tags: [productNameFor(primary)],
			[X_DOCS_SLUG]: endpointSlug(primary),
			parameters,
			responses: buildResponses(primary),
		};
		if (requestBody) operation.requestBody = requestBody;
		if (ordered.length > 1) {
			operation.description = `${operation.description as string}\n\nThis endpoint backs multiple operations selected by request parameters: ${ordered
				.map((s) => s.name)
				.join(", ")}.`;
			operation["x-eko-variants"] = ordered.map((s) => ({
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
				"headers. The `ekoHmac` security scheme identifies the partner key; the",
				"two signing headers are modeled as required header parameters because",
				"no OpenAPI security scheme type can express a per-request HMAC. A",
				"generated client therefore cannot sign on its own — use an EPS SDK or",
				"the `x-eko-signing` recipe at the root of this document. See",
				`${API_AUTH_DOCS_URL}.`,
			].join("\n"),
		},
		// Machine-readable auth. Without a scheme, scanners/importers/agents read
		// the API as unauthenticated (see the header comment). `developer_key` is
		// the only header a plain apiKey scheme can model; the description makes
		// the HMAC requirement explicit so the scheme never implies "key = done".
		components: {
			securitySchemes: {
				ekoHmac: {
					type: "apiKey",
					in: "header",
					name: "developer_key",
					description:
						"Identifies the partner. NOT sufficient on its own: every request must " +
						"also carry `secret-key` = base64(HMAC-SHA256(secret-key-timestamp, " +
						"base64(access_key))) and `secret-key-timestamp` (ms since epoch), " +
						"both sent as headers. Generated clients cannot compute this — use an " +
						"EPS SDK or follow `x-eko-signing`. Known-answer test vector: " +
						`timestamp ${API_AUTH_INFO.testVector.timestamp} with access_key ` +
						`${API_AUTH_INFO.testVector.accessKey} → secret-key ` +
						`${API_AUTH_INFO.testVector.secretKey}. Docs: ${SITE_URL}${API_AUTH_DOCS_URL}`,
				},
			},
		},
		security: [{ ekoHmac: [] }],
		"x-eko-signing": {
			algorithm: "HMAC-SHA256",
			key: "base64(access_key), used as the literal string bytes (do not decode)",
			message: "secret-key-timestamp (current time in ms since epoch, as a string)",
			output: "base64(signature) → `secret-key` header",
			headers: AUTH_HEADERS.filter((h) => h.name !== "content-type").map(
				(h) => h.name,
			),
			steps: [...API_AUTH_INFO.secretKeyGeneration],
			testVector: { ...API_AUTH_INFO.testVector },
			docsUrl: `${SITE_URL}${API_AUTH_DOCS_URL}`,
			backendOnly:
				"access_key is a server-side secret; never sign in a browser or ship it to a client.",
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
		// Group by the product's canonical category. A product maps to a single
		// tag, and a tag must live in exactly one tag group.
		const category = categoryForSpec(spec);
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
