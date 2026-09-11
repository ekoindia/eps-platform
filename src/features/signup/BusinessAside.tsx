import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** Why the business details are collected at all, lead phrase first. */
const REASONS: readonly { lead: string; body: string }[] = [
	{
		lead: "KYC rules.",
		body: "A registered address is mandatory before any payment API goes live.",
	},
	{
		lead: "Your paperwork.",
		body: "It prints on the agreement and your GST invoices.",
	},
];

/** Where each answer ends up, so nothing here reads as an open-ended ask. */
const DESTINATIONS: readonly { lead: string; body: string }[] = [
	{
		lead: "On your agreement.",
		body: "The registered name and address print exactly as shown here.",
	},
	{
		lead: "It sets your KYC list.",
		body: "Business type decides which registration document we ask for before going live — nothing extra.",
	},
	{
		lead: "Nowhere else.",
		body: "Encrypted, never sold or shared with other partners.",
	},
];

/**
 * The same two claims the PAN step's aside carries. Kept in both files rather
 * than shared: see `PanAside` for why the list is exactly these two.
 */
const CHIPS: readonly string[] = ["Trusted since 2007", "ISO 27001"];

/**
 * Supporting column for the Business Details step: why these fields are asked
 * for and where each answer ends up.
 *
 * Mirrors `PanAside` in structure and type scale so the two steps read as one
 * flow. Purely presentational — no props, no state.
 */
export function BusinessAside() {
	return (
		<div className="flex flex-col gap-4">
			{/* <p>, not a heading: the wizard's tests run singular level-2 heading
			    queries, and an extra heading here would be a trap for every future
			    one. Same reasoning as PanAside. */}
			<Card className="flex flex-col gap-2 p-6">
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

			<Card className="flex flex-col gap-2 p-6">
				<p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
					Where this goes
				</p>
				{DESTINATIONS.map(({ lead, body }) => (
					<p key={lead} className="text-[0.76rem] text-muted-foreground">
						<strong className="font-semibold text-foreground">{lead}</strong>{" "}
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
