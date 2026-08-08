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
import { accountIdentity } from "@/lib/auth/identity";
import { LANGUAGES, useLanguage } from "@/lib/google-translate";
import { cn } from "@/lib/utils";
import {
	Check,
	Globe,
	LayoutDashboard,
	LogOut,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Persistent account avatar + dropdown for the desktop header. Renders nothing
 * until the session resolves to an authenticated user, so SSG/first-client
 * markup stays stable (avoids hydration mismatch). Logout is immediate.
 */
export function UserMenu() {
	const { state, logout } = useAuth();
	const { selected, changeLanguage } = useLanguage();
	const identity = accountIdentity(state);
	if (!identity || state.status !== "authed") return null;

	const isAdmin = state.role === "admin";
	// Only a developer session has an Eko profile to show. An admin's `/me` never
	// carries one, so the page would render an empty shell for them.
	const isDeveloper = state.role === "developer";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					aria-label="Account menu"
					className={cn(
						"notranslate",
						"flex h-9 w-9 items-center justify-center rounded-full",
						"bg-white/20 text-sm font-semibold text-white",
						"ring-2 ring-white/30 transition-all",
						"hover:bg-white/25 hover:ring-white/50",
						"cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70",
					)}
				>
					{identity.initials}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
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
				{isDeveloper && (
					<DropdownMenuItem asChild>
						<Link to="/console/profile">
							<UserRound />
							My Profile
						</Link>
					</DropdownMenuItem>
				)}
				<DropdownMenuItem asChild>
					<Link to="/console">
						<LayoutDashboard />
						Console
					</Link>
				</DropdownMenuItem>
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
				{isAdmin && (
					<DropdownMenuItem asChild>
						<Link to="/admin">
							<ShieldCheck />
							Admin console
						</Link>
					</DropdownMenuItem>
				)}
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
