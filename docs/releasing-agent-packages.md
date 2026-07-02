# Releasing the Agent Packages — Runbook

Operational runbook for publishing the EPS AI-agent packages. For the
architecture of what is being shipped, see
[`docs/ai-agent-platform.md`](./ai-agent-platform.md).

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

> **Status: DONE — OIDC steady-state.** All three packages have Trusted
> Publishers configured; the `NPM_TOKEN` secret and the `NODE_AUTH_TOKEN` line
> are removed. Publishing is now tokenless. The two phases below are retained as
> reference for adding a *new* package (a new package still needs a one-time
> bootstrap publish before its Trusted Publisher can be created).

npm auth runs in two phases. A package's **Trusted Publisher** (OIDC) config can
only be created *after* the package exists on npm, so the very first publish of
each package needs a token; OIDC takes over afterward. OIDC requires **npm
≥11.5.1** — and Node `22.14.0` (pinned in the workflow) bundles only npm
`10.9.2`, so the `npm-release` job explicitly runs `npm install -g npm@^11.5.1`
before publishing (without it, publish runs unauthenticated and fails with
`E404`). The publish passes `--provenance`, which generates a signed SLSA build
attestation — this needs `id-token: write` (granted) **and a public source repo**
(`ekoindia/eps-platform` is public). Package records auto-create on first
`npm publish --access public`, so nothing needs to be pre-created besides the org.

**Phase A — Bootstrap (one-time per package; done for the current three):**

1. Confirm the **`@ekoindia` npm org** exists (scoped packages require it).
2. Create a short-lived **automation `NPM_TOKEN`** with publish rights on the
   `@ekoindia` scope; add it as a GitHub Actions repository secret named
   **`NPM_TOKEN`** (consumed as `NODE_AUTH_TOKEN` by `npm publish`).
3. Publish the package **once** (local/manual from a maintainer machine:
   `npm publish --access public`). Local-first avoids a half-published tag.

**Phase B — OIDC steady-state (after the package exists; done for the current three):**

4. On npmjs.com, for the package → *Settings → Trusted Publisher* → add a
   GitHub Actions publisher: org `ekoindia`, this repo, workflow filename
   **`release.yml`** (filename only, not the full `.github/workflows/...` path),
   and set **Allowed actions** to **`npm publish`**.
5. `release.yml` grants `id-token: write` at the `npm-release` job level. Once
   the Trusted Publisher exists, OIDC authenticates automatically. After the
   **last** package that still relied on the token is migrated, **delete the
   `NPM_TOKEN` secret** and remove the `NODE_AUTH_TOKEN` line from the
   *Auto-release* step. (Adding `id-token: write` alone does **not** switch
   auth — the token is the fallback until the Trusted Publisher is configured.)

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
  branch so users can `/plugin marketplace add ekoindia/eps-platform`.

## 3. Release flow

Driven by **`.github/workflows/release.yml`**. The **npm** side runs on every
push to **`main`** (and `workflow_dispatch`); the **PHP** side runs on a
**`v*.*.*`** tag push.

### Job `npm-release` (auto, on push to `main`)

1. Checks out (full history), sets up Node `22.14.0` with `registry-url:
   https://registry.npmjs.org` and `id-token: write` (job-scoped, for OIDC).
