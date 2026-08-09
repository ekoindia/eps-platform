/**
 * The PDF toolkit's public API — the only module components should import.
 *
 * Everything runs in the browser; nothing is uploaded. Cost is paid lazily:
 * the worker (and with it `pdf-lib`) spawns on the first call, and `pdf.js` is
 * only fetched when an operation actually needs to rasterise a page.
 *
 * ```ts
 * const pages = await pdfPageCount(file);
 * const merged = await mergePdfs([fileA, fileB]);
 * const doc = await pdfFromImages([photo1, photo2]);
 * const { blob, compressed } = await compressPdf(file);
 * ```
 */

import { getFinalImageDimensions } from "@/lib/connect/image";
import { isBrowser } from "@/lib/ssr-safe";
import { EncryptedPdfError, NotCompressibleError } from "./pdf-errors";
import type { ImagesToPdfOptions, PdfImageInput } from "./pdf-ops";
import type {
	PdfWorkerReply,
	PdfWorkerRequest,
	PdfWorkerMessage,
} from "./pdf-worker";
import type { RasterizeOptions } from "./pdf-render";

/** Anything a caller might hold a PDF in. */
export type PdfSource = Blob | Uint8Array;

/** Outcome of a compression attempt. */
export interface PdfCompressionResult {
	/** The smaller document, or the original when compression did not help. */
	blob: Blob;
	/** False when the rebuilt file was not smaller and the original was kept. */
	compressed: boolean;
	/** Size of the input, in bytes. */
	originalSize: number;
	/** Size of `blob`, in bytes. */
	outputSize: number;
}

/** How images should be rendered before being placed in a PDF. */
export interface PdfFromImagesOptions extends ImagesToPdfOptions {
	/** Cap for the longer side of each image, in pixels. Default 2000. */
	maxLength?: number;
	/** JPEG quality for the re-encoded images, 0–1. Default 0.85. */
	quality?: number;
}

const PDF_MIME = "application/pdf";
const DEFAULT_IMAGE_MAX_LENGTH = 2000;
const DEFAULT_IMAGE_QUALITY = 0.85;

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<
	number,
	{ resolve: (value: never) => void; reject: (reason: Error) => void }
>();

/**
 * Rebuilds an error that crossed the worker boundary, where structured clone
 * flattens custom classes into plain objects.
 *
 * @param error - The serialised error from the worker.
 * @returns An error of the original class where we recognise it.
 */
function reviveError(error: {
	name: string;
	message: string;
	pageNumber?: number;
}): Error {
	if (error.name === "EncryptedPdfError") {
		return new EncryptedPdfError(error.message);
	}
	if (error.name === "NotCompressibleError") {
		return new NotCompressibleError(error.pageNumber ?? 1);
	}
	const revived = new Error(error.message);
	revived.name = error.name;
	return revived;
}

/**
 * Returns the shared worker, starting it on first use.
 *
 * @returns The PDF worker.
 */
function getWorker(): Worker {
	if (!isBrowser()) {
		throw new Error("The PDF toolkit only runs in the browser.");
	}
	if (worker) return worker;

	worker = new Worker(new URL("./pdf-worker.ts", import.meta.url), {
		type: "module",
	});
	worker.onmessage = (event: MessageEvent<PdfWorkerReply>) => {
		const reply = event.data;
		const entry = pending.get(reply.id);
		if (!entry) return;
		pending.delete(reply.id);
		if (reply.status === "ok") {
			entry.resolve(reply.result as never);
		} else {
			entry.reject(reviveError(reply.error));
		}
	};
	// A worker-level error (a failed chunk load, an OOM) never resolves the
	// in-flight requests, so fail them loudly rather than hanging the UI.
	worker.onerror = () => {
		const error = new Error("The PDF worker crashed.");
		for (const entry of pending.values()) entry.reject(error);
		pending.clear();
		// Drop the reference too, or every later call is posted into a dead
		// worker and hangs. The next call starts a fresh one.
		worker = null;
	};
	return worker;
}

/**
 * Sends one request to the worker.
 *
 * Inputs are cloned rather than transferred: transferring would detach the
 * caller's `Uint8Array`, which is a nasty surprise for a shared `File` buffer.
 * Results *are* transferred back, since nothing in the worker still wants them.
 *
 * @param request - The operation to run.
 * @returns Whatever that operation produces.
 */
