# "Test Request" dialog & request signing

Each endpoint page has a **Test Request** button (API mode of the right rail) that
opens a custom dialog scoped to that operation. The form is generated from the
`ApiSpec`, the request is **signed locally with Web Crypto at the moment Send is
pressed**, and it is sent through eps-backend's `POST /tryit/proxy` (same-origin
`/api` on Vercel) because the Eko API hosts send no CORS headers. The raw
`access_key` never leaves the browser — only the derived `secret-key` does.

This replaced the `@scalar/api-client` modal (Sept 2026): heavy Vue dependency,
brittle DOM overrides, cluttered UI, unlabeled UAT/prod picker, and every request
transiting Scalar's hosted proxy. Design spec:
`docs/superpowers/specs/2026-09-08-tryit-widget-design.md`.

## Components

| File | Role |
|---|---|
| `src/components/docs/CodeSamples.tsx` | Renders the **Test Request** button (API mode); calls `onTest()`. |
| `src/components/docs/useTryIt.ts` | `useTryIt(spec)` → `{ onTest, dialog }`. Dynamically imports the dialog on first click (own async chunk, never in SSR/prerender); `?try=1` opens it on load. |
| `src/components/docs/tryit/TryItDialog.tsx` | Radix dialog shell: breadcrumb (product › API), method tag, live URL, environment toggle, Send, production banner, ⌘/Ctrl+Enter. |
| `src/components/docs/tryit/RequestPane.tsx` | Auth (collapsed), URL params (only when the spec has any), body as Form ↔ Raw JSON, live code snippets (collapsed). |
| `src/components/docs/tryit/ParamField.tsx` | One input per `ResolvedApiParam`: enum → select, file → file input, number, boolean, object/array → JSON textarea, else text. |
| `src/components/docs/tryit/ResponsePane.tsx` | HTTP status / ms / bytes, Eko verdict badge, callouts, request/response headers on demand, body Preview/Raw, copy + download. |
| `src/components/docs/tryit/useTryItState.ts` | Reducer + sessionStorage persistence + `send()` / `abort()`. |
| `src/components/docs/tryit/useDocsDark.ts` | Mirrors the docs `docs-dark` flag on `<html>` (the dialog renders in a portal, outside the `.dark` subtree). |
| `src/lib/docs/tryit-request.ts` | Pure pipeline: validate → sign → build body → `sendViaProxy` → classify. |
| `src/lib/docs/eko-signing.ts` | Web Crypto HMAC-SHA256 (`buildSignedHeaders`). |
| `src/lib/docs/code-samples.ts` | `sampleFor` / `sdkSampleFor` with `SampleOverrides` so snippets reflect edited values. |
| `packages/eps-backend/src/http/tryitProxy.ts` | The CORS proxy (see its README section). |

Styling is entirely the docs `--rp-*` tokens (`code-samples.css`), so the dialog is
warm Parchment in light mode and navy in dark mode.

## Environments

- **UAT / Sandbox** (default) — prefilled with the public demo keypair from
  `uatCredentials()` (`VITE_EPS_UAT_*`, deliberately inlined in production builds;
  see `src/lib/uat-credentials.ts`).
- **Production** — switching clears the credentials (the demo keys are never sent
  to prod), shows a red banner, and for `spec.financial` endpoints Send needs a
  second click ("Confirm production send"). Any edit disarms it.

Both base URLs come from `API_ENVIRONMENTS` (`src/lib/data/api-auth.ts`).

## Credentials & signing

- Keys live in component state only — never localStorage/sessionStorage.
- On Send: `buildSignedHeaders(creds, Date.now())` computes
  `secret-key = base64(HMAC-SHA256(timestamp, base64(access_key)))` with a fresh
  timestamp, so a dialog left open for an hour still signs correctly.
- `developer_key` travels to the proxy as **`x-eps-developer-key`** because nginx
  drops headers containing underscores by default (`underscores_in_headers off`);
  the proxy renames it back before forwarding upstream.
- Code snippets always show `<your_developer_key>` / `<computed_secret_key>`
  placeholders, never real keys.

## Request body

- The spec's `resolveRequestParams()` drives the form; `buildSampleRequest()`
  prefills it. Content type is derived (`resolveContentType`) and shown as a
  read-only chip — JSON, or `multipart/form-data` for specs with `type: "file"`
  params (non-file fields ride in the single `form-data` JSON part, each upload is
  its own part, exactly like the SDKs).
- Form and Raw JSON edit the same `body`; the raw textarea keeps its draft while
  typing (no reformat / cursor jump). Invalid JSON blocks Send and shows the parse
  error; switching back to Form discards the invalid draft.
- `client_ref_id` is regenerated per send (15 base-36 chars, time-prefixed) while
  "auto-generate per send" is on.
- Validation before signing: required, enum, min/max, UTF-8 `maxLength`, named
  `format` patterns (`api-formats.ts`), file `max` bytes.

## Response classification

- HTTP status coloured via `codeColor`, plus timing and body size.
- **Eko badge**: `status === 0` → success, any other number → failure, non-envelope
  body (HTML, empty) → unknown. Financial specs also show the `tx_status` meaning.
- `responseTypeFor(spec, json)` annotates a documented `response_type_id`;
  `matchErrorScenario` links a documented error scenario.
- **UAT callout** whenever a sandbox call fails (HTTP error or Eko failure): UAT may
  break due to changes at the provider's own sandbox; we are working with them.
- A financial send that was dispatched but got no answer (timeout, proxy 502/504,
  cancel) shows **Outcome unknown** with the `client_ref_id` that was sent.
- Proxy-level errors (rate limit, size cap, target rejected, `/api` not routed) are
  recognised by the absence of `x-eps-proxied: 1` and shown as an error message,
  not as a response.

## Persistence

`sessionStorage["eko-tryit:<spec.id>"]` = `{ env, params, body, rawMode, autoRef }`,
written on change, restored on open. Credentials, uploads, results and the raw draft
are never written, and any body key named `developer_key` / `access_key` /
`secret-key` / `secret-key-timestamp` is redacted before writing. A restored
production session starts with empty credentials. The header's ↺ button ("Clear
saved request") deletes the entry and resets to the documented example. Typed
values such as PAN/Aadhaar numbers do persist for the tab's lifetime — hence the
button.

## Proxy

`TRYIT_PROXY_URL = VITE_TRYIT_PROXY_URL ?? "<VITE_EPS_BACKEND_URL ?? /api>/tryit/proxy"`.
The dialog POSTs with `x-eps-target-url`, `x-eps-target-method` and the signed
headers; the proxy allowlists the two Eko base URLs, forwards only the auth headers,
never follows redirects, caps bodies at 4 MiB and rate-limits per IP. Full contract
in `packages/eps-backend/README.md`; nginx needs `location = /tryit/proxy {
client_max_body_size 4m; }` (see `eps-backend-vm-deploy.md`).

## Security framing (honest)

- `access_key` never leaves the browser (HMAC input only).
- `developer_key`, the one-time `secret-key`, the URL, body and response transit
  **our own** eps-backend, not a third party. That holds for production too.
- The proxy cannot be used as an open relay: HTTPS-only, exact-origin + path-prefix
  allowlist, userinfo/port rejected, redirects refused.

## SSG safety

`DocDetailPage` is prerendered by `AppServer.tsx`. Only `useTryIt` is in the page
module graph; the dialog is reached through `import("./tryit/TryItDialog")` inside a
click/mount callback, so the build emits `TryItDialog-*.js` as a separate async chunk
and prerendered HTML contains none of its markup.
