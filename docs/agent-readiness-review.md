# Agent-readiness review: EPS vs the seven ways AI agents fail APIs

_Reviewed 2026-10-08 against the AgentBadge article ["Why AI agents fail to use APIs"](https://agentbadge.xyz/agent-guide/articles/why-ai-agents-fail-apis). Companion to [ai-native-gap-analysis.md](ai-native-gap-analysis.md), which covers the agent **loop** (act → verify → self-correct); this doc covers the **interface** an agent has to read and call._

## 1. The article in one paragraph

> "AI agents don't fail because the model is stupid. They fail because APIs are designed for humans, not autonomous software."

An agent must get through seven gates in order. A miss at any gate is a failed integration, however good the model:

| # | Failure mode | Agent needs | Human assumption that breaks it |
|---|---|---|---|
| 1 | **Discovery** | `llms.txt`, `/.well-known/*`, `ai-sitemap.xml`, `<link rel>` | "Our API is at docs.example.com, everyone knows that" |
| 2 | **Documentation** | Full descriptions + examples + error schemas in OpenAPI | "It says `Get user`, obviously it returns a user" |
| 3 | **Authentication** | Machine-readable `securitySchemes`, token endpoints | "OAuth is standard" |
| 4 | **Semantics** | What the op does, idempotent?, side effects? | "The endpoint name is self-explanatory" |
| 5 | **Schema** | Complete response `properties`, `enum`, `format`, examples | "The response is obvious from the docs" |
| 6 | **Error recovery** | Structured errors (RFC 9457), machine codes, `Retry-After` | "The error message explains what's wrong" |
| 7 | **Runtime safety** | Idempotency keys, rate-limit headers, safe/unsafe labels | "Obviously you don't retry a transfer" |

Key principle: **a valid OpenAPI file is necessary but not sufficient — it can be structurally correct and semantically empty.** The scanner the article describes probes `/llms.txt`, `/robots.txt`, `/sitemap.xml` or `/ai-sitemap.xml`, `/.well-known/agent-card.json`, `/openapi.json` (or `/api/specs`), auth clarity, structured JSON errors with codes, and JSON (not HTML) responses.

## 2. Method

- Code audit of every surface derived from `src/lib/data/api-specs.ts`: docs pages + `.md` twins, `openapi.json`, `/agent/*` bundle, context MCP, transact MCP, the five SDKs, recipes, mock server.
- Coverage numbers computed over the 113 enabled specs (`API_SPECS` after `disabled` filtering).
- Live probe of `https://eps.eko.in` on 2026-10-08 (§9). The `@agentbadge/cli` package the article names is not on npm (404), so the probe reproduces its documented checks with `curl`.
- Second-opinion review (Codex) of the plan; its objections are folded into §4–§7 and marked ⚠.

Everything here is **portal-side** unless marked **[core]**: wire behaviour or facts only Eko's core API team owns.

## 3. Scorecard

| Mode | Score | Why |
|---|---|---|
| 1 Discovery | 🟡 | `llms.txt`, `.md` twins, `/agent/*` bundle, OpenAPI, CORS `*` all live. Nothing under `/.well-known/`; `/ai-sitemap.xml` and every `.well-known` path return **200 + HTML SPA shell** (soft-404, worse than a 404 for a scanner); `/llms-full.txt` is an alias of the index; no `<link>` to OpenAPI/bundle in HTML `<head>`. |
| 2 Documentation | ✅ | 112/113 descriptions, **345/345 params described**, **903/903 response fields described**, 112 sample responses, `bestFor`, `responseTypes.next` routing, 4 branching recipes. Weak spots: 44 specs with no `errorScenarios`, terse MCP tool descriptions. |
| 3 Authentication | 🟡 | HMAC fully specified with a published, unit-tested test vector; `get_signing_snippet` (6 languages); secret-free `debug_auth`; zero-signup public sandbox keypair. But OpenAPI **deliberately has no `securitySchemes`** so scanners/generators see an unauthenticated API; clock-skew tolerance unpublished. |
| 4 Semantics | ❌ | **No `readOnly` / `idempotent` / `billable` / side-effect field in `ApiSpec`.** Only `financial?` (11 specs). Safety knowledge lives solely in a hand-written map inside the transact MCP. |
| 5 Schema | 🟡 | Response schemas have real nested `properties`. But the OpenAPI param serializer **drops `format`/`pattern`, `enum`, `min`/`max`, `maxLength`**; source data has 0 enums; no `components`/`$ref` (envelope repeated per op → 830 KB file); no `required` arrays. |
| 6 Error recovery | 🟡 | Two-level status model documented; field-level `invalid_params`; `responseTypes.next`; SDKs classify 429/5xx/timeout as *indeterminate* and auto-inquire for financial calls — better than the article's baseline. But: no retryable/category metadata; docs contradicted each other (fixed in this pass, §6); transact MCP collapses HTTP and validation errors into `UPSTREAM_ERROR`; business failures look like success. |
| 7 Runtime safety | ❌ | **No rate limits published anywhere.** `client_ref_id` optional, dedupe semantics unknown, mislabelled "idempotency" in two places (fixed). No `Retry-After` sent or honoured. Transact MCP exposes only non-financial verification tools — correct for now, no gating design for money tools yet. |

## 4. Mode-by-mode detail

Format per row: what works → gap (with code location) → fix → owner → priority. Priorities: **P0** cheap and scanner-visible or a correctness trap; **P1** real agent value, more work; **P2** polish.

### 4.1 Discovery

**Works**
- `/llms.txt` (`src/lib/markdown/render-index.ts:142-230`) lists products, pricing, FAQ, recipes and every product/industry/solution `.md`; `aiGettingStartedNotice()` (`src/lib/markdown/shared.ts:210-235`) links the bundle, index and OpenAPI and publishes the UAT keypair on purpose (zero-signup trial).
- Every page has a `.md` twin advertised via `<link rel="alternate" type="text/markdown">` plus the hidden `AiHint` text.
- `/agent/eps.json`, `/agent/index.json`, `/agent/api/<slug>.json`, `/openapi.json`, `/agent/eps.postman_collection.json` all served with `Access-Control-Allow-Origin: *` (probe §9).
- Context MCP at `https://mcp.eko.in/context/mcp` **plus** a REST + OpenAPI face (`/context/openapi.json`, `/context/tools/*`, commit a80a46c3) for ChatGPT Actions / Gemini.

**Gaps**
- ~~Nothing under `/.well-known/`~~ — fixed 2026-10-08 (5.1/5.5, §6.12): `api-catalog` added, everything else 404s. Was: every probed path (`agent-card.json`, `openapi`, `api-catalog`, `mcp.json`) and `/ai-sitemap.xml` return **200 with the HTML SPA shell**. A scanner that parses that as JSON records a failure *and* "returns HTML" — two marks against us where a 404 would cost one.
- `/llms-full.txt` is a Vercel rewrite to `/index.md` (`vercel.json:57-60`), i.e. the link index, not full content; nginx has no rule at all.
- HTML `<head>` carries only the markdown alternate — no `rel="service-desc"` to OpenAPI, no link to the bundle.
- `llms.txt` has no endpoint-level entries; the 113 endpoint `.md` twins are only reachable via `/docs.md`.
- `sitemap.xml` is HTML routes only.
- The context MCP's new REST/OpenAPI face is not linked from `llms.txt`, `/ai` or anywhere discoverable.

**Fixes** → Phase 5 (§7).

### 4.2 Documentation

**Works** — the strongest area, and the moat. Coverage over 113 enabled specs:

| Metric | Count |
|---|---|
| Inline `description` | 112/113 |
| Every param described | 113/113 (345/345 params) |
| Every param has `example` | 112/113 (344/345) |
| Response fields described | 903/903 |
| Response fields with example | 833/903 |
| Non-empty `sampleSuccessResponse` | 112/113 |
| `responseTypes` routing table | 26/113 |
| Any `errorScenarios` | 69/113 |
| At least one 4xx scenario | 25/113 |
| Params with `format` regex | 43/345 |
| Params with `enum` / `min`/`max` / `maxLength` | **0 / 0 / 0** |

**Gaps**
- 44 specs have no `errorScenarios`; only 25 show a 4xx. `statusCode` values used: 200 ×130, 403 ×19, 400 ×11, 404 ×2.
  - _Correction 2026-10-08:_ the auth-failure status was documented as 403 at audit time; EPS actually answers **401**, and every spec, hint and doc now says 401. Dated lines below keep the 403 wording as observed.
- Context MCP tool descriptions were one-liners (`get_api`: "Full detail for one endpoint by slug.") — fixed in this pass (§6.7).
- `search` ranks by substring-hit count only (`packages/eps-context-mcp/src/bundle-access.ts:46-65`).

### 4.3 Authentication

**Works**
- `API_AUTH_INFO.secretKeyGeneration` 4 steps (`src/lib/data/api-auth.ts:110-115`) + published test vector (`:125-129`, verified in `api-auth.test.ts`); the "do not base64-decode" warning (`how-auth-works.mdx:40-42`); browser `<SecretKeyTester />`.
- `get_signing_snippet` for php/java/csharp/javascript/python/go; `debug_auth` returns a known-answer vector, machine-readable `ranked_causes {id, cause, fix}`, and refuses to accept an `access_key` by design.
- SDKs sign each attempt separately so retries never reuse a stale timestamp.
- No OAuth → the article's OAuth-discovery checks are N/A; the *clarity* check still applies.

**Gaps**
- ~~`openapi.json` has **no `securitySchemes` and no top-level `security`**~~ — fixed 2026-10-08 (Phase 2.2, §6.10). Was a deliberate choice (`src/lib/openapi/build-openapi.ts:9-13`: "a securityScheme cannot express HMAC faithfully"). Consequence: every scanner/codegen tool classifies EPS as unauthenticated; the algorithm exists only as prose in `info.description`.
- Clock-skew tolerance unpublished; `auth-debug.ts:36` warns at 5 min as a heuristic. **[core]**
- `api-auth.ts:37` claimed "Self-serve credentials available immediately on signup" while reality is one shared public sandbox keypair — fixed (§6.4).
- Production key issuance is manual (account manager after KYC); no API. Known, see ai-native-gap §7.

**Fix (Phase 2.2)** ⚠ Codex is right that an `apiKey` scheme models only `developer_key` and no generator will compute HMAC from a description. The point is not to make generated clients work unaided; it is to stop every machine reader concluding "no auth". So: add `securitySchemes.ekoHmac` (apiKey/header `developer_key`) with a description that says "generated clients MUST add the per-request `secret-key`/`secret-key-timestamp` via the SDK or `x-eko-signing`", add `x-eko-signing {algorithm, headers, testVector, docsUrl}`, keep the three header params, and verify one generated client (openapi-generator TS) does not double-inject `developer_key`.

### 4.4 Semantics

**Works**
- `ApiSpec.financial?` on 11 specs drives the financial envelope and SDK auto-inquiry.
- Transact MCP marks six side-effecting tools (`packages/eps-transact-mcp/src/tools.ts:48-57`: penny-drop, 2 bulk enqueues, OTP send/verify, DigiLocker URL) with `readOnlyHint:false, idempotentHint:false`; everything else `readOnlyHint:true`. Context MCP is all read-only.
- Every transact tool description says "Each successful call is billed per EPS pricing."

**Gaps**
- `ApiSpec` (`src/lib/data/api-specs-common.ts:135-227`) has **no read-only / idempotent / billable / side-effect field**. The MCP's `SIDE_EFFECTS` map is the only place this knowledge exists, so OpenAPI, SDKs, docs and the bundle cannot show it, and it drifts silently when a spec changes.
- `financial` is not emitted into OpenAPI at all (only `x-docs-slug` is, probe §9).
- `destructiveHint` never set (MCP default for non-read-only is `true`).
- DMT prose called `client_ref_id` "for idempotency" (`api-specs.ts:1049, 1101`) — the opposite of the actual contract (fresh value per attempt; safety comes from inquire-before-retry). Fixed (§6.5).

**Fix (Phase 3)** ⚠ Codex: do not *default* GET → read-only or `financial` → billable; unknown must stay unknown, and SDK retry must key on confirmed **idempotent**, not `readOnly`. So the field is explicit per spec, the build fails on a missing value for any non-GET spec, and GET gets `readOnly: true` only after a one-time review of the 50-odd GET specs (some GETs bill — e.g. verification lookups).

### 4.5 Schema

**Works**
- Response schemas are real nested `properties` (`build-openapi.ts:79-106`, `270-274`), built from `responseData` + the shared envelope.
- Regex formats (`src/lib/data/api-formats.ts:28-39`: date, mobile, pan, aadhaar, ifsc, pincode, client-ref, lat-long) are build-validated and *do* reach the agent bundle and `sdk-surface.json`, where the SDKs validate before sending.

**Gaps**
- ~~`paramSchema` emits only `type`/`description`/`example`~~ — fixed 2026-10-08 (Phase 2.1, §6.10): `pattern`/`enum`/`minimum`/`maximum`/`maxLength` now emitted. Was: **all constraints dropped** (even `client_ref_id`'s `maxLength: 20`; the live file confirms, §9).
- Source data: 0 params with `enum`, 0 with `min`/`max`, 0 extra params with `maxLength`. `tx_status` enum was prose in 6 places with 3 different value sets — now one constant (§6.1).
- `ResponseField` has no `required`/`nullable`/`enum`; no `required` arrays emitted.
- No `components`/`$ref`: envelope repeated for every op; `openapi.json` is 830 KB.
- `requestBody.required: true` always (`:165`); multipart `form-data` part is an opaque string (`:184-217`) ⚠ deliberately — it *is* a JSON string on the wire, so 2.6 must describe, not restructure.
- Non-200 responses have examples but no schema (`:312-316`); missing `statusCode` defaults to 200 (`:298`); global HTTP codes never attached; non-primary grouped variants lose description/responses (`:377-382`).

**Fix** → Phase 2. ⚠ Codex: emit `enum` for `tx_status`/`status` only if the list is exhaustive — it is not (the `status` catalogue is "common codes"). So: `tx_status` can get a real `enum` (0/1/2/3/4/6 — value 5 "Hold" is retired and was removed in this pass); `status` gets `x-eko-known-values`, never `enum`. Keep `tx_status` as `string`.

### 4.6 Error recovery

**Works**
- Envelope documented once (`api-specs-common.ts:278-322`): `status` (business outcome, 0 = success), `message`, `response_status_id` (UI hint), `response_type_id` (shape id), `tx_status`/`txstatus_desc` for financial.
- `/docs/error-codes` explains "200 + non-zero `status` = business failure"; validation returns `invalid_params` per field — richer than the article's baseline.
- `responseTypes {id, meaning, next}` on 26 specs; recipes branch on `response_type_id` / `status` with `goto`.
- SDKs: `EpsHttpError`, `EpsIndeterminateError` (429 / 5xx / transport), GET-only retry with jitter, **financial non-GET with unknown outcome → automatic Transaction Inquiry by `client_ref_id`** (`packages/sdk-js/src/client.ts:410-463`). Same contract in Python, Go, Java, PHP (`docs/sdk-golden-vector.md`).
- `debug_auth` turns a 401 into ranked causes with fixes.

**Gaps**
- Catalogue `ApiErrorCode {code, scope, meaning}` (`src/lib/data/api-error-codes.ts`) has **no retryable / category / remediation**; bundle `errors` topic is a flat list not tied to endpoints.
- Docs contradicted each other (all fixed in this pass, §6): `tx_status` enum ×3 variants; `response_status_id` described as "granular status id" in the envelope while the docs page says UI-hint-only; `invalid_parameters` vs `invalid_params`; invalid JSON example; `405` missing from the page.
- No `Retry-After` honoured by any SDK (429 retried with ≤2 s backoff); none sent by the BFF's own limiter (`packages/eps-backend/src/http/rateLimit.ts:43-50`). RFC 9457 absent **[core]**.
- SDKs return a 2xx with `status ≠ 0` as success (`client.ts:584-591`); no typed business error, no `response_type_id → next` mapping.
- ~~Transact MCP error mapping~~ — fixed 2026-10-08 (Phase 4.3, §6.11). Was (`server.ts:21-52`): SDK value-validation errors ("Invalid param values…", `client.ts:529`) are not in `SAFE_MESSAGE_PATTERNS` → surface as `UPSTREAM_ERROR "network or non-JSON upstream response"`; any `EpsHttpError` (incl. 403) → same generic code, status dropped; business failure not `isError`; no `outputSchema`.

**Fix** → Phase 4.1, 4.3, 4.4. ⚠ Codex: retry policy is per-operation, not per-code — "429 → inquire" is wrong for a read with no inquiry path. Hence `retryable` is a *default* that `semantics` (Phase 3) overrides; and MCP error bodies must be redacted/allow-listed, not raw upstream (PII).

### 4.7 Runtime safety

**Works**
- SDKs never retry non-GET; financial → inquire. Transact MCP exposes only non-financial verification tools; requires `X-Eko-Allowed-Apis` scoping ("EPS calls are billed").
- Mock server lets agents rehearse error branches offline.

**Gaps**
- **No rate limits published** for EPS anywhere (UAT keypair "quota'd", no number). **[core]**
- `client_ref_id`: optional (`api-specs-common.ts:265`), max 20, SDK generates 15-char base36; **dedupe window and duplicate behaviour undocumented** **[core]**. Transaction Inquiry says "timeout is never failure — always inquire", but inquiry "not found" may mean "not yet processed" ⚠ — the reconciliation rule needs core's answer before we prescribe retries.
- No `X-RateLimit-*` / `Retry-After` **[core]**.
- No gating design (confirmation, dry-run, caps) for the day financial tools enter the transact MCP.

**Fix** → Phase 4.2, 4.5, 4.6. ⚠ Do **not** emit an `x-eko-idempotency` extension until dedupe semantics are confirmed; label `client_ref_id` as "reconciliation + lookup key" until then.

## 5. Where semantics leak (the surface map)

```
api-specs.ts ──► docs pages + .md twins      full (description, params, responseTypes, errorScenarios)
             ──► openapi.json                drops format/enum/min/max/maxLength, financial, responseTypes-as-data, securitySchemes
             ──► /agent/eps.json             full params; errors topic flat; no semantics
             ──► sdk-surface.json            params+constraints, financial; no descriptions, no responses
             ──► context MCP                 = bundle (good); REST face caps descriptions at 300 chars
             ──► transact MCP                verification && !financial only; safety from hand map, not data
             ──► SDKs                        generic call(slug, params); typed transport errors; business failure = success
             ──► mock server                 scenario selector was keyed on response_status_id (fixed, §6.2)
```

Rule of thumb from the article applied here: **anything only a human can read (prose) is lost to one surface or another.** Every fix below moves a fact from prose into a field.

## 6. Done in this pass (2026-10-08) — doc-consistency fixes

| # | Fix | Files |
|---|---|---|
| 6.1 | `tx_status` enum written **once**: `TX_STATUS_CODES` + `txStatusSummary()`; envelope, 4 spec descriptions and 3 endpoint markdowns derive from / mirror it. Value 5 ("Hold"), present in three of the old copies, is retired and removed; 6 ("Response Awaited") is the inquiry-required state. Rule for 2 and 6: in-flight → inquire. | `api-error-codes.ts`, `api-specs-common.ts`, `api-specs.ts`, `error-codes.mdx`, `endpoints/{transaction-inquiry,ppi-digikhata-initiate-transaction,aeps-initiate-settlement}.md` |
| 6.2 | `response_status_id` framing aligned with the docs page (UI hint only): envelope description, catalogue JSDoc, mock-server docs, MCP recipe description. **Mock-server selector bug**: `eps_scenario` matched `example.response_status_id`, which is `1` for every error example, so no documented scenario could be selected; the docs' own example (`eps_scenario=463` on `dmt-get-sender`) named a code that endpoint never returns (its "sender not enrolled" example is `status` 308 / `response_type_id` 308). Selector now matches the example's `status` **or** `response_type_id` (the id recipes branch on); docs example corrected to 308; a fixture test pins it. | `api-specs-common.ts`, `api-error-codes.ts`, `build-fixtures.ts`, `eps-mock-server/src/match.ts`, `build-context-pack.ts`, `render-agents.ts`, `docs/ai-agent-platform.md` |
| 6.3 | `/docs/error-codes`: `invalid_parameters` → `invalid_params`; JSON example made valid; `405` row; `tx_status` typed `string`; paragraph on undocumented 429/5xx = *unknown outcome*, read vs money-moving handling. `status` catalogue gains 132/319/346/1297 so `.ts` ⊇ page. | `error-codes.mdx`, `api-error-codes.ts` |
| 6.4 | Sandbox note: "Self-serve credentials on signup" → "shared sandbox keypair published openly, no signup". | `api-auth.ts` |
| 6.5 | `client_ref_id` is no longer called an idempotency key; both DMT strings now say reconciliation + Transaction Inquiry lookup before any retry. | `api-specs.ts` |
| 6.6 | "dicsover" typo in the `llms.txt` agent notice. | `markdown/shared.ts` |
| 6.7 | Context MCP `get_api` / `get_recipe` descriptions enumerate returned fields and explain `responseTypes.next` and recipe `branches`; REST face gets a ≤300-char override for `get_api`. | `eps-context-mcp/src/server.ts`, `rest.ts` |
| 6.12 | **Phase 5.1 + 5.5 done.** `public/.well-known/api-catalog` (RFC 9727) + 404 instead of SPA shell for unknown `/.well-known/*` and `/ai-sitemap.xml` in `vercel.json` (fallback regex excludes them), `netlify.toml` + `_redirects` (status 404 rules), `.htaccess`, `nginx.conf`; linkset content-type on each. `llms.txt` agent notice links the catalog and the context MCP's REST/OpenAPI face (`EPS_CONTEXT_MCP_OPENAPI_URL`). `src/lib/well-known.test.ts` pins the catalog shape. | deploy configs, `shared.ts`, `site.ts`, `docs/configuration.md` |
| 6.10 | **Phase 2.1 + 2.2 done.** OpenAPI `paramSchema` emits `pattern` (format registry), `enum`, `minimum`/`maximum`, `maxLength`. Root `components.securitySchemes.ekoHmac` (apiKey on `developer_key`, description spells out the HMAC headers + test vector), top-level `security`, structured `x-eko-signing` {algorithm, key encoding, headers, steps, testVector, docsUrl, backendOnly}. Header comment at `build-openapi.ts:9-19` records why the 2026-06 "no scheme" decision was reversed. Codegen check: openapi-generator `typescript-fetch` writes `developer_key` from the param then from `configuration.apiKey` into the same header key — one header on the wire, no duplication. | `build-openapi.ts` + test |
| 6.11 | **Phase 4.3 done.** Transact MCP: `Invalid param values` allow-listed as `VALIDATION`; `EpsHttpError` → `HTTP_<status>` with `status` + per-status hint (403 → run `debug_auth`; 429/5xx → outcome unknown), upstream body withheld; 2xx with `status≠0` → `isError` `BUSINESS_<status>` with `message`, `response_type_id`, documented `meaning`/`next`, full `envelope`; every tool declares the envelope `outputSchema` and returns `structuredContent`. `ToolDef` now carries `responseTypes`. | `eps-transact-mcp/src/{server,tools}.ts` + tests, README |
| 6.9 | Sandbox credentials story split by audience: humans (`API_ENVIRONMENTS.sandbox.note`, site + SDK pages) are told to sign up and read keys off the Console; agents (`AGENT_SANDBOX_NOTE` → bundle `meta.environments`, MCP `environments` topic, context packs) are told the public UAT keypair lives in `llms.txt`, no signup. Key values stay out of the bundle. | `api-auth.ts`, `build-agent-bundle.ts` |
| 6.8 | Developer docs synced (`single-source-of-truth.md`, `api-specs.md`); README index links this doc and the gap analysis. | `docs/`, `README.md` |

Left as named export `RESPONSE_STATUS_CODES` (it holds `status` codes) — renaming touches 9 files across two MCP packages for no agent-visible gain; JSDoc says so.

## 7. Phased plan — pick any step

Each step: **Impact** · **Touches** · **Effort** S/M/L · **Risk** · **Depends**. Steps are independent unless noted.

### Phase 2 — OpenAPI fidelity (generator only, scanner-visible)

| Step | What | Impact | Effort | Risk / notes |
|---|---|---|---|---|
| ✅ 2.1 | **Done 2026-10-08.** `paramSchema` emits `pattern` (from `API_PARAM_FORMATS`), `enum`, `minimum`/`maximum`, `maxLength` | Generated clients and agents validate before calling; cheapest mode-5 win | S | snapshot churn only |
| ✅ 2.2 | **Done 2026-10-08.** `securitySchemes.ekoHmac` + top-level `security` + `x-eko-signing`; header params kept; typescript-fetch codegen verified (same header key, no double-inject) | Scanners stop reporting "unauthenticated"; mode 3 | S | reverses the deliberate decision at `build-openapi.ts:9-13` — rewrite that comment with the new reasoning |
| ⏸ 2.3 | **On hold (2026-10-08, user decision).** `components.schemas.{Envelope, FinancialEnvelope, ValidationError}` + `$ref`; `required` arrays for envelope fields **confirmed from live responses**; `tx_status` `enum` = 0/1/2/3/4/6; `status` as `x-eko-known-values` never `enum` | Smaller file (830 KB → est. <300 KB), typed codegen | M | do 2.3 before 2.4 |
| ⏸ 2.4 | **On hold (2026-10-08, user decision).** Attach 401/404/405/415/500 from `HTTP_STATUS_CODES` to every op; add "business failure" + validation 200 examples; `$ref` schema on non-200; build **error** on missing `statusCode` | Agents see failure shapes without calling; mode 6 | S–M | depends 2.3 |
| 2.5 | `x-eko-response-types [{id, meaning, next}]` per op alongside the markdown block | Branch on data not prose | S | — |
| 2.6 | Describe (not restructure) the multipart `form-data` JSON-string part with its field list in `description`; grouped variants keep own description/responses; `requestBody.required` only when body mandatory | 3 upload specs usable by codegen | M | wire format unchanged |

> **2.3 / 2.4 on hold.** Plan was written out on 2026-10-08 (shared `Envelope` / `FinancialEnvelope` / `ValidationError` components with `required: ["status"]` only — the sample data shows every other envelope field absent somewhere; `tx_status` enum `["0","1","2","3","4","6"]`; `status` as `x-eko-known-values`, never `enum`; reusable `components.responses` for 401/404/405/415/500 attached to every op unless the spec documents the code itself; generic business/validation examples only for the 44 scenario-less ops; build warning for scenarios without `statusCode`). Parked by the user before implementation; revisit after Phase 3/4.1 since the retry metadata (4.1) would change what the shared error responses carry. Note: the 2.4 draft assumed 403 for auth failure — that is wrong, EPS returns **401** (corrected in `7b85bf4c`).

### Phase 3 — Semantics model

| Step | What | Impact | Effort | Risk / notes |
|---|---|---|---|---|
| 3.1 | `ApiSpec.semantics: { readOnly, idempotent, billable, sideEffect? }` — explicit on every spec; build fails when missing; no inference from method or `financial` | Foundation for 3.2–3.4; mode 4 | M–L (113 values, product review) | wrong label is worse than none — review sheet first |
| 3.2 | Transact MCP annotations derived from `semantics`; delete `SIDE_EFFECTS` map; `destructiveHint` from `sideEffect`, `openWorldHint` separate | No drift between data and hints | S | depends 3.1; hints are advisory, hosts may ignore |
| 3.3 | Emit `x-eko-semantics` + `x-eko-financial` in OpenAPI; `semantics` in bundle + `sdk-surface.json`; SDKs may retry non-GET **only when `idempotent: true`** | Safe retries, never on money | S | depends 3.1 |
| 3.4 | Docs badge (Read-only · Billable · Money-moving · Sends OTP) on endpoint page and `.md` twin | Humans and agents see it | S | depends 3.1 |

### Phase 4 — Error recovery & runtime safety

| Step | What | Impact | Effort | Risk / notes |
|---|---|---|---|---|
| 4.1 | `ApiErrorCode` + `retryable: "never"\|"backoff"\|"after-inquiry"`, `category`, `fix?`; emit `x-eko-error-codes`, bundle topic, mdx column | Machine-readable retry guidance; feeds ai-native-gap #2 | M | retry is a **default**, overridden per op by 3.1 |
| 4.2 | `client_ref_id` contract page: uniqueness scope, 15/20 chars, lookup form; `required: true` for `financial` specs | Mode 7 ask #1 | S portal + **[core]** dedupe semantics | no `x-eko-idempotency` until core confirms |
| ✅ 4.3 | **Done 2026-10-08.** Transact MCP: add "Invalid param values" pattern; `EpsHttpError → {code: "HTTP_<status>", status, hint}` with **redacted/allow-listed** body; 2xx `status≠0 → isError` + `{code: "BUSINESS_<status>", status, response_type_id, next?, message}`; `outputSchema` envelope | Agent self-corrects instead of guessing; biggest MCP win | S–M | isError on business failure changes host UX (intended) |
| 4.4 | SDKs: opt-in `throwOnBusinessError` → `EpsBusinessError`; honour `Retry-After` (seconds + HTTP-date, bounded, total deadline, never on financial) | Typed failure path for agent-written code | L (5 languages + golden vector) | depends 4.1 for `next` |
| 4.5 | **[core]** publish per-env rate limits + whether 429/`Retry-After` exist → `environments` topic, `x-ratelimit`, mdx row. BFF limiter sends `Retry-After` (independent, S) | Mode 7 | S portal, blocked on core | — |
| 4.6 | Design doc for financial tools in transact MCP: confirm/elicit step, dry-run, allow-list + amount caps, mandatory `client_ref_id` echo | Prevents "retry → double charge" before money tools exist | M (doc only) | — |

### Phase 5 — Discovery surfaces

| Step | What | Impact | Effort | Risk / notes |
|---|---|---|---|---|
| ✅ 5.1 | **Done 2026-10-08.** `public/.well-known/api-catalog` (RFC 9727 linkset → openapi, docs, llms.txt, eps.json, both MCPs + context REST face) served as `application/linkset+json`; unknown `/.well-known/*` is a real 404 on all four deploy targets. No `agent-card.json` (we do not implement A2A) | Scanner check passes; stops soft-404s | S | ⚠ don't invent an A2A card |
| 5.2 | `<head>`: `<link rel="service-desc" href="/openapi.json" type="application/vnd.oai.openapi+json">`, `rel="alternate" type="application/json" href="/agent/eps.json"`, `type="text/plain" href="/llms.txt"` | Discovery from any page | XS | — |
| 5.3 | Real `/llms-full.txt`: deterministic concat of docs `.md` twins (products → docs → recipes), size-capped or sectioned; nginx rule | One-fetch context for agents without MCP | S–M | build time; keep ordering stable |
| 5.4 | `llms.txt`: per-product endpoint `.md` list; `/ai` and `llms.txt` link `mcp.eko.in/context/openapi.json` + `/tools/*` | Endpoint-level + REST-face discovery | S | sitemap stays HTML-only (no SEO value in JSON) |
| ✅ 5.5 | **Done 2026-10-08.** `/ai-sitemap.xml` → real 404 (non-standard; `llms.txt` + api-catalog are the machine map). `llms.txt` now links the api-catalog and `mcp.eko.in/context/openapi.json` | Removes a false positive | XS | — |

### Phase 6 — Polish

6.1 `errorScenarios` backfill for the 44 specs (401 + validation each) — M · 6.2 `search` ranking weights — S · 6.3 log `EPS_BUNDLE_URL` fallback (`load-bundle.ts:21-23`) — XS · 6.4 `enum` backfill where params are truly constrained — M · 6.5 re-probe (§9) after each phase and append the result here.

**Suggested order if doing everything:** 2.1 → 2.2 → 2.3 → 2.4 → 4.3 → 3.1–3.3 → 4.1 → 5.1 → 5.2 → 5.4 → 5.5 → rest.

## 8. Questions for Eko core

1. ~~`tx_status` 5 vs 6~~ — resolved 2026-10-08: 5 (Hold) is no longer used; 6 is the inquiry-required state.
2. `secret-key-timestamp` tolerance window (ms).
3. `client_ref_id`: is uniqueness enforced server-side? What is returned on a duplicate? Dedupe window? Can Transaction Inquiry return "not found" for an accepted-but-unprocessed request, and for how long?
4. Rate limits per environment; are 429 / `Retry-After` ever emitted?
5. Is the `status` code list exhaustive anywhere? (We treat it as "common codes".)

## 9. Appendix — live probe, 2026-10-08

`@agentbadge/cli` is not published on npm (`npm error 404`), so this reproduces its documented checks.

| URL | Status | Content-Type | CORS | Size | Verdict |
|---|---|---|---|---|---|
| `/llms.txt` | 200 | text/plain | `*` | 9.4 KB | ✅ |
| `/llms-full.txt` | 200 | text/plain | `*` | 12.5 KB | 🟡 identical to `/index.md` |
| `/robots.txt` | 200 | text/plain | `*` | 100 B | ✅ allows `/`, points at sitemap |
| `/sitemap.xml` | 200 | application/xml | `*` | 27.7 KB | ✅ HTML routes only |
| `/ai-sitemap.xml` | 200 | **text/html** | `*` | 2.9 KB | ❌ SPA shell (soft-404) |
| `/.well-known/agent-card.json` | 200 | **text/html** | `*` | 2.9 KB | ❌ SPA shell |
| `/.well-known/openapi` | 200 | **text/html** | `*` | 2.9 KB | ❌ SPA shell |
| `/.well-known/api-catalog` | 200 | **text/html** | `*` | 2.9 KB | ❌ SPA shell |
| `/.well-known/mcp.json` | 200 | **text/html** | `*` | 2.9 KB | ❌ SPA shell |
| `/openapi.json` | 200 | application/json | `*` | 830 KB | ✅ exists · 🟡 no `components`, no `securitySchemes`, only `x-docs-slug`; `client_ref_id` has no `maxLength`; 23/75 ops carry a 4xx/5xx |
| `/openapi.yaml` | 200 | text/html | `*` | — | ❌ SPA shell |
| `/api/specs` | 404 | application/json | — | — | ✅ honest 404 (BFF) |
| `/agent/eps.json` | 200 | application/json | `*` | 739 KB | ✅ |
| `/agent/index.json` | 200 | application/json | `*` | 33 KB | ✅ |
| `/index.md`, `/docs.md`, `/ai.md`, `/agents.md` | 200 | text/markdown | `*` | 1–12 KB | ✅ |
| `https://mcp.eko.in/context/healthz` | 200 | — | — | 56 B | ✅ |
| `https://mcp.eko.in/context/openapi.json` | 200 | — | — | 9.8 KB | ✅ (unlinked from the site) |
| `https://mcp.eko.in/transact/healthz` | 200 | — | — | 49 B | ✅ |

HTML `<head>` of `/` and `/docs/*`: only `<link rel="alternate" type="text/markdown">`. No `service-desc`, no JSON alternates.

Re-run (read-only):

```bash
for p in /llms.txt /llms-full.txt /robots.txt /sitemap.xml /ai-sitemap.xml \
  /.well-known/agent-card.json /.well-known/api-catalog /openapi.json /agent/eps.json; do
  printf "%-32s " "$p"; curl -sS -o /tmp/b -D /tmp/h -L "https://eps.eko.in$p"
  echo "$(head -1 /tmp/h | awk '{print $2}') $(grep -i '^content-type' /tmp/h | cut -d' ' -f2- | tr -d '\r') $(wc -c </tmp/b)B"
done
```
