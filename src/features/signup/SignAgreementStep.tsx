import {
	AlertCircle,
	CheckCircle2,
	FileSignature,
	Loader2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, signupClient, type SignUrlView } from "@/lib/auth/client";
import { esignOrigin, openEsign, usesLeegality } from "./esign";
import type { StepProps } from "./resolveSteps";

type Phase = "loading" | "ready" | "signing" | "signed" | "error";

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
	const [phase, setPhase] = useState<Phase>("loading");
	const [signData, setSignData] = useState<SignUrlView | null>(null);
	const [documentId, setDocumentId] = useState("");
	// Provider/URL error, kept separate from the server-side `error` prop that a
	// failed submit surfaces.
	const [localError, setLocalError] = useState<string | null>(null);
	const started = useRef(false);

	/** Fetches the signing URL; already-signed jumps straight to the submit step. */
	const initialize = useCallback(async () => {
		setPhase("loading");
		setLocalError(null);
		try {
			const data = await signupClient.getAgreementUrl();
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

	// Popup providers report success only via a STATUS_UPDATE postMessage from the
	// signing page. Trust it only from the signing URL's own origin.
	useEffect(() => {
		if (!signData || usesLeegality(signData.pipe)) return;
		const origin = esignOrigin(signData.shortUrl);
		function onMessage(event: MessageEvent) {
			if (origin && event.origin !== origin) return;
			if ((event.data as { type?: string })?.type === "STATUS_UPDATE") {
				setPhase("signed");
			}
		}
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [signData]);

	const handleSign = useCallback(() => {
		if (!signData) return;
		setPhase("signing");
		setLocalError(null);
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

	if (phase === "loading") {
		return (
			<p className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Preparing your agreement…
			</p>
		);
	}

	if (phase === "error") {
		return (
			<div className="flex flex-col gap-4">
				<p
					role="alert"
					className="flex items-center gap-2 text-sm text-destructive"
				>
					<AlertCircle className="h-4 w-4 shrink-0" />
					{localError}
				</p>
				<Button onClick={() => void initialize()}>Try again</Button>
			</div>
		);
	}

	const signed = phase === "signed";

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground">
				Review and digitally sign your agreement to activate your account.
				You'll sign with your Aadhaar in a secure window from our signing
				partner.
			</p>

			{signed ? (
				<p className="flex items-center gap-2 text-sm font-medium text-primary">
					<CheckCircle2 className="h-4 w-4 shrink-0" />
					{signData?.alreadySigned
						? "Your agreement is already signed."
						: "Agreement signed."}
				</p>
			) : (
				<Button
					type="button"
					onClick={handleSign}
					disabled={phase === "signing" || busy}
					className="gap-2"
				>
					{phase === "signing" ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<FileSignature className="h-4 w-4" />
					)}
					{phase === "signing" ? "Signing…" : "Sign Agreement"}
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

			{signed && (
				<Button
					type="button"
					onClick={() => void onSubmit({ document_id: documentId })}
					disabled={busy}
				>
					{busy ? "Finishing…" : "Continue"}
				</Button>
			)}
		</div>
	);
}
