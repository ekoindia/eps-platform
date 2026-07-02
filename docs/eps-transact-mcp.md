# EPS Transactional MCP Server (`packages/eps-transact-mcp`)

Remote + local MCP server whose tools **execute** Eko EPS verification APIs with the partner's own credentials. Phase 1 surface: every `category: "verification"`, non-`financial` spec (30 endpoints at time of writing). Partner-facing usage lives in the [package README](../packages/eps-transact-mcp/README.md); this doc covers architecture, security posture, and operations.

## Architecture

```
api-specs.ts ──(vite build)──▶ dist/agent/eps.json ──(bake)──▶ data/eps.json
                                        │                            │
                                        ▼                            ▼
                              sdk-surface.json ──▶ @ekoindia/eps-sdk (EpsClient)
                                                             │
   MCP client ──POST /mcp (headers: keys, env, allowlist)──▶ │
     Hono app ─ per-request stateless Server+Transport ──────┘──▶ Eko UAT/prod
```

- **Tool generation** (`src/tools.ts`): filters the baked bundle to verification/non-financial, emits one tool per endpoint (`eps_<slug>`), JSON Schema from `requestParams`, billing hint in every description. Startup assertion fails the build if a spec ever requires a header the executor can't send.
- **Execution** (`src/server.ts`): low-level MCP `Server` (plain JSON Schema tools — the high-level API is Zod-only). `tools/call` → `new EpsClient(...).call(slug, args)` from `@ekoindia/eps-sdk`: HMAC `secret-key` signing, required/type validation, path/query/JSON-body encoding all come from the SDK, itself baked from the same bundle. A parity test (`parity.sdk-surface.test.ts`) guards the two baked artifacts against skew.
- **Remote transport** (`src/http.ts`): stateless streamable HTTP — a fresh `WebStandardStreamableHTTPServerTransport` (`sessionIdGenerator: undefined`, JSON responses) per POST. `initialize`, `tools/list`, `tools/call` each stand alone; no sessions, no GET/SSE stream (405, spec-legal; verified against Claude Code).
- **Local transport** (`src/stdio.ts`): same core, credentials from env vars, published as the package bin.

## Security posture

| Concern                     | Position                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential custody          | **Pass-through only.** Keys arrive as per-request headers, are used to sign, and vanish with the request. Nothing in KV/disk. Leak blast radius = one request in memory.                                                                                                                                      |
| PII (PAN/Aadhaar/bank data) | Bodies and headers are never logged — access log carries tool _name_ only, extracted from a guarded clone of the request. Error messages are curated (`sanitizeError`): upstream/network error text is replaced (it can echo request data); only EpsClient validation messages (param _names_) pass through.  |
| Tool scoping                | `X-Eko-Allowed-Apis` (required; `*` = all) filters `tools/list` and gates `tools/call`. **Voluntary scoping, not entitlement** — it lives in partner-controlled client config, out of the model's reach, but the Eko credentials remain the true authz boundary.                                              |
| Environment safety          | `uat` is the default; `production` must be sent explicitly. Unknown values are rejected (400), mapped internally to the SDK's `sandbox`/`production` ids.                                                                                                                                                     |
| Rate limiting               | Best-effort **abuse throttling**, not enforcement: in-memory fixed window (60 calls / 10 min) keyed `env + sha256(developerKey)`, IP fallback via proxy-set `x-real-ip`. Per-process; resets on restart. Move to shared Redis KV (eps-backend's `enforceRateLimit` pattern) if this ever runs multi-instance. |
| Process isolation           | Separate container from eps-backend **on purpose**: that process holds admin GitHub OAuth tokens (GitOps deploy rights). The compose file co-location is an ops convenience; the security boundary is the container.                                                                                          |
| Upstream hygiene            | `withTimeout` (10s) wraps fetch; hung Eko sockets can't accumulate.                                                                                                                                                                                                                                           |

## Single source of truth pipeline

`npm run build` (root) → vite emits `dist/agent/eps.json` → `bake:all` copies it into this package's `data/` (plus sdk-surface into sdk-js). Editing `src/lib/data/api-specs.ts` and rebuilding is ALL it takes to add/fix a tool — no code changes here. New verification specs appear automatically; financial specs are excluded automatically.

CI (`.github/workflows/ci.yml`): `transact:test` (builds sdk-js dist first), compose validation with both image vars, and a container build + `/healthz` smoke.

## Known risk: environment base URLs (verify before first partner use)

The bundle's environments are portless (`https://staging.eko.in/ekoapi/v3`, `https://api.eko.in/ekoicici/v3`). The eko-eps research repo **live-verified UAT with port** `:25004` (and documented Eko's own docs contradicting themselves). The gated UAT smoke (`src/uat-smoke.test.ts`) settles this:

```sh
EPS_UAT_DEVELOPER_KEY=… EPS_UAT_ACCESS_KEY=… EPS_UAT_INITIATOR_ID=… \
  npm test -w @ekoindia/eps-transact-mcp
```

If it fails with `UPSTREAM_ERROR`, fix `meta.environments` in the SSOT (the api-specs layer) — that corrects docs, Scalar try-it, SDKs, and this server in one edit. Do not patch URLs here.

