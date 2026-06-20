# AI-Native Agent Platform — Roadmap Design

**Date:** 2026-06-17
**Status:** Approved spine + sequencing; per-phase specs to follow
**Owner:** Eko EPS Platform

## 1. Goal

Position the EPS developer platform as **AI-native** and make integration trivial
for developers using *any* AI coding agent/IDE. Two outcomes:

1. **Differentiation** — a real, demonstrable AI-native edge over competitors.
2. **Developer ease** — agents integrate EPS APIs correctly on the first try,
   including the non-obvious HMAC signing that generic tooling gets wrong.

Everything is **auto-generated from the single source of truth** (`api-specs.ts`
+ the shared `api-specs-common.ts` / `api-auth.ts` / `api-error-codes.ts` layer),
so there is never a second content source to maintain.

## 2. Guiding constraints

- **Static-first.** Prefer build-time/static artifacts and locally-run packages
  (npm/pip/composer) over hosted services. A Node.js backend is added only when
  *truly required*; defer such items. (Rust only if a service is perf-critical.)
- **DRY.** One canonical machine bundle; every downstream artifact consumes it,
  never re-reads the source of truth. (Continues the existing
  `pure data → vite plugin → static artifact` pattern, e.g. `build-openapi.ts`.)
- **Security.** The `access_key` is server-side-only (`api-auth.ts`). Any
  generated code that computes `secret-key` / `secret-key-timestamp` is
  **backend-only**; frontend signing is forbidden and guarded against.
- **Token efficiency.** Agent-facing context is **tiered/lazy** — never dump the
  whole doc set; let the agent list topics/APIs, then fetch only what it needs.

## 3. The unlock — a *local* context MCP, not a hosted one

Context7 is remote because it indexes the world's docs. EPS only needs *its own*
small, static specs — already in `api-specs.ts`. So the flagship MCP ships as a
**local npm package** with the spec bundle baked in at build time. It runs on the
developer's machine, works across MCP-capable harnesses, and needs **zero
hosting, zero secrets, zero ops**. The "AI-native" headline without a server.

> **Naming.** The local context server is `@ekoindia/eps-context-mcp`
> (GitHub/NPM org: `ekoindia`). The bare name `@ekoindia/eps-mcp` is
> **reserved** for a future *transactional* MCP that actually performs payments
> and verifications (out of scope here — it needs a runtime + live credentials).

## 4. Architecture spine (build once, feed everything)

```
api-specs.ts ──► build-agent-bundle.ts (pure, tested) ──► /agent/eps.json
   (SoT)              (sibling of build-openapi.ts)          (canonical bundle)
                                                                  │
        ┌──────────────┬───────────────┬────────────┬────────────┤
        ▼              ▼               ▼            ▼            ▼
  context-mcp     context packs    signed SDKs   recipes     postman/bruno
 (npx, local)   (AGENTS.md, etc)  (backend only) (runbooks)  (static files)
```

- **`eps.json`** — the canonical, versioned machine bundle: endpoints, params,
  request/response shapes, error codes, auth/signing scheme, environments,
  pricing, and recipes. Built by a new pure `build-agent-bundle.ts` (mirrors
  `build-openapi.ts`: no I/O, deterministic, unit-tested, byte-stable).
- **Recipes data layer** — a lightweight, machine-readable model of multi-step
  flows your spec descriptions already encode (e.g. DMT: get-sender → onboard →
  transact; `response_status_id 463 → onboard`). New small data module, derived
  from / cross-referencing `api-specs.ts`.
- Every downstream artifact consumes `eps.json` only.

## 5. Prioritized roadmap

Ordered so each phase ships independently and value compounds. Scored loosely on
**Differentiation × Dev-value ÷ Effort**, static-first.

### Phase 0 — Spine (foundation)
- `build-agent-bundle.ts` → `/agent/eps.json` (canonical bundle).
- Recipes data layer (initial set of the highest-value multi-step flows).
- **Runtime:** static. **Enables:** every later phase.

