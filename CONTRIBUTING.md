# Contributing to EPS Platform

Thanks for your interest in contributing! This repo is a single source-of-truth
**data layer** that generates the website, SDKs, MCP server, AI context packs,
mock server, OpenAPI/Postman, and LLM-readable docs. Editing the data
regenerates every artifact in sync — so most contributions are data edits, not
hand-written output.

Please read the [README](README.md) first for the architecture and project
layout, and [AGENTS.md](AGENTS.md) for the data-driven conventions.

## Development setup

Requires **Node.js >= 20** (npm workspaces).

```bash
npm install
npm run dev          # local dev server
npm run build        # full build + bake (generates all artifacts)
npm test             # vitest run
npm run lint         # eslint
npm run format       # prettier --write
```

**No credentials are required** to install, build, lint, or test. Sandbox
credentials are only needed to exercise the `/docs` **"Try it"** console live —
copy [`.env.example`](.env.example) → `.env.local` and add your own Eko
UAT/sandbox keys. Those values are dev-only (`import.meta.env.DEV`), are never
bundled into production, and the access key is used purely for in-browser HMAC
signing. Everything else works credential-free.

## Where to make changes

- Source-of-truth data lives in [`src/lib/data/`](src/lib/data/) — edit data
  there, not the generated pages or the `packages/*/data/` baked outputs.
- `packages/*/data/` and `dist/` are **generated and gitignored** — never
  hand-edit or commit them. If your working tree shows changes there, that's
  build output.
- See the "How to add things" table in the [README](README.md#develop-this-repo)
  for which file to edit for a new API product, spec, guide, industry/solution,
  or AI artifact.

## Branching & commits

- Branch from `dev`. Use prefixes: `feature/`, `bugfix/`, or `chore/`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) — e.g.
  `feat: add BBPS bill-fetch spec`, `fix(ci): ...`, `docs: ...`.
- Open pull requests against `dev` (not `main`). `main` is the production branch.

## Before you open a PR

Run the same checks CI runs:

```bash
npm run lint
npm run build
npm test
```

CI also runs a **secret scan** (gitleaks) — never commit real keys, tokens, or
`.env*` files (only `.env.example` is tracked).

### Pre-commit secret scanning (local)

`npm install` wires a committed pre-commit hook (`.githooks/pre-commit`) via
`core.hooksPath`, so gitleaks scans your **staged** changes on every commit and
blocks the commit if a secret is found — no manual setup. (Re-run
`npm run setup:githooks` if you ever need to re-wire it.)

You must have the `gitleaks` binary installed, or commits are blocked:

```bash
brew install gitleaks          # macOS
scoop install gitleaks         # Windows (or: choco install gitleaks)
# Linux / other: https://github.com/gitleaks/gitleaks#installing
```

The hook uses POSIX `sh` — on Windows run commits from Git Bash (bundled with
Git for Windows). Run the scan manually anytime with:

```bash
gitleaks git --staged -v
```

Notes:

- The hook **blocks all commits** when `gitleaks` is missing (a silently-skipped
  security check is worse than a failed commit). Install it, or bypass a single
  commit with `git commit --no-verify` for genuine false positives.
- If you already point `core.hooksPath` elsewhere, setup leaves it untouched and
  warns — wire it yourself with `git config core.hooksPath .githooks`.
- CI remains the enforced gate; the local hook is a fast fail-early layer.

## Reporting security issues

Do **not** file security problems as public issues — see [SECURITY.md](SECURITY.md).

## Code of conduct

By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
