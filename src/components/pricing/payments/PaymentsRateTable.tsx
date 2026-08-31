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
import { BbpsCommissionCards } from "@/components/pricing/payments/BbpsCommissionCards";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_MODE_PARAM,
	BBPS_OFFLINE_SETTLEMENT_HOURS,
	TDS_RATE,
	type AmountSlab,
} from "@/lib/data/payments-pricing";
import { formatINRRate } from "@/lib/utils";
import { FileSpreadsheet, Plus, Timer, Zap } from "lucide-react";

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
	bare = false,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	delay: number;
	/** Render children directly instead of inside a bordered card shell */
	bare?: boolean;
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
		{bare ? (
			children
		) : (
			<div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
				{children}
			</div>
		)}
	</FadeIn>
);

/**
 * Explains the two BBPS settlement modes and the `communication` request
 * parameter that switches between them, ahead of the commission cards.
 */
const BbpsModeExplainer = () => (
	<div className="mb-5 rounded-2xl border border-border/60 bg-muted/30 p-4 sm:p-5">
		<div className="grid sm:grid-cols-2 gap-4">
			<div className="flex gap-3">
				<Zap className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
				<div>
					<p className="text-sm font-semibold text-foreground">
						Online · instant settlement
					</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						The default. The bill is settled with the biller instantly, at the
						standard commission.
					</p>
				</div>
			</div>
			<div className="flex gap-3">
				<Timer className="w-4 h-4 mt-0.5 shrink-0 text-eko-gold" />
				<div>
					<p className="text-sm font-semibold text-foreground">
						Offline · higher commission
					</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Settles in a minimum of {BBPS_OFFLINE_SETTLEMENT_HOURS} working
						hours and pays the agent more. Offered on selected categories.
					</p>
				</div>
			</div>
		</div>
		<p className="mt-4 pt-4 border-t border-dashed border-border/70 text-xs text-muted-foreground">
			Pick the mode per transaction with the optional{" "}
			<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
				communication
			</code>{" "}
			parameter — <code className="font-mono">{BBPS_MODE_PARAM.online}</code>{" "}
			for online (default),{" "}
			<code className="font-mono">{BBPS_MODE_PARAM.offline}</code> for offline.
			Send the same value on both{" "}
			<a href="/docs/bbps-fetch-bill" className="underline hover:text-eko-gold">
				Fetch Bill
			</a>{" "}
			and{" "}
			<a href="/docs/bbps-pay-bill" className="underline hover:text-eko-gold">
				Pay Bill
			</a>
			.
		</p>
	</div>
);

/**
 * Static, crawlable commission tables for AePS and BBPS — rendered
 * server-side (SSG) so rates are indexable. The "+" buttons hand off to the
 * payments earnings calculator above.
 */
export const PaymentsRateTable = () => (
	<div className="max-w-6xl mx-auto">
		{/* AePS */}
		<div className="max-w-3xl mx-auto">
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
		</div>

		{/* BBPS categories */}
		<SectionCard
			title="BBPS — Commission by bill category"
			subtitle="Lowest operator rate shown where rates vary — conservative estimate"
			delay={100}
			bare
		>
			<BbpsModeExplainer />
			<BbpsCommissionCards onAdd={addProductToEstimate} />
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
