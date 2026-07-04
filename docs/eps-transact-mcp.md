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

CI (`.github/workflows/ci.yml`): `transact:test` (builds sdk-js dist first), independent compose validation for each stack, a shared-poller image build, and a container build + `/healthz` smoke.

## Known risk: environment base URLs (verify before first partner use)

The bundle's environments are portless (`https://staging.eko.in/ekoapi/v3`, `https://api.eko.in/ekoicici/v3`). The eko-eps research repo **live-verified UAT with port** `:25004` (and documented Eko's own docs contradicting themselves). The gated UAT smoke (`src/uat-smoke.test.ts`) settles this:

```sh
EPS_UAT_DEVELOPER_KEY=… EPS_UAT_ACCESS_KEY=… EPS_UAT_INITIATOR_ID=… \
  npm test -w @ekoindia/eps-transact-mcp
```

If it fails with `UPSTREAM_ERROR`, fix `meta.environments` in the SSOT (the api-specs layer) — that corrects docs, Scalar try-it, SDKs, and this server in one edit. Do not patch URLs here.

## Deployment (standalone stack — co-locatable but independent)

eps-transact-mcp deploys as **its own compose project** and can run on a different host from eps-backend (e.g. backend on Vercel, transact on a cheap VM). It shares nothing with the backend stack; co-locating on one VM just means running two separate projects.

Artifacts live under `packages/eps-transact-mcp/deploy/`: `docker-compose.prod.yml` (the `eps-transact-mcp` service + its own auto-pull `poller` + `transact-poller-state` volume + `transact-egress` network) and `deploy.env.sample`.

1. **Image**: `.github/workflows/deploy-eps-transact-mcp.yml` publishes `ghcr.io/ekoindia/eps-transact-mcp:{sha,prod}` on green-CI pushes to `main` (stale-run guard; bakes bundles before `docker build` because `data/` is gitignored).
2. **Poller image**: `.github/workflows/deploy-poller.yml` publishes the **shared** `ghcr.io/ekoindia/eps-poller:{sha,prod}` (amd64) when `deploy/poller/{poll.sh,Dockerfile}` change, plus `workflow_dispatch` for base-image/security rebuilds. The package is **public** — no `docker login` needed to pull it. (eps-backend still `build:`s the same Dockerfile from its on-VM checkout; only transact consumes the published image. Both derive from one `poll.sh`.)
3. **Compose**: copy `deploy.env.sample` → `deploy.env` (`EPS_TRANSACT_MCP_IMAGE=…`, optional `POLLER_ALERT_WEBHOOK`), drop a `.ghcr-auth.json` for the poller's `skopeo` app-image lookups, then bring the stack up with the invariant form:
   ```sh
   docker compose -p eps-transact-mcp --project-directory /deploy \
     --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml up -d
   ```
4. **Reverse proxy**: expose `mcp.eko.in` (TLS) → `127.0.0.1:8788`. The proxy **must set/overwrite `x-real-ip`** (rate-limit fallback trusts it) and must not expose :8788 directly. Avoid response buffering on `/mcp`.

### Migration from the old co-located service

The transact service used to live inside `packages/eps-backend/docker-compose.prod.yml`. Removing it there does **not** stop the running container (the backend poller only touches `eps-backend`). On the existing VM, before standing up the new stack:

```sh
# stop/remove the orphaned old container
docker compose -p eps-backend --project-directory /deploy \
  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml up -d --remove-orphans
# (or: docker rm -f <old eps-transact-mcp container>)
```

Ensure port `8788` is free, then bring up the standalone `eps-transact-mcp` project (step 3). **Bootstrap order:** the `eps-poller:prod` image must be published once (merge the poller change, or `workflow_dispatch` `deploy-poller.yml`) before the transact stack can pull it.

### Keeping the remote server fresh

Fully hands-off now — no manual pull:

- **Image current per merge** — `deploy-eps-transact-mcp.yml` retags `:prod` on every green `main`. "Update the tools" = "merge the spec change".
- **Auto-pull** — the transact stack's own poller watches `eps-transact-mcp:prod` and recreates the service when the digest changes, exactly like eps-backend's. It runs the **same** `poll.sh`, configured via env for this stack: `SERVICE=eps-transact-mcp`, `DEPLOY_ENV_KEY=EPS_TRANSACT_MCP_IMAGE`, `REDIS_REQUIRED=0` (no Redis gate), `READYZ_URL=…/healthz`, `ALERT_SERVICE=eps-transact-mcp`. A distinct `transact-poller-state` volume keeps its lock/HOLD/last_good separate from the backend's.
- **Client always current** — remote users hit the URL and get whatever `:prod` the poller has deployed. Local stdio users get `@latest` + the startup update check (above).

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

The stdio bin (`src/update-check.ts`, wired only into `src/stdio.ts`) does a best-effort startup check against the npm `latest` dist-tag and prints a one-line stderr nudge when the running version is behind — silent on any failure, `EPS_NO_UPDATE_CHECK=1` opts out. The HTTP server deliberately skips it (remote users can't self-update; stderr there is operator log noise). Published via the content-gated `release.yml` auto-release; the documented install command pins `@latest` so `npx` re-resolves newest each launch. See the [package README](../packages/eps-transact-mcp/README.md#staying-up-to-date).

**Publishing — bootstrap done (2026-07-02).** `0.1.0` was published manually (`npm publish` from the package dir — OIDC can't create a brand-new scoped package), and the npm **Trusted Publisher** (repo + `release.yml`) is configured. From `0.1.1` on, `release.yml` auto-publishes content-changed versions tokenless via OIDC, same as the other `@ekoindia/*` packages.

## Phase 2 candidates (deliberately not built)

- OAuth 2.1 resource-server auth — needed only for claude.ai-web zero-install connectors; header auth covers Claude Code/API/Cursor today.
- Server-side partner entitlement/allowlist storage — requires the blocked Eko credential-issuance contract (roadmap Phase 5) to be meaningful.
- Financial (money-movement) tools — only behind explicit human-confirm gates, per roadmap.
- Shared-KV rate limiting.
- Multi-arch (`linux/arm64`) poller/app images — build only if a transact host is ever ARM; amd64-only today.
