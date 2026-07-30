/**
 * Error types shared by every layer of the PDF toolkit.
 *
 * They live in their own module because callers need to `instanceof` them
 * synchronously, while the layers that throw them (`pdf-render`, and the
 * worker) are only ever reached through a dynamic import.
 */

/** Thrown when a PDF is password-protected, so we cannot read or rewrite it. */
export class EncryptedPdfError extends Error {
	constructor(message = "This PDF is password-protected.") {
		super(message);
		this.name = "EncryptedPdfError";
	}
}

/**
 * Thrown when a PDF contains text or vector content, which compression would
 * flatten into images — losing selectable text, sharpness and any downstream
 * OCR. We refuse rather than silently degrade the document.
 */
export class NotCompressibleError extends Error {
	/** 1-based page that carries the non-image content. */
	readonly pageNumber: number;

	constructor(pageNumber: number) {
		super(
			`Page ${pageNumber} contains text or drawings, so this PDF cannot be compressed without destroying it. Only scanned (image-only) PDFs can be compressed.`,
		);
		this.name = "NotCompressibleError";
		this.pageNumber = pageNumber;
	}
}
