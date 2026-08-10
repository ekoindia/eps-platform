/**
 * Raster half of the PDF toolkit, built on `pdfjs-dist`.
 *
 * BROWSER ONLY, DYNAMIC IMPORT ONLY. This module reaches for `document`,
 * `Worker` and `Blob` at call time and pulls ~130 KB (gzipped) of pdf.js into
 * the bundle, plus a ~365 KB worker asset once pdf.js starts up, so it must
 * never be imported from code that runs during SSR /
 * pre-render, and never statically from anything on a hot path. `pdf-client.ts`
 * is the only intended caller and reaches it through `await import()`.
 *
 * Threading: pdf.js parses and decodes in its own worker, which is where the
 * expensive part of this lives. The `page.render()` blit onto a canvas is main
 * thread — unavoidable without betting on nested workers plus OffscreenCanvas,
 * and cheap next to parsing.
 */

import {
	getDocument,
	GlobalWorkerOptions,
	ImageKind,
	OPS,
	type PDFDocumentProxy,
	type PDFPageProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
	BLUR_ANALYSIS_MAX_LENGTH,
	blurScore,
	toGrayscale,
} from "@/lib/connect/blur";
import { EncryptedPdfError, NotCompressibleError } from "./pdf-errors";
import { findNonImageOp, NON_IMAGE_OP_NAMES } from "./pdf-page-content";
import type { RasterPage } from "./pdf-ops";

// pdf.js will not find its worker through a bundler on its own — Vite hashes
// the filename. Handing it the emitted URL is the supported wiring.
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** pdf.js op codes for {@link NON_IMAGE_OP_NAMES}, resolved once. */
const NON_IMAGE_OPS: ReadonlySet<number> = new Set(
	NON_IMAGE_OP_NAMES.map(
		(name) => (OPS as Record<string, number>)[name],
	).filter((code): code is number => typeof code === "number"),
);

/** Knobs for turning pages into JPEGs. */
export interface RasterizeOptions {
	/**
	 * Cap for the longer side of each rendered page, in pixels. 1654 ≈ 200 dpi
	 * on A4, which stays readable and OCR-able while shrinking a 300+ dpi scan
	 * substantially.
	 */
	maxLength?: number;
	/** JPEG quality, 0–1. */
	quality?: number;
}

const DEFAULT_MAX_LENGTH = 1654;
const DEFAULT_QUALITY = 0.7;

/**
 * Opens a PDF, mapping pdf.js's password failure onto our own error.
 *
 * @param bytes - Raw PDF bytes.
 * @returns The open document. The caller must `destroy()` it.
 */
async function open(bytes: Uint8Array): Promise<PDFDocumentProxy> {
	try {
		// pdf.js takes ownership of the buffer, so hand it a copy — the caller
		// (and the bench) will still want the original bytes afterwards.
		return await getDocument({ data: bytes.slice() }).promise;
	} catch (error) {
		if (error instanceof Error && error.name === "PasswordException") {
			throw new EncryptedPdfError();
		}
		throw error;
	}
}

/**
 * Renders a page to a JPEG at a bounded resolution.
 *
 * @param page - The page to draw.
 * @param options - Resolution cap and JPEG quality.
 * @returns The JPEG bytes plus the page's size in points.
 */
async function rasterizePage(
	page: PDFPageProxy,
	options: RasterizeOptions,
): Promise<RasterPage> {
	const { maxLength = DEFAULT_MAX_LENGTH, quality = DEFAULT_QUALITY } = options;

	// `scale: 1` is 72 dpi; scale up to the resolution cap but never past the
	// point where we would be inventing detail the source does not have.
	const base = page.getViewport({ scale: 1 });
	const scale = Math.min(4, maxLength / Math.max(base.width, base.height));
	const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(viewport.width));
	canvas.height = Math.max(1, Math.round(viewport.height));
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D context unavailable");

	// Scans are opaque, but a page with transparent regions would otherwise
	// composite onto black once flattened into a JPEG.
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, canvas.width, canvas.height);

	await page.render({ canvas, viewport }).promise;

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", quality),
	);
	if (!blob) throw new Error("Could not encode page as JPEG.");

	// Free the backing store now rather than waiting on GC; a 10-page scan
	// otherwise holds ten full-size canvases at once on mobile Safari.
	canvas.width = 0;
	canvas.height = 0;

	return {
		jpeg: new Uint8Array(await blob.arrayBuffer()),
		widthPt: base.width,
		heightPt: base.height,
	};
}

