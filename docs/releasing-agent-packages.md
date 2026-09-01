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
- **Go SDK** (`github.com/ekoindia/eps-sdk-go`) → **no registry**: proxy.golang.org
  serves the mirror repo's git tag directly.
- **Python SDK** (`eps-sdk`) → **PyPI**, published with OIDC Trusted Publishing
  (no API token), same as npm.
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

**Order matters.** Merge to `main` before anything else: a tag runs only the
jobs that exist *on the tagged commit*, so `sdk-split` / `pypi-release` must
already be on `main` and every tag below must be cut from it. Then: mirrors +
`SDK_SPLIT_TOKEN` → first `vX.Y.Z` tag → Packagist submission (there is no
`composer.json` to read before that tag) → PyPI environment → PyPI pending
publisher → first `sdk-python-vX.Y.Z` tag.

> **Tags are immutable downstream.** The Go module proxy and Packagist cache a
> tag permanently, and a PyPI version can never be re-uploaded. A broken
> `v0.1.0` is fixed by `v0.1.1`, never by moving the tag.

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

### SDK mirror repos + `SDK_SPLIT_TOKEN` (shared by every git-tag-published SDK)

No package manager can install from a monorepo subdirectory, so `sdk-split`
subtree-splits each `packages/sdk-*` into its own read-only mirror. One PAT
covers every mirror — the default `GITHUB_TOKEN` cannot push to another repo.

1. Create one **empty public mirror per language**. Leave them empty: no README,
   no license, no initial commit — the split force-pushes history in, and an
   initial commit only creates a conflict.

   ```bash
   gh repo create ekoindia/eps-sdk-php --public \
     --description "Read-only mirror of packages/sdk-php from ekoindia/eps-platform. Do not commit here."
   gh repo create ekoindia/eps-sdk-go --public \
     --description "Read-only mirror of packages/sdk-go from ekoindia/eps-platform. Do not commit here."
   ```

   Mirror names are **not** free choice once a language ships: Go's module path
   `github.com/ekoindia/eps-sdk-go` is compiled into `go.mod`, and Composer's
   `ekoindia/eps-sdk` is bound to whatever repo Packagist indexed.

2. Create the **fine-grained PAT** at
   <https://github.com/settings/personal-access-tokens/new> (fine-grained tokens
   cannot be created from the CLI):

   | Field                  | Value                                                    |
   | ---------------------- | -------------------------------------------------------- |
   | Token name             | `eps-sdk-split`                                          |
   | **Resource owner**     | **`ekoindia`** — defaults to your personal account, and a personal-account token cannot reach org repos |
   | Expiration             | your call; track the renewal — an expired token fails the release preflight |
   | Repository access      | *Only select repositories* → every `eps-sdk-*` mirror     |
   | Repository permissions | **Contents: Read and write** (Metadata: Read-only is added automatically). Nothing else. |

   If the org requires approval, approve it at **ekoindia → Settings → Personal
   access tokens → Pending requests**.

3. Store it and verify it reaches every mirror — the same check the job's
   preflight step runs:

   ```bash
   gh secret set SDK_SPLIT_TOKEN --repo ekoindia/eps-platform   # paste, then Ctrl-D

   for r in eps-sdk-php eps-sdk-go; do
     echo -n "$r: "
     curl -sf -o /dev/null -H "Authorization: Bearer <PASTE_PAT>" \
       "https://api.github.com/repos/ekoindia/$r" && echo OK || echo "NO ACCESS"
   done
   ```

4. Recommended: add a **tag ruleset** on `v*.*.*` restricting who can push one.
   `sdk-split` executes workflow code from the tagged commit with
   `SDK_SPLIT_TOKEN` in scope, and a tag can be cut from any commit.

### PHP / Packagist

1. **After the first `sdk-split` run has pushed to the mirror** — Packagist
   reads `composer.json` from the mirror root and rejects a repo that has none —
   submit the mirror repo URL to **packagist.org** once. Submission registers
   the package name `ekoindia/eps-sdk`; it does not reserve the whole
   `ekoindia` vendor prefix, so later PHP packages are submitted the same way.

   ```bash
   # Is it submitted yet? 404 = not indexed.
   curl -s -o /dev/null -w '%{http_code}\n' https://repo.packagist.org/p2/ekoindia/eps-sdk.json
   ```

2. Enable the **Packagist → GitHub webhook** on the mirror (or rely on tags —
   pushing a `vX.Y.Z` tag to the mirror triggers a new Packagist release).

### Go modules

Nothing to register: proxy.golang.org serves the mirror's git tag on first
request, so the mirror repo (above) and a public tag are the whole setup. Verify
after the first split:

```bash
gh api repos/ekoindia/eps-sdk-go/contents/data/sdk-surface.json --jq .size
GOFLAGS=-mod=mod go install github.com/ekoindia/eps-sdk-go@v0.1.0
```

