/**
 * Remote (streamable HTTP) transport: a stateless Hono app. Every POST /mcp
 * carries partner credentials in headers; a fresh MCP Server + transport pair
 * is built per request and torn down with it. Nothing is persisted; request
 * bodies, headers, and upstream responses are never logged.
 */
import { createHash } from "node:crypto";
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { AgentBundle } from "./bundle-types.js";
import { buildToolDefs } from "./tools.js";
import { createTransactServer } from "./server.js";
import { parseAllowed, parseEnvironment, type TransactCtx } from "./ctx.js";
import { requestId, type AppEnv } from "./requestId.js";
import { noopAccessLogger, type AccessLogger } from "./accessLog.js";
import { withTimeout } from "./fetchTimeout.js";

/** Abuse-throttling defaults: paid upstream calls, so keep a lid on runaways.
 * NOT an enforcement boundary — in-memory, per-process, resets on restart. */
export const RL_LIMIT = 60;
export const RL_WINDOW_SEC = 600;

export interface HttpDeps {
	bundle: AgentBundle;
	/** Upstream fetch for EpsClient; tests inject a mock. Wrapped with a
	 * timeout so a hung Eko upstream can't pin sockets. */
	fetch?: typeof fetch;
	now?: () => number;
	accessLog?: AccessLogger;
	/** Override throttle numbers, or `false` to disable (tests). */
	rateLimit?: { limit: number; windowSec: number } | false;
}

/** JSON-RPC-shaped HTTP-layer error (auth/validation happens before the MCP
 * transport exists, so we mimic the envelope clients expect). */
const rpcError = (code: number, message: string) => ({
	jsonrpc: "2.0" as const,
	error: { code, message },
	id: null,
});

/**
 * Extract the MCP method + tool name from a request body clone, for the access
 * log only. Guarded: malformed JSON, batches, and non-tool calls all yield
 * undefined. Never returns arguments or any other body content.
 *
 * @param raw - a CLONE of the request (the original body stream must stay
 * unread for the MCP transport).
 */
export const extractToolName = async (
	raw: Request,
): Promise<string | undefined> => {
	try {
		const body: unknown = await raw.json();
		if (typeof body !== "object" || body === null || Array.isArray(body))
			return undefined;
		const rpc = body as { method?: unknown; params?: { name?: unknown } };
		if (rpc.method !== "tools/call") return undefined;
		return typeof rpc.params?.name === "string" ? rpc.params.name : undefined;
	} catch {
		return undefined;
	}
};

/**
 * Build the Hono app. Pure DI like eps-backend's createApp: no environment
 * reads, no I/O at construction beyond deriving tool defs from the bundle.
 *
 * @param deps - bundle + injectable fetch/clock/logger/throttle.
 */
export const createApp = (deps: HttpDeps) => {
	const tools = buildToolDefs(deps.bundle);
	const accessLog = deps.accessLog ?? noopAccessLogger;
	const upstreamFetch = withTimeout(deps.fetch ?? fetch);
	const rl = deps.rateLimit ?? { limit: RL_LIMIT, windowSec: RL_WINDOW_SEC };
	// ponytail: in-memory fixed window, single container; move to a shared KV
	// (like eps-backend's enforceRateLimit) if this ever runs multi-instance.
	const windows = new Map<string, { count: number; resetAt: number }>();
	const nowMs = deps.now ?? Date.now;

	const overLimit = (key: string): boolean => {
		if (rl === false) return false;
		const t = nowMs();
		const w = windows.get(key);
		if (!w || t >= w.resetAt) {
			windows.set(key, { count: 1, resetAt: t + rl.windowSec * 1000 });
			return false;
		}
		w.count += 1;
		return w.count > rl.limit;
	};

	const app = new Hono<AppEnv>();
	app.use(requestId());
	app.use(async (c, next) => {
		const start = nowMs();
		try {
			await next();
		} finally {
			if (c.req.path !== "/healthz")
				accessLog.log({
					rid: c.get("rid") ?? "rid-unavailable",
					method: c.req.method,
					path: c.req.path,
					status: c.res?.status ?? 500,
					durMs: nowMs() - start,
					ip: c.req.header("x-real-ip") ?? "",
					...(c.get("toolName") && { tool: c.get("toolName") }),
				});
		}
	});

	app.get("/healthz", (c) =>
		c.json({
			ok: true,
			bundleVersion: deps.bundle.meta.bundleVersion,
			tools: tools.length,
		}),
	);

	app.post("/mcp", async (c) => {
		const developerKey = c.req.header("x-eko-developer-key");
		const accessKey = c.req.header("x-eko-access-key");
		if (!developerKey || !accessKey)
			return c.json(
				rpcError(
					-32001,
					"Missing X-Eko-Developer-Key and/or X-Eko-Access-Key header.",
				),
				401,
			);
		const allowed = parseAllowed(c.req.header("x-eko-allowed-apis"));
		if (!allowed)
			return c.json(
				rpcError(
					-32602,
					'Missing or empty X-Eko-Allowed-Apis header. Send a comma-separated list of tool names, or "*" to allow all verification tools. This is deliberate: EPS calls are billed.',
				),
				400,
			);
		const environment = parseEnvironment(c.req.header("x-eko-env"));
		if (!environment)
			return c.json(
				rpcError(
					-32602,
					'Invalid X-Eko-Env header. Use "uat" (default) or "production".',
				),
				400,
			);
		// Throttle AFTER auth-header presence (401 wins) and per env+key, so UAT
		// experiments can't starve production traffic on the same key.
		const rlKey = `${environment}:${createHash("sha256")
			.update(developerKey)
			.digest("hex")}`;
		if (overLimit(rlKey))
			return c.json(
				rpcError(-32000, "Rate limit exceeded for this developer key."),
				429,
			);

		// Tool name for the access log, from a CLONE — the original body stream
		// must remain unread for the transport.
		c.set("toolName", await extractToolName(c.req.raw.clone()));

		const ctx: TransactCtx = {
			developerKey,
			accessKey,
			environment,
			allowed,
			initiatorId: c.req.header("x-eko-initiator-id"),
			userCode: c.req.header("x-eko-user-code"),
			fetch: upstreamFetch,
			...(deps.now && { now: deps.now }),
		};
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined, // stateless: no session to manage
			enableJsonResponse: true,
		});
		const server = createTransactServer(
			tools,
			ctx,
			deps.bundle.meta.bundleVersion,
		);
		await server.connect(transport);
		return transport.handleRequest(c.req.raw);
	});

	// Stateless POST-only per MCP streamable-HTTP spec (server MAY omit the GET
	// SSE stream); DELETE is meaningless without sessions.
	app.on(["GET", "DELETE"], "/mcp", (c) => {
		c.header("Allow", "POST");
		return c.json(rpcError(-32000, "Method not allowed. POST only."), 405);
	});

	return app;
};
