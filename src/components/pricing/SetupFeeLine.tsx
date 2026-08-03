import { Badge } from "@/components/ui/badge";
import { type SetupFeeQuote, setupFeeBadgeLabel } from "@/lib/data/api-pricing";
import { formatINR } from "@/lib/utils";

interface SetupFeeLineProps {
	quote: SetupFeeQuote;
	/** Show the GST-inclusive one-time outgo instead of the excl.-GST fee */
	includeGst: boolean;
	/** Overrides the "One-time setup fee" label */
	label?: string;
}

/**
 * One-time setup-fee row, shared by the verification and payments summaries.
 * Always a separate line — a one-time fee is never folded into a monthly
 * total. Shows the struck-through original next to the discounted payable
 * only when there is a real fee to discount.
 */
export const SetupFeeLine = ({
	quote,
	includeGst,
	label = "One-time setup fee",
}: SetupFeeLineProps) => {
	const badgeLabel = setupFeeBadgeLabel(quote.discountPercent);
	const showOffer = quote.amount > 0 && quote.discountPercent > 0;
	const payable = includeGst ? quote.total : quote.payable;

	// The value block cannot wrap (a struck-through price split across lines
	// is unreadable), so the label must not be squeezed to fit it. Instead the
	// whole row wraps: value drops to its own line in a narrow sidebar.
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm mb-3">
			<span className="text-muted-foreground shrink-0">
				{label}
				<span className="text-xs text-muted-foreground/70">
					{" "}
					{includeGst ? "incl." : "excl."} GST
				</span>
				{quote.appliedPacks.length > 0 && (
					<span className="text-xs text-muted-foreground/70">
						{" "}
						· {quote.appliedPacks.join(", ")}
					</span>
				)}
			</span>
			<span className="flex items-center gap-1.5 whitespace-nowrap ml-auto">
				{showOffer && (
					<>
						<Badge className="bg-eko-gold/15 text-amber-700 hover:bg-eko-gold/15 border-0 text-[10px] px-1.5 font-medium">
							{badgeLabel}
						</Badge>
						<span className="text-xs text-muted-foreground/70 line-through tabular-nums">
							{formatINR(quote.amount, 0)}
						</span>
					</>
				)}
				<span
					className={`font-medium tabular-nums ${
						showOffer ? "text-eko-success" : ""
					}`}
				>
					{formatINR(payable, 0)}
				</span>
			</span>
		</div>
	);
};