The embedded surface is what makes that first command worth running: Go embeds
`data/sdk-surface.json` at **compile** time, so a mirror missing it does not
merely misbehave at runtime — it fails to build for every consumer.

### Python / PyPI

Unlike npm, PyPI needs **no bootstrap publish**: a *pending publisher* reserves
the name, and the first CI run creates the project. Nothing is uploaded by hand
and no API token exists anywhere.

1. Confirm the project name **`eps-sdk`** is free — `404` means free:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://pypi.org/pypi/eps-sdk/json
   ```

   If it is taken, fall back to `ekoindia-eps-sdk` and update
   `packages/sdk-python/pyproject.toml` + `SDK_INSTALL` in
   `src/lib/docs/code-samples.ts` together.

2. Create the **`pypi` environment first** — the `pypi-release` job declares it
   and the trusted-publisher binding checks it:

   ```bash
   gh api -X PUT repos/ekoindia/eps-platform/environments/pypi
   ```

3. On pypi.org → *Your account → Publishing* → **Add a pending publisher**. All
   five fields must match exactly or the publish is rejected with a mismatched-
   claim error:

   | Field             | Value          |
   | ----------------- | -------------- |
   | PyPI Project Name | `eps-sdk`      |
   | Owner             | `ekoindia`     |
   | Repository name   | `eps-platform` |
   | Workflow name     | `release.yml`  |
   | Environment name  | `pypi`         |

4. Verify after the first `sdk-python-vX.Y.Z` tag — the constructor is what
   proves the wheel actually carries the baked surface:

   ```bash
   pip install eps-sdk
   python -c "from eps_sdk import EpsClient; EpsClient('d','a','sandbox')"
   ```

### Agent plugin marketplace

- Nothing beyond merging `.claude-plugin/marketplace.json` (already at the repo
  root, listing the single `eps` plugin) to the default branch. Claude Code
  users then install with `/plugin marketplace add ekoindia/eps-platform` +
  `/plugin install eps@ekoindia`; other agents follow the per-agent matrix on
  `/ai`.

## 3. Release flow

Driven by **`.github/workflows/release.yml`**. The **npm** side runs on every
push to **`main`** (and `workflow_dispatch`); the **git-tag-published** SDKs run
on a **`v*.*.*`** tag push; the **Python** SDK runs on its own package-scoped
**`sdk-python-v*`** tag.

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
> surface is baked by `scripts/bake-surface.mjs` (one script for every SDK
> language, taking the package dir as its argument), invoked from
> the root `bake:all`.

### Job `sdk-split` (manual, on a `vX.Y.Z` tag)

A matrix over every **git-tag-published** SDK — today PHP, with Go and Java
designed to slot in as extra rows. For each: bakes `<dir>/data/sdk-surface.json`
and **commits it into the ephemeral checkout before splitting** — the subtree
split only carries committed files, and the surface is gitignored, so without
this the mirror would ship without the runtime asset and the client would fail.
Then re-runs that language's test suite (the release gate — see §5) and
subtree-splits `<dir>` into its `ekoindia/eps-sdk-<lang>` mirror, propagating the
triggering tag (via `symplify/monorepo-split-github-action`). Pushing the tag to
the mirror is what publishes: Packagist indexes it, the Go module proxy serves
it, JitPack builds it.

Splitting a row whose sources did not change is harmless — the mirror just gets
another tag over identical content. That is only true because these ecosystems
publish from git; registry-published SDKs with immutable versions get their own
package-scoped tag instead (§4).

Before any of that, two gates run. A **preflight** asserts `SDK_SPLIT_TOKEN` is
set and can reach the row's mirror — a missing or wrongly-scoped token fails in
seconds instead of after the full build. After the bake commit, **Verify
publishable archive** runs `git archive` over the split directory and asserts
`data/sdk-surface.json` is in it and `tests/` is not: what consumers install is
the dist archive, so `.gitattributes` `export-ignore` and the baked asset are
checked against the archive itself, not the repo tree.

> **Third-party actions in this job are SHA-pinned** (`monorepo-split`,
> `setup-php`). It holds a write-capable PAT for the mirrors, and a mutable tag
> like `@v2.3.0` could be repointed at other code. The version stays in a
> trailing comment. A related hardening is a **tag ruleset** on `v*.*.*`: the
> job runs workflow code *from the tagged commit*, so whoever can push such a
> tag can run arbitrary code with that PAT.

> **Status:** wired. The remaining one-time actions are the mirror repo, the
> `SDK_SPLIT_TOKEN` secret and the Packagist submission (§2).

### Job `pypi-release` (manual, on an `sdk-python-vX.Y.Z` tag)

Builds the website (to bake `packages/sdk-python/data/sdk-surface.json`), asserts
the tag matches `pyproject.toml`'s `version`, re-runs the conformance suite,
builds the sdist + wheel, **verifies the wheel actually contains
`eps_sdk/data/sdk-surface.json`** (the `force-include` is easy to break and the
failure only shows up on a consumer's first call), then publishes via
`pypa/gh-action-pypi-publish` using OIDC.

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

**Git-tag-published SDKs (PHP, later Go/Java) — manual:** push a **`vX.Y.Z`**
git tag to run `sdk-split` (each ecosystem reads the version from the tag).
Automating this is a known follow-up (§7), pending the mirror repos + token.

**Python — manual, package-scoped:** push an **`sdk-python-vX.Y.Z`** tag matching
`pyproject.toml`'s `version`. The scoped tag is deliberate: PyPI versions are
immutable, so a shared `vX.Y.Z` tag re-run (harmless for the git-published SDKs)
would collide. The same rule applies to any future registry-published SDK.

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
- **`php-sdk`** / **`python-sdk`** / **`go-sdk`** (gated on their own path
  filters, each a subset of `code`): download the `sdk-surface` artifact from
  `build-and-test-packages`, then run that language's conformance suite —
  PHPUnit; stdlib `unittest` plus a wheel-contents check; `gofmt`, `go vet` and
  `go test`. Both are
  deliberately **excluded from `ci-ok`** so a non-JS SDK failure never blocks the
  `dev → main` merge that gates the npm release. That is not a release loophole:
  every SDK release job re-runs its own tests before publishing.
- **`build-and-test-packages`** (owns the Valkey service container): `npm ci` →
  `npm run build` → uploads the baked `sdk-surface.json` as the `sdk-surface`
  artifact → `npm test` for `@ekoindia/eps-context-mcp`, `@ekoindia/eps-sdk`,
  `@ekoindia/eps-mock-server`, `@ekoindia/eps-transact-mcp`, and
  `@ekoindia/eps-backend` (with `REDIS_TEST_URL` set) → shellcheck + poller harness.
- **`docker`** (gated on the `backend`/`transact`/`poller` filters): compose
  validations + Buildx image builds with a GHA layer cache (separate cache
  scopes per image) + the transact `/healthz` smoke. When `transact` matches it
  also runs `npm ci && npm run build` first: the transact image `COPY`s the
  gitignored `packages/{sdk-js,eps-transact-mcp}/data/` out of the **build
  context** (see the prerequisite note atop
  `packages/eps-transact-mcp/Dockerfile`), so those files must exist on the
  runner. A guard step asserts both are present before Buildx, so a build that
  stops emitting them fails with a clear message instead of an opaque BuildKit
  checksum error. The poller image and the compose validations need none of this.
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
- [ ] `composer require ekoindia/eps-sdk` resolves from Packagist at the exact
      published version (not `dev-main` — that only proves the mirror branch
      exists, not that the tag propagated and Packagist ingested it).
- [ ] `go get github.com/ekoindia/eps-sdk-go@vX.Y.Z` resolves and the package
      compiles (it embeds the surface at build time, so a missing bake fails
      here loudly).
- [ ] `pip install eps-sdk` installs, and
      `python -c "from eps_sdk import EpsClient; EpsClient('d','a','sandbox')"`
      constructs without raising "EPS SDK surface not found".
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
- **Wire the PHP mirror**: the workflow side is done (PAT wired, actions pinned,
  preflight + archive gates in place), and `ekoindia/eps-sdk-php` exists but is
  still empty. Outstanding one-time actions: add the `SDK_SPLIT_TOKEN` secret,
  cut `v0.1.0`, then submit the mirror to Packagist (§2, in that order).
- **No content gate for the git-published SDKs.** npm has `auto-release.mjs`
  (fingerprint vs registry); PHP has none, so a `vX.Y.Z` tag re-splits whether or
  not `packages/sdk-php` changed. A PHP analog would fingerprint against
  `https://repo.packagist.org/p2/ekoindia/eps-sdk.json`, since PHP carries no
  manifest `version` — the tag is the version.
- **`vX.Y.Z` is repo-global**, shared by every future `sdk-split` row, so Go and
  Java will not be able to version independently of PHP. Python sidestepped this
  with a package-scoped tag; revisit the scheme when the second row lands.
- **Wire PyPI**: claim the `eps-sdk` name, add the Trusted Publisher + `pypi`
  environment (§2), then cut the first `sdk-python-v0.1.0` tag.
- **Wire the Go mirror**: create `ekoindia/eps-sdk-go` (the module path
  `github.com/ekoindia/eps-sdk-go` is compiled into `go.mod`, so the name is
  fixed) and give `SDK_SPLIT_TOKEN` write access to it. No registry submission —
  the first `vX.Y.Z` tag is the release.
- **Remaining SDK languages** (Java, C#/.NET) — ports of the same ~220-line
  client against `docs/sdk-golden-vector.md`. Java adds a row to the `sdk-split`
  matrix and needs **no registry account** (JitPack builds straight from the
  tag; Maven Central can come later without breaking consumers). C#/.NET is the
  only one that requires a marketplace account (NuGet + `NUGET_API_KEY`), since
  no git-install path exists.
