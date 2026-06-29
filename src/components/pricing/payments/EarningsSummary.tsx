import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { TDS_RATE, type EarningsQuote } from "@/lib/data/payments-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-chat";
import { ArrowRight, FileSpreadsheet, Link2 } from "lucide-react";

interface EarningsSummaryProps {
	quote: EarningsQuote;
	/** Adds a popular product when the selection is empty (quick-add chips) */
	onQuickAdd: (productId: string) => void;
}

/** Popular quick-add chips shown in the empty state */
const QUICK_ADD_PRODUCTS = [
	{ id: "dmt", label: "DMT" },
	{ id: "aeps-cashout", label: "AePS Cashout" },
	{ id: "bbps-electricity", label: "BBPS Electricity" },
];

/**
 * Live monthly EARNINGS panel for Payments & BC products — the inverse of
 * QuoteSummary's cost framing. Headline is the gross monthly commission
 * (excl. GST) with an indicative after-TDS line beneath it. Rendered in the
 * desktop sticky sidebar and inside the mobile drawer.
 */
export const EarningsSummary = ({
	quote,
	onQuickAdd,
}: EarningsSummaryProps) => {
	const isEmpty = quote.lines.length === 0;

	const copyShareLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success("Estimate link copied to clipboard");
		} catch {
			toast.error("Could not copy link");
		}
	};

	return (
		<div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
			<div className="bg-eko-navy px-5 py-4">
				<h3 className="text-white font-bold">
					Your estimated monthly earnings
				</h3>
				<p className="text-white/60 text-xs mt-0.5">
					Commission paid to you · Excl. GST
				</p>
			</div>

			<div className="p-5">
				{isEmpty ? (
					<div className="text-center py-4">
						<p className="text-sm text-muted-foreground mb-4">
							Select products to estimate your monthly commission earnings.
						</p>
						<div className="flex flex-wrap justify-center gap-2">
							{QUICK_ADD_PRODUCTS.map((chip) => (
								<button
									key={chip.id}
									type="button"
									onClick={() => onQuickAdd(chip.id)}
									className="px-3 py-1.5 rounded-full text-xs font-medium bg-eko-gold/10 text-amber-700 hover:bg-eko-gold/20 transition-colors"
								>
									+ {chip.label}
								</button>
							))}
						</div>
					</div>
				) : (
					<>
						<ul className="flex flex-col gap-2.5 mb-4">
							{quote.lines.map((line) => (
								<li
									key={line.product.id}
									className="flex items-baseline justify-between gap-3 text-sm"
								>
									<span className="text-muted-foreground truncate">
										{line.product.name}
										<span className="text-xs text-muted-foreground/70 whitespace-nowrap">
											{" "}
											· {formatIndianCompact(line.monthlyTxns)} ×{" "}
											{formatINRRate(line.perTxn)}
										</span>
									</span>
									<span className="font-medium text-eko-success tabular-nums whitespace-nowrap">
										+{formatINR(line.monthlyEarnings, 0)}
									</span>
								</li>
							))}
						</ul>

						<Separator className="mb-3" />

						<div className="rounded-xl bg-eko-success/10 px-4 py-3 mb-1">
							<p className="text-xs text-muted-foreground">
								Gross monthly commission (excl. GST)
							</p>
							<p className="text-2xl font-bold text-eko-success tabular-nums">
								{formatINR(quote.total, 0)}
								<span className="text-sm font-normal text-muted-foreground">
									/mo
								</span>
							</p>
							<p className="text-xs text-muted-foreground mt-1.5">
								≈ {formatINR(quote.totalAfterTds, 0)} after TDS @{" "}
								{Math.round(TDS_RATE * 100)}% ·{" "}
								{formatIndianCompact(quote.totalTxns)} txns/mo
							</p>
						</div>
					</>
				)}

				<div className="flex flex-col gap-2.5 mt-5">
					<Button variant="gold" size="lg" onClick={() => openZohoChat()}>
						Get Started <ArrowRight className="w-4 h-4" />
					</Button>
					{!isEmpty && (
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground"
							onClick={copyShareLink}
						>
							<Link2 className="w-3.5 h-3.5" /> Copy estimate link
						</Button>
					)}
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="text-muted-foreground"
					>
						<a href="/eps-pricing-calculator.xlsx" download>
							<FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel
							calculator
						</a>
					</Button>
				</div>

				<p className="text-[11px] text-muted-foreground/80 mt-4 leading-relaxed">
					Estimates use your average transaction amount; actual earnings depend
					on each transaction's slab. DMT senders pay a 1% fee (min ₹10) and a
					one-time ₹11 KYC charge. AePS settlements carry a ₹5–₹10 + GST charge.
					BBPS rates vary by operator — see the Excel rate card.
				</p>
			</div>
		</div>
	);
};
