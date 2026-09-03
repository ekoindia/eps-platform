import { Footer } from "@/components/Footer";
import { SignInSplit } from "@/components/auth/SignInSplit";
import { ConnectDialogProvider } from "@/components/connect/DialogHost";
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
import type { MeView } from "@/lib/auth/client";
import { readNextParam } from "@/lib/auth/next-param";
import type { RoleTransactionList } from "@/lib/connect/interactions";
import { EKOSTORE_KYC_ID } from "@/lib/connect/use-ekostore";
import { useRoleTransactionList } from "@/lib/connect/use-interactions";
import { useKycEnabled } from "@/lib/connect/use-kyc";
import { useLoadWalletFlowId } from "@/lib/connect/use-load-wallet-flow";
import { cn } from "@/lib/utils";
import {
	ArrowUpRight,
	BookOpen,
	FileCheck2,
	FilePen,
	FlaskConical,
	KeyRound,
	LayoutDashboard,
	Menu,
	PlusCircle,
	ReceiptText,
	ShieldCheck,
	Sparkles,
	UserCog,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
	Link,
	NavLink,
	Outlet,
	useLocation,
	useNavigate,
	useOutletContext,
} from "react-router-dom";

/**
 * Console rail items, grouped under uppercase captions like the docs rail
 * (`DocsNavTree`): Home stands alone at the top, then three sections named for
 * what the partner is doing — Complete your KYC (onboarding they must clear),
 * Build (what they build with), Account & History (running the account). The
 * rail carries up to ten entries once entitlements resolve — past the point a
 * flat list reads.
 */
type NavItem = {
	/** Router path. Every rail item is in-app. */
	to: string;
	label: string;
	icon: typeof LayoutDashboard;
	end: boolean;
	/** Draw a trailing ↗ — this link leaves the console for the wider site. */
	arrow?: boolean;
};

/** A captioned block of rail links. A group with no items renders nothing. */
type NavGroup = { title: string; items: readonly NavItem[] };

const NAV_LINK_BASE =
	"flex items-center gap-2 rounded-md px-3 py-2 transition-colors";
const NAV_LINK_IDLE =
	"text-muted-foreground hover:bg-muted hover:text-foreground";

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

/**
 * The docs rail this one borrows its shape from, and the AI-tooling page beside
 * it. In-app routes like every other item — the ↗ only says they leave the
 * console shell behind.
 */
const API_DOCS_ITEM: NavItem = {
	to: "/docs",
	label: "Integration Docs",
	icon: BookOpen,
	end: false,
	arrow: true,
};

const BUILD_WITH_AI_ITEM: NavItem = {
	to: "/ai",
	label: "Build with AI Tools",
	icon: Sparkles,
	end: false,
	arrow: true,
};

const TRANSACTIONS_ITEM: NavItem = {
	to: "/console/transactions",
	label: "Transaction History",
	icon: ReceiptText,
	end: false,
};

/**
 * Last of all, and only while developing: the bench opens the camera, image
 * editor, file viewer and raise-issue form without needing a transaction flow.
 * Closes Account & History. The route itself is registered under the same guard
 * in App.tsx.
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
 * KYC document upload. Follows E-sign Documents in the rail's first section: an
 * unfinished KYC pack is what blocks the account, so it outranks everything the
 * rail offers except signing the agreement that gates the pack itself.
 */
const DOCUMENTS_ITEM: NavItem = {
	to: "/console/documents",
	label: "Upload Documents",
	icon: FileCheck2,
	end: false,
};

/**
 * Self-service flows the rail links straight to. Each is placed by hand rather
 * than as one block: E-sign Documents opens the KYC section, Manage My Account
 * and AePS Agents sit under Account & History.
 */
type Flow = { id: number; label: string; icon: typeof FilePen };

/**
 * E-signing the partner agreement. Opens the KYC section: the document pack
 * behind Upload Documents is what the signed agreement covers, so signing comes
 * first. Replaces the retired 898 "Sign Agreement" flow (tick "I Agree" and
 * submit), which this supersedes rather than sits beside.
 */
const ESIGN_DOCUMENTS: Flow = {
	id: 223,
	label: "E-sign Documents",
	icon: FilePen,
};
const MANAGE_ACCOUNT: Flow = {
	id: 536,
	label: "Manage My Account",
	icon: UserCog,
};
/** The AePS agent network a distributor manages. Follows Manage My Account. */
const AEPS_AGENTS: Flow = {
	id: 36,
	label: "AePS Agents",
	icon: Users,
};

/**
 * ekostore's KYC & verification sandbox. Entitled the same way as any flow — by
 * the id turning up in the interaction list — but hosted by ekostore, so the
 * page behind this link frames their gateway rendering of it rather than
 * rendering a Connect flow. A plain internal item: the access token is minted by
 * that page, not here, so the console no longer asks for one just to draw a rail.
 */
