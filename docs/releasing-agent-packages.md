# Releasing the Agent Packages — Runbook

Operational runbook for publishing the EPS AI-agent packages. For the
architecture of what is being shipped, see
[`docs/ai-agent-platform.md`](./ai-agent-platform.md); for the resolved
distribution decisions and their rationale, see
[`docs/ai-agent-platform-status.md`](./ai-agent-platform-status.md).

---

## 1. Distribution decision

- **npm packages** (`@ekoindia/eps-context-mcp`, `@ekoindia/eps-sdk`,
  `@ekoindia/eps-mock-server`) → **public npm** (`registry.npmjs.org`).
- **PHP SDK** (`ekoindia/eps-sdk`) → **Packagist** (Composer).
- **Claude Code plugin** → the repo-root `.claude-plugin/marketplace.json`
  (marketplace name `ekoindia`).

**Why not GitHub Packages?** Installing npm from GitHub Packages requires
consumer-side auth + a scoped `.npmrc`, which breaks the headline zero-friction
`npx -y @ekoindia/…` one-liner, and GitHub Packages has no Composer support at
all. Public npm + Packagist deliver the one-command adoption that is the whole
point.

## 2. Prerequisites / one-time setup (USER ACTIONS)

These cannot be done in-repo and must be done once before the first release.

### npm

npm auth runs in two phases. A package's **Trusted Publisher** (OIDC) config can
only be created *after* the package exists on npm, so the very first publish of
each package needs a token; OIDC takes over afterward. Node ≥22.14.0 / npm
≥11.5.1 are required for OIDC (the workflow pins Node `22.14.0`); under OIDC,
provenance attestations are generated automatically — no `--provenance` flag and
no token. Package records auto-create on first `npm publish --access public`, so
nothing needs to be pre-created on npm besides the org.

**Phase A — Bootstrap (one-time per package):**

1. Confirm the **`@ekoindia` npm org** exists (scoped packages require it).
2. Create a short-lived **automation `NPM_TOKEN`** with publish rights on the
   `@ekoindia` scope; add it as a GitHub Actions repository secret named
   **`NPM_TOKEN`** (consumed as `NODE_AUTH_TOKEN` by `npm publish`).
3. Publish each of the three packages **once**. Prefer a **local/manual** first
   publish from a maintainer machine (`npm publish --access public` per package)
   over the tag workflow: if the tag run publishes package 1 then fails on
   package 2, re-running the same tag fails because package 1's version already
   exists. Recovery if that happens: bump the failed package(s) and push a new
   tag, or finish the remaining first-publishes locally.

**Phase B — OIDC steady-state (after each package exists):**

4. On npmjs.com, for **each** package → *Settings → Trusted Publisher* → add a
   GitHub Actions publisher: org `ekoindia`, this repo, workflow filename
   **`release.yml`** (filename only, not the full `.github/workflows/...` path),
   and set **Allowed actions** to **`npm publish`**.
5. `release.yml` already grants `id-token: write` at the `npm-publish` job level.
   Once all three Trusted Publishers exist, **delete the `NPM_TOKEN` secret** and
   remove the `NODE_AUTH_TOKEN` lines from the publish steps. (Adding
   `id-token: write` alone does **not** switch auth — the token is the fallback
   until the Trusted Publisher is configured.)

### PHP / Packagist

1. Create a **read-only mirror repo** `ekoindia/eps-sdk-php` (Composer cannot
   install a package living in a monorepo subdirectory, so the release subtree-
   splits `packages/sdk-php` into this mirror).
2. Add a write-access **deploy key** for that mirror and store its private key as
   the GitHub Actions secret **`SDK_PHP_DEPLOY_KEY`**.
3. Submit the mirror repo URL to **packagist.org** once (Packagist reads
   `composer.json` from the mirror root and indexes tagged releases).
4. Enable the **Packagist → GitHub webhook** on the mirror (or rely on tags —
   pushing a `vX.Y.Z` tag to the mirror triggers a new Packagist release).

### Claude Code marketplace

- Nothing beyond merging `.claude-plugin/marketplace.json` (already at the repo
  root, listing `packages/claude-plugin-eps` as plugin `eps`) to the default
  branch so users can `/plugin marketplace add ekoindia/eko-eps-platform`.

## 3. Release flow

Driven by **`.github/workflows/release.yml`**, triggered on pushing a
`v*.*.*` tag.

