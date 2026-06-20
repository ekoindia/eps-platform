# Phase 3 — Backend-Only Signed SDKs (Design)

**Date:** 2026-06-17
**Status:** Approved; ready for writing-plans (after all phases brainstormed)
**Parent:** `2026-06-17-ai-native-agent-platform-roadmap-design.md`
**Depends on:** Phase 0 (`/agent/eps.json` bundle)

## Goal

Give developers (and their agents) working, correct EPS clients in their own
language, with the **HMAC signing baked in correctly** — the thing generic
OpenAPI codegen cannot express and gets wrong. **Backend-only by design.**

## Constraints (inherited)

- Static packages (NPM / Packagist / Maven / NuGet / PyPI / Go module).
- **Backend-only.** `access_key` is server-side-only; the SDK computes
  `secret-key` server-side. Generated README + a runtime guard make clear the
  SDK must never run in a browser/frontend.
- Generated from `eps.json`; never re-reads the source of truth.

## Decisions (this phase)

1. **Surface:** **thin signed client** — config + HMAC signing + request +
   error mapping + a generic `call(endpoint, params)` helper. Works for all
   endpoints immediately; sidesteps the partly-unreconciled response shapes
   (flagged in `api-specs.ts`). Typed per-endpoint methods are a later add.
2. **Codegen:** **hybrid** — hand-maintained signing/runtime **core** per
   language (stable, security-critical, audited), plus a **generated thin data
   surface** (endpoint catalog, constants, environments, error codes) emitted
   from `eps.json`.
3. **First cut:** **PHP + JS/TS (Node)**, with the generator structured so
   Java, C#/.NET, Python, Go follow as repeatable adds (same core contract).
4. **Companion exports:** **Postman + Bruno** collections with a pre-request
   script that computes `secret-key`.

## Architecture

```
/agent/eps.json ──► build-sdk-surface.ts (pure) ──► generated surface (per lang)
                                                           │
   handwritten core (per lang) ───────────────────────────┤
                                                           ▼
                                         packages/sdk-php, packages/sdk-js, …
```

### Signing core (per language, handwritten)

Implements exactly: `secret-key = base64(HMAC-SHA256(message = timestamp_ms,
key = base64(access_key)))`, sets headers `developer_key`, `secret-key`,
`secret-key-timestamp`, `content-type: application/json`. Reads config
(env/keys), selects environment base URL, performs the request, maps the
response envelope + error codes.

- **Frontend guard:** where detectable (e.g. JS checks for a browser/`window`
  global), throw with a clear backend-only message; README states it plainly.
- **Client-level common params:** `initiator_id` and `user_code` are
  near-constant per developer, so the client constructor accepts optional
  `initiatorId` / `userCode` (camelCase opts; snake_case on the wire). They are
  merged into every `call()` *before* the spec-driven required-param check, so
  validation still passes; a per-call `params` value overrides the default, and
  an explicit `null` clears it (then fails required validation as expected). The
  generated surface is unchanged — both stay `required` in the endpoint catalog.

### Generated surface (per language, from `eps.json`)

- Endpoint catalog (slug → method + path + required params), environment base
  URLs, error-code map, SDK/api version. No business logic — pure data the core
  consumes for `call(slug, params)`.

### Generator — `src/lib/sdk/build-sdk-surface.ts` (or `packages/` tool)

Pure, deterministic (no `Date`), consumes `eps.json`, emits each language's
surface file via per-language templates. Mirrors the bundle/openapi builders.

## Golden signing conformance

- A shared **golden vector** (fixed `access_key` + fixed timestamp → expected
  `secret-key`) derived from the documented algorithm.
- Every language's core has a unit test asserting it reproduces the vector —
  guarantees cross-language signing equivalence.

## Postman / Bruno

- Generated from `eps.json` (reuse OpenAPI where helpful). Each request carries
  a pre-request script computing `secret-key` from collection variables
  (`access_key`, `developer_key`) — clearly marked for local/testing use, not
  for committing real secrets.
- Emitted as static files (linked from the `/agents` hub).

## Packaging / publishing

- PHP → Packagist (Composer), JS/TS → NPM. Later: Maven Central (Java), NuGet
  (C#), PyPI (Python), Go module (tagged repo path).
- CI publishes on version bump; SDK version tracks the bundle/api version.

## Tests

- Golden signing vector per language.
- Frontend guard triggers in a simulated browser env (JS).
- Generated surface covers every `API_SPECS` endpoint.
- `call(slug, …)` builds the correct method/path/headers (mocked transport).
- Postman/Bruno: pre-request script computes the golden secret-key.

## Out of scope

Typed per-endpoint methods/models (later), languages beyond PHP + JS/TS in the
first cut (repeatable adds), mock server (Phase 4).

## Next step

Continue to Phase 4 (depth + harness coverage).
