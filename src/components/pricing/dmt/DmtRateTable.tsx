import { FadeIn } from "@/components/FadeIn";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GST_RATE } from "@/lib/data/api-pricing";
import {
	DMT_CUSTOMER_FEE_MIN,
	DMT_CUSTOMER_FEE_PCT,
	DMT_RECIPIENT_VERIFY_FEE,
	DMT_SENDER_KYC_FEE,
	EKO_DMT_CHARGE,
	dmtRateCardRows,
	dmtSenderKycInclGst,
} from "@/lib/data/dmt-pricing";
import { TDS_RATE } from "@/lib/data/payments-pricing";
import { formatINRRate } from "@/lib/utils";

/**
 * Static, crawlable DMT rate card — rendered server-side (SSG) so the
 * commission ledger is indexable.
 *
 * Rows are DERIVED from `calcDmtTxn`, not hand-maintained: commission scales
 * continuously with the transfer amount, so these are representative amounts
 * rather than bands.
 */
export const DmtRateTable = () => {
	const rows = dmtRateCardRows();
	const gstPct = Math.round(GST_RATE * 100);
	const tdsPct = Math.round(TDS_RATE * 100);

	return (
		<div className="max-w-4xl mx-auto">
			<FadeIn>
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
					<h3 className="font-bold text-foreground">
						DMT — commission by transfer amount
					</h3>
					<p className="text-xs text-muted-foreground">
						Sender fee {DMT_CUSTOMER_FEE_PCT * 100}% (min{" "}
						{formatINRRate(DMT_CUSTOMER_FEE_MIN)}), inclusive of GST @ {gstPct}%
						· Eko charge {formatINRRate(EKO_DMT_CHARGE)}/txn
					</p>
				</div>
				<div className="rounded-2xl border border-border/60 bg-card overflow-x-auto shadow-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Transfer (₹)</TableHead>
								<TableHead className="text-right">
									Sender fee
									<span className="block text-[10px] font-normal text-muted-foreground/70">
										incl. GST
									</span>
								</TableHead>
								<TableHead className="text-right">Taxable value</TableHead>
								<TableHead className="text-right">Eko charge</TableHead>
								<TableHead className="text-right">Your commission</TableHead>
								<TableHead className="text-right">
									After TDS @ {tdsPct}%
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.amount}>
									<TableCell className="py-2.5 font-medium tabular-nums">
										{row.amount.toLocaleString("en-IN")}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{formatINRRate(row.customerFee)}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{formatINRRate(row.feeExGst)}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										−{formatINRRate(row.ekoCharge)}
									</TableCell>
									<TableCell className="text-right tabular-nums font-semibold text-eko-success">
										{formatINRRate(row.grossCommission)}
									</TableCell>
									<TableCell className="text-right tabular-nums text-muted-foreground">
										{formatINRRate(row.netCommission)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				<p className="text-xs text-muted-foreground/80 mt-3 leading-relaxed">
					Commission scales continuously with the transfer amount — these are
					representative amounts, not bands. Below ₹1,000 the sender fee floors
					at {formatINRRate(DMT_CUSTOMER_FEE_MIN)}, so commission is flat at{" "}
					{formatINRRate(rows[0].grossCommission)}. Sender KYC{" "}
					{formatINRRate(DMT_SENDER_KYC_FEE)} + GST (
					{formatINRRate(dmtSenderKycInclGst())}) applies once per new sender;
					recipient account verification {formatINRRate(DMT_RECIPIENT_VERIFY_FEE)}{" "}
					(incl. GST) once per new recipient.
				</p>
			</FadeIn>
		</div>
	);
};
