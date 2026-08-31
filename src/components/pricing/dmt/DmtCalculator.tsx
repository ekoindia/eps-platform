import { GetStartedButton } from "@/components/GetStartedButton";
import { MobileEstimateBar } from "@/components/pricing/MobileSummaryBar";
import { SetupFeeLine } from "@/components/pricing/SetupFeeLine";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { saveCalculatorContext } from "@/hooks/use-tracking-params";
import { GST_RATE } from "@/lib/data/api-pricing";
import {
	DMT_DEFAULT_AMOUNT,
	DMT_DEFAULT_MONTHLY_TXNS,
	DMT_MAX_TXN_AMOUNT,
	DMT_MIN_TXN_AMOUNT,
	DMT_RECIPIENT_VERIFY_FEE,
	calcDmtQuote,
	clampDmtAmount,
	dmtSenderKycInclGst,
	type DmtInput,
} from "@/lib/data/dmt-pricing";
import { MAX_TXNS, TDS_RATE } from "@/lib/data/payments-pricing";
import { formatINR, formatINRRate, formatIndianCompact } from "@/lib/utils";
import { ArrowRight, Link2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RcmExplainer } from "./RcmExplainer";

const DEFAULT_INPUT: DmtInput = {
	amount: DMT_DEFAULT_AMOUNT,
	monthlyTxns: DMT_DEFAULT_MONTHLY_TXNS,
	newSendersPerMonth: 50,
	newRecipientsPerMonth: 80,
	recoverChargesFromCustomer: false,
};