/**
 * Rasterises every page of a PDF, refusing documents that are not scans.
 *
 * @param bytes - Raw PDF bytes.
 * @param options - Resolution cap and JPEG quality.
 * @returns One raster page per source page, in order.
 * @throws {NotCompressibleError} On the first page carrying text or vectors.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function rasterizeForCompression(
	bytes: Uint8Array,
	options: RasterizeOptions = {},
): Promise<RasterPage[]> {
	const document_ = await open(bytes);
	try {
		const pages: RasterPage[] = [];
		for (
			let pageNumber = 1;
			pageNumber <= document_.numPages;
			pageNumber += 1
		) {
			const page = await document_.getPage(pageNumber);
			try {
				const { fnArray } = await page.getOperatorList();
				if (findNonImageOp(fnArray, NON_IMAGE_OPS) !== -1) {
					throw new NotCompressibleError(pageNumber);
				}
				pages.push(await rasterizePage(page, options));
			} finally {
				// In a `finally` so a refused or failed page still releases its
				// decoded resources instead of holding them until destroy().
				page.cleanup();
			}
		}
		return pages;
	} finally {
		await document_.loadingTask.destroy();
	}
}

/** How many pages of a PDF the blur check inspects. A deliberate cost cap:
 * page 4 onwards of a blurry scan is almost always as blurry as page 1, and
 * rasterizing a 20-page statement would stall the pick for seconds. */
const BLUR_PAGE_LIMIT = 3;

/**
 * Renders one page at analysis resolution and scores its sharpness.
 *
 * @param page - The page to judge.
 * @returns The 0–100 score, or null when the page cannot be judged.
 */
async function pageBlurScore(page: PDFPageProxy): Promise<number | null> {
	const base = page.getViewport({ scale: 1 });
	const scale = Math.min(
		4,
		BLUR_ANALYSIS_MAX_LENGTH / Math.max(base.width, base.height),
	);
	const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(viewport.width));
	canvas.height = Math.max(1, Math.round(viewport.height));
	try {
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) return null;
		context.fillStyle = "#ffffff";
		context.fillRect(0, 0, canvas.width, canvas.height);
		await page.render({ canvas, viewport }).promise;
		const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
		return blurScore(
			toGrayscale(data, canvas.width, canvas.height),
			canvas.width,
			canvas.height,
		);
	} finally {
		canvas.width = 0;
		canvas.height = 0;
	}
}

/**
 * Blur score for a scanned PDF: the sharpness of its blurriest judged page.
 *
 * Only pure image scans are judged. Any text or vector op on an inspected
 * page means the document is born-digital — sharp by construction — and the
 * answer is `null` (cannot judge, fail open). This reuses the same
 * conservative eligibility test as compression, so a scan with an OCR text
 * overlay is *skipped*, not scored; that trades missed detections for never
 * misjudging a digital document.
 *
 * Inspects at most {@link BLUR_PAGE_LIMIT} pages, and stops early past the
 * deadline with whatever it has — rasterization is the expensive part, and a
 * blur check must never noticeably delay an upload.
 *
 * @param bytes - Raw PDF bytes.
 * @param deadlineMs - Soft time budget for the whole check.
 * @returns Minimum page score 0–100, or null when nothing could be judged.
 * @throws {EncryptedPdfError} If the document is password-protected.
 */
export async function blurScorePdfPages(
	bytes: Uint8Array,
	deadlineMs = 4000,
): Promise<number | null> {
	const deadline = Date.now() + deadlineMs;
	const document_ = await open(bytes);
	try {
		const scores: number[] = [];
		const limit = Math.min(BLUR_PAGE_LIMIT, document_.numPages);
		for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
			if (Date.now() > deadline) break;
			const page = await document_.getPage(pageNumber);
			try {
				const { fnArray } = await page.getOperatorList();
				if (findNonImageOp(fnArray, NON_IMAGE_OPS) !== -1) return null;
				const score = await pageBlurScore(page);
				if (score !== null) scores.push(score);
			} finally {
				page.cleanup();
			}
		}
		// The worst page decides: review reads every page, and a statement whose
		// page 2 is unreadable gets rejected however crisp pages 1 and 3 are.
		return scores.length > 0 ? Math.min(...scores) : null;
	} finally {
		await document_.loadingTask.destroy();
	}
}

/**
 * Turns a decoded pdf.js image object into a PNG blob.
 *
 * pdf.js hands back either an `ImageBitmap` (when its worker could use an
 * OffscreenCanvas) or raw samples in one of three pixel layouts.
 *
 * @param image - The resolved entry from `page.objs`.
 * @returns A PNG blob, or null if the layout is one we do not decode.
 */
async function imageObjectToBlob(image: {
	width: number;
	height: number;
	kind?: number;
	bitmap?: ImageBitmap;
	data?: Uint8Array | Uint8ClampedArray;
}): Promise<Blob | null> {
	const canvas = document.createElement("canvas");
	canvas.width = image.width;
	canvas.height = image.height;
	try {
		return await drawToBlob(canvas, image);
	} finally {
		// In a `finally`: an unsupported pixel layout returns early, and a decode
		// can throw. Either way a full-resolution backing store must not survive.
		canvas.width = 0;
		canvas.height = 0;
	}
}

