import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/AuthProvider";
import { accountIdentity } from "@/lib/auth/identity";
import { cn } from "@/lib/utils";
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Persistent account avatar + dropdown for the desktop header. Renders nothing
 * until the session resolves to an authenticated user, so SSG/first-client
 * markup stays stable (avoids hydration mismatch). Logout is immediate.
 */
export function UserMenu() {
	const { state, logout } = useAuth();
	const identity = accountIdentity(state);
	if (!identity || state.status !== "authed") return null;

	const isAdmin = state.role === "admin";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					aria-label="Account menu"
					className={cn(
						"flex h-9 w-9 items-center justify-center rounded-full",
						"bg-white/15 text-sm font-semibold text-white",
						"transition-colors hover:bg-white/25 focus-visible:outline-hidden",
						"focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer",
					)}
				>
					{identity.initials}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<div className="px-2 py-1.5">
					<p className="truncate text-sm font-medium">{identity.name}</p>
					<p className="text-xs text-muted-foreground">{identity.detail}</p>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/console">
						<LayoutDashboard />
						Console
					</Link>
				</DropdownMenuItem>
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
