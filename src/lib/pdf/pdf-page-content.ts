/**
 * The rule that decides whether a PDF page may be compressed.
 *
 * Compression works by rasterising a page to a JPEG, which is fine for a scan
 * and destructive for anything else: text stops being selectable or OCR-able
 * and vector art goes soft. So we look at what the page actually draws.
 *
 * Kept free of any `pdfjs-dist` import so it stays unit-testable — importing
 * pdf.js under jsdom is not something we want a test to depend on. The caller
 * (`pdf-render.ts`) maps these op names to pdf.js's numeric `OPS` codes.
 */

/**
 * Operators that mean a page draws something other than an image.
 *
 * This is a deny-list rather than an allow-list on purpose. Real scanner
 * output is not just "paint one image": it routinely carries clip paths,
 * graphics-state changes and coordinate transforms, all of which are harmless.
 * Allow-listing rejected those pages; naming the four text-showing operators
 * and the path-painting ones targets exactly the content we would destroy.
 *
 * Conservative best effort, not a proof — a page that draws vector art through
 * a mechanism not listed here would slip past.
 */
export const NON_IMAGE_OP_NAMES = [
	// Text.
	"showText",
	"showSpacedText",
	"nextLineShowText",
	"nextLineSetSpacingShowText",
	// Path painting. Constructing a path is fine (clipping uses one); filling
	// or stroking it is what puts vector ink on the page.
	"stroke",
	"closeStroke",
	"fill",
	"eoFill",
	"fillStroke",
	"eoFillStroke",
	"closeFillStroke",
	"closeEOFillStroke",
	"shadingFill",
] as const;

/**
 * Finds the first operator on a page that is not image or layout work.
 *
 * @param fnArray - The page's operator codes, from `getOperatorList()`.
 * @param nonImageOps - Codes corresponding to {@link NON_IMAGE_OP_NAMES}.
 * @returns Index of the offending operator, or `-1` if the page is image-only.
 */
export function findNonImageOp(
	fnArray: ArrayLike<number>,
	nonImageOps: ReadonlySet<number>,
): number {
	for (let index = 0; index < fnArray.length; index += 1) {
		if (nonImageOps.has(fnArray[index])) return index;
	}
	return -1;
}

/**
 * Whether a page can be safely rasterised.
 *
 * @param fnArray - The page's operator codes, from `getOperatorList()`.
 * @param nonImageOps - Codes corresponding to {@link NON_IMAGE_OP_NAMES}.
 * @returns True when the page draws only images.
 */
export function isPageImageOnly(
	fnArray: ArrayLike<number>,
	nonImageOps: ReadonlySet<number>,
): boolean {
	return findNonImageOp(fnArray, nonImageOps) === -1;
}
