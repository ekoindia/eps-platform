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
`.env*` files (only `.env.example` is tracked). Optionally run the scan locally
before pushing:

```bash
gitleaks detect --no-banner
```

> Tip: you can wire `gitleaks` as a local pre-commit hook, but it is optional —
> CI is the enforced gate.

## Reporting security issues

Do **not** file security problems as public issues — see [SECURITY.md](SECURITY.md).

## Code of conduct

By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
