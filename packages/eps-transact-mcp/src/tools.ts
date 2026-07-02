/**
 * Registry-driven MCP tool definitions, generated from the baked agent bundle
 * (the same single source of truth as docs, SDKs, and the context MCP). No
 * hand-written per-API tool code — the tool list can never drift from the specs.
 */
import type { AgentApiDetail, AgentBundle, ApiParam } from "./bundle-types.js";

/** One generated transactional tool. `slug` is the EPS endpoint slug consumed
 * by `EpsClient.call`; `name` is the MCP-facing tool name. */
export interface ToolDef {
	name: string;
	slug: string;
	title: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, Record<string, unknown>>;
		required: string[];
	};
	annotations: {
		readOnlyHint: boolean;
		idempotentHint?: boolean;
		openWorldHint: true;
	};
}

/** Headers the executor (EpsClient) supplies itself: the HMAC auth trio plus
 * content-type. Any OTHER required header on a spec cannot be represented. */
const EXECUTOR_HEADER_NAMES = new Set([
	"developer_key",
	"secret-key",
	"secret-key-timestamp",
	"content-type",
]);

/** Identity params that may be defaulted server-side (headers / env) instead of
 * being provided by the model on every call. */
export const IDENTITY_PARAMS = new Set(["initiator_id", "user_code"]);

/**
 * Endpoints with real side effects (money movement, SMS, sessions, batch
 * enqueues) mapped to what they actually do. Everything else in the exposed
 * set is a pure lookup. Billing alone does NOT make a tool side-effecting —
 * every call is billed; that stays a description concern. These get
 * `readOnlyHint: false` + `idempotentHint: false` and an honest description
 * instead of "Read-only verification".
 */
export const SIDE_EFFECTS: Record<string, string> = {
	"bank-account-verification":
		"Performs a live, non-refundable ₹1 penny-drop to the target account",
	"bulk-bank-account-verification":
		"Enqueues an async penny-drop verification batch",
	"pan-bulk-verify": "Enqueues an async PAN verification batch",
	"mobile-otp-send": "Sends an OTP SMS to the target mobile number",
	"mobile-otp-verify": "Consumes the OTP and advances the verification session",
	"digilocker-create-url": "Creates a DigiLocker consent session",
};

/** One-sentence chaining hints for multi-step flows, appended to descriptions
 * so agents know which tool comes next and which field carries over. Keys are
 * bundle slugs; a test asserts every key exists in the exposed tool set. */
export const FLOW_GUIDANCE: Record<string, string> = {
	"pan-bulk-verify":
		"Then poll eps_pan_bulk_status with the returned reference_id.",
	"pan-bulk-status":
		"Poll step: pass the reference_id returned by eps_pan_bulk_verify.",
	"bulk-bank-account-verification":
		"Then poll eps_bulk_bank_account_verification_status with the returned bulk_reference_id.",
	"bulk-bank-account-verification-status":
		"Poll step: pass the bulk_reference_id returned by eps_bulk_bank_account_verification.",
	"digilocker-create-url":
		"Flow step 1/3: after user consent, call eps_digilocker_get_document with the returned verification_id and reference_id.",
	"digilocker-get-document":
		"Flow step 2/3: pass the verification_id and reference_id from eps_digilocker_create_url.",
	"digilocker-verification-status":
		"Flow step 3/3: pass the reference_id from eps_digilocker_create_url.",
	"mobile-otp-send":
		"Flow step 1/3: then call eps_mobile_otp_verify with the OTP the user received.",
	"mobile-otp-verify":
		"Flow step 2/3: use the same mobile as eps_mobile_otp_send; returns an otp_verification_token.",
	"mobile-otp-validate-token":
		"Flow step 3/3: pass the otp_verification_token returned by eps_mobile_otp_verify.",
};

/**
 * Convert an endpoint slug to an MCP tool name, e.g. "pan-lite" → "eps_pan_lite".
 * Prefixed + underscored: bare slugs like "ip" or "cin" collide/confuse in
 * multi-server MCP clients.
 *
 * @param slug - EPS endpoint slug from the bundle.
 */
export const toToolName = (slug: string): string =>
	`eps_${slug.replace(/-/g, "_")}`;

/** Phase-1 tool surface: verification-category, non-financial endpoints only. */
export const verificationApis = (bundle: AgentBundle): AgentApiDetail[] =>
	bundle.apis.filter((a) => a.category === "verification" && !a.financial);

const JSON_SCHEMA_TYPES = new Set(["string", "number", "integer", "boolean"]);

