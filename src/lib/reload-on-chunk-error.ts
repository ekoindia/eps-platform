const RELOAD_GUARD_KEY = "chunk-reload-at";
const RELOAD_GUARD_WINDOW_MS = 30_000;

/**
 * Detects whether an error came from a failed dynamic `import()` —
 * the signature of a stale, content-hashed chunk after a redeploy.
 * Message wording differs per browser, hence the alternations.
 */
export function isChunkLoadError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /(failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|expected a javascript.*module)/i.test(
		message,
	);
}

/**
 * Reloads the page to pick up the latest deploy, at most once per
 * 30-second window (tracked in sessionStorage) so a genuinely broken
 * deploy cannot cause an infinite reload loop.
 *
 * @returns true if a reload was triggered, false if the guard blocked it.
 */
export function reloadOnceForStaleChunk(): boolean {
	try {
		const lastReloadAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
		if (Date.now() - lastReloadAt < RELOAD_GUARD_WINDOW_MS) return false;
		sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
	} catch {
		// sessionStorage unavailable: skip the reload rather than risk a loop.
		return false;
	}
	window.location.reload();
	return true;
}

/**
 * Listens for Vite's `vite:preloadError` (fired when a dynamic import or
 * one of its preloaded deps fails to load) and recovers by reloading the
 * page so the browser fetches fresh HTML with the new chunk hashes.
 * Without this, clicking an internal link after a redeploy leaves the
 * page blank until a manual reload.
 */
export function installChunkErrorReload(): void {
	window.addEventListener("vite:preloadError", (event) => {
		if (reloadOnceForStaleChunk()) {
			// Suppress Vite re-throwing the import error; the reload handles it.
			event.preventDefault();
		}
	});
}
