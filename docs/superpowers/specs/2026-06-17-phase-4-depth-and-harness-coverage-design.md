# Phase 4 — Depth & Harness Coverage (Design)

**Date:** 2026-06-17
**Status:** Approved; ready for writing-plans (after all phases brainstormed)
**Parent:** `2026-06-17-ai-native-agent-platform-roadmap-design.md`
**Depends on:** Phase 0 (bundle/recipes), Phase 1 (packs), Phase 2 (MCP)

## Goal

Compound on the stable 0–3 work: let agents develop EPS integrations **offline**,
surface recipes richly, and **meet developers wherever they are** with thin
native packaging on top of the open-standard coverage already shipped.

## Constraints (inherited)

Static-first, offline, deterministic, zero-secrets. Everything derived from
`eps.json`; no new source of truth.

## Decisions (this phase)

1. **Mock/sandbox:** local **mock server (npm) + exported golden fixtures**.
2. **Claude Code plugin:** bundles the **MCP + skills + slash commands**.
3. **Harness coverage:** native **Claude Code plugin** + a **generated
   per-harness install matrix** for the rest.

## Workstream A — Mock server + fixtures

- `packages/eps-mock-server/` — local npm server replaying `eps.json`
  `sampleSuccessResponse` (and error scenarios) per endpoint.
- **Recipe-aware:** honours branch conditions (e.g. unknown sender →
  `response_status_id 463`) so a multi-step flow can be exercised offline.
- **Golden fixtures:** export request/response pairs (from the same bundle
  samples) as static JSON for SDK tests, agent evals, and CI.
- Offline + deterministic; **no proxy** to the real sandbox (keeps zero-secrets).
- Tests: every endpoint has a replayable fixture; recipe branches resolve.

## Workstream B — Recipe surfacing (derivative)

- MCP `get_recipe` (Phase 2) already serves runbooks; here we add **worked
  examples** per recipe in the SDK READMEs + the `/agents` hub, generated from
  the recipe data + SDK `call(...)` surface. No new data — richer presentation.

## Workstream C — Claude Code plugin

- `packages/claude-plugin-eps/` (or marketplace layout) bundling:
  - **MCP** `@ekoindia/eps-context-mcp` preconfigured.
  - **Skills:** `integrate-eps`, `sign-request`, `run-a-recipe`.
  - **Slash commands:** `/eps` (search/integrate helpers).
- One install = full EPS experience in Claude Code.

## Workstream D — Generated install matrix

- A pure generator emits, from the bundle, a **per-harness install matrix**
  (config + file placement) covering: Claude Code, Codex, Cursor, opencode,
  Continue, Gemini CLI, GitHub Copilot, pi, Windsurf, Cody, Zed, aider,
  JetBrains AI.
- For each: the MCP config snippet (`npx -y @ekoindia/eps-context-mcp`) and/or
  the correct AGENTS.md / rules-file placement (reusing Phase 1 packs).
- Rendered on the `/agents` hub + included in the packs. Standards already
  provide the actual capability; this documents the wiring per tool.

## Coverage model (how each harness is served)

| Mechanism | Harnesses |
|---|---|
| AGENTS.md / rules files (Phase 1) | Copilot, Cursor, Gemini CLI, opencode, pi, aider, Windsurf, Cody, Zed, JetBrains AI |
| MCP (Phase 2) | Claude Code, Cursor, opencode, Continue, Codex, Gemini CLI |
| Native plugin (this phase) | Claude Code (full bundle) |
| Install matrix (this phase) | all of the above — documents the wiring |

## Tests

- Mock server: replays every endpoint; recipe branch conditions honoured.
- Golden fixtures present for every endpoint.
- Install-matrix generator: an entry per listed harness; MCP snippets valid.
- Claude Code plugin: manifest valid; skills/commands load.

## Out of scope

Hosted/transactional features (deferred in the roadmap). Native plugin manifests
for harnesses beyond Claude Code (install matrix covers them; promote to native
later if demand warrants).

## Next step

All phases (0–4) brainstormed. At dev time, run writing-plans per phase, in
order (0+1 → 2 → 3 → 4).
