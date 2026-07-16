import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { MeView } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { KeyRound, LayoutDashboard, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
	Link,
	NavLink,
	Outlet,
	useNavigate,
	useOutletContext,
} from "react-router-dom";

/**
 * Console rail items. Flat by design: developer consoles only reach for
 * uppercase group captions past ~5 items, and there are two.
 */
const NAV_ITEMS = [
	{ to: "/console", label: "Home", icon: LayoutDashboard, end: true },
	{
		to: "/console/credentials",
		label: "Credentials",
		icon: KeyRound,
		end: false,
	},
] as const;

/**
 * The signed-in developer, as handed down by `ConsoleLayout` through the router
 * outlet. Console sub-pages render only inside the developer branch of the
 * gate, so this is never null.
 */
export function useConsoleMe(): MeView {
	return useOutletContext<MeView>();
}

/** The rail itself — shared by the desktop aside and the mobile Sheet. */
function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<nav className="flex flex-col gap-0.5 text-sm" aria-label="Console">
			{NAV_ITEMS.map((item) => (
				<NavLink
					key={item.to}
					to={item.to}
					end={item.end}
					onClick={onNavigate}
					className={({ isActive }) =>
						cn(
							"flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
							isActive
								? "bg-muted font-medium text-eko-navy"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)
					}
				>
					<item.icon className="h-4 w-4 shrink-0" />
					<span>{item.label}</span>
				</NavLink>
			))}
		</nav>
	);
}

/** Placeholder card shown while the session resolves (or a redirect is in flight). */
function ConsoleLoading() {
	return (
		<div data-testid="console-loading" className="max-w-2xl">
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-40" />
					<Skeleton className="mt-2 h-4 w-64" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-9 w-28" />
				</CardContent>
			</Card>
		</div>
	);
}

/**
 * Console shell: owns every auth branch, and renders the left rail plus the
 * active sub-page for a developer session. Sub-pages read the session with
 * `useConsoleMe()` and carry no auth logic of their own.
 */
export default function ConsoleLayout() {
	const { state } = useAuth();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

	// A signup session hasn't finished onboarding — it has no console to show.
	// Send it back to `/signup` to resume the wizard. Mirror of the redirect
	// SignupPage.tsx already does in the other direction (`role !== "signup"`
	// → `/console`); the two conditions are disjoint by construction, so
	// neither page can bounce a session straight back to the other.
	useEffect(() => {
		if (state.status === "authed" && state.role === "signup") {
			navigate("/signup", { replace: true });
		}
	}, [state, navigate]);

	// While the redirect above is in flight (or on the loading state that also
	// has nothing to render yet), show the loading skeleton instead of a blank
	// body — no branch below matches role: "signup".
	const showLoading =
		state.status === "loading" ||
		(state.status === "authed" && state.role === "signup");

	const developer =
		state.status === "authed" && state.role === "developer" ? state.me : null;

	return (
		<>
			<Helmet>
				<title>Developer Console — EPS</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			<main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 min-h-[60vh]">
				<h1 className="text-2xl font-bold text-eko-navy mb-8">
					Developer Console
				</h1>
				{showLoading ? <ConsoleLoading /> : null}
				{state.status === "anon" ? (
					<Card className="max-w-md">
						<CardHeader>
							<CardTitle>Log in</CardTitle>
							<CardDescription>
								Sign in with your mobile number to access your EPS console.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LoginForm />
						</CardContent>
					</Card>
				) : null}
				{state.status === "authed" && state.role === "admin" ? (
					<Card className="max-w-md">
						<CardHeader>
							<CardTitle>Admin</CardTitle>
							<CardDescription>
								Signed in as {state.me.login ?? state.me.sub}.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="self-start">
								<Link to="/admin">Open Admin Console</Link>
							</Button>
						</CardContent>
					</Card>
				) : null}
				{developer ? (
					<div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
						{/* Mobile: the rail collapses behind a Sheet, mirroring DocsLayout. */}
						<div className="lg:hidden">
							<Sheet open={open} onOpenChange={setOpen}>
								<SheetTrigger asChild>
									<Button variant="outline" size="sm" className="gap-2">
										<Menu className="h-4 w-4" />
										Console menu
									</Button>
								</SheetTrigger>
								<SheetContent side="left" className="w-72 p-4 pt-10">
									<ConsoleNav onNavigate={() => setOpen(false)} />
								</SheetContent>
							</Sheet>
						</div>
						{/* Desktop: sticky under the fixed ~88px site header. */}
						<aside className="hidden lg:block">
							<div className="sticky top-28">
								<ConsoleNav />
							</div>
						</aside>
						<div className="min-w-0 max-w-2xl">
							<Outlet context={developer} />
						</div>
					</div>
				) : null}
			</main>
			<Footer />
		</>
	);
}
