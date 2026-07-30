import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type DashboardMetric,
	type DashboardView,
	deltaOf,
} from "@/lib/console/dashboard";
import { hueOf } from "@/lib/console/transactions";
import { cn, formatINR } from "@/lib/utils";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";

/** How many services the GTV split lists before collapsing the tail. */
const BREAKDOWN_ROWS = 6;

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
export default function OverviewWidget({ view }: { view: DashboardView }) {
	const { overview } = view;
	const rows = overview.breakdown.slice(0, BREAKDOWN_ROWS);
	const hidden = overview.breakdown.length - rows.length;
	const largest = rows[0]?.amount ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Activity className="h-4 w-4 text-eko-navy" aria-hidden="true" />
					Business Overview
				</CardTitle>
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

				{rows.length > 0 ? (
					<div className="flex flex-col gap-2 border-t pt-4">
						<p className="text-xs font-medium text-muted-foreground">
							GTV by service
						</p>
						{rows.map((row) => (
							<div key={row.typeId} className="flex items-center gap-3 text-sm">
								<span
									className="h-2.5 w-2.5 shrink-0 rounded-full"
									style={{ background: `hsl(${hueOf(row.name)} 65% 55%)` }}
									aria-hidden="true"
								/>
								<span className="min-w-0 flex-1 truncate">{row.name}</span>
								<span
									className="hidden h-1.5 rounded-full bg-eko-navy/15 sm:block"
									style={{
										width: `${largest ? (row.amount / largest) * 30 : 0}%`,
									}}
									aria-hidden="true"
								/>
								<span className="tabular-nums text-muted-foreground">
									{formatINR(row.amount)}
								</span>
							</div>
						))}
						{hidden > 0 ? (
							<p className="text-xs text-muted-foreground">
								+{hidden} more service{hidden > 1 ? "s" : ""}
							</p>
						) : null}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
