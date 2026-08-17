# Embedded Eko Connect widget

The console can render Eko Connect transaction flows inline, instead of
hand-building a form per product. First use: **Load E-value** — the `＋` on the
E-value card opens `/console/transaction/491`.

Eko Connect is a no-code transaction-flow builder. `<tf-wlc-widget>` is its
Polymer v1 renderer, the same component Eloka (`wlc-webapp`) embeds at
`/transaction/[...id]`.

Status: **off by default** (`VITE_SHOW_CONNECT_WIDGET=false`). One prerequisite
is unverified — see [Blockers](#blockers).

## Why this needed a token endpoint

The widget authenticates by reading `sessionStorage` in the host page's own
realm. From its shipped bundle (`TfApiBehavior._getAPIDefaultHeaders`):

```js
t = e.crmtoken  ? sessionStorage.getItem("access_token_crm")
  : e.fulltoken ? sessionStorage.getItem("access_token")
  :               sessionStorage.getItem("access_token_lite");
if (t === "undefined" || !t) t = sessionStorage.getItem("access_token");
headers = { Authorization: "Bearer " + t };
```

It has no token prop and no postMessage API. It works in Eloka because HTML
imports execute in the importing document's realm — same origin, same
`sessionStorage`. An iframe on `ekoconnect.in` would have a *different*
`sessionStorage` we cannot write.

This app's posture is the opposite: the session is an HttpOnly cookie (`eps_at`)
that browser JS never sees. So supporting the widget required deliberately
publishing an upstream credential to the browser.

### What is exposed, and what is not

Grepping the 1.4 MB bundle narrowed this considerably:

| Token | Occurrences | Exposed? |
| --- | --- | --- |
| `access_token_lite` | every transaction call | **yes** |
| `access_token_crm` | one `/crm/updateProdDeal` ping | **yes** |
| `access_token` (full) | `fulltoken` flag appears **once** — its own definition; no call site passes it | **no** |
| `refresh_token` | never read by the widget | **no** |

Because setting `access_token_lite` means the full-token fallback never fires,
the full access token and the refresh token stay server-side. `access_token_lite`
carries `{org_id, is_org_admin, user_id, code, eko_user_id, user_type, email}`;
`access_token_crm` carries `{org_id, zoho_id}`.

**Accepted trade-off:** those two tokens are XSS-readable while a flow is on
screen. They are written on widget mount and removed on unmount, on sign-out, and
on session expiry (`AuthProvider`).

## ekostore handoff

The console rail links to ekostore's KYC sandbox
(`https://ekostore.app/products/kyc-verification`) for accounts entitled to
interaction **9995**. ekostore talks to the same connect-api, so the link carries
the user's access token as an `access_token` query param and they are not asked
to sign in twice.

**The access token, not the refresh token.** `connectProvider.refresh` rotates
the refresh token and connect-api consumes the old one, so two holders collide —
whichever side rotates second loses its session. An access token is not consumed
when used, and dies within `MAX_ACCESS_TTL_SEC` (5h) rather than in 8h–30d.

**Entitlement is checked server-side.** `GET /connect/ekostore-token` re-reads
the upstream interaction list and 403s without 9995. The rail runs the same check
only to decide what to draw; a browser can skip that one.

**Accepted trade-off:** a token in a URL reaches browser history, the `Referer`
sent to third parties ekostore loads, and ekostore's access logs. Bounded by the
5h cap and by the refresh token staying server-side, so a leaked URL cannot be
renewed into a persistent session. Do not extend this to anything longer-lived.
The token is held in React state for as long as the link is rendered and is
**never** written to `sessionStorage` — unlike the widget's lite/crm tokens.

## Moving parts

| Piece | File |
| --- | --- |
| Token endpoint | `packages/eps-backend/src/http/connect.ts` |
| ekostore link URL | `src/lib/connect/use-ekostore.ts` |
| Upstream read seam | `AuthProvider.getUpstream` (`src/auth/provider.ts`) |
| Token storage | `src/lib/connect/token.ts` |
| Interaction list → `role_trxn_list` | `src/lib/connect/interactions.ts` |
| Polyfill + HTML import loader | `src/lib/connect/runtime.ts` |
| Widget events → console | `src/lib/connect/widget-events.ts` |
| The component | `src/components/connect/ConnectWidget.tsx` |
| Route | `src/pages/console/ConnectTransaction.tsx` |
| Dialog host (camera, editor, file view, raise issue) | `src/components/connect/DialogHost.tsx` |
| Print header/footer + `printPage()` | `src/components/connect/PrintReceipt.tsx`, `src/lib/print.ts` |
| Issue-list shaping + `raise_issue_after` gate | `src/lib/connect/support.ts` |
| Ticket assembly (server-side) | `packages/eps-backend/src/http/support-ticket.ts` |

### Backend

`/connect/*` is mounted **only when `CONNECT_API_BASE_URL` is set**, so under the
`eko` auth provider the token-bearing routes do not exist at all.

- `GET /connect/token` → `{ accessTokenLite, accessTokenCrm, expiresAt }`,
  `Cache-Control: no-store`, rate-limited per `sid`.
  - `401 NO_SESSION` · `403 NOT_DEVELOPER_SESSION` · `501 CONNECT_UNAVAILABLE`
    (no `sid`, i.e. the `eko` provider) · `401 CONNECT_SESSION_EXPIRED` (sealed
    session gone) · `502 CONNECT_TOKEN_MISSING` (upstream minted no lite token).
- `GET /connect/ekostore-token` → `{ accessToken, expiresAt }`, `no-store`,
  rate-limited per `sid` at 10/window. The **only** route that publishes the full
  access token — see "ekostore handoff" below.
  - Same session errors as `/connect/token`, plus `403 EKOSTORE_NOT_ENTITLED`
    when interaction `9995` is absent from the caller's upstream list.
- `GET /connect/interactions` → `{ interactions }`. Proxied rather than called
  from the browser **because it needs the full token**.
- `POST /connect/support/query-types` → `{ issueTypes }` (interaction 10022).
  `is_admin` is pinned to `0`; it widens the list to internal-only issue types.
- `POST /connect/support/ticket` (multipart) → `{ feedbackTicketId, message }`
  (interaction 10000, via `/transactions/upload` when there are attachments and
  `/transactions/do` otherwise).

  The Zoho-Desk formatting lives **server-side**: the browser posts a `payload`
  JSON part with the user's answers plus what only it knows (user-agent, screen,
  device time, URL) and its attachments; the description, comment HTML and
  `technical_notes` are assembled from that and the session. So the console never
  learns the ticket schema, and cannot claim to be a different user. Eloka read
  that context from `sessionStorage.org_detail` / `user_details` — deliberately
  not replicated.

  Caps at the trust boundary: 6 attachments, 5 MB each, 20 input fields, 4000
  characters of free text. The size cap is also applied in the browser —
  `TICKET_MAX_FILE_BYTES` mirrors the backend's `MAX_FILE_BYTES` into
  `FileUpload`'s `maxBytes`, so an oversized attachment is refused at the picker
  instead of after a full upload. The browser check is a courtesy; the backend's
  is the one that counts.

