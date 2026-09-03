import { KycUploadDialog } from "@/components/console/KycUploadDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorNotice } from "@/components/console/ErrorNotice";
import { ApiError, authClient } from "@/lib/auth/client";
import {
	parseDocumentList,
	statusOfDocument,
	type KycDocument,
} from "@/lib/connect/kyc";
import { configOf } from "@/lib/connect/kyc-docs";
import { useKycEnabled } from "@/lib/connect/use-kyc";
import { CheckCircle2, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * The two-line page header every console sub-page opens with.
 * @param props.waiting - Whether every document is in, leaving nothing to
 *   upload. Asking for uploads under a list that offers no Upload button reads
 *   as a broken page, so the subtitle says what the partner should do instead.
 */
function Header({ waiting = false }: { waiting?: boolean }) {
	return (
		<div className="flex flex-col gap-1">
			<h2 className="text-lg font-semibold text-eko-navy">Upload Documents</h2>
			<p className="text-sm text-muted-foreground">
				{waiting
					? "Please wait while we verify your uploaded documents. Please check back later for updated status."
					: "Upload the documents we need to verify your business. All of them are required."}
			</p>
		</div>
	);
}

/**
 * One document: what it is, where it stands, and the button that acts on it.
 * @param props.doc - The document row.
 * @param props.justUploaded - Whether this session already uploaded it.
 * @param props.onUpload - Opens the upload dialog for this document.
 */
function DocumentRow({
	doc,
	justUploaded,
	onUpload,
}: {
	doc: KycDocument;
	justUploaded: boolean;
	onUpload: () => void;
}) {
	const status = statusOfDocument(doc, justUploaded);
	// A camera-only document has no "upload" to speak of — the file picker is
	// hidden and the only way in is the viewfinder, so the button says what the
	// next tap actually does. Replace and rejected collapse to one label there:
	// the action is identical, and "Retry" reads as retrying a failed upload
	// rather than taking the photograph again.
	const again = status.uploaded || status.variant === "destructive";
	const cta = configOf(doc.docType).cameraOnly
		? again
			? "Capture Again"
			: "Capture"
		: status.uploaded
			? "Replace"
			: status.variant === "destructive"
				? "Retry"
				: "Upload";
	// A green tick only for a document upstream has actually approved; anything
	// else with something to say wears its own Badge variant — an "Approval
	// Pending" row is uploaded, not done, and a tick would say otherwise.
	const pill = !status.label ? null : status.variant === "default" ? (
		<span className="flex items-center gap-1.5 text-sm text-eko-success">
			<CheckCircle2 className="h-4 w-4" />
			{status.label}
		</span>
	) : (
		<Badge variant={status.variant}>{status.label}</Badge>
	);
	return (
		<div className="flex items-start gap-3 p-4">
			<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-eko-gold-light">
				<FileText className="h-5 w-5 text-primary" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="font-medium">{doc.name}</p>
				{doc.info ? (
					<p className="text-sm text-muted-foreground">{doc.info}</p>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-3">
				{pill && status.desc ? (
					<Tooltip>
						{/* Focusable, so the explanation is reachable without a pointer. */}
						<TooltipTrigger asChild>
							<span tabIndex={0}>{pill}</span>
						</TooltipTrigger>
						<TooltipContent>{status.desc}</TooltipContent>
					</Tooltip>
				) : (
					pill
				)}
				{/* No button at all on a status that forbids it — a document under
				    review is not something to replace, and a disabled button invites
				    the click anyway. The pill's tooltip carries the reason. */}
				{status.canUpload ? (
					<Button size="sm" onClick={onUpload}>
						{cta}
					</Button>
				) : null}
			</div>
		</div>
	);
}

/**
 * The KYC document checklist.
 *
 * Every listed document is mandatory here: upstream marks some optional, and
 * this page deliberately does not repeat that distinction — see `KycDocument`.
 */
export default function Documents() {
	const enabled = useKycEnabled();
	const [documents, setDocuments] = useState<KycDocument[]>([]);
	const [loading, setLoading] = useState(true);
	// The error OBJECT, not its message — see ErrorNotice.
	const [error, setError] = useState<unknown>(null);
	const [uploading, setUploading] = useState<KycDocument | null>(null);
	/**
	 * Doc types uploaded successfully in this session.
	 *
	 * Each entry is an upstream success envelope, read ahead of the refetch it
	 * triggers — there's no guarantee that refetch already reflects the write
	 * it's chasing. Bridges that gap only; the refetched `status: 1` — awaiting
	 * approval — takes over from here. See `kyc.ts`.
	 */
	const [uploadedNow, setUploadedNow] = useState<ReadonlySet<string>>(
		new Set(),
	);

	const load = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		setError(null);
		try {
			const { documents: raw } = await authClient.connectKyc.documents(signal);
			setDocuments(parseDocumentList(raw));
		} catch (err) {
			if (signal?.aborted) return;
			setError(err);
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		// Never fires a request the user is not entitled to make.
		if (enabled !== true) return;
		const controller = new AbortController();
		void load(controller.signal);
		return () => controller.abort();
	}, [enabled, load]);

	// The rail hides this page, but the route is reachable by URL — a nav item is
	// not an access control.
	if (enabled === false) {
		return (
			<div className="flex max-w-3xl flex-col gap-6">
				<Header />
				<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
					Document verification isn't available on this account.
				</div>
			</div>
		);
	}

	const resolving = enabled === null || loading;

	// Counted through `statusOfDocument`, not `documents.length`: a pack whose
	// approved rows still counted as pending would tell a partner they owe work
	// they have already done. `uploadedNow` counts too, for the same reason the
	// rows honour it — see `kyc.ts`.
	const statuses = documents.map((doc) =>
		statusOfDocument(doc, uploadedNow.has(doc.docType)),
	);
	const pending = statuses.filter((status) => !status.uploaded).length;
	const summary = !pending
		? "All documents uploaded"
		: `${pending} of ${documents.length} document${documents.length > 1 ? "s" : ""} pending`;

	// Not `!pending`: `canUpload` is the flag that decides whether a row offers a
	// button at all, and it is deliberately not `!uploaded` — see `kyc.ts`. The
	// header should follow the buttons. Not gated on `resolving` either: the
	// refetch after the last upload would otherwise flip the subtitle back to
	// asking for uploads that are already in.
	const waiting =
		!error && documents.length > 0 && !statuses.some((s) => s.canUpload);

	return (
		// Its own provider, not the app's: this page is rendered on its own in
		// tests, and Radix throws if a Tooltip finds no provider above it.
		<TooltipProvider delayDuration={150}>
			<div className="flex max-w-3xl flex-col gap-6">
				<Header waiting={waiting} />

				{error ? (
					<ErrorNotice
						error={error}
						fallback="Couldn't load your documents. Please try again."
					/>
				) : null}

				{resolving ? (
					<div className="flex flex-col gap-2" data-testid="documents-loading">
						{Array.from({ length: 4 }, (_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				) : null}

				{!resolving && !error && documents.length === 0 ? (
					<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
						No pending documents at this time. If you have already uploaded your
						documents, it is pending verification.
					</div>
				) : null}

				{!resolving && !error && documents.length > 0 ? (
					<>
						<p className="text-sm text-muted-foreground">{summary}</p>
						<div className="divide-y rounded-lg border">
							{documents.map((doc) => (
								<DocumentRow
									key={doc.docType}
									doc={doc}
									justUploaded={uploadedNow.has(doc.docType)}
									onUpload={() => setUploading(doc)}
								/>
							))}
						</div>
					</>
				) : null}

				<KycUploadDialog
					doc={uploading}
					onClose={(result) => {
						setUploading(null);
						if (!result) return;
						toast.success(result.message);
						setUploadedNow((prev) => new Set(prev).add(result.docType));
						// Upstream stays the source of truth for everything else on the
						// row, including a rejection it decides on straight away.
						void load();
					}}
				/>
			</div>
		</TooltipProvider>
	);
}
