/**
 * Removing a PDF's password, with qpdf compiled to WebAssembly.
 *
 * Browser-only, and reached exclusively through a dynamic import in
 * `pdf-client.ts`: the 1.3 MB wasm must never land in the main bundle, and it
 * must never be evaluated during pre-rendering.
 *
 * qpdf rewrites the object graph rather than re-rendering the pages, so text,
 * vectors and page geometry all survive. That is the whole reason it is here —
 * the rasterising path in `compressPdf` would flatten a bank statement into
 * images and lose every word in it.
 */

import createQpdfModule from "@neslinesli93/qpdf-wasm";
import wasmUrl from "@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url";
import { EncryptedPdfError } from "./pdf-errors";

/** Where the documents live inside qpdf's in-memory filesystem. */
const INPUT_PATH = "/in.pdf";
const OUTPUT_PATH = "/out.pdf";

/**
 * qpdf's exit codes: 0 clean, 2 error, 3 warnings only — 1 is deliberately
 * never used. Warnings are routine on documents that have been through a
 * scanner and a mail server, and the file qpdf writes is still sound, so 3
 * counts as success.
 *
 * @see https://qpdf.readthedocs.io/en/stable/cli.html
 */
const QPDF_CLEAN = 0;
const QPDF_WARNINGS = 3;

/**
 * The parts of the Emscripten filesystem this module uses.
 *
 * The package's own types cover `readFile` but not `writeFile` or `unlink`,
 * both of which its README documents and its build exports.
 */
interface QpdfFs {
	writeFile: (path: string, data: Uint8Array) => void;
	readFile: (path: string) => Uint8Array;
	unlink: (path: string) => void;
}

/**
 * Strips the encryption from a PDF, leaving the document itself untouched.
 *
 * A fresh module per call, deliberately: qpdf keeps global state across
 * `callMain`, so reusing an instance leaks one document's parse into the next.
 * Instantiating costs a few milliseconds against an already-compiled binary.
 *
 * Note that a wrong password and an unreadable file are the *same* exit code
 * here. This build is closure-minified with a restricted module API, so qpdf's
 * stderr ("invalid password") reaches the console and nothing else. Callers
 * that need to tell the two apart must check the password first — see
 * `verifyPdfPassword` in `pdf-render.ts`, which pdf.js answers precisely.
 *
 * @param bytes - The encrypted PDF.
 * @param password - The user password, or `""` for a permissions-only lock.
 * @returns The same document, unencrypted.
 * @throws {EncryptedPdfError} If qpdf could not open it with that password.
 */
export async function decryptPdf(
	bytes: Uint8Array,
	password: string,
): Promise<Uint8Array> {
	const qpdf = await createQpdfModule({ locateFile: () => wasmUrl });
	const fs = qpdf.FS as unknown as QpdfFs;

	try {
		fs.writeFile(INPUT_PATH, bytes);
		const exitCode = qpdf.callMain([
			`--password=${password}`,
			"--decrypt",
			INPUT_PATH,
			OUTPUT_PATH,
		]);
		if (exitCode !== QPDF_CLEAN && exitCode !== QPDF_WARNINGS) {
			throw new EncryptedPdfError("Could not unlock this PDF.");
		}
		return fs.readFile(OUTPUT_PATH);
	} finally {
		// Both files sit in the wasm heap, which outlives this function for as
		// long as the instance is referenced anywhere. A 10 MB scan held twice
		// over is worth the two lines.
		for (const path of [INPUT_PATH, OUTPUT_PATH]) {
			try {
				fs.unlink(path);
			} catch {
				// Never written — qpdf refused the document — so nothing to free.
			}
		}
	}
}
