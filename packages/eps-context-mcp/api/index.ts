import { handle } from "hono/vercel";
import { loadBundle } from "../src/load-bundle";
import { createApp } from "../src/http";

// Node runtime (default for /api functions). load-bundle.ts uses node:fs to read
// the baked bundle, so this is Node serverless, not Edge — fine for a stateless
// JSON lookup (see remote-design spec).

/**
 * Single Hono function for the whole app. The catch-all rewrite in vercel.json
 * routes every path here; Vercel preserves the original request path, so Hono's
 * router still matches /healthz and /mcp. (The VM nginx proxy strips the
 * /context/ prefix before the request reaches Vercel.)
 *
 * The built app (bundle loaded once) is memoized so warm invocations reuse it.
 * A failed load resets the memo so the next invocation retries instead of
 * caching a rejected promise.
 */
type App = ReturnType<typeof createApp>;
let appPromise: Promise<App> | undefined;

function getApp(): Promise<App> {
	if (!appPromise) {
		appPromise = loadBundle()
			.then(({ bundle, source }) => createApp(bundle, source))
			.catch((err) => {
				appPromise = undefined;
				throw err;
			});
	}
	return appPromise;
}

export default async function handler(req: Request): Promise<Response> {
	const app = await getApp();
	return handle(app)(req);
}
