import { useConsoleMe } from "@/components/console/ConsoleLayout";
import BusinessDashboard from "@/components/console/dashboard/BusinessDashboard";
import NextStepsCard from "@/components/console/NextStepsCard";
import ProfileCard from "@/components/console/ProfileCard";
import { isProvisioned } from "@/lib/auth/client";
import { SHOW_BUSINESS_DASHBOARD } from "@/lib/config/features";

/**
 * Console Home.
 *
 * Two blocks side by side: who is signed in, and what that account still has to
 * do to go live. Every account, in every lifecycle state, lands on the same
 * pair — the profile card carries the state badge, so the state is still on the
 * page without a block of its own.
 *
 * The business dashboard is the last block and is doubly gated. `isProvisioned`
 * because there is nothing to aggregate for an account that has never
 * transacted, and a wall of zeros would read as a fault; and the flag because
 * the numbers are not yet reconciled — see `docs/features/business-dashboard.md`.
 * Neither branch fetches, so a hidden dashboard costs no request.
 */
export default function ConsoleHome() {
	const me = useConsoleMe();
	return (
		<div className="flex flex-col gap-6">
			<h2 className="text-lg font-semibold text-eko-navy">Home</h2>
			{/* One column below `lg` — the profile card stacks above the steps, the
			    same order it reads in on a wide screen. */}
			<div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
				<ProfileCard me={me} />
				<NextStepsCard me={me} />
			</div>
			{isProvisioned(me.state) && SHOW_BUSINESS_DASHBOARD ? (
				<BusinessDashboard />
			) : null}
		</div>
	);
}
