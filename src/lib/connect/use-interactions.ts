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
 * @returns The list, or null while unresolved or when the fetch failed.
 */
export function useRoleTransactionList(): RoleTransactionList | null {
	const [list, setList] = useState<RoleTransactionList | null>(null);

	useEffect(() => {
		if (!SHOW_CONNECT_WIDGET) return;
		let alive = true;
		void fetchRoleTransactionList()
			.then((fetched) => {
				if (alive) setList(fetched);
			})
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, []);

	return list;
}
