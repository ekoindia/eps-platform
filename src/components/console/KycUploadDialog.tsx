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
import { diagnosticsLine, errorDiagnostics } from "@/lib/console/diagnostics";
import { withRetries } from "@/lib/retry";
import { getBlurScore, withBlurScoreInName } from "@/lib/connect/blur";
import type { KycDocument } from "@/lib/connect/kyc";
import {
	configOf,
	KYC_ACCEPT,
	KYC_BLUR_CHECK,
	KYC_BLUR_STAMP_FILENAME,
	KYC_BLUR_THRESHOLD,
	KYC_MAX_FILE_BYTES,
} from "@/lib/connect/kyc-docs";
import { Download, Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

/**
 * Turns a slot label into something safe to use as a file name.
 * @param label - The page label, e.g. `Aadhaar front`.
 * @returns A lowercase hyphenated stem, e.g. `aadhaar-front`.
 */
function slugify(label: string): string {
	return (
		label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "document"
	);
}

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
 * Only the first page is required. Upstream's page count is a ceiling, not a
 * contract — plenty of documents it lists as two pages are genuinely one sheet,
 * and a slot that cannot be filled would otherwise block the upload outright.
 * Whatever is attached is sent as a contiguous `file1..fileN` with `pages` set
 * to that count, so a short pack is indistinguishable upstream from a document
 * that only ever had that many pages.
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

	// The first slot only: see the note on the component. Later slots are
	// optional, so nothing about them can hold Upload back.
	const ready = files.length > 0 && files[0] instanceof File;
	// What this console knows about this document type over and above upstream.
	const config = configOf(doc?.docType ?? "");
	const maxBytes = config.maxBytes ?? KYC_MAX_FILE_BYTES;

	/** Replaces one page's file, leaving the others alone. */
	function setPage(index: number, file: File | null) {
		setFiles((prev) => prev.map((item, i) => (i === index ? file : item)));
	}

	async function submit() {
		if (!doc || !ready || busy) return;
		setBusy(true);
		try {
			// Empty slots are dropped and the rest renumbered, so the parts are
			// always a contiguous `file1..fileN`: the backend requires exactly
			// `pages` of them, and forwards that count upstream verbatim. A skipped
			// middle slot therefore arrives one page earlier than it was attached —
			// acceptable, because upstream reviews the images themselves, and the
			// alternative is refusing an upload it would have accepted.
			const attached = files.filter((file) => file instanceof File);
			const form = new FormData();
			form.append("doc_type", doc.docType);
			form.append("pages", String(attached.length));
			attached.forEach((file, index) => {
				const sharpness = getBlurScore(file);
				// Two channels for the same number, because only one of them
				// currently arrives: upstream keeps the file name but drops fields it
				// does not know, so the name is what a reviewer actually sees. The
				// field is the one to keep once upstream records it.
				const name =
					KYC_BLUR_STAMP_FILENAME && sharpness !== undefined
						? withBlurScoreInName(file.name, sharpness)
						: file.name;
				form.append(`file${index + 1}`, file, name);
				if (sharpness !== undefined) {
					form.append(`blur_score${index + 1}`, String(sharpness));
				}
			});
			const { message } = await withRetries(() =>
				authClient.connectKyc.upload(form),
			);
			onClose({ docType: doc.docType, message });
		} catch (error) {
			// Deliberately stays open with the files still attached: re-picking every
			// page because the network blipped is the worst possible recovery.
			// The identifiers go in the toast's description rather than the message:
			// a failed KYC upload is exactly the screenshot support receives, and
			// without the reference there is nothing to look the attempt up by.
			const diagnostics = errorDiagnostics(error);
			toast.error(
				diagnostics.safeMessage ??
					"Couldn't upload that document. Please try again.",
				{ description: diagnosticsLine(diagnostics) },
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
			{/* Wider than the shadcn default: a row carries a thumbnail, a file
			    name, a size and four buttons, and at `max-w-lg` the name is
			    truncated to a few characters. */}
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>{doc?.name}</DialogTitle>
					<DialogDescription>
						{doc?.info ||
							(doc && doc.pages > 1
								? `Attach up to ${doc.pages} pages; only the first is required.`
								: "Attach a JPG, PNG or PDF.")}
					</DialogDescription>
				</DialogHeader>

				{/*
				 * Whatever this document needs said before a file is picked — what
				 * must be on the letterhead, which director signs, what makes review
				 * reject it. Markdown so a list reads as a list.
				 */}
				{config.instructions ? (
					<div className="flex gap-3 rounded-md border border-eko-gold/40 bg-eko-gold-light/50 p-3 text-sm text-foreground">
						<Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
						<div
							className={
								// No typography plugin in this project, and pulling in
								// `MarkdownProse` would drag the docs syntax highlighter into
								// the console bundle. These are the few elements an
								// instruction block actually uses.
								"min-w-0 flex-1 [&_p]:my-0 [&_p+p]:mt-2 [&_strong]:font-semibold [&_a]:font-medium [&_a]:underline [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]"
							}
						>
							{/*
							 * The text is ours, from `kyc-docs.ts`, never upstream's — and
							 * raw HTML stays off (no `rehype-raw`), so markdown here cannot
							 * become markup.
							 */}
							<Markdown remarkPlugins={[remarkGfm]}>
								{config.instructions}
							</Markdown>
						</div>
					</div>
				) : null}

				{/*
				 * Above the slots, not below: a partner who has already attached
				 * something they wrote themselves has no reason to read on, and the
				 * point of the sample is to be read first.
				 *
				 * A plain download link — the same `<a href download>` the docs and
				 * pricing pages use. The file is static, under `public/kyc-samples/`.
				 */}
				{config.sampleUrl ? (
					<a
						href={config.sampleUrl}
						download
						className="inline-flex items-center gap-2 self-start rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Download className="h-4 w-4 shrink-0" />
						Download the sample, fill and sign it, then upload the PDF
					</a>
				) : null}

				<div className="flex flex-col gap-4">
					{files.map((file, index) => {
						const label =
							config.pageLabels?.[index] ??
							(files.length > 1 ? `Page ${index + 1}` : "File");
						// Every slot past the first. Spelled out on the label rather than
						// left to a missing asterisk: an absent mark is a weak signal, and
						// a partner who reads it as "required" abandons an upload they
						// could have finished.
						const optional = index > 0;
						return (
							<FileUpload
								// Slots are positional and fixed for the life of the dialog, so
								// the index is a stable identity here.
								key={index}
								label={optional ? `${label} (optional)` : label}
								required={!optional}
								accept={config.accept ?? KYC_ACCEPT}
								maxBytes={maxBytes}
								cameraOnly={config.cameraOnly}
								// Several photos of one side, combined into a single PDF. Off
								// unless this document type asks for it.
								multiple={config.multiple}
								// Names the combined PDF after the slot, so a reviewer opening
								// the upload can tell which side of the card they are looking
								// at instead of two files both called "combined-documents".
								combinedFileName={`${slugify(label)}.pdf`}
								// One legibility rule for the whole checklist — see
								// `KYC_BLUR_CHECK` — unless the document type names its own
								// mode, as a live photograph does. Spread last so `options`
								// cannot quietly opt a document out; its type excludes these
								// keys, and `config.blurCheck` is the sanctioned way in.
								options={{
									...config.options,
									blurCheck: config.blurCheck ?? KYC_BLUR_CHECK,
									blurThreshold: KYC_BLUR_THRESHOLD,
								}}
								file={file}
								disabled={busy}
								// Provenance burnt into the pixels — who, where and when —
								// which is what makes a captured document evidence rather than
								// a photo. Images only; a PDF is attached untouched.
								//
								// Opt-IN, per document. A stamp belongs on a capture this
								// console witnessed (a live photograph taken here, now); on a
								// scan of a pre-existing card it defaces someone's Aadhaar
								// with our metadata and proves nothing about the card. Only
								// doc_type 24 asks for it today.
								watermark={config.watermark}
								onFileChange={(picked) => setPage(index, picked)}
							/>
						);
					})}
				</div>

				<DialogFooter>
					<Button variant="ghost" disabled={busy} onClick={() => onClose(null)}>
						Cancel
					</Button>
					<Button disabled={!ready || busy} onClick={() => void submit()}>
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
