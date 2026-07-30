/**
 * Turning a batch of picked attachments into one PDF.
 *
 * Split out of `FileUpload` so the async pipeline can be reasoned about (and
 * partly tested) without a React tree: the component owns the list and the
 * dialogs, this owns the bytes.
 */

import { NotCompressibleError } from "./pdf-errors";
import {
	compressPdf,
	mergePdfs,
	pdfFromImages,
	toPdfFile,
	type PdfFromImagesOptions,
} from "./pdf-client";
import type { RasterizeOptions } from "./pdf-render";

/** MIME type of a PDF. */
export const PDF_MIME = "application/pdf";

/**
 * Size above which a picked PDF is worth compressing.
 *
 * Compression costs a ~500 KB pdf.js download and a rasterise pass per page,
 * so a small PDF is left alone: the work would cost more than it saves and it
 * is a lossy round-trip either way.
 */
export const DEFAULT_COMPRESS_THRESHOLD_BYTES = 1024 * 1024;

/**
 * Whether a MIME type names an image.
 *
 * @param type - A MIME type, possibly empty.
 * @returns True for `image/*`.
 */
export function isImageMime(type?: string): boolean {
	return Boolean(type && type.toLowerCase().startsWith("image/"));
}

/**
 * Whether a file should be put through PDF compression.
 *
 * @param file - The candidate.
 * @param thresholdBytes - Size above which compression is worth it.
 * @returns True for PDFs over the threshold.
 */
export function shouldCompress(
	file: { type: string; size: number },
	thresholdBytes: number,
): boolean {
	return file.type === PDF_MIME && file.size > thresholdBytes;
}

/**
 * Compresses a PDF if it is big enough to be worth it.
 *
 * A PDF that cannot be compressed without destroying it — one with real text
 * or vector drawings — comes back untouched and **silently**: the user asked
 * to attach a document, not to be told about our optimisation policy. Every
 * other failure (encrypted, corrupt) is the caller's to report.
 *
 * @param file - The picked file.
 * @param thresholdBytes - Size above which compression is attempted.
 * @param options - Resolution cap and JPEG quality for the rendered pages.
 * @returns The smaller file, or the original.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function compressIfLarge(
	file: File,
	thresholdBytes: number,
	options?: RasterizeOptions,
): Promise<File> {
	if (!shouldCompress(file, thresholdBytes)) return file;

	try {
		const result = await compressPdf(file, options);
		if (!result.compressed) return file;
		return new File([result.blob], file.name, { type: PDF_MIME });
	} catch (error) {
		if (error instanceof NotCompressibleError) return file;
		throw error;
	}
}

/**
 * Renders one attachment as a self-contained PDF.
 *
 * @param file - An image or a PDF.
 * @param options - Image sizing/quality, used only for images.
 * @returns PDF bytes for that one attachment.
 */
export async function fileToPdfBytes(
	file: File,
	options?: PdfFromImagesOptions,
): Promise<Uint8Array> {
	if (file.type === PDF_MIME) {
		return new Uint8Array(await file.arrayBuffer());
	}
	const built = await pdfFromImages([file], options);
	return new Uint8Array(await built.arrayBuffer());
}

/**
 * Concatenates already-prepared per-attachment PDFs into the file to submit.
 *
 * @param parts - Per-attachment PDF bytes, in the order they should appear.
 * @param fileName - Name for the result; `.pdf` is appended when missing.
 * @returns The combined PDF, named and typed for upload.
 */
export async function combinePdfParts(
	parts: Uint8Array[],
	fileName: string,
): Promise<File> {
	const merged = await mergePdfs(parts);
	return toPdfFile(merged, fileName);
}

/**
 * Last-resort shrink for a combined document that busts the size ceiling.
 *
 * The per-file threshold cannot see this coming: ten 800 KB scans are each
 * under it and still merge into 8 MB. Refusing outright would be worse than
 * one lossy pass, so try that before giving up — and if the merged document
 * turns out to hold text, leave it alone and let the caller's size check
 * refuse it with a message the user can act on.
 *
 * @param combined - The merged document.
 * @param maxBytes - Ceiling it has to fit under, if there is one.
 * @param options - Resolution cap and JPEG quality.
 * @returns A smaller file, or the original when it cannot help.
 */
export async function shrinkToFit(
	combined: File,
	maxBytes: number | undefined,
	options?: RasterizeOptions,
): Promise<File> {
	if (!maxBytes || combined.size <= maxBytes) return combined;
	// Threshold is 0: we already know it is too big, so size is not the question.
	return compressIfLarge(combined, 0, options);
}
