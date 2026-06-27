import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { createInMemoryKV } from "./store/kv";
import { createEkoClient } from "./clients/eko";
import { createZohoClient } from "./clients/zoho";
import { createGitHubClient } from "./clients/github";
import { createSessions } from "./auth/session";
import { createApp } from "./http/app";

const cfg = loadConfig(process.env);
const kv = createInMemoryKV();
const app = createApp({
	cfg,
	kv,
	eko: createEkoClient(cfg.eko),
	zoho: createZohoClient(cfg.zoho),
	github: createGitHubClient(cfg.github),
	sessions: createSessions(cfg, kv),
});

serve({ fetch: app.fetch, port: cfg.port }, (info) => {
	console.log(`[eps-backend] listening on :${info.port}`);
});
