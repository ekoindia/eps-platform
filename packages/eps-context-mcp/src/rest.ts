/**
 * REST + OpenAPI face of the context tools, for clients that cannot speak MCP
 * (ChatGPT custom-GPT Actions, Gemini function calling, n8n, …).
 *
 * There is deliberately no second copy of the tools: every request drives a
 * real `createEpsServer` through an in-memory MCP client, so the REST surface
 * is whatever `tools/list` says — same names, same input schemas, same zod
 * validation, same handlers. A tool registered in server.ts shows up here
 * with no change to this file.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

/** GPT Actions rejects operation descriptions longer than this. */
export const MAX_DESCRIPTION = 300;

/**
 * Hand-shortened descriptions for tools whose MCP description is too long for
 * OpenAPI consumers. Hand-written, not sliced: blind truncation would cut the
 * safety instructions these tools carry.
 */
const REST_DESCRIPTIONS: Record<string, string> = {
	debug_auth:
		"Diagnose a 403 from an EPS API. Returns a known-answer HMAC test vector, " +
		"ranked causes, and checks on an optional failing timestamp + secret_key. " +
		"NEVER send an access_key: it is a server-side secret and there is no " +
		"parameter for it.",
	get_sdk:
		"Everything needed to integrate one EPS SDK: install, config, every " +
		"public method/type, error contract and a worked call() example. Signing " +
		"is built in, so never hand-roll the HMAC secret-key when an SDK exists.",
	get_api:
		"Full detail for one endpoint by slug: params, headers, sample request, " +
		"response fields + sample, errorScenarios, responseTypes ({id, meaning, " +
		"next} = which endpoint to call per response_type_id) and financial " +
		"(money-moving: never retry blind; inquire by client_ref_id).",
	// Fits, but the MCP text tells the user to re-run via npx — wrong over REST.
	get_meta:
		"Bundle org/version, data source and this server's package version, " +
		"including whether a newer release is available.",
};

/** Only read-only tools are published anonymously over REST; a future tool
 * with side effects must not leak here just by being registered. */
export const isPublicTool = (tool: Tool): boolean =>
	tool.annotations?.readOnlyHint === true;

/**
 * Run `fn` against a fresh server over an in-memory MCP pair, then tear both
 * ends down. Closes are independent so one failing never leaks the other.
 */
export const withClient = async <T>(
	server: McpServer,
	fn: (client: Client) => Promise<T>,
): Promise<T> => {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "eps-context-rest", version: "1" });
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		return await fn(client);
	} finally {
		await client.close().catch(() => {});
		await server.close().catch(() => {});
	}
};

/** The published description for a tool: override, else its own if it fits. */
export const restDescription = (tool: Tool): string =>
	REST_DESCRIPTIONS[tool.name] ?? tool.description ?? tool.title ?? tool.name;

/**
 * OpenAPI 3.1 document: one `POST /tools/{name}` per public tool, the tool's
 * JSON-Schema input as the request body.
 *
 * @param tools - `tools/list` output (non-public tools are dropped here).
 * @param serverUrl - absolute base the paths hang off, e.g. `https://mcp.eko.in/context`.
 * @param version - bundle version, surfaced as `info.version`.
 */
export const toOpenApi = (
	tools: Tool[],
	serverUrl: string,
	version: string,
) => ({
	openapi: "3.1.0",
	info: {
		title: "EPS context tools",
		version,
		description:
			"Read-only lookups over Eko Platform Services (EPS) API documentation: " +
			"endpoints, recipes, FAQs, SDKs, signing. Same tools as the MCP server " +
			"at /mcp. No auth.",
	},
	servers: [{ url: serverUrl }],
	paths: Object.fromEntries(
		tools.filter(isPublicTool).map((tool) => [
			`/tools/${tool.name}`,
			{
				post: {
					operationId: tool.name,
					summary: tool.title ?? tool.name,
					description: restDescription(tool),
					requestBody: {
						required: false,
						content: { "application/json": { schema: tool.inputSchema } },
					},
					responses: {
						"200": {
							description: "Tool result (JSON).",
							content: { "application/json": { schema: {} } },
						},
						"400": { description: "Invalid arguments." },
						"404": {
							description:
								"Unknown tool, or the looked-up item does not exist.",
						},
					},
				},
			},
		]),
	),
});

/**
 * HTTP status for a tool result. Structured first (`_meta.httpStatus`, set by
 * server.ts's notFound), then the SDK's own input-validation prefix; any other
 * error is a handler fault → 500. A test pins the SDK prefix.
 */
export const restStatus = (result: CallToolResult): 200 | 400 | 404 | 500 => {
	if (!result.isError) return 200;
	const status = result._meta?.httpStatus;
	if (status === 404 || status === 400) return status;
	const text = result.content[0]?.type === "text" ? result.content[0].text : "";
	// -32602 = InvalidParams, raised only by the SDK's own zod validation.
	return /^MCP error -32602: Input validation error/.test(text) ? 400 : 500;
};

/**
 * Response body for a successful tool result: `structuredContent` if present,
 * else a single text block parsed as JSON (or `{ text }` when it isn't JSON,
 * e.g. get_signing_snippet), else the raw content array.
 */
export const toRestBody = (result: CallToolResult): unknown => {
	if (result.structuredContent) return result.structuredContent;
	const [only, ...rest] = result.content;
	if (only?.type !== "text" || rest.length) return { content: result.content };
	try {
		return JSON.parse(only.text);
	} catch {
		return { text: only.text };
	}
};
