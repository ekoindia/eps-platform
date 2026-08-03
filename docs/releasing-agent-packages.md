# Releasing the Agent Packages — Runbook

Operational runbook for publishing the EPS AI-agent packages. For the
architecture of what is being shipped, see
[`docs/ai-agent-platform.md`](./ai-agent-platform.md).

---

## 1. Distribution decision

- **npm packages** (`@ekoindia/eps-context-mcp`, `@ekoindia/eps-sdk`,
  `@ekoindia/eps-mock-server`, `@ekoindia/eps-transact-mcp`) → **public npm**
  (`registry.npmjs.org`).
- **PHP SDK** (`ekoindia/eps-sdk`) → **Packagist** (Composer).
- **Agent plugin** (`eps`) → the repo-root `.claude-plugin/marketplace.json`
  (marketplace name `ekoindia`), shipped straight from git `main` — **no npm
  publish step**. Claude Code installs via `/plugin marketplace add
  ekoindia/eps-platform` + `/plugin install eps@ekoindia`; Codex via `codex
  plugin marketplace add …` + `codex plugin add eps@ekoindia`; every other agent
  wires the MCP directly from the per-agent matrix on the `/ai` hub. The wired
  MCP server self-updates regardless (`npx -y …@latest` re-resolves at launch).
  (The transactional `@ekoindia/eps-transact-mcp` server is **not** a plugin —
  it ships only as the npm package above; see
  [`docs/eps-transact-mcp.md`](./eps-transact-mcp.md).)

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

**Phase A — Bootstrap (one-time per package; done for all four):**

1. Confirm the **`@ekoindia` npm org** exists (scoped packages require it).
2. Create a short-lived **automation `NPM_TOKEN`** with publish rights on the
   `@ekoindia` scope; add it as a GitHub Actions repository secret named
   **`NPM_TOKEN`** (consumed as `NODE_AUTH_TOKEN` by `npm publish`).
3. Publish the package **once** (local/manual from a maintainer machine:
   `npm publish --access public`). Local-first avoids a half-published tag.

**Phase B — OIDC steady-state (after the package exists; done for all four):**

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

### Agent plugin marketplace

- Nothing beyond merging `.claude-plugin/marketplace.json` (already at the repo
  root, listing the single `eps` plugin) to the default branch. Claude Code
  users then install with `/plugin marketplace add ekoindia/eps-platform` +
  `/plugin install eps@ekoindia`; other agents follow the per-agent matrix on
  `/ai`.

## 3. Release flow

Driven by **`.github/workflows/release.yml`**. The **npm** side runs on every
push to **`main`** (and `workflow_dispatch`); the **PHP** side runs on a
**`v*.*.*`** tag push.

### Job `npm-release` (auto, on push to `main`)

1. Checks out (full history), sets up Node `22.14.0` with `registry-url:
   https://registry.npmjs.org` and `id-token: write` (job-scoped, for OIDC).
