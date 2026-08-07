import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/auth/LoginForm";
import { ConnectDialogProvider } from "@/components/connect/DialogHost";
import { lifecycleBadge } from "@/lib/console/lifecycle";
import { WalletBalance } from "@/components/console/WalletBalance";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Lifecycle, MeView } from "@/lib/auth/client";
import type { RoleTransactionList } from "@/lib/connect/interactions";
import { useRoleTransactionList } from "@/lib/connect/use-interactions";
import { useKycEnabled } from "@/lib/connect/use-kyc";
import { useLoadWalletFlowId } from "@/lib/connect/use-load-wallet-flow";
import { cn } from "@/lib/utils";
import {
	ArrowUpRight,
	FileCheck2,
	FilePen,
	FlaskConical,
	KeyRound,
	LayoutDashboard,
	Menu,
	PlusCircle,
	ReceiptText,
	UserCog,
} from "lucide-react";
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
 * Console rail items, grouped under uppercase captions like the docs rail
 * (`DocsNavTree`): Home stands alone at the top, then Account (what the partner
 * owns) and Build & Monitor (what they build with). The rail carries up to eight
 * entries once entitlements resolve — past the point a flat list reads.
 */
type NavItem = {
	to: string;
	label: string;
	icon: typeof LayoutDashboard;
	end: boolean;
};

/** A captioned block of rail links. A group with no items renders nothing. */
type NavGroup = { title: string; items: readonly NavItem[] };

const HOME_ITEM: NavItem = {
	to: "/console",
	label: "Home",
	icon: LayoutDashboard,
	end: true,
};

const CREDENTIALS_ITEM: NavItem = {
	to: "/console/credentials",
	label: "Credentials",
	icon: KeyRound,
	end: false,
};

const TRANSACTIONS_ITEM: NavItem = {
	to: "/console/transactions",
	label: "Transactions",
	icon: ReceiptText,
	end: false,
};

/**
 * Last of all, and only while developing: the bench opens the camera, image
 * editor, file viewer and raise-issue form without needing a transaction flow.
 * The route itself is registered under the same guard in App.tsx.
 */
const DEV_ITEMS: readonly NavItem[] = import.meta.env.DEV
	? [
			{
				to: "/console/test",
				label: "Test bench",
				icon: FlaskConical,
				end: false,
			},
		]
	: [];

/**
 * The signed-in developer, as handed down by `ConsoleLayout` through the router
 * outlet. Console sub-pages render only inside the developer branch of the
 * gate, so this is never null.
 */
export function useConsoleMe(): MeView {
	return useOutletContext<MeView>();
}

/**
 * KYC document upload. Sits directly after Home when entitled, ahead of Load
 * Wallet: an unfinished KYC pack is what blocks the account, so it outranks
 * everything else the rail offers.
 */
const DOCUMENTS_ITEM: NavItem = {
	to: "/console/documents",
	label: "Upload Documents",
	icon: FileCheck2,
	end: false,
};

/**
 * Self-service flows the rail links straight to. Each is placed by hand rather
 * than as one block: Sign Agreement follows Load Wallet, Manage My Account
 * closes the rail.
 */
type Flow = { id: number; label: string; icon: typeof FilePen };

const SIGN_AGREEMENT: Flow = {
	id: 898,
	label: "Sign Agreement",
	icon: FilePen,
};
const MANAGE_ACCOUNT: Flow = {
	id: 536,
	label: "Manage My Account",
	icon: UserCog,
};

/**
 * The rail item for a flow, when this user is entitled to run it.
 * @param list - The caller's interaction list, or null while unresolved.
 * @param flow - The flow to link to.
 * @returns A one-item array to spread, or an empty one when not entitled.
 */
function flowItem(
	list: RoleTransactionList | null,
	flow: Flow,
): readonly NavItem[] {
	if (!list?.[String(flow.id)]) return [];
	return [
		{
			to: `/console/transaction/${flow.id}`,
			label: flow.label,
			icon: flow.icon,
			end: false,
		},
	];
}

