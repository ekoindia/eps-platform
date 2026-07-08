<div align="center">

<img src="public/eps-logo-color.svg" alt="Eko Platform Services" width="96">

# Eko Platform Services

<!-- Build & meta -->
[![CI](https://github.com/ekoindia/eps-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/ekoindia/eps-platform/actions/workflows/ci.yml)
[![Release](https://github.com/ekoindia/eps-platform/actions/workflows/release.yml/badge.svg)](https://github.com/ekoindia/eps-platform/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![API Docs](https://img.shields.io/badge/API%20Docs-1A5366)](https://eps.eko.in/docs)

<!-- Published packages: version · monthly downloads -->
[![eps-sdk](https://img.shields.io/npm/v/%40ekoindia%2Feps-sdk?label=%40ekoindia%2Feps-sdk)](https://www.npmjs.com/package/@ekoindia/eps-sdk)
[![eps-context-mcp](https://img.shields.io/npm/v/%40ekoindia%2Feps-context-mcp?label=%40ekoindia%2Feps-context-mcp)](https://www.npmjs.com/package/@ekoindia/eps-context-mcp)
[![eps-mock-server](https://img.shields.io/npm/v/%40ekoindia%2Feps-mock-server?label=%40ekoindia%2Feps-mock-server)](https://www.npmjs.com/package/@ekoindia/eps-mock-server)


</div>

**The AI-ready developer platform for [Eko Platform Services](https://eps.eko.in) — India's fintech APIs** (AePS, DMT, BBPS, PPI wallets, KYC & verification, agent banking).

A single source-of-truth **data layer** describes every EPS API once. From it, the build generates everything a developer — or their AI coding agent — needs to integrate: backend SDKs, an MCP server, drop-in AI context packs, an offline mock server, OpenAPI + Postman, LLM-readable docs, and the marketing + developer-docs website itself. Edit the data, and every artifact regenerates in sync.

## Why this exists

- **One source of truth, zero drift.** Specs, SDKs, MCP, docs, OpenAPI and code samples all derive from the same data layer (`src/lib/data/`). No hand-maintained copies that fall out of date.
- **AI-ready by design.** Ships an MCP server plus drop-in context packs (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `copilot-instructions.md`) so agents integrate EPS correctly — including the tricky parts: per-request HMAC-SHA256 signing and multi-step recipes (e.g. the DMT `463 → onboard sender` branch).
- **Backend-safe SDKs.** JS and PHP SDKs are generated from an SDK surface with signing built in and cross-language golden-vector conformance tests. Coverage is a growing subset — see the [API coverage roadmap](docs/api-coverage-roadmap.md).
- **Open & offline.** The MCP runs locally with a baked-in bundle (no hosted service, no secrets); an offline mock server replays recorded fixtures for tests.

## Use EPS

```bash
# AI agent context (any MCP-capable harness)
npx -y @ekoindia/eps-context-mcp

# Backend SDKs (server-side only — signing key must stay secret)
npm install @ekoindia/eps-sdk          # Node.js
composer require ekoindia/eps-sdk      # PHP 8.1+

# Offline mock server for local dev & tests
npx -y @ekoindia/eps-mock-server
```

Install the EPS `eps` plugin (MCP + skills + `/eps` command) into your coding agent — Claude Code and Codex have a native two-step plugin install, every other agent wires the MCP directly. See the per-agent install matrix at the site's `/ai` hub, and point any agent at `/llms.txt` for the full machine-readable index.

## Project structure

```
src/
  lib/
    data/        # ← source-of-truth data layer (specs, products, recipes, industries, solutions, pricing)
    agent/       # generators: agent bundle, fixtures, install matrix, context packs
    sdk/         # generators: SDK surface, Postman collection
    openapi/     # generator: OpenAPI 3.1 document
    markdown/    # generators: /llms.txt, /index.md, /products.md, per-page markdown
    config/      # site-wide config constants (site URL, API endpoints)
  components/ hooks/ pages/ assets/   # the React website
  App.tsx / AppServer.tsx / entry-server.tsx / main.tsx   # SPA + SSG entry points
ssg/             # custom Vite plugin for static pre-rendering
public/          # static files served as-is (robots.txt, _redirects)
docs/            # detailed documentation (index below)
vite-plugin-generate-*.ts   # build-time emitters (openapi, agent bundle, markdown, xlsx)

packages/        # published artifacts (each baked from the build output):
  eps-context-mcp/   # @ekoindia/eps-context-mcp — local docs/context MCP server (npm)
  eps-transact-mcp/  # @ekoindia/eps-transact-mcp — transactional MCP server: remote HTTP + local stdio (private)
  sdk-js/            # @ekoindia/eps-sdk — Node.js backend SDK (npm)
  eps-mock-server/   # @ekoindia/eps-mock-server — offline mock server (npm)
  sdk-php/           # ekoindia/eps-sdk — PHP backend SDK (Composer/Packagist)
  claude-plugin-eps/ # agent plugin: dev-time EPS context (manifest + skills + /eps command; not an npm package)

dist/                  # build output (generated, gitignored)
packages/*/data/       # baked artifacts copied here at build time (generated, gitignored — never hand-edit)
```

That's **3 npm packages, 1 Composer package, and 1 agent plugin bundle** (the `eps` context plugin, installed via each agent's native plugin manager or MCP config — see `/ai`). The transactional MCP server ships as its own `@ekoindia/eps-transact-mcp` package (hosted + local stdio); it is not a coding-agent plugin.

> [!CAUTION]
> The `packages/*/data/` files are generated outputs — they may be present in your working tree but are gitignored and **must never be hand-edited or committed**.

## Data & configuration

**Source-of-truth data** (`src/lib/data/`):

| File | Role |
|------|------|
| [`api-specs.ts`](src/lib/data/api-specs.ts) | Technical REST specs, one entry per API (deltas only) |
| `api-auth.ts` / `api-error-codes.ts` / `api-specs-common.ts` | Shared auth headers, error catalog, common params/envelopes + resolvers |
| [`api-products.ts`](src/lib/data/api-products.ts) | API product registry + metadata |
| [`api-product-pages.ts`](src/lib/data/api-product-pages.ts) | Product-page marketing content (hero, features, FAQs, SEO) — no technical data |
| `api-recipes.ts` | Multi-step integration recipes (e.g. DMT onboard-then-transfer) |
| [`industries.ts`](src/lib/data/industries.ts) / [`solutions.ts`](src/lib/data/solutions.ts) | Industry pages + solution/pack definitions |
| `api-pricing.ts` / `payments-pricing.ts` | Pricing data (drives pricing page + xlsx calculator) |
| `docs-registry.ts` | Merges MDX guides + API endpoints into the docs nav |

**Config files** (root): `package.json` (npm workspaces), `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `eslint.config.js`, `components.json`, the `vite-plugin-generate-*.ts` emitters, and per-platform deploy rewrites (`vercel.json`, `netlify.toml`, `nginx.conf`, `.htaccess`).

> [!TIP]
> A full index of **every** configuration file lives in [docs/configuration.md](docs/configuration.md).

## How it works

```
src/lib/data/ ──▶ npm run build
                   ├─ vite build   → dist/ (website, openapi.json, /agent/*.json + per-API & per-topic slices,
                   │                  context packs, /llms.txt, /index.md, /products.md, pricing xlsx)
                   └─ bake:all     → copies the relevant artifacts into each packages/*/data/
                                     (then each package builds & publishes from there)
```

`npm run build` runs the Vite build and then invokes `bake:all` automatically — you don't run them separately.

## Develop this repo

**Setup** (Node `>=20`):

```bash
npm install
npm run dev          # local dev server
npm run build        # full build + bake (generates all artifacts)
npm test             # vitest run
npm run lint         # eslint
```

`npm install`, `npm run build`, `npm run lint`, and `npm test` all run **without any
credentials** — no API keys are needed to build the site or run the suite. Sandbox
credentials are only required to exercise the `/docs` **"Try it"** console live: copy
[`.env.example`](.env.example) → `.env.local` and fill in your own Eko UAT/sandbox keys.
Those values are read only during `vite dev` (gated by `import.meta.env.DEV`), are never
bundled into production, and the access key is used purely for in-browser HMAC signing.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.

**How to add things:**

| Add a… | Edit | Guide |
|--------|------|-------|
| API product | `api-products.ts` + `api-product-pages.ts`, then add it to `ProductsSection.tsx` tabs | [docs/configuration.md](docs/configuration.md) |
| API spec | `api-specs.ts` (set `productId`) | [docs/api-specs.md](docs/api-specs.md) |
| Dev-docs API reference | (auto from `api-specs.ts`) | [docs/developer-docs/api-documentation.md](docs/developer-docs/api-documentation.md) |
| Dev-docs guide (MDX prose) | add MDX guide | [docs/developer-docs/mdx-guides.md](docs/developer-docs/mdx-guides.md) |
| Industry / Solution pack | `industries.ts` / `solutions.ts` | [docs/industry-and-packs-plan.md](docs/industry-and-packs-plan.md) |
| AI artifact / context pack | `src/lib/agent/` generators | [docs/ai-agent-platform.md](docs/ai-agent-platform.md) |

**Gotchas:**
- `packages/*/data/` and `dist/` are **generated** by the build/`bake:all` — never hand-edit, never commit (gitignored). If a preview shows changes there, that's build output, not source.
- The site builds to **static pre-rendered HTML** (SSG) for every known route; unknown routes fall back to the SPA shell (`__spa-fallback.html`) via each platform's catch-all rewrite. See [docs/static-page-generation.md](docs/static-page-generation.md) and [docs/ssg-hydration.md](docs/ssg-hydration.md).
- After a redeploy, stale JS chunks auto-reload — see [docs/chunk-error-auto-reload.md](docs/chunk-error-auto-reload.md).
- **Deploy:** build locally, then deploy `dist/` to any of Vercel / Netlify / Apache / Nginx — each reads only its own rewrite file (`vercel.json` / `netlify.toml` / `.htaccess` / `nginx.conf`), so they don't conflict.

## Documentation

**Platform & AI**
- [AI agent platform](docs/ai-agent-platform.md)
- [Transactional MCP server](docs/eps-transact-mcp.md)
- [API coverage roadmap](docs/api-coverage-roadmap.md)

**API & data model**
- [API technical specifications](docs/api-specs.md)
- [Markdown / LLM content generation](docs/markdown-generation.md)
- [Developer-docs portal architecture](docs/developer-docs/)
- [Industries & solution packs plan](docs/industry-and-packs-plan.md)

**SDKs & release**
- [SDK golden-vector conformance](docs/sdk-golden-vector.md)
- [Releasing the agent packages](docs/releasing-agent-packages.md)

**Site build & ops**
- [Configuration — every config file](docs/configuration.md)
- [Static page generation (SSG)](docs/static-page-generation.md) · [hydration rules](docs/ssg-hydration.md)
- [Pricing calculator](docs/pricing-calculator.md) · [Command palette (⌘K)](docs/command-palette-search.md) · [Stale-chunk auto-reload](docs/chunk-error-auto-reload.md)

## Tech stack

Vite · React · TypeScript · Tailwind CSS · shadcn-ui · npm workspaces.

## Contributing & security

- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, branch/commit conventions, PR workflow.
- [SECURITY.md](SECURITY.md) — how to report a vulnerability (please do **not** open a
  public issue for security reports).
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards.

## License

Source code is released under the [MIT License](LICENSE). The MIT grant
covers the **code** only. The **"Eko" name, logos, and brand assets** are trademarks of
their owner and are **not** licensed for reuse. Marketing copy, page content, and design
assets under `src/` and `public/` may be subject to separate terms — see `LICENSE` for the
exact scope before reusing non-code material.
