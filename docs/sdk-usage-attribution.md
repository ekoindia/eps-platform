# SDK usage attribution (TODO — planned, not built)

> Status: **TODO**. Planned 2026-10-26, nothing implemented. Pick up from "Steps".

## Goal

Count how many partners call EPS through our SDKs vs integrating the REST APIs
directly.

## Decision

Every SDK sends a `source` request param on every call:
`source=API-SDK-<LANG>`. Non-SDK channels get their own tag so they don't
inflate SDK or "direct" numbers.

| Caller                          | `source`         |
| ------------------------------- | ---------------- |
| sdk-js                          | `API-SDK-JS`     |
| sdk-python                      | `API-SDK-PYTHON` |
| sdk-php                         | `API-SDK-PHP`    |
| sdk-go                          | `API-SDK-GO`     |
| sdk-java                        | `API-SDK-JAVA`   |
| eps-transact-mcp (uses sdk-js)  | `API-MCP`        |
| docs try-it proxy (eps-backend) | `API-TRYIT`      |

Alternative reviewed and not chosen: a `User-Agent` / `X-EPS-Client` header
(keeps telemetry out of payloads, no collision). Revisit if the Eko gateway
turns out to log headers but not params.

## Known risks

- **`source` is already a business param.** PAN fetch
  (`src/lib/data/api-specs.ts`, `/tools/kyc/fetch-pan`: "Use 'API' for
  server-to-server calls") and bulk PAN `entries[].source`. The field may drive
  endpoint behaviour, so "accepted silently" is not proof it's harmless.
- **Payload placement.** The param goes wherever the SDK encodes params: GET
  query, JSON body or multipart field. The upstream may reject, store, or ignore
  unknown fields. Not verified yet.
- **Untagged ≠ direct REST.** Older SDK versions never send the tag.
- **No version in the tag.** Upgrade rollout can't be measured. Optional later:
  `API-SDK-JAVA-3.1.0`.
- **Self-reported and spoofable.** The HMAC signs only the timestamp. Use the tag
  for analytics, never for auth or billing.

## Design

- **SDK default, caller wins.** Add `source` to each SDK's defaults merge, at the
  same spot as `initiator_id`. Caller params spread after it, so an explicit
  `source` (PAN's `API`) is kept. Ceiling: PAN calls that pass an explicit
  `source` lose attribution.
- **Endpoints that declare `source`.** Audit them and keep their documented
  default. Use a shared exclusion rule driven from `sdk-surface.json` (endpoint
  declares a `source` param → no SDK default). Every SDK reads the same rule.
- **Constructor override** `source?: string`, so MCP can set `API-MCP` without
  forking sdk-js.
- **Channel precedence.** For MCP and try-it, the channel tag must not be
  overridden by a forwarded `source=API` or an SDK default. Decide the rule
  separately for endpoints that require a business value.
- **Top level only.** Never touch nested `entries[].source`.
- Retries and independently built status-check requests must carry the tag too
  (sdk-js `client.ts` status-check params, ~L454–462).

## Files (one merge point each)

- `packages/sdk-js/src/client.ts`: opts interface (~L311), defaults merge
  (~L486), status-check params (~L462)
- `packages/sdk-python/src/eps_sdk/client.py`, `packages/sdk-php/`,
  `packages/sdk-go/`, `packages/sdk-java/src/main/java/in/eko/eps/EpsClient.java`:
  same pattern
- `packages/eps-transact-mcp/src/server.ts` (~L184 `new EpsClient`): pass
  `source: "API-MCP"`
- `packages/eps-backend/src/http/tryitProxy.ts` (~L169 outbound): set `API-TRYIT`
- `docs/sdk-golden-vector.md`: new "Source tag conformance" section with the
  values, the precedence rules and the exclusion rule
- SDK READMEs: one line saying `source` is sent and how to override it

## Steps

1. **Gate (UAT + Eko backend):**
   - A sample GET, JSON POST and multipart call with an unknown `source`
     succeeds, with unchanged behaviour.
   - The tag shows up **unchanged in Eko's stored data / reporting** for all
     three encodings. "Request succeeded" is not enough.
   - Confirm the `developer_key` → partner mapping used for counting.
2. Implement in sdk-js and add a conformance section to `sdk-golden-vector.md`.
3. Port to python, php, go and java.
4. Tag MCP and try-it.
5. UAT smoke per SDK, then ship.

## Verification

- Per SDK: GET, JSON, multipart, retry and status-check carry the default. An
  explicit `source` wins (outside channel rules). Endpoints that declare
  `source` keep their documented value. The constructor override works.
- MCP: outgoing request has `API-MCP`, even when the tool input forwards a
  `source`.
- Try-it (`tryitProxy.test.ts`): `API-TRYIT` applied per the precedence rule.

## Reporting rules (define before first report)

- Count distinct partners, not requests, over a fixed window (e.g. 30 days).
- Buckets: SDK-only, direct/untagged-only, mixed (SDK + untagged in window), and
  MCP/try-it-only. A partner on several SDK languages counts once in SDK, with a
  per-language breakdown.
- Exclude UAT traffic.
