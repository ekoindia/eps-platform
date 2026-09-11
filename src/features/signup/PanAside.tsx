import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** The "why we ask" points, lead phrase first so the column stays scannable. */
const REASONS: readonly { lead: string; body: string }[] = [
	{
		lead: "It's the law.",
		body: "Every entity using payment or verification APIs has to be KYC-verified before going live.",
	},
	// {
	// 	lead: "It saves you typing.",
	// 	body: "Your legal name and business type arrive pre-filled.",
	// },
	{
		lead: "You can test on live data.",
		body: "Once the signup is done, we let you test Verification APIs live.",
	},
	{
		lead: "It stays with us.",
		body: "Encrypted, used only for verification, never sold or shared with other partners.",
	},
];

/**
 * Assurances shown beside the PAN field.
 *
 * "RBI-regulated partners" is deliberately absent: the other two claims were
 * signed off and that wording was not. Adding it back is one entry here — but
 * see the parked trust-and-compliance work (`ProductPageLayout.tsx`, the
 * commented-out `trustAndCompliance` block) before doing so.
 */
const CHIPS: readonly string[] = ["Trusted since 2007", "ISO 27001"];

/**
 * Supporting column for the PAN step: why the PAN is needed, that signing up
 * commits to nothing, and the trust chips.
 *
 * Rendered by the wizard as a sibling of the form card, so it stacks below the
 * form on narrow screens. Purely presentational — no props, no state.
 */
export function PanAside() {
	return (
		<div className="flex flex-col gap-4">
			<Card className="flex flex-col gap-2 p-6">
				{/* A <p>, not a heading: the wizard's tests run singular level-2
				    heading queries, and an extra heading here would be a trap for
				    every future one. */}
				<p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
					Why we ask
				</p>
				{REASONS.map(({ lead, body }) => (
					<p key={lead} className="text-[0.76rem] text-muted-foreground">
						<strong className="font-semibold text-foreground">{lead}</strong>{" "}
						{body}
					</p>
				))}
			</Card>

			{/* Not a <Callout>: that renders its label as a separate uppercase line
			    with an AlertTriangle, which reads alarmed. This is reassurance. */}
			<div className="rounded-lg border border-eko-gold/40 bg-eko-gold-light p-4 text-[0.76rem] text-eko-navy">
				<strong className="font-semibold text-[1.1em]">Just exploring?</strong>{" "}
				Signing up doesn't commit you to anything — you only pay when you go
				live.
			</div>

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
