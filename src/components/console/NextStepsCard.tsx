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
import { needsKycUpload } from "@/lib/console/lifecycle";
import { SETUP_FEE_DISCOUNT_PERCENT } from "@/lib/data/api-pricing";
import { cn } from "@/lib/utils";
import { Check, CreditCard } from "lucide-react";
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
 * The numbered status mark at the head of a row, one size for every state.
 *
 * A tick for done, a filled gold number for the step spotlighted as up next, a
 * primary ring for one that is owed, and a muted ring for one whose state is
 * genuinely unknown. Every row keeps a mark so the labels stay on one left edge.
 * The number is decorative — the list already says where the row sits — so the
 * mark speaks only its state.
 * @param index - 1-based position in the list.
 * @param done - `true`, `false`, or undefined when the state is unknowable.
 * @param label - Overrides the spoken state when "Not started" would be wrong.
 * @param upNext - True on the one step the card is asking for now.
 */
function StepMark({
	index,
	done,
	label,
	upNext,
}: {
	index: number;
	done?: boolean;
	label?: string;
	upNext?: boolean;
}) {
	const base =
		"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold";
	if (done)
		return (
			<span
				role="img"
				aria-label="Done"
				className={cn(base, "bg-eko-success/15 text-eko-success")}
			>
				<Check className="h-4 w-4" aria-hidden />
			</span>
		);
	return (
		<span
			role="img"
			aria-label={label ?? (done === false ? "Not started" : "Status unknown")}
			className={cn(
				base,
				upNext
					? "bg-primary text-primary-foreground"
					: done === false
						? "border border-primary text-primary"
						: "border text-muted-foreground",
			)}
		>
			{index}
		</span>
	);
}

/**
 * The offer pill over the fee panel, read off the same constant the pricing
 * page and the payment page quote from — so the three can never disagree.
 * @param percent - The running setup-fee discount, already clamped 0–100.
 * @returns The pill text, or null when no offer is running.
 */
function offerLabel(percent: number): string | null {
	if (percent <= 0) return null;
	return percent >= 100
		? "Limited-time offer · Fee waived"
		: `Limited-time offer · Save ${percent}%`;
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
	// ones where the pack can still say something the state does not, and the
	// only ones the upload page is offered for. The same predicate the rail's
	// Upload Documents item is gated on, read straight from `me` rather than
	// through `useKycEnabled`: this card already has the session, so a hook that
	// re-derives it from context would only add a way for the two to disagree.
	const kycBlocked = needsKycUpload(me.state);
	// Null while the fetch is in flight and when it failed — either way the row
	// keeps the account-state reading it had before this card ever asked. A blip
	// must not hide the way in.
	const documents = useKycDocuments(kycBlocked);
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
				kycBlocked && pack?.cta !== null
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
	];

	// The one step the card is asking for now: E-sign when owed, else the KYC
	// upload when owed — the same step that already held the filled button. When
	// neither is, nothing is spotlighted: the remaining rows are routes, not
	// blockers this session can see, and an account that is already live must
	// not be told integrating is its next move.
	const upNext = steps.find((step) => step.cta?.primary);
	const offer = offerLabel(SETUP_FEE_DISCOUNT_PERCENT);

	return (
		<Card className="max-w-2xl">
			<CardHeader>
				<CardTitle>Next steps</CardTitle>
				<CardDescription>
					What's left before you can transact in production.
				</CardDescription>
				{/* Decorative: every row already says its own state. The last segment
				    is the fee, which nothing here can see paid, so it stays grey. */}
				<div aria-hidden className="flex gap-1.5 pt-2">
					{[...steps, null].map((step) => (
						<span
							key={step?.label ?? "fee"}
							className={cn(
								"h-1.5 flex-1 rounded-full",
								step?.done
									? "bg-eko-success"
									: step && step === upNext
										? "bg-primary"
										: "bg-muted",
							)}
						/>
					))}
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<ol className="divide-y">
					{steps.map((step, i) => {
						const spotlit = step === upNext;
						return (
							<li
								key={step.label}
								aria-label={spotlit ? `Up next: ${step.label}` : undefined}
								className={cn(
									"flex flex-wrap items-center gap-3 py-3",
									spotlit
										? "mb-1 rounded-lg border border-primary/40 bg-primary/10 px-4 py-4"
										: "px-4 first:pt-0 last:pb-0",
								)}
							>
								<StepMark
									index={i + 1}
									done={step.done}
									label={step.markLabel}
									upNext={spotlit}
								/>
								<span className="flex min-w-48 flex-1 flex-col gap-0.5 text-sm">
									{spotlit ? (
										<span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-eko-gold-ink dark:text-eko-gold">
											Up next
										</span>
									) : null}
									<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
										<span
											className={cn(
												spotlit && "font-semibold",
												step.done && "text-muted-foreground",
											)}
										>
											{step.label}
										</span>
										{step.badge ? (
											<Badge variant={step.badge.variant}>
												{step.badge.label}
											</Badge>
										) : null}
									</span>
								</span>
								{step.cta ? (
									<Button
										asChild
										size="sm"
										variant={step.cta.primary ? "default" : "outline"}
										className="ml-auto shrink-0"
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
						);
					})}
				</ol>
				{/* Out of the numbered list on purpose: the fee gates nothing above it
				    and can be paid on day one, so it is its own panel with its own
				    nudge rather than the last step in a queue. Shown to everyone — a
				    join-date gate once hid it from accounts that DO owe the fee, and
				    nothing upstream yet says an account has paid. */}
				<section
					aria-label="Integration fee"
					className={cn(
						"relative flex flex-wrap items-center gap-3 rounded-lg border border-eko-success/25 bg-eko-success/5 px-4 py-4",
						offer && "mt-2",
					)}
				>
					{offer ? (
						<span className="absolute -top-2.5 right-3 rounded-full bg-eko-success px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
							{offer}
						</span>
					) : null}
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-eko-success/25 bg-background text-eko-success">
						<CreditCard className="h-4 w-4" aria-hidden />
					</span>
					<span className="flex min-w-48 flex-1 flex-col gap-0.5 text-sm">
						<span className="font-semibold">
							Pay your one-time integration fee
						</span>
						<span className="text-muted-foreground">
							No need to wait for the steps above — pay anytime.
							{offer ? " The discount offer may end soon." : null}
						</span>
					</span>
					{/* Navy ink vanishes on the dark card; gold carries it there. */}
					<Button
						asChild
						size="sm"
						variant="navy-outline"
						className="ml-auto shrink-0 dark:border-eko-gold dark:text-eko-gold dark:hover:bg-eko-gold dark:hover:text-eko-navy"
					>
						<Link
							to="/console/pay-activation-fee"
							aria-label="Pay now — one-time integration fee"
						>
							Pay now
						</Link>
					</Button>
				</section>
			</CardContent>
		</Card>
	);
}
