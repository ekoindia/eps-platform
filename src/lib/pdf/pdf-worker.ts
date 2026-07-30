/**
 * Web Worker entry for the PDF toolkit.
 *
 * Everything here is `pdf-lib` work: parsing, copying and writing PDF object
 * graphs, which is pure computation and easily hundreds of milliseconds on a
 * multi-megabyte scan. Running it on the main thread janks the whole console,
 * so it runs here instead.
 *
 * `pdf-lib` is imported statically: the worker itself is only spawned on the
 * first PDF call (see `pdf-client.ts`), so the library is already lazy with
 * respect to the app, and a static import keeps the worker a single chunk.
 */

import {
	getPageCount,
	imagesToPdf,
	mergePdfs,
	pdfFromRasterPages,
	type ImagesToPdfOptions,
	type PdfImageInput,
	type RasterPage,
} from "./pdf-ops";

/** Every operation the worker knows how to run. */
export type PdfWorkerRequest =
	| { op: "pageCount"; bytes: Uint8Array }
	| { op: "merge"; documents: Uint8Array[] }
	| {
			op: "imagesToPdf";
			images: PdfImageInput[];
			options?: ImagesToPdfOptions;
	  }
	| { op: "rebuildFromRaster"; pages: RasterPage[] };

/** A request tagged with the id the client uses to match up the reply. */
export interface PdfWorkerMessage {
	id: number;
	request: PdfWorkerRequest;
}

/**
 * A reply, carrying either a result or a structured-clone-safe error.
 *
 * The discriminant is a string rather than a boolean `ok` because the project
 * compiles with `strict: false`, and without `strictNullChecks` TypeScript
 * does not narrow unions on boolean literals.
 */
export type PdfWorkerReply =
	| { id: number; status: "ok"; result: number | Uint8Array }
	| {
			id: number;
			status: "error";
			error: { name: string; message: string; pageNumber?: number };
	  };

/**
 * Runs one operation. Exported so tests can exercise the dispatch table
 * without a real `Worker`, which jsdom does not provide.
 *
 * @param request - The operation and its arguments.
 * @returns The page count, or the bytes of the produced PDF.
 */
export async function runPdfOp(
	request: PdfWorkerRequest,
): Promise<number | Uint8Array> {
	switch (request.op) {
		case "pageCount":
			return getPageCount(request.bytes);
		case "merge":
			return mergePdfs(request.documents);
		case "imagesToPdf":
			return imagesToPdf(request.images, request.options);
		case "rebuildFromRaster":
			return pdfFromRasterPages(request.pages);
	}
}

/**
 * Serialises an error for `postMessage`, which cannot clone Error subclasses
 * with extra fields intact.
 *
 * @param error - Whatever was thrown.
 * @returns Name, message and, for `NotCompressibleError`, the page number.
 */
function toTransferableError(error: unknown): {
	name: string;
	message: string;
	pageNumber?: number;
} {
	if (error instanceof Error) {
		const pageNumber = (error as { pageNumber?: number }).pageNumber;
		return { name: error.name, message: error.message, pageNumber };
	}
	return { name: "Error", message: String(error) };
}

/** The slice of `DedicatedWorkerGlobalScope` this file uses. Hand-written
 * because the project's tsconfig loads the DOM lib, not the WebWorker one, and
 * pulling in `/// <reference lib="webworker" />` collides with it. */
interface PdfWorkerScope {
	onmessage: ((event: MessageEvent<PdfWorkerMessage>) => void) | null;
	postMessage: (message: PdfWorkerReply, transfer?: Transferable[]) => void;
}

// Only wire the listener in a real worker. Importing this module from a test
// under jsdom must not attach a handler to `window`, where unrelated `message`
// events (postMessage, dev-server HMR) would reach it. A worker scope is the
// one place with a `self` but no `window`.
const workerScope: PdfWorkerScope | null =
	typeof window === "undefined" && typeof self !== "undefined"
		? (self as unknown as PdfWorkerScope)
		: null;

if (workerScope) {
	workerScope.onmessage = async (event: MessageEvent<PdfWorkerMessage>) => {
		const { id, request } = event.data;
		try {
			const result = await runPdfOp(request);
			const reply: PdfWorkerReply = { id, status: "ok", result };
			// Hand the buffer over rather than copying it — these are megabytes.
			workerScope.postMessage(
				reply,
				result instanceof Uint8Array ? [result.buffer as ArrayBuffer] : [],
			);
		} catch (error) {
			workerScope.postMessage({
				id,
				status: "error",
				error: toTransferableError(error),
			});
		}
	};
}
