import type { EkoAccount } from "../types";

/**
 * Interaction 151's `account_detail` block, in the two shapes it reaches this
 * service in: raw from SimpliBank, or forwarded by connect-api as
 * `account_details`. The fields read here are identical in both.
 */
export interface AccountDetail {
	evalue_account_id?: unknown;
	account_list?: unknown;
}

/**
 * `product_id` / `type_id` of the E-value wallet in `account_list`. Confirmed
 * against Eloka's own session fixture
 * (`wlc-webapp/__tests__/fixtures/session/user.mock.ts`), where the entry
 * labelled "E-value" carries `product_id: 1, type_id: 1` and an `id` equal to
 * the block's `evalue_account_id`.
 */
const EVALUE_PRODUCT_ID = 1;
const EVALUE_TYPE_ID = 1;

/**
 * Whether an account id is a real upstream account.
 *
 * connect-api **appends a synthetic row** to every `account_list` it forwards —
 * `{ id: -500000, label: "Response Awaited Transactions" }`
 * (`routes/authentication.js:869`) — which SimpliBank never sends. It is a UI
 * pseudo-filter for Eloka's history screen, not an account, and sending its id
 * as `account_id` upstream would be nonsense. Guarding on the sign rather than
 * that one literal also covers any future pseudo-row of the same kind.
 */
function isRealAccountId(id: number): boolean {
	return Number.isFinite(id) && id > 0;
}

/** Maps `account_list`, dropping synthetic pseudo-accounts. */
export function mapAccounts(detail: AccountDetail | undefined): EkoAccount[] {
	const list = detail?.account_list;
	if (!Array.isArray(list)) return [];
	return list
		.map((raw) => {
			const a = (raw ?? {}) as Record<string, unknown>;
			return {
				id: Number(a.id ?? 0),
				label: String(a.label ?? ""),
				productId: Number(a.product_id ?? 0),
				typeId: Number(a.type_id ?? 0),
			};
		})
		.filter((a) => isRealAccountId(a.id));
}

/**
 * Resolves the E-value account id that interaction 154 filters history by.
 *
 * Deterministic, and deliberately refuses to guess:
 *
 * 1. `evalue_account_id` when it names a real account — the block's own answer,
 *    and what Eloka stores as `accountDetails.evalue_account_id`.
 * 2. otherwise the `account_list` entry marked as the E-value product. Eloka
 *    reaches the same row by defaulting its account switcher to index 0; this
 *    service has no switcher, so it matches on the product instead of a
 *    position that only happens to be right.
 * 3. otherwise `null` — the caller answers 502 rather than sending a fabricated
 *    or first-in-list account id and reporting another account's history as
 *    this user's.
 *
 * @param detail - The `account_detail` / `account_details` block, if any.
 * @returns The account id as a string, or null when none can be resolved.
 */
export function selectEvalueAccountId(
	detail: AccountDetail | undefined,
): string | null {
	const declared = Number(detail?.evalue_account_id ?? 0);
	if (isRealAccountId(declared)) return String(declared);
	const evalue = mapAccounts(detail).find(
		(a) => a.productId === EVALUE_PRODUCT_ID && a.typeId === EVALUE_TYPE_ID,
	);
	return evalue ? String(evalue.id) : null;
}