## Deployment (single VM, beside eps-backend)

1. **Image**: `.github/workflows/deploy-eps-transact-mcp.yml` publishes `ghcr.io/ekoindia/eps-transact-mcp:{sha,prod}` on green-CI pushes to `main` (same stale-run guard as eps-backend; extra step: it bakes bundles before `docker build` because `data/` is gitignored).
2. **Compose**: service `eps-transact-mcp` in `packages/eps-backend/docker-compose.prod.yml` — `127.0.0.1:8788:8788`, `eps-egress` network only (no redis, no internal net, no `.env`). Set `EPS_TRANSACT_MCP_IMAGE` in `deploy.env`, then `docker compose … up -d eps-transact-mcp`.
3. **Manual deploy (current path)**: after a merge to `main` publishes a fresh `:prod`, pull it on the VM — `docker compose … pull eps-transact-mcp && docker compose … up -d eps-transact-mcp`. The image is always current per merge (CI bakes the bundle + publishes); only this pull is manual.
4. **Reverse proxy**: expose `mcp.eko.in` (TLS) → `127.0.0.1:8788`. The proxy **must set/overwrite `x-real-ip`** (rate-limit fallback trusts it — same SECURITY note as eps-backend) and must not expose :8788 directly. Avoid response buffering on `/mcp`.

### Keeping the remote server fresh

Two independent levers, both already in place:

- **Image is current per merge** — `deploy-eps-transact-mcp.yml` rebuilds with a freshly-baked bundle and retags `:prod` on every green `main`. So "update the tools" = "merge the spec change"; no separate step.
- **Client always current** — remote users hit a URL, so they get whatever `:prod` is deployed the instant the VM pulls it. Local stdio users get `@latest` + the startup update check (above).

**Auto-pull follow-up (not done — needs a real poller change, NOT compose-only).** The existing `deploy/poller/poll.sh` cannot be reused by env overrides alone: it hardcodes the `eps-backend` service name (`dc ps/pull/up eps-backend`), writes only `EPS_BACKEND_IMAGE` via a whole-file rewrite (a second poller would clobber the backend's pin), **mandates a Redis ping gate** (transact has no Redis → every deploy would be paused), defaults `READYZ_URL` to the backend's `/readyz` (transact exposes `/healthz`), and alerts as `"service":"eps-backend"`. Doing it right means parameterizing the poller — service name, env key, a `REDIS_REQUIRED` toggle, health URL/mode, alert service name — and making `write_deploy_env` preserve unrelated keys, plus a distinct `STATE_DIR` volume (sharing `/state` collides the lock/HOLD/last_good files) and a poller-shim oneshot test for the transact service. Until then, step 3's manual pull is the path.

## Test map

| File                         | Proves                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.test.ts`              | exposure = exactly verification ∧ non-financial (registry-derived, not a hardcoded count); schema shape; naming; header assertion                                      |
| `parity.sdk-surface.test.ts` | eps.json ↔ sdk-surface same bundle version; per-slug method/path/required parity                                                                                       |
| `server.test.ts`             | signing (deterministic `signSecretKey` vs fixed clock), env→base-URL, allowlist gating, identity-param demotion+injection, error sanitization (no PII passthrough)     |
| `http.test.ts`               | 401/400 header validation, stateless initialize/list/call over independent POSTs, allowlist end-to-end, 429 throttle, access-log redaction (incl. malformed JSON body) |
| `uat-smoke.test.ts`          | env-gated live proof of base URL + auth + encoding                                                                                                                     |
| `update-check.test.ts`       | strict x.y.z compare (newer/equal/older/prerelease→unknown); silent on offline/404/bad-body; `EPS_NO_UPDATE_CHECK=1` skips the fetch                                   |

## Staying up to date

The stdio bin (`src/update-check.ts`, wired only into `src/stdio.ts`) does a best-effort startup check against the npm `latest` dist-tag and prints a one-line stderr nudge when the running version is behind — silent on any failure, `EPS_NO_UPDATE_CHECK=1` opts out. The HTTP server deliberately skips it (remote users can't self-update; stderr there is operator log noise). Published via the content-gated `release.yml` auto-release; the documented install command pins `@latest` so `npx` re-resolves newest each launch. See the [package README](../packages/eps-transact-mcp/README.md#staying-up-to-date). **User action:** the package needs an npm **Trusted Publisher** (repo + `release.yml`) configured on npmjs.com, like every other `@ekoindia/*` package, before the first OIDC publish succeeds.

## Phase 2 candidates (deliberately not built)

- OAuth 2.1 resource-server auth — needed only for claude.ai-web zero-install connectors; header auth covers Claude Code/API/Cursor today.
- Server-side partner entitlement/allowlist storage — requires the blocked Eko credential-issuance contract (roadmap Phase 5) to be meaningful.
- Financial (money-movement) tools — only behind explicit human-confirm gates, per roadmap.
- Shared-KV rate limiting.
- Poller auto-pull for the remote image (see the deploy section — needs a parameterized `poll.sh`, not compose-only).
