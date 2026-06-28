import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";

const BASE: string = import.meta.env.VITE_EPS_BACKEND_URL ?? "/api";

/**
 * Admin sign-in page with GitHub OAuth redirect link.
 */
export default function Admin() {
	return (
		<>
			<Helmet>
				<title>Admin — EPS</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			<main className="container mx-auto px-4 py-24 flex flex-col items-center gap-6 min-h-[60vh]">
				<h1 className="text-2xl font-bold text-eko-navy">Admin sign-in</h1>
				<p className="text-sm text-muted-foreground">
					Restricted to Eko staff with repository access.
				</p>
				<Button asChild>
					{/* Full-page navigation — OAuth redirect cannot be an SPA route. */}
					<a href={`${BASE}/auth/admin/github`}>Sign in with GitHub</a>
				</Button>
			</main>
		</>
	);
}
