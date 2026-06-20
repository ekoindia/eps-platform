# Phase 0 + 1 — Spine & Context Packs (Design)

**Date:** 2026-06-17
**Status:** Approved; ready for writing-plans (after all phases brainstormed)
**Parent:** `2026-06-17-ai-native-agent-platform-roadmap-design.md`

## Goal

Build the architecture spine (canonical machine bundle + recipes) and the
quick-win agent context packs, both auto-generated from `api-specs.ts`. After
this, every later phase (MCP, SDKs, plugins) consumes the bundle — never the
source of truth directly.

## Constraints (inherited)

- Static-first, build-time artifacts. Pure/deterministic generators, **no
  `Date`** (byte-stable like `build-openapi.ts`).
- DRY: one canonical bundle; one canonical pack body with thin per-target wrappers.
- Security: `access_key` server-side-only; signing helpers/docs are backend-only;
  packs carry an explicit frontend-forbidden warning.
- Token efficiency: tiered/lazy — index first, detail on demand.

---

## Phase 0 — Spine

### 0.1 Recipes data layer — `src/lib/data/api-recipes.ts`

Pure data module. References `ApiSpec.slug` values; imports no React/MDX.

```ts
interface RecipeStep {
	specSlug: string;            // FK into API_SPECS
	purpose: string;             // why this step
	branches?: {
		onResponseStatusId: number;
		goto: string;              // step id | recipe-relative target | "done"
		note?: string;
	}[];
}
interface Recipe {
	id: string;
	name: string;
	summary: string;
	productId?: string;          // FK into API_PRODUCTS
	steps: RecipeStep[];
}
export const RECIPES: Recipe[];
```

**v1 exemplars (2):**
1. **DMT send-money** — get-sender → (branch `response_status_id 463` →
   onboard-sender) → add-recipient → initiate-transaction. Encodes the
   conditional onboarding the spec descriptions already imply.
2. **AePS cash-withdrawal** — the canonical AePS withdrawal flow.

Exact step slugs resolved against `API_SPECS` at authoring time; a build-time
check fails if any `specSlug` is unknown.

### 0.2 Bundle builder — `src/lib/agent/build-agent-bundle.ts`

Pure, deterministic, no I/O. Sibling of `build-openapi.ts`. Consumes
`API_SPECS`, the resolvers (`resolveHeaders`/`resolveRequestParams`/
`resolveResponseFields`), `api-auth.ts`, `api-error-codes.ts`, pricing data,
`api-products.ts`, and `RECIPES`.

**`AgentBundle` schema:**
- `meta`: `{ org: "ekoindia", apiVersion, bundleVersion (content hash), environments }`
- `topics`:
  - `auth`: signing steps (`API_AUTH_INFO.secretKeyGeneration`), headers, keys,
    **`backendOnly: true`** flag + warning text.
  - `errors`: the error-code table.
  - `pricing`: summary (or reference to pricing artifacts).
  - `environments`: sandbox + production base URLs/notes.
- `apis`: per endpoint — index fields (`slug, productId, name, method, path,
  summary, category, relevance`) **plus** full resolved detail (params, request
  sample, response fields, error scenarios).
- `recipes`: recipe index + per-recipe steps.

**Slice builders (for the split artifacts):**
- `buildIndex()` → compact list: `{ slug, name, method, path, summary, category }[]`
  + topic ids + recipe ids. No full bodies.
- `buildApi(slug)` → one endpoint's full resolved detail.
- `buildTopic(topic)` → one topic (`auth | errors | pricing | environments`).

**Determinism:** `bundleVersion` is a content hash of the assembled bundle (no
`Date`). Build **throws** on any recipe `specSlug` not present in `API_SPECS`.

### 0.3 Emit plugin — `vite-plugin-generate-agent-bundle.ts`

Follows the existing `vite-plugin-generate-*` pattern. Writes into the build:
- `/agent/eps.json` — full canonical bundle (SoT for downstream codegen).
- `/agent/index.json` — `buildIndex()` output.
- `/agent/api/<slug>.json` — one per endpoint.
- `/agent/topic/<topic>.json` — one per topic.

The full bundle feeds codegen (SDKs) and the local MCP (baked in, sliced
in-memory). The split files let a no-MCP, URL-fetching agent pull the index then
drill in — token-efficient.

### 0.4 Tests — `build-agent-bundle.test.ts`

- Byte-stable output for a fixed spec set (determinism).
- Every `API_SPECS` entry appears in `apis` and in `buildIndex()`.
- Every recipe `specSlug` resolves to a real spec.
- `auth` topic carries `backendOnly` + signing steps.
- No leaked secrets / no `access_key` value anywhere in the bundle.

---

## Phase 1 — Context Packs & Hub

### 1.1 Pack builder — `src/lib/agent/build-context-pack.ts`

Pure: `AgentBundle` → one **canonical lean pack body** (markdown). Content:
- Intro + base URLs / environments.
- **Auth & HMAC signing, inlined** (the get-it-wrong bit) + **backend-only
  warning** (`access_key`/`secret-key` must never reach a frontend).
- Error model (compact).
- **Compact endpoint index** (table: name · method · path · 1-line summary ·
  link). Per-endpoint detail is NOT inlined — link to bundle/MCP/`.md` docs.
- Recipes summary.
- `@ekoindia/eps-context-mcp` install pointer.
- Links to `/agent/eps.json`, `/openapi.json`, and `.md` docs.

Thin per-target wrappers (same body, format-specific shell — DRY):
- `AGENTS.md` (cross-tool standard, plain)
- `CLAUDE.md`
- `.cursorrules`
- `.github/copilot-instructions.md`

### 1.2 Emit + llms.txt

- Vite plugin emits the packs under `/agent/*` (filenames per target).
- Extend the `llms.txt` generator with an **"AI coding agents"** section linking
  the packs, `eps.json`, and the MCP install command.

### 1.3 Portal hub page — `/agents`

- New SSG React route `/agents`, using existing UI components; `/agents.md`
  generated via the existing markdown-gen pattern.
- Lists: context packs (copy/download per target), per-harness MCP install
  snippets, bundle + OpenAPI links, recipes.
- Added to nav + command palette (existing patterns).
- Route name `/agents` (top-level, marketable). Adjustable.

### 1.4 Tests — `build-context-pack.test.ts`

- Auth section + backend-only warning present in the body.
- Every spec appears in the endpoint index.
- All per-target wrappers wrap the same canonical body.
- Hub page render smoke test.

---

## Data flow

```
api-specs.ts (+ common/auth/errors/pricing/products) + api-recipes.ts
        │  (pure)
        ▼
build-agent-bundle.ts ──► AgentBundle ──► vite-plugin ──► /agent/eps.json + split slices
        │                                              └─► llms.txt "AI agents" section
        ▼ (pure)
build-context-pack.ts ──► canonical body ──► wrappers ──► /agent/AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md
        │
        ▼
/agents hub page (reads bundle at build) + /agents.md
```

## Out of scope (later phases)

MCP server (Phase 2), SDK codegen (Phase 3), mock server + harness plugins
(Phase 4). This phase only produces the bundle, recipes, packs, and hub.

## Next step

Continue brainstorming Phase 2–4; then writing-plans per phase at dev time.
