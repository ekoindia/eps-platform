// @vitest-environment node
/**
 * Exercises the real qpdf wasm.
 *
 * The unit tests around this module can only prove that exit codes are routed
 * correctly; they cannot prove that the binary initialises, that the argv we
 * build is the argv qpdf wants, or that what comes back is a readable PDF.
 * This does, against fixtures qpdf itself encrypts.
 *
 * Node environment on purpose: jsdom has no way to fetch the wasm, and the
 * Emscripten glue reads it straight off disk under Node.
 */

import { createRequire } from "node:module";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EncryptedPdfError } from "./pdf-errors";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("@neslinesli93/qpdf-wasm/dist/qpdf.wasm");

// The module under test imports its binary through Vite's `?url`, which resolves
// to a browser path. Under Node the loader wants a real file.
vi.mock("@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url", () => ({
	default: wasmPath,
}));

const { decryptPdf } = await import("./pdf-decrypt");

/** Runs qpdf directly, to build the fixtures the tests decrypt. */
async function runQpdf(input: Uint8Array, args: string[]): Promise<Uint8Array> {
	const createModule = require("@neslinesli93/qpdf-wasm");
	const qpdf = await createModule({ locateFile: () => wasmPath });
	qpdf.FS.writeFile("/in.pdf", input);
	const exitCode = qpdf.callMain(args);
	if (exitCode !== 0) throw new Error(`qpdf exited ${exitCode}`);
	return qpdf.FS.readFile("/out.pdf");
}

let plain: Uint8Array;
let userLocked: Uint8Array;
let ownerLocked: Uint8Array;

beforeAll(async () => {
	const document_ = await PDFDocument.create();
	document_.addPage();
	plain = await document_.save();
	userLocked = await runQpdf(plain, [
		"/in.pdf",
		"--encrypt",
		"secret",
		"owner",
		"256",
		"--",
		"/out.pdf",
	]);
	// No user password: opens anywhere, but every pdf-lib path still refuses it.
	ownerLocked = await runQpdf(plain, [
		"/in.pdf",
		"--encrypt",
		"",
		"owner",
		"256",
		"--",
		"/out.pdf",
	]);
});

describe("decryptPdf", () => {
	it("builds fixtures pdf-lib refuses, which is what makes them worth unlocking", async () => {
		for (const encrypted of [userLocked, ownerLocked]) {
			await expect(PDFDocument.load(encrypted)).rejects.toThrow(/encrypted/i);
		}
	});

	it("unlocks a document with its password", async () => {
		const unlocked = await decryptPdf(userLocked, "secret");

		const document_ = await PDFDocument.load(unlocked, {
			updateMetadata: false,
		});
		expect(document_.getPageCount()).toBe(1);
	});

	it("unlocks a permissions-only lock with an empty password", async () => {
		const unlocked = await decryptPdf(ownerLocked, "");

		const document_ = await PDFDocument.load(unlocked, {
			updateMetadata: false,
		});
		expect(document_.getPageCount()).toBe(1);
	});

	it("rewrites the document rather than rasterising it", async () => {
		// The whole reason qpdf is here: the output stays a real PDF of the same
		// order of size, not a stack of page images several times larger.
		const unlocked = await decryptPdf(userLocked, "secret");

		expect(unlocked.byteLength).toBeLessThan(plain.byteLength * 3);
	});

	it("refuses a wrong password", async () => {
		await expect(decryptPdf(userLocked, "wrong")).rejects.toBeInstanceOf(
			EncryptedPdfError,
		);
	});

	it("refuses a document it cannot parse", async () => {
		// Same exit code as a wrong password — which is exactly why the caller
		// checks the password with pdf.js first.
		const notAPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x9]);

		await expect(decryptPdf(notAPdf, "")).rejects.toBeInstanceOf(
			EncryptedPdfError,
		);
	});
});

// `verifyPdfPassword` is deliberately not exercised here: it runs on pdf.js,
// whose modern build refuses to load under Node ("please use the legacy build")
// and wants a browser's DOMMatrix, Path2D and Math.sumPrecise. Its two answers
// are covered through the component in `FileUpload.test.tsx`.
