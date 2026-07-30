import { describe, expect, it } from "vitest";
import { runPdfOp } from "./pdf-worker";
import { landscapeJpeg, portraitJpeg } from "./pdf.fixture";

// jsdom has no `Worker`, so this covers the dispatch table directly. It is
// what catches an op being renamed on one side of the message boundary only.
describe("runPdfOp", () => {
	it("routes imagesToPdf and pageCount", async () => {
		const bytes = (await runPdfOp({
			op: "imagesToPdf",
			images: [
				{ bytes: portraitJpeg(), type: "image/jpeg" },
				{ bytes: landscapeJpeg(), type: "image/jpeg" },
			],
		})) as Uint8Array;

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(await runPdfOp({ op: "pageCount", bytes })).toBe(2);
	});

	it("routes merge", async () => {
		const single = (await runPdfOp({
			op: "imagesToPdf",
			images: [{ bytes: portraitJpeg(), type: "image/jpeg" }],
		})) as Uint8Array;

		const merged = (await runPdfOp({
			op: "merge",
			documents: [single, single],
		})) as Uint8Array;

		expect(await runPdfOp({ op: "pageCount", bytes: merged })).toBe(2);
	});

	it("routes rebuildFromRaster", async () => {
		const bytes = (await runPdfOp({
			op: "rebuildFromRaster",
			pages: [{ jpeg: portraitJpeg(), widthPt: 595, heightPt: 842 }],
		})) as Uint8Array;

		expect(await runPdfOp({ op: "pageCount", bytes })).toBe(1);
	});

	it("rejects a document that is not a PDF", async () => {
		await expect(
			runPdfOp({ op: "pageCount", bytes: portraitJpeg() }),
		).rejects.toThrow();
	});
});
