# AI-Native Agent Platform

The EPS website doubles as an **AI-native API platform**: alongside the human
marketing site it publishes a complete, machine-readable surface that lets any
AI coding agent (Claude Code, Cursor, Codex, Copilot, …) integrate Eko Platform
Services (EPS) APIs correctly — getting the tricky parts (backend-only HMAC
signing, the error model, multi-step recipes) right the first time.

> **See also:** [`docs/releasing-agent-packages.md`](./releasing-agent-packages.md)
> (release runbook); and [`docs/sdk-golden-vector.md`](./sdk-golden-vector.md) (the
> signing conformance vector).

---

## 1. Overview & goal

Everything in this layer is **auto-generated from a single source of truth**:
`src/lib/data/api-specs.ts` (endpoint specs) plus
`src/lib/data/api-recipes.ts` (multi-step recipes) and the shared
auth/error/environment data (`api-auth.ts`, `api-error-codes.ts`,
`api-products.ts`, `api-environments` in `api-specs-common.ts`).

There is exactly one place to edit the API knowledge — the spec layer — and the
build re-derives every downstream artifact from it. Nothing in this layer
re-reads the raw specs independently; everything consumes the single compiled
**agent bundle** (`/agent/eps.json`).

## 2. Architecture

The chain is a fan-out from one builder:

```
        src/lib/data/api-specs.ts          (endpoint specs — source of truth)
        src/lib/data/api-recipes.ts        (multi-step recipes)
        api-auth.ts / api-error-codes.ts / api-products.ts / api-environments
                              │
                              ▼
        src/lib/agent/build-agent-bundle.ts        (pure, deterministic)
                              │
                              ▼
                      /agent/eps.json              (canonical bundle)
                              │
        ┌──────────────┬──────────────┬─────────────┬───────────────┐
        ▼              ▼              ▼             ▼               ▼
   index.json     api/<slug>.json  topic/<t>.json  context packs   sdk-surface.json
   (compact)      (per endpoint)   (auth/errors…)  AGENTS.md /      fixtures.json
                                                   CLAUDE.md /      install-matrix.json
                                                   .cursorrules /   postman collection
                                                   copilot-instr.
                              │
                              ▼
        packages/*  (MCP, JS SDK, PHP SDK, mock server, Claude plugin)
        /ai hub page  +  /ai.md text twin
```

`buildAgentBundle(specs)` in `src/lib/agent/build-agent-bundle.ts` is **pure and
deterministic**: no I/O, no `Date`. The `meta.bundleVersion` is a 32-bit
**FNV-1a** content hash of `{ topics, apis, recipes }`, so identical inputs
produce byte-stable output and the bundle version changes only when the content
changes. Both the dev server (middleware) and the production build call the
**same** builder via `buildFiles()` in
`vite-plugin-generate-agent-bundle.ts`, so there is no dev/prod drift.

**DRY:** the bundle is the only intermediate. The context packs, SDK surface,
fixtures, install matrix, Postman collection, the `/ai` page, `/ai.md`, and the
`packages/*` all consume the bundle (or the same builder/data helpers) — none of
them re-reads `api-specs.ts` directly.

## 3. The `/agent/*` artifact catalog

Emitted by `buildFiles()` in `vite-plugin-generate-agent-bundle.ts` to
`dist/agent/` at build time, and served live at `/agent/*` during `vite dev`
(the dev middleware serves every artifact, JSON **and** the packs, not just
`.json`).

| Artifact | What it is | Built by | Consumed by |
|---|---|---|---|
| `agent/eps.json` | The canonical bundle: `meta` + `topics` + `apis` (full detail) + `recipes` | `buildAgentBundle` | Everything downstream; baked into the MCP package |
| `agent/index.json` | Compact index — all endpoints (no bodies), topic ids, recipe summaries | `buildIndex` | Fast discovery / listing |
| `recipe.md` + `recipe/<slug>.md` | Human + agent recipe pages: a mermaid `flowchart TD` of the flow, then the numbered steps linking to each endpoint twin | `renderRecipesIndexMarkdown` / `renderRecipeMarkdown` | Linked from `/docs.md`, `/llms.txt`, `/ai.md` |
| `agent/api/<slug>.json` | One endpoint's full detail (headers, params, sample req/resp, errors) | `buildApi` | Per-endpoint lookups |
| `agent/topic/<topic>.json` | One topic: `auth`, `errors`, `pricing`, `environments` | `buildTopic` | Topic lookups (e.g. signing rules) |
| `agent/AGENTS.md` | Canonical lean context pack (open `AGENTS.md` standard) | `CONTEXT_PACK_FILES` | Codex, Gemini CLI, opencode, Windsurf, Cody, Zed, aider, JetBrains AI |
| `agent/CLAUDE.md` | Same body, wrapped for drop-in as a repo `CLAUDE.md` | `CONTEXT_PACK_FILES` | Claude Code |
| `agent/.cursorrules` | Same body, Cursor rules header | `CONTEXT_PACK_FILES` | Cursor |
| `agent/copilot-instructions.md` | Same body, for `.github/copilot-instructions.md` | `CONTEXT_PACK_FILES` | GitHub Copilot |
| `agent/sdk-surface.json` | Language-neutral SDK surface (endpoints + signing contract) | `buildSdkSurface` | JS SDK + PHP SDK (baked into each) |
| `agent/fixtures.json` | Sample success + error responses per endpoint | `buildFixtures` | `@ekoindia/eps-mock-server` (baked) |
| `agent/install-matrix.json` | Per-harness MCP wiring (`mcp.command` and/or `mcp.configFile` + `mcp.configSnippet`) and/or pack file | `buildInstallMatrix` | `/ai` hub page + `/ai.md` |
| `agent/eps.postman_collection.json` | Postman collection with an HMAC signing pre-request script | `buildPostmanCollection` | Postman import |