const scalarTypeOf = (value: unknown): string | undefined => {
	if (typeof value === "string") return "string";
	if (typeof value === "number") return "number";
	if (typeof value === "boolean") return "boolean";
	return undefined;
};

/** Derive an array's `items` schema: from flattened `name[].field` sibling
 * params when the spec has them, else from the shape of the example value. */
const arrayItems = (
	p: ApiParam,
	children: ApiParam[],
): Record<string, unknown> => {
	if (children.length) {
		const properties: Record<string, Record<string, unknown>> = {};
		for (const c of children)
			properties[c.name.slice(p.name.length + 3)] = paramToJsonSchema(c);
		const required = children
			.filter((c) => c.required)
			.map((c) => c.name.slice(p.name.length + 3));
		return { type: "object", properties, required };
	}
	const first = Array.isArray(p.example) ? p.example[0] : undefined;
	if (first !== null && typeof first === "object") {
		const properties: Record<string, Record<string, unknown>> = {};
		for (const [key, value] of Object.entries(first)) {
			const type = scalarTypeOf(value);
			properties[key] = type ? { type } : {};
		}
		return { type: "object", properties };
	}
	const type = scalarTypeOf(first);
	return type ? { type } : {};
};

/**
 * Map one spec request param to a JSON Schema property. Arrays get an `items`
 * shape derived from flattened `name[].field` sibling params or the example;
 * spec types outside the JSON Schema primitive set produce an untyped property
 * (EpsClient still type-checks known params at call time).
 *
 * @param p - resolved request param from the bundle.
 * @param arrayChildren - flattened `p.name[].field` sibling params, if any.
 */
export const paramToJsonSchema = (
	p: ApiParam,
	arrayChildren: ApiParam[] = [],
): Record<string, unknown> => {
	const schema: Record<string, unknown> = {};
	if (JSON_SCHEMA_TYPES.has(p.type)) schema.type = p.type;
	else if (p.type === "array") {
		schema.type = "array";
		schema.items = arrayItems(p, arrayChildren);
	}
	const description = [
		p.description ?? p.label ?? p.name,
		p.example !== undefined ? `Example: ${JSON.stringify(p.example)}` : "",
	]
		.filter(Boolean)
		.join(" ");
	if (description) schema.description = description;
	return schema;
};

/**
 * Build the full transactional tool set from the bundle. Throws at startup if
 * any exposed spec requires a non-auth header — the executor (EpsClient) cannot
 * send arbitrary headers, so shipping such a tool would fail every call.
 * Remediation: extend EpsClient/ctx with explicit header support, then lift
 * the assertion for that header.
 *
 * @param bundle - the baked agent bundle.
 */
export const buildToolDefs = (bundle: AgentBundle): ToolDef[] =>
	verificationApis(bundle).map((api) => {
		const unrepresentable = api.headers.filter(
			(h) => h.required && !EXECUTOR_HEADER_NAMES.has(h.name),
		);
		if (unrepresentable.length)
			throw new Error(
				`Spec "${api.slug}" requires header(s) ${unrepresentable
					.map((h) => h.name)
					.join(", ")} which the transactional executor cannot send. ` +
					`Add header support to the executor before exposing this tool.`,
			);
		// Flattened `entries[].field` params describe array item shapes; fold
		// them into the parent array's `items` instead of top-level properties.
		const topLevel = api.requestParams.filter((p) => !p.name.includes("[]."));
		const childrenOf = (parent: ApiParam): ApiParam[] =>
			api.requestParams.filter((p) => p.name.startsWith(`${parent.name}[].`));
		const properties: Record<string, Record<string, unknown>> = {};
		for (const p of topLevel)
			properties[p.name] = paramToJsonSchema(p, childrenOf(p));
		const required = topLevel.filter((p) => p.required).map((p) => p.name);
		const sideEffect = SIDE_EFFECTS[api.slug];
		const description = [
			api.summary,
			sideEffect
				? `${sideEffect} via Eko EPS (${api.method} ${api.path}).`
				: `Read-only verification via Eko EPS (${api.method} ${api.path}).`,
			"Each successful call is billed per EPS pricing.",
			FLOW_GUIDANCE[api.slug],
		]
			.filter(Boolean)
			.join(" ");
		return {
			name: toToolName(api.slug),
			slug: api.slug,
			title: api.name,
			description,
			inputSchema: { type: "object", properties, required },
			annotations: {
				readOnlyHint: !sideEffect,
				// Meaningful only when readOnlyHint is false (MCP spec); every
				// side-effecting call here does something new (new penny-drop,
				// new SMS, new batch, new session).
				...(sideEffect && { idempotentHint: false }),
				openWorldHint: true,
			},
		};
	});
