import { ApiError, authClient } from "@/lib/auth/client";

/**
 * How long a fetched balance is reused across mounts. The card is remounted on
 * every console navigation (AnimatedRoutes keys the whole route subtree on the
 * pathname to retrigger its fade), so without this each page change refetches
 * and flashes "Loading…". Matches the card's refresh cooldown, for the same
 * reason: the balance only moves when the user transacts. Inside the window we
 * knowingly show a balance up to 30s stale; the refresh button bypasses it.
 */
export const FRESH_FOR_MS = 30_000;

export type CachedBalance = {
	status: "ok" | "hidden";
	balance: number | null;
	at: number;
};

// ponytail: in-memory, this tab, this session — cleared by AuthProvider when the
// session goes anon. Not invalidated when the user spends E-value elsewhere. If
// the console grows an in-page flow that moves the balance, invalidate from that
// flow; if it needs to survive a reload, sessionStorage is the next rung.
let cache: CachedBalance | null = null;
let inflight: Promise<CachedBalance> | null = null;

/** Drops the cached balance. Called when the session ends, and by tests. */
export function resetWalletBalanceCache() {
	cache = null;
	inflight = null;
}

/**
 * Fetches the balance, sharing one request between concurrent callers — a fast
 * navigation can mount a second card before the first request lands, and both
 * would otherwise hit the backend.
 *
 * Only settled answers are cached: "ok", and the 403 that means this account has
 * no wallet. A transient failure caches nothing, so a remount retries it
 * immediately rather than showing a stale error for the rest of the window.
 */
export function fetchWalletBalance(): Promise<CachedBalance> {
	inflight ??= authClient
		.walletBalance()
		.then(
			(view): CachedBalance => ({
				status: "ok",
				balance: view.balance,
				at: Date.now(),
			}),
		)
		.catch((e): CachedBalance => {
			if (e instanceof ApiError && e.httpStatus === 403)
				return { status: "hidden", balance: null, at: Date.now() };
			throw e;
		})
		.then((settled) => {
			cache = settled;
			return settled;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/** The cached balance, or null once it has aged out of the freshness window. */
export function freshWalletBalance(): CachedBalance | null {
	if (!cache) return null;
	return Date.now() - cache.at < FRESH_FOR_MS ? cache : null;
}
