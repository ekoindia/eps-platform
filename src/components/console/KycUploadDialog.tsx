import { FileUpload } from "@/components/FileUpload";
import { Callout } from "@/components/docs/Callout";
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
import type { DirectorNoun } from "@/lib/connect/directors";
import type { KycDocument } from "@/lib/connect/kyc";
import {
	configOf,
	KYC_ACCEPT,
	KYC_BLUR_CHECK,
	KYC_BLUR_STAMP_FILENAME,
	KYC_BLUR_THRESHOLD,
	KYC_DOC_OPTIONS,
	KYC_MAX_FILE_BYTES,
} from "@/lib/connect/kyc-docs";
import { pdfPageCount } from "@/lib/pdf/pdf-client";
import { AlertTriangle, Download, Info, RefreshCw } from "lucide-react";
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

/**
 * How many pages a set of attachments comes to: one per image, and a PDF's own
 * page count — the combined PDF a multi-photo slot produces included.
 *
 * A PDF that cannot be read counts as one page. This only feeds a warning the
 * partner can override, so a guess beats refusing the upload.
 * @param files - The attached files.
 * @returns The total page count.
 */
async function countPages(files: File[]): Promise<number> {
	const counts = await Promise.all(
		files.map((file) =>
			file.type === "application/pdf"
				? pdfPageCount(file).catch(() => 1)
				: Promise.resolve(1),
		),
	);
	return counts.reduce((sum, count) => sum + count, 0);
}

const DIRECTORS: DirectorNoun = { one: "director", many: "directors" };

export interface KycUploadDialogProps {
	/** The document being uploaded. Null closes the dialog. */
	doc: KycDocument | null;
	/**
	 * Called when the dialog closes. Carries upstream's message on a successful
	 * upload, and null when the user simply backed out.
	 */
	onClose: (uploaded: { docType: string; message: string } | null) => void;
	/**
	 * How many directors a per-director document must cover — see
	 * `KycDocConfig.perDirector`. Null or absent: nothing to check against.
	 */
	directorCount?: number | null;
	/** What those people are called. Defaults to directors. */
	directorNoun?: DirectorNoun;
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
export function KycUploadDialog({
	doc,
	onClose,
	directorCount = null,
	directorNoun = DIRECTORS,
}: KycUploadDialogProps) {
	const [files, setFiles] = useState<Array<File | null>>([]);
	const [busy, setBusy] = useState(false);
	/**
	 * The page count of an upload that came up short of the director count,
	 * while the partner decides whether to send it anyway. Null otherwise.
	 */
	const [shortPages, setShortPages] = useState<number | null>(null);

	// A fresh set of empty slots per document, so reopening the dialog on another
	// row never inherits the previous one's attachments.
	useEffect(() => {
		setFiles(doc ? Array.from({ length: doc.pages }, () => null) : []);
		setBusy(false);
		setShortPages(null);
	}, [doc]);

	// The first slot only: see the note on the component. Later slots are
	// optional, so nothing about them can hold Upload back.
	const ready = files.length > 0 && files[0] instanceof File;
	// What this console knows about this document type over and above upstream.
	const config = configOf(doc?.docType ?? "");
	const maxBytes = config.maxBytes ?? KYC_MAX_FILE_BYTES;
	// The count this document has to cover, when it is one copy per director
	// and there is more than one of them.
	const perDirector =
		config.perDirector && directorCount !== null && directorCount > 1
			? directorCount
			: null;

	/** Replaces one page's file, leaving the others alone. */
	function setPage(index: number, file: File | null) {
		setFiles((prev) => prev.map((item, i) => (i === index ? file : item)));
		// A confirmation was about the files it counted, not these.
		setShortPages(null);
	}

	/**
	 * Uploads the attached pages.
	 * @param confirmed - The partner already chose to send a short pack.
	 */
	async function submit(confirmed = false) {
		if (!doc || !ready || busy) return;
		setBusy(true);
		if (perDirector !== null && !confirmed) {
			// Upstream locks the document once it is in, so a director left out
			// here cannot be added later. Asked, not refused: one PDF page can
			// hold several cards, and the count is only as good as the partner's
			// answer.
			const pages = await countPages(
				files.filter((file) => file instanceof File),
			);
			if (pages < perDirector) {
				setShortPages(pages);
				setBusy(false);
				return;
			}
		}
		setShortPages(null);
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
				 * The rule that changed. Every one of these documents used to have to be
				 * printed, self-attested and stamped before it was scanned, and a partner
				 * who has done that for years will do it again unless told otherwise —
				 * dropping the old instruction is not the same as saying the new one.
				 *
				 * Off only for the live photograph (`cameraOnly`), where signing was
				 * never a question and the line would read as noise.
				 */}
				{!config.cameraOnly ? (
					<Callout type="tip" className="my-0" label="No signing needed">
						<p className="text-sm">
							No need to sign or stamp these documents by hand — upload them
							exactly as they are. Once everything is verified, you'll be asked
							to e-sign all of them digitally, in one go.
						</p>
					</Callout>
				) : null}

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
						Download the sample, fill it, then upload the PDF
					</a>
				) : null}

				{perDirector !== null ? (
					<p className="text-sm font-medium text-foreground">
						Upload copies for all {perDirector} {directorNoun.many} in one go —
						anything missing from this upload can't be added later.
					</p>
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
								// Room for every director's card, front and back.
								maxFiles={
									perDirector !== null
										? Math.max(10, perDirector * 2)
										: undefined
								}
								// Names the combined PDF after the slot, so a reviewer opening
								// the upload can tell which side of the card they are looking
								// at instead of two files both called "combined-documents".
								combinedFileName={`${slugify(label)}.pdf`}
								// One legibility rule for the whole checklist — see
								// `KYC_BLUR_CHECK` — unless the document type names its own
								// mode, as a live photograph does. Spread last so `options`
								// cannot quietly opt a document out; its type excludes these
								// keys, and `config.blurCheck` is the sanctioned way in.
								// The checklist-wide defaults go first, so a document type
								// overrides them key by key.
								options={{
									...KYC_DOC_OPTIONS,
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

				{shortPages !== null && perDirector !== null ? (
					<div
						role="alert"
						className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
					>
						<p className="flex gap-2">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
							<span>
								You've attached {shortPages} page{shortPages === 1 ? "" : "s"}{" "}
								for {perDirector} {directorNoun.many}. This document can't be
								added to later, so make sure it covers every {directorNoun.one}.
							</span>
						</p>
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShortPages(null)}
							>
								Go back
							</Button>
							<Button
								variant="destructive"
								size="sm"
								disabled={busy}
								onClick={() => void submit(true)}
							>
								Upload anyway
							</Button>
						</div>
					</div>
				) : null}

				<DialogFooter className={shortPages !== null ? "hidden" : undefined}>
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