/** The links themselves — shared by the desktop rail and the mobile Sheet. */
function ConsoleNav({ onNavigate }: { onNavigate?: () => void }) {
	// Same entitlement that gates the wallet card's "+" button, and the same
	// route it links to — the rail just says it in words.
	const loadFlowId = useLoadWalletFlowId();
	const kycEnabled = useKycEnabled();
	const interactions = useRoleTransactionList();
	// Whatever this user is entitled to, in place. Built as a flat spread per
	// group rather than spliced: two independent entitlements land in here, and a
	// nested ternary per item is how the order quietly goes wrong.
	const groups: readonly NavGroup[] = [
		{
			title: "Account",
			items: [
				...(kycEnabled ? [DOCUMENTS_ITEM] : []),
				...(loadFlowId === null
					? []
					: [
							{
								to: `/console/transaction/${loadFlowId}`,
								label: "Load Wallet",
								icon: PlusCircle,
								end: false,
							},
						]),
				...flowItem(interactions, SIGN_AGREEMENT),
				CREDENTIALS_ITEM,
				...flowItem(interactions, MANAGE_ACCOUNT),
			],
		},
		{ title: "Build & Monitor", items: [TRANSACTIONS_ITEM, ...DEV_ITEMS] },
	];

	const link = (item: NavItem) => (
		<NavLink
			key={item.to}
			to={item.to}
			end={item.end}
			onClick={onNavigate}
			className={({ isActive }) =>
				cn(
					"flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
					isActive
						? "bg-slate-300 font-medium text-eko-navy"
						: "text-muted-foreground hover:bg-muted hover:text-foreground",
				)
			}
		>
			<item.icon className="h-4 w-4 shrink-0" />
			<span>{item.label}</span>
		</NavLink>
	);

	return (
		<nav className="text-sm" aria-label="Console">
			{link(HOME_ITEM)}

			{groups.map((group) =>
				group.items.length === 0 ? null : (
					<div
						key={group.title}
						className="mt-6 border-t border-border/50 pt-4"
					>
						<p className="mb-1 px-3 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							{group.title}
						</p>
						<div className="flex flex-col gap-0.5">{group.items.map(link)}</div>
					</div>
				),
			)}

			{/* Back to the docs rail this one borrows its shape from. */}
			<div className="mt-6 border-t border-border/50 pt-4">
				<Link
					to="/docs"
					onClick={onNavigate}
					className="flex items-center gap-1.5 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
				>
					<span>API Docs</span>
					<ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
				</Link>
			</div>
		</nav>
	);
}

/**
 * The account's lifecycle state, as the rail caption's badge. Green only when
 * the account is live; every other state (including one this build doesn't
 * know) reads as neutral rather than as an alarm.
 * @param state - The session's lifecycle state.
 */
function LifecycleBadge({ state }: { state: Lifecycle }) {
	return (
		<span
			className={cn(
				"rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider",
				state === "active"
					? "bg-emerald-50 text-emerald-700"
					: "bg-muted text-muted-foreground",
			)}
		>
			{lifecycleBadge(state)}
		</span>
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
			{/* Everything but a signed-in developer is a single card on a plain
			    page: same container, same title as before the rail was rebuilt. */}
			{developer ? null : (
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
									Sign in with your mobile number to access your EPS Developer
									Console.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{/* Warm the dashboard's chunk while the user reads the SMS.
							    `ConsoleHome` is lazy, so without this its request only
							    starts once the session lands — a round-trip bolted onto
							    the screen the user is already waiting for. Must resolve to
							    the same module App.tsx lazy-loads — the `@/` alias and its
							    relative path do, and share one chunk — or this warms a
							    second copy instead of the one that gets rendered. */}
								<LoginForm
									prefetch={() => import("@/pages/console/ConsoleHome")}
								/>
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
				</main>
			)}
			{/* Printing a console page means printing a receipt: the page's own
			    padding and rail are chrome, and only the sub-page's content belongs
			    on paper. See `connect/PrintReceipt.tsx` for what replaces them. */}
			{developer ? (
				<ConnectDialogProvider>
					<div className="grid min-h-screen lg:grid-cols-[16rem_minmax(0,1fr)] print:block">
						{/*
						 * One rail column at every width, so `WalletBalance` mounts once and
						 * fetches once — a second copy inside the Sheet would double the
						 * upstream round-trips and race the visible card to the rate limit.
						 * Only the LINKS collapse behind the Sheet below `lg`; the balance
						 * stays on screen, as it is in Eloka. Desktop: the docs rail's slate
						 * panel, sticky under the fixed ~88px site header.
						 */}
						<aside className="px-4 pb-8 pt-28 lg:border-r lg:border-border/60 lg:bg-slate-50 lg:px-3 lg:pb-16 print:hidden">
							<div className="lg:sticky lg:top-28">
								{/* The page's only h1: the rail caption names the section, as
								    `DocsLayout` does, and carries the lifecycle state where
								    docs puts its theme toggle. */}
								<div className="mb-3 flex items-center justify-center gap-2 px-3">
									<h1 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
										EPS Developer Console
									</h1>
									{/* <LifecycleBadge state={developer.state} /> */}
								</div>
								<WalletBalance />
								<div className="lg:hidden">
									<Sheet open={open} onOpenChange={setOpen}>
										<SheetTrigger asChild>
											<Button variant="outline" size="sm" className="gap-2">
												<Menu className="h-4 w-4" />
												Console menu
											</Button>
										</SheetTrigger>
										<SheetContent side="left" className="w-72 p-4 pt-10">
											<SheetTitle className="sr-only">Console menu</SheetTitle>
											<ConsoleNav onNavigate={() => setOpen(false)} />
										</SheetContent>
									</Sheet>
								</div>
								<div className="hidden lg:block">
									<ConsoleNav />
								</div>
							</div>
						</aside>
						<main className="min-w-0 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-28 print:p-0">
							<Outlet context={developer} />
						</main>
					</div>
				</ConnectDialogProvider>
			) : null}
			<Footer />
		</>
	);
}
