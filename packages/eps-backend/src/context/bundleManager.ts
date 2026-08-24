/**
 * Owns the in-memory copy of the agent bundle (`/agent/eps.json`) and keeps it
 * fresh against the live site on a TTL.
 *
 * Extracted from `http/contextMcp.ts` so the bundle has more than one consumer:
 * the anonymous MCP server at `/context/*` serves it to external agents, and
 * the docs-chat route dispatches its tool calls against the same object. Two
 * independent loaders would mean two fetch schedules, two caches, and two
 * chances to answer from a different bundle version within one deploy.
 *
 * Nothing here throws or rejects. The bundle is refreshed detached from the
 * request path, in a process that also mints sessions and holds admin GitHub
 * tokens — an unhandled rejection here would be fatal on Node 20.
 */
import type { AgentBundle } from "@ekoindia/eps-context-mcp/src/bundle-types.js";

import { withTimeout } from "../clients/http";

/** Bundle fetches abort here: the site is not on the request path, but a hung
 * socket still costs a connection for as long as it is held open. */
const FETCH_TIMEOUT_MS = 10_000;

export interface ContextBundleOptions {
	/** Absolute URL of the agent bundle (`.../agent/eps.json`). */
	bundleUrl: string;
	/** Seconds before a loaded bundle is re-validated. */
	ttlSec: number;
	/** Fetch seam for tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
}

export interface ContextBundleManager {
	/**
	 * One object identity for the process lifetime — consumers may close over
	 * it. A refresh swaps contents in place rather than replacing the object.
	 */
	readonly bundle: AgentBundle;
	/** TTL-gated, single-flighted refresh. Returns immediately; never throws. */
	ensureFresh(): void;
	/** False until the first successful load; callers must 503 while false. */
	isLoaded(): boolean;
}

/**
 * A bundle is only usable if the tool handlers' load-bearing fields survived
 * the round trip. A 200 that is valid JSON but not a bundle (an SPA fallback
 * page, an error envelope, a half-written deploy artifact) would otherwise be
 * installed and crash every tool call afterwards.
 *
 * The `docsUrl` and object-`topics` checks are what separate the full bundle
 * from its *index* slice (`/agent/index.json`), which is the easiest wrong
 * value to configure: it carries the same top-level keys, so a laxer check
 * would accept it and every tool would quietly answer with body-free stubs.
 */
export function isUsableBundle(value: unknown): value is AgentBundle {
	const b = value as AgentBundle | undefined;
	return (
		!!b &&
		typeof b.meta?.bundleVersion === "string" &&
		b.meta.bundleVersion.length > 0 &&
		Array.isArray(b.apis) &&
		b.apis.length > 0 &&
		typeof b.apis[0]?.docsUrl === "string" &&
		!!b.topics &&
		!Array.isArray(b.topics) &&
		typeof b.topics === "object"
	);
}

/**
 * Creates the shared bundle holder and warms it detached from startup.
 *
 * @param opts - bundle URL, TTL, and an optional fetch seam.
 * @returns a manager whose `bundle` is safe to close over immediately, though
 *   empty until `isLoaded()` first returns true.
 */
export function createContextBundleManager(
	opts: ContextBundleOptions,
): ContextBundleManager {
	const doFetch = withTimeout(opts.fetchImpl ?? fetch, FETCH_TIMEOUT_MS);
	const ttlMs = opts.ttlSec * 1000;

	const bundle = {} as AgentBundle;
	let loaded = false;
	let etag: string | undefined;
	/** Stamped on every ATTEMPT, not only on success — otherwise a dead origin
	 * would start a fresh fetch on every single request once the TTL lapsed. */
	let attemptedAt = 0;
	let inflight: Promise<void> | undefined;

	async function refresh(): Promise<void> {
		attemptedAt = Date.now();
		try {
			const res = await doFetch(opts.bundleUrl, {
				headers: etag ? { "if-none-match": etag } : undefined,
			});
			// The common case once loaded: the site republishes rarely, so most
			// revalidations cost one conditional GET and no parse at all.
			if (res.status === 304) return;
			if (!res.ok) {
				console.error("[eps-backend] context bundle fetch failed", {
					status: res.status,
				});
				return;
			}
			const next: unknown = await res.json();
			if (!isUsableBundle(next)) {
				console.error("[eps-backend] context bundle rejected (shape)");
				return;
			}
			// Swap with no `await` in between, so a request in flight can never
			// observe a half-emptied bundle (single-threaded JS makes this atomic).
			const mutable = bundle as unknown as Record<string, unknown>;
			for (const key of Object.keys(mutable)) delete mutable[key];
			Object.assign(bundle, next);
			etag = res.headers.get("etag") ?? undefined;
			loaded = true;
			console.log("[eps-backend] context bundle loaded", {
				bundleVersion: next.meta.bundleVersion,
			});
		} catch (err) {
			// Keep serving the last good bundle. Never rethrow: this runs detached.
			console.error("[eps-backend] context bundle refresh error", err);
		}
	}

	function ensureFresh(): void {
		if (inflight || Date.now() - attemptedAt < ttlMs) return;
		inflight = refresh().finally(() => {
			inflight = undefined;
		});
		// ponytail: lazy trigger, no setInterval — nothing to unref on shutdown and
		// zero work while idle. Ceiling: after a long idle the first request serves
		// a stale bundle and refreshes behind it. Add a timer only if that matters.
		void inflight;
	}

	// Warm the bundle at boot without blocking startup: the auth service must
	// come up (and pass /readyz) whether or not the site is reachable.
	ensureFresh();

	return {
		bundle,
		ensureFresh,
		isLoaded: () => loaded,
	};
}
