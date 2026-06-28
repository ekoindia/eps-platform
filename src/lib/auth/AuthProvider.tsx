import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { authClient, type AdminView, type MeView } from "@/lib/auth/client";

export type AuthState =
	| { status: "loading" }
	| { status: "anon" }
	| { status: "authed"; role: "developer"; me: MeView }
	| { status: "authed"; role: "admin"; me: AdminView };

interface AuthContextValue {
	state: AuthState;
	refresh: () => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function classify(me: MeView | AdminView): AuthState {
	if ("role" in me && me.role === "admin") {
		return { status: "authed", role: "admin", me };
	}
	return { status: "authed", role: "developer", me: me as MeView };
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({ status: "loading" });

	const refresh = useCallback(async () => {
		try {
			setState(classify(await authClient.me()));
		} catch {
			setState({ status: "anon" });
		}
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

	return (
		<AuthContext.Provider value={{ state, refresh, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
