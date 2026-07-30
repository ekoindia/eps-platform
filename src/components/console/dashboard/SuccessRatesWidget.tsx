import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceSuccess } from "@/lib/console/dashboard";
import { successPct } from "@/lib/console/dashboard";
import { ShieldCheck } from "lucide-react";
import { Pie, PieChart } from "recharts";

/** Gauge colours: the success arc and the remainder. Eloka's own pair. */
const OK = "#76c68f";
const BAD = "#FF6B6B";

/** A small donut gauge for one service's success rate. */
function Gauge({ pct }: { pct: number }) {
	// Fill lives on the datum rather than in <Cell> children: Cell is deprecated
	// in recharts 3 and removed in 4.
	const data = [
		{ value: pct, fill: OK },
		{ value: Math.max(0, 100 - pct), fill: pct >= 100 ? OK : BAD },
	];
	return (
		// Fixed size, not a ResponsiveContainer: this is a 34px glyph in a row, and
		// a responsive wrapper would measure to zero inside a flex row anyway.
		<PieChart width={34} height={34}>
			<Pie
				data={data}
				dataKey="value"
				cx="50%"
				cy="50%"
				innerRadius={10}
				outerRadius={17}
				startAngle={90}
				endAngle={-270}
				stroke="none"
				isAnimationActive={false}
			/>
		</PieChart>
	);
}

/**
 * Success Rates, per service.
 *
 * Sorted by volume rather than by rate, deliberately: a 0% rate on the one call
 * someone made last week is noise, and a 92% rate on forty thousand calls is the
 * thing worth seeing first.
 */
export default function SuccessRatesWidget({
	rows,
}: {
	rows: ServiceSuccess[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<ShieldCheck
						className="h-4 w-4 text-eko-success"
						aria-hidden="true"
					/>
					Success Rates
				</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No service activity in this window.
					</p>
				) : (
					<ul className="flex max-h-96 flex-col divide-y overflow-y-auto">
						{rows.map((row) => {
							const pct = successPct(row.successCount, row.totalCount);
							return (
								<li
									key={row.typeId}
									className="flex items-center gap-3 py-2 text-sm"
								>
									<span className="min-w-0 flex-1 truncate">{row.name}</span>
									<span className="font-semibold tabular-nums text-eko-navy">
										{pct.toFixed(2)}%
									</span>
									<Gauge pct={pct} />
									{/* The gauge is decorative; this is what a screen reader
									    and a jsdom test both read. */}
									<span className="sr-only">
										{row.successCount} of {row.totalCount} succeeded
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
