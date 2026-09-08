# Custom "Test Request" widget (replace Scalar) + eps-backend try-it proxy

## Context

Docs endpoint pages open a `@scalar/api-client` modal for "Test Request". Problems: heavy dep (Vue app + CSS, brittle DOM hacks in `tryit-client.ts`), cluttered UI (auth always open, empty Query Params, left-nav of every endpoint, 8 content-types), unlabeled UAT/prod server picker, and traffic (developer_key + signed headers + bodies) transits Scalar's hosted proxy. The original reason for Scalar — free CORS proxy — is gone now that eps-backend exists and `/api/*` already routes to it on Vercel (`vercel.json` `routes`, first-party).

Outcome: small React modal styled with the docs `--rp-*` tokens, spec-driven form, sign-at-send in-browser HMAC, same-origin proxy in eps-backend, live code snippets (raw + SDK), Scalar removed.

Decisions locked with user: proxy in eps-backend now; UAT default + prod behind toggle w/ warning; spec-driven form + Raw JSON toggle; keys never persisted; wide 2-pane Radix dialog; snippets reflect edited values (auth stays placeholders); Scalar removed same PR; extras = Eko-status badge + response_type meaning + errorScenario match, auto `client_ref_id`, sessionStorage per spec (no keys), Cmd/Ctrl+Enter + `?try=1`, UAT-failure callout.

Codex review (session `01a07ed0-…`) done; 16 findings folded below (marked ◆).

## Reuse (do not rewrite)

- `src/lib/docs/eko-signing.ts` — `buildSignedHeaders(creds, now)` / `computeSecretKey`. Sign at Send only.
- `src/lib/data/api-specs-common.ts` — `resolveRequestParams`, `buildSampleRequest`, `isMultipart`, `resolveContentType`, `resolveHeaders`, `MULTIPART_JSON_FIELD`, `splitMultipartBody`, `multipartPayloadFrom`, `responseTypeFor`, `ApiErrorScenario`, `FINANCIAL_RESPONSE_ENVELOPE` (tx_status meanings).
- `src/lib/data/api-auth.ts` — `API_ENVIRONMENTS` (labels "UAT / Sandbox" / "Production").
- `src/lib/uat-credentials.ts` — `uatCredentials()` public demo keypair (UAT prefill only; may return null).
- `src/lib/docs/code-samples.ts` — `sampleFor`, `sdkSampleFor`, `resolveEndpointUrl` (already takes param overrides), `shellQuote`, `SAMPLE_LANGS`, `SDK_LANGS`.
- `src/components/docs/code-ui.tsx` — `NumberedCode`, `CopyButton`, `TabButton`; `code-samples.css` `--rp-*` tokens; `prism-rp-theme.ts` `prismLangFor`.
- `src/components/docs/HttpMethodTag.tsx`; `ResponseAccordion.tsx` `codeColor` (export it).
- `src/components/ui/dialog.tsx`; `src/lib/docs/use-docs-mode.ts` storage pattern; `DocsLayout.tsx` toggles `docs-dark` on `<html>` (in an effect after localStorage read).
- `src/lib/data/api-products.ts` `API_PRODUCTS_MAP[spec.productId].name` for breadcrumb.
- Backend: `packages/eps-backend/src/http/rateLimit.ts` `enforceRateLimit` + `RL_WINDOW_SEC` (=600 s), `errors.ts` `AppError`, `activationFee.ts` `fetchImpl` seam pattern, `contextMcp.test.ts` standalone-Hono harness, `app.test.ts` `createApp` harness, `store/kv.ts` `createInMemoryKV`.

## A. Backend: `POST /tryit/proxy` (packages/eps-backend)

**New** `src/http/tryitProxy.ts` — `mountTryItProxy(app, { kv, fetchImpl?, timeoutMs? })`, `resolveTryItTarget(raw): URL`, `readBodyCapped(stream, cap): Promise<Uint8Array>`, constants `TRYIT_ALLOWED_BASES`, `TRYIT_IP_LIMIT = 300` (per `RL_WINDOW_SEC` = 10 min), `TRYIT_MAX_BODY_BYTES = 4 MiB` ◆(3 × 1 MB files + envelope).

