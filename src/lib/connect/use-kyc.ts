import { useOptionalAuth } from "@/lib/auth/AuthProvider";
import { needsKycUpload } from "@/lib/console/lifecycle";

/**
 * Whether this user should be offered the KYC document flow.
 *
 * Answered from the account's lifecycle state — upstream `account_state_id` 48
 * (KYC Pending) and 47 (Ready for Resubmission), as collapsed by the backend
 * (`deriveStateFromProfile`) — and NOT from the `/connect/interactions`
 * entitlement for 586/587 that used to gate it. That list is fetched once per
 * session and read fail-closed, so a short or stale wlc list silently hid the
 * one step a blocked partner must complete.
 *
 * Deliberately NOT gated on `SHOW_CONNECT_WIDGET`: that flag is about the Eko
 * Connect iframe (Load E-value, Manage My Account). The documents page is this
 * app's own JSX over `authClient.connectKyc.*`, a backend call, and works with
 * the widget switched off.
 *
 * Reads context and returns — no fetch, so no failure mode of its own, and a
 * lifecycle that changes without a remount (the signup→developer upgrade) is
 * picked up on the next render rather than by an effect keyed on the role.
 *
 * The session is painted from this tab's cached view before `/me` confirms it
 * (see `AuthProvider`), so the answer can flip once on load. Callers already
 * tolerate that: it is display data, and the page behind the link re-reads.
 * @returns True or false once the session resolves, and null while it is still
 *   loading, so a caller can tell "no pack owed" apart from "not yet known" and
 *   avoid flashing a "not available" message at every user on mount.
 */
export function useKycEnabled(): boolean | null {
	// Optional so the hook still works in trees (and tests) with no provider.
	const auth = useOptionalAuth();
	if (auth === null) return false;
	const { state } = auth;
	if (state.status === "loading") return null;
	// Admin and signup sessions carry no lifecycle; anon carries no session.
	if (state.status !== "authed" || state.role !== "developer") return false;
	// No debug line: this runs in a render body, where a log fires on every
	// paint. The same answer is legible from the lifecycle badge on Home.
	return needsKycUpload(state.me.state);
}