### Frontend ordering

Tokens are written *before* the runtime loads. The widget starts calling
connect-api the moment it upgrades, and a request that beats the token into
storage goes out as `Bearer null`.

`iron-signal` events are mapped in `widget-events.ts`:

| Event | Effect |
| --- | --- |
| `update-status` | `resetWalletBalanceCache()` — the flow moved the balance |
| `login-again` | `POST /auth/refresh` (re-seals upstream) then republish the lite token |
| `goto-transaction` / `goto-history` | in-app navigation |
| `open-url` | internal route, or `window.open(…, "noopener,noreferrer")` |
| `file-view` | `showFile(…)`, or the image editor when `userConfirmation` |
| `request-camera-capture` | `openCamera(…)` → `cameraResponse(dataUrl)` |
| `feedback-dialog-event` | `showRaiseIssue(…)` → `feedbackResponse(…)` |

### Reply contracts

Three replies, three shapes — the easiest thing to get wrong here:

| Reply | Argument |
| --- | --- |
| `fileViewResponse(result)` | the editor's whole result, `{ image, file?, accepted }` |
| `cameraResponse(image)` | a **bare** data-URL string |
| `feedbackResponse(result)` | `{ feedback_ticket_id, to_and_fro_data }` — `to_and_fro_data` is the caller's `context`, echoed back untouched |

