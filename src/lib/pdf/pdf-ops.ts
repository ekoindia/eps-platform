/**
 * Structural PDF operations, built on `pdf-lib`.
 *
 * Deliberately pure: no DOM, no canvas, no worker plumbing — just bytes in,
 * bytes out. That is what lets `pdf-worker.ts` run these off the main thread
 * and what lets `pdf-ops.test.ts` exercise them under jsdom, where there is
 * no canvas context.
 *
 * Raster work (compressing, extracting images) is not here: it needs a PDF
 * renderer, which lives in `pdf-render.ts` on top of `pdfjs-dist`.
 */

import { PDFDocument, type PDFImage } from "pdf-lib";
import { EncryptedPdfError } from "./pdf-errors";

/** A4 in PostScript points (72 per inch), the default page for new documents. */
export const A4_POINTS = { width: 595.28, height: 841.89 } as const;

/** Image bytes plus the MIME type that says how to embed them. */
export interface PdfImageInput {
	/** Raw encoded image bytes — JPEG or PNG only. */
	bytes: Uint8Array;
	/** MIME type, `image/jpeg` or `image/png`. */
	type: string;
}

/** How each image should be laid out on its page. */
export interface ImagesToPdfOptions {
	/**
	 * `"a4"` (default) puts every image on an A4 page, rotated to landscape
	 * when the image is wider than it is tall, scaled to fit. `"image"` makes
	 * the page exactly the image's pixel size in points — only sensible for
	 * images that were authored at document scale, since a 4032×3024 phone
	 * photo becomes a 56×42 inch page.
	 */
	pageSize?: "a4" | "image";
	/** Blank margin around the image, in points. Ignored for `"image"`. */
	margin?: number;
}

/** A page of a compressed document: one JPEG at the original page geometry. */
export interface RasterPage {
	/** JPEG bytes covering the whole page. */
	jpeg: Uint8Array;
	/** Page width in points, as it was in the source PDF. */
	widthPt: number;
	/** Page height in points, as it was in the source PDF. */
	heightPt: number;
}

/**
 * Loads a document, turning pdf-lib's encryption failure into our own error.
 *
 * We do not pass `ignoreEncryption`: it lets an encrypted file load into a
 * half-readable state where page counts look right but rewriting produces
 * garbage. Refusing up front gives the caller something it can act on.
 *
 * @param bytes - Raw PDF bytes.
 * @returns The parsed document.
 */
async function loadDocument(bytes: Uint8Array): Promise<PDFDocument> {
	try {
		return await PDFDocument.load(bytes, { updateMetadata: false });
	} catch (error) {
		// Matched by message as well as by name because pdf-lib's error class
		// is not always preserved across its own re-throws.
		const message = error instanceof Error ? error.message : "";
		if (
			(error instanceof Error && error.name === "EncryptedPDFError") ||
			/encrypt/i.test(message)
		) {
			throw new EncryptedPdfError();
		}
		throw error;
	}
}

/**
 * Counts the pages in a PDF.
 *
 * @param bytes - Raw PDF bytes.
 * @returns Number of pages.
 */
export async function getPageCount(bytes: Uint8Array): Promise<number> {
	const document = await loadDocument(bytes);
	return document.getPageCount();
}

/**
 * Concatenates PDFs into one, preserving each source page's size and rotation.
 *
 * @param documents - Raw bytes of each PDF, in the order they should appear.
 * @returns Bytes of the merged PDF.
 */
export async function mergePdfs(documents: Uint8Array[]): Promise<Uint8Array> {
	if (documents.length === 0) throw new Error("No PDFs to merge.");

	const merged = await PDFDocument.create();
	for (const bytes of documents) {
		const source = await loadDocument(bytes);
		const pages = await merged.copyPages(source, source.getPageIndices());
		for (const page of pages) merged.addPage(page);
	}
	return merged.save({ useObjectStreams: true });
}

/**
 * Embeds an image by MIME type.
 *
 * @param document - Document to embed into.
 * @param image - Image bytes and type.
 * @returns The embedded image handle.
 */
async function embed(
	document: PDFDocument,
	image: PdfImageInput,
): Promise<PDFImage> {
	if (image.type === "image/png") return document.embedPng(image.bytes);
	if (image.type === "image/jpeg") return document.embedJpg(image.bytes);
	throw new Error(`Cannot embed ${image.type || "unknown"} in a PDF.`);
}

/**
 * Builds a PDF from images, one image per page.
 *
 * Callers should go through `pdfFromImages` in `pdf-client.ts`, which decodes
 * arbitrary image formats and applies EXIF orientation first. This function
 * only accepts what PDF itself can carry: JPEG and PNG.
 *
 * @param images - Images in page order.
 * @param options - Page sizing, see {@link ImagesToPdfOptions}.
 * @returns Bytes of the new PDF.
 */
export async function imagesToPdf(
	images: PdfImageInput[],
	options: ImagesToPdfOptions = {},
): Promise<Uint8Array> {
	if (images.length === 0) throw new Error("No images to convert.");
	const { pageSize = "a4", margin = 0 } = options;

	const document = await PDFDocument.create();
	for (const image of images) {
		const embedded = await embed(document, image);

		if (pageSize === "image") {
			const page = document.addPage([embedded.width, embedded.height]);
			page.drawImage(embedded, {
				x: 0,
				y: 0,
				width: embedded.width,
				height: embedded.height,
			});
			continue;
		}

		// Landscape images get a landscape page, so a wide scan is not shrunk
		// to a third of the sheet just to fit portrait A4.
		const landscape = embedded.width > embedded.height;
		const pageWidth = landscape ? A4_POINTS.height : A4_POINTS.width;
		const pageHeight = landscape ? A4_POINTS.width : A4_POINTS.height;
		const page = document.addPage([pageWidth, pageHeight]);

		const scale = Math.min(
			(pageWidth - margin * 2) / embedded.width,
			(pageHeight - margin * 2) / embedded.height,
		);
		const drawWidth = embedded.width * scale;
		const drawHeight = embedded.height * scale;
		page.drawImage(embedded, {
			x: (pageWidth - drawWidth) / 2,
			y: (pageHeight - drawHeight) / 2,
			width: drawWidth,
			height: drawHeight,
		});
	}

	return document.save({ useObjectStreams: true });
}

/**
 * Rebuilds a document from rasterised pages, keeping the original geometry.
 *
 * This is the second half of compression: `pdf-render.ts` turns each page into
 * a JPEG, this turns those JPEGs back into a PDF of the same page sizes so the
 * result prints and views identically.
 *
 * @param pages - One entry per page, in order.
 * @returns Bytes of the rebuilt PDF.
 */
export async function pdfFromRasterPages(
	pages: RasterPage[],
): Promise<Uint8Array> {
	if (pages.length === 0) throw new Error("No pages to rebuild.");

	const document = await PDFDocument.create();
	for (const { jpeg, widthPt, heightPt } of pages) {
		const image = await document.embedJpg(jpeg);
		const page = document.addPage([widthPt, heightPt]);
		page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
	}
	return document.save({ useObjectStreams: true });
}
