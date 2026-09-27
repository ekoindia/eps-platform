import { AdminConsole } from "@/components/admin/AdminConsole";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

const BASE: string = import.meta.env.VITE_EPS_BACKEND_URL ?? "/api";

/**
 * Local-dev shortcut to an admin session with no GitHub OAuth. Rendered only
 * under `import.meta.env.DEV`, so Vite drops it from production builds; the
 * backend's own locks (DEV_ADMIN_LOGIN, loopback-only) are the real gate.
 */
function DevAdminLogin() {
	const { refresh } = useAuth();
	const [error, setError] = useState<string | null>(null);

	const signIn = async () => {
		setError(null);
		try {
			await authClient.devAdminLogin();
			await refresh();
		} catch {
			setError(
				"Dev login is off. Set DEV_ADMIN_LOGIN=true and COOKIE_SECURE=false in packages/eps-backend/.env, then restart the backend.",
			);
		}
	};

	return (
		<div className="flex flex-col items-center gap-2 border-t pt-4">
			<Button variant="outline" onClick={signIn}>
				Demo admin login (local dev)
			</Button>
			<p className="max-w-sm text-center text-xs text-muted-foreground">
				No GitHub token: Search logs work; proposing doc changes or deploying
				does not.
			</p>
			{error && (
				<p className="max-w-sm text-center text-xs text-destructive">{error}</p>
			)}
		</div>
	);
}

/**
 * Admin page: GitHub OAuth sign-in when unauthenticated; once signed in, links to
 * the console instead of re-showing the sign-in button.
 */
export default function Admin() {
	const { state } = useAuth();
	return (
		<>
			<Helmet>
				<title>Admin — EPS</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			<main className="container mx-auto px-4 pt-28 pb-16 flex flex-col items-center gap-6 min-h-[60vh]">
				<h1 className="text-2xl font-bold text-eko-navy">Admin sign-in</h1>
				{state.status === "loading" ? (
					<p className="text-sm text-muted-foreground">Checking session…</p>
				) : state.status === "authed" && state.role === "admin" ? (
					<div className="w-full max-w-6xl">
						<p className="text-sm text-muted-foreground mb-4">
							Signed in as {state.me.login ?? state.me.sub}.
						</p>
						<AdminConsole canEditDocs={state.me.login !== null} />
					</div>
				) : state.status === "authed" ? (
					<>
						<p className="text-sm text-muted-foreground">
							You are signed in, but this account does not have admin access.
						</p>
						<Button asChild>
							<Link to="/console">Go to console</Link>
						</Button>
					</>
				) : (
					<>
						<p className="text-sm text-muted-foreground">
							Restricted to Eko staff with repository access.
						</p>
						<Button asChild>
							{/* Full-page navigation — OAuth redirect cannot be an SPA route. */}
							<a href={`${BASE}/auth/admin/github`}>Sign in with GitHub</a>
						</Button>
						{import.meta.env.DEV && <DevAdminLogin />}
					</>
				)}
			</main>
		</>
	);
}