Contract:
- Always `POST` to proxy. Headers: `x-eps-target-url` (absolute URL incl. query), `x-eps-target-method` (`GET|POST|PUT|DELETE`, default POST), `x-eps-developer-key` ◆(nginx `underscores_in_headers off` drops `developer_key`; proxy maps it to `developer_key` upstream).
- Order: rate-limit → validate target/method → read body (capped) → fetch. ◆
- Target validation ◆: `new URL(raw)` once; reject unless `protocol === "https:"`, `username === "" && password === ""`, `port === ""`, `url.origin` exactly equals an allowed origin, and `url.pathname === base.pathname || url.pathname.startsWith(base.pathname + "/")` (WHATWG URL already normalises dot-segments, backslashes, case). Fetch `url.href` (the validated object). Bases: `https://staging.eko.in/ekoapi/v3`, `https://api.eko.in/ekoicici/v3` (hardcoded; `// ponytail: constant, env override when 3rd env appears`). Errors 400 `INVALID_TARGET` / `INVALID_METHOD`.
- Forward ONLY: `developer_key` (from `x-eps-developer-key`), `secret-key`, `secret-key-timestamp`, `content-type`, `accept`. Cookies/session/origin/`x-eps-*` dropped by construction (site session cookie arrives same-origin — never forwarded; no auth middleware treats this route as authenticated).
- Body ◆: none for GET/DELETE. Else reject `content-length > cap` (413 `PAYLOAD_TOO_LARGE`) before reading; then `readBodyCapped(c.req.raw.body, cap)` — reader loop counting bytes, cancel stream + 413 the moment cap is exceeded (no unbounded `arrayBuffer()`). Forward raw bytes (multipart boundary preserved). Never log body.
- Rate limit: `enforceRateLimit(kv, "rl:tryit:ip:<x-real-ip|unknown>", TRYIT_IP_LIMIT, RL_WINDOW_SEC)`. ◆Known limit: behind Vercel→nginx, `X-Real-IP` = Vercel edge IP (nginx overwrites with `$remote_addr`), so the bucket is per-edge, not per-visitor — same caveat as existing OTP routes; generous limit compensates. Documented in README; per-visitor keying is a deploy-chain change out of scope.
- Upstream fetch: `redirect: "manual"` ◆ — any 3xx from upstream → 502 `UPSTREAM_REDIRECT`, `Location` never followed/forwarded. `AbortSignal.timeout(timeoutMs ?? 30_000)` → `TimeoutError` → 504 `UPSTREAM_TIMEOUT` ◆; other throw → 502 `UPSTREAM_UNREACHABLE`.
- Response: upstream status verbatim; body streamed through (`upstream.body`); copy upstream headers `content-type`, `content-length`, `date`, `retry-after` only ◆; add `cache-control: no-store`, `x-eps-proxied: 1`, `x-eps-upstream-ms`. No `set-cookie`.
- No new config/env. Same-origin via Vercel `/api` route → CORS: add `x-eps-proxied`, `x-eps-upstream-ms` to `corsSite.exposeHeaders` (absolute-origin deploy mode).

**Modify** `src/http/app.ts`: `mountTryItProxy(app, { kv })` beside other mounts; exposeHeaders. **Modify** `packages/eps-backend/README.md` (route section) and `packages/eps-backend/docs/eps-backend-vm-deploy.md` nginx block ◆: add `location = /tryit/proxy { client_max_body_size 4m; include …proxy.inc; }` (default vhost cap is 1m).

