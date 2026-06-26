import { MobileEstimateBar } from "@/components/pricing/MobileSummaryBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { GST_RATE } from "@/lib/data/api-pricing";
import {
	CB_BANKS,
	CB_MAX_BANK_USERS,
	CB_MAX_TXN_AMOUNT,
	CB_SETUP_FEE,
	CB_TXN_SLABS,
	calcCbQuote,
	type CbInput,
} from "@/lib/data/connected-banking-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { openZohoChat } from "@/lib/zoho-chat";
import { ArrowRight, Landmark, Link2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const DEFAULT_INPUT: CbInput = {
	bankUsers: 1,
	monthlyTxns: 5000,
	avgAmount: 10000,
};

/** Log-spaced txn-count steps for the slider (direct input allows any value) */
const TXN_STEPS = [
	0, 100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
	500_000, 1_000_000,
];
const TICK_LABELS = [0, 1_000, 10_000, 100_000, 1_000_000];

const nearestStepIndex = (txns: number): number => {
	let best = 0;
	for (let i = 1; i < TXN_STEPS.length; i++) {
		if (Math.abs(TXN_STEPS[i] - txns) < Math.abs(TXN_STEPS[best] - txns)) {
			best = i;
		}
	}
	return best;
};

/**
 * Parses the Connected Banking input from the `cb` URL param.
 * Format: `cb=bankUsers:monthlyTxns:avgAmount`. Invalid values fall back
 * to defaults; calcCbQuote clamps everything anyway.
 */
const parseInputFromParams = (params: URLSearchParams): CbInput | null => {
	const raw = params.get("cb");
	if (!raw) return null;
	const [bankUsers, monthlyTxns, avgAmount] = raw.split(":").map(Number);
	return {
		bankUsers: Number.isFinite(bankUsers) ? bankUsers : DEFAULT_INPUT.bankUsers,
		monthlyTxns: Number.isFinite(monthlyTxns)
			? monthlyTxns
			: DEFAULT_INPUT.monthlyTxns,
		avgAmount: Number.isFinite(avgAmount) ? avgAmount : DEFAULT_INPUT.avgAmount,
	};
};

/**
 * Connected Banking cost calculator (virtual accounts & BaaS): bank-
 * integration stepper, monthly txn volume and average amount inputs, with
 * the one-time setup block kept visually separate from the monthly block.
 * Input state is mirrored into the URL (`?cb=…`) — only the `cb` key is
 * touched. Includes the static bank list + slab rate table for SEO.
 */
export const ConnectedBankingCalculator = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [input, setInput] = useState<CbInput>(
		() => parseInputFromParams(searchParams) ?? DEFAULT_INPUT,
	);
	const [touched, setTouched] = useState(() => searchParams.get("cb") !== null);
	const writeBackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const quote = useMemo(() => calcCbQuote(input), [input]);

	// Mirror state into the URL (debounced). Only the `cb` key is rewritten;
	// it is written only after the user changes something (touched).
	useEffect(() => {
		if (!touched) return;
		writeBackTimer.current = setTimeout(() => {
			setSearchParams(
				(prev) => {
					const params = new URLSearchParams(prev);
					params.set(
						"cb",
						`${input.bankUsers}:${input.monthlyTxns}:${input.avgAmount}`,
					);
					return params;
				},
				{ replace: true, preventScrollReset: true },
			);
		}, 300);
		return () => clearTimeout(writeBackTimer.current);
	}, [input, touched, setSearchParams]);

	const update = (patch: Partial<CbInput>) => {
		setTouched(true);
		setInput((prev) => ({ ...prev, ...patch }));
	};

	const handleNumericInput = (raw: string, key: keyof CbInput, max: number) => {
		const parsed = Number(raw.replace(/[^\d]/g, ""));
		update({ [key]: Math.min(Number.isFinite(parsed) ? parsed : 0, max) });
	};

	const copyShareLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success("Estimate link copied to clipboard");
		} catch {
			toast.error("Could not copy link");
		}
	};

	const summary = (
		<div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
			<div className="bg-eko-navy px-5 py-4">
				<h3 className="text-white font-bold">
					Your Connected Banking estimate
				</h3>
				<p className="text-white/60 text-xs mt-0.5">
					Virtual accounts & BaaS infrastructure
				</p>
			</div>

			<div className="p-5">
				{/* One-time block */}
				<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
					One-time setup
				</p>
				<div className="flex justify-between text-sm mb-1.5">
					<span className="text-muted-foreground">
						{formatINR(CB_SETUP_FEE, 0)} × {quote.setupFee / CB_SETUP_FEE} bank
						integration{quote.setupFee / CB_SETUP_FEE > 1 ? "s" : ""}
					</span>
					<span className="font-medium tabular-nums">
						{formatINR(quote.setupFee, 0)}
					</span>
				</div>
				<div className="flex justify-between text-sm mb-2">
					<span className="text-muted-foreground">
						GST @ {Math.round(GST_RATE * 100)}%
					</span>
					<span className="font-medium tabular-nums">
						{formatINR(quote.setupGst, 0)}
					</span>
				</div>
				<div className="rounded-xl bg-muted/60 px-4 py-2.5 mb-5 flex justify-between items-baseline">
					<span className="text-xs text-muted-foreground">
						Setup total (incl. GST)
					</span>
					<span className="font-bold tabular-nums">
						{formatINR(quote.setupTotal, 0)}
					</span>
				</div>

				{/* Monthly block */}
				<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
					Monthly transaction charges
				</p>
				<div className="flex justify-between text-sm mb-1.5">
					<span className="text-muted-foreground">
						{formatIndianCompact(input.monthlyTxns)} txns ×{" "}
						{formatINRRate(quote.perTxn)}
					</span>
					<span className="font-medium tabular-nums">
						{formatINR(quote.monthlySubtotal, 0)}
					</span>
				</div>
				<div className="flex justify-between text-sm mb-2">
					<span className="text-muted-foreground">
						GST @ {Math.round(GST_RATE * 100)}%
					</span>
					<span className="font-medium tabular-nums">
						{formatINR(quote.monthlyGst, 0)}
					</span>
				</div>
				<div className="rounded-xl bg-muted/60 px-4 py-3">
					<p className="text-xs text-muted-foreground">
						Monthly total (incl. GST)
					</p>
					<p className="text-2xl font-bold text-foreground tabular-nums">
						{formatINR(quote.monthlyTotal, 0)}
						<span className="text-sm font-normal text-muted-foreground">
							/mo
						</span>
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						{formatINR(quote.monthlySubtotal, 0)} excl. GST
					</p>
				</div>

				<div className="flex flex-col gap-2.5 mt-5">
					<Button variant="gold" size="lg" onClick={() => openZohoChat()}>
						Get Started <ArrowRight className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="text-muted-foreground"
						onClick={copyShareLink}
					>
						<Link2 className="w-3.5 h-3.5" /> Copy estimate link
					</Button>
				</div>

				<p className="text-[11px] text-muted-foreground/80 mt-4 leading-relaxed">
					Setup fee applies per bank per user. Per-transaction charges depend on
					the transaction amount slab.
				</p>
			</div>
		</div>
	);

	return (
		<div className="max-w-6xl mx-auto">
			<div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
				{/* Left: inputs */}
				<div className="min-w-0 flex flex-col gap-4">
					<div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
						<h4 className="font-semibold text-foreground leading-tight mb-1">
							Bank integrations
						</h4>
						<p className="text-xs text-muted-foreground mb-4">
							Setup fee is {formatINR(CB_SETUP_FEE, 0)} + GST per bank per user
							· Banks: {CB_BANKS.join(", ")}
						</p>
						<div className="flex items-center gap-3">
							<Button
								variant="outline"
								size="icon"
								aria-label="Fewer bank integrations"
								disabled={input.bankUsers <= 1}
								onClick={() =>
									update({ bankUsers: Math.max(1, input.bankUsers - 1) })
								}
							>
								<Minus className="w-4 h-4" />
							</Button>
							<span className="w-12 text-center font-bold text-lg tabular-nums">
								{input.bankUsers}
							</span>
							<Button
								variant="outline"
								size="icon"
								aria-label="More bank integrations"
								disabled={input.bankUsers >= CB_MAX_BANK_USERS}
								onClick={() =>
									update({
										bankUsers: Math.min(CB_MAX_BANK_USERS, input.bankUsers + 1),
									})
								}
							>
								<Plus className="w-4 h-4" />
							</Button>
						</div>
					</div>

					<div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
						<h4 className="font-semibold text-foreground leading-tight mb-4">
							Monthly transactions
						</h4>
						<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
							<div className="flex-1 pt-1">
								<Slider
									value={[nearestStepIndex(input.monthlyTxns)]}
									min={0}
									max={TXN_STEPS.length - 1}
									step={1}
									onValueChange={([stepIndex]) =>
										update({ monthlyTxns: TXN_STEPS[stepIndex] })
									}
									aria-label="Monthly transaction count"
									className="[&_[role=slider]]:border-eko-gold [&_.bg-primary]:bg-eko-gold"
								/>
								<div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/70 tabular-nums">
									{TICK_LABELS.map((tick) => (
										<span key={tick}>{formatIndianCompact(tick)}</span>
									))}
								</div>
							</div>
							<div className="shrink-0 sm:w-36">
								<div className="relative">
									<Input
										inputMode="numeric"
										value={input.monthlyTxns.toLocaleString("en-IN")}
										onChange={(e) =>
											handleNumericInput(
												e.target.value,
												"monthlyTxns",
												10_000_000,
											)
										}
										aria-label="Monthly transaction count"
										className="pr-14 text-right tabular-nums font-medium"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
										txn/mo
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
						<h4 className="font-semibold text-foreground leading-tight mb-1">
							Average transaction amount
						</h4>
						<p className="text-xs text-muted-foreground mb-4">
							Determines the per-transaction charge slab (
							{CB_TXN_SLABS.map(
								(slab) =>
									`${formatINRRate(slab.flat ?? 0)} ${slab.upTo === null ? `above ₹${slab.from.toLocaleString("en-IN")}` : `up to ₹${slab.upTo.toLocaleString("en-IN")}`}`,
							).join(" · ")}
							)
						</p>
						<div className="relative sm:w-48">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
								₹
							</span>
							<Input
								inputMode="numeric"
								value={input.avgAmount.toLocaleString("en-IN")}
								onChange={(e) =>
									handleNumericInput(
										e.target.value,
										"avgAmount",
										CB_MAX_TXN_AMOUNT,
									)
								}
								aria-label="Average transaction amount"
								className="pl-7 text-right tabular-nums font-medium"
							/>
						</div>
					</div>

					{/* Static bank + slab tables (SEO, prerendered) */}
					<div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
						<div className="px-4 py-3 border-b border-border/60 bg-muted/40 flex items-center gap-2">
							<Landmark className="w-4 h-4 text-eko-gold" />
							<h4 className="text-sm font-semibold text-foreground">
								Connected Banking rate card
							</h4>
						</div>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Transaction slab (₹)</TableHead>
									<TableHead className="text-right">
										Charge per txn (excl. GST)
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{CB_TXN_SLABS.map((slab) => (
									<TableRow key={slab.from}>
										<TableCell className="py-2.5 font-medium tabular-nums">
											{slab.from.toLocaleString("en-IN")} –{" "}
											{slab.upTo?.toLocaleString("en-IN")}
										</TableCell>
										<TableCell className="text-right font-semibold tabular-nums">
											{formatINRRate(slab.flat ?? 0)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<p className="px-4 py-2.5 border-t border-border/60 bg-muted/40 text-[11px] text-muted-foreground/80">
							One-time setup fee: {formatINR(CB_SETUP_FEE, 0)} + GST per bank
							per user · Available banks: {CB_BANKS.join(" | ")}
						</p>
					</div>
				</div>

				{/* Right: sticky summary (desktop only) */}
				<aside className="hidden lg:block sticky top-24">{summary}</aside>
			</div>

			{/* Mobile: sticky bottom bar + drawer */}
			<MobileEstimateBar
				label={`${input.bankUsers} bank integration${input.bankUsers > 1 ? "s" : ""}`}
				headline={formatINR(quote.monthlyTotal, 0)}
				drawerTitle="Your Connected Banking estimate"
			>
				{summary}
			</MobileEstimateBar>
		</div>
	);
};
