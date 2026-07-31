import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsagePoint } from "@/lib/console/dashboard";
import { isHourlyRange, summarizeUsage } from "@/lib/console/dashboard";
import { formatIndianCompact } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import {
	Area,
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

const BAR = "#7eb0d5";
const TREND = "#bd7ebe";

/** One headline figure above the chart. */
function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-l-2 border-eko-navy/30 pl-3">
			<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<p className="text-2xl font-semibold tabular-nums text-eko-navy">
				{value}
			</p>
		</div>
	);
}

/**
 * Usage Analytics: per-bucket call volume with a cumulative trend.
 *
 * Upstream chooses the bucket size and does not say what it chose, so the
 * running total, the average, the peak and the axis labels are all derived here
 * — see `summarizeUsage`.
 */
export default function UsageAnalyticsWidget({
	usage,
}: {
	usage: UsagePoint[];
}) {
	const { series, total, average, peak, peakLabel } = summarizeUsage(usage);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<BarChart3 className="h-4 w-4 text-eko-navy" aria-hidden="true" />
					Usage Analytics
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<Stat label="Total Volume" value={total.toLocaleString("en-IN")} />
					{/* Named after what a bucket actually is in this window, as Eloka
					    does — "Avg / Bucket" is accurate and tells a partner nothing. */}
					<Stat
						label={isHourlyRange(usage) ? "Avg / Hour" : "Avg / Day"}
						value={average.toLocaleString("en-IN")}
					/>
					<Stat label="Peak Volume" value={peak.toLocaleString("en-IN")} />
					<Stat label="Peak Time" value={peakLabel} />
				</div>

				{series.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No usage recorded in this window.
					</p>
				) : (
					<ResponsiveContainer width="100%" height={280}>
						<ComposedChart
							data={series}
							margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
						>
							<defs>
								<linearGradient id="usageTrend" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={TREND} stopOpacity={0.3} />
									<stop offset="100%" stopColor={TREND} stopOpacity={0.05} />
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} strokeOpacity={0.2} />
							<XAxis
								dataKey="label"
								tick={{ fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								minTickGap={16}
							/>
							<YAxis
								yAxisId="left"
								tick={{ fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								tickFormatter={formatIndianCompact}
							/>
							<YAxis
								yAxisId="right"
								orientation="right"
								tick={{ fontSize: 11, fill: TREND }}
								axisLine={false}
								tickLine={false}
								tickFormatter={formatIndianCompact}
							/>
							<Tooltip
								formatter={(value: number) => value.toLocaleString("en-IN")}
							/>
							{/* `position`, not the deprecated align/verticalAlign pair. */}
							<Legend position="insideTopRight" iconType="circle" />
							{/* Area first so the bars sit on top of the trend, not under it. */}
							<Area
								yAxisId="right"
								type="monotone"
								dataKey="cumulativeCount"
								name="Cumulative"
								stroke={TREND}
								strokeWidth={2}
								fill="url(#usageTrend)"
							/>
							<Bar
								yAxisId="left"
								dataKey="totalCount"
								name="Transactions"
								fill={BAR}
								radius={[3, 3, 0, 0]}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