**Tests** `src/http/tryitProxy.test.ts` (standalone Hono, in-memory KV, `vi.fn()` fetch): invalid targets ◆(missing, `http:`, `staging.eko.in.evil.com`, `staging.eko.in@evil.com`, `user:pass@staging.eko.in`, `:8443`, `STAGING.EKO.IN` accepted after normalisation, `/ekoapi/v3/../../x` → rejected after normalisation, `/ekoapi/v3x`, wrong path prefix, other host, backslash variants); both bases accepted; PATCH rejected; header allowlist (cookie/authorization/origin/x-eps-* stripped; `x-eps-developer-key` → `developer_key`; 3 other auth headers kept); multipart bytes + boundary byte-identical; GET forwards no body; 413 via content-length and via oversized chunked stream with no upstream call; redirect 302 → 502 and no second fetch ◆; passthrough of upstream 403 JSON + `x-eps-proxied` + `no-store` + `retry-after`, no `set-cookie`; 504 on `TimeoutError`, 502 otherwise; 301st call/IP → 429; rate limit hit before body read ◆.
**Integration** in `app.test.ts` via `createApp` ◆: session cookie present on request is not forwarded; error envelope shape for 400; `no-store` present.

## B. Website widget — `src/components/docs/tryit/`

| File | Responsibility |
|---|---|
| `TryItDialog.tsx` (default export, lazy chunk) | Radix `Dialog`; `DialogContent className="docs-rightpane [dark] w-[min(96vw,80rem)] h-[90vh] max-w-none p-0 flex flex-col"`; `dark` from `useDocsDark()` ◆ (tiny hook: `useSyncExternalStore` over `MutationObserver` on `<html class>` for `docs-dark` — robust to `?try=1` opening before theme restore). sr-only `DialogTitle`. Header: breadcrumb `Product › spec.name`, `HttpMethodTag`, read-only live URL, env segmented control (`TabButton` ×2, labels from `API_ENVIRONMENTS`), Send, "Clear saved request" ◆. Prod = red banner "Real production call — your own keys required". Grid `lg:grid-cols-2`, stacked below. Ctrl/Cmd+Enter → same `send()` path ◆. Owns `useTryItState`. Imports `code-samples.css`. |
| `RequestPane.tsx` | `<details>` **Auth** (collapsed): developer_key text, access_key password + eye, note "signed in your browser at send time; access_key never leaves it". **Params** section only if any `in: path\|query`; for GET the `client_ref_id` auto-generate checkbox lives here ◆. **Body** only if method ≠ GET and body params exist: read-only content-type chip (`resolveContentType`), Form / Raw tabs; Form = `ParamField` per body param (+ auto-ref checkbox on `client_ref_id` row); Raw = `<textarea>` + parse error. `<details>` **Code snippet** (collapsed): tab row 1 `SAMPLE_LANGS`, row 2 `SDK_LANGS` (label "EPS SDK"), `NumberedCode`, `CopyButton`. |
| `ParamField.tsx` | One labelled input from `ResolvedApiParam`: `enum`→`<select>`; `type:"file"`→`<input type=file>` (+ per-file size check from `param.max` bytes when set ◆); number/integer→`type=number min max` (empty ⇒ key omitted, never 0 ◆); boolean→checkbox ◆; `object`/`array`→small JSON textarea, parsed on blur, typed value kept ◆ (needed by `activate-aeps-fingpay` nested address objects); else text. `maxLength` validated as UTF-8 bytes via `TextEncoder`, NOT HTML `maxlength` ◆. Required mark, description, inline error. |
| `ResponsePane.tsx` | States: empty / sending (abort btn) / client-error / done. Summary: HTTP status via `codeColor`, `ms`, bytes, Eko badge (`ekoOutcome`: `success` / `failure` / `unknown` ◆; financial specs additionally show `tx_status` meaning from `FINANCIAL_RESPONSE_ENVELOPE` ◆) + `responseTypeFor` meaning (only when payload is a plain object ◆). UAT-failure callout when `env==="sandbox" && (!ok \|\| outcome==="failure")`: "UAT tests may fail due to changes at the API provider's own sandbox; we are working with them to fix UAT." Matched `errorScenarios` note. Interrupted financial send ◆ → "Outcome unknown — check transaction status with client_ref_id <x> before retrying" (ref retained). `<details>` Request headers (+ target URL; `secret-key` masked). `<details>` "Response headers (upstream: content-type/length/date/retry-after + proxy timing)" ◆ honest label. Body Preview (`NumberedCode` json) / Raw; `CopyButton` + Download (Blob of original bytes ◆, `<a download>`). |
| `useTryItState.ts` | `useReducer` + lazy init + sessionStorage persistence + `send()`/`abort()` w/ `AbortController` (35 s), in-flight `useRef` guard, send-id to drop stale results ◆, abort on close/unmount ◆. |
| `useDocsDark.ts` | 15-line hook described above. |
| `src/lib/docs/tryit-request.ts` | Pure, DOM-free: `TRYIT_PROXY_URL`, `generateClientRefId(nowMs)` (15 chars base36, `crypto.getRandomValues`), `coerceValue`, `validateParams`, `buildTryItRequest`, `sendViaProxy`, `matchErrorScenario`, `ekoOutcome`, `parseProxyError` ◆. |

