import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { createInMemoryKV } from "./store/kv";
import { createRedisKV } from "./store/redis";
import { createSecretBox, passThroughSecretBox } from "./store/secretbox";
import { createEkoClient } from "./clients/eko";
import { createZohoClient } from "./clients/zoho";
import { createGitHubClient } from "./clients/github";
import { createSessions } from "./auth/session";
import { createApp } from "./http/app";
import { createSecurityLogger } from "./audit/securityLog";
import { createAccessLogger } from "./audit/accessLog";
import { withStoreErrors } from "./store/storeError";
import type { KV } from "./store/kv";

/**
 * Async bootstrap: selects Redis or in-memory KV, builds SecretBox,
 * connects the store BEFORE serving, and registers graceful shutdown handlers.
 *
 * Throws (→ process.exit(1) via the catch below) if the initial Redis connect
 * fails so we never serve traffic against a dead store.
 */
async function main() {
	const cfg = loadConfig(process.env);

	let kv: KV;
	let readiness: (() => Promise<boolean>) | undefined;
	let closeStore: (() => Promise<void>) | undefined;
	const secretbox = cfg.redisUrl
		? createSecretBox(cfg.kvEncryptionKey!)
		: passThroughSecretBox;

	if (cfg.redisUrl) {
		// Startup-fatal: never serve traffic against a dead store.
		const redis = await createRedisKV(cfg.redisUrl, {
			rejectUnauthorized: cfg.redisTlsRejectUnauthorized,
		});
		kv = redis.kv;
		readiness = redis.ping;
		closeStore = redis.close;
		console.log("[eps-backend] KV backend: redis");
	} else {
		kv = createInMemoryKV();
		console.log("[eps-backend] KV backend: in-memory (single instance)");
	}

	// Wrap the store seam so any outage surfaces as a typed StoreUnavailableError
	// → 503 STORE_UNAVAILABLE (fail-closed by default), uniform across both
	// createApp and createSessions which share this instance.
	kv = withStoreErrors(kv);

	const app = createApp({
		cfg,
		kv,
		secretbox,
		readiness,
		securityLog: createSecurityLogger(),
		accessLog: createAccessLogger(),
		eko: createEkoClient(cfg.eko),
		zoho: createZohoClient(cfg.zoho),
		github: createGitHubClient(cfg.github),
		sessions: createSessions(cfg, kv, { secretbox }),
	});

	const server = serve({ fetch: app.fetch, port: cfg.port }, (info) => {
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
