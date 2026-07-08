# eps-context-mcp remote server — design decision record

**Date:** 2026-07-07 · **Status:** Phase 0 executed (URL contract); **Phase 1 build code landed 2026-07-08** (adapter + Vercel handler + tests green) — remaining = Vercel project + nginx wiring + pre-launch validation. Decision on domain wiring: **(b) VM nginx proxy**.

## Decision

Serve `eps-context-mcp` remotely (streamable HTTP) in addition to the existing npm/stdio bin, **anonymous access, edge-hosted** — and settle the `mcp.eko.in` URL contract *before* eps-transact-mcp's public launch so both servers share one domain cleanly.

## URL contract (permanent, decided Phase 0)

```
https://mcp.eko.in/transact/mcp   → VM 127.0.0.1:8788 (live)
https://mcp.eko.in/context/mcp    → edge (future; /context/healthz likewise FUTURE-ONLY —
                                     do not point monitoring at it until Phase 1 ships)
```

Path-namespaced, one domain, one cert. Nginx `location /transact/` + trailing-slash `proxy_pass` strips the prefix; the app serves bare `/mcp` unchanged. Verified safe: the transport emits no absolute URLs, redirects, or SSE (`enableJsonResponse: true`, POST-only). Bare `/` returns 404 to keep the namespace clean. Consumers of the URL: `src/lib/config/site.ts` (`EPS_TRANSACT_MCP_URL` → AgentsPage + `/agents.md` twin), `packages/eps-transact-mcp/README.md`.

## Why remote (reasons reweighted from the original idea)

1. **Web-agent reach (the hard justification).** Lovable, claude.ai connectors, and other hosted agents cannot spawn stdio processes; a remote URL is the only way in. This is an acquisition channel: agents that can try EPS context frictionlessly recommend EPS APIs.
2. Freshness and install-ease are *secondary*: stdio already has `npx @latest` re-resolution, a startup update-check, and `EPS_BUNDLE_URL` fresh-bundle fetch (`src/load-bundle.ts`). Remote mainly helps long-running clients that never restart.

stdio/npm publishing stays first-class for CLI agents (Claude Code, Cursor).

## Why anonymous + edge (not VM, not keyed)

- **Anonymous:** context tools are read-only documentation lookups — no credentials, no PII, no billable upstream calls. Keying it would kill try-before-signup acquisition value.
- **Edge (Vercel, aligning with eps-backend's serverless direction):** the server is a stateless JSON-bundle lookup — serverless-shaped. Abuse/DDoS/scaling become the platform's problem; zero blast radius on the prod VM that hosts transact (financial APIs) + ems.

### Alternatives rejected
- **Bundle-URL-only (no remote server):** solves freshness with zero infra but gives web agents nothing. Fails the load-bearing reason.
- **VM co-hosting (port 8789 + poller):** uniform ops, but puts a public unmetered anonymous endpoint on shared prod hardware; in-memory rate limiting is per-process best-effort.
- **Keyed access:** partner-tool posture, wrong for a marketing surface.

## Phase 1 build — status (code landed 2026-07-08)

**Done (code, tests green):**
- `packages/eps-context-mcp/src/http.ts` — stateless Hono app, per-request `WebStandardStreamableHTTPServerTransport`, `GET /healthz`, `POST /mcp`, 405 on GET/DELETE. No auth/ctx/upstream-fetch. Built **directly** (not copy-pasted from transact) to avoid dragging in auth/rate-limit/logging assumptions; the shared-adapter extraction is deferred until both `http.ts` shapes are proven identical (see below).
- `packages/eps-context-mcp/api/index.ts` + `vercel.json` — Vercel Node-serverless handler via `hono/vercel`, memoized bundle load, catch-all rewrite (`regions:["bom1"]`, `maxDuration:15`).
- Deps: bumped `@modelcontextprotocol/sdk` `^1.0.0`→`^1.29.0` (needed for `webStandardStreamableHttp`), added `hono ^4.0.0`.
- `src/http.test.ts` — healthz, 405, anonymous initialize+tools/list, `Cache-Control: no-store` assertion.
- **Cache correctness (Codex flag):** `POST /mcp` sets `Cache-Control: no-store` — MCP responses vary by JSON-RPC body/method, so caching by `bundleVersion` alone would serve the wrong tool result. Any caching is limited to `GET /healthz` / static assets.

**Remaining (ops / not code):**
- **Vercel project** — create it pointing at `packages/eps-context-mcp`, git-integration on `main` = auto-CD. Bundle baked at build (`prepublishOnly` bake exists).
- **nginx on VM** — add `location /context/ { proxy_pass https://<vercel-origin>/; }` mirroring `/transact/`; for a `*.vercel.app` origin also `proxy_ssl_server_name on` + `proxy_set_header Host <vercel-host>` (Codex flag — else SNI-misroute/404), unless a Vercel custom domain is configured.
- **Rate limiting is the real protection** (Codex flag — cache headers are not protection): add nginx `limit_req` on `location /context/` (or Vercel-side) before launch, or accept the abuse risk in writing.
- **Shared-adapter extraction** — only after both packages' `http.ts` shapes are proven identical by tests; premature abstraction with one caller was speculative.
- **Pre-launch validation:** verify Lovable custom-MCP support + claude.ai connector no-auth acceptance; confirm client behavior against the path-prefixed endpoint. **This doubles as the Item-4 OAuth spike** — same claude.ai no-auth question.
- **Runtime honesty:** `load-bundle.ts` uses `node:fs` → Vercel *Node serverless*, not true edge. Fine; refactor to import-JSON only if true edge is ever needed.

## Phase 0 changes shipped with this spec

- Nginx runbook rewritten for `/transact/` namespacing before certbot ran: `docs/local-roadmap/how-to-deploy-eps-transact-mcp-on-vm.md` §4 (adds `X-Forwarded-For/-Proto`, `proxy_request_buffering off`, root 404, RHEL yum).
- `src/lib/config/site.ts` `EPS_TRANSACT_MCP_URL` → `https://mcp.eko.in/transact/mcp` (flows to AgentsPage + `/agents.md`; page still gated behind `VITE_SHOW_TRANSACT_MCP`).
- `packages/eps-transact-mcp/README.md` connect snippet → new URL.
- `docs/eps-transact-mcp.md` §Deployment step 4 → path-namespaced proxy contract; poller-image "public" claim corrected to private-in-practice (verified on first VM deploy).
