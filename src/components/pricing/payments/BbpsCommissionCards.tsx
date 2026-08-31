import { Button } from "@/components/ui/button";
import {
	BBPS_CATEGORIES,
	BBPS_OFFLINE_SETTLEMENT_HOURS,
	type AmountSlab,
	type BbpsCategory,
} from "@/lib/data/payments-pricing";
import { cn, formatINRRate } from "@/lib/utils";
import { Plus } from "lucide-react";

/** Format an amount-slab range for a card row, e.g. "Up to ₹5,000" */
const slabRange = (slab: AmountSlab): string => {
	if (slab.upTo === null)
		return slab.from <= 1
			? "Any amount"
			: `Above ₹${(slab.from - 1).toLocaleString("en-IN")}`;
	return slab.from <= 1
		? `Up to ₹${slab.upTo.toLocaleString("en-IN")}`
		: `₹${slab.from.toLocaleString("en-IN")} – ₹${slab.upTo.toLocaleString("en-IN")}`;
};

/** Format a slab's commission, e.g. "₹1.20", "0.52% of bill", "No commission" */
const slabValue = (slab: AmountSlab): string => {
	if (slab.flat !== undefined)
		return slab.flat === 0 ? "No commission" : formatINRRate(slab.flat);
	return `${((slab.pct ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}% of bill`;
};

/** Headline for a mode: the single rate, or "Slab-based" when it varies */
const modeHeadline = (slabs: AmountSlab[] | null): string => {
	if (!slabs) return "Not offered";
	return slabs.length > 1 ? "Slab-based" : slabValue(slabs[0]);
};

/** The mode whose slabs need spelling out, if any */
const slabDetail = (
	category: BbpsCategory,
): { label: string; slabs: AmountSlab[] } | null => {
	if (category.offline && category.offline.length > 1)
		return {
			label: `${BBPS_OFFLINE_SETTLEMENT_HOURS}-hour slabs`,
			slabs: category.offline,
		};
	if (category.online.length > 1)
		return { label: "Instant slabs", slabs: category.online };
	return null;
};

const ModeLine = ({
	mode,
	label,
	value,
	offered,
}: {
	mode: "online" | "offline";
	label: string;
	value: string;
	offered: boolean;
}) => (
	<div
		className={cn(
			"border-l-[3px] pl-3 py-0.5",
			mode === "offline" ? "border-eko-gold" : "border-border",
		)}
	>
		<p className="text-xs">
			<span className="font-semibold text-foreground">
				{mode === "offline" ? "Offline" : "Online"}
			</span>{" "}
			<span className="text-muted-foreground">{label}</span>
		</p>
		<p
			className={cn(
				"text-lg font-bold leading-tight tabular-nums",
				offered ? "text-eko-success" : "text-muted-foreground/70",
			)}
		>
			{value}
		</p>
	</div>
);

const CategoryCard = ({
	category,
	onAdd,
}: {
	category: BbpsCategory;
	onAdd: (productId: string) => void;
}) => {
	const detail = slabDetail(category);
	const notes = [category.rangeNote, category.offlineNote].filter(Boolean);

	return (
		<div className="rounded-2xl border border-border/60 bg-card shadow-card p-5 flex flex-col">
			<div className="flex items-start gap-2 mb-4">
				<h4 className="flex-1 font-semibold text-foreground leading-tight">
					{category.name}
				</h4>
				<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
					{category.offline ? "Both modes" : "Instant only"}
				</span>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Add ${category.name} to estimate`}
					title="Add to estimate"
					className="h-6 w-6 -mt-0.5 shrink-0 text-eko-gold hover:text-eko-gold hover:bg-eko-gold/10"
					onClick={() => onAdd(category.id)}
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			<div className="flex flex-col gap-2.5">
				<ModeLine
					mode="online"
					label="(instant settlement)"
					value={modeHeadline(category.online)}
					offered
				/>
				<ModeLine
					mode="offline"
					label={`(${BBPS_OFFLINE_SETTLEMENT_HOURS}-hour settlement · higher)`}
					value={modeHeadline(category.offline)}
					offered={category.offline !== null}
				/>
			</div>

			{detail && (
				<div className="mt-4 pt-4 border-t border-dashed border-border/70">
					<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">
						{detail.label}
					</p>
					<dl className="flex flex-col gap-1 text-sm">
						{detail.slabs.map((slab) => (
							<div key={slab.from} className="flex justify-between gap-3">
								<dt className="text-muted-foreground tabular-nums">
									{slabRange(slab)}
								</dt>
								<dd className="font-semibold text-eko-success tabular-nums whitespace-nowrap">
									{slabValue(slab)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			)}

			{notes.length > 0 && (
				<p className="mt-3 text-xs text-muted-foreground/80">
					{notes.join(" · ")}
				</p>
			)}
		</div>
	);
};

/**
 * BBPS commission rate card as a grid of per-category cards — both
 * settlement modes side by side, with the slab table stacked inside the card
 * for categories whose rate varies by bill amount.
 * @param onAdd - Adds a category to the earnings estimate
 */
export const BbpsCommissionCards = ({
	onAdd,
}: {
	onAdd: (productId: string) => void;
}) => (
	<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{BBPS_CATEGORIES.map((category) => (
			<CategoryCard key={category.id} category={category} onAdd={onAdd} />
		))}
	</div>
);