Modified:
- `useTryIt.ts` → `useTryIt(spec?: ApiSpec): { onTest?: () => void; dialog: ReactNode }`. Click: `setOpen(true)` + one-time manual `import("./tryit/TryItDialog")` (no `React.lazy`; SSR/prerender untouched); import failure resets promise so next click retries ◆. Mount effect: `?try=1` → `onTest()` once per spec change ◆. `onTest` undefined when no spec (button stays disabled). Dialog keyed by `spec.id` so spec change remounts state ◆.
- `CodeSamples.tsx`: `onTest?: () => void`; `onClick={onTest}`; fix Scalar comments.
- `DocDetailPage.tsx`: `const { onTest, dialog } = useTryIt(node?.spec)` before early returns; render `{dialog}` after `</DocsLayout>`.
- `ResponseAccordion.tsx`: `export const codeColor`.

`TRYIT_PROXY_URL = import.meta.env.VITE_TRYIT_PROXY_URL ?? \`${import.meta.env.VITE_EPS_BACKEND_URL ?? "/api"}/tryit/proxy\`` (don't import `auth/client.ts` into docs chunk).

Styling: all `--rp-*` (`bg-[var(--rp-bg)]`, cards `--rp-card`, inputs `--rp-code`/`--rp-line`, accent `--rp-acc`), method tag `variant="soft"`.

## C. State + send pipeline

```ts
interface TryItState {
	env: "sandbox" | "production";
	creds: { developerKey: string; accessKey: string };   // memory only
	params: Record<string, string>;                        // path+query
	body: Record<string, unknown>;                         // AUTHORITATIVE non-file body (typed values)
	files: Record<string, File | null>;                    // never persisted
	rawDraft: string | null;                               // textarea text while rawMode; null = mirrors body ◆
	rawMode: boolean; rawError: string | null;
	autoRef: boolean; fieldErrors: Record<string, string>;
	armed: boolean;                                        // prod+financial confirm ◆
	status: "idle" | "sending" | "done";
	result: TryItResult | null; error: string | null;
	lastSentRef: string | null;                            // for "outcome unknown" ◆
}
interface TryItResult { httpStatus; ok; ms; bytes; requestUrl; requestHeaders; responseHeaders; bodyBytes: ArrayBuffer; bodyText; json: Record<string, unknown> | null }
```
Reducer ◆:
- Single body source of truth: `body`. Raw textarea shows `rawDraft ?? JSON.stringify(body, null, 2)`. `setRaw(text)` → `rawDraft = text`; parse → plain object (not null/array) ⇒ `body = parsed, rawDraft = null, rawError = null`; else `rawError` (body unchanged). Leaving Raw with `rawError` keeps the draft, blocks Send, shows error; form shows last valid `body`.
- Form edits always write typed values into `body` (empty optional ⇒ delete key).
- `setEnv` / any edit / `setAutoRef` → `armed = false`, `result` kept except env change clears it.
- Init ◆: restore `sessionStorage["eko-tryit:"+spec.id]` = `{env, params, body, rawMode, autoRef}` (validated: env in set, body plain object) over defaults (`body = multipartPayloadFrom(buildSampleRequest(spec), fileNames)`, `params` from examples). THEN derive creds from the *final* env: production ⇒ empty; sandbox ⇒ `uatCredentials() ?? empty`. Persist effect writes the same five fields; creds/files/result/rawDraft never. "Clear saved request" removes key + resets to defaults.

`send()` (one path for button + Ctrl/Cmd+Enter) ◆:
1. Sync in-flight ref guard. Bail with `sendFail` if `rawError`, or prod with blank cred ("Enter your production keys").
2. Prod + `spec.financial` + `!armed` ⇒ `armed = true`, button relabels "Confirm production send", return. Confirmation consumed on the next call.
3. Build immutable snapshot: copy `body`/`params`; if `autoRef` and resolved param `client_ref_id` exists ⇒ `generateClientRefId(Date.now())` into body (or params for GET). Dispatch `sendStart(snapshot)` so form + raw + snippets show what was sent; `lastSentRef` stored.
4. `validateParams(snapshot)` → `fieldErrors` → `sendFail`.
5. `buildTryItRequest`: `url = resolveEndpointUrl(spec, params, API_ENVIRONMENTS[env].baseUrl)` (path values `encodeURIComponent`-ed ◆); `signed = await buildSignedHeaders(creds, Date.now())`; headers sent to proxy = `{ "x-eps-developer-key": signed.developer_key, "secret-key", "secret-key-timestamp", "content-type"?, "x-eps-target-url", "x-eps-target-method" }`; multipart ⇒ drop `content-type`, `FormData` with `MULTIPART_JSON_FIELD` = JSON of `multipartPayloadFrom(body, fileNames)` + each `File`; JSON ⇒ stringify; GET/DELETE ⇒ no body. `access_key` never in headers.
6. `sendViaProxy`: `performance.now()` around `fetch(TRYIT_PROXY_URL, …)`; read `arrayBuffer()` (bytes = byteLength, text = decode, json = tryParse plain object). If `x-eps-proxied !== "1"` ⇒ `parseProxyError` ◆: JSON envelope `error.code/message` → that message (e.g. `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `UPSTREAM_TIMEOUT`); HTML/other → "Try-it proxy unavailable (HTTP n) — is /api routed to eps-backend?". Goes to `error`, not response pane.
7. Abort classification ◆ by `signal.reason?.name`: `TimeoutError` → "Request timed out"; `AbortError` → "Cancelled"; financial + already dispatched ⇒ "Outcome unknown" message with `lastSentRef`. Stale results (send-id mismatch) dropped.
8. Classification at render: `ekoOutcome(json)`: no plain object or non-numeric `status` ⇒ `unknown`; `0` ⇒ `success`; else `failure`. Financial: also read `tx_status` (0 success, 1 fail, 2 awaited, 3 refund pending, 4 refunded, 5 on hold) for badge text. `matchErrorScenario`: by `response_type_id`, else `(status, response_status_id)` pair, only when both documented.

## D. `code-samples.ts` overrides (backwards compatible) ◆ escaping

```ts
export interface SampleOverrides {
	baseUrl?: string; environment?: "sandbox" | "production";
	params?: Record<string, unknown>; body?: Record<string, unknown>;
}
```
- `resolveEndpointUrl(spec, overrides?, baseUrl = DEFAULT_BASE_URL)`; path values now `encodeURIComponent` (query already encoded).
- Internal `sampleBody(spec, o) => o?.body ?? buildSampleRequest(spec)`; `hasBody(spec,o)`; replace `buildSampleRequest(spec)` / `buildMultipartPayload(spec)` calls accordingly.
- Safe interpolation ◆: curl `--url` and `--data` go through existing `shellQuote`; JS/PHP embed URL/body via `JSON.stringify`; Python via `json.dumps`-equivalent (escape `\` `'` newlines) — apply to existing generators, not only override path (fixes latent bug for examples with quotes).
- `toCurl/toJsFetch/toPython/toPhp(spec, o?)`, `sampleFor(spec, lang, o?)`; SDK `to*Sdk(spec, o?)` use `o?.environment ?? "sandbox"`, include ALL override keys present (not required-only filter) ◆; `sdkSampleFor(spec, lang, o?)`.
- `HEADER_PLACEHOLDER` untouched → auth always placeholders. Files stay `filePlaceholder`.
- Widget passes `{ baseUrl, environment: env, params, body }` from the last sent snapshot (or current state before first send).

## E. Scalar removal

Delete: `src/lib/docs/tryit-client.ts`, `eko-signing-plugin.ts` (+ `.test.ts`), `tryit-overrides.css`, `tryit-proxy.ts` (+ test if exists).
`src/lib/openapi/build-openapi.ts`: remove `INTERACTIVE_SIGNING_HEADERS`, `interactive` param/branches in `buildOperationParams`, `BuildOpenApiOptions.interactive`, `INTERACTIVE_SECURITY_SCHEMES`, `INTERACTIVE_OPERATION_SECURITY`, `if (interactive)` blocks; reword Scalar comments (only remaining caller is public `/openapi.json`, non-interactive — verified). `build-openapi.test.ts`: drop interactive describe; keep "public doc has no auth bits" guard.
`package.json`: drop `@scalar/api-client`, `@scalar/oas-utils`, `@scalar/workspace-store`; `npm install`; assert `grep -r "@scalar" src package.json package-lock.json` empty.
`.env.example` + `src/vite-env.d.ts`: `VITE_SCALAR_PROXY_URL` → `VITE_TRYIT_PROXY_URL` (optional override); fix stale "DEV-only UAT creds" comments. `uat-credentials.ts` header → point at `useTryItState.ts`. Reword Scalar-in-use comments in `CodeSamples.tsx`, `DocDetailPage.tsx`, `api-specs-common.ts:148`.

## F. Docs

Rewrite `docs/developer-docs/try-it-now.md` (components, proxy contract incl. `x-eps-developer-key` mapping + redirect policy + caps, keys policy, env rules, sessionStorage key + PII note + "Clear saved request" + note that keys pasted into Raw JSON body would persist, `?try=1`, SSG/chunk note, honest security framing: prod developer_key + one-time signature transit our proxy, never access_key). Update `docs/developer-docs/code-samples.md` (PHP + `SampleOverrides` + escaping), `api-documentation.md:63`, `developer-docs/README.md`, root `README.md` try-it line, `packages/eps-backend/README.md`, `eps-backend-vm-deploy.md` nginx `location = /tryit/proxy` + rate-limit IP caveat.

## G. Verification

Unit tests:
- `src/lib/docs/tryit-request.test.ts` — ref id shape/uniqueness; JSON build (env base URL, `secret-key` == node:crypto reference, `x-eps-developer-key` set, no `access_key`/`developer_key` header); multipart build (no content-type, `form-data` part minus file keys, file parts, nested object preserved); GET (query string, no body, encoded path value); `validateParams` (required/enum/min/max/UTF-8 maxLength/required file/file size); `matchErrorScenario`; `ekoOutcome` incl. null/array/HTML/no-status ⇒ unknown, financial tx_status; `parseProxyError` envelope vs HTML; `sendViaProxy` sentinel exactly `"1"`.
- `src/lib/docs/code-samples.test.ts` — overrides change URL/params/body in curl/js/python/php; auth placeholders stay; SDK uses override + `environment: "production"` + optional keys; apostrophe/quote/newline/`$(cmd)` in values produce safe output; no-override output unchanged except encoding fixes (update snapshots deliberately).
- `src/components/docs/tryit/TryItDialog.test.tsx` (model: `SecretKeyTester.test.tsx`, `vi.stubGlobal("fetch")`) — breadcrumb/method/URL; UAT prefill masked; prod toggle clears creds + banner + blocks Send; financial prod double-click via button AND Ctrl+Enter, edit disarms; fetch called once on rapid double click; response summary + success badge for `status:0`; `unknown` badge for HTML body; UAT callout for `status!==0` and HTTP 500; invalid raw blocks Send and survives tab switch; restore prod env ⇒ creds empty; sessionStorage never contains `accessKey`; "Clear saved request"; params section conditional; dark class follows `docs-dark`.
- `src/components/docs/useTryIt.test.tsx` — `?try=1` opens; no import before click; failed import retries.
- `src/lib/openapi/build-openapi.test.ts` — interactive block removed; existing tests pass.
- `packages/eps-backend/src/http/tryitProxy.test.ts` + `app.test.ts` additions — cases in §A.

```
npm test -- src/lib/docs/tryit-request.test.ts src/lib/docs/code-samples.test.ts
npm test -- src/components/docs/tryit src/components/docs/useTryIt.test.tsx
npm test -- src/lib/openapi/build-openapi.test.ts
npm run backend:test -- src/http/tryitProxy.test.ts src/http/app.test.ts
npm run typecheck && npm run lint
npm run backend:build
npm run build   # inspect dist/.vite/manifest.json: TryItDialog is its own async chunk; grep -ril scalar dist → empty
graphify update .
```

Manual (UAT): `npm run backend:dev` + `npm run dev`; `/docs/pan-lite` API mode → Test Request; toggle docs dark → modal dark. Send with prefilled keys → 200 + success badge + ms/bytes; Network: single `POST /api/tryit/proxy`, headers `x-eps-developer-key`/`secret-key`/`secret-key-timestamp`, no `access_key`. Form↔Raw sync; broken JSON blocks. `client_ref_id` changes per send. Close/reopen/reload restores body; sessionStorage has no keys; "Clear saved request" resets. `/docs/activate-aeps-fingpay?try=1` opens; nested address objects editable; attach 3 images → `form-data` + file parts; >1 MB file rejected client-side. Prod toggle clears keys + banner; financial needs 2 clicks. Bogus `initiator_id` (valid shape) → UAT callout + scenario match. `for i in $(seq 305)` curl → 429 after 300. After VM deploy: real prod hop check that `developer_key` reaches Eko (UAT 200 through eps.eko.in, not just localhost) ◆.

## H. Risks / notes

- Proxy live only where `/api/*` reaches eps-backend (Vercel route exists; needs eps-backend deploy + nginx `location = /tryit/proxy` before prod flip). Missing route ⇒ explicit "proxy unavailable" message.
- Rate-limit bucket is per Vercel edge IP behind nginx (`X-Real-IP` overwritten); acceptable for now, documented; per-visitor keying = deploy-chain change (out of scope).
- UAT slow (10–15 s) → 30 s backend / 35 s browser timeouts; nginx `proxy_read_timeout 120s` already fine.
- sessionStorage may hold typed PII (PAN/Aadhaar); per-tab; "Clear saved request" provided; documented.
- Deferred (YAGNI): request history, persistent keys, streaming response cap in proxy (Eko responses are small JSON), per-visitor IP restoration.

## I. Addendum — second Codex pass (exit-plan hook), folded

1. **Raw editor keeps the draft.** `setRaw(text)` stores `rawDraft` and, when it parses to a plain object, also updates `body` — but does NOT clear the draft (no reformat / cursor jump mid-edit). Draft is dropped only on switching back to Form (re-mirrors `body`) or "Clear saved request".
2. **Financial "outcome unknown" covers proxy 502/504 and stream failures after dispatch**, not only aborts. `lastSentRef` retained and shown; user told to check status before retrying.
3. **PHP escaping** reuses existing `phpStr` / `phpArray`; JS uses `JSON.stringify`; Python uses `pyDict`/`pyLiteral` (already JSON-string-safe); curl uses `shellQuote` for `--url` and `--data`.
4. **Proxy drops upstream `content-length`** (Node fetch may decompress). Forwarded upstream headers: `content-type`, `date`, `retry-after`.
5. **Proxy buffers the upstream body** via `readBodyCapped(upstream.body, 4 MiB)` inside the timeout, then responds — so a body timeout still becomes a JSON 504 and framing is always correct. Oversized upstream body → 502 `UPSTREAM_TOO_LARGE`.
6. **Snippets render from current valid state**, not the last sent snapshot.
7. **Object/array fields** keep a per-field draft + error in `ParamField`, parsed on every change; any field error blocks Send (via `fieldErrors`), so Ctrl/Cmd+Enter cannot submit stale values.
8. **Persisted body is redacted**: keys named `developer_key`, `access_key`, `secret-key`, `secret-key-timestamp` (case-insensitive) are stripped before writing sessionStorage, so "keys never persisted" holds even for pasted Raw JSON.