All four dialogs resolve `{}` when simply dismissed, so every caller guards on
the field it needs rather than the object.

## Configuration

Backend and frontend must point at the **same environment** — the widget's API
host is compiled into its bundle and is never told where to call.

```
# eps-backend
CONNECT_API_BASE_URL=https://api.beta.ekoconnect.in

# frontend
VITE_CONNECT_WIDGET_URL=https://beta.ekoconnect.in
VITE_SHOW_CONNECT_WIDGET=true
```

## Blockers

1. **connect-api CORS must allowlist the console origin.** Every widget request
   is a cross-origin browser call from `eko.in` to `api.beta.ekoconnect.in`.
   Eloka works because *its* origin is allowlisted. **Unverified** — this needs a
   change on connect-api and cannot be fixed from this repo. Until then the flag
   stays false.
2. ~~CSP~~ — not an issue: this repo sets no Content-Security-Policy
   (`vercel.json` carries only cache and content-type headers).

## Dialogs

`ConnectDialogProvider` (mounted in `ConsoleLayout`) replaces Eloka's 571-line
pub/sub `DynamicPopupModuleLoader`: a context over a Radix dialog stack, where
each entry owns the promise its opener awaits. The pub/sub indirection there
exists only because that loader is mounted in a Next.js layout that cannot see
its callers.

Every dialog is `React.lazy`-loaded — react-image-crop, react-webcam and
MediaPipe are not in the console's initial bundle.

| Dialog | Notes |
| --- | --- |
| File view | Native `<img>`/`<video>`/`<audio>`/`<iframe>`, no react-player. Non-`http(s)`/`data`/`blob` URLs are refused: `javascript:` in an iframe `src` would run in the origin holding the widget's tokens. |
| Camera | `react-webcam` + Eloka's device classification (label regex → facing mode → mirror). Capture pauses the preview and stacks the editor; rejecting there resumes it rather than closing the camera. |
| Image editor | `react-image-crop` with its own stylesheet. Rotation is 90°-only. Face detection loads MediaPipe dynamically behind a 3s timeout, and `minFaceCount` is enforced **only when detection completed** — otherwise a slow WASM load would lock the user out. |
| Raise issue | Category → sub-category → issue type, then whatever that issue type asks for. Screenshot capture uses `getDisplayMedia({ preferCurrentTab, monitorTypeSurfaces: "exclude" })` and hides the dialog while the shot is taken; `autoCaptureScreenshot` starts it once, unprompted. Attachment fields are `<FileUpload>`. |

### `<FileUpload>`

`src/components/FileUpload.tsx` is the general-purpose upload control — Eloka's
`Dropzone`, and the reason those three dialogs are worth having. Every image,
whether picked, dropped or captured, goes through the editor before the caller
sees it, so a form receives a cropped, rotated, size-capped JPEG instead of a
4 MB photo of a desk.

```tsx
<FileUpload
	label="Shop photo"
	accept="image/*"
	file={photo}
	onFileChange={setPhoto}
	options={{ aspectRatio: 1, maxLength: 1200, detectFace: true }}
/>
```

