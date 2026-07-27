import { authClient } from "@/lib/auth/client";

/**
 * One entry of the widget's `role_trxn_list`.
 *
 * Deliberately untyped and passed through whole. The widget reads far more than
 * a label from these rows — `behavior`, `group_interaction_ids`, `icon`, `uri`,
 * `crm`, `meta` — and modelling a subset silently drops whatever was left out.
 * The Load-E-value flow (491) is `behavior: 7`, a grid whose children are listed
 * in `group_interaction_ids`, so a trimmed row renders an empty grid.
 */
export type RoleTransaction = Record<string, unknown>;

export type RoleTransactionList = Record<string, RoleTransaction>;

/**
 * Interaction ids that load E-value, most-preferred first. Mirrors Eloka's
 * `TransactionIds.LOAD_WALLET_TRXN_ID_LIST` — 491 is the retailer's "Load
 * E-value", 240 the distributor's "Request E-value". A user has at most one.
 */
export const LOAD_WALLET_INTERACTION_IDS = [491, 240] as const;

// ponytail: same shape as the wallet-balance cache, for the same reason — the
// console remounts on every navigation. Cleared on sign-out.
let cache: RoleTransactionList | null = null;
let inflight: Promise<RoleTransactionList> | null = null;

/**
 * Builds the widget's `role_trxn_list` from the raw upstream array.
 *
 * Keyed by `id` — the interaction id used in routes and inside
 * `group_interaction_ids` — and NOT by `interaction_type_id`, which is the type.
 * Every composite interaction (491 Load E-value, 240 Request E-value, 536 Manage
 * My Account …) reports `interaction_type_id: 0`, so keying by the type collapses
 * all of them onto `"0"`.
 *
 * Rows are copied through unchanged; see `RoleTransaction`.
 * @param raw - The interaction array as returned by `/connect/interactions`.
 * @returns A map from interaction id to its upstream row.
 */
export function buildRoleTransactionList(raw: unknown[]): RoleTransactionList {
	const out: RoleTransactionList = {};
	for (const item of raw) {
		const id = (item as { id?: unknown } | null)?.id;
		if (id === undefined || id === null || id === "") continue;
		// Duplicates do occur upstream (7775 arrives twice); last wins, as in Eloka.
		out[String(id)] = item as RoleTransaction;
	}
	return out;
}

/**
 * Fetches the caller's interaction list, sharing one request between concurrent
 * callers and caching the result for the session.
 */
export function fetchRoleTransactionList(): Promise<RoleTransactionList> {
	if (cache) return Promise.resolve(cache);
	inflight ??= authClient
		.connectInteractions()
		.then(({ interactions }) => {
			cache = buildRoleTransactionList(interactions);
			return cache;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/** Drops the cached interaction list. Called when the session ends, and by tests. */
export function resetRoleTransactionCache(): void {
	cache = null;
	inflight = null;
}

/**
 * Picks the Load-E-value flow this user is entitled to.
 * @param list - The caller's interaction list.
 * @returns The interaction id, or null when the user may not load E-value.
 */
export function loadWalletInteractionId(
	list: RoleTransactionList,
): number | null {
	return LOAD_WALLET_INTERACTION_IDS.find((id) => list[String(id)]) ?? null;
}