const EKOSTORE_KYC_ITEM: NavItem = {
	to: "/console/kyc-verification",
	label: "Live Sandbox (KYC & Verification)",
	icon: ShieldCheck,
	end: false,
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
			// Nothing to finish, nothing to show: an empty group renders no caption.
			title: "Complete your KYC",
			items: [
				...flowItem(interactions, ESIGN_DOCUMENTS),
				...(kycEnabled ? [DOCUMENTS_ITEM] : []),
			],
		},
		{
			title: "Build",
			items: [
				CREDENTIALS_ITEM,
				API_DOCS_ITEM,
				BUILD_WITH_AI_ITEM,
				...(interactions?.[String(EKOSTORE_KYC_ID)] ? [EKOSTORE_KYC_ITEM] : []),
			],
		},
		{
			title: "Account & History",
			items: [
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
				TRANSACTIONS_ITEM,
				...flowItem(interactions, MANAGE_ACCOUNT),
				...flowItem(interactions, AEPS_AGENTS),
				...DEV_ITEMS,
			],
		},
	];

	const link = (item: NavItem) => (
		<NavLink
			key={item.to}
			to={item.to}
			end={item.end}
			onClick={onNavigate}
			className={({ isActive }) =>
				cn(
					NAV_LINK_BASE,
					isActive ? "bg-slate-300 font-medium text-eko-navy" : NAV_LINK_IDLE,
				)
			}
		>
			<item.icon className="h-4 w-4 shrink-0" />
			<span>{item.label}</span>
			{item.arrow ? (
				<ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0" />
			) : null}
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
	const { search } = useLocation();
	const [open, setOpen] = useState(false);

	// A signup session hasn't finished onboarding — it has no console to show.
	// Send it back to `/signup` to resume the wizard. Mirror of the redirect
	// SignupPage.tsx already does in the other direction (`role !== "signup"`
	// → `/console`); the two conditions are disjoint by construction, so
	// neither page can bounce a session straight back to the other. The query
	// string rides along so a `?next=` on the link survives the detour through
	// the wizard.
	useEffect(() => {
		if (state.status === "authed" && state.role === "signup") {
			navigate({ pathname: "/signup", search }, { replace: true });
		}
	}, [state, search, navigate]);

	// `?next=` is a deep link into the console: honour it the moment a developer
	// session exists, which is the moment the console home would otherwise
	// render — after a fresh login, or straight away for a session that was
	// already signed in. Terminates because the replace drops `next` from the
	// URL, so a re-run finds nothing. A signup session never reaches here; the
	// redirect above claims it first.
	useEffect(() => {
		if (state.status !== "authed" || state.role !== "developer") return;
		const next = readNextParam(search);
		if (next) navigate(next, { replace: true });
	}, [state, search, navigate]);

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
			{/* An anonymous visitor gets the full-bleed sign-in pitch, which needs
			    the whole width — so it sits outside the container the other
			    logged-out states share, and outside their top padding too:
			    `SignInSplit` runs to the top edge and clears the fixed header
			    internally, so its two-tone columns paint behind the header instead
			    of leaving a strip of page background above them. */}
			{state.status === "anon" ? (
				<main>
					{/* Warm the dashboard's chunk while the user reads the SMS.
					    `ConsoleHome` is lazy, so without this its request only starts
					    once the session lands — a round-trip bolted onto the screen the
					    user is already waiting for. Must resolve to the same module
					    App.tsx lazy-loads — the `@/` alias and its relative path do, and
					    share one chunk — or this warms a second copy instead of the one
					    that gets rendered. */}
					<SignInSplit prefetch={() => import("@/pages/console/ConsoleHome")} />
				</main>
			) : null}
			{/* Loading and admin are a single card on a plain page: same container,
			    same title as before the rail was rebuilt. */}
			{developer || state.status === "anon" ? null : (
				<main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 min-h-[60vh]">
					<h1 className="text-2xl font-bold text-eko-navy mb-8">
						Developer Console
					</h1>
					{showLoading ? <ConsoleLoading /> : null}
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
						 * Below `lg` the whole rail — caption, balance and links — lives in
						 * the Sheet, so a phone spends its vertical space on the sub-page
						 * instead of repeating the same header on every route; only the
						 * trigger stays outside. The balance therefore mounts twice in the
						 * tree (rail + Sheet), which is safe because `wallet-balance.ts`
						 * caches for 30s and dedupes in-flight fetches: the Sheet's copy
						 * paints from the cache and the pair can never double the upstream
						 * round-trips. Desktop: the docs rail's slate panel, sticky under
						 * the fixed ~88px site header.
						 */}
						<aside className="px-4 pb-2 pt-24 lg:border-r lg:border-border/60 lg:bg-slate-50 lg:px-3 lg:pb-16 lg:pt-28 print:hidden">
							<div className="lg:sticky lg:top-28">
								<div className="lg:hidden">
									<Sheet open={open} onOpenChange={setOpen}>
										<SheetTrigger asChild>
											<Button variant="outline" size="sm" className="gap-2">
												<Menu className="h-4 w-4" />
												Console menu
											</Button>
										</SheetTrigger>
										<SheetContent side="left" className="w-72 p-4 pt-10">
											{/* Doubles as the Sheet's required accessible title, so
											    the caption is announced rather than duplicated as a
											    second copy of the page's h1 below. */}
											<SheetTitle className="mb-3 px-3 text-center text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-eko-gold-ink">
												EPS Developer Console
											</SheetTitle>
											<WalletBalance />
											<ConsoleNav onNavigate={() => setOpen(false)} />
										</SheetContent>
									</Sheet>
								</div>
								<div className="hidden lg:block">
									{/* The page's only h1: the rail caption names the section, as
									    `DocsLayout` does. The lifecycle state lives on the Home
									    profile card, not here. */}
									<div className="mb-3 flex items-center justify-center gap-2 px-3">
										<h1 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-eko-gold-ink">
											EPS Developer Console
										</h1>
									</div>
									<WalletBalance />
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
