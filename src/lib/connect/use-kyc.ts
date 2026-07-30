import { SHOW_CONNECT_WIDGET } from "@/lib/config/features";
import { fetchRoleTransactionList } from "@/lib/connect/interactions";
import { kycEnabled } from "@/lib/connect/kyc";
import { useEffect, useState } from "react";

/**
 * Whether this user may run the KYC document flow — both listing and uploading.
 *
 * Safe to call from several components: the interaction list is cached for the
 * session and concurrent callers share one request. Mirrors
 * `useLoadWalletFlowId`, including its failure behaviour — an entitlement we
 * could not read is treated as an entitlement the user does not have.
 * @returns True or false once resolved, and null while still unknown, so a
 *   caller can tell "not entitled" apart from "not yet loaded" and avoid
 *   flashing a "not available" message at every user on mount.
 */
export function useKycEnabled(): boolean | null {
	const [enabled, setEnabled] = useState<boolean | null>(null);

	useEffect(() => {
		if (!SHOW_CONNECT_WIDGET) {
			setEnabled(false);
			return;
		}
		let alive = true;
		void fetchRoleTransactionList()
			.then((list) => {
				if (alive) setEnabled(kycEnabled(list));
			})
			.catch(() => {
				if (alive) setEnabled(false);
			});
		return () => {
			alive = false;
		};
	}, []);

	return enabled;
}