`accept` decides which sources appear (no camera for a PDF-only field, "Select
photo" rather than "Select file" when images are all that is allowed);
`cameraOnly` drops the picker and the drop zone; `options.disableImageConfirm`
takes the capture as-is. It needs a `ConnectDialogProvider` above it.

**Watermark.** `watermark` carries provenance into the pixels, because a KYC
photo is evidence and evidence without provenance can be re-used for a different
customer on a different day.

| Value | Stamped |
| --- | --- |
| `true` | user name + code, org, position + IP, timestamp + host |
| `{ location: "Branch 12" }` | those defaults, with named keys replaced and unknown ones appended |
| `"Any text"` | verbatim |
| omitted / `false` | nothing — and neither the location prompt nor the IP call happens |

The position comes from `useGeolocation` and the IP from `GET /me/ip`, which
reads `x-real-ip`/`x-forwarded-for` server-side: coordinates can be spoofed on a
rooted phone, while an observed IP cannot, so the line carries both. The text is
resolved on mount rather than at capture time — a prompt answered after the
shutter would stamp a blank location.

Dropping a file from the file system attaches it directly; dropping an image
dragged from another tab re-fetches it by URL, which cross-origin hosts without
CORS refuse — hence a fallback, not the main path. Eloka's watermark builder
(user, org, IP, GPS fix) is not ported: no org context and no IP endpoint here,
so callers pass the `watermark` text they want.

The face model is committed at `public/wasm/mediapipe-models/`; the WASM runtime
comes from `cdn.jsdelivr.net`.

## Printing

`PrintReceipt` wraps the widget with a `@media print` header and footer, the
widget's own print button is enabled (`enable-print`), and site chrome — header,
footer, console rail and title — is `print:hidden`. `printPage(title)` swaps
`document.title` so the saved PDF is named after the receipt; the Transactions
page uses it, and prints only the expanded row.

## Not built

Deliberately skipped from Eloka's wrapper: KBar/command-bar actions and the
Android PubSub bridge (no counterpart here), the MediaPipe text classifier that
scored comment sentiment, `customIssueType` (it existed for the command-bar entry
point), and the screenshot-editing branch, which was already dead behind
`DISABLE_EDIT`. Of the 612-line Dropzone, `<FileUpload>` keeps the image →
editor round trip, camera capture, drag and drop, preview and discard, but not
the IP lookup or the watermark builder.
There is no "Raise issue" entry point on the transaction-history rows yet — the
dialog is reached from a flow.

Two Eloka bugs are **not** ported: `transaction_time` vs `transactionTime`
(`RaiseIssueCard.tsx:61` vs `HistoryCard.jsx:258`, which silently killed the
`raise_issue_after` gate — this dialog accepts both spellings), and the inverted
multipart guard at `apiHelper.js:207`, where body fields never reached FormData.

## Gotcha: `id` vs `interaction_type_id`

`/connect/interactions` rows carry **both**, and they are different things.

```json
{ "id": 491, "interaction_type_id": 0, "behavior": 7, "label": "Load E-value" }
```

`id` is the interaction id — what routes use, and what `group_interaction_ids`
references. `interaction_type_id` is the *type*, and is `0` for every composite
interaction (491, 240, 536, 7775 …). `role_trxn_list` must be keyed by `id`;
keying by the type collapses every composite onto `"0"` and the entitlement
lookup finds nothing.

Rows are passed through whole rather than narrowed to a modelled subset. The
widget reads more than a label from them — `behavior`, `group_interaction_ids`,
`icon`, `uri` — and Load E-value (491) is `behavior: 7`, a grid whose children
come from `group_interaction_ids`, so a trimmed row renders an empty grid.

Entitlement is *presence* in the list, not `is_visible`: both 491 and 240 arrive
with `is_visible: "0"`, exactly as Eloka sees them.

## Gotcha: React 19 sets properties, not attributes

Do **not** pass the widget's inputs through JSX, and do not `JSON.stringify` them.

React 19 assigns *properties* on an upgraded custom element where older React set
attributes. Polymer only JSON-parses values that arrive as **attributes**, so a
stringified object lands on the property as a raw string and the widget throws:

```
TypeError: Cannot use 'in' operator to search for '491' in {"22":{...},"24":{...}}
```

…from its own `interaction_id in role_trxn_list`. Eloka stringifies safely only
because it runs an older React.

`syncWidgetProps` in `ConnectWidget.tsx` therefore assigns real objects as DOM
properties through a ref, with `interaction_id` set **last** — it is the observed
property that starts the flow, so everything else must already be in place.

## Verifying

```bash
npm run backend:test -- src/http/connect.test.ts
npx vitest run src/lib/connect src/hooks/use-app-link.test.ts \
  src/components/console/WalletBalance.connect.test.tsx
```

The dialogs are hard to reach through a flow (entitled UAT account, widget
loaded, right transaction), so `npm run dev` mounts a bench at
**`/console/test`** — last item in the console rail — that opens each one
directly — plus `<FileUpload>` with every switch it exposes — with the options a
flow would send, and shows what it resolved with.
Both the route and the rail item sit behind `import.meta.env.DEV`, with the
`import()` inside the guard so no chunk is emitted in a production build.

jsdom cannot load an HTML import, so the widget itself is only testable in a real
browser: sign in to `/console` on a UAT mobile, confirm the `＋`, open the flow,
and check DevTools for a `Bearer` header with **no CORS error**. Complete a UAT
load and the E-value card should update without a manual refresh.
