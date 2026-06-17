# AI-Native Agent Platform — Session Status & Next Steps

**Date:** 2026-06-17
**Branch:** `feature/ai-native-agent-platform` (33+ commits, not yet merged to `dev`)
**Related:** specs in `docs/superpowers/specs/2026-06-17-*`, plans in `docs/superpowers/plans/2026-06-17-*`, `docs/sdk-golden-vector.md`

> This is a status/handover report. The user-facing feature documentation and the
> answers to the open distribution questions are finalized in this file once the
> decisions in §7 are made.

---

## 1. What was accomplished (brief)

Everything is auto-generated from the single source of truth `src/lib/data/api-specs.ts`. The repo became an npm-workspaces monorepo (`packages/*`).

- **Phase 0 — spine:** pure `build-agent-bundle.ts` → `/agent/eps.json` + split slices (`index.json`, `api/<slug>.json`, `topic/<topic>.json`). New `api-recipes.ts` (2 recipes: DMT send-money with the 463→onboard branch, AePS cash-withdrawal). Deterministic (FNV-1a content hash, no `Date`).
- **Phase 1 — packs & hub:** lean context packs (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `copilot-instructions.md`) from one canonical body; `llms.txt` "AI coding agents" section; `/agents` portal page + `/agents.md`.
- **Phase 2 — `@ekoindia/eps-context-mcp`:** local stdio MCP, 9 tiered/secret-free tools, baked bundle + optional `EPS_BUNDLE_URL` refresh.
- **Phase 3 — SDKs:** `/agent/sdk-surface.json`; `@ekoindia/eps-sdk` (Node) + `ekoindia/eps-sdk` (PHP), backend-only HMAC signing, cross-language golden-vector conformance; Postman collection with a signing pre-request script.
- **Phase 4 — depth & coverage:** `/agent/fixtures.json`; `@ekoindia/eps-mock-server` (offline, recipe-aware via `?eps_scenario=`); `/agent/install-matrix.json` (12 harnesses); `packages/claude-plugin-eps/` (MCP + 3 skills + `/eps` command); install matrix rendered on the hub.

**Quality gates:** website 161 tests, MCP 13, JS SDK 3, mock 3 — all green; lint 0 errors; build emits all `/agent/*` artifacts + 119 prerendered pages. Each phase passed a two-stage (spec + quality) review plus a final holistic review (verdict: SHIP).

---

## 2. Where we deviated from the plan

| Deviation | Why | Verdict |
|---|---|---|
| Emit plugin used the real `vite-plugin-generate-openapi.ts` hardened `closeBundle` (guards, alias) instead of the plan's sketch | The plan's own NOTE asked for this | Improvement |
| **`src/AppServer.tsx` (SSG render twin) route was missing** → `/agents` prerendered as the 404 page | The plan's Task 11 omitted the eager-import twin of `App.tsx` | **Real plan gap; fixed** (`bcd6c18`) |
| Each new package got a local `vitest.config.ts` (node env) | Packages otherwise inherit the website's jsdom/react root config and tests can't run | Necessary |
| Dropped an unused `@ts-expect-error`; minor strict-TS test typings | Plan was internally inconsistent under `tsc --strict` | Correct |
| Dep versions matched the repo (vitest v3, TS 5.8) instead of the plan's `^2`/`^5.4` | Avoid two majors hoisted in one monorepo | Sound |
| JS SDK reads `sdk-surface.json` via `node:fs` instead of `import ... assert {type:json}` | Import attributes break across Node/tsup/vitest versions | More robust |
| PHP phpunit deferred to CI; correctness proven via a plain-`php` harness | Composer is not installed locally | Acceptable |
| Added SDK READMEs + the 3rd CC skill `run-a-recipe` as a polish pass | Spec called for them; plans had dropped them | Closed the gap |
| **Dev-server 404 fix** (`d047247`): dev middleware now serves all `/agent/*` artifacts, not just `.json` | Found during your verification — packs fell through to the SPA in `vite dev` | Fixed |

---

## 3. What was NOT done (gaps & risks)

- **Nothing is published.** All 5 packages are `0.1.0`, local-only. No `publishConfig`, no npm org publish, no Packagist submission, no Claude Code marketplace, **no `.github/workflows` CI**. → Every `npx`/`npm install`/`composer require`/`/plugin install` command shown in the UI currently **fails** (see §4).
- **SDK languages:** only JS + PHP shipped (the planned first cut). Java, C#/.NET, Python, Go are not built.
- **PHP tests** not executed (Composer absent); not wired into CI.
- **Claude Code plugin** never live-loaded in a real session (files are well-formed but unverified end-to-end).
- **Bruno** collection deferred (per plan).
- **No consolidated user-facing feature doc** in `docs/` yet (only specs/plans + package READMEs).
- **`/agents` page is plain** — uses `LegalPageLayout` (a v1 shortcut), not a marketing page (see §6).
- **Not merged to `dev`.**

---

## 4. How the distribution actually works (and why it doesn't *yet*)

