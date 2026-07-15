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
import { createEkoLogger } from "./audit/ekoLog";
import { withStoreErrors } from "./store/storeError";
import type { KV } from "./store/kv";

/** A fully-wired app plus the config and store lifecycle handles around it. */
export interface BuiltApp {
	app: ReturnType<typeof createApp>;
	/** Configured listen port (Node/VM path only; unused on serverless). */
	port: number;
	/** Closes the store connection; undefined for the in-memory backend. */
	closeStore?: () => Promise<void>;
}

/**
 * Wires config → KV (Redis or in-memory) → clients → sessions → Hono app.
 *
 * Side-effect-free (no `serve`, no signal handlers) so it is shared by both the
 * Node/VM entry (`index.ts`) and the Vercel serverless entry (`api/index.ts`).
 * When `redisUrl` is set the initial connect is awaited and throws on failure,
 * so callers never serve traffic against a dead store.
 *
 * @param env - Process environment to load config from.
 */
export async function buildApp(env: NodeJS.ProcessEnv): Promise<BuiltApp> {
	const cfg = loadConfig(env);

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
		eko: createEkoClient(
			cfg.eko,
			fetch,
			createEkoLogger({ level: cfg.eko.logLevel }),
		),
		zoho: createZohoClient(cfg.zoho),
		github: createGitHubClient(cfg.github),
		sessions: createSessions(cfg, kv, { secretbox }),
	});

	return { app, port: cfg.port, closeStore };
}
