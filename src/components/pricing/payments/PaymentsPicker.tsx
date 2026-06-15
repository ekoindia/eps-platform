import { Checkbox } from "@/components/ui/checkbox";
import {
	EARNINGS_GROUPS,
	commissionPerTxn,
	type EarningsProduct,
} from "@/lib/data/payments-pricing";
import { cn, formatINRRate } from "@/lib/utils";

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

	return (
		<label
			className={cn(
				"flex items-center gap-3 px-4 py-2.5 min-h-11 cursor-pointer border-b border-border/40 last:border-b-0 transition-colors",
				checked ? "bg-eko-gold-light/60" : "hover:bg-muted/50",
			)}
		>
			<Checkbox
				checked={checked}
				onCheckedChange={onToggle}
				aria-label={product.name}
				className="data-[state=checked]:bg-eko-gold data-[state=checked]:border-eko-gold data-[state=checked]:text-eko-navy border-muted-foreground/40"
			/>
			<span className="flex-1 text-sm font-medium text-foreground">
				{product.name}
			</span>
			<span className="text-sm text-eko-success whitespace-nowrap tabular-nums">
				{product.notes ? "≈ " : ""}
				{formatINRRate(previewRate)}
				<span className="text-xs text-muted-foreground/70">/txn</span>
			</span>
		</label>
	);
};
