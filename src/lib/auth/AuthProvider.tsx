import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { toast } from "sonner";
import {
	authClient,
	LIFECYCLES,
	setSessionExpiredHandler,
	type AdminView,
	type MeView,
	type SignupView,
	clearCallLog,
} from "@/lib/auth/client";
import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import { clearConnectTokens } from "@/lib/connect/token";
import { resetKycDocumentCache } from "@/lib/connect/kyc-documents";
import { resetDashboardCache } from "@/lib/console/dashboard";
import { SHOW_NOTIFICATIONS } from "@/lib/config/features";
import {
	resetNotificationsCache,
	startNotificationsPolling,
} from "@/lib/notifications";
import { resetWalletBalanceCache } from "@/lib/wallet-balance";
import { chatIdentity } from "@/lib/auth/identity";
import {
	clearCachedSession,
	readCachedSession,
	writeCachedSession,
} from "@/lib/auth/session-cache";
import { setChatIdentity } from "@/lib/zoho-chat";

export type AuthState =
	| { status: "loading" }
	| { status: "anon" }
	| { status: "authed"; role: "developer"; me: MeView }
	| { status: "authed"; role: "admin"; me: AdminView }
	| { status: "authed"; role: "signup"; me: SignupView };

interface AuthContextValue {
	state: AuthState;
	refresh: () => Promise<void>;
	/**
	 * Adopts a session view the caller has ALREADY been handed, without going
	 * back to `/me` for it.
	 *
	 * `/auth/otp/verify` answers with the very same view `/me` builds — same
	 * upstream profile call, same shape. Calling `refresh()` after a successful
	 * verify therefore spends a second round-trip, and a second upstream
	 * interaction-151 lookup, to re-learn what the response in hand already says
	 * — on the one path where the user is staring at a spinner.
	 */
	adopt: (me: MeView | AdminView | SignupView) => void;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Maps a /me response to the typed AuthState union.
 *
 * Fails CLOSED: anything that doesn't match a known session shape throws, and
 * the caller's catch lands on `anon`. The developer branch used to be the
 * fallthrough — any object without a `role` became an authenticated developer,
 * so a `{}` (or a proxy's error envelope) produced a session whose every field
 * was undefined and crashed the console downstream.
 * @param me - The parsed /me payload.
 * @returns The matching auth state.
 * @throws If the payload matches no known session shape.
 */
function classify(me: MeView | AdminView | SignupView): AuthState {
	if ("role" in me && me.role === "admin") {
		return { status: "authed", role: "admin", me };
	}
	// A signup session is authenticated but has no profile yet — it authorizes
	// the onboarding wizard only.
	if ("role" in me && me.role === "signup") {
		return { status: "authed", role: "signup", me };
	}
	const developer = me as MeView;
	if (LIFECYCLES.includes(developer.state)) {
		return { status: "authed", role: "developer", me: developer };
	}
	throw new Error("unrecognized /me payload");
}

/** Context provider that boots auth state from /me and exposes refresh/logout actions. */
export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({ status: "loading" });

	// The role of the last view `accept()` classified, for spotting the
	// signup→developer upgrade below. A ref, not derived from `state`: the
	// reset must run before `setState` publishes the new role, and `stateRef`
	// further down is only updated in an effect — after render, too late.
	const lastRole = useRef<"developer" | "admin" | "signup" | null>(null);

	/**
	 * Accepts a session view and remembers it for this tab's next reload.
	 *
	 * Every path that lands on an authenticated state goes through here, so the
	 * cache cannot drift from what was actually rendered. A view that
	 * `classify()` rejects throws before the write, so a malformed payload is
	 * never cached.
	 */
	const accept = useCallback((me: MeView | AdminView | SignupView) => {
		const next = classify(me);
		// Completing onboarding swaps the signup session for a developer one
		// WITHOUT passing through `anon`, so the module caches below — all
		// entitlement-derived — would keep serving data fetched under the
		// pre-upgrade roles for the life of the tab. Reset them synchronously,
		// before the new state is published: in an effect, the console would
		// already have rendered its nav from the stale interaction list.
		if (
			lastRole.current === "signup" &&
			next.status === "authed" &&
			next.role === "developer"
		) {
			console.debug(
				"[connect] signup→developer upgrade: resetting entitlement caches",
			);
			resetRoleTransactionCache();
			resetKycDocumentCache();
			clearConnectTokens();
			resetDashboardCache();
			resetWalletBalanceCache();
		}
		lastRole.current = next.status === "authed" ? next.role : null;
		setState(next);
		if (next.status === "authed") writeCachedSession(me);
	}, []);

	const refresh = useCallback(async () => {
		try {
			accept(await authClient.me());
		} catch {
			setState({ status: "anon" });
		}
	}, [accept]);

	const adopt = useCallback(
		(me: MeView | AdminView | SignupView) => {
			accept(me);
		},
		[accept],
	);

	const logout = useCallback(async () => {
		try {
			await authClient.logout();
		} finally {
			setState({ status: "anon" });
		}
	}, []);

	// Paint the signed-in shell from the last view this tab saw, then go and
	// confirm it. Without this a reload shows the console skeleton for a whole
	// `/me` round-trip, on every page, every time.
	//
	// In an EFFECT and never in the `useState` initializer above: `main.tsx`
	// hydrates prerendered HTML, which was built with `status: "loading"`.
	// Reading storage during the first render would produce authed markup
	// against a loading server tree and trip a hydration mismatch — the same
	// hazard that makes `UserMenu` render null until the session resolves. This
	// runs after hydration commits, still long before `/me` answers.
	//
	// The cached view is DISPLAY DATA ONLY. Every request still carries the
	// session cookie, so a cache that outlives the cookie shows a name for one
	// paint and then drops to `anon` the moment `/me` 401s. Nothing is
	// authorized off it, and `refresh()` below runs unconditionally either way.
	useEffect(() => {
		const cached = readCachedSession();
		if (!cached) return;
		try {
			const hydrated = classify(cached);
			// Only ever fills the initial blank. If `/me` has already answered (a
			// fast network, or `adopt()` after an OTP verify), that result is the
			// newer truth and must not be overwritten by a stale blob.
			setState((current) =>
				current.status === "loading" ? hydrated : current,
			);
		} catch {
			// Shape from an older build that `isSessionView` still accepted. Drop it
			// and wait for `/me`.
			clearCachedSession();
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	// The expiry handler below runs outside React's data flow — it is called from
	// a fetch, not from an event — so it needs the CURRENT state, not the one
	// captured when it was registered.
	const stateRef = useRef(state);
	/** True between the first expired request and the state landing on `anon`. */
	const expiring = useRef(false);

	useEffect(() => {
		stateRef.current = state;
		// Signing back in re-arms the guard, or the next genuine expiry — hours
		// later, after another idle stretch — would pass in silence.
		if (state.status === "authed") expiring.current = false;
	}, [state]);

	// A session that cannot be recovered ends here, once, for the whole app: the
	// shell drops to `anon` (every console/admin page already renders sign-in for
	// that) and one toast says why. Without this each caller rendered the
	// backend's "session has expired" message as inline text inside a console the
	// user could no longer use.
	useEffect(() => {
		setSessionExpiredHandler(() => {
			// Never on a page the user was only browsing anonymously — the boot /me
			// of a signed-out visitor 401s exactly like an expired session does.
			if (stateRef.current.status !== "authed") return;
			// A console page fires several requests at once; they all 401 together.
			if (expiring.current) return;
			expiring.current = true;
			// Drop the shell FIRST. Logging out is best-effort courtesy — it makes
			// `anon` stick for an admin whose GitHub token died while the EPS session
			// is still live — but a hung request must not leave a broken console up.
			setState({ status: "anon" });
			toast.error("Your session has expired. Please sign in again.");
			void authClient.logout().catch(() => undefined);
		});
		return () => setSessionExpiredHandler(null);
	}, []);

	// Keep the support chat's visitor identity in step with the session, so a
	// logged-in user who opens chat from any page reaches the operator by name
	// instead of as an anonymous visitor. Logging out clears it.
	useEffect(() => {
		setChatIdentity(chatIdentity(state));
	}, [state]);

	// The E-value balance is cached in module scope to survive the remount every
	// console navigation causes, which also means it would survive a sign-out and
	// show one user their balance in the next user's session. Keyed on "anon"
	// rather than on logout() so an expired session clears it too.
	useEffect(() => {
		if (state.status !== "anon") return;
		// Same hazard as the caches below, and the reason this is keyed on `anon`
		// rather than on `logout()`: the parked profile must not outlive the
		// session that produced it, or the next sign-in on this tab paints the
		// previous user's name before `/me` corrects it.
		clearCachedSession();
		resetWalletBalanceCache();
		// Same hazard, higher stakes: the Connect widget's credentials live in
		// sessionStorage, which outlives the session that minted them. The widget's
		// own unmount clears them; this catches every other way a session ends.
		clearConnectTokens();
		resetRoleTransactionCache();
		// One partner's document statuses, held in module scope for the same
		// remount reason as the balance above.
		resetKycDocumentCache();
		// Same hazard as the balance: the dashboard's numbers are one partner's
		// business data, cached in module scope for the same remount reason.
		resetDashboardCache();
		// Same hazard again, and this one also STOPS THE POLL — a timer left
		// running after sign-out would keep calling /notifications with no session.
		resetNotificationsCache();
		// Same hazard once more: the recent-call buffer rides into every support
		// ticket, so one account's activity must not be attachable to the next
		// user's ticket on a shared tab.
		clearCallLog();
	}, [state.status]);

	// The notification poll runs once per tab and is owned here rather than by a
	// component: three surfaces read the list (the header bell twice over, and the
	// console card), and each mounting its own interval would multiply the
	// requests. `startNotificationsPolling` is idempotent, and re-keys itself when
	// the signed-in identity changes — which an OTP verify can do without ever
	// passing through `anon`.
	useEffect(() => {
		if (!SHOW_NOTIFICATIONS) return;
		if (state.status !== "authed" || state.role !== "developer") return;
		startNotificationsPolling(state.me.profile?.ekoUserId || state.me.mobile);
	}, [state]);

	return (
		<AuthContext.Provider value={{ state, refresh, adopt, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

/** Hook to consume AuthContext; must be used inside an AuthProvider tree. */
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}

/**
 * The same context, for components that merely *decorate* with the session and
 * must still work without one — a reusable form control has no business
 * crashing a page that never mounted the provider.
 * @returns The context, or null outside an `AuthProvider`.
 */
export function useOptionalAuth(): AuthContextValue | null {
	return useContext(AuthContext);
}