2. `npm ci`, then `npm run build` (repo-root build emits `dist/agent/*.json`
   and then runs `bake:all`, copying them into each package's `data/`).
3. **Test gate** — `npm test` for all three packages; a failure aborts the
   release before anything publishes.
4. Runs **`scripts/auto-release.mjs`** for the three npm packages. For each:
   bake + build, then fingerprint the exact files `npm pack` would ship
   (normalizing `package.json`'s `version`) and compare against the tarball
   currently on npm. **Unchanged → skipped. Changed → published** with the next
   version, then tagged `<name>@<version>`. Publish uses `--ignore-scripts`
   (we already baked/built, so the published bytes equal the fingerprinted
   bytes), plus `--provenance` for a signed SLSA attestation. Auth: each
   package's npm Trusted Publisher (OIDC) — tokenless.

The release is **stateless**: the npm registry is the source of truth, so no
version-bump commit is pushed back to the protected branch — only the
`<name>@<version>` tag (which does not re-trigger the workflow). Publishing is
**idempotent**: a version-conflict (content already on npm from a prior partial
run) is treated as done and the tag is reconciled.

All three npm packages declare `"publishConfig": { "access": "public" }` (scoped
packages are private by default). `prepublishOnly` (bake + build) still guards
manual `npm publish`; the workflow bypasses it with `--ignore-scripts` by design.

> **Package `data/*.json` is generated, never committed.** The baked artifacts
> are gitignored (`packages/*/data/`) and recreated on every root build via the
> `bake:all` script — so they cannot drift from `src/` or leak environment
> values into git. Any fresh checkout (CI included) must run `npm run build`
> before package tests or publish. The PHP SDK has no npm scripts, so its
> surface is baked by `packages/sdk-php/scripts/bake-surface.mjs`, invoked from
> the root `bake:all`.

### Job `php-split` (manual, on a `vX.Y.Z` tag)

Bakes `packages/sdk-php/data/sdk-surface.json` and **commits it into the
ephemeral checkout before splitting** — the subtree split only carries committed
files, and the surface is gitignored, so without this the Packagist mirror would
ship without the runtime asset and `EpsClient` would fail. Then subtree-splits
`packages/sdk-php` into the `ekoindia/eps-sdk-php` mirror and propagates the
triggering tag (via `symplify/monorepo-split-github-action`). Pushing the tag to
the mirror is what triggers the Packagist release.

> **Status:** `php-split` is currently a documented scaffold. It activates once
> `SDK_PHP_DEPLOY_KEY` and the `ekoindia/eps-sdk-php` mirror exist; until then it
> needs a `webfactory/ssh-agent` step loading `SDK_PHP_DEPLOY_KEY` before the
> split step (noted inline in `release.yml`).

## 4. Versioning / tag policy

**npm — automatic, per-package, on merge to `main`:**

- Merging to `main` publishes **only** the packages whose built output actually
  changed (content-fingerprint vs npm). Unaffected packages are skipped, so an
  unrelated monorepo change does not churn every package.
- Default bump is **patch**, computed from the npm latest version.
- To ship a **minor/major**, bump that package's `package.json` `version` above
  the current npm latest before merging — `auto-release.mjs` honors a manually
  set higher version; otherwise it auto-patches.
- Each publish creates a `<name>@<version>` git tag for traceability.

**PHP — manual:** push a **`vX.Y.Z`** git tag to run `php-split` (Packagist reads
the version from the tag). Automating this is a known follow-up (§7), pending the
mirror repo + deploy key.

## 5. CI (`.github/workflows/ci.yml`)

Runs on pull requests and on pushes to `dev`, `main`, and `feature/**`.

> **CI never publishes.** PRs and branch pushes run only lint/build/test here.
> Publishing happens in `release.yml` (§3): npm on push to `main`, PHP on a
> `vX.Y.Z` tag — not this workflow.

- **Job `web-and-packages`** (Node 20): `npm ci` → `npm run lint` →
  `npm run build` (website + agent bundles) → uploads the baked
  `sdk-surface.json` as the `sdk-surface` artifact → `npx vitest run` (website
  tests) → `npm test` for `@ekoindia/eps-context-mcp`, `@ekoindia/eps-sdk`, and
  `@ekoindia/eps-mock-server`.
- **Job `php-sdk`** (PHP 8.2 + Composer, in `packages/sdk-php`): `needs`
  `web-and-packages` and **downloads the `sdk-surface` artifact** into `data/`
  (the baked surface is gitignored and never built on the PHP runner) →
  `composer install` → `vendor/bin/phpunit --bootstrap vendor/autoload.php tests`.

> **Isolation:** `php-sdk` is its own status check. Set branch protection to
> require only **`Web + JS/TS packages`** so a PHP failure never blocks the
> `dev → main` merge that gates the npm release. Future SDK jobs follow the same
> pattern (own check, optional).

## 6. Consumer verification checklist

Run after the first publish:

- [ ] `npx -y @ekoindia/eps-context-mcp@latest` starts the stdio MCP server.
- [ ] `npx -y @ekoindia/eps-mock-server` serves on `:4010`.
- [ ] `npm i @ekoindia/eps-sdk` resolves and installs.
- [ ] `composer require ekoindia/eps-sdk` resolves from Packagist.
- [ ] In Claude Code: `/plugin marketplace add ekoindia/eps-platform` then
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
