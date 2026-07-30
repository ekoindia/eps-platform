import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceCount } from "@/lib/console/dashboard";
import { hueOf } from "@/lib/console/transactions";
import { formatIndianCompact } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";

/** Services listed before the tail is dropped. Beyond this the bars are noise. */
const MAX_ROWS = 10;

/**
 * Most Used Services.
 *
 * A horizontal bar per service, ordered by call count. Colour comes from
 * `hueOf(name)`, the same deterministic hash the transaction list uses for its
 * avatars, so one service keeps one colour across every widget on this page and
 * across sessions — a fixed palette cycled by index would repaint everything the
 * moment a service's rank changed.
 */
export default function MostUsedServicesWidget({
	rows,
}: {
	rows: ServiceCount[];
}) {
	// Per-row `fill` on the datum, not a <Cell> child: Cell is deprecated in
	// recharts 3 and gone in 4, and the datum's own fill is what it reads anyway.
	const data = rows.slice(0, MAX_ROWS).map((row) => ({
		...row,
		fill: `hsl(${hueOf(row.name)} 65% 60%)`,
	}));
	const top = data[0];
	const dropped = rows.length - data.length;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<TrendingUp className="h-4 w-4 text-eko-success" aria-hidden="true" />
					Most Used Services
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				{data.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No service activity in this window.
					</p>
				) : (
					<>
						<ResponsiveContainer
							width="100%"
							height={Math.max(160, data.length * 38 + 24)}
						>
							<BarChart
								data={data}
								layout="vertical"
								margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
							>
								<CartesianGrid horizontal={false} strokeOpacity={0.2} />
								<XAxis
									type="number"
									tickFormatter={formatIndianCompact}
									tick={{ fontSize: 11 }}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									type="category"
									dataKey="name"
									width={96}
									tick={{ fontSize: 11 }}
									axisLine={false}
									tickLine={false}
								/>
								<Bar dataKey="totalCount" radius={[0, 4, 4, 0]} barSize={18} />
							</BarChart>
						</ResponsiveContainer>
						{/* The chart is an SVG: invisible to a screen reader, and zero-width
						    in jsdom. This line carries the same finding in text. */}
						<p className="text-xs text-muted-foreground">
							Top: {top.name} ({top.totalCount.toLocaleString("en-IN")} calls)
							{dropped > 0 ? ` · ${dropped} more not shown` : ""}
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}
