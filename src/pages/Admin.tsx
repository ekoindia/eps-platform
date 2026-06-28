import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const BASE: string = import.meta.env.VITE_EPS_BACKEND_URL ?? "/api";

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
					<>
						<p className="text-sm text-muted-foreground">
							Signed in as {state.me.login ?? state.me.sub}.
						</p>
						<Button asChild>
							<Link to="/console">Go to console</Link>
						</Button>
					</>
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
					</>
				)}
			</main>
		</>
	);
}
