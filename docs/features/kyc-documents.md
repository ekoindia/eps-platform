# KYC document upload

Onboarding creates the account; KYC activates it. A user who has finished
`/signup` still has to send Eko a pack of identity and business documents —
scans, PDFs or a photo taken there and then. This feature puts that pack in the
console at `/console/documents` instead of over email.

**The session says whether that pack is still owed.** Upstream reports it as
`user_detail.account_state_id` — `48` while KYC is outstanding, `16` once the
account is live — and the backend turns it into the `kyc-pending` lifecycle
state (see
[`user-onboarding.md` § Lifecycle state](./user-onboarding.md#lifecycle-state-meviewstate)).
That is what makes the Next Steps card's "Finish your KYC" row read Pending.

It is a coarse signal, not a per-document one: it says upstream is still waiting
on this partner, not which file is missing. This page owns that detail. It can
also disagree — the state is `kyc-pending` until upstream flips the account
itself, which can lag a successful upload.

## The two upstream transactions

Both are connect-api interactions, reached only from the backend (they need the
FULL upstream access token, which never enters the browser).

| What | interaction `id` | endpoint | `interaction_type_id` |
| --- | --- | --- | --- |
| Fetch the required document list | 586 | `POST /transactions/do` | 539 |
| Upload one document | 587 | `POST /transactions/upload` (multipart) | 523 |

The two id columns are different numbering schemes that sit side by side in the
same payload, and they are not interchangeable. The `id` is what appears in the
`/transactions/wlc` list and gates the feature; the `interaction_type_id` is
what goes in the request body. `buildRoleTransactionList`
(`src/lib/connect/interactions.ts`) keys the list by `id` for exactly this
reason — every composite interaction reports `interaction_type_id: 0`.

### 586 — the document list

```json
{
  "response_status_id": 0,
  "data": {
    "user_code": "39300001",
    "document_list": [
      { "doc_type": "1", "name": "Aadhaar Card", "info": "Director's Aadhaar Card",
        "pages": "2", "is_required": 1, "status": 0, "status_desc": "", "error": "" }
    ]
  },
  "response_type_id": 1564,
  "message": "Success",
  "status": 0
}
```

The sample lives in `src/lib/connect/kyc.fixture.ts` and is shared by the unit
tests and the dev-only bench, so both look at the same bytes. Only the `status`
values differ from the capture — see [Status semantics](#status-semantics).

### 587 — the upload

`multipart/form-data`, with connect-api's own convention: **every field travels
URL-encoded inside a single `formdata` part**, and the files are sibling parts
named `file1`, `file2`, … It is not a general multipart form. The same transport
already backs support-ticket attachments, so both go through one
`uploadInteraction` in `packages/eps-backend/src/clients/connect.ts`.

```
formdata: client_ref_id=…&locale=en&user_id=…&interaction_type_id=523&intent_id=4&doc_type=1&pages=2
file1: <binary>
file2: <binary>
```

`intent_id` is a fixed `4` (`KYC_UPLOAD_INTENT` in `http/connect.ts`), set
backend-side and never accepted from the browser — same posture as `user_id`.
It does not vary per document or per page, so there is nothing for a caller to
choose.

**`4` is the document upload, not `3`.** The Eko-side PAN verification in
`clients/eko.ts` sends `intent_id: "3"` on this same 523 interaction, which
makes 3 a tempting guess — it is the wrong one, confirmed by the backend team.
The interaction is shared; the intent is not.

**Not to be confused with the Eko public API's upload convention.** That one also
wraps everything in a single part, but the part is named `form-data` (hyphenated)
and its value is a **JSON object**, not a URL-encoded string — see
`MULTIPART_JSON_FIELD` in `src/lib/data/api-specs-common.ts`, which the published
SDKs and the `/docs` samples are built on. Same shape, different name and encoding,
and a different host and auth scheme. `interaction_type_id` 523 appears in both
(the Eko-side PAN verification in `clients/eko.ts` uses it too), so it is plausible
connect-api follows the JSON change later — but confirm with Eko before touching
`uploadInteraction`, because every partner's KYC upload runs through it.

### "No Records Found" is an empty state, not an error

An account with nothing outstanding does **not** get a success envelope carrying
an empty `document_list`. It gets a *failed* envelope — non-zero `status` — with
`message: "No Records Found"`.

`POST /connect/kyc/documents` matches that wording (`KYC_NO_RECORDS`) and answers
`{ documents: [] }`, so the page shows its reassuring empty state rather than a
red error box. Every other non-zero envelope is still a real failure and still
surfaces as one.

Matching on the message is all upstream gives us to go on. If a
`response_type_id` for this case ever surfaces, prefer it.

## Entitlement

`kycEnabled(list)` (`src/lib/connect/kyc.ts`) requires **both** 586 and 587 in
the `/transactions/wlc` list. Listing without uploading would render a page
whose every button fails upstream, which reads as a broken console rather than
an unavailable feature.

`useKycEnabled()` is the React face of it, mirroring `useLoadWalletFlowId`. It
returns `null` while unresolved so callers can tell "not entitled" from "not yet
loaded" and avoid flashing a refusal at every user on mount.

Two independent guards use it, deliberately:

- `ConsoleLayout` inserts the **Documents** rail item, directly after Home and
  ahead of Load Wallet — an unfinished KYC pack is what blocks the account.
- `Documents.tsx` guards itself and fires no requests when unentitled. A nav
  item is not an access control, and `/console/documents` is reachable by URL.

## Every document is mandatory

Upstream sends `is_required`, marking some documents optional. **The console
ignores it.** `parseDocumentList` does not carry the field across at all, so no
component can start branching on it later without a deliberate change here.

The reasoning: an incomplete pack does not fail at upload, it fails at review,
days later. Offering "optional" is offering a slow way to fail. The field still
rides through the backend proxy unparsed, so nothing is lost if this is
reversed — it is one line in `parseDocumentList`.

## Multi-page documents

A document with `pages: "N"` needs exactly N files. Submit stays disabled until
all N slots are filled, and the backend rejects a short pack rather than
half-uploading a document upstream cannot review.

`pages` arrives as a string and is parsed tolerantly: anything that is not a
positive integer — `""`, `"0"`, `"N/A"`, an absent field — falls back to 1,
because a document asking for zero files could never be submitted at all. A
range like `"1-2"` takes its low end, on the same logic: too few files fails at
review, too many blocks the upload outright.

## What is deliberately not sent

- **`doc_id`** appears in connect-api's sample upload params and is omitted.
  Nothing in the 586 response supplies it, and the upload is already identified
  by `doc_type` plus the session. (`intent_id` was omitted on the same reasoning
  until upstream asked for it — it is now sent as a fixed `4`, see
  [587 — the upload](#587--the-upload).)
- **`latlong`** appears in both sample requests and is omitted. A document
  checklist is the wrong place to raise a geolocation permission prompt. If
  upstream turns out to need it, the position is *already* resolved for the
  watermark (`src/hooks/use-watermark.ts`) — reuse that rather than prompting a
  second time, and send it empty when permission was denied.
- **`user_id` and `client_ref_id`** are never accepted from the browser.
  `user_id` comes from the sealed session claim, so a caller cannot upload
  against someone else's account; `client_ref_id` is minted by the connect
  client for every upstream call it makes — 10 characters, base36 timestamp +
  random tail (`clientRefId()` in `clients/http.ts`). Ten because connect-api
  rejects a longer one on `/authentication/*`.

## Status semantics

| `status` | Pill | Tooltip (`desc`) | Uploaded | Can upload | `order` |
| --- | --- | --- | --- | --- | --- |
| 0 | Pending | Please upload the document | no | yes | 1 |
| 1 | Approval Pending | Document uploaded, waiting for review | yes | **no** | 3 |
| 2 | Uploaded | Document uploaded and approved | yes | **no** | 4 |
| 3 | Resubmission needed | Document rejected, requires resubmission | no | yes | 0 |
| 4 | Rejected | Document rejected | no | yes | 2 |

`DOCUMENT_STATUS` (`src/lib/connect/kyc.ts`) encodes exactly this, and
`statusOfDocument` treats any other code the way an unknown one has always been
treated: not-yet-uploaded, never a false "done".

Two of these read **destructive** — 3 and 4 — and on those the label prefers
upstream's own `error`, then `status_desc`, before the map's generic wording; a
rejection reason is the most useful thing a row can say. The preference keys off
the *variant*, not a hard-coded 3, so a future refused code inherits it. Every
other status prefers `status_desc` over the map.

The **tooltip is always the mapped `desc`**, never upstream's string. A row can
therefore wear a terse upstream label and still explain what happens next. Status
0 has no `desc` because it has no pill.

### `order` — where the row sits in the list

The checklist is sorted by `order`, then alphabetically by the row's **label** —
the one after `withDocConfig`, so an overridden name sorts where the partner
actually reads it, not where upstream's string would. `docType` only breaks a tie
between two documents that somehow share a name. Upstream's own order carries no meaning, and a list whose
actionable rows sit under a run of approved ones reads as finished when it is
not. So the sequence runs by what the row asks of the partner: **resubmission
needed → pending → rejected → approval pending → uploaded**. An unrecognised
status sorts with pending, the same place its `canUpload: true` puts it.

`parseDocumentList` sorts, not the page: the list then only reorders on a fetch,
so a row cannot jump out from under a click. `order` never leaves `kyc.ts` —
`statusOfDocument` strips it, since it is a list concern, not a row's.

### `canUpload` — when the row offers no button at all

A status whose `canUpload` is false renders **no button**, not a disabled one: a
document under review is not something to replace, and a greyed-out button
invites the click anyway. The pill's tooltip is what says why.

It is its own flag rather than `!uploaded` because the two answer different
questions — a rejected document is *not* uploaded **and** must be re-sent, while
one awaiting review *is* uploaded and must be left alone. Replacing a file
mid-review hands the reviewer a second document against a decision they have
already started.

An unrecognised status keeps `canUpload: true`. A code we have never seen is not
grounds to strand a partner on a row they cannot act on.

When the button does show, its label follows the other two signals: **Replace**
when the status counts as uploaded, **Retry** on a destructive one, **Upload**
otherwise. Today no status is both uploaded and uploadable, so "Replace" is
unreachable — it stays because `canUpload` is the switch, and a future status
may want exactly that pairing.

A successful upload is still also remembered for the session (`uploadedNow`
in `Documents.tsx`), read ahead of the mapped status. This is not a workaround
for an unknown code — the list is refetched after every upload, and there is no
guarantee that refetch already reflects the write it is chasing. `uploadedNow`
bridges exactly that gap; it drops away on reload, and every fetch after the
first is upstream's own status doing the same job. It reads as **status 1, not
2**: this console handed the file over, and nothing has approved it — claiming
"approved" for the second between the envelope and the refetch would be a
promise the console cannot make.

The overlay **yields the moment upstream agrees**: it applies only while the
fetched status does not already count as uploaded. Otherwise a row upstream had
already approved would keep reading "Approval Pending" until the next reload,
hiding a decision that has already been made.

> The sample in `kyc.fixture.ts` was captured under the previous numbering,
> where a not-yet-uploaded document reported `1`. Its rows now carry `0` so the
> fixture means under this scheme what it meant when it was recorded — a pack
> with nothing uploaded. Re-record it from UAT when convenient.

## File rules

| Rule | Value | Where |
| --- | --- | --- |
| Allowed types | `image/jpeg`, `image/png`, `application/pdf` | `KYC_TYPES` |
| Allowed extensions | `.jpg` `.jpeg` `.png` `.pdf` | `KYC_EXTENSIONS` |
| Per-file ceiling | 10 MB, or a document's own `maxBytes` | `KYC_MAX_FILE_BYTES` |
| Pages per document | 1–6 | `KYC_MAX_PAGES` |

An explicit type list, not `image/*`: the wildcard waves through HEIC, WEBP and
SVG, which document review rejects and the last of which is a script carrier.
The declared MIME type **and** the extension must both be allowed, because the
browser supplies both and either alone is trivially wrong. This is
declaration-only — no magic-byte sniffing — which is enough while connect-api
does its own validation.

`KYC_MAX_FILE_BYTES` is its own constant rather than the support desk's
`MAX_FILE_BYTES`, and the two now differ: a passport scan is not a screenshot, so
KYC takes 10 MB where a ticket attachment takes 5. It is declared twice — in
`connect.ts` for the backend, mirrored in `kyc-docs.ts` so the picker can refuse
early — and the backend's copy is the authority. Raise them together.

A single document type may ask for **less** via `maxBytes` in `KYC_DOC_CONFIG`
(see [Per-document overrides](#per-document-overrides)); it may never ask for more,
which `kyc-docs.test.ts` pins.

Both ceilings are only real if the hops in front of the app allow them, and in
production they were not. The `api.eps.eko.in` vhost set no
`client_max_body_size`, so nginx's **1 MB default** applied while the app
advertised 10 MB — a 1.5 MB bank statement was refused with a 413, the Vercel
`/api` hop turned nginx closing the connection into its own 502, and the user
saw `PARSE_ERROR`. Fixed by scoping `client_max_body_size 20m` to the upload
location; see the nginx section of
[`eps-backend-vm-deploy.md`](../../packages/eps-backend/docs/eps-backend-vm-deploy.md).

**20 MB is the real production ceiling per upload, not the 60 MB the constants
imply** (`KYC_MAX_PAGES` x `KYC_MAX_FILE_BYTES`). That undershoot is deliberate —
real scans are 1-3 MB, and the backend buffers the whole request in
`c.req.formData()` before any auth or per-file check runs, so a wide cap is
memory exposure on an unauthenticated route. The gap only bites on a multi-page
set of near-maximum files, and it no longer fails silently: the toast reads
`proxy · PARSE_ERROR · HTTP 502`. If users start hitting it, either raise the
nginx directive or lower `KYC_MAX_FILE_BYTES` — do not let the two drift
further apart, because that drift is what caused the outage.

Upstream is not a constraint: connect-api's own vhost allows 100M on
`/transactions/upload`. Nor is Vercel — its ~4.5 MB body cap applies to
functions, not to the external-target `routes` entry this path uses, which
streams the body through (`X-Vercel-Error:
ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR_CD8` is a connection failure, not a
rejection).

The upload itself is wrapped in `withRetries` (`src/lib/retry.ts`) — two retries,
1s then 3s apart — so a flaky upstream does not read as a rejected document.
`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `INVALID_INPUT` and `RATE_LIMITED` are
never retried, so a file this section refuses still fails on the first attempt.
Note that three attempts consume three of the route's `KYC_UPLOAD_LIMIT` budget.
See [`user-onboarding.md`](./user-onboarding.md#retrying-transient-failures).

## Blur detection

Badly scanned documents — blurred, out of focus — sail through every rule above
and come back a week later as a review rejection. `src/lib/connect/blur.ts`
scores every capture's sharpness on-device before it is attached, from any
source: picker, drag-and-drop, camera, and scanned PDFs.

**The metric.** Tile-based variance of a 3×3 Laplacian on 0–255 luma, image
downscaled to ≤1024px first. The image is split into an 8×8 grid; near-blank
tiles (luma σ < 4) are dropped so empty margins cannot decide the verdict, and
the **10th percentile** of the surviving tiles' variances becomes the score —
a document is only as legible as its worst inked region. Pure typed-array
math, no dependencies, single-digit milliseconds at analysis resolution.

**The scale: 0–100, higher is sharper.** The score is
`20 × log₁₀(1 + variance)` — a decibel-like log scale, because raw Laplacian
variance spans roughly 1 (mush) to 10,000 (crisp print) and a linear scale
would be unusable as a config knob. So 70 is a *good* score. Measured against
synthetic text pages at analysis resolution:

| Capture | Score |
| --- | --- |
| Crisp, dense text | 80 |
| Crisp, sparse text (20% inked) | 70 |
| Crisp, with one soft region (a photo, a fold shadow) | 62 |
| Very mild softness | 60 |
| Mild softness — the edge of acceptable | 46 |
| Page shot at an angle, far edge unreadable | 43 |
| Soft | 34 |
| Clearly blurred | 14 |
| Badly blurred | 5 |

Treat the ordering as reliable and the absolute values as provisional: these
are synthetic pages, not real phone captures.

### Why the percentile is low

The first version scored the **90th** percentile, on the reasoning that a
document with any crisp region is readable. That was wrong for the captures
this feature exists to catch, and the measurements say so plainly:

| Capture | p90 | p50 | p25 | p10 |
| --- | --- | --- | --- | --- |
| Crisp, dense text | 91 | 91 | 81 | 80 |
| Crisp, sparse text | 91 | 80 | 70 | 70 |
| Clearly blurred (2px) | 23 | 23 | 14 | 14 |
| **Angled page, far edge unreadable** | **85** | 74 | 62 | **43** |

At p90 a page shot at an angle scored **85** — indistinguishable from a perfect
scan — because the crisp near edge carried the whole verdict, and the number
did not move however badly the far edge degraded. That is the single most
common way a phone capture of a document fails.

The blank-tile guard is what makes a low percentile safe: the empty-margin
problem p90 was protecting against is already solved one step earlier, so the
high percentile was redundant cover that bought a blind spot. p10 keeps a
useful margin over legitimately awkward documents — one soft patch on a sparse
page still scores 62 — while the angled page drops to 43.

**Threshold 45** is the only cut that classified every synthetic case
correctly, but the margin is 3 points (46 passes, 43 fails), which is tight.
Re-fit it against real telemetry before enforcing.

### What this metric does not catch

Worth knowing before trusting it, since two of the three common causes of a bad
scan are outside what Laplacian variance measures:

- **Out of focus, and motion blur — caught well.** This is exactly what the
  metric measures.
- **Poor lighting — essentially not caught.** An in-focus page with contrast
  crushed to 5% of normal, near-invisible to a human, still scores 39. Low
  contrast lowers the score, but nowhere near enough to gate on. Arguably
  correct — a dim but focused scan recovers with auto-levels, unlike true blur
  — but do not expect this check to refuse a badly-lit capture.
- **Skew and perspective — not caught at all, by design.** A sharply focused
  page photographed at 45° scores like any other sharp page. Only the *defocus*
  that often accompanies a bad angle registers; the geometry does not.
- **Cropped, upside-down, or wrong document — not caught.** Out of scope.

**One rule for the whole checklist, with one door out.** Legibility is a
property of the capture for almost every row, so three constants in
`kyc-docs.ts` decide it by default:

| Constant | Value | Meaning |
| --- | --- | --- |
| `KYC_BLUR_CHECK` | `warn` | Toast, but let the upload through |
| `KYC_BLUR_THRESHOLD` | 45 | The 0–100 sharpness floor |
| `KYC_BLUR_STAMP_FILENAME` | `true` | Write the score into the uploaded file name |

A document type may name its own **mode** — and only the mode — via
`KycDocConfig.blurCheck`. `doc_type` 24, the directors' live photograph, sets
`measure`: it is a person in a room rather than inked text, so a floor fitted
to document scans is judging the wrong thing, and a wide-framed photo against a
plain wall would toast at a partner who did exactly what review asked for. The
score is still taken and still stamped into the file name, so the evidence for
a photograph-specific threshold keeps accumulating.

The threshold stays global on purpose: a floor that moved by row would make the
collected scores incomparable, which is the only reason to collect them.

`KycDocConfig.options` still **excludes** `blurCheck` and `blurThreshold` from its
type, and `KycUploadDialog` spreads the resolved values after the document's own
options, so `options` cannot smuggle a mode in — `config.blurCheck` is the
sanctioned way. Underneath, the generic component takes
`blurCheck: 'off' | 'measure' | 'warn' | 'block'` and `blurThreshold` on
`ImageEditorOptions` — `measure` scores silently, `warn` toasts and attaches,
`block` refuses (in the editor that keeps the dialog open for a retake, the
face-count precedent; elsewhere it drops the file with a toast).

`warn` rather than `block` deliberately: the threshold has not been calibrated
against real captures, and a false positive on a legible scan is a partner who
cannot finish KYC at all.

**Where it runs — always after compression.** The check is fed the bytes that
will actually be uploaded, never the original. This matters: a soft 4000px
phone photo resized to 1200px is genuinely legible, because the blur kernel
shrinks below a pixel on the way down, and the resized file is what the
reviewer opens. Scoring the original would refuse captures that are fine.

- Images through the editor: scored in `onAccept` on the processed file, after
  crop, resize, watermark and re-encode.
- Images that skip the editor (`disableImageConfirm`) and PDFs: scored in
  `FileUpload`'s `checkBlurOrExplain`, PDFs after `compressIfLarge`.
- PDFs go through `blurScorePdf` (`pdf-client.ts` → `pdf-render.ts`): only pure
  image scans are eligible (any text or vector op means born-digital, sharp by
  construction — the same conservative test compression uses, so an
  OCR-overlaid scan is skipped rather than misjudged), at most the first 3
  pages are rasterized, and a soft 4s deadline stops the check early.

**Several pages: the lowest wins.** `lowestBlurScore` is the single home for
that rule — not the average. Review reads every page, so a pack whose middle
page is unreadable is rejected however crisp the others are, and averaging
would hide exactly the page that gets it bounced. It applies to PDF pages and
to the images combined into one; the combined PDF is a new `File`, so it is
re-stamped with the worst of its parts.

**Fail-open, everywhere.** A `null` score always means "could not judge" —
blank page, digital PDF, decode failure, timeout, encrypted — and always
passes. The check can only ever degrade to the pre-existing behaviour, never
below it.

**Slow steps explain themselves.** Compressing a big scan or quality-checking a
large photo can stall a pick, and an unexplained stall reads as a broken
button. `FileUpload.withStatus` names the running step ("Checking quality…",
"Compressing PDF…", "Combining pages…") as fine text with a spinner, but only
once it has run for a second — below that a label would flash and read as a
glitch. In development the component also prints the resulting score under the
zone, so a threshold can be judged against real captures.

**Getting the score to review.** Two channels carry the same number, because
only one of them currently arrives:

- **The file name** — `aadhaar-front_blur_score18.pdf`, via
  `withBlurScoreInName`. Upstream keeps the name, so this is what a reviewer
  actually sees. A stopgap.
- **`blur_score1..N` form fields** — the right channel, ignored today. The
  backend reads only the fields it names, so the extra parts are harmless.

**Recording those fields is the follow-up that makes the threshold
calibratable.** Until then 45 is fitted to synthetic pages; look at real score
distributions before moving `KYC_BLUR_CHECK` to `block`, and turn
`KYC_BLUR_STAMP_FILENAME` off once upstream records the scores properly, at
which point the names are just noise.

### Capture-quality roadmap

The organising idea: detection is the weakest link in the chain. **Prevent**
bad captures at the shutter, **repair** what is fixable on-device, **validate**
content where a document carries its own ground truth, and only then fall back
to **detecting** what is left. Everything below is progressive enhancement —
each stage feature-detects and degrades to today's behaviour, so coverage
gaps cost nothing.

Ranked by value per unit of cost:

1. **Capture at full sensor resolution — `ImageCapture.takePhoto()`.** ✅ Built.
   The camera previously uploaded a 1920×1080 *screenshot of the video stream*:
   compressed video frames, grabbed without waiting for autofocus. Much of the
   blur this feature detects was manufactured right there. `takePhoto()` uses
   the full sensor with real autofocus convergence; a torch button attacks the
   poor-lighting failure mode at the source. Coverage: Chrome/Android — the
   bulk of an India-heavy funnel; everyone else keeps the screenshot path.
   Zero dependencies. See `src/lib/connect/camera.ts`.
2. **Live sharpness in the viewfinder.** ✅ Built. `blurScore` costs single-digit
   milliseconds on a small frame, so the preview scores itself a few times a
   second and the UI says "Hold steady" *before* the shot instead of rejecting
   it after. Zero dependencies, works everywhere the camera does.
3. **Record `blur_scoreN` upstream, then re-fit the threshold.** The gating
   step for everything tunable. The 3-point synthetic margin between pass and
   fail is too tight to trust; only the real distribution can set the line.
4. **Exposure check + auto-levels repair.** Blur variance will never catch dim
   captures (measured: a near-invisible 5%-contrast page scores 39). Mean luma
   and dynamic range over inked tiles are already computed inside `blurScore`
   — surfacing an exposure verdict is ~50 lines. Then repair rather than
   refuse: histogram-stretch on canvas before upload. Keep it a separate
   signal with its own message — "move to better light" is different advice
   from "hold still".
5. **QR validation for Aadhaar and PAN — `BarcodeDetector`.** Both carry QR
   codes (PAN since 2017; Aadhaar's secure QR). A decoded QR proves the capture
   is legible, is the right document type, and carries demographics that can be
   cross-checked against the applicant — catching wrong-document uploads no
   blur metric can see. Native on Chrome/Android, zero payload; `zxing-wasm`
   (~300 KB) as optional fallback. Readable QR → skip blur gating (kills false
   positives); unreadable QR on a known-QR doc at good resolution → soft
   negative.
6. **Tiered OCR as the legibility tiebreaker — Tesseract.js.** OCR confidence
   is the ground-truth answer to "can review read this", but only worth its
   ~5 MB and 2–8 s in the ambiguous band: score ≥ 60 passes silently, ≤ 25
   warns immediately, and only the grey middle gets OCR'd in a worker after
   attach. The sleeper win is field validation — PAN format `ABCDE1234F`,
   12-digit Aadhaar, name match against the application — a class of review
   rejection entirely outside "blurry". Native routes are not ready: 
   `TextDetector` never shipped unflagged; Chrome's built-in model is
   desktop-only with a download gate — wrong shape for a mobile-heavy funnel.
7. **Document-quad detection + perspective correction.** The angle failure
   mode solved rather than scored: a "fill the frame" overlay at capture, a
   perspective warp after. The good implementations ride on OpenCV.js
   (~8 MB wasm, lazy-loaded only when the camera opens) — defensible once
   telemetry shows how much angle-failure survives items 1–6, not before.
8. **Content checks** — whole document in frame, right way up, the document
   that was asked for. Wants a model, not a kernel; only worth it if review
   data says framing rejections outnumber blur rejections.

Rejected for now: document-quality CNNs via ONNX/transformers.js (the tiered
blur + OCR pipeline buys most of the accuracy for a fraction of the 10–20 MB),
WebGPU compute (the metric already runs in milliseconds), and worklets (paint/
audio-scoped; the PDF worker already covers threading).

The architecture all of this slots into: one cheapest-first pipeline —
blur + exposure always, QR when the doc type carries one, OCR only in the grey
band — each stage feature-detected, each emitting its own verdict and its own
telemetry field, so each threshold is independently tunable. The blur-vs-
lighting lesson generalises: never fold two defects into one number.

## UI

`/console/documents` — titled **Upload Documents**, in the rail and on the page
— is a single-column checklist (`max-w-3xl`): the standard two-line console
header, an "N of M documents pending" line, then one row per document showing its
icon, name, upstream's note and a primary-coloured action button (Upload / Retry
/ Replace). States render in the console's usual order — error, skeletons, dashed
empty state, content.

The count is the number of rows whose status does **not** count as uploaded —
`statusOfDocument().uploaded`, `uploadedNow` included — over the length of the
list, not the length alone: upstream keeps approved documents in the list, and
counting them as outstanding tells a partner they owe work they have already
done. At zero the line reads **"All documents uploaded"** rather than "0 of 11".

Three things the row deliberately does **not** show:

- **A progress bar.** The line above the list already carries the ratio, and a
  bar would give a pack of eleven documents a milestone it does not have — the
  KYC either clears review or it does not.
- **The page count.** It tells the user nothing until they open the dialog,
  which is where the slots make it obvious.
- **A pill for a status that has nothing to say.** Only an unrecognised code is
  silent; every mapped status wears its own pill, in red when it is a rejection.

The pill carries its status's `desc` as a **tooltip**, on hover and on focus —
the trigger is a `tabIndex={0}` span, so the explanation is reachable without a
pointer. `Documents.tsx` mounts its own `TooltipProvider` rather than leaning on
the app's: the page is rendered on its own in tests, and Radix throws when a
`Tooltip` finds no provider above it.

A green tick is reserved for the approved status alone. "Approval Pending" is
uploaded but not done, so it wears an outline Badge — a tick there would say the
document had cleared review when it has not.

Selecting a document opens `KycUploadDialog`, a plain shadcn `Dialog` holding
one `FileUpload` per page. It is *not* an entry on `DialogHost`: the camera,
image editor and file viewer `FileUpload` drives are portalled by
`ConnectDialogProvider` independently, so they stack above it on their own.

Stacking needs one guard, `ignoreNestedDialogInteraction` in
`src/components/ui/dialog.tsx`, applied by `DialogContent` and by `DialogHost`'s
own content. Radix defers its "am I the top layer?" test to the click after the
pointerdown; the dialog above closes by unmounting *during* that click, so the
one below reads as topmost and dismisses itself. Without it, closing the image
viewer took the upload dialog — and every page already attached — with it. The
ordering does not reproduce under jsdom, so it is checked by hand on the
dev-only bench at `/console/test`.

Clicking an attached page's thumbnail opens it full-screen in `FileViewDialog`,
fitted to the viewport, with pinch/ctrl-wheel and `−`/`+` zoom up to 8× and
scroll to pan. Zoom is an explicit size rather than a transform: a transform
paints outside the scroll area instead of extending it, leaving no way to reach
the part of a zoomed document the user is trying to read. Previews are object or
`data:` URLs with no extension to sniff, so `FileUpload` passes `type: "image"`
outright — without it the viewer framed them in an iframe, at original size,
with scrollbars.

A page whose document type asks for a `watermark` is uploaded with provenance —
who, where, when — burnt into the pixels. It is **opt-in per document type**, and
today only `"24"` (the live photograph) asks: a stamp is evidence about a capture
this console witnessed, so on a scan of a card that existed long before the
upload it defaces someone's Aadhaar and proves nothing about it.

Either way it applies to **images only**; `FileUpload.handleFile` routes
non-images straight through, so a PDF is attached untouched and carries no
watermark evidence.

A document type configured with a `sampleUrl` shows a download link above the
slots — "Download the sample, fill and sign it, then upload the PDF" — so it is
read before anything is attached rather than after. See
[Sample documents](#sample-documents).

On failure the dialog stays open with the files still attached and reports
through `toast.error` — re-picking every page because the network blipped is the
worst possible recovery. On success the page toasts, marks the row, and
refetches.

There is no upload percentage: `fetch` cannot report one, and a fake bar is
worse than none.

## Per-document overrides

`src/lib/connect/kyc-docs.ts` holds a local map keyed by `doc_type`. Upstream's
list is shared across every Eko product — it says what a document is called and
how many files it takes, and nothing about how it should be *captured*. This is
where the console records what it knows that the shared list cannot express.

| Field | Effect |
| --- | --- |
| `name`, `info`, `pages` | Replace upstream's values on every parsed row |
| `pageLabels` | Names each slot, instead of "Page 1", "Page 2", … |
| `sampleUrl` | A blank of this document to download, fill in and upload back — see [Sample documents](#sample-documents) |
| `instructions` | A markdown notice in the upload dialog, above the slots — see [Sample documents](#sample-documents) |
| `accept` | Narrows the allowed types for this document |
| `cameraOnly` | No file picker and no drag-and-drop — the camera or nothing |
| `multiple` | One slot may take several attachments, combined into a single PDF |
| `watermark` | Burns a provenance stamp into this type's captures. Opt-in — absent means none |
| `options` | Crop ratio, size cap, face checks — see `FileUploadOptions` |
| `maxBytes` | A tighter per-file limit than the backend's 10 MB |

Rules that matter:

- **Local always wins**, unconditionally — the merge is `??`, so `info: ""` is a
  deliberate instruction to show no note, not an omission. The cost is that an
  upstream rename is invisible once overridden, so keep the map small.
- **An unknown `doc_type` gets an empty config**, never an error: upstream can
  add a document tomorrow and it must still be uploadable.
- **`pages` is a claim about upstream's contract**, not about presentation. The
  backend takes our count at face value and forwards exactly that many files;
  above `KYC_MAX_PAGES` every upload 400s. Use it only to correct a count
  upstream got wrong. A table-driven test in `kyc-docs.test.ts` enforces the
  range.
- **`maxBytes` only ever goes down.** Raising it past the backend's ceiling does
  not accept a larger file; it spends the upload before the same rejection. It
  is enforced *after* the image editor has run, so a phone photo the editor was
  about to shrink is not refused — what it really catches is an oversized PDF,
  which skips the editor entirely.
- **Never combine `options.disableImageConfirm` with a document that needs
  provenance.** It skips the editor, and the editor is where the watermark is
  burnt into the pixels.
- **`multiple` is per *slot*, not per document.** A two-page document with it set
  can take several photos of the front and several of the back, and uploads one
  combined PDF as `file1` and another as `file2`. A slot given a single
  attachment sends it unchanged, so nothing becomes a PDF that did not need to
  be. Each attachment still goes through the editor, so every page carries the
  watermark. It only engages while `accept` is images and/or PDFs — see
  `docs/pdf-toolkit.md`.

Presentation fields are overlaid inside `parseDocumentList`, so the page and the
dev bench cannot drift; capture metadata is read by `KycUploadDialog` straight
from `configOf`.

The entries that ship today:

| `doc_type` | Config | Why |
| --- | --- | --- |
| `"1"` Aadhaar | `pageLabels: ["Aadhaar front", "Aadhaar back"]`, `multiple` | Two identical "Page 1 / Page 2" slots is how a user attaches the front twice and hears about it at review, a week later. Photographed far more often than scanned, and a phone rarely gets a whole card square in one frame — so each side may take several shots. |
| `"2"` and `"15"` PAN | `multiple` | Same reasoning as Aadhaar: a photographed card, sometimes worth two shots. Both codes are configured — the 586 sample calls `15` "Director PAN Card", so configuring only one would silently do nothing for accounts asked for the other. |
| `"14"` Board resolution | `name: "Board Resolution (BR)"`, `sampleUrl` | A partner does not own a blank board resolution; the wording is ours to dictate, and one invented from scratch comes back rejected weeks later. The sample is `public/kyc-samples/Board_Resolution_Format.docx`. |
| `"24"` Live photograph | `name: "Directors' Live Photograph"`, `accept` images only, `cameraOnly`, `multiple`, `watermark` | Upstream's name spells out the capture rules ("with Location Coordinates") and its `info` names a third-party GPS camera app, because upstream cannot enforce either. This console can. |

The live-photograph entry is what the whole map exists for. A "live" photograph
selectable from the gallery is not live, so the camera is the only source, the
`accept` list is narrowed to images so a PDF cannot arrive claiming to be one,
and the watermark is what actually supplies the coordinates the document's name
promises. With those enforced, the name can go back to naming the document.

Face detection is deliberately **off**: it pre-crops to the face it finds, which
is wrong for a photograph that has to show the director *and* their
surroundings, and it refuses outright when the model misses in poor light.
`minFaceCount` is only enforced under `detectFace`, so it would be dead config
on its own.

## Sample documents

Some of what KYC asks for is not a document a partner already owns. An
authorisation letter, a declaration, an undertaking — the wording is ours to
dictate, upstream's list only names the thing, and a partner left to invent their
own only finds out it was wrong at review, weeks later. For those, a document
type carries a `sampleUrl`: a blank to download, fill in, sign, and upload back
as a PDF through the same slots as everything else.

- **The file is committed**, under `public/kyc-samples/`, so a sample and the
  console that describes it ship together and a revision is a reviewable diff.
  Vite copies `public/` verbatim into `dist/`, and both the Vercel and Netlify
  SPA fallbacks are rewrites — the filesystem is checked first, which is why
  `/scripts/leegalityv5.min.js` and `/eps-pricing-calculator.xlsx` already
  resolve rather than returning the app shell.
- **`sampleUrl` is a root-relative path** into that directory, and nothing else:
  `kyc-docs.test.ts` pins the shape *and* that the file exists on disk, so a
  rename fails CI instead of 404-ing at the one moment a partner cannot proceed
  without it.
- **`sampleUrl` is not merged onto the row.** Like `accept` and `watermark` it is
  read by `KycUploadDialog` straight from `configOf`; the checklist deliberately
  does not repeat the link, since the dialog is where the upload happens.
- **Absent means the document exists independently of us.** A PAN card has no
  blank. Do not point one at a specimen image — a sample is something to fill in,
  not an example to compare against.
- **The link text is fixed** — download, fill, sign, upload the PDF. Every sample
  today follows that flow; a document that genuinely does not needs its own label
  field, not a misleading shared sentence.

The `.docx` files themselves are business artefacts, not code: they carry legal
wording, so what lands here is whatever compliance approved, macro-free, and
checked for stray metadata before it is committed.

### Instructions

A blank on its own rarely says everything. `instructions` puts a notice at the
top of the upload dialog — above the sample link and the slots, because it is
only useful before a file is picked.

- **Markdown, with GFM.** Upstream's `info` is one line of plain text; the rules
  for a board resolution are a list. Rendered by `react-markdown` with
  `remark-gfm`.
- **No raw HTML.** `rehype-raw` is deliberately not used, so anything that looks
  like a tag renders as text. The copy comes from `kyc-docs.ts` and is ours;
  upstream's strings are never rendered as markup.
- **Styled inline, not by `MarkdownProse`.** That component is the docs
  renderer and pulls the syntax highlighter in with it — a cost the console
  should not pay for a paragraph and a list. The handful of `[&_ul]`-style rules
  in `KycUploadDialog` cover what an instruction block actually uses; there is no
  typography plugin in this project.
- **Write it only when it changes what gets attached.** A notice on every
  document is a notice nobody reads.

## Files

| Path | Role |
| --- | --- |
| `src/lib/connect/kyc.ts` | Constants, `KycDocument`, gating, parsing, status |
| `src/lib/connect/kyc-docs.ts` | Per-`doc_type` overrides, `KYC_ACCEPT`, the mirrored backend limits |
| `src/lib/connect/kyc.fixture.ts` | The 586 sample, shared by tests and the bench |
| `public/kyc-samples/` | The downloadable blanks a `sampleUrl` points at |
| `src/lib/connect/use-kyc.ts` | `useKycEnabled()` |
| `src/pages/console/Documents.tsx` | The checklist page |
| `src/components/console/KycUploadDialog.tsx` | The upload dialog |
| `src/components/console/ConsoleLayout.tsx` | The **Documents** rail item |
| `packages/eps-backend/src/http/connect.ts` | `POST /connect/kyc/documents`, `POST /connect/kyc/upload` |
| `packages/eps-backend/src/clients/connect.ts` | `uploadInteraction` |

## Still to verify against a live UAT account

None of these are assumptions the code hides — each is a small, localised fix —
but none should be treated as settled before this is enabled in production:

1. Whether `pages` is ever non-numeric or a range (`parsePages`).
2. Whether upstream accepts the calls without `latlong` and `doc_id`.
   (`intent_id` is settled: the backend team confirmed `4`.)
3. Whether a 2-page document may be sent as a single 2-page PDF, which the
   "exactly N files" rule currently forbids.
4. Whether a genuinely 10 MB document survives the full authenticated path to
   connect-api. The hops in front are now settled — nginx is fixed, Vercel
   streams rather than caps, upstream allows 100M (see
   [File rules](#file-rules)) — but no real file that large
   has been through end to end, and it cannot be tested from production without
   pushing junk KYC upstream under a live account. Needs UAT credentials.
