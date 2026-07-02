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
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, Record<string, unknown>>;
		required: string[];
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

/**
 * Map one spec request param to a JSON Schema property. Spec types outside the
 * JSON Schema primitive set produce an untyped property (EpsClient still
 * type-checks known params at call time).
 *
 * @param p - resolved request param from the bundle.
 */
export const paramToJsonSchema = (p: ApiParam): Record<string, unknown> => {
	const schema: Record<string, unknown> = {};
	if (JSON_SCHEMA_TYPES.has(p.type)) schema.type = p.type;
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
		const properties: Record<string, Record<string, unknown>> = {};
		for (const p of api.requestParams)
			properties[p.name] = paramToJsonSchema(p);
		const required = api.requestParams
			.filter((p) => p.required)
			.map((p) => p.name);
		return {
			name: toToolName(api.slug),
			slug: api.slug,
			description:
				`${api.summary} Read-only verification via Eko EPS ` +
				`(${api.method} ${api.path}). Each successful call is billed per EPS pricing.`,
			inputSchema: { type: "object", properties, required },
		};
	});
