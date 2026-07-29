import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, authClient } from "@/lib/auth/client";
import {
	configOf,
	KYC_ACCEPT,
	KYC_MAX_FILE_BYTES,
} from "@/lib/connect/kyc-docs";
import type { KycDocument } from "@/lib/connect/kyc";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface KycUploadDialogProps {
	/** The document being uploaded. Null closes the dialog. */
	doc: KycDocument | null;
	/**
	 * Called when the dialog closes. Carries upstream's message on a successful
	 * upload, and null when the user simply backed out.
	 */
	onClose: (uploaded: { docType: string; message: string } | null) => void;
}

/**
 * Collects one document's pages and uploads them.
 *
 * A plain shadcn dialog rather than an entry on `DialogHost`: the camera, image
 * editor and viewer `FileUpload` drives are portalled by `ConnectDialogProvider`
 * independently and stack above this on their own. Coordinating that stack is
 * `DialogContent`'s job — see `ignoreNestedDialogInteraction`, without which
 * closing any of them takes this dialog, and every attached page, with it.
 *
 * All pages are required before Submit enables — upstream reviews a document as
 * a set, and a half-uploaded one can only come back as a rejection.
 * @param props - See {@link KycUploadDialogProps}.
 */
export function KycUploadDialog({ doc, onClose }: KycUploadDialogProps) {
	const [files, setFiles] = useState<Array<File | null>>([]);
	const [busy, setBusy] = useState(false);

	// A fresh set of empty slots per document, so reopening the dialog on another
	// row never inherits the previous one's attachments.
	useEffect(() => {
		setFiles(doc ? Array.from({ length: doc.pages }, () => null) : []);
		setBusy(false);
	}, [doc]);

	const complete = files.length > 0 && files.every(Boolean);
	// What this console knows about this document type over and above upstream.
	const config = configOf(doc?.docType ?? "");
	const maxBytes = config.maxBytes ?? KYC_MAX_FILE_BYTES;

	/** Replaces one page's file, leaving the others alone. */
	function setPage(index: number, file: File | null) {
		setFiles((prev) => prev.map((item, i) => (i === index ? file : item)));
	}

	async function submit() {
		if (!doc || !complete || busy) return;
		setBusy(true);
		try {
			const form = new FormData();
			form.append("doc_type", doc.docType);
			form.append("pages", String(doc.pages));
			files.forEach((file, index) => {
				// Non-null by `complete`; the loop is what names the parts.
				if (file) form.append(`file${index + 1}`, file, file.name);
			});
			const { message } = await authClient.connectKyc.upload(form);
			onClose({ docType: doc.docType, message });
		} catch (error) {
			// Deliberately stays open with the files still attached: re-picking every
			// page because the network blipped is the worst possible recovery.
			toast.error(
				error instanceof ApiError
					? error.message
					: "Couldn't upload that document. Please try again.",
			);
			setBusy(false);
		}
	}

	return (
		<Dialog
			open={doc !== null}
			onOpenChange={(open) => {
				if (!open && !busy) onClose(null);
			}}
		>
			<DialogContent className="max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{doc?.name}</DialogTitle>
					<DialogDescription>
						{doc?.info ||
							(doc && doc.pages > 1
								? `Attach all ${doc.pages} pages.`
								: "Attach a JPG, PNG or PDF.")}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					{files.map((file, index) => (
						<FileUpload
							// Slots are positional and fixed for the life of the dialog, so
							// the index is a stable identity here.
							key={index}
							label={
								config.pageLabels?.[index] ??
								(files.length > 1 ? `Page ${index + 1}` : "File")
							}
							required
							accept={config.accept ?? KYC_ACCEPT}
							maxBytes={maxBytes}
							cameraOnly={config.cameraOnly}
							options={config.options}
							file={file}
							disabled={busy}
							// Provenance burnt into the pixels — who, where and when — which
							// is what makes a captured document evidence rather than a photo.
							// Images only; a PDF is attached untouched.
							watermark={config.watermark ?? true}
							onFileChange={(picked) => setPage(index, picked)}
						/>
					))}
				</div>

				<DialogFooter>
					<Button variant="ghost" disabled={busy} onClick={() => onClose(null)}>
						Cancel
					</Button>
					<Button disabled={!complete || busy} onClick={() => void submit()}>
						{busy ? (
							<>
								<RefreshCw className="animate-spin" />
								Uploading…
							</>
						) : (
							"Upload"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
