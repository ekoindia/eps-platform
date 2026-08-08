import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { MeView } from "@/lib/auth/client";
import { useKycEnabled } from "@/lib/connect/use-kyc";
import { cn } from "@/lib/utils";
import { CircleCheck, CircleDashed } from "lucide-react";
import { Link } from "react-router-dom";

interface Step {
	label: string;
	/**
	 * Right-hand action. Omitted for a step there is nothing to click through to.
	 *
	 * `primary` marks the one action the partner is actually being asked to take
	 * now; every other CTA stays outline. Two filled buttons in one card is two
	 * next steps, which is none.
	 */
	cta?: { label: string; to: string; primary?: boolean };
	/** Only set on a step whose completion this session can actually answer. */
	done?: boolean;
}

/**
 * The status mark at the head of a row, one size for all three states.
 *
 * A dashed ring for a step that has not started, the same ring muted for one
 * whose state is genuinely unknown, and a filled tick for done. Every row keeps
 * a mark so the labels stay on one left edge — an absent icon would indent the
 * text of some rows and not others.
 * @param done - `true`, `false`, or undefined when the state is unknowable.
 */
function StepMark({ done }: { done?: boolean }) {
	if (done)
		return (
			<CircleCheck
				aria-label="Done"
				className="mt-0.5 h-5 w-5 shrink-0 text-eko-success"
			/>
		);
	return (
		<CircleDashed
			aria-label={done === false ? "Not started" : "Status unknown"}
			className={cn(
				"mt-0.5 h-5 w-5 shrink-0",
				done === false ? "text-primary" : "text-muted-foreground/50",
			)}
		/>
	);
}

/**
 * What the partner still has to do to go live.
 *
 * The page's own content while the Business Dashboard is flag-gated off, and the
 * top card once it is on — a partner mid-integration needs this more than they
 * need last week's totals, in either state.
 *
 * Only the KYC step carries a badge, because it is the only one this session can
 * actually answer: an active lifecycle means upstream accepted the account. The
 * rest are a route, not a checklist — nothing here knows whether a partner has
 * finished integrating, and a step that says "Pending" forever reads worse than
 * one that says nothing.
 * @param me - The session view.
 */
export default function NextStepsCard({ me }: { me: MeView }) {
	// null while the entitlement is still unknown, so the action appears a tick
	// late — exactly how the rail's Upload Documents item appears. Never send a
	// partner at a page the rail is hiding from them.
	const kycEnabled = useKycEnabled();
	const kycDone = me.state === "active";

	const steps: Step[] = [
		{
			label: "Finish your KYC by uploading documents",
			cta:
				kycEnabled && !kycDone
					? { label: "Upload", to: "/console/documents", primary: true }
					: undefined,
			done: kycDone,
		},
		{
			label: "Complete your integration using UAT credentials",
			cta: { label: "View", to: "/console/credentials" },
		},
		{
			label: "Receive your production credentials",
			cta: { label: "View", to: "/console/credentials" },
		},
		// Shown to everyone. This was gated on `profile.dateOfJoining >= 2026-08-03`
		// so that only post-cutover accounts saw it, but that field has no format
		// contract and no other consumer, so the gate silently hid the step from
		// accounts that DO owe the fee. Shown unconditionally until a join date —
		// or an eligibility flag — arrives from upstream in a shape worth trusting.
		{ label: "Pay your one-time integration fee" },
	];

	return (
		<Card className="max-w-2xl">
			<CardHeader>
				<CardTitle>Next Steps</CardTitle>
				<CardDescription>
					What's left before you can transact in production.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ol className="divide-y">
					{steps.map((step) => (
						<li
							key={step.label}
							className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
						>
							<StepMark done={step.done} />
							<span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
								{/* The strike is on the label alone — carrying it on the row
								    would draw a line through the badge as well. */}
								<span
									className={cn(
										step.done && "text-muted-foreground line-through",
									)}
								>
									{step.label}
								</span>
								{step.done === undefined ? null : (
									<Badge variant="secondary">
										{step.done ? "Done" : "Pending"}
									</Badge>
								)}
							</span>
							{step.cta ? (
								<Button
									asChild
									size="sm"
									variant={step.cta.primary ? "default" : "outline"}
									className="shrink-0"
								>
									{/* Two of these read "View". Named after their own step so a
									    screen reader hears which one it is landing on. */}
									<Link
										to={step.cta.to}
										aria-label={`${step.cta.label} — ${step.label}`}
									>
										{step.cta.label}
									</Link>
								</Button>
							) : null}
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