/**
 * Paints a decoded pdf.js image onto a canvas and encodes it.
 *
 * @param canvas - Canvas already sized to the image.
 * @param image - The resolved entry from `page.objs`.
 * @returns A PNG blob, or null if the layout is one we do not decode.
 */
async function drawToBlob(
	canvas: HTMLCanvasElement,
	image: {
		width: number;
		height: number;
		kind?: number;
		bitmap?: ImageBitmap;
		data?: Uint8Array | Uint8ClampedArray;
	},
): Promise<Blob | null> {
	const context = canvas.getContext("2d");
	if (!context) return null;

	if (image.bitmap) {
		context.drawImage(image.bitmap, 0, 0);
	} else if (image.data) {
		const rgba = new Uint8ClampedArray(image.width * image.height * 4);
		const source = image.data;
		if (image.kind === ImageKind.RGBA_32BPP) {
			rgba.set(source.subarray(0, rgba.length));
		} else if (image.kind === ImageKind.RGB_24BPP) {
			for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
				rgba[pixel * 4] = source[pixel * 3];
				rgba[pixel * 4 + 1] = source[pixel * 3 + 1];
				rgba[pixel * 4 + 2] = source[pixel * 3 + 2];
				rgba[pixel * 4 + 3] = 255;
			}
		} else if (image.kind === ImageKind.GRAYSCALE_1BPP) {
			// One bit per pixel, rows padded to whole bytes.
			const bytesPerRow = (image.width + 7) >> 3;
			for (let y = 0; y < image.height; y += 1) {
				for (let x = 0; x < image.width; x += 1) {
					const bit = (source[y * bytesPerRow + (x >> 3)] >> (7 - (x & 7))) & 1;
					const value = bit ? 255 : 0;
					const offset = (y * image.width + x) * 4;
					rgba[offset] = value;
					rgba[offset + 1] = value;
					rgba[offset + 2] = value;
					rgba[offset + 3] = 255;
				}
			}
		} else {
			return null;
		}
		context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
	} else {
		return null;
	}

	return new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
}

/** Longest side, in pixels, of the throwaway canvas used to force decoding. */
const DECODE_TRIGGER_PX = 32;

/**
 * Makes pdf.js decode a page's images into `page.objs`.
 *
 * `getOperatorList()` names the images but does not populate the object store
 * — pdf.js only asks its worker for the pixels when something actually renders
 * them. So we render the page once, onto a deliberately tiny canvas: the image
 * objects that arrive are full-resolution regardless of the canvas size, and a
 * 32-pixel target keeps the throwaway raster near-free.
 *
 * @param page - The page whose images are wanted.
 */
async function forceImageDecode(page: PDFPageProxy): Promise<void> {
	const base = page.getViewport({ scale: 1 });
	const scale = DECODE_TRIGGER_PX / Math.max(base.width, base.height);
	const viewport = page.getViewport({ scale });

	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(viewport.width));
	canvas.height = Math.max(1, Math.round(viewport.height));
	try {
		await page.render({ canvas, viewport }).promise;
	} finally {
		canvas.width = 0;
		canvas.height = 0;
	}
}

/**
 * Pulls the embedded images out of a PDF.
 *
 * ponytail: reads pdf.js's decoded-object store, which is the only way to get
 * the original images rather than a re-render of the page. The ceiling: inline
 * images, soft masks and alpha channels are ignored, and any image the store
 * does not resolve is skipped rather than failing the batch. If this proves
 * unreliable on real documents, `rasterizeForCompression` already produces a
 * page-per-image fallback.
 *
 * @param bytes - Raw PDF bytes.
 * @returns Every image found, in page order, as PNG blobs.
 */
export async function extractImages(bytes: Uint8Array): Promise<Blob[]> {
	const document_ = await open(bytes);
	try {
		const images: Blob[] = [];
		for (
			let pageNumber = 1;
			pageNumber <= document_.numPages;
			pageNumber += 1
		) {
			const page = await document_.getPage(pageNumber);
			const { fnArray, argsArray } = await page.getOperatorList();

			const names = new Set<string>();
			for (let index = 0; index < fnArray.length; index += 1) {
				if (fnArray[index] !== OPS.paintImageXObject) continue;
				const name = argsArray[index]?.[0];
				// The same image painted twice on a page is still one image.
				if (typeof name === "string") names.add(name);
			}

			if (names.size > 0) {
				await forceImageDecode(page);

				for (const name of names) {
					// Page-local images live in `objs`; ones shared across pages in
					// `commonObjs`. Neither store tells you which, so try both.
					const store = page.objs.has(name)
						? page.objs
						: page.commonObjs.has(name)
							? page.commonObjs
							: null;
					if (!store) continue;

					const image = store.get(name);
					if (!image?.width || !image?.height) continue;
					const blob = await imageObjectToBlob(image);
					if (blob) images.push(blob);
				}
			}
			page.cleanup();
		}
		return images;
	} finally {
		await document_.loadingTask.destroy();
	}
}