### Phase 1 — Reach (quick win)
- **Agent context packs**, generated + downloadable from the portal:
  - `AGENTS.md` (cross-tool standard), `CLAUDE.md`, `.cursorrules`,
    `.github/copilot-instructions.md`, and equivalents.
  - Extend the existing `llms.txt` with agent entrypoints (bundle + MCP install).
- Each pack encodes the **HMAC signing quirk** and error handling so *every*
  agent gets auth right, even with no MCP support.
- **Runtime:** static. Ships in days; works in every harness today; sets the
  narrative. **PM value:** copy-paste a pack and ask their agent in plain English.

### Phase 2 — Flagship (`@ekoindia/eps-context-mcp`)
- Local stdio MCP, spec bundle baked in. **Tiered/lazy tools** (token-efficient):
  - `list_apis` / `list_topics` → compact index only (id, name, 1-line summary).
  - `search(query)` → ranked id list (no full bodies).
  - `get_api(id)` → full spec for one endpoint on demand.
  - `get_topic(topic)` → auth | signing | pricing | errors | environments.
  - `get_recipe(id)` → one multi-step runbook.
  - `sign_request(...)` → reference HMAC helper (docs/example; backend context).
- The agent fetches the index, then drills in — never the whole doc set.
- **Runtime:** static (runs locally via `npx`).

### Phase 3 — Working code (backend-only signed SDKs)
- SDKs with **HMAC signing baked in correctly** — fixing what generic OpenAPI
  codegen breaks. **Backend-only by design**; generated README + a runtime guard
  make clear `access_key`/`secret-key` must never reach a frontend.
- Language targets (priority by user base): **PHP → Java → C#/.NET → JS/TS
  (Node) → Python → Go.** Go is a first-class target (common for fintech
  backends). Kotlin is covered via the JVM/Java artifact.
- Companion static exports: **Postman / Bruno** collections (with signing
  pre-request scripts), plus HTTPie/curl snippets.
- **Runtime:** static packages (NPM/Packagist/Maven/NuGet/PyPI).

### Phase 4 — Depth & ubiquity ("meet developers wherever they are")
- Recipes surfaced richly through MCP + packs + SDK examples.
- **Local mock/sandbox server** (npm) from sample responses — offline agent dev
  and eval fixtures.
- **Harness coverage strategy** — most harnesses are already covered by *open
  standards* from Phases 1–2, so this phase is mostly thin per-harness packaging,
  not N rewrites:
  - **Via AGENTS.md / rules files (Phase 1):** GitHub Copilot, Cursor, Gemini
    CLI, opencode, pi, aider, Windsurf, Cody, Zed, JetBrains AI.
  - **Via MCP (Phase 2):** Claude Code, Cursor, opencode, Continue, Codex,
    Gemini CLI, and other MCP clients.
  - **Native plugin manifests (this phase):** Claude Code plugin (bundles MCP +
    skills + slash commands); thin manifests/marketplace listings for Codex,
    Cursor, opencode, etc., as each ecosystem warrants.

### Deferred (only "when really required")
- Live in-portal "ask the docs" agent / live codegen — needs a runtime.
- Hosted HMAC signing proxy — partial infra already exists (Scalar try-it CORS
  proxy + `beforeRequest` HMAC plugin); expose only if a real need appears.
- Transactional `@ekoindia/eps-mcp` (payments/verifications) — separate product,
  needs runtime + live credentials.

## 6. Sequencing rationale

- **0 before all** — the bundle + recipes are consumed by everything; build once.
- **1 before 2** — packs are days of work, reach every harness immediately, and
  establish the narrative while the MCP is built.
- **2 = flagship** — the headline differentiation and the direct Context7 answer.
- **3 after 2** — working code is higher effort; the signing moat is best proven
  in the MCP/packs first.
- **4 last** — packaging + depth that compounds on a stable 0–3.

## 7. Out of scope (this roadmap)

Anything requiring a persistent backend, live credentials, or real transactions.
Those get their own product decisions, not SoT-codegen.

## 8. Next step

Each phase gets its own brainstorm → spec → plan cycle. First up: **Phase 0 + 1**
(spine + quick-win packs), as a single first implementation spec.
