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
import { EpsClient } from "@ekoindia/eps-sdk";

import { IDENTITY_PARAMS, type ToolDef } from "./tools.js";
import { isAllowed, type TransactCtx } from "./ctx.js";

/** Messages from EpsClient that are safe to relay verbatim: they name params
 * and slugs, never param VALUES (which are PII for verification APIs). */
const SAFE_MESSAGE_PATTERNS = [
	/^Missing required params for /,
	/^Invalid param types for /,
	/^Unknown endpoint slug /,
	/^Unknown environment /,
];

/**
 * Reduce a thrown error to a sanitized MCP tool error payload. Upstream/network
 * messages are replaced with a generic one — raw upstream text can echo request
 * data (names, PAN, account numbers) and must never reach logs or errors.
 *
 * @param err - anything thrown by EpsClient or fetch.
 */
export const sanitizeError = (
	err: unknown,
): { code: string; message: string } => {
	const message = err instanceof Error ? err.message : String(err);
	if (SAFE_MESSAGE_PATTERNS.some((re) => re.test(message)))
		return { code: "VALIDATION", message };
	if (err instanceof Error && err.name === "TimeoutError")
		return { code: "UPSTREAM_TIMEOUT", message: "Eko EPS request timed out." };
	return {
		code: "UPSTREAM_ERROR",
		message: "Eko EPS call failed (network or non-JSON upstream response).",
	};
};

const errorResult = (payload: { code: string; message: string }) => ({
	isError: true,
	content: [{ type: "text" as const, text: JSON.stringify(payload) }],
});

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
			const result = await client.call(
				tool.slug,
				(req.params.arguments ?? {}) as Record<string, unknown>,
			);
			// The upstream response goes back to the authenticated caller — it is
			// their verification result. It is never logged server-side. Minified:
			// the consumer is an LLM, indentation is pure token waste.
			return {
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (err) {
			return errorResult(sanitizeError(err));
		}
	});

	return server;
};
