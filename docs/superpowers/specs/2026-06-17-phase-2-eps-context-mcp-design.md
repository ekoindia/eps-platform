# Phase 2 — `@ekoindia/eps-context-mcp` (Design)

**Date:** 2026-06-17
**Status:** Approved; ready for writing-plans (after all phases brainstormed)
**Parent:** `2026-06-17-ai-native-agent-platform-roadmap-design.md`
**Depends on:** Phase 0 (`/agent/eps.json` bundle)

## Goal

The flagship AI-native feature: a **local** MCP server that gives any MCP-capable
coding agent (Claude Code, Cursor, opencode, Continue, Codex, Gemini CLI, …)
correct, token-efficient EPS context — generated from `api-specs.ts`, baked into
an npm package, **zero hosting / zero secrets / zero ops**.

> The bare `@ekoindia/eps-mcp` name stays reserved for a future *transactional*
> MCP. This is the **context** MCP only.

## Constraints (inherited)

- Static-first: ships as a locally-run npm package (`npx`), no server.
- **Secret-free:** never accepts or stores `access_key`/`secret-key`.
- Token efficiency: tiered/lazy tools — index first, detail on demand.

## Decisions (this phase)

1. **Location:** in-repo monorepo package `packages/eps-context-mcp/`, consumes
   the generated `/agent/eps.json`, published to NPM by CI.
2. **Signing:** secret-free `get_signing_snippet(language)` tool returning
   paste-ready backend code. No live signer.
3. **Freshness:** `eps.json` baked at publish (offline, version-pinned) **plus**
   optional `EPS_BUNDLE_URL` env to fetch the latest hosted bundle at startup.
4. **New deps (approved):** `@modelcontextprotocol/sdk`, `zod`, `tsup`
   (build) — scoped to this package only; does not touch the website tree.

## Repo / workspace setup

- Introduce npm workspaces: root `package.json` gains `"workspaces":
  ["packages/*"]`; the website stays at the repo root unchanged.
- `packages/eps-context-mcp/` — its own `package.json`, `tsconfig`, `tsup` build.
- The package's published artifact includes a **baked copy** of `eps.json`
  (copied from the site build's `/agent/eps.json` during the package build), so
  the npm package has no build-time dependency on a running site.

## MCP server

- **Transport:** stdio via `@modelcontextprotocol/sdk`. Entry `bin` so
  `npx -y @ekoindia/eps-context-mcp` works in any MCP client config.
- **Data load:** read baked `eps.json` from the package. If `EPS_BUNDLE_URL` is
  set, fetch + use that instead (fall back to baked on failure).
- **Search:** local, zero-dep. Token/substring scoring over the index fields
  (name, summary, path, category, product). No fuzzy-match library.

### Tools (tiered/lazy)

| Tool | Input | Returns |
|---|---|---|
| `list_apis` | `category?` | compact index (slug, name, method, path, summary) |
| `list_topics` | — | topic ids |
| `list_recipes` | — | recipe ids + names |
| `search` | `query` | ranked id list (no bodies) |
| `get_api` | `slug` | one endpoint, full resolved detail |
| `get_topic` | `topic` | auth/signing · errors · pricing · environments |
| `get_recipe` | `id` | one runbook (steps + branches) |
| `get_signing_snippet` | `language` | paste-ready backend signing code |
| `get_meta` | — | org, apiVersion, bundleVersion, source (baked/remote) |

- `get_topic('auth')` carries the backend-only warning.
- `get_signing_snippet` languages match the SDK set: PHP, Java, C#/.NET, JS/TS,
  Python, Go.
- Optional: expose topics/recipes as MCP **resources** for clients that list
  them; tools remain the primary, universally-supported surface.

## Install snippets (delivered via Phase 1 hub + packs)

Per-harness MCP config (`npx -y @ekoindia/eps-context-mcp`) for Claude Code,
Cursor, opencode, Continue, Codex, Gemini CLI — authored in Phase 4's coverage
work but linked from the `/agents` hub.

## Tests

- Tool contracts: each tool returns the documented shape (zod-validated).
- Lazy guarantee: `list_*` / `search` responses contain **no** full bodies.
- `get_signing_snippet` emits valid code per language (smoke: contains
  HMAC-SHA256 + base64 + timestamp; no `access_key` literal).
- Secret-free: no tool accepts an `access_key` parameter.
- Bundle load: baked path works offline; `EPS_BUNDLE_URL` override + fallback.

## Out of scope

Transactional capabilities, live credentials, hosted runtime. SDK codegen is
Phase 3.

## Next step

Continue to Phase 3 (backend SDKs).
