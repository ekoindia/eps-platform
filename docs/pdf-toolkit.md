## Browser-side PDF toolkit

`src/lib/pdf/` gives the frontend the PDF operations the upload flows need —
counting pages, merging, building a PDF from photos, extracting images and
compressing scans — **entirely in the browser**. Nothing is uploaded to do the
work, which matters for KYC documents: they never leave the device until the
user actually submits the form.

Import from `@/lib/pdf/pdf-client`. Nothing else in the folder is a public API.

```ts
import {
	pdfPageCount,
	mergePdfs,
	pdfFromImages,
	compressPdf,
	extractPdfImages,
	toPdfFile,
	verifyPdfPassword,
	unlockPdf,
} from "@/lib/pdf/pdf-client";

const pages = await pdfPageCount(file); // number
const merged = await mergePdfs([fileA, fileB]); // Blob
const built = await pdfFromImages([photo1, photo2]); // Blob
const { blob, compressed, originalSize, outputSize } = await compressPdf(file);
const images = await extractPdfImages(file); // Blob[] (PNG)
const verdict = await verifyPdfPassword(file, "hunter2"); // "ok" | "wrong"
const unlocked = await unlockPdf(file, "hunter2"); // Blob, no encryption

// The backend checks MIME type *and* extension, so name it properly.
onFileChange(toPdfFile(merged, "kyc-document.pdf"));
```

Every function takes a `File`, `Blob` or `Uint8Array` and returns a `Blob`
typed `application/pdf` (or a count / array of image blobs).

### What runs where

