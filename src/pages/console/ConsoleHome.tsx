import { useConsoleMe } from "@/components/console/ConsoleLayout";
import BusinessDashboard from "@/components/console/dashboard/BusinessDashboard";
import LifecycleCard from "@/components/console/LifecycleCard";

/**
 * Console Home.
 *
 * An active account lands on its business dashboard — that is what a partner
 * signs in to see. Every other lifecycle state has something to finish first, so
 * it gets the state card and no dashboard: there is nothing to aggregate for an
 * account that has never transacted, and a wall of zeros would read as a fault.
 */
export default function ConsoleHome() {
	const me = useConsoleMe();
	if (me.state !== "active") return <LifecycleCard me={me} />;
	return (
		<div className="flex flex-col gap-6">
			<LifecycleCard me={me} variant="banner" />
			<BusinessDashboard />
		</div>
	);
}
