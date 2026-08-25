import { SHOW_CONNECT_WIDGET } from "@/lib/config/features";
import {
	fetchRoleTransactionList,
	loadWalletInteractionId,
} from "@/lib/connect/interactions";
import { useEffect, useState } from "react";

/**
 * The Load-E-value flow this user may run, resolved from their own entitlements
 * — retailers get 491, distributors 240, accounts still awaiting KYC the limited
 * QR/UPI flow 10021, and API-only accounts none of them.
 *
 * Safe to call from several components: the interaction list is cached for the
 * session and concurrent callers share one request.
 * @returns The interaction id, or null while unresolved or when not entitled.
 */
export function useLoadWalletFlowId(): number | null {
	const [flowId, setFlowId] = useState<number | null>(null);

	useEffect(() => {
		if (!SHOW_CONNECT_WIDGET) return;
		let alive = true;
		void fetchRoleTransactionList()
			.then((list) => {
				if (alive) setFlowId(loadWalletInteractionId(list));
			})
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, []);

	return flowId;
}
