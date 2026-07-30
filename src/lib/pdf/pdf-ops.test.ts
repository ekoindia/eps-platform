import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
	A4_POINTS,
	getPageCount,
	imagesToPdf,
	mergePdfs,
	pdfFromRasterPages,
} from "./pdf-ops";
import { landscapeJpeg, portraitJpeg } from "./pdf.fixture";

/**
 * Reads back the page sizes of a produced document.
 *
 * @param bytes - PDF bytes.
 * @returns One `{ width, height }` per page, rounded to whole points.
 */
async function pageSizes(
	bytes: Uint8Array,
): Promise<{ width: number; height: number }[]> {
	const document = await PDFDocument.load(bytes);
	return document.getPages().map((page) => ({
		width: Math.round(page.getWidth()),
		height: Math.round(page.getHeight()),
	}));
}

describe("imagesToPdf", () => {
	it("makes one page per image", async () => {
		const bytes = await imagesToPdf([
			{ bytes: portraitJpeg(), type: "image/jpeg" },
			{ bytes: landscapeJpeg(), type: "image/jpeg" },
		]);

		expect(await getPageCount(bytes)).toBe(2);
	});

	it("orients each A4 page to suit its image", async () => {
		const bytes = await imagesToPdf([
			{ bytes: portraitJpeg(), type: "image/jpeg" },
			{ bytes: landscapeJpeg(), type: "image/jpeg" },
		]);

		// A 4032×3024 phone photo at 1 pixel per point would be a 56-inch page,
		// which is why images are fitted to A4 rather than sized from pixels.
		expect(await pageSizes(bytes)).toEqual([
			{
				width: Math.round(A4_POINTS.width),
				height: Math.round(A4_POINTS.height),
			},
			{
				width: Math.round(A4_POINTS.height),
				height: Math.round(A4_POINTS.width),
			},
		]);
	});

	it("sizes the page from the image when asked to", async () => {
		const bytes = await imagesToPdf(
			[{ bytes: landscapeJpeg(), type: "image/jpeg" }],
			{ pageSize: "image" },
		);

		expect(await pageSizes(bytes)).toEqual([{ width: 60, height: 40 }]);
	});

	it("refuses an image format PDF cannot carry", async () => {
		await expect(
			imagesToPdf([{ bytes: portraitJpeg(), type: "image/webp" }]),
		).rejects.toThrow(/image\/webp/);
	});

	it("refuses an empty list", async () => {
		await expect(imagesToPdf([])).rejects.toThrow(/No images/);
	});
});

describe("mergePdfs", () => {
	it("concatenates pages in order", async () => {
		const twoPages = await imagesToPdf([
			{ bytes: portraitJpeg(), type: "image/jpeg" },
			{ bytes: portraitJpeg(), type: "image/jpeg" },
		]);
		const onePage = await imagesToPdf([
			{ bytes: landscapeJpeg(), type: "image/jpeg" },
		]);

		const merged = await mergePdfs([twoPages, onePage]);

		expect(await getPageCount(merged)).toBe(3);
	});

	it("keeps each source page's size", async () => {
		const portrait = await imagesToPdf([
			{ bytes: portraitJpeg(), type: "image/jpeg" },
		]);
		const landscape = await imagesToPdf([
			{ bytes: landscapeJpeg(), type: "image/jpeg" },
		]);

		const merged = await mergePdfs([portrait, landscape]);

		expect(await pageSizes(merged)).toEqual([
			{
				width: Math.round(A4_POINTS.width),
				height: Math.round(A4_POINTS.height),
			},
			{
				width: Math.round(A4_POINTS.height),
				height: Math.round(A4_POINTS.width),
			},
		]);
	});

	it("refuses an empty list", async () => {
		await expect(mergePdfs([])).rejects.toThrow(/No PDFs/);
	});
});

describe("pdfFromRasterPages", () => {
	it("rebuilds at the original page geometry", async () => {
		// Compression must not resize the document: a rebuilt A4 page has to
		// come back A4 even though the JPEG behind it is 40×60 pixels.
		const bytes = await pdfFromRasterPages([
			{ jpeg: portraitJpeg(), widthPt: 595, heightPt: 842 },
			{ jpeg: landscapeJpeg(), widthPt: 842, heightPt: 595 },
		]);

		expect(await pageSizes(bytes)).toEqual([
			{ width: 595, height: 842 },
			{ width: 842, height: 595 },
		]);
	});
});