### Job `npm-publish`

1. Checks out, sets up Node `22.14.0` with `registry-url:
   https://registry.npmjs.org` and `id-token: write` (job-scoped, for OIDC).
2. `npm ci`, then `npm run build` (repo-root build emits `dist/agent/*.json`
   and then runs `bake:all`, copying them into each package's `data/`).
3. For each of the three npm packages, in its directory: `npm run bake`,
   `npm run build`, then `npm publish --access public`. Authenticated via the
   package's Trusted Publisher (OIDC) once configured; `NODE_AUTH_TOKEN=${{
   secrets.NPM_TOKEN }}` remains as the bootstrap fallback (Phase A) and is
   removed afterward (Phase B). Provenance is automatic under OIDC.

All three npm packages already declare `"publishConfig": { "access": "public" }`
(scoped packages are private by default), and each has a `prepublishOnly` that
runs `bake` + `build` as a safety net.

> **Package `data/*.json` is generated, never committed.** The baked artifacts
> are gitignored (`packages/*/data/`) and recreated on every root build via the
> `bake:all` script — so they cannot drift from `src/` or leak environment
> values into git. Any fresh checkout (CI included) must run `npm run build`
> before package tests or publish. The PHP SDK has no npm scripts, so its
> surface is baked by `packages/sdk-php/scripts/bake-surface.mjs`, invoked from
> the root `bake:all`.

### Job `php-split`

Subtree-splits `packages/sdk-php` into the `ekoindia/eps-sdk-php` mirror and
propagates the triggering tag (via `symplify/monorepo-split-github-action`).
Pushing the tag to the mirror is what triggers the Packagist release.

> **Status:** `php-split` is currently a documented scaffold. It activates once
> `SDK_PHP_DEPLOY_KEY` and the `ekoindia/eps-sdk-php` mirror exist; until then it
> needs a `webfactory/ssh-agent` step loading `SDK_PHP_DEPLOY_KEY` before the
> split step (noted inline in `release.yml`).

## 4. Versioning / tag policy

- All packages are currently `0.1.0`.
- To release: bump the package version(s) and push a **`vX.Y.Z`** git tag.
- The tag triggers `release.yml`; **all three npm packages publish together** on
  one tag, and the same tag is propagated to the PHP mirror.
- Keep it simple — one tag per coordinated release.

## 5. CI (`.github/workflows/ci.yml`)

Runs on pull requests and on pushes to `dev`, `main`, and `feature/**`.

> **CI never publishes.** Branch pushes (dev/main/feature) and PRs run only
> lint/build/test here. Nothing is published to npm or Packagist except on a
> pushed `vX.Y.Z` tag, which triggers `release.yml` (§3) — not this workflow.

- **Job `web-and-packages`** (Node 20): `npm ci` → `npm run lint` →
  `npm run build` (website + agent bundles) → `npx vitest run` (website tests) →
  `npm test` for `@ekoindia/eps-context-mcp`, `@ekoindia/eps-sdk`, and
  `@ekoindia/eps-mock-server`.
- **Job `php-sdk`** (PHP 8.2 + Composer, in `packages/sdk-php`):
  `composer install` → `vendor/bin/phpunit --bootstrap vendor/autoload.php tests`.

## 6. Consumer verification checklist

Run after the first publish:

- [ ] `npx -y @ekoindia/eps-context-mcp` starts the stdio MCP server.
- [ ] `npx -y @ekoindia/eps-mock-server` serves on `:4010`.
- [ ] `npm i @ekoindia/eps-sdk` resolves and installs.
- [ ] `composer require ekoindia/eps-sdk` resolves from Packagist.
- [ ] In Claude Code: `/plugin marketplace add ekoindia/eko-eps-platform` then
      `/plugin install eps@ekoindia` works (and the `eps` MCP + skills +
      `/eps` command load).

## 7. Known follow-ups

- **Live-load the Claude Code plugin** end-to-end in a real session (files are
  well-formed but not yet verified live).
- **Wire the PHP mirror**: create `ekoindia/eps-sdk-php`, add
  `SDK_PHP_DEPLOY_KEY` + the `ssh-agent` step, and submit to Packagist so
  `php-split` runs for real.
- **Future SDK languages** (Java, C#/.NET, Python, Go) — out of current scope;
  Go would ship as a tagged VCS repo, JVM/.NET via Maven Central / NuGet.
