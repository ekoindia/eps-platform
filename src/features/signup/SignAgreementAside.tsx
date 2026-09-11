import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** What signing actually unlocks, lead phrase first so the column stays scannable. */
const REASONS: readonly { lead: string; body: string }[] = [
	{
		lead: "Your UAT keys are issued.",
		body: "Payment and verification APIs open up in UAT the moment this is signed.",
	},
	{
		lead: "Live verification too.",
		body: "Try the verification products against real data from the dashboard, before you write any code.",
	},
	{
		lead: "It keeps both of us legal.",
		body: "Regulators require a signed agreement before we can hand over live-data access.",
	},
];

/** What the e-signature is, and what happens to the Aadhaar number behind it. */
const ESIGNATURE: readonly string[] = [
	"Aadhaar eSign through UIDAI, legally valid under the IT Act, 2000.",
	"Your Aadhaar number is used once for the signature and never captured or stored by us.",
];

/**
 * The two claims the other steps' asides carry, plus the one this step earns.
 * Kept in each file rather than shared: see `PanAside` for why the base list is
 * exactly those two.
 */
const CHIPS: readonly string[] = [
	"Trusted since 2007",
	"ISO 27001",
	"UIDAI eSign",
];

/**
 * Supporting column for the Sign Agreement step: what signing unlocks, and what
 * the Aadhaar e-signature does and does not keep.
 *
 * Mirrors `PanAside` and `BusinessAside` in structure and type scale so the
 * three steps read as one flow. Purely presentational — no props, no state.
 */
export function SignAgreementAside() {
	return (
		<div className="flex flex-col gap-4">
			{/* <p>, not a heading: the wizard's tests run singular level-2 heading
			    queries, and an extra heading here would be a trap for every future
			    one. Same reasoning as PanAside. */}
			<Card className="flex flex-col gap-2 p-6">
				<p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
					Why sign now
				</p>
				{REASONS.map(({ lead, body }) => (
					<p key={lead} className="text-[0.76rem] text-muted-foreground">
						<strong className="font-semibold text-foreground">{lead}</strong>{" "}
						{body}
					</p>
				))}
			</Card>

			<Card className="flex flex-col gap-2 p-6">
				<p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
					About the e-signature
				</p>
				{ESIGNATURE.map((body) => (
					<p key={body} className="text-[0.76rem] text-muted-foreground">
						{body}
					</p>
				))}
			</Card>

			{/* Badge renders a <div>, so this row must not be a <p>. */}
			<div className="flex flex-wrap gap-2">
				{CHIPS.map((chip) => (
					<Badge
						key={chip}
						variant="outline"
						className="font-medium text-[0.7rem] text-muted-foreground"
					>
						{chip}
					</Badge>
				))}
			</div>
		</div>
	);
}
