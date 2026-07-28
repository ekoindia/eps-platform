import { KycUploadDialog } from "@/components/console/KycUploadDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, authClient } from "@/lib/auth/client";
import {
	parseDocumentList,
	progressOf,
	statusOfDocument,
	type KycDocument,
} from "@/lib/connect/kyc";
import { useKycEnabled } from "@/lib/connect/use-kyc";
import { CheckCircle2, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/** The two-line page header every console sub-page opens with. */
function Header() {
	return (
		<div className="flex flex-col gap-1">
			<h2 className="text-lg font-semibold text-eko-navy">Upload Documents</h2>
			<p className="text-sm text-muted-foreground">
				Upload the documents we need to verify your business. All of them are
				required.
			</p>
		</div>
	);
}

/**
 * How far through the pack the user is.
 *
 * A plain two-div bar. There is no `ui/progress.tsx` in this project and this
 * does not justify one.
 * @param props.uploaded - Documents done.
 * @param props.total - Documents in the pack.
 */
function Progress({ uploaded, total }: { uploaded: number; total: number }) {
	const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0;
	return (
		<div className="flex flex-col gap-2">
			<p className="text-sm text-muted-foreground">
				{uploaded} of {total} uploaded
			</p>
			<div
				className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
				role="progressbar"
				aria-valuenow={uploaded}
				aria-valuemin={0}
				aria-valuemax={total}
				aria-label="Documents uploaded"
			>
				<div
					className="h-full rounded-full bg-primary transition-[width] duration-300"
					style={{ width: `${percent}%` }}
				/>
			</div>
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
	return (
		<div className="flex items-start gap-3 p-4">
			<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-eko-gold-light">
				<FileText className="h-5 w-5 text-primary" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="font-medium">{doc.name}</p>
				<p className="text-sm text-muted-foreground">
					{[doc.info, `${doc.pages} page${doc.pages > 1 ? "s" : ""}`]
						.filter(Boolean)
						.join(" · ")}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-3">
				{status.uploaded ? (
					<span className="flex items-center gap-1.5 text-sm text-eko-success">
						<CheckCircle2 className="h-4 w-4" />
						{status.label}
					</span>
				) : (
					<Badge variant={status.variant}>{status.label}</Badge>
				)}
				<Button variant="outline" size="sm" onClick={onUpload}>
					{status.uploaded ? "Replace" : doc.error ? "Retry" : "Upload"}
				</Button>
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
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState<KycDocument | null>(null);
	/**
	 * Doc types uploaded successfully in this session.
	 *
	 * Not optimism — each entry is an upstream success envelope. It exists
	 * because the meaning of upstream's own `status` codes is still unconfirmed,
	 * so a refetch alone cannot yet show a document as done. See `kyc.ts`.
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
			setError(
				err instanceof ApiError
					? err.message
					: "Couldn't load your documents. Please try again.",
			);
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

	const { uploaded, total } = progressOf(documents, uploadedNow);
	const resolving = enabled === null || loading;

	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<Header />

			{error ? (
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
					{error}
				</div>
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
					<Progress uploaded={uploaded} total={total} />
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
					// Upstream stays the source of truth for everything else on the row,
					// including a rejection it decides on straight away.
					void load();
				}}
			/>
		</div>
	);
}