/** Log-spaced txn-count steps for the slider (direct input allows any value) */
const TXN_STEPS = [
	0, 100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 1_00_000, 250_000,
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
 * Parses the DMT input from the `dmt` URL param.
 * Format: `dmt=amount:monthlyTxns:newSenders:newRecipients:recover`.
 *
 * Values are clamped HERE, not just in the math: `calcDmtQuote` would clamp
 * a hostile `?dmt=` anyway, but the raw value would still be rendered back
 * into the number inputs (a URL-injected `-99` showing under a `-₹0` line).
 */
export const parseInputFromParams = (
	params: URLSearchParams,
): DmtInput | null => {
	const raw = params.get("dmt");
	if (!raw) return null;
	const parts = raw.split(":");
	const count = (index: number, fallback: number): number => {
		const value = Number(parts[index]);
		if (!Number.isFinite(value)) return fallback;
		return Math.min(Math.max(Math.round(value), 0), MAX_TXNS);
	};
	const amount = Number(parts[0]);
	return {
		amount: Number.isFinite(amount)
			? clampDmtAmount(amount)
			: DEFAULT_INPUT.amount,
		monthlyTxns: count(1, DEFAULT_INPUT.monthlyTxns),
		newSendersPerMonth: count(2, DEFAULT_INPUT.newSendersPerMonth),
		newRecipientsPerMonth: count(3, DEFAULT_INPUT.newRecipientsPerMonth),
		recoverChargesFromCustomer: parts[4] === "1",
	};
};

/** One row of the per-transaction ledger */
const LedgerRow = ({
	label,
	value,
	note,
	tone = "normal",
	indent = false,
}: {
	label: string;
	value: string;
	note?: string;
	tone?: "normal" | "muted" | "success" | "total";
	indent?: boolean;
}) => (
	<div
		className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 ${
			tone === "total" ? "border-t border-border/60 mt-1 pt-2.5" : ""
		} ${indent ? "pl-4" : ""}`}
	>
		<span
			className={`text-sm ${
				tone === "total"
					? "font-semibold text-foreground"
					: "text-muted-foreground"
			}`}
		>
			{label}
			{note && (
				<span className="block text-[11px] text-muted-foreground/70 leading-snug">
					{note}
				</span>
			)}
		</span>
		<span
			className={`tabular-nums shrink-0 ${
				tone === "success"
					? "font-bold text-eko-success"
					: tone === "total"
						? "font-bold text-foreground"
						: tone === "muted"
							? "text-muted-foreground"
							: "font-medium text-foreground"
			}`}
		>
			{value}
		</span>
	</div>
);

/**
 * DMT earnings calculator.
 *
 * Unlike the AePS/BBPS calculator (pick N products × monthly volume), DMT is
 * a single per-transaction LEDGER: a GST-inclusive customer fee, GST carved
 * back out, Eko's flat charge, then TDS. The ledger is the hero; the monthly
 * projection and the wallet-debited add-ons sit beneath it.
 *
 * Input state is mirrored into the URL (`?dmt=…`) — only the `dmt` key is
 * touched, so `tab`, `sel`, `pay`, `cb` and UTM params are preserved.
 */
export const DmtCalculator = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [input, setInput] = useState<DmtInput>(
		() => parseInputFromParams(searchParams) ?? DEFAULT_INPUT,
	);
	const [touched, setTouched] = useState(
		() => searchParams.get("dmt") !== null,
	);
	const writeBackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const recoverId = useId();

	const quote = useMemo(() => calcDmtQuote(input), [input]);
	const { perTxn } = quote;

	// Mirror state into the URL (debounced). Only the `dmt` key is rewritten,
	// and only once the user has actually changed something.
	useEffect(() => {
		if (!touched) return;
		const serialized = `${input.amount}:${input.monthlyTxns}:${input.newSendersPerMonth}:${input.newRecipientsPerMonth}:${input.recoverChargesFromCustomer ? 1 : 0}`;
		writeBackTimer.current = setTimeout(() => {
			setSearchParams(
				(prev) => {
					const params = new URLSearchParams(prev);
					params.set("dmt", serialized);
					return params;
				},
				{ replace: true, preventScrollReset: true },
			);
			saveCalculatorContext(`dmt:${serialized}`);
		}, 300);
		return () => clearTimeout(writeBackTimer.current);
	}, [input, touched, setSearchParams]);

	const update = (patch: Partial<DmtInput>) => {
		setTouched(true);
		setInput((prev) => ({ ...prev, ...patch }));
	};

	const handleCount = (raw: string, key: keyof DmtInput) => {
		const parsed = Number(raw.replace(/[^\d]/g, ""));
		update({ [key]: Math.min(Number.isFinite(parsed) ? parsed : 0, MAX_TXNS) });
	};

	const copyShareLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success("Estimate link copied to clipboard");
		} catch {
			toast.error("Could not copy link");
		}
	};

	const gstPct = Math.round(GST_RATE * 100);
	const tdsPct = Math.round(TDS_RATE * 100);

	const summary = (
		<div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
			<div className="bg-eko-navy px-5 py-4">
				<h3 className="text-white font-bold">Your DMT estimate</h3>
				<p className="text-white/60 text-xs mt-0.5">
					{formatIndianCompact(quote.input.monthlyTxns)} transfers/mo ×{" "}
					{formatINR(quote.input.amount, 0)} average
				</p>
			</div>

			<div className="p-5">
				<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
					Per transaction
				</p>
				<LedgerRow
					label="Sender's transaction fee"
					note={`1% (min ₹10) · incl. GST @ ${gstPct}%`}
					value={formatINRRate(perTxn.customerFee)}
				/>
				<LedgerRow
					label="GST inside the fee"
					note="Paid to the government by Eko"
					value={`−${formatINRRate(perTxn.gstInFee)}`}
					tone="muted"
					indent
				/>
				<LedgerRow
					label="Taxable value"
					value={formatINRRate(perTxn.feeExGst)}
					tone="muted"
					indent
				/>
				<LedgerRow
					label="Eko charges"
					value={`−${formatINRRate(perTxn.ekoCharge)}`}
				/>
				<LedgerRow
					label="Gross commission"
					value={formatINRRate(perTxn.grossCommission)}
					tone="total"
				/>
				<LedgerRow
					label={`TDS @ ${tdsPct}%`}
					value={`−${formatINRRate(perTxn.tds)}`}
					tone="muted"
				/>
				<LedgerRow
					label="Net per transfer"
					value={formatINRRate(perTxn.netCommission)}
					tone="success"
				/>

				<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-5 mb-1">
					Per month
				</p>
				<LedgerRow
					label="Gross commission"
					value={formatINR(quote.monthlyGross, 0)}
				/>
				<LedgerRow
					label={`TDS @ ${tdsPct}%`}
					note="Withheld on the monthly total"
					value={`−${formatINR(quote.monthlyTds, 0)}`}
					tone="muted"
				/>
				{quote.addOnCost > 0 && (
					<>
						<LedgerRow
							label="Sender KYC charges"
							note={`${quote.input.newSendersPerMonth} × ${formatINRRate(dmtSenderKycInclGst())}`}
							value={`−${formatINR(quote.senderKycCost, 0)}`}
							tone="muted"
						/>
						<LedgerRow
							label="Account verification"
							note={`${quote.input.newRecipientsPerMonth} × ${formatINRRate(DMT_RECIPIENT_VERIFY_FEE)}`}
							value={`−${formatINR(quote.recipientVerifyCost, 0)}`}
							tone="muted"
						/>
					</>
				)}
				{quote.recoveredFromCustomer > 0 && (
					<LedgerRow
						label="Recovered from customers"
						value={`+${formatINR(quote.recoveredFromCustomer, 0)}`}
						tone="muted"
					/>
				)}

				<div className="rounded-xl bg-muted/60 px-4 py-3 mt-3">
					<p className="text-xs text-muted-foreground">
						Your monthly take-home
					</p>
					<p className="text-2xl font-bold text-eko-success tabular-nums">
						{formatINR(quote.monthlyTakeHome, 0)}
						<span className="text-sm font-normal text-muted-foreground">
							/mo
						</span>
					</p>
				</div>

				<div className="mt-4">
					<SetupFeeLine quote={quote.setupFee} includeGst={false} />
				</div>

				<div className="flex flex-col gap-2.5 mt-1">
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
					Reverse charge applies — Eko pays the GST on your commission. Your
					wallet is debited the transfer amount plus the fee on each
					transaction; commission is credited back.
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
						<div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
							<h4 className="font-semibold text-foreground leading-tight">
								Average transfer amount
							</h4>
							<span className="font-bold text-lg tabular-nums text-foreground">
								{formatINR(input.amount, 0)}
							</span>
						</div>
						<Slider
							value={[
								Math.min(
									Math.max(input.amount, DMT_MIN_TXN_AMOUNT),
									DMT_MAX_TXN_AMOUNT,
								),
							]}
							min={DMT_MIN_TXN_AMOUNT}
							max={DMT_MAX_TXN_AMOUNT}
							step={100}
							onValueChange={([amount]) => update({ amount })}
							aria-label="Average transfer amount"
							className="[&_[role=slider]]:border-eko-gold [&_.bg-primary]:bg-eko-gold"
						/>
						<div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/70 tabular-nums">
							<span>{formatINR(DMT_MIN_TXN_AMOUNT, 0)}</span>
							<span>{formatINR(DMT_MAX_TXN_AMOUNT, 0)} max per transfer</span>
						</div>
					</div>

					<div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
						<h4 className="font-semibold text-foreground leading-tight mb-4">
							Number of transfers per month
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
									aria-label="Monthly transfer count"
									className="[&_[role=slider]]:border-eko-gold [&_.bg-primary]:bg-eko-gold"
								/>
								<div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/70 tabular-nums">
									{TICK_LABELS.map((tick) => (
										<span key={tick}>{formatIndianCompact(tick)}</span>
									))}
								</div>
							</div>
							<div className="shrink-0 sm:w-36">
								<Input
									inputMode="numeric"
									value={input.monthlyTxns.toLocaleString("en-IN")}
									onChange={(e) => handleCount(e.target.value, "monthlyTxns")}
									aria-label="Monthly transfer count"
									className="text-right tabular-nums"
								/>
							</div>
						</div>
					</div>

					{/* Wallet-debited add-ons */}
					<div className="rounded-2xl border border-border/60 bg-card shadow-card p-4 sm:p-5">
						<h4 className="font-semibold text-foreground leading-tight mb-1">
							One-off charges
						</h4>
						<p className="text-xs text-muted-foreground mb-4">
							Both are debited from your wallet. You may recover them from your
							customer in your own app.
						</p>
						<div className="grid sm:grid-cols-2 gap-4">
							<div>
								<label
									className="text-sm text-muted-foreground block mb-1.5"
									htmlFor={`${recoverId}-senders`}
								>
									New senders / month
									<span className="block text-[11px] text-muted-foreground/70">
										KYC {formatINRRate(dmtSenderKycInclGst())} each (incl. GST)
									</span>
								</label>
								<Input
									id={`${recoverId}-senders`}
									inputMode="numeric"
									value={input.newSendersPerMonth.toLocaleString("en-IN")}
									onChange={(e) =>
										handleCount(e.target.value, "newSendersPerMonth")
									}
									className="text-right tabular-nums"
								/>
							</div>
							<div>
								<label
									className="text-sm text-muted-foreground block mb-1.5"
									htmlFor={`${recoverId}-recipients`}
								>
									New recipients / month
									<span className="block text-[11px] text-muted-foreground/70">
										Account check {formatINRRate(DMT_RECIPIENT_VERIFY_FEE)} each
									</span>
								</label>
								<Input
									id={`${recoverId}-recipients`}
									inputMode="numeric"
									value={input.newRecipientsPerMonth.toLocaleString("en-IN")}
									onChange={(e) =>
										handleCount(e.target.value, "newRecipientsPerMonth")
									}
									className="text-right tabular-nums"
								/>
							</div>
						</div>
						<div className="flex items-start gap-2.5 mt-4 pt-4 border-t border-border/60">
							<Checkbox
								id={recoverId}
								checked={input.recoverChargesFromCustomer}
								onCheckedChange={(checked) =>
									update({ recoverChargesFromCustomer: checked === true })
								}
								className="mt-0.5"
							/>
							<label
								htmlFor={recoverId}
								className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
							>
								I recover these charges from my customers
								<span className="block text-[11px] text-muted-foreground/70">
									The wallet debit still happens — this adds an offsetting
									reimbursement.
								</span>
							</label>
						</div>
					</div>

					<RcmExplainer txn={perTxn} />
				</div>

				{/* Right: sticky summary (desktop) */}
				<div className="hidden lg:block lg:sticky lg:top-24">{summary}</div>
			</div>

			<MobileEstimateBar
				label="Your DMT take-home"
				headline={formatINR(quote.monthlyTakeHome, 0)}
				drawerTitle="Your DMT estimate"
			>
				{summary}
			</MobileEstimateBar>
		</div>
	);
};
