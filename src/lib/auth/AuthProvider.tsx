import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import {
	authClient,
	LIFECYCLES,
	type AdminView,
	type MeView,
	type SignupView,
} from "@/lib/auth/client";
import { resetRoleTransactionCache } from "@/lib/connect/interactions";
import { clearConnectTokens } from "@/lib/connect/token";
import { resetDashboardCache } from "@/lib/console/dashboard";
import { resetWalletBalanceCache } from "@/lib/wallet-balance";
import { chatIdentity } from "@/lib/auth/identity";
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

	const refresh = useCallback(async () => {
		try {
			setState(classify(await authClient.me()));
		} catch {
			setState({ status: "anon" });
		}
	}, []);

	const adopt = useCallback((me: MeView | AdminView | SignupView) => {
		setState(classify(me));
	}, []);

	const logout = useCallback(async () => {
		try {
			await authClient.logout();
		} finally {
			setState({ status: "anon" });
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

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
		resetWalletBalanceCache();
		// Same hazard, higher stakes: the Connect widget's credentials live in
		// sessionStorage, which outlives the session that minted them. The widget's
		// own unmount clears them; this catches every other way a session ends.
		clearConnectTokens();
		resetRoleTransactionCache();
		// Same hazard as the balance: the dashboard's numbers are one partner's
		// business data, cached in module scope for the same remount reason.
		resetDashboardCache();
	}, [state.status]);

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
