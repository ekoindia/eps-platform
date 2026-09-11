import { Button } from "@/components/ui/button";
import { ApiError, signupClient, type SignUrlView } from "@/lib/auth/client";
import { SUPPORT_WHATSAPP } from "@/lib/config/features";
import { withRetries } from "@/lib/retry";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgreementDocPreview } from "./AgreementDocPreview";
import { esignOrigin, openEsign, usesLeegality } from "./esign";
import type { StepProps } from "./resolveSteps";
import { useSignupProfile } from "./SignupProfileContext";

type Phase = "loading" | "ready" | "signing" | "signed" | "error";

/**
 * How long the popup-provider `Continue` stays disabled after `window.open`.
 *
 * Popup pipes have no callback, so `Continue` is the user's only way forward and
 * has to be offered — but the signing tab can take a second or two to paint, and
 * a `Continue` that is live before it does invites a click that submits an
 * unsigned agreement and earns a 293 failure. Signals are unaffected: a real
 * completion (SDK callback, `STATUS_UPDATE`) submits immediately.
 */
const POPUP_GRACE_SECONDS = 5;

/**
 * The name the generated document carries.
 *
 * Upstream returns no title, and this must match the published sample at
 * `/samples/partner-agreement`, which is the URL handed to the AI below — a user
 * who follows that link and finds a differently-named contract has been given a
 * reason to distrust the flow.
 */
const DOCUMENT_TITLE = "Eko Platform Services Agreement";

/**
 * Where the published sample contract lives.
 *
 * Handed to the AI, and deliberately not linked from the panel: the CTA opens the
 * real, filled-in document for reading before the signature block, so a "read a
 * sample" link would only offer a worse copy of what the button already gives.
 */
const SAMPLE_AGREEMENT_URL = "https://eps.eko.in/samples/partner-agreement";

/**
 * What the AI is asked to do with the sample.
 *
 * The production URL is hard-coded rather than built from `SITE_URL`: ChatGPT
 * fetches this itself, and a dev build's localhost origin would be unreachable.
 */
const EXPLAIN_PROMPT = `Summarize and explain the following sample agreement which I have to sign with eps.eko.in before using their APIs: \`${SAMPLE_AGREEMENT_URL}\`, then ask for followup questions or to explain in my regional language.`;

const EXPLAIN_URL = `https://chatgpt.com/?q=${encodeURIComponent(EXPLAIN_PROMPT)}`;

/**
 * What is being written onto the document, revealed one at a time while the
 * request is in flight.
 *
 * These are fields, not server milestones — the fetch is a single call and
 * reports no progress. They are shown because naming what is being stamped is
 * more informative than a bare spinner, and the last one deliberately never
 * ticks: it completes when the document does.
 */
const STAMPED_FIELDS: readonly string[] = [
	"Registered name",
	"Registered address",
	"Signatory",
	"Formatting and layout",
];

/** How long each field waits before it is shown as stamped. */
const STAMP_INTERVAL_MS = 1200;

/** How long a fetch runs before the copy admits it is taking longer than usual. */
const SLOW_AFTER_MS = 8000;

/**
 * The alphabet a reference is drawn from: 32 characters with `I`, `O`, `0` and
 * `1` left out, because these get read down a phone line to support.
 *
 * Exactly 32 also means a byte maps onto it with no modulo bias (256 / 32 = 8).
 */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** How many characters a reference carries. */
const REF_LENGTH = 10;

/**
 * A reference for one attempt at preparing the document.
 *
 * Deliberately opaque — it is a lookup key, not a code anyone parses, so it
 * carries no prefix or grouping that could drift out of step with whatever a log
 * search expects. Minted before the request rather than after a failure, so the
 * string the user is shown is the one that travelled with the call that broke.
 */
function newClientRef(): string {
	const bytes = new Uint8Array(REF_LENGTH);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join(
		"",
	);
}

/** The uppercase eyebrow the signup asides use, reused for the panel's status line. */
const EYEBROW = "text-xs font-bold tracking-[0.12em] uppercase";

/**
 * Sign Agreement step. Fetches the provider signing URL, opens the e-sign
 * provider (Leegality SDK or a popup), and on completion submits the document
 * id to advance onboarding.
 *
 * The multi-phase provider flow lives here; only the final submit crosses the
 * wizard's `onSubmit` — the wizard never learns about signing, exactly like the
 * other steps only hand it their collected values.
 */
