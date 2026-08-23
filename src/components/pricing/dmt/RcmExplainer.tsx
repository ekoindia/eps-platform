import { GST_RATE } from "@/lib/data/api-pricing";
import type { DmtTxnBreakdown } from "@/lib/data/dmt-pricing";
import { formatINRRate } from "@/lib/utils";
import { ArrowRight, Building2, FileText, Landmark } from "lucide-react";

interface RcmExplainerProps {
	/** Live ledger from the calculator, so the worked figures stay in sync */
	txn: DmtTxnBreakdown;
}

/** One numbered step inside a comparison column */
const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
	<li className="flex gap-2.5 text-sm leading-relaxed">
		<span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-muted text-[11px] font-bold text-muted-foreground grid place-items-center tabular-nums">
			{n}
		</span>
		<span className="text-muted-foreground">{children}</span>
	</li>
);

/**
 * Explains the Reverse Charge Mechanism that applies to DMT commission, by
 * contrasting it with ordinary forward-charge GST. Figures interpolate from
 * the calculator's current transfer amount so the example never contradicts
 * the ledger above it.
 *
 * Deliberately descriptive, not prescriptive: it states what Eko requires on
 * the invoice and defers the partner's own tax treatment to their accountant.
 */
export const RcmExplainer = ({ txn }: RcmExplainerProps) => {
	const gstPct = Math.round(GST_RATE * 100);
	const withGst = txn.grossCommission + txn.rcmGst;

	return (
		<section
			id="rcm"
			className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden"
		>
			<div className="bg-eko-navy px-5 sm:px-6 py-4">
				<h3 className="text-white font-bold flex items-center gap-2">
					<FileText className="w-4 h-4 text-eko-gold" />
					Reverse Charge Mechanism (RCM) on DMT
				</h3>
				<p className="text-white/60 text-xs mt-1">
					Who pays the GST on your commission — and what goes on your invoice
				</p>
			</div>

			<div className="p-5 sm:p-6">
				<p className="text-sm text-muted-foreground leading-relaxed mb-5">
					The {formatINRRate(txn.customerFee)} your customer pays on a{" "}
					<span className="font-semibold text-foreground">
						₹{txn.amount.toLocaleString("en-IN")}
					</span>{" "}
					transfer{" "}
					<span className="font-semibold text-foreground">already contains</span>{" "}
					GST @ {gstPct}% — nothing is added on top. Stripping it out leaves{" "}
					{formatINRRate(txn.feeExGst)} of taxable value:{" "}
					{formatINRRate(txn.ekoCharge)} to Eko and{" "}
					<span className="font-semibold text-eko-success">
						{formatINRRate(txn.grossCommission)}
					</span>{" "}
					to you. Under reverse charge, the GST on your share —{" "}
					<span className="font-semibold text-foreground">
						{formatINRRate(txn.rcmGst)}
					</span>{" "}
					— is paid to the government by Eko rather than collected and remitted
					by you.
				</p>

				<div className="grid sm:grid-cols-2 gap-4">
					{/* Forward charge — the familiar case */}
					<div className="rounded-xl border border-border/60 bg-muted/30 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
							<Building2 className="w-3.5 h-3.5" />
							Forward charge
						</p>
						<p className="text-[11px] text-muted-foreground/70 mb-3">
							How most of your income is taxed
						</p>
						<ol className="flex flex-col gap-2.5">
							<Step n={1}>
								You invoice Eko {formatINRRate(txn.grossCommission)}{" "}
								<span className="font-semibold text-foreground">
									+ {formatINRRate(txn.rcmGst)} GST
								</span>
							</Step>
							<Step n={2}>Eko pays you {formatINRRate(withGst)}</Step>
							<Step n={3}>
								<span className="font-semibold text-foreground">You</span>{" "}
								deposit {formatINRRate(txn.rcmGst)} with the government
							</Step>
						</ol>
						<p className="text-xs text-muted-foreground/80 mt-3 pt-3 border-t border-border/60 leading-relaxed">
							The GST sits in your account until you file. You fund it, you file
							it, you carry the risk.
						</p>
					</div>

					{/* Reverse charge — what actually happens on DMT */}
					<div className="rounded-xl border-2 border-eko-gold/60 bg-eko-gold/5 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-eko-navy dark:text-eko-gold mb-1 flex items-center gap-1.5">
							<Landmark className="w-3.5 h-3.5" />
							Reverse charge — DMT
						</p>
						<p className="text-[11px] text-muted-foreground/70 mb-3">
							What actually happens on every transfer
						</p>
						<ol className="flex flex-col gap-2.5">
							<Step n={1}>
								You invoice Eko {formatINRRate(txn.grossCommission)}, marking{" "}
								<span className="font-semibold text-foreground">RCM = YES</span>{" "}
								— <span className="font-semibold text-foreground">no GST</span>{" "}
								on the invoice
							</Step>
							<Step n={2}>
								Eko pays you {formatINRRate(txn.grossCommission)} (less TDS)
							</Step>
							<Step n={3}>
								<span className="font-semibold text-foreground">Eko</span>{" "}
								deposits the {formatINRRate(txn.rcmGst)} with the government
							</Step>
						</ol>
						<p className="text-xs text-muted-foreground/80 mt-3 pt-3 border-t border-eko-gold/30 leading-relaxed">
							You never collect it, never hold it, never remit it.
						</p>
					</div>
				</div>

				<div className="mt-5 rounded-xl bg-muted/60 px-4 py-3.5 flex gap-3">
					<ArrowRight className="w-4 h-4 text-eko-gold shrink-0 mt-0.5" />
					<p className="text-sm text-muted-foreground leading-relaxed">
						<span className="font-semibold text-foreground">
							What you need to do:
						</span>{" "}
						raise your invoice to Eko with the RCM option set to{" "}
						<span className="font-semibold text-foreground">&ldquo;YES&rdquo;</span>{" "}
						and no GST line on it. Your own registration and filing position can
						vary — please confirm the treatment with your accountant.
					</p>
				</div>
			</div>
		</section>
	);
};
