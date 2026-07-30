import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type DashboardMetric,
	type DashboardView,
	type ServiceRef,
	deltaOf,
} from "@/lib/console/dashboard";
import { cn, formatINR } from "@/lib/utils";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";

/**
 * Period-on-period change, when there is one worth showing.
 *
 * Colour follows direction only — up is green, down is red — with no judgement
 * about whether that is good: a rise in failures is not a win, and this chip has
 * no way to know which metric it is attached to.
 */
function Delta({ metric }: { metric: DashboardMetric }) {
	const delta = deltaOf(metric);
	if (!delta) return null;
	const Icon = delta.up ? ArrowUpRight : ArrowDownRight;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
				delta.up ? "text-eko-success" : "text-destructive",
			)}
		>
			<Icon className="h-3 w-3" aria-hidden="true" />
			{delta.label}
		</span>
	);
}

/** One secondary count: a number over its label. */
function Tile({
	label,
	metric,
	format = (n: number) => n.toLocaleString("en-IN"),
}: {
	label: string;
	metric: DashboardMetric;
	format?: (value: number) => string;
}) {
	return (
		<div className="border-l pl-3">
			<div className="flex items-baseline gap-2">
				<span className="text-xl font-semibold tabular-nums text-eko-navy">
					{format(metric.value)}
				</span>
				<Delta metric={metric} />
			</div>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	);
}

/**
 * Business Overview.
 *
 * API call volume leads, at roughly double the weight of everything else: an EPS
 * partner is billed per call, so that is the number they came for. Money follows
 * in a muted row — the inverse of Eloka's ordering, where GTV is the headline
 * because its users move other people's money for a commission.
 */
export default function OverviewWidget({
	view,
	services,
	typeId,
	onTypeIdChange,
}: {
	view: DashboardView;
	/** Selectable services, sticky across filtered views. */
	services: ServiceRef[];
	/** The selected service, or undefined for all of them. */
	typeId?: string;
	onTypeIdChange: (typeId: string | undefined) => void;
}) {
	const { overview } = view;

	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
				<CardTitle className="flex items-center gap-2 text-base">
					<Activity className="h-4 w-4 text-eko-navy" aria-hidden="true" />
					Business Overview
				</CardTitle>

				{/* A native select on purpose: keyboard, mobile wheel and screen-reader
				    behaviour come free, and this replaced a static GTV-by-service list —
				    the same numbers, now scoped to what you pick. Hidden when there is
				    nothing to choose between. */}
				{services.length > 1 ? (
					<select
						aria-label="Filter by service"
						className="h-9 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						value={typeId ?? ""}
						onChange={(e) => onTypeIdChange(e.target.value || undefined)}
					>
						<option value="">All Services</option>
						{services.map((service) => (
							<option key={service.typeId} value={service.typeId}>
								{service.label}
							</option>
						))}
					</select>
				) : null}
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
					<div className="border-l-2 border-eko-navy pl-4">
						<div className="flex items-baseline gap-2">
							<span className="text-4xl font-bold tabular-nums text-eko-navy">
								{overview.transactions.value.toLocaleString("en-IN")}
							</span>
							<Delta metric={overview.transactions} />
						</div>
						<p className="text-sm font-medium text-muted-foreground">
							Total Transactions
						</p>
					</div>

					<div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
						<Tile label="Successful" metric={overview.successCases} />
						<Tile label="Failed" metric={overview.failedCases} />
						<Tile label="Pending" metric={overview.pending} />
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
					<Tile
						label="GTV"
						metric={overview.gtv}
						format={(n) => formatINR(n)}
					/>
					<Tile
						label="Total Charges"
						metric={overview.revenue}
						format={(n) => formatINR(n, 2, 2)}
					/>
					<Tile
						label="Average Charge"
						metric={overview.averageRevenue}
						format={(n) => formatINR(n, 2, 2)}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
