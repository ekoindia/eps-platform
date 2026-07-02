#!/usr/bin/env node
/**
 * HTTP entrypoint: loads the baked bundle and serves the stateless MCP app.
 * Binds 0.0.0.0 inside the container; docker-compose maps it to loopback only
 * (127.0.0.1:8788) — the reverse proxy is the sole public ingress.
 */
import { serve } from "@hono/node-server";

import { loadBundle } from "./load-bundle.js";
import { createApp } from "./http.js";
import { createAccessLogger } from "./accessLog.js";

const main = async () => {
	const { bundle, source } = await loadBundle();
	const app = createApp({ bundle, accessLog: createAccessLogger() });
	const port = Number(process.env.PORT ?? 8788);
	const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
		// Startup line only — never log credentials, bodies, or headers.
		console.error(
			`[eps-transact-mcp] listening on :${port} (bundle ${bundle.meta.bundleVersion}, ${source})`,
		);
	});
	const shutdown = () => {
		server.close(() => process.exit(0));
		// Fallback if in-flight requests wedge the close.
		setTimeout(() => process.exit(0), 5000).unref();
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
};

main().catch((err: unknown) => {
	// Message only: an error at startup can't contain request PII, but keep the
	// habit consistent — no object dumps.
	console.error(
		`[eps-transact-mcp] fatal: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