| Thread | Module | Work |
|---|---|---|
| Web Worker (ours) | `pdf-worker.ts` → `pdf-ops.ts` | All `pdf-lib` work: parsing, copying and writing PDF object graphs. Pure computation, hundreds of ms on a multi-megabyte scan. |
| Web Worker (pdf.js's own) | spawned by `pdfjs-dist` | PDF parsing and image decoding for the raster operations. |
| Main thread | `pdf-client.ts`, `pdf-render.ts` | Decoding source images, and the `page.render()` blit onto a canvas. Canvas work has to be here; it is cheap next to parsing. |

We deliberately do **not** nest workers or use `OffscreenCanvas` inside a
worker — pdf.js's standard configuration already gets the expensive half off
the main thread, without betting on browser support we would have to police.

### Loading cost

Nothing is paid until a PDF operation actually runs. Measured from a build of
the toolkit alone:

| Chunk | Raw | Gzipped | Fetched when |
|---|---|---|---|
| `pdf-worker` (our ops + `pdf-lib`) | 424 KB | 172 KB | first call to any function |
| `pdf-render` (pdf.js main) | 455 KB | 130 KB | first `compressPdf` / `extractPdfImages` |
| `pdf.worker.min.mjs` (pdf.js's own worker) | 1.26 MB | 365 KB | when pdf.js starts its worker |
| `qpdf.wasm` + its glue (`pdf-decrypt`) | 1.33 MB + 43 KB | — | first `unlockPdf`, i.e. only for an encrypted document |

So counting, merging and building PDFs cost one 172 KB chunk; only the raster
operations pull in the ~495 KB of pdf.js behind them.
- `pdf-render.ts` is **browser-only and dynamic-import-only**. Importing it
  statically from anything reachable by `AppServer.tsx` breaks the SSG
  pre-render, which runs in bare Node with no DOM. See `docs/ssg-hydration.md`.

`terminatePdfWorker()` exists if a long-lived page wants the worker gone; it is
optional, and the worker is cheap to keep.

### Compression policy

`compressPdf` re-renders each page as a JPEG and rebuilds the document at the
original page geometry. That is a good trade for a scan and a terrible one for
a real document, so it **refuses anything that is not image-only**:

- Any page carrying text or filled/stroked vector paths throws
  `NotCompressibleError`, which names the offending page. The original file is
  untouched.
- If the rebuilt PDF is not smaller than the input, the original bytes come
  back with `compressed: false`. It never hands back something bigger.
- A password-protected document throws `EncryptedPdfError` from any operation.

The rule lives in `pdf-page-content.ts` as a deny-list of pdf.js operators
(the four text-showing ops, the path-painting ops, shading fills). It is a
deny-list rather than an allow-list because real scanner output routinely
carries clip paths, transforms and graphics-state changes that an allow-list
version rejected. It is conservative best effort, not a proof.

### Encrypted documents

`pdf-lib` refuses **every** encrypted PDF — including the common
permissions-only ("owner password") lock that opens fine in any viewer — so
without a decrypt step a locked bank statement cannot be counted, merged or
compressed. `unlockPdf` removes the encryption with
[qpdf](https://qpdf.readthedocs.io) compiled to WebAssembly
(`@neslinesli93/qpdf-wasm`, pinned; the npm licence field says ISC but the
binary is qpdf, **Apache-2.0**).

qpdf rewrites the object graph, so text, vectors and page geometry all survive.
That is why it is here rather than the obvious alternative of rendering the
pages and rebuilding through `compressPdf`: password-protected documents in the
wild are text (statements, credit reports), and rasterising one destroys every
word in it and can multiply its size.

The order to call things in, and why:

1. `pdfPageCount` — the cheapest detector. It throws `EncryptedPdfError` for
   both kinds of lock, using the worker that is already running.
2. `verifyPdfPassword(file, "")` — a permissions-only lock answers `"ok"`, so
   the user is never asked for a password they do not have.
3. `verifyPdfPassword(file, candidate)` for each attempt, then `unlockPdf`.

Step 3 is not optional. **This qpdf build cannot say why it refused a
document**: it is closure-minified with a restricted module API, so `printErr`
is stripped and qpdf's "invalid password" goes to the console, leaving a wrong
password and a corrupt file sharing exit code 2. pdf.js knows the difference,
is already loaded wherever PDFs are blur-checked, and only parses the trailer.
Verify first, decrypt second.

`pdf-decrypt.ts` is **browser-only and dynamic-import-only**, exactly like
`pdf-render.ts`.

### Known ceilings

- **Images become JPEG.** `pdfFromImages` runs every source image through a
  canvas, which applies EXIF orientation (so phone photos land upright) and
  normalises WebP/HEIC/GIF/BMP. The cost is that PNGs become lossy and lose
  their alpha channel. Fine for documents; add a passthrough if screenshots
  ever need to stay crisp.
- **Page size.** New pages are A4 by default, in the orientation that suits
  each image. Sizing pages from pixels at 72 dpi (`pageSize: "image"`) turns a
  4032×3024 phone photo into a 56-inch page, so it is opt-in only.
- **Image extraction** reads pdf.js's decoded-object store, which is the only
  way to recover the original images rather than a re-render. Inline images,
  soft masks and alpha are ignored, and an image the store does not resolve is
  skipped rather than failing the batch.
- **JPEG 2000 scans** need pdf.js's WASM decoders, which are not currently
  copied into `public/`. If a real document fails to rasterise for this reason,
  copy `node_modules/pdfjs-dist/wasm/` to `public/wasm/pdfjs/` and pass
  `wasmUrl` in `pdf-render.ts`'s `getDocument` call.

### Vite

`vite.config.ts` sets `worker: { format: "es" }` — the worker is a module
worker and Vite's default `iife` output cannot carry imports.

`@neslinesli93/qpdf-wasm` ships as CommonJS, so it must go **through** Vite's
dependency pre-bundling — excluding it from `optimizeDeps` serves the raw UMD
file to the browser and dev dies on `does not provide an export named 'default'`,
while the production build (where Rollup converts it) stays green. The usual
reason to exclude an Emscripten package does not apply here: `pdf-decrypt.ts`
passes `locateFile` explicitly from its own `?url` import, so the glue never has
to find the binary relative to itself. `pdf-render.ts`
hands pdf.js its worker URL explicitly (`GlobalWorkerOptions.workerSrc`),
because pdf.js cannot find its own worker through a bundler that hashes
filenames.

### Multi-file upload in `FileUpload`

`src/components/FileUpload.tsx` can take several attachments and hand the form
one combined PDF. The caller's `onFileChange` signature does not change — it
still receives exactly one `File`.

```tsx
<FileUpload
	label="Address proof"
	accept="image/*,application/pdf"
	multiple
	maxFiles={6}
	maxBytes={10 * 1024 * 1024}
	file={doc}
	onFileChange={setDoc}
/>
```

| Prop | Default | Meaning |
|---|---|---|
| `multiple` | `false` | Opt in to batch mode |
| `maxFiles` | `10` | Ceiling on attachments |
| `compressThresholdBytes` | 1 MB | PDFs above this are compressed first |
| `options.maxLength` | 2000 px | Longer side of every image, editor and PDF alike |
| `combinedFileName` | `combined-documents.pdf` | Name of the result |

Behaviour:

- **Engages only when every type in `accept` is an image or a PDF**
  (`acceptsOnlyImagesAndPdfs`). A zone that also takes a spreadsheet keeps the
  single-file behaviour rather than silently dropping what it cannot fold in.
- **One attachment passes through as itself** — an image stays an image, a PDF
  stays a PDF. Combining starts at two. It is still size-capped: the editor
  and `pdfFromImages` share `DEFAULT_IMAGE_MAX_LENGTH`, so a lone image is
  not left at a higher resolution than one folded into a pack.
- Images still go through the editor one at a time, so crop, aspect ratio, face
  checks and the **watermark** all still apply. Cancelling one image drops that
  image, not the batch.
- PDFs over `compressThresholdBytes` are compressed. A PDF that *cannot* be
  compressed — the text/vector case — is attached untouched and **silently**;
  only a PDF we cannot read at all (encrypted, corrupt) reports and is skipped.
- Attachments accumulate: pick again, capture from the camera, drag more in.
  Each row can be removed or reordered, and page order follows the list.
- A row's thumbnail and name are one button that opens that attachment in the
  hosted viewer (`showFile`, via an object URL revoked when it closes) — the
  same viewer the combined PDF's **View** opens. Checking what was captured
  should not mean removing the row and taking it again.
- Each attachment's PDF form is cached by row id, so reordering re-merges cached
  bytes instead of re-editing and re-compressing the batch.
- If the combined document busts `maxBytes`, it gets one compression pass before
  the size check refuses it — ten 800 KB scans are each under the per-file
  threshold and still merge into 8 MB.

Caveat worth knowing: because the `accept` gate does not require
`application/pdf`, an images-only field with `multiple` will still emit a PDF
once two files are attached. That was a deliberate choice; if the endpoint only
takes images, either leave `multiple` off or add `application/pdf` to `accept`.

### Tests

`npx vitest run src/lib/pdf`. jsdom has no `Worker` and no canvas 2D context,
so the suite covers the layers that do not need them:

- `pdf-ops.test.ts` — page counts, merge ordering, page geometry. `pdf-lib` is
  pure JS and runs fine under jsdom.
- `pdf-worker.test.ts` — the message dispatch table, called directly.
- `pdf-page-content.test.ts` — the compression refusal rule, against
  hand-built operator lists. This is the check that fails if the policy
  regresses.
- `upload-combine.test.ts` — when compression runs (the threshold gate) and
  what happens when it refuses, with `pdf-client` mocked out.
- `FileUpload.test.tsx` — the `accept` gate that decides whether multi-file
  mode engages at all, and the whole unlock path (prompt, wrong password,
  cancel, fail-open) against a mocked `pdf-client`.
- `pdf-decrypt.integration.test.ts` — the one test that runs the **real** qpdf
  wasm, in the Node environment, against fixtures qpdf itself encrypts: right
  password, empty password on a permissions-only lock, wrong password, and a
  file it cannot parse. Stubs cannot prove the binary initialises or that the
  argv is the argv qpdf wants. `verifyPdfPassword` is not covered here — pdf.js's
  modern build will not load under Node — so its two answers are covered through
  the component instead.

The canvas and worker paths are exercised by hand at `/console/test` → **PDF
tools** (dev-only route), which drives every operation from picked files.