function call<T>(request: PdfWorkerRequest): Promise<T> {
	const id = nextRequestId++;
	const message: PdfWorkerMessage = { id, request };
	return new Promise<T>((resolve, reject) => {
		pending.set(id, {
			resolve: resolve as (value: never) => void,
			reject,
		});
		try {
			getWorker().postMessage(message);
		} catch (error) {
			// Spawning can fail (SSR, blocked worker) and `postMessage` can throw
			// on data it cannot clone. Either way the reply never arrives, so drop
			// the entry rather than leaving a stale id in the map forever.
			pending.delete(id);
			reject(error as Error);
		}
	});
}

/**
 * Shuts the worker down and fails anything still in flight.
 *
 * Optional — the worker is cheap to keep around and reused across calls. Worth
 * calling when a long-lived page is done with PDFs for good.
 */
export function terminatePdfWorker(): void {
	worker?.terminate();
	worker = null;
	const error = new Error("The PDF worker was terminated.");
	for (const entry of pending.values()) entry.reject(error);
	pending.clear();
}

/**
 * Normalises a source to bytes.
 *
 * @param source - A `Blob`/`File` or raw bytes.
 * @returns The bytes.
 */
async function toBytes(source: PdfSource): Promise<Uint8Array> {
	if (source instanceof Uint8Array) return source;
	return new Uint8Array(await source.arrayBuffer());
}

/**
 * Wraps PDF bytes in a blob of the right MIME type.
 *
 * @param bytes - PDF bytes.
 * @returns A blob typed `application/pdf`.
 */
function toPdfBlob(bytes: Uint8Array): Blob {
	return new Blob([bytes as unknown as BlobPart], { type: PDF_MIME });
}

/**
 * Names a PDF blob so it can be uploaded.
 *
 * The backend checks MIME type *and* extension, so both have to line up.
 *
 * @param blob - A PDF blob, e.g. from `mergePdfs`.
 * @param fileName - Desired name; `.pdf` is appended when missing.
 * @returns A `File` the upload components accept.
 */
