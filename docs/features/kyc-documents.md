# KYC document upload

Onboarding creates the account; KYC activates it. A user who has finished
`/signup` still has to send Eko a pack of identity and business documents —
scans, PDFs or a photo taken there and then. This feature puts that pack in the
console at `/console/documents` instead of over email.

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
        "pages": "2", "is_required": 1, "status": 1, "status_desc": "", "error": "" }
    ]
  },
  "response_type_id": 1564,
  "message": "Success",
  "status": 0
}
```

The verbatim sample lives in `src/lib/connect/kyc.fixture.ts` and is shared by
the unit tests and the dev-only bench, so both look at the same bytes.

### 587 — the upload

`multipart/form-data`, with connect-api's own convention: **every field travels
URL-encoded inside a single `formdata` part**, and the files are sibling parts
named `file1`, `file2`, … It is not a general multipart form. The same transport
already backs support-ticket attachments, so both go through one
`uploadInteraction` in `packages/eps-backend/src/clients/connect.ts`.

```
formdata: client_ref_id=…&locale=en&user_id=…&interaction_type_id=523&doc_type=1&pages=2
file1: <binary>
file2: <binary>
```

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

- **`doc_id` and `intent_id`** appear in connect-api's sample upload params and
  are omitted. Nothing in the 586 response supplies them, and the upload is
  already identified by `doc_type` plus the session.
- **`latlong`** appears in both sample requests and is omitted. A document
  checklist is the wrong place to raise a geolocation permission prompt. If
  upstream turns out to need it, the position is *already* resolved for the
  watermark (`src/hooks/use-watermark.ts`) — reuse that rather than prompting a
  second time, and send it empty when permission was denied.
- **`user_id` and `client_ref_id`** are never accepted from the browser.
  `user_id` comes from the sealed session claim, so a caller cannot upload
  against someone else's account; `client_ref_id` is minted server-side as 20
  digits (13-digit timestamp + 7 random, `node:crypto`).

## Status semantics — UNCONFIRMED

The only payload we have is a freshly issued list in which every document,
uploaded or not, carries `status: 1` with an empty `status_desc`. So 1 cannot
mean "uploaded", and nothing distinguishes the other codes.

`DOCUMENT_STATUS` therefore claims only what the sample supports, and
`statusOfDocument` treats every unrecognised code as not-yet-uploaded. The
failure mode is telling a user they still have work to do when they don't —
which they can act on — instead of telling them they are finished when upstream
disagrees, which they cannot.

Because of that, a successful upload is remembered for the session
(`uploadedNow` in `Documents.tsx`) so the row can read "Uploaded" at all. That
is not optimism: each entry comes from an upstream success envelope. It drops
away on reload, and the list is refetched after every upload so upstream stays
the source of truth for everything else, including a rejection it decides on
straight away.

**Widen `DOCUMENT_STATUS` — do not add heuristics elsewhere — once a real UAT
account shows what the codes mean.** At that point `uploadedNow` can go.

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

Both ceilings are only real if the hops in front of the app allow them: nginx
defaults `client_max_body_size` to 1 MB, and a serverless deploy caps request
bodies at a few MB regardless of what the handler checks.

## UI

`/console/documents` — titled **Upload Documents**, in the rail and on the page
— is a single-column checklist (`max-w-3xl`): the standard two-line console
header, an "N documents pending" line, then one row per document showing its
icon, name, upstream's note and a primary-coloured action button (Upload / Retry
/ Replace). States render in the console's usual order — error, skeletons, dashed
empty state, content.

Three things the row deliberately does **not** show:

- **A progress bar.** The list is refetched after every upload and comes back
  without the document just sent, so "0 of 6" would count against a total that
  shrinks under it. The outstanding count is the honest number.
- **The page count.** It tells the user nothing until they open the dialog,
  which is where the slots make it obvious.
- **A "Not uploaded" pill.** An Upload button next to a listed document already
  says that. The pill appears only when upstream has something to add — a
  `status_desc`, a rejection reason (in red), or this session's "Uploaded".

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

Every page is uploaded with `watermark` on, which burns provenance — who, where,
when — into the pixels. That applies to **images only**; `FileUpload.handleFile`
routes non-images straight through, so a PDF is attached untouched and carries
no watermark evidence.

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
| `accept` | Narrows the allowed types for this document |
| `cameraOnly` | No file picker and no drag-and-drop — the camera or nothing |
| `watermark` | Overrides the default provenance stamp |
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

Presentation fields are overlaid inside `parseDocumentList`, so the page and the
dev bench cannot drift; capture metadata is read by `KycUploadDialog` straight
from `configOf`.

Two entries ship today:

| `doc_type` | Config | Why |
| --- | --- | --- |
| `"1"` Aadhaar | `pageLabels: ["Aadhaar front", "Aadhaar back"]` | Two identical "Page 1 / Page 2" slots is how a user attaches the front twice and hears about it at review, a week later. |
| `"24"` Live photograph | `name: "Directors' Live Photograph"`, `cameraOnly`, `watermark` | Upstream's name spells out the capture rules ("with Location Coordinates") and its `info` names a third-party GPS camera app, because upstream cannot enforce either. This console can. |

The live-photograph entry is what the whole map exists for. A "live" photograph
selectable from the gallery is not live, so the camera is the only source, and
the watermark is what actually supplies the coordinates the document's name
promises. With both enforced, the name can go back to naming the document.

Face detection is deliberately **off**: it pre-crops to the face it finds, which
is wrong for a photograph that has to show the director *and* their
surroundings, and it refuses outright when the model misses in poor light.
`minFaceCount` is only enforced under `detectFace`, so it would be dead config
on its own.

## Files

| Path | Role |
| --- | --- |
| `src/lib/connect/kyc.ts` | Constants, `KycDocument`, gating, parsing, status |
| `src/lib/connect/kyc-docs.ts` | Per-`doc_type` overrides, `KYC_ACCEPT`, the mirrored backend limits |
| `src/lib/connect/kyc.fixture.ts` | The 586 sample, shared by tests and the bench |
| `src/lib/connect/use-kyc.ts` | `useKycEnabled()` |
| `src/pages/console/Documents.tsx` | The checklist page |
| `src/components/console/KycUploadDialog.tsx` | The upload dialog |
| `src/components/console/ConsoleLayout.tsx` | The **Documents** rail item |
| `packages/eps-backend/src/http/connect.ts` | `POST /connect/kyc/documents`, `POST /connect/kyc/upload` |
| `packages/eps-backend/src/clients/connect.ts` | `uploadInteraction` |

## Still to verify against a live UAT account

None of these are assumptions the code hides — each is a small, localised fix —
but none should be treated as settled before this is enabled in production:

1. What `status` and `status_desc` actually mean (`DOCUMENT_STATUS`).
2. Whether `pages` is ever non-numeric or a range (`parsePages`).
3. Whether upstream accepts the calls without `latlong`, `doc_id` and
   `intent_id`.
4. Whether a 2-page document may be sent as a single 2-page PDF, which the
   "exactly N files" rule currently forbids.
5. Whether 10 MB survives every hop in front of the app — nginx's
   `client_max_body_size` and any serverless body cap — and whether upstream
   itself accepts a file that large.
