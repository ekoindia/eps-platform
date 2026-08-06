import { useConsoleMe } from "@/components/console/ConsoleLayout";
import BusinessDashboard from "@/components/console/dashboard/BusinessDashboard";
import LifecycleCard from "@/components/console/LifecycleCard";
import NextStepsCard from "@/components/console/NextStepsCard";
import { SHOW_BUSINESS_DASHBOARD } from "@/lib/config/features";

/**
 * Console Home.
 *
 * Every account, in every lifecycle state, lands on the same thing: what it
 * still has to do to go live. Below that sits the lifecycle state — as the full
 * card with its call to action when something is unfinished, as a one-line
 * banner once the account is active.
 *
 * The business dashboard is the last block and is doubly gated. `active`
 * because there is nothing to aggregate for an account that has never
 * transacted, and a wall of zeros would read as a fault; and the flag because
 * the numbers are not yet reconciled — see `docs/features/business-dashboard.md`.
 * Neither branch fetches, so a hidden dashboard costs no request.
 */
export default function ConsoleHome() {
	const me = useConsoleMe();
	const active = me.state === "active";
	return (
		<div className="flex flex-col gap-6">
			<h2 className="text-lg font-semibold text-eko-navy">Home</h2>
			<NextStepsCard me={me} />
			<LifecycleCard me={me} variant={active ? "banner" : "card"} />
			{active && SHOW_BUSINESS_DASHBOARD ? <BusinessDashboard /> : null}
		</div>
	);
}
