import { GetStartedButton } from "@/components/GetStartedButton";
import { MobileEstimateBar } from "@/components/pricing/MobileSummaryBar";
import { SetupFeeLine } from "@/components/pricing/SetupFeeLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { GST_RATE } from "@/lib/data/api-pricing";
import {
	CC_DEFAULT_TXNS,
	CC_FEE_PER_TXN,
	CC_MAX_TXNS,
	CC_SETUP_FEE,
	calcCcQuote,
	clampCcTxns,
} from "@/lib/data/credit-card-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { ArrowRight, CreditCard, Link2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/** The calculator's own URL key: `cc=<monthlyTxns>` */
const PARAM = "cc";

// ponytail: copy of the DMT / earnings / banking slider steps; extract a shared
// txn slider if a fifth calculator needs one.
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
 * Reads the monthly payment count from `?cc=`; missing or malformed → default.
 * @param raw - The raw `cc` param value
 */
const parseTxns = (raw: string | null): number => {
	const parsed = Number(raw);
	return raw && Number.isFinite(parsed) ? clampCcTxns(parsed) : CC_DEFAULT_TXNS;
};

/**
 * Credit Card Bill Payment COST calculator: monthly payment count in, flat
 * per-payment fee + GST and the one-time setup fee out. Mirrored into the URL
 * (`?cc=…`) — only the `cc` key is touched, and only after the user changes
 * something. Includes a static rate card for SEO.
 */
export const CreditCardCalculator = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const ccParam = searchParams.get(PARAM);
	const [monthlyTxns, setMonthlyTxns] = useState(() => parseTxns(ccParam));
	const [touched, setTouched] = useState(() => ccParam !== null);
	const writeBackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	// Re-read `?cc=` when something else rewrites it on this mounted page (a
	// ⌘K card linking here). Our own write-back is remembered and ignored.
	const lastWritten = useRef(ccParam);
	useEffect(() => {
		if (ccParam === null || ccParam === lastWritten.current) return;
		lastWritten.current = ccParam;
		setMonthlyTxns(parseTxns(ccParam));
	}, [ccParam]);

	const quote = useMemo(() => calcCcQuote(monthlyTxns), [monthlyTxns]);

	useEffect(() => {
		if (!touched) return;
		writeBackTimer.current = setTimeout(() => {
			lastWritten.current = String(monthlyTxns);
			setSearchParams(
				(prev) => {
					const params = new URLSearchParams(prev);
					params.set(PARAM, String(monthlyTxns));
					return params;
				},
				{ replace: true, preventScrollReset: true },
			);
		}, 300);
		return () => clearTimeout(writeBackTimer.current);
	}, [monthlyTxns, touched, setSearchParams]);

	const update = (txns: number) => {
		setTouched(true);
		setMonthlyTxns(clampCcTxns(txns));
	};

	const copyShareLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success("Estimate link copied to clipboard");
		} catch {
			toast.error("Could not copy link");
		}
	};

	const gstPercent = Math.round(GST_RATE * 100);

	const summary = (
		<div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
			<div className="bg-eko-navy px-5 py-4">
				<h3 className="text-white font-bold">Your estimated monthly cost</h3>
				<p className="text-white/60 text-xs mt-0.5">
					Credit card bill payment fees · you pay
				</p>
			</div>

			<div className="p-5">
				<div className="flex justify-between text-sm mb-1.5">
					<span className="text-muted-foreground">
						{formatIndianCompact(quote.monthlyTxns)} payments ×{" "}
						{formatINRRate(quote.perTxn)}
					</span>
					<span className="font-medium tabular-nums">
						{formatINR(quote.monthlySubtotal, 0)}
					</span>
				</div>
				<div className="flex justify-between text-sm mb-3">
					<span className="text-muted-foreground">GST @ {gstPercent}%</span>
					<span className="font-medium tabular-nums">
						{formatINR(quote.monthlyGst, 0)}
					</span>
				</div>

				<SetupFeeLine quote={quote.setupFee} includeGst={false} />

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
					<GetStartedButton variant="gold" size="lg">
						Get Started <ArrowRight className="w-4 h-4" />
					</GetStartedButton>
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
					Credit card bill payments are charged a flat fee per payment, whatever
					the bill amount. Unlike other BBPS bills, they do not earn a
					commission.
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
						<h4 className="font-semibold text-foreground leading-tight mb-4">
							Monthly credit card bill payments
						</h4>
						<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
							<div className="flex-1 pt-1">
								<Slider
									value={[nearestStepIndex(monthlyTxns)]}
									min={0}
									max={TXN_STEPS.length - 1}
									step={1}
									onValueChange={([stepIndex]) => update(TXN_STEPS[stepIndex])}
									aria-label="Monthly credit card bill payments"
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
										value={monthlyTxns.toLocaleString("en-IN")}
										onChange={(e) =>
											update(
												Math.min(
													Number(e.target.value.replace(/[^\d]/g, "")) || 0,
													CC_MAX_TXNS,
												),
											)
										}
										aria-label="Monthly credit card bill payments"
										className="pr-14 text-right tabular-nums font-medium"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
										txn/mo
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Static rate card (SEO, prerendered) */}
					<div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card">
						<div className="px-4 py-3 border-b border-border/60 bg-muted/40 flex items-center gap-2">
							<CreditCard className="w-4 h-4 text-eko-gold" />
							<h4 className="text-sm font-semibold text-foreground">
								Credit card bill payment rate card
							</h4>
						</div>
						<dl className="divide-y divide-border/60 text-sm">
							<div className="flex justify-between px-4 py-2.5">
								<dt className="text-muted-foreground">
									Fee per payment (excl. GST)
								</dt>
								<dd className="font-semibold tabular-nums">
									{formatINRRate(CC_FEE_PER_TXN)}
								</dd>
							</div>
							<div className="flex justify-between px-4 py-2.5">
								<dt className="text-muted-foreground">
									Fee per payment (incl. GST @ {gstPercent}%)
								</dt>
								<dd className="font-semibold tabular-nums">
									{formatINRRate(CC_FEE_PER_TXN * (1 + GST_RATE))}
								</dd>
							</div>
							<div className="flex justify-between px-4 py-2.5">
								<dt className="text-muted-foreground">
									One-time setup fee (excl. GST)
								</dt>
								<dd className="font-semibold tabular-nums">
									{formatINR(CC_SETUP_FEE, 0)}
								</dd>
							</div>
						</dl>
						<p className="px-4 py-2.5 border-t border-border/60 bg-muted/40 text-[11px] text-muted-foreground/80">
							Flat fee for any bill amount · Setup fee is separate from the BBPS
							setup fee
						</p>
					</div>
				</div>

				{/* Right: sticky summary (desktop only) */}
				<aside className="hidden lg:block sticky top-24">{summary}</aside>
			</div>

			{/* Mobile: sticky bottom bar + drawer */}
			<MobileEstimateBar
				label={`${formatIndianCompact(quote.monthlyTxns)} payments/mo`}
				headline={formatINR(quote.monthlyTotal, 0)}
				drawerTitle="Your credit card bill payment cost"
			>
				{summary}
			</MobileEstimateBar>
		</div>
	);
};
