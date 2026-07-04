import { handle } from "hono/vercel";
import { buildApp, type BuiltApp } from "../src/buildApp";

// Node runtime (default for /api functions). node-redis needs Node, not Edge.

/**
 * Single Hono function for the whole app. The catch-all rewrite in vercel.json
 * routes every path here; Vercel preserves the original request path, so Hono's
 * own router still matches `/healthz`, `/auth/*`, `/me`, `/admin/*`, etc.
 *
 * The built app (incl. the Redis connection) is memoized so warm invocations
 * reuse one connection. A failed build resets the memo so the next invocation
 * retries instead of caching a rejected promise.
 */
let appPromise: Promise<BuiltApp> | undefined;

function getApp(): Promise<BuiltApp> {
	if (!appPromise) {
		appPromise = buildApp(process.env).catch((err) => {
			appPromise = undefined;
			throw err;
		});
	}
	return appPromise;
}

export default async function handler(req: Request): Promise<Response> {
	const { app } = await getApp();
	return handle(app)(req);
}
