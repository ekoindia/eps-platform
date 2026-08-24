import {
	AlertCircle,
	CheckCircle2,
	Circle,
	FileSignature,
	Loader2,
	RotateCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, signupClient, type SignUrlView } from "@/lib/auth/client";
import { withRetries } from "@/lib/retry";
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
		setPhase("loading");
		setLocalError(null);
		try {
			const data = await withRetries(() => signupClient.getAgreementUrl());
			setSignData(data);
			setDocumentId(data.documentId);
			setPhase(data.alreadySigned ? "signed" : "ready");
		} catch (e) {
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

	const loading = phase === "loading";
	const failed = phase === "error";
	// The SDK modal is up: nothing to do but wait for its callback. A popup is
	// different — the user may need to reopen a window they closed.
	const sdkOpen = phase === "signing" && !popupOpen;
	// The popup grace period is still running, so Continue is not live yet.
	const waiting = popupOpen && grace > 0;
	// Blank/whitespace upstream names read as absent rather than a dangling "for".
	const name = profile.name?.trim();

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground">
				Review and digitally sign the terms and conditions to activate your
				account and start using our services.
			</p>

			<ul className="flex flex-col gap-3">
				<li className="flex items-start gap-2">
					{loading ? (
						<Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
					) : failed ? (
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
					) : (
						<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					)}
					<div className="flex-1">
						<p
							className={`text-sm font-medium ${
								loading
									? "text-muted-foreground"
									: failed
										? "text-destructive"
										: "text-primary"
							}`}
						>
							{loading
								? "Preparing your document…"
								: failed
									? "Failed to prepare document"
									: signData?.alreadySigned
										? "Your agreement is already signed"
										: name
											? `Document is generated for ${name}`
											: "Document is generated"}
						</p>
						{documentId && !failed && (
							<p className="text-xs italic text-muted-foreground">
								Document ID: {documentId}
							</p>
						)}
					</div>
					{failed && (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto shrink-0 p-0 text-destructive"
							onClick={() => void initialize()}
						>
							<RotateCw className="h-4 w-4" />
							Retry
						</Button>
					)}
				</li>

				<li className={`flex items-center gap-2 ${failed ? "opacity-40" : ""}`}>
					{signed ? (
						<CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
					) : (
						<Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
					)}
					<span className="text-sm font-medium">Document Esign</span>
					<Badge variant={signed ? "default" : "secondary"}>
						{signed ? "Completed" : "Pending"}
					</Badge>
				</li>
			</ul>

			{!signed && !loading && !failed && (
				<Button
					type="button"
					onClick={handleSign}
					disabled={busy || sdkOpen}
					className="gap-2"
				>
					{sdkOpen ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<FileSignature className="h-4 w-4" />
					)}
					{sdkOpen
						? "Signing…"
						: popupOpen
							? "Open the signing window again"
							: "Sign Agreement"}
				</Button>
			)}

			{localError && !signed && (
				<p role="alert" className="text-sm text-destructive">
					{localError}
				</p>
			)}
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			{!signed && !loading && !failed && (
				<div className="rounded-md border bg-muted/50 p-4 text-sm">
					<p className="font-semibold">Steps:</p>
					<ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
						<li>Click "Sign Agreement" to start the e-sign process</li>
						<li>Complete your e-signature in the new window using Aadhaar</li>
						<li>Return here and click "Continue" once finished</li>
					</ol>
				</div>
			)}

			{/* ponytail: Continue showing for an open popup does NOT assert the user
			    signed — popup providers have no callback, so the only alternative is
			    the dead end this replaces. Interaction 293 is the arbiter and rejects
			    an unsigned agreement with the upstream's own message. */}
			{(signed || popupOpen) && (
				<div className="flex flex-col gap-2">
					{waiting && (
						<p aria-live="polite" className="text-sm text-muted-foreground">
							Opening the signing window… you can continue in {grace} second
							{grace === 1 ? "" : "s"}.
						</p>
					)}
					<Button
						type="button"
						onClick={() => void submit()}
						disabled={busy || waiting}
					>
						{busy ? "Finishing…" : "Continue"}
					</Button>
				</div>
			)}
		</div>
	);
}
