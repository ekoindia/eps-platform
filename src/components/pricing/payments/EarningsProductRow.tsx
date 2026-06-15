import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
	DEFAULT_MAX_TXN_AMOUNT,
	MAX_TXNS,
	dmtSlabForAmount,
	type EarningsLine,
} from "@/lib/data/payments-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { X } from "lucide-react";
import { useId } from "react";

/** Log-spaced txn-count steps for the slider (direct input allows any value) */
const TXN_STEPS = [
	0, 100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
	500_000, 1_000_000,
];

/** Slider tick labels rendered under the track */
const TICK_LABELS = [0, 1_000, 10_000, 100_000, 1_000_000];

/** Index of the step nearest to a txn count (for positioning the thumb) */
const nearestStepIndex = (txns: number): number => {
	let best = 0;
	for (let i = 1; i < TXN_STEPS.length; i++) {
		if (Math.abs(TXN_STEPS[i] - txns) < Math.abs(TXN_STEPS[best] - txns)) {
			best = i;
		}
	}
	return best;
};

interface EarningsProductRowProps {
	line: EarningsLine;
	onTxnsChange: (monthlyTxns: number) => void;
	onAvgAmountChange: (avgAmount: number) => void;
	onRemove: () => void;
}

/**
 * One selected earnings product in the Payments calculator: name +
 * commission readout, a log-stepped monthly-transactions slider with a
 * free-form numeric input, an average-amount input (when the commission
 * depends on it), and the live monthly earnings for the line.
 */
export const EarningsProductRow = ({
	line,
	onTxnsChange,
	onAvgAmountChange,
	onRemove,
}: EarningsProductRowProps) => {
	const txnsInputId = useId();
	const amountInputId = useId();
	const { product } = line;

	const handleTxnsInput = (raw: string) => {
		const parsed = Number(raw.replace(/[^\d]/g, ""));
		onTxnsChange(Math.min(Number.isFinite(parsed) ? parsed : 0, MAX_TXNS));
	};

	const handleAmountInput = (raw: string) => {
		const parsed = Number(raw.replace(/[^\d]/g, ""));
		onAvgAmountChange(
			Math.min(
				Number.isFinite(parsed) ? parsed : 0,
				product.maxTxnAmount ?? DEFAULT_MAX_TXN_AMOUNT,
			),
		);
	};

	// For DMT, surface the matched commission slab so the estimate is legible
	const dmtSlab =
		product.id === "dmt" ? dmtSlabForAmount(line.avgAmount) : null;

	return (
		<div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
			<div className="flex items-start justify-between gap-3 mb-4">
				<div>
					<h4 className="font-semibold text-foreground leading-tight">
						{product.name}
					</h4>
					<p className="text-xs text-muted-foreground mt-0.5">
						{dmtSlab
							? `₹${dmtSlab.from.toLocaleString("en-IN")}–₹${dmtSlab.upTo.toLocaleString("en-IN")} slab → ${formatINRRate(line.perTxn)}/txn`
							: `${formatINRRate(line.perTxn)} per transaction`}
						{product.notes && (
							<span className="text-muted-foreground/70">
								{" "}
								· {product.notes}
							</span>
						)}
					</p>
				</div>
				<div className="flex items-center gap-3 shrink-0">
					<span className="font-bold text-eko-success tabular-nums whitespace-nowrap">
						+{formatINR(line.monthlyEarnings, 0)}
						<span className="text-xs font-normal text-muted-foreground">
							/mo
						</span>
					</span>
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Remove ${product.name}`}
						className="h-7 w-7 -mr-1 text-muted-foreground hover:text-destructive"
						onClick={onRemove}
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
				<div className="flex-1 pt-1">
					<Slider
						value={[nearestStepIndex(line.monthlyTxns)]}
						min={0}
						max={TXN_STEPS.length - 1}
						step={1}
						onValueChange={([stepIndex]) => onTxnsChange(TXN_STEPS[stepIndex])}
						aria-label={`${product.name} monthly transactions`}
						className="[&_[role=slider]]:border-eko-gold [&_.bg-primary]:bg-eko-gold"
					/>
					<div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/70 tabular-nums">
						{TICK_LABELS.map((tick) => (
							<span key={tick}>{formatIndianCompact(tick)}</span>
						))}
					</div>
				</div>
				<div className="shrink-0 sm:w-32">
					<label htmlFor={txnsInputId} className="sr-only">
						{product.name} monthly transactions
					</label>
					<div className="relative">
						<Input
							id={txnsInputId}
							inputMode="numeric"
							value={line.monthlyTxns.toLocaleString("en-IN")}
							onChange={(e) => handleTxnsInput(e.target.value)}
							className="pr-14 text-right tabular-nums font-medium"
						/>
						<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
							txn/mo
						</span>
					</div>
				</div>
				{product.needsAmount && (
					<div className="shrink-0 sm:w-36">
						<label
							htmlFor={amountInputId}
							className="text-[11px] text-muted-foreground sm:sr-only"
						>
							Avg. transaction amount
						</label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
								avg ₹
							</span>
							<Input
								id={amountInputId}
								inputMode="numeric"
								value={line.avgAmount.toLocaleString("en-IN")}
								onChange={(e) => handleAmountInput(e.target.value)}
								className="pl-12 text-right tabular-nums font-medium"
								title="Average transaction amount"
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
