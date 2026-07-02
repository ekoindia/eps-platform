# eps-backend on Vercel (managed serverless)

Alternative to the VM deploy ([eps-backend-vm-deploy.md](./eps-backend-vm-deploy.md)). At ~20
daily logged-in users the load sits inside a $20 Pro seat's included usage (near-zero marginal
cost). Viable **only because production SimpliBank is a public HTTPS endpoint** — Vercel functions
egress to the public internet, they cannot reach a VPN/private host (that would need Enterprise
Secure Compute, not Pro).

## What the code provides

- `src/buildApp.ts` — side-effect-free factory (config → KV → clients → sessions → Hono app),
  shared by the VM entry and the serverless entry.
- `api/index.ts` — Vercel Node function. Memoizes the built app (one Redis connection per warm
  isolate) and resets the memo if a build fails, so a bad cold start isn't cached.
- `vercel.json` — region `bom1` (Mumbai, near SimpliBank + Upstash India), `maxDuration: 30`,
  and a catch-all rewrite `/(.*) → /api` so every path (`/healthz`, `/auth/*`, `/me`, `/admin/*`)
  reaches the single function; Vercel preserves the original path, so Hono's own router matches.
- Node pinned to `22.x` via `package.json` engines. No new dependency — `hono/vercel` ships with
  hono v4; `node-redis` accepts Upstash's `rediss://` URL as a drop-in.

The VM path (`deploy/poller/`, `docker-compose*.yml`, `Dockerfile`) is untouched and still works.

## Manual setup (Vercel dashboard — no code)

1. **New Vercel project**, Root Directory = `packages/eps-backend`. (The repo-root `vercel.json`
   is the _website_ deploy — a separate project. Do not merge them.)
2. **Add Upstash Redis** via the Vercel Marketplace (India region) → injects `REDIS_URL`
   (`rediss://…`). Free tier (~500k cmds/mo, 256 MB) covers this scale.
3. **Env vars** (Production + Preview): `EKO_DEVELOPER_KEY`, `SIMPLIBANK_API_HOST/PORT/PATH`
   (prod host), `SIMPLIBANK_API_SCHEME=https`, `KV_ENCRYPTION_KEY`, JWT/session secrets,
   `GITHUB_CLIENT_ID/SECRET`, `GITHUB_CALLBACK_URL`, `ZOHO_*`, `CORS_ORIGINS`.
   **Do NOT set** `SIMPLIBANK_ALLOW_INSECURE_HTTP` / `SCHEME=http` (UAT-only; prod is HTTPS).
4. **Custom domain** — see cookies below. Assign e.g. `api.eps.eko.in` to the project.

## Sharp edges (verify before cutover)

- **Session cookies must stay first-party.** A `*.vercel.app` backend is a _different registrable
  domain_ from `eps.eko.in`, so the default `SameSite=Lax` session cookies won't be sent on the
  frontend's cross-site XHR — auth silently breaks. Fix: give the backend a **subdomain of the
  frontend's domain** (`api.eps.eko.in`) so cookies are first-party and `Lax` works. (The
  alternative — `COOKIE_SAMESITE=None` + `Secure` — makes them third-party and fragile; prefer the
  custom domain.)
- **`CORS_ORIGINS` must list the fixed frontend origin(s).** Preview frontends have unique origins;
  they won't match unless added explicitly.
- **GitHub OAuth callback is fixed.** GitHub OAuth Apps don't allow wildcard callbacks — preview
  deploys (random URLs) can't complete admin OAuth. Test the admin console on the fixed
  production/staging domain, or use a separate OAuth app for staging. (Developer OTP login is
  unaffected — no callback.)
- **SimpliBank IP allowlist.** Public HTTPS solves _reachability_, not _allowlisting_. If prod
  SimpliBank restricts client IPs, Vercel's dynamic egress is blocked → needs the Static IPs
  add-on ($100/mo/project) or a fixed-egress proxy. Confirm with Eko first.
- **Admin propose/PR** uses the GitHub REST API only (contents / git-refs / pulls) — no local git
  or filesystem — so it works on serverless as-is.

## Verification (end to end)

1. Preview deploy: `GET /healthz` and `GET /readyz` (Upstash PING) → 200.
2. Full developer OTP login against **prod** SimpliBank over HTTPS: 515 → 518 → 151 → `/me`
   → `/auth/refresh` → logout. Session/refresh keys appear in the Upstash console.
3. **Run login/refresh/logout concurrently** — serverless isolates + Redis sessions can expose
   races the happy path won't.
4. Admin GitHub OAuth (on the fixed domain) → propose (branch + PR) → deploy PR.
5. Force a Redis outage → confirm fail-closed `503 STORE_UNAVAILABLE` still surfaces.
6. Vercel dashboard: invocations/compute inside the $20 credit; Upstash under free-tier caps.
