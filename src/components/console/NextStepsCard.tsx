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
import { ESIGN_ID, ESIGN_PATH } from "@/lib/connect/esign";
import { type KycPackSummary, summariseDocuments } from "@/lib/connect/kyc";
import { useKycDocuments } from "@/lib/connect/kyc-documents";
import { useRoleTransactionList } from "@/lib/connect/use-interactions";
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
	/**
	 * The pill. Stated rather than derived from `done`, because "not done" has
	 * two readings — still owed, and refused — that need different words and a
	 * different colour. Absent on a step whose state this session cannot answer.
	 */
	badge?: { label: string; variant: "secondary" | "destructive" };
	/** Overrides the status icon's label when "Not started" would be wrong. */
	markLabel?: string;
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
function StepMark({ done, label }: { done?: boolean; label?: string }) {
	if (done)
		return (
			<CircleCheck
				aria-label="Done"
				className="mt-0.5 h-5 w-5 shrink-0 text-eko-success"
			/>
		);
	return (
		<CircleDashed
			aria-label={label ?? (done === false ? "Not started" : "Status unknown")}
			className={cn(
				"mt-0.5 h-5 w-5 shrink-0",
				done === false ? "text-primary" : "text-muted-foreground/50",
			)}
		/>
	);
}

/**
 * How the KYC row reads once the pack itself has been counted.
 *
 * The account state only says upstream is still waiting; the pack says what for.
 * Three answers, in the order a partner cares about them: nothing owed, nothing
 * owed *yet* (it is all with the reviewer), and documents actually outstanding.
 *
 * `cta` is null on the first two: a row with nothing to act on must not carry a
 * button to a page that would only show it the same thing.
 * @param pack - The counted pack.
 * @returns The row's badge, mark and button text, or null to leave the row on
 *   the account-state reading — a pack of nothing to do reads as done.
 */
function packStatus(pack: KycPackSummary): {
	badge: Step["badge"];
	done?: boolean;
	markLabel?: string;
	cta: "Upload" | "Re-upload" | null;
} {
	// An empty pack is upstream's way of saying "No Records Found" — nothing is
	// owed. See `docs/features/kyc-documents.md`.
	if (pack.pendingUpload + pack.reupload + pack.awaitingReview === 0) {
		return {
			badge: { label: "Approved", variant: "secondary" },
			done: true,
			cta: null,
		};
	}
	if (pack.pendingUpload + pack.reupload === 0) {
		return {
			badge: { label: "Approval Pending", variant: "secondary" },
			// Not `false`: the orange ring is a call to act, and there is nothing
			// here to act on. Left undefined for the muted ring, with the label
			// corrected off "Status unknown" — the status is known, it is just
			// nobody's turn but the reviewer's.
			markLabel: "Approval pending",
			cta: null,
		};
	}
	// Red, and counted. A partner owing two documents is owed the number.
	const parts = [
		pack.pendingUpload ? `${pack.pendingUpload} Pending` : "",
		pack.reupload ? `${pack.reupload} Re-upload` : "",
	].filter(Boolean);
	return {
		badge: { label: parts.join(", "), variant: "destructive" },
		done: false,
		markLabel: parts.join(", "),
		cta: pack.reupload ? "Re-upload" : "Upload",
	};
}

/**
 * What the partner still has to do to go live.
 *
 * The page's own content while the Business Dashboard is flag-gated off, and the
 * top card once it is on — a partner mid-integration needs this more than they
 * need last week's totals, in either state.
 *
 * Only the KYC step carries a badge, because it is the only one this session can
 * actually answer: an active lifecycle means upstream accepted the account, and
 * a rejected one means compliance refused a document. The rest are a route, not
 * a checklist — nothing here knows whether a partner has finished integrating,
 * and a step that says "Pending" forever reads worse than one that says nothing.
 * @param me - The session view.
 */
export default function NextStepsCard({ me }: { me: MeView }) {
	// null while the entitlement is still unknown, so the action appears a tick
	// late — exactly how the rail's Upload Documents item appears. Never send a
	// partner at a page the rail is hiding from them.
	const kycEnabled = useKycEnabled();
	// The same entitlement, read the same fail-closed way, as the rail's E-sign
	// Documents item: an unresolved or unreadable list hides the row rather than
	// pointing a partner at a flow they cannot run. Entitlement is all either
	// surface has — nothing here can tell a signed pack from an unsigned one, so
	// the row states what is owed and carries no status.
	const interactions = useRoleTransactionList();
	const esignPending = Boolean(interactions?.[String(ESIGN_ID)]);
	const kycDone = me.state === "active";
	// Upstream reviewed the pack and refused at least one document. Distinct from
	// `kyc-pending` in words and colour: "Pending" tells a partner to wait, which
	// is the one thing that will never clear this state.
	const kycRejected = me.state === "kyc-rejected";
	// The two states upstream reports as account_state_id 48 and 47 — the only
	// ones where the pack can still say something the state does not. `me.state`
	// rather than the raw id, per `client.ts`: the backend already collapsed the
	// ids into these two names.
	const kycBlocked = me.state === "kyc-pending" || kycRejected;
	// Null while unresolved, when unentitled, and when the fetch failed — each of
	// which leaves the row on the account-state reading it had before this card
	// ever asked. A blip must not hide the way in.
	const documents = useKycDocuments(kycEnabled === true && kycBlocked);
	const pack = documents ? packStatus(summariseDocuments(documents)) : null;

	const steps: Step[] = [
		// Heads the card when owed, mirroring the rail, where E-sign Documents opens
		// the KYC section: the signed agreement is what the document pack behind
		// Upload Documents covers.
		...(esignPending
			? [
					{
						label: "Sign pending documents to activate your account",
						cta: {
							label: "Sign Document",
							to: ESIGN_PATH,
							primary: true,
						},
						// Owed, not unknowable: the entitlement is only in the list while
						// the signature is outstanding, so the ring reads like KYC's —
						// orange and "Not started", not the muted "state unknown" grey the
						// credentials and fee rows get.
						done: false,
					},
				]
			: []),
		{
			label: "Finish your KYC by uploading documents",
			cta:
				kycEnabled && !kycDone && pack?.cta !== null
					? {
							label: pack?.cta ?? (kycRejected ? "Re-upload" : "Upload"),
							to: "/console/documents",
							// Signing comes first, and one card gets one filled button.
							primary: !esignPending,
						}
					: undefined,
			// `pack.done` is deliberately undefined for a pack in review — the muted
			// ring. Without a pack the row keeps its old orange "owed" ring, so a
			// failed fetch never demotes a real blocker to "status unknown".
			done: kycDone ? true : pack ? pack.done : false,
			badge: kycDone
				? { label: "Done", variant: "secondary" }
				: (pack?.badge ??
					(kycRejected
						? { label: "Re-upload required", variant: "destructive" }
						: { label: "Pending", variant: "secondary" })),
			// The reasons live per document on Upload Documents; this row only
			// says that a mark is owed, so the icon must not read "Not started".
			// The counted pack has the better wording when it has arrived.
			markLabel:
				(kycDone ? undefined : pack?.markLabel) ??
				(kycRejected ? "Re-upload required" : undefined),
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
		{
			label: "Pay your one-time integration fee",
			cta: { label: "Pay", to: "/console/pay-activation-fee" },
		},
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
							<StepMark done={step.done} label={step.markLabel} />
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
								{step.badge ? (
									<Badge variant={step.badge.variant}>{step.badge.label}</Badge>
								) : null}
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
