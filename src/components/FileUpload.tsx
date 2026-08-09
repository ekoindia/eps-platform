import { useConnectDialogs } from "@/components/connect/DialogHost";
import type { ImageEditorOptions } from "@/components/connect/ImageEditorDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWatermarkText, type WatermarkSpec } from "@/hooks/use-watermark";
import {
	blurScoreFromImageFile,
	DEFAULT_BLUR_THRESHOLD,
	getBlurScore,
	lowestBlurScore,
	setBlurScore,
} from "@/lib/connect/blur";
import { blurScorePdf } from "@/lib/pdf/pdf-client";
import {
	combinePdfParts,
	compressIfLarge,
	DEFAULT_COMPRESS_THRESHOLD_BYTES,
	fileToPdfBytes,
	shrinkToFit,
} from "@/lib/pdf/upload-combine";
import { cn } from "@/lib/utils";
import {
	Camera,
	ChevronDown,
	ChevronUp,
	FileText,
	FolderOpen,
	ImageIcon,
	RefreshCw,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** What the picked image must satisfy before it is accepted. */
export interface FileUploadOptions extends ImageEditorOptions {
	/** Take the capture as-is, skipping the crop/confirm step. */
	disableImageConfirm?: boolean;
}

export interface FileUploadProps {
	/** Field label. */
	label?: string;
	/** The currently attached file. */
	file: File | null | undefined;
	/** Called with the new file, or null when discarded. */
	onFileChange: (file: File | null) => void;
	/** `accept` for the file input, e.g. `image/*,application/pdf`. */
	accept?: string;
	/**
	 * Per-file ceiling in bytes. Omitted, nothing is refused for its size.
	 *
	 * Mirror whatever the receiving endpoint enforces, never more: a higher
	 * number here does not make a larger file acceptable, it just spends the
	 * upload before the same rejection.
	 */
	maxBytes?: number;
	/** Camera as the only source: no picker, no drag and drop. */
	cameraOnly?: boolean;
	/**
	 * Provenance burnt into the bottom-left of a captured or edited image.
	 *
	 * `true` stamps the KYC defaults — who is signed in, the org, the position
	 * and IP, and the moment — which is what makes a capture evidence rather
	 * than just a photo. An object keeps those and overrides the keys it names;
	 * a string is stamped verbatim. See {@link useWatermarkText}.
	 */
	watermark?: WatermarkSpec;
	/** Editing requirements applied to images from every source. */
	options?: FileUploadOptions;
	/**
	 * Let the user attach several files, combined into a single PDF.
	 *
	 * Only takes effect when every type in `accept` is an image or a PDF —
	 * anything else and this falls back to the single-file behaviour, since
	 * there is no sane way to fold a spreadsheet into a PDF here. The caller
	 * still receives exactly one `File` through `onFileChange`.
	 *
	 * A lone attachment is passed through as itself: one image stays an image,
	 * one PDF stays a PDF. Combining starts at two.
	 */
	multiple?: boolean;
	/** Ceiling on how many attachments may be combined. Default 10. */
	maxFiles?: number;
	/**
	 * Size above which a picked PDF is compressed before being combined.
	 *
	 * Compression pulls in pdf.js and rasterises every page, so small PDFs are
	 * left alone. Images are always re-encoded — that part is cheap.
	 */
	compressThresholdBytes?: number;
	/** Name for the combined PDF. Default `combined-documents.pdf`. */
	combinedFileName?: string;
	required?: boolean;
	disabled?: boolean;
	className?: string;
}

/** One picked attachment, already edited or compressed, waiting to be combined. */
interface PendingItem {
	/** Stable list key, also the key into the per-item PDF cache. */
	id: string;
	/** The processed attachment: an edited image, or a compressed PDF. */
	file: File;
	/** Data URL thumbnail for images; null for PDFs. */
	thumbnail: string | null;
}

/**
 * Whether a MIME type names an image.
 * @param type - A MIME type, possibly empty.
 * @returns True for `image/*`.
 */
function isImageType(type?: string): boolean {
	return Boolean(type && type.toLowerCase().startsWith("image/"));
}

/**
 * Whether an `accept` string permits a MIME type.
 *
 * Handles the `image/*` wildcard, which Eloka's `accept.indexOf(type)` check
 * rejected — dragging a PNG onto a zone that accepts `image/*` was refused.
 * @param accept - The accept attribute; empty means everything.
 * @param type - The candidate MIME type.
 * @returns True when the type is allowed.
 */
export function acceptsType(accept: string, type: string): boolean {
	if (!accept) return true;
	if (!type) return false;
	return accept.split(",").some((entry) => {
		const rule = entry.trim().toLowerCase();
		if (!rule) return false;
		if (rule.endsWith("/*"))
			return type.toLowerCase().startsWith(rule.slice(0, -1));
		return rule === type.toLowerCase();
	});
}

/** Whether the zone can take an image at all. */
function acceptsImages(accept: string): boolean {
	return !accept || accept.split(",").some((rule) => isImageType(rule.trim()));
}

/** Whether the zone can take something that is not an image. */
function acceptsNonImages(accept: string): boolean {
	return !accept || accept.split(",").some((rule) => !isImageType(rule.trim()));
}

/**
 * Renders a byte count for a list row.
 * @param bytes - Size in bytes.
 * @returns A short human-readable size, e.g. `1.4 MB`.
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Extension rules we can still fold into a PDF, for `accept` lists that use them. */
const PDF_COMBINABLE_EXTENSIONS = /^\.(jpe?g|png|gif|webp|bmp|heic|heif|pdf)$/;

/**
 * Whether every accepted type is something that can go into a PDF.
 *
 * Gates multi-file mode: combining only makes sense for images and PDFs, so a
 * zone that also takes, say, a spreadsheet keeps the single-file behaviour
 * rather than silently dropping the one file it cannot fold in.
 * @param accept - The accept attribute; empty means everything is allowed,
 * which we treat as eligible since the caller has expressed no constraint.
 * @returns True when multi-file mode may engage.
 */
export function acceptsOnlyImagesAndPdfs(accept: string): boolean {
	if (!accept) return true;
	const rules = accept
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
	if (rules.length === 0) return true;
	return rules.every(
		(rule) =>
			isImageType(rule) ||
			rule === "application/pdf" ||
			PDF_COMBINABLE_EXTENSIONS.test(rule),
	);
}

/**
 * Ceiling on how long a PDF blur check may run. Rasterizing pages is the
 * expensive part; past this the scorer stops early and whatever it has
 * judged so far decides — or nothing does. Never a gate on the upload.
 */
const BLUR_PDF_DEADLINE_MS = 4000;

/**
 * How long a step must run before it is worth naming.
 *
 * Below this, a label would flash and vanish, which reads as a glitch rather
 * than as progress. Above it, silence reads as a hang.
 */
const SLOW_STEP_MS = 1000;

/**
 * Runs the configured blur check on a file the image editor never sees —
 * PDFs, and images on the `disableImageConfirm` paths. Images that go
 * through the editor are checked there instead, on the processed file.
 *
 * Fail-open by contract: a score of `null`, a decode failure or a timeout
 * all return `ok`, so the check can only ever degrade to today's behaviour.
 *
 * @param picked - The file as it will be attached.
 * @param options - The upload's option set, carrying `blurCheck`/`blurThreshold`.
 * @returns False only in `block` mode for a file that scored below threshold.
 */
async function checkBlurOrExplain(
	picked: File,
	options: FileUploadOptions,
): Promise<boolean> {
	const mode = options.blurCheck ?? "off";
	if (mode === "off") return true;

	let score: number | null = null;
	try {
		if (isImageType(picked.type)) {
			score = await blurScoreFromImageFile(picked);
		} else if (picked.type.toLowerCase() === "application/pdf") {
			score = await blurScorePdf(picked, BLUR_PDF_DEADLINE_MS);
		}
	} catch {
		// Cannot judge — encrypted, corrupt, undecodable. Never a reason to block.
	}
	if (score === null) return true;

	setBlurScore(picked, score);
	if (score >= (options.blurThreshold ?? DEFAULT_BLUR_THRESHOLD)) return true;
	if (mode === "block") {
		toast.error(
			`${picked.name} looks blurry or out of focus. Please upload a sharper scan.`,
		);
		return false;
	}
	if (mode === "warn") {
		toast.warning(
			`${picked.name} looks blurry or out of focus. Consider replacing it with a sharper scan.`,
		);
	}
	return true;
}

/**
 * File input with a camera, an image editor and a preview.
 *
 * An attachment is rarely usable as it leaves the phone: it is 4 MB, rotated, and shows the whole desk around the document.
 * So every image — picked, dropped or captured — goes through the editor
 * (`options` decide crop, ratio, size cap, face checks) and only the processed
 * result is handed to the caller.
 *
 * Requires a `ConnectDialogProvider` above it, which owns the three dialogs
 * this drives.
 *
 * `watermark` carries provenance into the pixels: pass `true` for the KYC
 * defaults (user, org, position, IP, timestamp) as Eloka's flag did, an object
 * to override individual fields, or a string to stamp exact text.
 * @param props - See {@link FileUploadProps}.
 * @example
 * <FileUpload
 *   label="Shop photo"
 *   accept="image/*"
 *   file={photo}
 *   onFileChange={setPhoto}
 *   options={{ aspectRatio: 1, maxLength: 1200 }}
 * />
 */
export function FileUpload({
	label,
	file,
	onFileChange,
	accept = "",
	maxBytes,
	cameraOnly = false,
	watermark,
	options = {},
	multiple = false,
	maxFiles = 10,
	compressThresholdBytes = DEFAULT_COMPRESS_THRESHOLD_BYTES,
	combinedFileName = "combined-documents.pdf",
	required = false,
	disabled = false,
	className,
}: FileUploadProps) {
	const { editImage, openCamera, showFile } = useConnectDialogs();
	// Resolved here rather than at capture time: the position prompt and the IP
	// call must already have settled when the editor draws, or the first capture
	// of a session is stamped with a blank location.
	const watermarkText = useWatermarkText(watermark);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [dragState, setDragState] = useState<"none" | "valid" | "invalid">(
		"none",
	);
	// What the component is doing right now, once it has been doing it long
	// enough to be worth saying. Null the rest of the time. See `withStatus`.
	const [status, setStatus] = useState<string | null>(null);

	// Previews of unedited files are object URLs; the editor's are data URLs.
	// Track and release the former, or a long form leaks every image the user
	// tried.
	const objectUrlRef = useRef<string | null>(null);
	useEffect(
		() => () => {
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		},
		[],
	);

	// Attachments waiting to be combined, in page order. Only used in multi mode.
	const [items, setItems] = useState<PendingItem[]>([]);
	const [progress, setProgress] = useState<{
		done: number;
		total: number;
	} | null>(null);
	// Each item's PDF form, built once and keyed by item id, so reordering or
	// removing one attachment re-merges cached bytes instead of re-editing and
	// re-compressing the whole batch.
	const pdfCacheRef = useRef(new Map<string, Uint8Array>());
	// Rebuilds are async; a later one must win even if an earlier one finishes
	// after it, or a removed attachment can reappear in the combined document.
	const rebuildTokenRef = useRef(0);
	const nextItemIdRef = useRef(0);
	// A mirror of `items` that is safe to read after an await. Adding files
	// spans several modal dialogs, and the `items` captured in that closure is
	// whatever it was when the user started — by the time they finish cropping,
	// a removal or another add may have moved on.
	const itemsRef = useRef<PendingItem[]>([]);
	// Serialises the batch operations, which the disabled buttons alone do not:
	// a drop lands on the zone whatever the buttons say.
	const addingRef = useRef(false);

	const imageAllowed = acceptsImages(accept);
	const nonImageAllowed = acceptsNonImages(accept);
	const multiEnabled = multiple && acceptsOnlyImagesAndPdfs(accept);
	const busy = progress !== null;
	const editorOptions = {
		...options,
		watermark: watermarkText || options.watermark,
	};
	// The editor already caps image size; carry the same cap into the PDF so a
	// combined document is not larger than the images it was built from.
	const imageToPdfOptions = { maxLength: options.maxLength };

	/** Replaces the preview, releasing the previous object URL if there was one. */
	function showPreview(url: string | null, isObjectUrl = false) {
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		objectUrlRef.current = isObjectUrl ? url : null;
		setPreview(url);
	}

	/** Clears the native input so re-picking the same file still fires `change`. */
	function resetInput() {
		if (inputRef.current) inputRef.current.value = "";
	}

	/**
	 * Runs a step, naming it in the UI once it has been running for a second.
	 *
	 * Compressing a 20-page scan or quality-checking a big photo are the two
	 * steps that can visibly stall a pick, and an unexplained stall reads as a
	 * broken button. Fast steps stay silent.
	 *
	 * ponytail: one label at a time — the steps this wraps are sequential, so
	 * nesting cannot arise. Give `status` a counter if that ever changes.
	 *
	 * @param label - What to show, e.g. `Checking quality…`.
	 * @param run - The step.
	 * @returns Whatever the step returns.
	 */
	async function withStatus<T>(
		label: string,
		run: () => Promise<T>,
	): Promise<T> {
		const timer = setTimeout(() => setStatus(label), SLOW_STEP_MS);
		try {
			return await run();
		} finally {
			clearTimeout(timer);
			setStatus(null);
		}
	}

	/**
	 * Hands a file to the caller and shows its preview, unless it is too large.
	 *
	 * @returns False when the file was refused for its size.
	 */
	function attach(picked: File, image: string | null, isObjectUrl = false) {
		// Every source funnels through here, which is why the size check lives here
		// and not in each caller — a caller that forgets it uploads unbounded.
		//
		// Late on purpose: images come back from the editor re-encoded and usually
		// far smaller, so checking at pick time would refuse a phone photo the
		// editor was about to shrink. What this catches is the path that skips the
		// editor — an oversized PDF. For images `options.maxLength` is the better
		// lever, since it fixes the file instead of refusing it.
		if (maxBytes && picked.size > maxBytes) {
			// Nothing took ownership of the URL, so release it here.
			if (isObjectUrl && image) URL.revokeObjectURL(image);
			// Or picking the same file again fires no `change` and looks like a hang.
			resetInput();
			toast.error(
				`${picked.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`,
			);
			return false;
		}
		showPreview(image, isObjectUrl);
		onFileChange(picked);
		return true;
	}

	/** Routes a file: images through the editor, anything else straight through. */
	async function handleFile(picked: File | undefined | null) {
		if (!picked || disabled) return;

		if (!isImageType(picked.type)) {
			// PDFs never reach the editor, so their blur check happens here.
			const ok = await withStatus("Checking quality…", () =>
				checkBlurOrExplain(picked, options),
			);
			if (!ok) {
				resetInput();
				return;
			}
			attach(picked, null);
			return;
		}

		const objectUrl = URL.createObjectURL(picked);

		if (options.disableImageConfirm) {
			// Skips the editor, so it also skips the editor's blur check.
			const ok = await withStatus("Checking quality…", () =>
				checkBlurOrExplain(picked, options),
			);
			if (!ok) {
				URL.revokeObjectURL(objectUrl);
				resetInput();
				return;
			}
			// Taken as-is, but still previewed — the URL now belongs to the preview.
			attach(picked, objectUrl, true);
			return;
		}

		try {
			const result = await editImage(objectUrl, {
				fileName: picked.name,
				...editorOptions,
			});
			if (result.accepted && result.file) {
				attach(result.file, result.image ?? null);
			} else {
				resetInput();
			}
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	/**
	 * Prepares one picked file for the batch: images through the editor, PDFs
	 * through compression.
	 *
	 * @param candidate - The file as picked.
	 * @returns The pending item, or null when it was cancelled or unusable.
	 */
	async function prepareItem(candidate: File): Promise<PendingItem | null> {
		if (!acceptsType(accept, candidate.type)) {
			toast.error(`${candidate.name} is not an accepted file type.`);
			return null;
		}

		if (isImageType(candidate.type)) {
			// ponytail: with the confirm step disabled there is no data URL to
			// show, so the row falls back to the file name. Keeping the object URL
			// instead would mean tracking a revoke per row for a thumbnail.
			if (options.disableImageConfirm) {
				// No editor for this image, so no editor blur check either.
				const ok = await withStatus("Checking quality…", () =>
					checkBlurOrExplain(candidate, options),
				);
				if (!ok) return null;
				return { id: nextItemId(), file: candidate, thumbnail: null };
			}
			const objectUrl = URL.createObjectURL(candidate);
			try {
				const result = await editImage(objectUrl, {
					fileName: candidate.name,
					...editorOptions,
				});
				// Cancelling one image drops that image, not the whole batch —
				// having to re-crop four accepted photos would be punishing.
				if (!result.accepted || !result.file) return null;
				return {
					id: nextItemId(),
					file: result.file,
					thumbnail: result.image ?? null,
				};
			} finally {
				URL.revokeObjectURL(objectUrl);
			}
		}

		try {
			const compressed = await withStatus("Compressing PDF…", () =>
				compressIfLarge(candidate, compressThresholdBytes),
			);
			// Checked after compression, so the verdict — and the telemetry score —
			// belong to the bytes that are actually uploaded.
			const ok = await withStatus("Checking quality…", () =>
				checkBlurOrExplain(compressed, options),
			);
			if (!ok) return null;
			return { id: nextItemId(), file: compressed, thumbnail: null };
		} catch (error) {
			// A PDF we cannot even read — encrypted or corrupt. Say so and skip it;
			// a document that merely resists compression never lands here.
			toast.error(
				error instanceof Error
					? error.message
					: `Could not read ${candidate.name}.`,
			);
			return null;
		}
	}

	/** Issues the next list key. */
	function nextItemId(): string {
		nextItemIdRef.current += 1;
		return `item-${nextItemIdRef.current}`;
	}

	/**
	 * Turns the pending list into the single file the caller submits.
	 *
	 * One attachment passes through as itself; two or more are combined into a
	 * PDF. If the combined document busts `maxBytes`, it gets one compression
	 * pass before the size check refuses it.
	 *
	 * @param next - The list to build from.
	 */
	async function rebuild(next: PendingItem[]) {
		const token = ++rebuildTokenRef.current;

		if (next.length === 0) {
			showPreview(null);
			onFileChange(null);
			return;
		}

		if (next.length === 1) {
			const [only] = next;
			if (!attach(only.file, only.thumbnail)) onFileChange(null);
			return;
		}

		setProgress({ done: 0, total: next.length });
		try {
			const parts: Uint8Array[] = [];
			for (const [index, item] of next.entries()) {
				setProgress({ done: index, total: next.length });
				let cached = pdfCacheRef.current.get(item.id);
				if (!cached) {
					cached = await fileToPdfBytes(item.file, imageToPdfOptions);
					pdfCacheRef.current.set(item.id, cached);
				}
				parts.push(cached);
			}
			if (token !== rebuildTokenRef.current) return;

			const combined = await withStatus("Combining pages…", async () => {
				const merged = await combinePdfParts(parts, combinedFileName);
				return shrinkToFit(merged, maxBytes);
			});
			if (token !== rebuildTokenRef.current) return;

			// The combined PDF is a new File, which loses the parts' scores. Carry
			// the worst one over: the pack is only as good as its worst page.
			const worst = lowestBlurScore(
				next.map((item) => getBlurScore(item.file)),
			);
			if (worst !== null) setBlurScore(combined, worst);

			if (!attach(combined, null)) onFileChange(null);
		} catch (error) {
			if (token !== rebuildTokenRef.current) return;
			toast.error(
				error instanceof Error
					? error.message
					: "Could not combine those files.",
			);
			onFileChange(null);
		} finally {
			if (token === rebuildTokenRef.current) setProgress(null);
		}
	}

	/**
	 * Publishes a new list: state, the post-await mirror, and the rebuild.
	 *
	 * @param next - The list that is now current.
	 */
	function commitItems(next: PendingItem[]) {
		itemsRef.current = next;
		setItems(next);
		void rebuild(next);
	}

	/** Adds picked or dropped files to the batch, respecting `maxFiles`. */
	async function addFiles(picked: File[]) {
		if (disabled || picked.length === 0) return;
		// Two batches interleaving would each finish against the list they
		// started from, and the later one would erase the earlier one's work.
		if (addingRef.current) return;

		// Trimmed before any editor opens: making the user crop five photos and
		// then telling them three were over the limit is the wrong order.
		const slots = maxFiles - itemsRef.current.length;
		if (slots <= 0) {
			toast.error(`You can attach at most ${maxFiles} files.`);
			resetInput();
			return;
		}
		const batch = picked.slice(0, slots);
		if (batch.length < picked.length) {
			toast.error(
				`Only the first ${slots} were added — the limit is ${maxFiles} files.`,
			);
		}

		const added: PendingItem[] = [];
		addingRef.current = true;
		setProgress({ done: 0, total: batch.length });
		try {
			for (const [index, candidate] of batch.entries()) {
				setProgress({ done: index, total: batch.length });
				const item = await prepareItem(candidate);
				if (item) added.push(item);
			}
		} finally {
			addingRef.current = false;
			setProgress(null);
			resetInput();
		}

		if (added.length === 0) return;
		// Re-read the list rather than trusting the closure: the user has been
		// cropping for a while and may have removed rows in between. Re-check the
		// ceiling for the same reason.
		const current = itemsRef.current;
		const room = Math.max(0, maxFiles - current.length);
		const keep = added.slice(0, room);
		if (keep.length < added.length) {
			toast.error(`You can attach at most ${maxFiles} files.`);
		}
		if (keep.length === 0) return;
		commitItems([...current, ...keep]);
	}

	/** Drops one attachment from the batch. */
	function removeItem(id: string) {
		pdfCacheRef.current.delete(id);
		commitItems(itemsRef.current.filter((item) => item.id !== id));
	}

	/** Moves one attachment up or down the page order. */
	function moveItem(id: string, delta: -1 | 1) {
		const current = itemsRef.current;
		const index = current.findIndex((item) => item.id === id);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= current.length) return;
		const next = [...current];
		[next[index], next[target]] = [next[target], next[index]];
		commitItems(next);
	}

	/** Empties the batch. */
	function clearItems() {
		pdfCacheRef.current.clear();
		itemsRef.current = [];
		setItems([]);
		showPreview(null);
		onFileChange(null);
		resetInput();
	}

	/** Opens the combined PDF in the viewer, releasing the URL when it closes. */
	async function viewCombined() {
		if (!file) return;
		const url = URL.createObjectURL(file);
		try {
			await showFile(url, { type: "pdf" });
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function captureFromCamera() {
		if (multiEnabled && addingRef.current) return;
		const result = await openCamera(editorOptions);
		if (!result.accepted || !result.file) return;

		// With the confirm step on, the editor has already judged the capture;
		// without it the file arrives unchecked.
		if (options.disableImageConfirm) {
			const ok = await withStatus("Checking quality…", () =>
				// Non-null by the guard above; narrowing does not survive the closure.
				checkBlurOrExplain(result.file as File, options),
			);
			if (!ok) return;
		}

		if (!multiEnabled) {
			attach(result.file, result.image ?? null);
			return;
		}
		// Checked after the dialog, not before: the camera can be open for a
		// while, and the list it closes onto is the one that matters.
		const current = itemsRef.current;
		if (current.length >= maxFiles) {
			toast.error(`You can attach at most ${maxFiles} files.`);
			return;
		}
		commitItems([
			...current,
			{
				id: nextItemId(),
				file: result.file,
				thumbnail: result.image ?? null,
			},
		]);
	}

	function onDragOver(event: React.DragEvent) {
		if (cameraOnly || disabled) return;
		event.preventDefault();
		const type = event.dataTransfer.items[0]?.type ?? "";
		setDragState(type && acceptsType(accept, type) ? "valid" : "invalid");
	}

	async function onDrop(event: React.DragEvent) {
		if (cameraOnly || disabled) return;
		event.preventDefault();
		const wasValid = dragState === "valid";
		setDragState("none");
		if (!wasValid) return;

		const dropped = Array.from(event.dataTransfer.files);
		if (dropped.length > 0) {
			if (multiEnabled) void addFiles(dropped);
			else void handleFile(dropped[0]);
			return;
		}

		// Dragged from another tab rather than the file system: the item is a URL,
		// and the bytes have to be fetched. Cross-origin hosts without CORS simply
		// refuse, which is why this is a fallback and not the main path.
		const item = event.dataTransfer.items[0];
		if (item?.kind !== "string") return;
		const url = await new Promise<string>((resolve) =>
			item.getAsString(resolve),
		);
		try {
			const blob = await fetch(url).then((response) => response.blob());
			if (!acceptsType(accept, blob.type)) return;
			const stamp = new Date().toLocaleString().replace(/[^0-9]+/g, "_");
			const name = `FileDrop_${stamp}.${blob.type.split("/")[1] || "jpg"}`;
			const fetched = new File([blob], name, { type: blob.type });
			if (multiEnabled) void addFiles([fetched]);
			else void handleFile(fetched);
		} catch {
			// Nothing to attach; the user can still pick the file.
		}
	}

	// The pick/camera controls, shared by the single and multi layouts. A plain
	// value rather than a helper function: a function called during render puts
	// its handlers in render scope as far as react-hooks/refs is concerned.
	const sourceButtons = (
		<>
			<input
				ref={inputRef}
				type="file"
				accept={accept || undefined}
				multiple={multiEnabled}
				disabled={disabled || busy}
				hidden
				onChange={(event) => {
					const picked = Array.from(event.target.files ?? []);
					if (multiEnabled) void addFiles(picked);
					else void handleFile(picked[0]);
				}}
			/>
			<div className="flex flex-wrap items-center justify-center gap-2">
				{cameraOnly ? null : (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || busy}
						onClick={() => inputRef.current?.click()}
						className="gap-2"
					>
						{nonImageAllowed ? (
							<FolderOpen className="h-4 w-4" />
						) : (
							<ImageIcon className="h-4 w-4" />
						)}
						{multiEnabled && items.length > 0 ? "Add more" : null}
						{multiEnabled && items.length === 0
							? `Select ${nonImageAllowed ? "files" : "photos"}`
							: null}
						{multiEnabled
							? null
							: `Select ${nonImageAllowed ? "file" : "photo"}`}
					</Button>
				)}
				{imageAllowed ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || busy}
						onClick={() => void captureFromCamera()}
						className="gap-2"
					>
						<Camera className="h-4 w-4" />
						{cameraOnly ? "Open camera" : "Camera"}
					</Button>
				) : null}
			</div>
		</>
	);

	// A named step that has outlasted `SLOW_STEP_MS`. Rendered in every layout,
	// so the zone explains itself whether or not a file is already attached.
	const statusLine = status ? (
		<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<RefreshCw className="h-3 w-3 shrink-0 animate-spin" />
			{status}
		</p>
	) : null;

	// Sharpness, in development only: the numbers behind an accept or a warning,
	// so a threshold can be judged against real captures rather than guessed at.
	// The combined file carries the worst of its parts — see `lowestBlurScore`.
	const devScore = import.meta.env.DEV && file ? getBlurScore(file) : undefined;
	const devPartScores = import.meta.env.DEV
		? items.map((item) => getBlurScore(item.file))
		: [];
	const devScoreLine =
		import.meta.env.DEV && devScore !== undefined ? (
			<p className="select-none font-mono text-[10px] text-muted-foreground/70">
				blur score: {devScore}
				{devPartScores.length > 1
					? ` (pages: ${devPartScores.map((score) => score ?? "—").join(", ")})`
					: null}
			</p>
		) : null;

	/** One row of the pending batch. */
	function renderItemRow(item: PendingItem, index: number) {
		return (
			<li
				key={item.id}
				className="flex w-full items-center gap-2 rounded-md border bg-background p-2"
			>
				<span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">
					{index + 1}
				</span>
				{item.thumbnail ? (
					<img
						src={item.thumbnail}
						alt=""
						className="h-9 w-9 shrink-0 rounded-sm object-cover"
					/>
				) : (
					<FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
				)}
				<span
					className="min-w-0 flex-1 truncate text-xs"
					title={item.file.name}
				>
					{item.file.name}
				</span>
				<span className="shrink-0 text-[10px] text-muted-foreground">
					{formatBytes(item.file.size)}
				</span>
				<button
					type="button"
					aria-label={`Move ${item.file.name} up`}
					disabled={index === 0 || busy}
					onClick={() => moveItem(item.id, -1)}
					className="cursor-pointer rounded p-1 disabled:opacity-30"
				>
					<ChevronUp className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					aria-label={`Move ${item.file.name} down`}
					disabled={index === items.length - 1 || busy}
					onClick={() => moveItem(item.id, 1)}
					className="cursor-pointer rounded p-1 disabled:opacity-30"
				>
					<ChevronDown className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					aria-label={`Remove ${item.file.name}`}
					disabled={busy}
					onClick={() => removeItem(item.id)}
					className="cursor-pointer rounded-full bg-eko-navy p-1 text-white disabled:opacity-30"
				>
					<X className="h-3 w-3" />
				</button>
			</li>
		);
	}

	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			{label ? (
				<Label>
					{label}
					{required ? " *" : ""}
				</Label>
			) : null}
			<div
				onDragOver={onDragOver}
				onDragLeave={() => setDragState("none")}
				onDrop={(event) => void onDrop(event)}
				className={cn(
					"flex flex-col items-center gap-2 rounded-lg border-2 p-5 transition-colors",
					cameraOnly ? "border-solid" : "border-dashed",
					dragState === "valid" && "border-emerald-500 bg-emerald-500/10",
					dragState === "invalid" && "border-destructive bg-destructive/10",
					disabled && "pointer-events-none opacity-50",
				)}
			>
				{multiEnabled ? (
					<>
						{items.length > 0 ? (
							<ul className="flex w-full flex-col gap-1.5">
								{items.map(renderItemRow)}
							</ul>
						) : null}

						{items.length < maxFiles ? sourceButtons : null}

						{busy && progress ? (
							<p className="text-xs text-muted-foreground">
								Processing {Math.min(progress.done + 1, progress.total)} of{" "}
								{progress.total}…
							</p>
						) : null}

						{items.length === 0 && !busy && !cameraOnly ? (
							<p className="select-none text-xs text-muted-foreground">
								{dragState === "none"
									? "or drag and drop files here"
									: dragState === "valid"
										? "Drop your files here"
										: "File type not allowed"}
							</p>
						) : null}

						{file && items.length > 1 && !busy ? (
							<div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
								<span>Combined into one PDF · {formatBytes(file.size)}</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void viewCombined()}
								>
									View
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={clearItems}
								>
									Clear all
								</Button>
							</div>
						) : null}
					</>
				) : file ? (
					<div className="relative">
						{preview ? (
							<img
								src={preview}
								alt={label ?? "Attachment"}
								// Typed explicitly: a preview is an object or data URL, and the
								// viewer cannot sniff an extension off either. Only images are
								// ever previewed — everything else falls back to the file name.
								onClick={() => void showFile(preview, { type: "image" })}
								className="max-h-50 max-w-full cursor-pointer rounded-sm shadow-sm"
							/>
						) : (
							<p className="max-w-60 truncate text-xs" title={file.name}>
								{file.name}
							</p>
						)}
						<button
							type="button"
							aria-label="Discard file"
							onClick={() => {
								showPreview(null);
								onFileChange(null);
								resetInput();
							}}
							className="absolute -right-2.5 -top-2.5 cursor-pointer rounded-full bg-eko-navy p-1 text-white"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
				) : (
					<>
						{sourceButtons}
						{cameraOnly ? null : (
							<p className="select-none text-xs text-muted-foreground">
								{dragState === "none"
									? "or drag and drop the file here"
									: dragState === "valid"
										? "Drop your file here"
										: "File type not allowed"}
							</p>
						)}
					</>
				)}

				{/* Outside the layout branches, so a slow step or a score explains
				    itself whether or not a file is already attached. */}
				{statusLine}
				{devScoreLine}
			</div>
		</div>
	);
}
