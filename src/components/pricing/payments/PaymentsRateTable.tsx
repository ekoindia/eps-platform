import { FadeIn } from "@/components/FadeIn";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_CATEGORIES,
	TDS_RATE,
	type AmountSlab,
} from "@/lib/data/payments-pricing";
import { formatINRRate } from "@/lib/utils";
import { FileSpreadsheet, Plus } from "lucide-react";

/**
 * Custom event dispatched when a payments rate-table "+" button is clicked.
 * PaymentsCalculator listens for this to add the product and scroll into view.
 */
export const ADD_EARNINGS_EVENT = "pricing:add-earnings-product";

/**
 * Dispatches the add-to-estimate event for an earnings product and scrolls
 * the payments calculator into view.
 * @param productId - The earnings product id, e.g. "dmt" or "bbps-electricity"
 */
const addProductToEstimate = (productId: string) => {
	window.dispatchEvent(
		new CustomEvent(ADD_EARNINGS_EVENT, { detail: { productId } }),
	);
	document
		.getElementById("payments-calculator")
		?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/** Format an amount-slab range, e.g. "₹101 – ₹3,000" or "₹1,00,001+" */
const slabRange = (slab: AmountSlab): string =>
	slab.upTo === null
		? `₹${slab.from.toLocaleString("en-IN")}+`
		: `₹${slab.from.toLocaleString("en-IN")} – ₹${slab.upTo.toLocaleString("en-IN")}`;

/** Format a slab's commission, e.g. "₹1.20" or "0.52% of amount" */
const slabValue = (slab: AmountSlab): string =>
	slab.flat !== undefined
		? formatINRRate(slab.flat)
		: `${((slab.pct ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}% of amount`;

const AddButton = ({
	productId,
	name,
}: {
	productId: string;
	name: string;
}) => (
	<Button
		variant="ghost"
		size="icon"
		aria-label={`Add ${name} to estimate`}
		title="Add to estimate"
		className="h-8 w-8 text-eko-gold hover:text-eko-gold hover:bg-eko-gold/10"
		onClick={() => addProductToEstimate(productId)}
	>
		<Plus className="w-4 h-4" />
	</Button>
);

const SectionCard = ({
	title,
	subtitle,
	action,
	children,
	delay,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	delay: number;
}) => (
	<FadeIn delay={delay} className="mb-10">
		<div className="flex items-end justify-between gap-3 mb-3">
			<div>
				<h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					{title}
				</h3>
				{subtitle && (
					<p className="text-xs text-muted-foreground/80 mt-0.5">{subtitle}</p>
				)}
			</div>
			{action}
		</div>
		<div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
			{children}
		</div>
	</FadeIn>
);

/**
 * Static, crawlable commission tables for AePS and BBPS — rendered
 * server-side (SSG) so rates are indexable. The "+" buttons hand off to the
 * payments earnings calculator above.
 */
export const PaymentsRateTable = () => (
	<div className="max-w-3xl mx-auto">
		{/* AePS */}
		<SectionCard
			title="AePS — Cashout & mini statement"
			subtitle={`Mini statement earns ${formatINRRate(AEPS_MINI_STATEMENT_COMMISSION)} per transaction`}
			action={<AddButton productId="aeps-cashout" name="AePS Cashout" />}
			delay={0}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Transaction bracket</TableHead>
						<TableHead className="text-right">Cashout commission</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{AEPS_CASHOUT_SLABS.map((slab) => (
						<TableRow key={slab.from}>
							<TableCell className="py-2.5 font-medium tabular-nums">
								{slabRange(slab)}
							</TableCell>
							<TableCell className="text-right font-semibold text-eko-success tabular-nums">
								{slab.flat !== undefined
									? `${formatINRRate(slab.flat)} flat`
									: slabValue(slab)}
							</TableCell>
						</TableRow>
					))}
					{AEPS_SETTLEMENT_CHARGES.map((slab) => (
						<TableRow key={`settle-${slab.from}`}>
							<TableCell className="py-2.5 text-muted-foreground tabular-nums">
								Fund settlement · {slabRange(slab)}
							</TableCell>
							<TableCell className="text-right text-muted-foreground tabular-nums">
								{slabValue(slab)} + GST (charge)
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</SectionCard>

		{/* BBPS categories */}
		<SectionCard
			title="BBPS — Commission by bill category"
			subtitle="Lowest operator rate shown where rates vary — conservative estimate"
			delay={100}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Category</TableHead>
						<TableHead className="text-right">Commission</TableHead>
						<TableHead className="w-12 text-right sr-only">
							Add to estimate
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{BBPS_CATEGORIES.map((category) => (
						<TableRow key={category.id}>
							<TableCell className="py-2.5">
								<span className="font-medium text-foreground">
									{category.name}
								</span>
								{category.rangeNote && (
									<p className="text-xs text-muted-foreground mt-0.5">
										{category.rangeNote}
									</p>
								)}
							</TableCell>
							<TableCell className="text-right font-semibold text-eko-success tabular-nums whitespace-nowrap">
								{category.slabs.length > 1
									? category.slabs
											.map((slab) => `${slabRange(slab)}: ${slabValue(slab)}`)
											.join("; ")
									: slabValue(category.slabs[0])}
							</TableCell>
							<TableCell className="w-12 text-right">
								<AddButton productId={category.id} name={category.name} />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</SectionCard>

		<div className="text-sm text-muted-foreground text-center flex flex-col gap-1.5">
			<p>
				All commissions in ₹ per transaction, exclusive of GST @ 18%. TDS @{" "}
				{Math.round(TDS_RATE * 100)}% applies on payouts.
			</p>
			<p className="text-xs text-muted-foreground/80 inline-flex items-center justify-center gap-1.5">
				<FileSpreadsheet className="w-3.5 h-3.5" />
				Operator-wise rates for 100+ BBPS billers are in the{" "}
				<a
					href="/eps-pricing-calculator.xlsx"
					download
					className="underline hover:text-eko-gold"
				>
					downloadable Excel rate card
				</a>
				.
			</p>
		</div>
	</div>
);
