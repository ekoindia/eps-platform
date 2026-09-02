import { useId } from "react";
import { HelpCircle } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	EARNINGS_GROUPS,
	commissionPerTxn,
	type EarningsProduct,
} from "@/lib/data/payments-pricing";
import { cn, formatINR, formatINRRate } from "@/lib/utils";

interface PaymentsPickerProps {
	/** Ids of currently selected earnings products */
	selectedIds: string[];
	/** Toggles a product in/out of the selection */
	onToggle: (productId: string) => void;
}

/**
 * Grouped multi-select list of all Payments & BC earnings products
 * (DMT, AePS, BBPS categories). Mirrors ApiPicker's visual language but
 * skips search — the list is short enough to scan.
 */
export const PaymentsPicker = ({
	selectedIds,
	onToggle,
}: PaymentsPickerProps) => (
	<div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
		{/* Internal scroll only on desktop — on mobile the list runs full
        height so the page is the single vertical scroller */}
		<div className="lg:max-h-[26rem] lg:overflow-y-auto overscroll-contain">
			{EARNINGS_GROUPS.map((group) => (
				<div key={group.label}>
					<div className="lg:sticky lg:top-0 z-10 px-4 py-1.5 bg-muted/90 backdrop-blur-xs text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						{group.label}
					</div>
					{group.products.map((product) => (
						<PickerRow
							key={product.id}
							product={product}
							checked={selectedIds.includes(product.id)}
							onToggle={() => onToggle(product.id)}
						/>
					))}
				</div>
			))}
		</div>
		<p className="px-4 py-2 border-t border-border/60 bg-muted/40 text-[11px] text-muted-foreground/80">
			Commission per transaction, exclusive of GST. Where operator rates vary,
			the lowest rate is used for a conservative estimate.
		</p>
	</div>
);

const PickerRow = ({
	product,
	checked,
	onToggle,
}: {
	product: EarningsProduct;
	checked: boolean;
	onToggle: () => void;
}) => {
	// Commission preview at the product's default avg amount
	const previewRate = commissionPerTxn(
		product.id,
		product.defaultAvgAmount ?? 0,
	);
	const checkboxId = useId();

	return (
		// A plain div, not a <label> — the rate explainer is a button, and
		// interactive elements cannot nest inside a label. The product name
		// carries the label instead, so it still toggles the checkbox.
		<div
			className={cn(
				"flex items-center gap-3 px-4 py-2.5 min-h-11 border-b border-border/40 last:border-b-0 transition-colors",
				checked ? "bg-eko-gold-light/60" : "hover:bg-muted/50",
			)}
		>
			<Checkbox
				id={checkboxId}
				checked={checked}
				onCheckedChange={onToggle}
				aria-label={product.name}
				className="data-[state=checked]:bg-eko-gold data-[state=checked]:border-eko-gold data-[state=checked]:text-eko-navy border-muted-foreground/40"
			/>
			<label
				htmlFor={checkboxId}
				className="flex-1 min-w-0 text-sm font-medium text-foreground cursor-pointer"
			>
				{product.name}
			</label>
			{/* Before the rate, so every row's rate stays flush to the right edge */}
			{product.amountDependent && <RateExplainer product={product} />}
			<span className="text-sm text-eko-success whitespace-nowrap tabular-nums">
				{product.notes ? "≈ " : ""}
				{formatINRRate(previewRate)}
				<span className="text-xs text-muted-foreground/70">/txn</span>
			</span>
		</div>
	);
};

/**
 * "?" affordance explaining that a row's preview rate is a percentage (or a
 * slab) applied to an assumed average amount — without it, e.g. Water Bill's
 * ₹9.60 reads as arbitrary next to a neighbouring flat ₹1.20.
 *
 * A Popover, not a Tooltip: Radix closes tooltips on pointerdown, so a tap
 * (the only gesture a touch device has) opens and instantly shuts one.
 */
const RateExplainer = ({ product }: { product: EarningsProduct }) => {
	const noun = product.family === "AePS" ? "transaction" : "bill";

	return (
		<Popover>
			<PopoverTrigger
				aria-label={`How the ${product.name} rate is calculated`}
				className="shrink-0 p-2 -mx-1 rounded-full text-muted-foreground/60 hover:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
			>
				<HelpCircle className="w-3.5 h-3.5" />
			</PopoverTrigger>
			<PopoverContent side="left" className="w-60 p-3 text-xs leading-relaxed">
				Commission varies with the {noun} amount. This preview assumes an
				average {noun} of {formatINR(product.defaultAvgAmount ?? 0)} — set your
				own after selecting the product.
			</PopoverContent>
		</Popover>
	);
};
