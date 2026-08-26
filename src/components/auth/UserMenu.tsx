import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	accountIdentity,
	consoleTarget,
	isInsideRoute,
} from "@/lib/auth/identity";
import { LANGUAGES, useLanguage } from "@/lib/google-translate";
import { cn } from "@/lib/utils";
import {
	ArrowRight,
	Check,
	ChevronDown,
	Globe,
	LayoutDashboard,
	LogOut,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/**
 * Persistent account chip + dropdown for the desktop header. Renders nothing
 * until the session resolves to an authenticated user, so SSG/first-client
 * markup stays stable (avoids hydration mismatch). Logout is immediate.
 *
 * One control, split in two: the left half is a labelled jump back to the
 * user's console — a signed-in developer who wanders into the docs otherwise
 * has no visible way back — and the right half (avatar + chevron) opens the
 * account menu, where the same console sits pinned as the first row.
 */
export function UserMenu() {
	const { state, logout } = useAuth();
	const { selected, changeLanguage } = useLanguage();
	const { pathname } = useLocation();
	const identity = accountIdentity(state);
	if (!identity || state.status !== "authed") return null;

	const isAdmin = state.role === "admin";
	// Only a developer session has an Eko profile to show. An admin's `/me` never
	// carries one, so the page would render an empty shell for them.
	const isDeveloper = state.role === "developer";

	const target = consoleTarget(state);
	const isInsideConsole = isInsideRoute(pathname, target.href);
	const consoleTitle = isAdmin ? "Admin Console" : "Developer Console";
	// What the pinned row promises is behind the link, so keep it truthful per
	// role: the admin console is the GitOps surface, not the wallet/keys one.
	const consoleBlurb = isAdmin
		? "Deploys · config · flags"
		: "Keys · logs · wallet";

	return (
		<DropdownMenu>
			{/* The pill borrows the search control's treatment (see `Header.tsx`) so
			    the two read as one cluster rather than two competing shapes.
			    One track, two halves: `items-stretch` keeps them exactly the same
			    height — unequal padding is what made the trigger's hover and focus
			    fills bulge past the left half — and each half caps its outer end
			    with the pill's own radius so no square corner shows through. */}
			<div className="flex items-stretch overflow-hidden rounded-full border border-white/15 bg-white/10">
				<Link
					to={target.href}
					// The label collapses on narrow desktops, so the accessible name
					// has to come from the element itself — `hidden` removes the text
					// from the accessibility tree along with the pixels.
					aria-label={`${target.label} home`}
					aria-current={isInsideConsole ? "page" : undefined}
					className={cn(
						"flex items-center gap-2 rounded-l-full py-1.5 pr-3 pl-3.5 text-sm font-medium transition-colors",
						"cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70",
						// Being inside the console reads off the gold icon, not a
						// second grey fill: white-on-white/10 was too close to the
						// hover tint to tell the two apart.
						isInsideConsole
							? "text-white"
							: "text-white/90 hover:bg-white/10 hover:text-white",
					)}
				>
					<LayoutDashboard
						className={cn(
							"h-4 w-4 shrink-0",
							isInsideConsole && "text-eko-gold",
						)}
					/>
					<span className="max-[1160px]:hidden">{target.label}</span>
				</Link>
				<DropdownMenuTrigger asChild>
					<button
						aria-label="Account menu"
						className={cn(
							"flex items-center gap-1 rounded-r-full border-l border-white/15 pr-2.5 pl-2",
							"text-white transition-colors",
							"cursor-pointer hover:bg-white/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70",
						)}
					>
						<span className="notranslate flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">
							{identity.initials}
						</span>
						<ChevronDown className="h-3.5 w-3.5 text-white/70" />
					</button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent align="end" className="w-64">
				<div className="px-2 py-1.5">
					<p className="truncate text-sm font-medium">{identity.name}</p>
					<p className="text-xs text-muted-foreground">{identity.detail}</p>
					{identity.meta && (
						<p className="truncate text-xs text-muted-foreground">
							{identity.meta}
						</p>
					)}
				</div>
				<DropdownMenuSeparator />
				{/* Pinned first, and styled as a card rather than a row: getting back
				    to the console is the one thing this menu exists for. */}
				<DropdownMenuItem asChild>
					<Link
						to={target.href}
						className="my-1 cursor-pointer gap-3 rounded-lg border border-eko-gold/40 bg-eko-gold/15 p-2 focus:bg-eko-gold/25"
					>
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-eko-gold text-eko-navy">
							<LayoutDashboard className="h-4 w-4" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-semibold">
								{consoleTitle}
							</span>
							<span className="block truncate text-xs text-muted-foreground">
								{consoleBlurb}
							</span>
						</span>
						<ArrowRight className="shrink-0 text-muted-foreground" />
					</Link>
				</DropdownMenuItem>
				{isDeveloper && (
					<DropdownMenuItem asChild>
						<Link to="/console/profile">
							<UserRound />
							My Profile
						</Link>
					</DropdownMenuItem>
				)}
				{/* An admin's pinned row took `/admin`, but they still have a developer
				    console — so for them, and only them, the plain row survives. */}
				{isAdmin && (
					<DropdownMenuItem asChild>
						<Link to="/console">
							<ShieldCheck />
							Developer console
						</Link>
					</DropdownMenuItem>
				)}
				{/* The signed-in header hands its globe slot to the notification bell,
				    so the language control lives in here. A SUBMENU rather than the
				    standalone `LanguageSelector`: a plain item would close the menu on
				    the first click, and thirteen items inline would bury Log out. */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger className="notranslate cursor-pointer">
						<Globe />
						{LANGUAGES.find((language) => language.code === selected)?.label ??
							"English"}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="notranslate max-h-80 overflow-y-auto">
						{LANGUAGES.map((language) => (
							<DropdownMenuItem
								key={language.code}
								className="cursor-pointer"
								onSelect={() => void changeLanguage(language.code)}
							>
								{language.label}
								{selected === language.code && (
									<Check className="ml-auto text-eko-gold" />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-muted-foreground"
					onSelect={() => void logout()}
				>
					<LogOut />
					Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