The four context packs (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`,
`copilot-instructions.md`) share **one** canonical body
(`buildContextPackBody` in `src/lib/agent/build-context-pack.ts`); each wrapper
only adds a format-appropriate heading.

## 4. The packages (`packages/*`)

An npm-workspaces monorepo. All three npm packages already carry
`"publishConfig": { "access": "public" }`. Versions are currently `0.1.0`.

### `@ekoindia/eps-context-mcp` (local MCP server)

Local **stdio** MCP server exposing **9 tiered, secret-free** tools over the
baked bundle: `list_apis`, `list_topics`, `list_recipes`, `search`, `get_api`,
`get_topic`, `get_recipe`, `get_signing_snippet`, `get_meta`. It reads the
**baked** `data/eps.json` shipped in the package; set `EPS_BUNDLE_URL` to fetch
a fresher bundle at startup. No secrets are ever required or handled.

```bash
npx -y @ekoindia/eps-context-mcp@latest
```

The `@latest` tag keeps users on the newest publish (code + baked bundle)
without editing config. The server also does a best-effort npm version check on
startup and surfaces `updateAvailable` via `get_meta` (silent on failure;
`EPS_NO_UPDATE_CHECK=1` disables it).

### `@ekoindia/eps-sdk` (Node.js SDK)

Backend-only Node.js SDK with EPS request signing built in (HMAC-SHA256). Reads
the baked `data/sdk-surface.json`. Backend-only by design — never run in a
browser.

```bash
npm install @ekoindia/eps-sdk
```

### `ekoindia/eps-sdk` (PHP SDK — `packages/sdk-php`)

Backend-only PHP SDK (PSR-4 `Eko\Eps\`, PHP >= 8.1), same signing contract,
verified against the cross-language golden vector.

```bash
composer require ekoindia/eps-sdk
```

### `@ekoindia/eps-mock-server` (offline mock server)

Offline HTTP server (default port **4010**, override with `PORT`) that replays
the baked `data/fixtures.json`. Recipe-aware: append
`?eps_scenario=<response_status_id>` to force a documented error example (e.g.
`?eps_scenario=463` to exercise the DMT "user not found → onboard" branch).

```bash
npx -y @ekoindia/eps-mock-server
```

### `packages/claude-plugin-eps` (agent plugin: dev-time context)

An agent plugin that wires the `eps` MCP (via
`npx -y @ekoindia/eps-context-mcp@latest`), three skills
(`integrate-eps`, `sign-request`, `run-a-recipe`), and an `/eps` slash command.

The runtime transactional MCP (`@ekoindia/eps-transact-mcp`) is **not** a
coding-agent plugin — it executes verification APIs with the partner's own
credentials for use inside their production AI agents. It ships as its own npm
package (hosted endpoint + local stdio) and is documented on the `/agents` page
and in [`docs/eps-transact-mcp.md`](eps-transact-mcp.md). Installing it into a
developer's coding agent is the wrong audience (no creds → `MISSING_CREDENTIALS`),
so it is deliberately kept out of the coding marketplace.

### Plugin distribution

The `eps` plugin is listed in the repo-root `.claude-plugin/marketplace.json`
(marketplace `ekoindia`). Install paths, per agent:

- **Claude Code** — native plugin manager:

  ```text
  /plugin marketplace add ekoindia/eps-platform
  /plugin install eps@ekoindia
  ```

- **Codex** — `codex plugin marketplace add …` + `codex plugin add eps@ekoindia`
  (installs the skills; Codex does not yet launch the bundled MCP, so also run
  `codex mcp add eps -- npx -y @ekoindia/eps-context-mcp@latest`).
- **Every other agent** — wire the MCP directly from the per-agent matrix on the
  `/ai` hub.

The MCP server self-updates regardless — `npx -y …@latest` re-resolves at every
launch. A guard test (`src/test/plugin-marketplace.test.ts`) keeps the
marketplace, plugin manifest, and skill files consistent.

## 5. The `/ai` hub page (+ `/ai.md` text twin)

`src/pages/AiPage.tsx` is the developer-facing hub. It opens with a
**"How to build with AI?" quick-start** right after the hero — a 3-step
stepper (get an agent → one-time EPS install, linking to the `#install`
matrix → copyable sample prompts via `PromptChip` in
`src/pages/ai/CommandBlock.tsx`) aimed at users new to AI coding agents.
The rest is **data-driven** from the same sources as the bundle:

- The **install matrix** (per-harness tabs with copy-to-clipboard snippets)
  comes from `buildInstallMatrix()` (`src/lib/agent/build-install-matrix.ts`),
  the same data emitted to `/agent/install-matrix.json`. MCP install is recorded
  the way each harness actually accepts it — a CLI command (`claude mcp add`,
  `copilot mcp add`, `gemini mcp add`), a JSON config file (Cursor `mcpServers`,
  VS Code Copilot `servers`, opencode `mcp`, Zed `context_servers`), or a TOML
  table (Codex `mcp_servers`) — never a bare `npx` line no harness runs verbatim.
  Harnesses with no native MCP client (aider) fall back to the context pack.
- The **recipes** come from `RECIPES` (`src/lib/data/api-recipes.ts`).

`/ai.md` is the lean Markdown twin, rendered by
`src/lib/markdown/render-agents.ts` from the **same** `buildInstallMatrix()` +
`RECIPES`, so the text and HTML surfaces never diverge (including a mirrored
"Quick start" section with the same three steps and sample prompts). The route is registered
in `src/App.tsx`, `src/AppServer.tsx` (SSG render twin), and `ssg/routes.ts`.

## 6. Auth model

EPS is **backend-only**. The `access_key` is a server-side secret used to
compute a per-request `secret-key`:

```
secret-key = base64( HMAC-SHA256( message = timestamp_ms, key = base64(access_key) ) )
```

Never expose `access_key` or compute `secret-key` in a browser/frontend. This
warning and the algorithm are carried in the bundle's `auth` topic and inlined
into every context pack. Cross-language SDK conformance is pinned by
[`docs/sdk-golden-vector.md`](./sdk-golden-vector.md).

## 7. How to update

### Adding a recipe

Add an entry to `RECIPES` in `src/lib/data/api-recipes.ts` with a unique,
kebab-case `slug` (its `/recipe/<slug>` route) and a `productId` FK. Everything
else follows automatically: the page, the `.md` twin, the prerendered route, the
sitemap entry and the agent bundle all derive from the data. `assertRecipeSlugs`
runs at build and fails on a duplicate/malformed slug or a step referencing an
unknown endpoint, so a broken recipe cannot ship.

> **Known data gap.** `RecipeStep.branches` encodes only the *exceptional* jump
> (e.g. DMT step 1: `463 → onboard sender`). The implied success path — sender
> found, so skip onboarding — has nowhere to live in the current shape, so
> neither the stepper nor the mermaid graph draws it. Both render exactly what
> the data says. Fixing this means extending the step shape (a success `goto`,
> or explicit edges), which would also improve the context packs and MCP, since
> they read the same field.

1. Edit `src/lib/data/api-specs.ts` (endpoints) and/or
   `src/lib/data/api-recipes.ts` (recipes), or the shared
   auth/error/product/environment data.
2. Run `npm run build`. This regenerates every `/agent/*` artifact into
   `dist/agent/` (and the dev server serves the new output live), then runs
   `bake:all`, which copies the fresh artifacts into each package's `data/`
   directory.

That is the whole loop — there is no separate re-bake step. The package
`data/*.json` files are **generated, not committed**: they are gitignored
(`packages/*/data/`) and recreated on every root build, so they can never
drift from `src/` or leak environment values into git.

```bash
npm run bake:all   # re-bake all four packages without a full rebuild
```

`bake:all` covers `eps.json` (eps-context-mcp), `sdk-surface.json` (sdk-js
**and** sdk-php), and `fixtures.json` (eps-mock-server). It reads from
`dist/agent/`, so a prior `npm run build` must have populated that directory.
On publish, each npm package's `prepublishOnly` also runs `bake` + `build` as a
safety net — see the release runbook.
