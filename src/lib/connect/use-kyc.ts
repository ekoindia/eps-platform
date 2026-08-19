import { useOptionalAuth } from "@/lib/auth/AuthProvider";
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
	// Re-runs the check when the signed-in role changes — the signup→developer
	// upgrade at the end of onboarding grants new entitlements without a
	// remount, and a `[]`-effect would keep reporting the pre-upgrade answer.
	// Optional so the hook still works in trees (and tests) with no provider.
	const auth = useOptionalAuth();
	const roleKey =
		auth === null
			? "no-provider"
			: auth.state.status === "authed"
				? auth.state.role
				: auth.state.status;

	useEffect(() => {
		if (!SHOW_CONNECT_WIDGET) {
			setEnabled(false);
			return;
		}
		let alive = true;
		void fetchRoleTransactionList()
			.then((list) => {
				const next = kycEnabled(list);
				console.debug("[connect] useKycEnabled", { roleKey, enabled: next });
				if (alive) setEnabled(next);
			})
			.catch(() => {
				// The fetch itself already warned; this is the consequence.
				console.warn(
					"[connect] useKycEnabled: list unavailable — treating as not entitled",
				);
				if (alive) setEnabled(false);
			});
		return () => {
			alive = false;
		};
	}, [roleKey]);

	return enabled;
}
