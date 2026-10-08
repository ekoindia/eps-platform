/**
 * MCP server core: wires the generated tool defs to real EPS calls through
 * @ekoindia/eps-sdk's EpsClient (HMAC signing, validation, encoding — all
 * spec-driven from the same bundle build).
 */
// Low-level Server (not McpServer): tools here are data-generated with plain
// JSON Schema inputs; McpServer.registerTool only accepts Zod schemas. The SDK
// deprecation note keeps Server supported "for advanced use cases" — this one.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EpsClient, EpsHttpError } from "@ekoindia/eps-sdk";

import { ENVELOPE_OUTPUT_SCHEMA, IDENTITY_PARAMS, type ToolDef } from "./tools.js";
import { hasCredentials, isAllowed, type TransactCtx } from "./ctx.js";

/** Messages from EpsClient that are safe to relay verbatim: they name params
 * and slugs, never param VALUES (which are PII for verification APIs). */
const SAFE_MESSAGE_PATTERNS = [
	/^Missing required params for /,
	/^Invalid param types for /,
	// Reasons are "not one of: …", "expected format pan", "below min 1",
	// "longer than 20 bytes" — constraint text, never the submitted value.
	/^Invalid param values for /,
	/^Unknown endpoint slug /,
	/^Unknown environment /,
];

/** What an agent should do with a non-2xx from EPS, by status. The upstream
 * body is deliberately NOT relayed: it can echo request data (PII). */
const httpHint = (status: number): string => {
	if (status === 403)
		return (
			"EPS rejected the request (HTTP 403): wrong or stale secret-key / " +
			"secret-key-timestamp, wrong developer_key, inactive key, or IP not " +
			"allow-listed. Do not retry blindly — run the context MCP debug_auth " +
			"tool (secret-free) to rank the likely causes."
		);
	if (status === 404 || status === 405 || status === 415)
		return `EPS returned HTTP ${status}: wrong path, method or content-type for this endpoint. Check the API definition; do not retry unchanged.`;
	if (status === 429 || status >= 500)
		return `EPS returned HTTP ${status}: outcome unknown. For read-only lookups back off and retry; for anything billed or side-effecting, verify before retrying.`;
	return `EPS returned HTTP ${status}.`;
};

/**
 * Reduce a thrown error to a sanitized MCP tool error payload. Upstream/network
 * messages are replaced with a generic one — raw upstream text can echo request
 * data (names, PAN, account numbers) and must never reach logs or errors.
 *
 * @param err - anything thrown by EpsClient or fetch.
 */
export const sanitizeError = (
	err: unknown,
): { code: string; message: string; status?: number } => {
	const message = err instanceof Error ? err.message : String(err);
	if (SAFE_MESSAGE_PATTERNS.some((re) => re.test(message)))
		return { code: "VALIDATION", message };
	if (err instanceof EpsHttpError)
		return {
			code: `HTTP_${err.status}`,
			status: err.status,
			message: httpHint(err.status),
		};
	if (err instanceof Error && err.name === "TimeoutError")
		return { code: "UPSTREAM_TIMEOUT", message: "Eko EPS request timed out." };
	return {
		code: "UPSTREAM_ERROR",
		message: "Eko EPS call failed (network or non-JSON upstream response).",
	};
};

const errorResult = (payload: Record<string, unknown>) => ({
	isError: true,
	content: [{ type: "text" as const, text: JSON.stringify(payload) }],
});

/** The EPS envelope fields a business-failure result is built from. */
type Envelope = {
	status?: unknown;
	message?: unknown;
	response_type_id?: unknown;
};

/**
 * A 2xx whose envelope `status` is non-zero is a business failure (wrong OTP,
 * user not found, limit exhausted…). It is reported as an MCP error so the
 * agent never mistakes it for success, with the documented `next` step when
 * the endpoint maps that `response_type_id`. The envelope itself is included:
 * it is the caller's own verification result (same as on the success path).
 */