### `npx -y @ekoindia/eps-context-mcp` and `npx -y @ekoindia/eps-mock-server`
- `npx -y <pkg>` resolves `<pkg>` from the configured npm registry (default: npmjs.com), downloads it to a cache if absent, and runs the executable declared in its `package.json` `bin` (`eps-context-mcp` → `dist/index.js`; `eps-mock-server` → `dist/index.js`). `-y` skips the install confirmation.
- The MCP runs a **stdio** server; an MCP client launches it with `{ "command": "npx", "args": ["-y", "@ekoindia/eps-context-mcp"] }` and talks to it over stdin/stdout. It reads the **baked** `data/eps.json` (shipped in the package) and exposes the 9 tools; set `EPS_BUNDLE_URL` to fetch a newer bundle at startup.
- The mock server listens on `PORT` (default 4010) and replays `data/fixtures.json`.
- **Current reality:** neither is published to npm, so both commands return a 404 from the registry today. **Action:** publish to npm with `"publishConfig": { "access": "public" }` (scoped packages are private by default), then `npm publish` (manually or via CI on a tag).

### `/plugin install eps` (Claude Code)
- Claude Code installs plugins from a **marketplace** — a git repo containing `.claude-plugin/marketplace.json` that lists plugins. Users run `/plugin marketplace add <owner/repo>` then `/plugin install eps@<marketplace>` (or pick it in the interactive `/plugin` UI).
- Our `packages/claude-plugin-eps/` has a valid `.claude-plugin/plugin.json` that wires the `eps` MCP via `npx -y @ekoindia/eps-context-mcp`, two/three skills, and the `/eps` command — but it is **not hosted in any marketplace**, and the MCP it points to isn't on npm.
- **Current reality:** `/plugin install eps` does nothing yet. **Action:** (a) publish the MCP to npm; (b) create a marketplace — either add a `.claude-plugin/marketplace.json` to this repo (or a dedicated `eko-claude-plugins` repo) listing the plugin, and document `/plugin marketplace add ekoindia/<repo>` + `/plugin install eps`. The hub's `/plugin install eps` label should be updated to the real, marketplace-qualified command.