2. `npm ci`, then `npm run build` (repo-root build emits `dist/agent/*.json`
   and then runs `bake:all`, copying them into each package's `data/`).
3. **Test gate** — `npm test` for all four packages (transact-mcp via
   `npm run transact:test`, which builds the `@ekoindia/eps-sdk` dist it imports);
   a failure aborts the release before anything publishes.
4. Runs **`scripts/auto-release.mjs`** for the four npm packages. For each:
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

All four npm packages declare `"publishConfig": { "access": "public" }` (scoped
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

Runs on pull requests and on pushes to `main` only. `dev` and `feature/**` are
covered by their pull-request run; building them on push as well produced a
duplicate identical run and made back-to-back `dev` pushes queue behind each
other on the concurrency group (once, 4m28s of pure wait before the first job
started). `main` keeps its push trigger because the `workflow_run` deploys key
off a completed `main` push run.

> **CI never publishes.** PRs and branch pushes run only lint/build/test here.
> Publishing happens in `release.yml` (§3): npm on push to `main`, PHP on a
> `vX.Y.Z` tag — not this workflow.

`changes` (`dorny/paths-filter`) runs first and every job below gates on its
outputs with a **job-level** `if:`, not a step-level one — a skipped job never
boots a runner or its service containers, so a docs-only change costs nothing.
The jobs then run **concurrently**:

- **`lint`** / **`typecheck`** (Node 20): `npm ci` → `npm run lint` / `npm run typecheck`.
- **`test-web`**: `npm ci` → `npx vitest run`. Runs **no build** — verified that
  all 101 website test files pass with neither `dist/` nor `packages/*/data/`
  present. This is what keeps the critical path short.
- **`build-and-test-packages`** (owns the Valkey service container): `npm ci` →
  `npm run build` → uploads the baked `sdk-surface.json` as the `sdk-surface`
  artifact → `npm test` for `@ekoindia/eps-context-mcp`, `@ekoindia/eps-sdk`,
  `@ekoindia/eps-mock-server`, `@ekoindia/eps-transact-mcp`, and
  `@ekoindia/eps-backend` (with `REDIS_TEST_URL` set) → shellcheck + poller harness.
- **`docker`** (gated on the `backend`/`transact`/`poller` filters): compose
  validations + Buildx image builds with a GHA layer cache (separate cache
  scopes per image) + the transact `/healthz` smoke.
- **`php-sdk`** (PHP 8.2 + Composer, in `packages/sdk-php`): `needs`
  `build-and-test-packages` and **downloads the `sdk-surface` artifact** into
  `data/` (the baked surface is gitignored and never built on the PHP runner) →
  `composer install` → `vendor/bin/phpunit --bootstrap vendor/autoload.php tests`.

> **Why build and the package tests share one job:** every `bake-*.mjs` script
> reads `dist/agent/*.json`, so `bake:all` — and therefore the eps-context-mcp,
> eps-sdk, and eps-transact-mcp suites — hard-depends on `vite build`. Splitting
> them would mean either a second `vite build` on another runner or an artifact
> hand-off that re-serializes the two. `eps-backend` and `eps-mock-server` do not
> need the baked data, but they are fast and ride along.

- **`ci-ok`** — the single **required** status check. It `needs` every job above
  except `php-sdk`, runs with `if: always()`, and fails if any of them reports
  anything other than `success` or `skipped`. It also asserts `changes` itself
  succeeded, so a broken gate (which would skip everything downstream) can never
  pass the pipeline silently.

> **Isolation:** `php-sdk` is its own status check and is deliberately **not** in
> `ci-ok`'s `needs`, so a PHP failure never blocks the `dev → main` merge that
> gates the npm release. Future SDK jobs follow the same pattern (own check,
> optional).
>
> **Branch protection:** require only **`CI / CI OK`**. Because every other job
> is intentionally skippable via a path filter, requiring them individually would
> leave merges stuck on checks that legitimately never report. Adding or renaming
> a job never needs a branch-protection edit again — just update `ci-ok`'s `needs`.

## 6. Consumer verification checklist

Run after the first publish:

- [ ] `npx -y @ekoindia/eps-context-mcp@latest` starts the stdio MCP server.
- [ ] `npx -y @ekoindia/eps-mock-server` serves on `:4010`.
- [ ] `npm i @ekoindia/eps-sdk` resolves and installs.
- [ ] `composer require ekoindia/eps-sdk` resolves from Packagist.
- [ ] `npx plugins discover ekoindia/eps-platform` finds **1 plugin**
      (`eps`: 3 skills + 1 command).
- [ ] In Claude Code: `/plugin marketplace add ekoindia/eps-platform` then
      `/plugin install eps@ekoindia` works (and the `eps` MCP + skills +
      `/eps` command load).
- [ ] In Codex: `codex plugin marketplace add ekoindia/eps-platform` +
      `codex plugin add eps@ekoindia` install the skills; `codex mcp add eps --
      npx -y @ekoindia/eps-context-mcp@latest` loads the MCP tools.

## 7. Known follow-ups

- **Live-load the `eps` agent plugin** end-to-end in real sessions (files are
  well-formed and `npx plugins discover`/local-add smoke passes, but not yet
  verified in a live agent session).
- **Wire the PHP mirror**: create `ekoindia/eps-sdk-php`, add
  `SDK_PHP_DEPLOY_KEY` + the `ssh-agent` step, and submit to Packagist so
  `php-split` runs for real.
- **Future SDK languages** (Java, C#/.NET, Python, Go) — out of current scope;
  Go would ship as a tagged VCS repo, JVM/.NET via Maven Central / NuGet.