const businessFailure = (tool: ToolDef, envelope: Envelope) => {
	const status = envelope.status as number;
	const typeId =
		typeof envelope.response_type_id === "number"
			? envelope.response_type_id
			: undefined;
	const route =
		typeId !== undefined
			? tool.responseTypes.find((r) => r.id === typeId)
			: undefined;
	return errorResult({
		code: `BUSINESS_${status}`,
		status,
		...(typeId !== undefined && { response_type_id: typeId }),
		message:
			typeof envelope.message === "string"
				? envelope.message
				: `EPS returned status ${status}.`,
		...(route?.meaning && { meaning: route.meaning }),
		...(route?.next && { next: route.next }),
		envelope,
	});
};

/**
 * Build an MCP Server bound to one caller's context. Stateless by design:
 * the HTTP transport constructs one per request; stdio constructs one per
 * process. Tool defs are shared (immutable); only ctx varies.
 *
 * @param tools - generated tool defs (buildToolDefs output).
 * @param ctx - caller credentials + environment + allowlist.
 * @param version - reported MCP server version (bundle version).
 */
export const createTransactServer = (
	tools: ToolDef[],
	ctx: TransactCtx,
	version: string,
): Server => {
	const server = new Server(
		{ name: "eps-transact-mcp", version },
		{ capabilities: { tools: {} } },
	);

	const visibleTools = tools.filter((t) => isAllowed(ctx, t.name));

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: visibleTools.map((t) => ({
			name: t.name,
			title: t.title,
			description: t.description,
			annotations: t.annotations,
			outputSchema: ENVELOPE_OUTPUT_SCHEMA,
			// Identity params covered by a server-side default are demoted from
			// `required` so schema-validating hosts don't force the model to
			// invent them; EpsClient still enforces presence after merging.
			inputSchema: {
				...t.inputSchema,
				required: t.inputSchema.required.filter(
					(name) =>
						!(
							IDENTITY_PARAMS.has(name) &&
							((name === "initiator_id" && ctx.initiatorId !== undefined) ||
								(name === "user_code" && ctx.userCode !== undefined))
						),
				),
			},
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (req) => {
		const tool = tools.find((t) => t.name === req.params.name);
		if (!tool)
			return errorResult({
				code: "UNKNOWN_TOOL",
				message: `Unknown tool "${req.params.name}".`,
			});
		// Guard BEFORE constructing EpsClient: stdio mode can start without
		// credentials so tools still list, but a call must never sign or reach the
		// network without them.
		if (!hasCredentials(ctx))
			return errorResult({
				code: "MISSING_CREDENTIALS",
				message:
					"Set EKO_DEVELOPER_KEY and EKO_ACCESS_KEY in your environment and restart the agent to run verifications. See the eps-verify skill.",
			});
		if (!isAllowed(ctx, tool.name))
			return errorResult({
				code: "TOOL_NOT_ALLOWED",
				message: `Tool "${tool.name}" is not in this connection's X-Eko-Allowed-Apis allowlist.`,
			});
		const client = new EpsClient({
			developerKey: ctx.developerKey,
			accessKey: ctx.accessKey,
			environment: ctx.environment,
			...(ctx.initiatorId !== undefined && { initiatorId: ctx.initiatorId }),
			...(ctx.userCode !== undefined && { userCode: ctx.userCode }),
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.now && { now: ctx.now }),
		});
		try {
			const result = (await client.call(
				tool.slug,
				(req.params.arguments ?? {}) as Record<string, unknown>,
			)) as Envelope & Record<string, unknown>;
			if (typeof result.status === "number" && result.status !== 0)
				return businessFailure(tool, result);
			// The upstream response goes back to the authenticated caller — it is
			// their verification result. It is never logged server-side. Minified:
			// the consumer is an LLM, indentation is pure token waste.
			// structuredContent is required once outputSchema is declared.
			return {
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
				structuredContent: result,
			};
		} catch (err) {
			return errorResult(sanitizeError(err));
		}
	});

	return server;
};
