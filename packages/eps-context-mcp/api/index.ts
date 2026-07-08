import { handle } from "@hono/node-server/vercel";
import { Hono } from "hono";
import { loadBundle } from "../src/load-bundle.js";
import { createApp } from "../src/http.js";

// Vercel Node runtime (load-bundle.ts uses node:fs). MUST use the
// @hono/node-server/vercel handle — hono/vercel is the Edge/Next.js adapter and
// its returned Web Response is never consumed by the Node runtime (15s hang).

/**
 * The real app needs an awaited bundle load (fetch from EPS_BUNDLE_URL, or baked
 * fallback). `handle` needs a synchronous app, so an outer Hono app delegates
 * each request to the memoized real app via app.fetch. A failed load resets the
 * memo so the next request retries instead of caching a rejected promise.
 */
type App = ReturnType<typeof createApp>;
let appPromise: Promise<App> | undefined;

const getApp = (): Promise<App> => {
	if (!appPromise) {
		appPromise = loadBundle()
			.then(({ bundle, source }) => createApp(bundle, source))
			.catch((err) => {
				appPromise = undefined;
				throw err;
			});
	}
	return appPromise;
};

const outer = new Hono();
outer.all("*", async (c) => {
	const app = await getApp();
	return app.fetch(c.req.raw);
});

export default handle(outer);
