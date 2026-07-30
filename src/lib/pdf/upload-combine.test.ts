import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncryptedPdfError, NotCompressibleError } from "./pdf-errors";
import {
	compressIfLarge,
	isImageMime,
	shouldCompress,
	PDF_MIME,
} from "./upload-combine";

const compressPdf = vi.fn();
// The real client spawns a Worker, which jsdom does not have. The decisions
// under test here are about *when* compression runs and what happens when it
// refuses — not about the bytes it produces.
vi.mock("./pdf-client", () => ({
	compressPdf: (...args: unknown[]) => compressPdf(...args),
	mergePdfs: vi.fn(),
	pdfFromImages: vi.fn(),
	toPdfFile: vi.fn(),
}));

const ONE_MB = 1024 * 1024;

/** A file of an exact byte length, without allocating that many bytes. */
function fileOf(name: string, size: number, type = PDF_MIME): File {
	const file = new File(["x"], name, { type });
	Object.defineProperty(file, "size", { value: size });
	return file;
}

beforeEach(() => {
	compressPdf.mockReset();
});

describe("isImageMime", () => {
	it("recognises images and nothing else", () => {
		expect(isImageMime("image/jpeg")).toBe(true);
		expect(isImageMime("IMAGE/PNG")).toBe(true);
		expect(isImageMime(PDF_MIME)).toBe(false);
		expect(isImageMime("")).toBe(false);
		expect(isImageMime(undefined)).toBe(false);
	});
});

describe("shouldCompress", () => {
	it("takes a PDF over the threshold", () => {
		expect(shouldCompress({ type: PDF_MIME, size: 2 * ONE_MB }, ONE_MB)).toBe(
			true,
		);
	});

	it("leaves a PDF at or under the threshold alone", () => {
		expect(shouldCompress({ type: PDF_MIME, size: ONE_MB }, ONE_MB)).toBe(
			false,
		);
	});

	it("never claims an image", () => {
		// Images are handled by the editor, which already re-encodes them.
		expect(
			shouldCompress({ type: "image/jpeg", size: 9 * ONE_MB }, ONE_MB),
		).toBe(false);
	});
});

describe("compressIfLarge", () => {
	it("does not load pdf.js for a small PDF", async () => {
		const small = fileOf("statement.pdf", 400 * 1024);

		expect(await compressIfLarge(small, ONE_MB)).toBe(small);
		expect(compressPdf).not.toHaveBeenCalled();
	});

	it("does not touch an image", async () => {
		const photo = fileOf("shop.jpg", 5 * ONE_MB, "image/jpeg");

		expect(await compressIfLarge(photo, ONE_MB)).toBe(photo);
		expect(compressPdf).not.toHaveBeenCalled();
	});

	it("returns the smaller file when compression helps", async () => {
		const big = fileOf("scan.pdf", 5 * ONE_MB);
		compressPdf.mockResolvedValue({
			blob: new Blob(["smaller"], { type: PDF_MIME }),
			compressed: true,
			originalSize: 5 * ONE_MB,
			outputSize: 1000,
		});

		const result = await compressIfLarge(big, ONE_MB);

		expect(result).not.toBe(big);
		expect(result.name).toBe("scan.pdf");
		expect(result.type).toBe(PDF_MIME);
	});

	it("keeps the original when compression did not shrink it", async () => {
		const big = fileOf("scan.pdf", 5 * ONE_MB);
		compressPdf.mockResolvedValue({
			blob: new Blob(["same"], { type: PDF_MIME }),
			compressed: false,
			originalSize: 5 * ONE_MB,
			outputSize: 5 * ONE_MB,
		});

		expect(await compressIfLarge(big, ONE_MB)).toBe(big);
	});

	it("swallows a refusal to compress a text PDF", async () => {
		// The user attached a document; our optimisation policy declining to
		// touch it is not their problem and must not surface as an error.
		const big = fileOf("contract.pdf", 5 * ONE_MB);
		compressPdf.mockRejectedValue(new NotCompressibleError(1));

		await expect(compressIfLarge(big, ONE_MB)).resolves.toBe(big);
	});

	it("still reports a PDF it cannot read at all", async () => {
		const locked = fileOf("locked.pdf", 5 * ONE_MB);
		compressPdf.mockRejectedValue(new EncryptedPdfError());

		await expect(compressIfLarge(locked, ONE_MB)).rejects.toBeInstanceOf(
			EncryptedPdfError,
		);
	});
});
