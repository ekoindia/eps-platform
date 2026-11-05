import { useAuth } from "@/lib/auth/AuthProvider";
import { profileCrmLeadId } from "@/lib/auth/identity";
import {
	type CrmLeadState,
	crmLeadServerSnapshot,
	crmLeadSnapshot,
	startCrmLead,
	subscribeCrmLead,
	updateCrmLead,
} from "@/lib/crm/lead-store";
import { useEffect, useSyncExternalStore } from "react";

/** What `useCrmLead()` hands a page. */
export interface CrmLead {
	state: CrmLeadState;
	/** The whitelisted Lead fields once loaded, else null. */
	fields: Record<string, unknown> | null;
	/** Writes fields and patches the shared cache; see `updateCrmLead`. */
	update: (changes: Record<string, unknown>) => Promise<void>;
}

/**
 * The signed-in partner's CRM Lead, from any page.
 *
 * Usually already loaded — `AuthProvider` starts the store at sign-in — but a
 * mount also starts it (idempotently), so a page never depends on that having
 * happened first. Every reader shares one store and one cached record, and a
 * save anywhere updates them all, including other open tabs.
 *
 * Lives apart from the store so `AuthProvider` can import the store without an
 * import cycle back through `useAuth`.
 * @returns The Lead's state, its fields when loaded, and an update function.
 */
export function useCrmLead(): CrmLead {
	const { state: auth } = useAuth();
	const developer = auth.status === "authed" && auth.role === "developer";
	const owner = developer ? auth.me.mobile : null;
	const leadId = developer ? profileCrmLeadId(auth.me.profile) : null;

	useEffect(() => {
		if (owner) startCrmLead(owner, leadId);
	}, [owner, leadId]);

	const state = useSyncExternalStore(
		subscribeCrmLead,
		crmLeadSnapshot,
		crmLeadServerSnapshot,
	);
	return {
		state,
		fields: state.status === "ok" ? state.fields : null,
		update: updateCrmLead,
	};
}