export function SignAgreementStep({ onSubmit, busy, error }: StepProps) {
	const profile = useSignupProfile();
	const [phase, setPhase] = useState<Phase>("loading");
	const [signData, setSignData] = useState<SignUrlView | null>(null);
	const [documentId, setDocumentId] = useState("");
	// Provider/URL error, kept separate from the server-side `error` prop that a
	// failed submit surfaces.
	const [localError, setLocalError] = useState<string | null>(null);
	// Seconds left on the popup grace period; 0 when none is running.
	const [grace, setGrace] = useState(0);
	// The reference for the CURRENT attempt; a retry mints a new one.
	const [clientRef, setClientRef] = useState("");
	// How many times preparing the document has been started this mount. Counts
	// user attempts, NOT `withRetries` attempts — three transparent retries behind
	// one spinner are still one try as far as the user is concerned.
	const [attempts, setAttempts] = useState(0);
	// How many of `STAMPED_FIELDS` are shown as done, and whether the wait has
	// run long enough to say so. Both reset at the start of every attempt.
	const [stamped, setStamped] = useState(0);
	const [slow, setSlow] = useState(false);
	const started = useRef(false);
	// Auto-submit fires at most once per mount; the manual Continue is what
	// retries a failed submit, so this must NOT reset on failure.
	const autoSubmitted = useRef(false);
	// Re-entrancy guard shared by both submit paths: `busy` only arrives after
	// the wizard re-renders, so it cannot stop a click that lands in the same
	// tick as the auto-submit.
	const submitting = useRef(false);

	/** Fetches the signing URL; already-signed jumps straight to the submit step. */
	const initialize = useCallback(async () => {
		const ref = newClientRef();
		setClientRef(ref);
		setAttempts((n) => n + 1);
		// Reset BOTH counters, not just the timers: a second attempt after a slow
		// first one would otherwise open with every field already ticked and the
		// "slower than usual" line already showing.
		setStamped(0);
		setSlow(false);
		setPhase("loading");
		setLocalError(null);
		try {
			const data = await withRetries(() => signupClient.getAgreementUrl(ref));
			setSignData(data);
			setDocumentId(data.documentId);
			setPhase(data.alreadySigned ? "signed" : "ready");
		} catch (e) {
			// The only place the reference and the underlying failure appear
			// together — the panel shows the user the reference alone.
			console.error(`[agreement] ${ref}`, e);
			setLocalError(
				e instanceof ApiError
					? e.message
					: "Couldn't prepare your agreement. Please try again.",
			);
			setPhase("error");
		}
	}, []);

	// Fetch once on mount. `started` guards a StrictMode double-invoke.
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void initialize();
	}, [initialize]);

	/** The single submit path — both the auto-advance and the button route here. */
	const submit = useCallback(async () => {
		if (submitting.current) return;
		submitting.current = true;
		try {
			await onSubmit({ document_id: documentId });
		} finally {
			submitting.current = false;
		}
	}, [onSubmit, documentId]);

	const loading = phase === "loading";
	const failed = phase === "error";
	const signed = phase === "signed";
	// A popup provider is open: `window.open` has fired and no SDK callback will
	// ever come, so `signing` is not a state the component can leave on its own.
	const popupOpen =
		phase === "signing" && !!signData && !usesLeegality(signData.pipe);

	// Every completion signal — SDK callback, STATUS_UPDATE, or an agreement that
	// was already signed — lands on `signed`, and the user should not have to
	// click Continue after the provider already said it was done.
	useEffect(() => {
		if (!signed || autoSubmitted.current) return;
		autoSubmitted.current = true;
		void submit();
	}, [signed, submit]);

	// The loading panel's two clocks, armed and disarmed together with the phase.
	// The last field never ticks (`length - 1`): it is done when the document is,
	// and showing it complete while we are still waiting would be a lie.
	useEffect(() => {
		if (!loading) return;
		const ticker = setInterval(
			() => setStamped((n) => Math.min(n + 1, STAMPED_FIELDS.length - 1)),
			STAMP_INTERVAL_MS,
		);
		const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
		return () => {
			clearInterval(ticker);
			clearTimeout(slowTimer);
		};
	}, [loading]);

	// One timeout per remaining second of the popup grace period.
	useEffect(() => {
		if (grace === 0) return;
		const timer = setTimeout(() => setGrace(grace - 1), 1000);
		return () => clearTimeout(timer);
	}, [grace]);

	// Popup providers report success only via a STATUS_UPDATE postMessage from the
	// signing page. Trust it only from the signing URL's own origin, and only
	// while a signing window is actually open — with auto-submit downstream, an
	// unsolicited message would otherwise advance onboarding on its own.
	useEffect(() => {
		if (!popupOpen || !signData) return;
		const origin = esignOrigin(signData.shortUrl);
		function onMessage(event: MessageEvent) {
			if (origin && event.origin !== origin) return;
			if ((event.data as { type?: string })?.type === "STATUS_UPDATE") {
				setPhase("signed");
			}
		}
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [popupOpen, signData]);

	const handleSign = useCallback(() => {
		if (!signData) return;
		setPhase("signing");
		setLocalError(null);
		// Popup pipes only — the SDK modal renders in-page and needs no grace.
		if (!usesLeegality(signData.pipe)) setGrace(POPUP_GRACE_SECONDS);
		void openEsign(signData.shortUrl, signData.pipe, (outcome) => {
			if (outcome.error) {
				setLocalError(outcome.error);
				setPhase("ready");
				return;
			}
			if (outcome.documentId) setDocumentId(outcome.documentId);
			setPhase("signed");
		});
	}, [signData]);

	// The SDK modal is up: nothing to do but wait for its callback. A popup is
	// different — the user may need to reopen a window they closed.
	const sdkOpen = phase === "signing" && !popupOpen;
	// The popup grace period is still running, so Continue is not live yet.
	const waiting = popupOpen && grace > 0;
	// Blank/whitespace upstream names read as absent rather than a dangling "for".
	const name = profile.name?.trim();
	const whatsapp = SUPPORT_WHATSAPP.replace(/\D/g, "");

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<h2 className="text-2xl font-semibold tracking-tight">
					Last step — sign the agreement
				</h2>
				<p className="text-muted-foreground">
					It costs nothing and commits you to nothing. Test everything free; you
					pay only once you've integrated, gone live and started doing real
					transactions.
				</p>
			</div>

			{/* One panel, four contents. The preview stays mounted across all of
			    them so the page mock morphs in place rather than being swapped for
			    a differently-sized box each time the phase changes. */}
			<div
				className={`flex gap-4 rounded-lg border p-4 ${
					failed
						? "border-destructive/30 bg-destructive/5"
						: "border-border bg-muted/30"
				}`}
			>
				<AgreementDocPreview
					state={failed ? "error" : loading ? "loading" : "ready"}
				/>

				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					{failed ? (
						<>
							<p className={`${EYEBROW} text-destructive`}>
								Couldn't prepare the document
							</p>
							<p className="text-base font-semibold text-foreground">
								Something broke on our side
							</p>
							<p className="text-sm text-muted-foreground">
								Nothing you entered is lost — your business details are saved
								and will be filled in again. This is almost always fixed by one
								retry.
							</p>
							{/* Held back until a retry has ALSO failed. The copy below
							    promises one retry usually fixes this, and it usually does —
							    pointing at a human on the first failure would send people to
							    support ahead of the button that would have worked. Also
							    requires a configured number: the support vars are
							    per-deployment, and a dead link is worse than none. */}
							{whatsapp && attempts > 1 && (
								<a
									href={`https://wa.me/${whatsapp.length === 10 ? `91${whatsapp}` : whatsapp}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm font-medium text-foreground underline underline-offset-4"
								>
									Talk to support on WhatsApp
								</a>
							)}
							<p className="font-mono text-xs text-muted-foreground">
								REF {clientRef}
							</p>
						</>
					) : loading ? (
						<div
							role="status"
							aria-live="polite"
							className="flex flex-col gap-1.5"
						>
							<p className="flex items-center gap-2 text-base font-semibold text-foreground">
								<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
								Preparing your document…
							</p>
							{slow && (
								<p className="text-sm text-muted-foreground">
									Still going — this one is slower than usual. Nothing is lost;
									your details are saved and the document will appear here as
									soon as it is ready.
								</p>
							)}
							<ul className="mt-1 flex flex-col gap-1">
								{STAMPED_FIELDS.map((field, index) => (
									<li
										key={field}
										className={`text-sm ${
											index < stamped
												? "text-eko-success"
												: "text-muted-foreground/60"
										}`}
									>
										{index < stamped ? `✓ ${field}` : `${field}…`}
									</li>
								))}
							</ul>
						</div>
					) : (
						<>
							<p
								className={`${EYEBROW} flex items-center gap-1.5 text-eko-success`}
							>
								<CheckCircle2 className="h-4 w-4 shrink-0" />
								{signed ? "Signed" : "Document ready"}
							</p>
							<p className="text-base font-semibold text-foreground">
								{DOCUMENT_TITLE}
							</p>
							{name && (
								<p className="text-sm text-muted-foreground">
									Prepared for{" "}
									<span className="font-semibold text-foreground">{name}</span>
								</p>
							)}
							<div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
								<a
									href={EXPLAIN_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
								>
									<Sparkles className="h-3.5 w-3.5 shrink-0" />
									Explain with AI
								</a>
							</div>
							{documentId && (
								<p className="truncate font-mono text-xs text-muted-foreground">
									ID {documentId}
								</p>
							)}
						</>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				{loading && (
					<Button type="button" size="lg" className="w-full" disabled>
						Preparing your document…
					</Button>
				)}

				{failed && (
					<Button
						type="button"
						size="lg"
						className="w-full"
						onClick={() => void initialize()}
					>
						Try again
					</Button>
				)}

				{!signed && !loading && !failed && (
					<Button
						type="button"
						size="lg"
						className="w-full"
						onClick={handleSign}
						disabled={busy || sdkOpen}
					>
						{sdkOpen && <Loader2 className="h-4 w-4 animate-spin" />}
						{sdkOpen
							? "Signing…"
							: popupOpen
								? "Open the signing window again"
								: "Read and sign the agreement"}
					</Button>
				)}

				{/* ponytail: Continue showing for an open popup does NOT assert the user
				    signed — popup providers have no callback, so the only alternative is
				    the dead end this replaces. Interaction 293 is the arbiter and rejects
				    an unsigned agreement with the upstream's own message. It renders
				    ALONGSIDE the reopen button above, never instead of it. */}
				{(signed || popupOpen) && (
					<>
						{waiting && (
							<p aria-live="polite" className="text-sm text-muted-foreground">
								Opening the signing window… you can continue in {grace} second
								{grace === 1 ? "" : "s"}.
							</p>
						)}
						<Button
							type="button"
							size="lg"
							className="w-full"
							onClick={() => void submit()}
							disabled={busy || waiting}
						>
							{busy ? "Finishing…" : "Continue"}
						</Button>
					</>
				)}

				{/* Three captions, one line: the first failure points at the button,
				    a later one points at a person. */}
				<p className="text-center text-[0.7em] text-muted-foreground">
					{!failed
						? "Opens the document first. You sign at the end with your Aadhaar number and an OTP."
						: attempts > 1
							? `Quote reference ${clientRef} to support and we'll prepare it manually within a working day.`
							: `If the second attempt fails too, quote reference ${clientRef} to support and we'll prepare it manually within a working day.`}
				</p>
			</div>

			{localError && !signed && (
				<p
					role="alert"
					className="flex items-start gap-2 text-sm text-destructive"
				>
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
					{localError}
				</p>
			)}
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			{/* Same geometry as PanAside's soft gold box. Not a <Callout>: its warning
			    variant renders an AlertTriangle and a "Warning" label, and this is the
			    opposite of a warning. */}
			<div className="rounded-lg border border-eko-gold/40 bg-eko-gold-light p-4 text-[0.8rem] text-eko-navy">
				<strong className="font-semibold">
					Signing does not start a bill.
				</strong>{" "}
				There is no signing fee and no minimum usage. Test as long as you like,
				and walk away if it isn't right for you. Charges begin only after you've
				integrated, gone live, and started processing real transactions.
			</div>
		</div>
	);
}