### How the packaged SDKs work (npm & Packagist)
- **JS (`@ekoindia/eps-sdk`):** published to the npm registry under the `@ekoindia` scope. Users `npm install @ekoindia/eps-sdk`. Needs `publishConfig.access: public` + `npm publish` (the package's `prepublishOnly` already runs `bake` + `build`).
- **PHP (`ekoindia/eps-sdk`):** Composer/Packagist works by **VCS pointer** — you submit the package's public git repo URL to packagist.org once; Packagist reads `composer.json` and indexes tagged releases. Users then `composer require ekoindia/eps-sdk`. Requires the package to live in a git repo Packagist can read and to be **git-tagged** (e.g. `v0.1.0`).
- **Current reality:** not published. Both also currently live *inside* the website monorepo, which is fine for npm (publish from the subfolder) but for Packagist typically wants its own repo or a split/subtree (Packagist can use a monorepo with a path, but the common path is a dedicated read-only mirror repo).

### Can we use GitHub Packages instead? Pros / cons
GitHub Packages can host **npm**, NuGet, Maven, RubyGems, and containers — but **not Composer/PHP** and **not Go modules** natively.

**Pros**
- One platform tied to the repo; good CI/CD integration (`GITHUB_TOKEN`).
- Fine for **private/internal** distribution and for the JVM (Maven) / .NET (NuGet) SDKs later.
- Versioning + provenance live next to the source.

**Cons (significant for a *public, frictionless* developer SDK)**
- **npm from GitHub Packages requires consumer-side auth + `.npmrc`** scope config (`@ekoindia:registry=https://npm.pkg.github.com` + a GitHub token) even for public installs. This breaks the headline one-liner: **`npx -y @ekoindia/eps-context-mcp` will not "just work"** for external developers (npx can't auth to GitHub Packages without prior `.npmrc` setup). That defeats the zero-friction goal.
- **No Composer support** → the PHP SDK still needs Packagist (or a private Satis/VCS repo). Mixed distribution = more moving parts.
- **No Go module hosting** → Go SDK (future) is just a tagged VCS repo anyway.

**Recommendation:** For the public, developer-facing artifacts (MCP, mock server, JS SDK), use **public npm**; for PHP use **Packagist**; Go (future) = tagged git; Java/C# (future) could use Maven Central/NuGet *or* GitHub Packages. Use GitHub Packages only if/when an **internal/private** channel is needed, or dual-publish the JVM/.NET ones there. The whole value proposition is one-command adoption — public registries deliver that; GitHub Packages does not for npm/Composer.

---

## 5. Documentation status

- **Present:** specs + plans (`docs/superpowers/`), `docs/sdk-golden-vector.md`, per-package READMEs (MCP, JS SDK, PHP SDK, plugin), this status file.
- **Missing (to add once §7 decisions land):**
  1. A consolidated **feature doc** `docs/ai-agent-platform.md` describing the shipped architecture (SoT → bundle → artifacts), the `/agent/*` artifact catalog, and how each piece is consumed.
  2. A **distribution/release runbook** `docs/releasing-agent-packages.md`: npm org + `publishConfig`, Packagist submission, the Claude Code marketplace setup, version/tag policy, and the CI workflow that bakes + builds + publishes on tag.
  3. Updating `docs/markdown-generation.md` / `docs/api-specs.md` to cross-reference the new `/agent/*` outputs.

Per project convention (core feature → maintain a detailed doc in `docs/`), items 1–2 are required before merge-to-main is "complete."

---

## 6. Why `/agents` looks plain, and how to make it world-class

**Why it's boring:** it renders inside `LegalPageLayout` — the legal/prose wrapper chosen as a deliberate v1 shortcut ("ship now, design later," noted in the Phase 0/1 spec). That gives plain `<h2>`/`<ul>` prose with no hero, no visual hierarchy, no cards, no copy-to-clipboard, no syntax highlighting, no brand styling. It reads like an unstyled index because it essentially is one.

**To make it a world-class developer-marketing page** (recommend invoking the `frontend-design` skill and treating it as its own design task):
- **Hero:** the positioning line ("The AI-native API platform — integrate EPS from any coding agent"), a one-paragraph value prop, primary CTA (copy the MCP command), secondary CTA (browse packs).
- **The differentiator, told visually:** "your agent gets the HMAC signing right the first time" — the thing generic OpenAPI tooling gets wrong. A small before/after or a Context7-style comparison.
- **Install, by harness:** tabbed/segmented control (Claude Code · Cursor · Codex · Copilot · …) each showing the exact snippet with **copy buttons** and **syntax highlighting**, generated from `install-matrix.json`.
- **Artifact cards:** Context packs / MCP / SDKs / Mock server / OpenAPI — each a card with an icon, one-line "what it does," and a copy/download action.
- **Live feel:** a short terminal/GIF of `npx … eps-context-mcp` answering a query, or an embedded sample tool call.
- **Recipes** as visual step-flows (DMT, AePS), not bullet lists.
- **Trust/footer:** links to OpenAPI, `eps.json`, docs, status.
- **Implementation:** a dedicated `AgentsPage` design (not `LegalPageLayout`), reusing the site's existing component system + the data it already has (`buildInstallMatrix`, `RECIPES`, the bundle index). Keep `/agents.md` as the lean text twin.

**Does the current page give users enough?** Functionally it lists the right artifacts and the install matrix, so a determined developer can self-serve. But it does **not** sell the value, explain *why*, or make install effortless — so as a marketing/adoption surface it is **not yet sufficient**.

---

## 7. Decisions (RESOLVED 2026-06-17)

1. **Distribution channel:** **public npm + Packagist.** (GitHub Packages rejected for public reach — breaks `npx`/Composer UX.)
2. **Claude Code marketplace location:** **this repo** (`.claude-plugin/marketplace.json` at repo root listing `packages/claude-plugin-eps`).
3. **Monorepo vs split:** stay monorepo. npm publishes from subfolders. **PHP/Packagist requires a read-only subtree-split mirror repo** (e.g. `ekoindia/eps-sdk-php`) auto-pushed by CI — the one exception, since Packagist reads `composer.json` from a repo root.
4. **`/agents` redesign:** **approved** (via `frontend-design`); **rename the route `/agents` → `/ai`** (keep `/ai.md` as the lean text twin).
5. **Next SDK languages (Java/C#/Python/Go):** **later** — only after everything in the current scope is finalized + published.

### Residual dependencies that require your action (cannot be done in-repo)
- npm: an `@ekoindia`-org **`NPM_TOKEN`** added as a GitHub Actions secret; confirm the org exists.
- Packagist: an account to submit the PHP mirror repo once (CI keeps it updated via webhook/tag).
- Pick the **marketplace name** used in `/plugin install eps@<name>` (proposed: `ekoindia`).

---

## 8. Execution plan (in order)

1. **Route rename `/agents` → `/ai`** (App.tsx, AppServer.tsx, ssg/routes.ts, nav, search-index, markdown gen → `/ai.md`); update hub's `/plugin install` label to the real marketplace command.
2. **Redesign `/ai`** into a world-class marketing page (`frontend-design`): hero + value prop, copy-to-clipboard per-harness install tabs (from `install-matrix.json`), artifact cards, the HMAC-signing differentiator, recipe step-flows. Dedicated page (not `LegalPageLayout`).
3. **Publishing pipeline (authorable now):** add `publishConfig.access: public` to the 3 npm packages; `.github/workflows` for (a) CI tests across workspaces (incl. PHP via Composer), (b) release-on-tag → `npm publish` for the 3 npm packages, (c) subtree-split push of the PHP SDK to its mirror repo. Add `.claude-plugin/marketplace.json` and fix the hub install command.
4. **Docs:** `docs/ai-agent-platform.md` (feature doc) + `docs/releasing-agent-packages.md` (release runbook incl. the credential steps above); cross-link from `markdown-generation.md`/`api-specs.md`.
5. **You:** add `NPM_TOKEN`, create/submit the Packagist mirror, then trigger the release; live-load the Claude Code plugin once.
6. **Merge `feature/ai-native-agent-platform` → `dev`**, then prod via PR (`dev → main`).
7. (Later) Java/C#/Python/Go SDKs; Bruno collection.
