# eps-context-mcp remote server — design decision record

**Date:** 2026-07-07 · **Status:** Phase 0 executed (URL contract); Phase 1 (build) not started

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

## Phase 1 build sketch (separate plan cycle — NOT scheduled)

- Add `http.ts` to `packages/eps-context-mcp` following `packages/eps-transact-mcp/src/http.ts` (stateless Hono + per-request `WebStandardStreamableHTTPServerTransport`), minus auth/ctx/upstream-fetch. **Extract a shared remote-MCP HTTP adapter** rather than copy-pasting — both packages live in this repo and use the identical transport pattern (Codex review flag).
- Bundle baked at build (`prepublishOnly` bake exists); Vercel git-integration on `main` = auto-CD.
- **Runtime honesty:** `load-bundle.ts` uses `node:fs` → this is Vercel *Node serverless*, not true edge runtime. Fine. Only refactor to import-JSON if true edge is ever needed.
- **Basic protection even on the platform:** cache headers on responses (bundle-versioned, highly cacheable) + platform rate limiting before launch — "abuse absorbed by platform" is not a free pass (Codex review flag).
- **Domain wiring:** DNS alone cannot path-route; `mcp.eko.in` A-record → VM. Either (a) Cloudflare-proxied DNS with a Worker/origin-rule routing `/context/*` to Vercel — true edge, needs eko.in on Cloudflare; or (b) VM nginx `location /context/` → `proxy_pass` to Vercel — keeps one domain, puts VM back in the availability path (acceptable at current traffic). Decide in Phase 1.
- **Pre-build checks:** verify Lovable custom-MCP support + claude.ai connector no-auth acceptance; confirm client-side behavior against a path-prefixed endpoint.

## Phase 0 changes shipped with this spec

- Nginx runbook rewritten for `/transact/` namespacing before certbot ran: `docs/local-roadmap/how-to-deploy-eps-transact-mcp-on-vm.md` §4 (adds `X-Forwarded-For/-Proto`, `proxy_request_buffering off`, root 404, RHEL yum).
- `src/lib/config/site.ts` `EPS_TRANSACT_MCP_URL` → `https://mcp.eko.in/transact/mcp` (flows to AgentsPage + `/agents.md`; page still gated behind `VITE_SHOW_TRANSACT_MCP`).
- `packages/eps-transact-mcp/README.md` connect snippet → new URL.
- `docs/eps-transact-mcp.md` §Deployment step 4 → path-namespaced proxy contract; poller-image "public" claim corrected to private-in-practice (verified on first VM deploy).