export function toPdfFile(blob: Blob, fileName: string): File {
	const name = /\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`;
	return new File([blob], name, { type: PDF_MIME });
}

/**
 * Counts the pages in a PDF.
 *
 * @param source - The PDF.
 * @returns Number of pages.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function pdfPageCount(source: PdfSource): Promise<number> {
	return call<number>({ op: "pageCount", bytes: await toBytes(source) });
}

/**
 * Concatenates PDFs, keeping each source page's size and rotation.
 *
 * @param sources - The PDFs, in the order they should appear.
 * @returns The merged PDF.
 * @throws {EncryptedPdfError} If any document is password-protected.
 */
export async function mergePdfs(sources: PdfSource[]): Promise<Blob> {
	const documents = await Promise.all(sources.map(toBytes));
	return toPdfBlob(await call<Uint8Array>({ op: "merge", documents }));
}

/**
 * Decodes an image and re-encodes it as a JPEG the PDF layer can embed.
 *
 * Everything goes through a canvas, including JPEGs, which is deliberate:
 * `drawImage` applies EXIF orientation, so a phone photo lands upright instead
 * of sideways, and odd formats (WebP, HEIC on Safari, GIF, BMP) all normalise
 * to the same two things PDF can carry.
 *
 * ponytail: this makes PNGs lossy and drops their alpha. Fine for documents;
 * add a passthrough branch for `image/png` if a caller ever needs screenshots
 * to stay crisp.
 *
 * @param image - The source image.
 * @param maxLength - Cap for the longer side, in pixels.
 * @param quality - JPEG quality, 0–1.
 * @returns JPEG bytes tagged for embedding.
 */
async function imageToJpeg(
	image: Blob,
	maxLength: number,
	quality: number,
): Promise<PdfImageInput> {
	const url = URL.createObjectURL(image);
	try {
		const element = await new Promise<HTMLImageElement>((resolve, reject) => {
			const loaded = new Image();
			loaded.onload = () => resolve(loaded);
			loaded.onerror = () => reject(new Error("Could not decode that image."));
			loaded.src = url;
		});

		const { finalWidth, finalHeight } = getFinalImageDimensions({
			width: element.naturalWidth,
			height: element.naturalHeight,
			maxLength,
		});

		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(finalWidth));
		canvas.height = Math.max(1, Math.round(finalHeight));
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas 2D context unavailable");
		// A transparent PNG would otherwise flatten onto black.
		context.fillStyle = "#ffffff";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(element, 0, 0, canvas.width, canvas.height);

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", quality),
		);
		if (!blob) throw new Error("Could not encode that image as JPEG.");
		canvas.width = 0;
		canvas.height = 0;

		return {
			bytes: new Uint8Array(await blob.arrayBuffer()),
			type: "image/jpeg",
		};
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Builds a PDF from images, one image per page.
 *
 * Pages are A4 by default, in the orientation that suits each image — see
 * {@link ImagesToPdfOptions}.
 *
 * @param images - Images in page order. Any format the browser can decode.
 * @param options - Resolution cap, JPEG quality and page sizing.
 * @returns The new PDF.
 */
export async function pdfFromImages(
	images: Blob[],
	options: PdfFromImagesOptions = {},
): Promise<Blob> {
	const {
		maxLength = DEFAULT_IMAGE_MAX_LENGTH,
		quality = DEFAULT_IMAGE_QUALITY,
		...pageOptions
	} = options;

	const encoded: PdfImageInput[] = [];
	for (const image of images) {
		encoded.push(await imageToJpeg(image, maxLength, quality));
	}

	return toPdfBlob(
		await call<Uint8Array>({
			op: "imagesToPdf",
			images: encoded,
			options: pageOptions,
		}),
	);
}

/**
 * Shrinks a scanned PDF by re-rendering each page as a JPEG.
 *
 * Refuses any document with text or vector drawings, which rasterising would
 * destroy. Loads `pdf.js` on first use.
 *
 * @param source - The PDF.
 * @param options - Resolution cap and JPEG quality for the rendered pages.
 * @returns The smaller document, or the original when it did not help.
 * @throws {NotCompressibleError} If a page carries text or drawings.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function compressPdf(
	source: PdfSource,
	options: RasterizeOptions = {},
): Promise<PdfCompressionResult> {
	const bytes = await toBytes(source);
	const { rasterizeForCompression } = await import("./pdf-render");
	const pages = await rasterizeForCompression(bytes, options);
	const rebuilt = await call<Uint8Array>({ op: "rebuildFromRaster", pages });

	// Never hand back something bigger than we were given — a already-optimised
	// scan can easily re-encode larger.
	if (rebuilt.byteLength >= bytes.byteLength) {
		return {
			blob: toPdfBlob(bytes),
			compressed: false,
			originalSize: bytes.byteLength,
			outputSize: bytes.byteLength,
		};
	}
	return {
		blob: toPdfBlob(rebuilt),
		compressed: true,
		originalSize: bytes.byteLength,
		outputSize: rebuilt.byteLength,
	};
}

/**
 * Blur score for a scanned PDF, 0–100 (higher = sharper). Loads `pdf.js` on
 * first use.
 *
 * `null` means "could not judge" — a born-digital document, a blank scan, or
 * a check that ran out of time — and callers must treat it as a pass. See
 * `blurScorePdfPages` in `pdf-render.ts` for the page limit and eligibility
 * rules.
 *
 * @param source - The PDF.
 * @param deadlineMs - Soft time budget for the whole check.
 * @returns Minimum judged-page score, or null when nothing could be judged.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function blurScorePdf(
	source: PdfSource,
	deadlineMs?: number,
): Promise<number | null> {
	const bytes = await toBytes(source);
	const { blurScorePdfPages } = await import("./pdf-render");
	return blurScorePdfPages(bytes, deadlineMs);
}

/**
 * Pulls the embedded images out of a PDF. Loads `pdf.js` on first use.
 *
 * @param source - The PDF.
 * @returns Every image found, in page order, as PNG blobs.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function extractPdfImages(source: PdfSource): Promise<Blob[]> {
	const bytes = await toBytes(source);
	const { extractImages } = await import("./pdf-render");
	return extractImages(bytes);
}
