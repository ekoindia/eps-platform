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
 * Interaction ids that load E-value, most-preferred first. Extends Eloka's
 * `TransactionIds.LOAD_WALLET_TRXN_ID_LIST` — 491 is the retailer's "Load
 * E-value", 240 the distributor's "Request E-value", and 10021 the limited
 * "Load E-value with QR (UPI)" granted to accounts that have e-signed the
 * agreement but not yet activated by passing KYC.
 *
 * Order is priority, not exclusivity: an activating account keeps 10021 while
 * gaining 491/240, and must be sent to the fuller flow once it has one.
 */
export const LOAD_WALLET_INTERACTION_IDS = [491, 240, 10021] as const;

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
	if (cache) {
		console.debug("[connect] interaction list: cache hit");
		return Promise.resolve(cache);
	}
	inflight ??= authClient
		.connectInteractions()
		.then(({ interactions }) => {
			cache = buildRoleTransactionList(interactions);
			// 586/587 gate Upload Documents (`KYC_LIST_ID`/`KYC_UPLOAD_ID` in
			// kyc.ts — not imported: a diagnostic must not couple this generic
			// module to one feature). Mirrors the backend's `[connect] wlc` line
			// so browser and server can be compared for the same request.
			console.debug("[connect] interaction list fetched", {
				count: interactions.length,
				kycEntitled: Boolean(cache["586"] && cache["587"]),
			});
			return cache;
		})
		.catch((err) => {
			// Loud on purpose: every consumer of this list treats a failed fetch
			// as "not entitled" and hides nav silently — a network blip and a
			// genuinely missing entitlement look identical without this line.
			console.warn("[connect] interaction list fetch failed", err);
			throw err;
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

/** A child interaction of a composite row, ready to render as a link. */
export interface GroupChild {
	id: number;
	label: string;
}

/**
 * The children of a composite interaction, in the order upstream listed them.
 *
 * `group_interaction_ids` is a comma-separated id string on the parent row (536
 * Manage My Account, 491 Load E-value, …). A child id the caller is not
 * entitled to simply has no row of its own, and is dropped — same rule Eloka's
 * ManageMyAccountCard applies, and the same fail-closed default as the rest of
 * this module: unreadable means not entitled, never "show it anyway".
 *
 * Rows are `Record<string, unknown>` off the wire, so both halves are checked
 * rather than cast: a non-finite id would build a broken route, and a
 * non-string label would render as "[object Object]".
 * @param list - The caller's interaction list.
 * @param id - The composite interaction whose children to read.
 * @returns The renderable children; empty when the parent is absent, has no
 * children, or none of them survived validation.
 */
export function groupChildren(
	list: RoleTransactionList,
	id: number,
): GroupChild[] {
	const raw = list[String(id)]?.group_interaction_ids;
	if (typeof raw !== "string") return [];
	const out: GroupChild[] = [];
	const seen = new Set<number>();
	for (const part of raw.split(",")) {
		const childId = Number(part.trim());
		// Upstream has been seen to list an id twice (see `buildRoleTransactionList`);
		// rendering it twice would give React duplicate keys and the user a repeated row.
		if (!Number.isFinite(childId) || childId <= 0 || seen.has(childId))
			continue;
		const row = list[String(childId)];
		if (!row) continue;
		const label = typeof row.label === "string" ? row.label.trim() : "";
		if (!label) continue;
		seen.add(childId);
		out.push({ id: childId, label });
	}
	return out;
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
