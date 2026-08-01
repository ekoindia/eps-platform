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
// session goes anon, and written straight from the Connect widget when a flow
// moves the balance. Not invalidated when the user spends E-value elsewhere; if
// it needs to survive a reload, sessionStorage is the next rung.
let cache: CachedBalance | null = null;
let inflight: Promise<CachedBalance> | null = null;
// Bumped by everything that supersedes an in-flight fetch. A request started
// before a transaction was computed against the old balance, so letting it write
// the cache when it lands would silently undo the newer answer.
let version = 0;

const listeners = new Set<() => void>();

/** Drops the cached balance. Called when the session ends, and by tests. */
export function resetWalletBalanceCache() {
	cache = null;
	inflight = null;
	version++;
}

/**
 * Subscribes to balances pushed in from outside a fetch.
 * @param listener - Called after the cached balance changes.
 * @returns An unsubscribe function.
 */
export function subscribeWalletBalance(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Records a balance the user's own transaction just produced.
 *
 * The Connect widget reports the post-transaction balance itself, so the rail
 * can repaint immediately instead of showing the pre-transaction number for the
 * rest of the freshness window and then spending a round trip on a number we
 * were already handed.
 * @param balance - The post-transaction balance, in rupees.
 */
export function setWalletBalance(balance: number) {
	cache = { status: "ok", balance, at: Date.now() };
	version++;
	for (const listener of listeners) listener();
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
	if (!inflight) {
		const startedAt = version;
		inflight = authClient
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
				// A transaction landed, or the session ended, while this was in the
				// air. Either way this answer predates that and must not overwrite it —
				// otherwise completing a transfer repaints the pre-transfer balance the
				// moment the older request returns.
				if (version !== startedAt) return cache ?? settled;
				cache = settled;
				return settled;
			})
			.finally(() => {
				inflight = null;
			});
	}
	return inflight;
}

/** The cached balance, or null once it has aged out of the freshness window. */
export function freshWalletBalance(): CachedBalance | null {
	if (!cache) return null;
	return Date.now() - cache.at < FRESH_FOR_MS ? cache : null;
}
