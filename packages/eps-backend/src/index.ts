import { serve } from "@hono/node-server";
import { buildApp } from "./buildApp";

/**
 * Node/VM entrypoint: builds the app (fatal on initial Redis connect failure),
 * serves it, and registers graceful shutdown handlers. The serverless path uses
 * `buildApp` directly from `api/index.ts` instead of this file.
 */
async function main() {
	const { app, port, closeStore } = await buildApp(process.env);

	const server = serve({ fetch: app.fetch, port }, (info) => {
		console.log(`[eps-backend] listening on :${info.port}`);
	});

	function shutdown() {
		console.log("[eps-backend] shutting down");
		server.close(async () => {
			if (closeStore) await closeStore().catch(() => {});
			process.exit(0);
		});
	}

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

main().catch((err) => {
	console.error("[eps-backend] fatal startup error", err);
	process.exit(1);
});
