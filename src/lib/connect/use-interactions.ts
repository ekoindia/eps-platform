import { SHOW_CONNECT_WIDGET } from "@/lib/config/features";
import {
	type RoleTransactionList,
	fetchRoleTransactionList,
} from "@/lib/connect/interactions";
import { useEffect, useState } from "react";

/**
 * The caller's whole interaction list, for callers that gate on several ids at
 * once rather than on one named flow.
 *
 * Safe to call from several components: the list is cached for the session and
 * concurrent callers share one request. Same failure behaviour as
 * `useLoadWalletFlowId` and `useKycEnabled` — a list we could not read stays
 * null, i.e. nothing is treated as entitled.
 * @param enabled - False skips the fetch (and returns null) — for callers that
 *   may render for a visitor, whose call would 401, and a 401 signs out.
 * @returns The list, or null while unresolved or when the fetch failed.
 */
export function useRoleTransactionList(
	enabled = true,
): RoleTransactionList | null {
	const [list, setList] = useState<RoleTransactionList | null>(null);

	useEffect(() => {
		if (!SHOW_CONNECT_WIDGET || !enabled) return;
		let alive = true;
		void fetchRoleTransactionList()
			.then((fetched) => {
				if (alive) setList(fetched);
			})
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [enabled]);

	return list;
}
