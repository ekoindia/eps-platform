import { FadeIn } from "@/components/FadeIn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import {
	HAS_VOLUME_DISCOUNTS,
	PRICING_GROUPS,
	displayName,
	type PricedApi,
} from "@/lib/data/api-pricing";
import { formatINRRate } from "@/lib/utils";
import { ArrowUpRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Custom event dispatched when a rate-card row's "+" button is clicked.
 * PricingCalculator listens for this to add the API and scroll into view.
 */
export const ADD_API_EVENT = "pricing:add-api";

/**
 * Dispatches the add-to-estimate event for a priced API and scrolls the
 * calculator into view.
 * @param apiId - The priced API id, e.g. "pan-lite"
 */
const addApiToEstimate = (apiId: string) => {
	window.dispatchEvent(new CustomEvent(ADD_API_EVENT, { detail: { apiId } }));
	document
		.getElementById("calculator")
		?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const RateRow = ({ api }: { api: PricedApi }) => {
	const product = api.productId
		? ACTIVE_PRODUCTS_MAP[api.productId]
		: undefined;
	const rate = api.tiers[0].rate;

	return (
		<TableRow>
			<TableCell className="py-3.5">
				<div className="flex items-center gap-2 font-medium text-foreground">
					{displayName(api)}
					{api.popular && (
						<Badge className="bg-eko-gold/15 text-amber-700 hover:bg-eko-gold/15 border-0 text-[10px] px-1.5">
							Popular
						</Badge>
					)}
				</div>
				{product && (
					<Link
						to={productHref(product.slug)}
						className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-eko-gold transition-colors"
					>
						{product.shortName ?? product.name}
						<ArrowUpRight className="w-3 h-3" />
					</Link>
				)}
			</TableCell>
			<TableCell className="text-right whitespace-nowrap">
				<span className="font-semibold text-foreground tabular-nums">
					{formatINRRate(rate)}
				</span>{" "}
				<span className="text-xs text-muted-foreground">
					{api.unitLabel ?? "per verification"}
				</span>
			</TableCell>
			<TableCell className="w-12 text-right">
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Add ${api.name} to estimate`}
					title="Add to estimate"
					className="h-8 w-8 text-eko-gold hover:text-eko-gold hover:bg-eko-gold/10"
					onClick={() => addApiToEstimate(api.id)}
				>
					<Plus className="w-4 h-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
};

/**
 * Static, crawlable rate card listing every priced verification API grouped
 * by category. Rendered server-side (SSG) so rates are indexable; the "+"
 * buttons hand off to the interactive calculator above it.
 */
export const PricingTable = () => {
	return (
		<div className="max-w-3xl mx-auto">
			{PRICING_GROUPS.map((group, groupIndex) => (
				<FadeIn key={group.label} delay={groupIndex * 50} className="mb-10">
					<h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
						{group.label}
					</h3>
					<div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
						<Table>
							<TableHeader className="sr-only">
								<TableRow>
									<TableHead>API</TableHead>
									<TableHead>Rate</TableHead>
									<TableHead>Add to estimate</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{group.apis.map((api) => (
									<RateRow key={api.id} api={api} />
								))}
							</TableBody>
						</Table>
					</div>
				</FadeIn>
			))}
			<div className="text-sm text-muted-foreground text-center flex flex-col gap-1.5">
				<p>
					All prices in ₹ per transaction, exclusive of GST @ 18%.
					{HAS_VOLUME_DISCOUNTS &&
						" Volume discounts apply automatically in the calculator."}
				</p>
				<p className="text-xs text-muted-foreground/80">
					* Bulk APIs are billed per individual verification in the bulk request
					— e.g. one bulk call with 100 PANs at ₹1.20 each costs ₹120.
				</p>
			</div>
		</div>
	);
};
