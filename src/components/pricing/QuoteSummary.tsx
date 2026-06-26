import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
	GST_RATE,
	HAS_VOLUME_DISCOUNTS,
	displayName,
	type Quote,
} from "@/lib/data/api-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-chat";
import { ArrowRight, FileSpreadsheet, Link2 } from "lucide-react";

interface QuoteSummaryProps {
	quote: Quote;
	includeGst: boolean;
	onIncludeGstChange: (include: boolean) => void;
	/** Adds a popular API when the selection is empty (quick-add chips) */
	onQuickAdd: (apiId: string) => void;
}

/** Popular quick-add chips shown in the empty state */
const QUICK_ADD_APIS = [
	{ id: "pan-lite", label: "PAN Lite" },
	{ id: "bank-pennydrop", label: "Bank Pennydrop" },
	{ id: "upi-vpa", label: "UPI ID" },
];

/** Gold "Limited-time offer" pill shown next to the waived setup fee */
const LimitedTimeOfferBadge = () => (
	<Badge className="bg-eko-gold/15 text-amber-700 hover:bg-eko-gold/15 border-0 text-[10px] px-1.5">
		Limited-time offer
	</Badge>
);

/**
 * Live monthly estimate panel. Rendered in the desktop sticky sidebar and
 * inside the mobile drawer — one component, two slots.
 */
export const QuoteSummary = ({
	quote,
	includeGst,
	onIncludeGstChange,
	onQuickAdd,
}: QuoteSummaryProps) => {
	const headlineTotal = includeGst ? quote.total : quote.subtotal;
	const isEmpty = quote.lines.length === 0;
	const { setupFee } = quote;

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
				<h3 className="text-white font-bold">Your monthly estimate</h3>
				<p className="text-white/60 text-xs mt-0.5">
					Pay per use · No minimum commitment
				</p>
			</div>

			<div className="p-5">
				{isEmpty ? (
					<div className="text-center py-4">
						<p className="text-sm text-muted-foreground mb-4">
							Select APIs to see your monthly cost estimate.
						</p>
						<div className="flex flex-wrap justify-center gap-2">
							{QUICK_ADD_APIS.map((chip) => (
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
									key={line.api.id}
									className="flex items-baseline justify-between gap-3 text-sm"
								>
									<span className="text-muted-foreground truncate">
										{displayName(line.api)}
										<span className="text-xs text-muted-foreground/70 whitespace-nowrap">
											{" "}
											· {formatIndianCompact(line.volume)} ×{" "}
											{formatINRRate(line.rate)}
										</span>
										{line.rate < line.api.tiers[0].rate && (
											<span className="ml-1.5 text-[10px] font-medium text-eko-success whitespace-nowrap">
												volume discount
											</span>
										)}
									</span>
									<span className="font-medium text-foreground tabular-nums whitespace-nowrap">
										{formatINR(line.cost, 0)}
									</span>
								</li>
							))}
						</ul>

						<Separator className="mb-3" />

						<div className="flex justify-between text-sm mb-1.5">
							<span className="text-muted-foreground">Subtotal</span>
							<span className="font-medium tabular-nums">
								{formatINR(quote.subtotal, 0)}
							</span>
						</div>
						<div className="flex justify-between text-sm mb-1.5">
							<span className="text-muted-foreground">
								GST @ {Math.round(GST_RATE * 100)}%
							</span>
							<span className="font-medium tabular-nums">
								{formatINR(quote.gst, 0)}
							</span>
						</div>

						{/* One-time setup fee — separate from the monthly total */}
						<div className="flex items-baseline justify-between gap-2 text-sm mb-3">
							<span className="text-muted-foreground">
								One-time setup fee
								{setupFee.appliedPacks.length > 0 && (
									<span className="text-xs text-muted-foreground/70">
										{" "}
										· {setupFee.appliedPacks.join(", ")}
									</span>
								)}
							</span>
							<span className="flex items-center gap-1.5 whitespace-nowrap">
								{setupFee.waived ? (
									<>
										<LimitedTimeOfferBadge />
										{setupFee.amount > 0 && (
											<span className="text-xs text-muted-foreground/70 line-through tabular-nums">
												{formatINR(setupFee.amount, 0)}
											</span>
										)}
										<span className="font-medium text-eko-success tabular-nums">
											₹0
										</span>
									</>
								) : (
									<span className="font-medium tabular-nums">
										{formatINR(setupFee.payable, 0)}
									</span>
								)}
							</span>
						</div>

						<div className="rounded-xl bg-muted/60 px-4 py-3 mb-1">
							<div className="flex items-end justify-between gap-2">
								<div>
									<p className="text-xs text-muted-foreground">
										Total {includeGst ? "incl." : "excl."} GST
									</p>
									<p className="text-2xl font-bold text-foreground tabular-nums">
										{formatINR(headlineTotal, 0)}
										<span className="text-sm font-normal text-muted-foreground">
											/mo
										</span>
									</p>
								</div>
								<label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pb-1">
									<Switch
										checked={includeGst}
										onCheckedChange={onIncludeGstChange}
										aria-label="Include GST in total"
										className="data-[state=checked]:bg-eko-gold"
									/>
									incl. GST
								</label>
							</div>
							{quote.totalVolume > 0 && (
								<p className="text-xs text-muted-foreground mt-1.5">
									≈ {formatINRRate(quote.effectiveRate)} per verification ·{" "}
									{formatIndianCompact(quote.totalVolume)} txns/mo
								</p>
							)}
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
					Billed per successful transaction.
					{HAS_VOLUME_DISCOUNTS &&
						" Volume discounts apply automatically at higher volumes."}
				</p>
			</div>
		</div>
	);
};
