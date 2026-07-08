# EPS Transactional MCP Server (`packages/eps-transact-mcp`)

Remote + local MCP server whose tools **execute** Eko EPS verification APIs with the partner's own credentials. Phase 1 surface: every `category: "verification"`, non-`financial` spec (30 endpoints at time of writing). Partner-facing usage lives in the [package README](../packages/eps-transact-mcp/README.md); this doc covers architecture, security posture, and operations.

**Marketing surface:** the public `/agents` page (`src/pages/AgentsPage.tsx`) and its `/agents.md` twin market this server. Both are gated behind the `VITE_SHOW_TRANSACT_MCP` build flag (`src/lib/config/features.ts`) — the nav split, prerender, sitemap, and llms.txt entry only appear once the flag is on. **Flip it to `true` only after this server is deployed to production and smoke-tested**, and reconcile the page's connect snippet with the exact credential/header names from the package README at that time.

## Architecture

```
api-specs.ts ──(vite build)──▶ dist/agent/eps.json ──(bake)──▶ data/eps.json
                                        │                            │
                                        ▼                            ▼
                              sdk-surface.json ──▶ @ekoindia/eps-sdk (EpsClient)
                                                             │
   MCP client ──POST /mcp (headers: keys, env, allowlist)──▶ │
     Hono app ─ per-request stateless Server+Transport ──────┘──▶ Eko UAT/prod
```

- **Tool generation** (`src/tools.ts`): filters the baked bundle to verification/non-financial, emits one tool per endpoint (`eps_<slug>`), JSON Schema from `requestParams`, billing hint in every description. Startup assertion fails the build if a spec ever requires a header the executor can't send.
- **Execution** (`src/server.ts`): low-level MCP `Server` (plain JSON Schema tools — the high-level API is Zod-only). `tools/call` → `new EpsClient(...).call(slug, args)` from `@ekoindia/eps-sdk`: HMAC `secret-key` signing, required/type validation, path/query/JSON-body encoding all come from the SDK, itself baked from the same bundle. A parity test (`parity.sdk-surface.test.ts`) guards the two baked artifacts against skew.
- **Remote transport** (`src/http.ts`): stateless streamable HTTP — a fresh `WebStandardStreamableHTTPServerTransport` (`sessionIdGenerator: undefined`, JSON responses) per POST. `initialize`, `tools/list`, `tools/call` each stand alone; no sessions, no GET/SSE stream (405, spec-legal; verified against Claude Code).
- **Local transport** (`src/stdio.ts`): same core, credentials from env vars, published as the package bin.

## Security posture

| Concern                     | Position                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential custody          | **Pass-through only.** Keys arrive as per-request headers, are used to sign, and vanish with the request. Nothing in KV/disk. Leak blast radius = one request in memory.                                                                                                                                      |
| PII (PAN/Aadhaar/bank data) | Bodies and headers are never logged — access log carries tool _name_ only, extracted from a guarded clone of the request. Error messages are curated (`sanitizeError`): upstream/network error text is replaced (it can echo request data); only EpsClient validation messages (param _names_) pass through.  |
| Tool scoping                | `X-Eko-Allowed-Apis` (required; `*` = all) filters `tools/list` and gates `tools/call`. **Voluntary scoping, not entitlement** — it lives in partner-controlled client config, out of the model's reach, but the Eko credentials remain the true authz boundary.                                              |
| Environment safety          | `uat` is the default; `production` must be sent explicitly. Unknown values are rejected (400), mapped internally to the SDK's `sandbox`/`production` ids.                                                                                                                                                     |
| Rate limiting               | Best-effort **abuse throttling**, not enforcement: in-memory fixed window (60 calls / 10 min) keyed `env + sha256(developerKey)`, IP fallback via proxy-set `x-real-ip`. Per-process; resets on restart. Move to shared Redis KV (eps-backend's `enforceRateLimit` pattern) if this ever runs multi-instance. |
| Process isolation           | Separate container from eps-backend **on purpose**: that process holds admin GitHub OAuth tokens (GitOps deploy rights). The compose file co-location is an ops convenience; the security boundary is the container.                                                                                          |
| Upstream hygiene            | `withTimeout` (10s) wraps fetch; hung Eko sockets can't accumulate.                                                                                                                                                                                                                                           |

## Single source of truth pipeline

`npm run build` (root) → vite emits `dist/agent/eps.json` → `bake:all` copies it into this package's `data/` (plus sdk-surface into sdk-js). Editing `src/lib/data/api-specs.ts` and rebuilding is ALL it takes to add/fix a tool — no code changes here. New verification specs appear automatically; financial specs are excluded automatically.

CI (`.github/workflows/ci.yml`): `transact:test` (builds sdk-js dist first), independent compose validation for each stack, a shared-poller image build, and a container build + `/healthz` smoke.

## Known risk: environment base URLs (verify before first partner use)

The bundle's environments are portless (`https://staging.eko.in/ekoapi/v3`, `https://api.eko.in/ekoicici/v3`). The eko-eps research repo **live-verified UAT with port** `:25004` (and documented Eko's own docs contradicting themselves). The gated UAT smoke (`src/uat-smoke.test.ts`) settles this:

```sh
EPS_UAT_DEVELOPER_KEY=… EPS_UAT_ACCESS_KEY=… EPS_UAT_INITIATOR_ID=… \
  npm test -w @ekoindia/eps-transact-mcp
```

If it fails with `UPSTREAM_ERROR`, fix `meta.environments` in the SSOT (the api-specs layer) — that corrects docs, Scalar try-it, SDKs, and this server in one edit. Do not patch URLs here.

## Deployment (standalone stack — co-locatable but independent)

eps-transact-mcp deploys as **its own compose project** and can run on a different host from eps-backend (e.g. backend on Vercel, transact on a cheap VM). It shares nothing with the backend stack; co-locating on one VM just means running two separate projects.

Artifacts live under `packages/eps-transact-mcp/deploy/`: `docker-compose.prod.yml` (the `eps-transact-mcp` service + its own auto-pull `poller` + `transact-poller-state` volume + `transact-egress` network) and `deploy.env.sample`.

### VM prerequisites (verify before deploying)

The stack needs Docker Engine **and** the Compose v2 plugin, with the daemon's data on a roomy disk using `overlay2`. Two failure modes bite here — check both up front:

```sh
# 1. Compose v2 plugin present? (the poller shells out to `docker compose` at
#    runtime to recreate the service, so v1 `docker-compose` is NOT enough)
docker compose version            # want: "Docker Compose version v2.x"
#   missing → install the plugin, e.g.:
#     yum install -y docker-compose-plugin      # RHEL/CentOS
#     apt-get install -y docker-compose-plugin  # Debian/Ubuntu

# 2. Storage driver + where the daemon keeps its data
docker info 2>/dev/null | grep -iE "storage driver|docker root dir"
#   want: "overlay2" on a partition with tens of GB free.
```

> **Trap — `vfs` on a small partition.** If `docker info` reports **Storage Driver: vfs**, every image layer is copied in full (no sharing), so pulls balloon and an auto-redeploying stack fills the disk fast. The tell is a pull that dies with `failed to register layer: no space left on device` **while `df` still shows free space** (the failed pull rolled back). Docker falls back to `vfs` when its data-root sits on a filesystem that can't support `overlay2` (e.g. XFS formatted `ftype=0`). Fix by pointing the data-root at a large `ext4`/`overlay2`-capable disk in `/etc/docker/daemon.json`:
>
> ```json
> { "data-root": "/var/lib/docker", "storage-driver": "overlay2" }
> ```
>
> **Switching drivers orphans existing images** — `overlay2` cannot read `vfs` layers. On a host already running *other* containers, `docker save` those images first (and back up any named volumes), or migrate during a maintenance window; `systemctl stop docker` halts **every** container on the box. `/etc/docker/daemon.json` may not exist yet (`mkdir -p /etc/docker` first); if it does, **merge** the keys, don't overwrite. Verify after restart with the same `docker info` grep.

1. **Image**: `.github/workflows/deploy-eps-transact-mcp.yml` publishes `ghcr.io/ekoindia/eps-transact-mcp:{sha,prod}` on green-CI pushes to `main` (stale-run guard; bakes bundles before `docker build` because `data/` is gitignored).
2. **Poller image**: `.github/workflows/deploy-poller.yml` publishes the **shared** `ghcr.io/ekoindia/eps-poller:{sha,prod}` (amd64) when `deploy/poller/{poll.sh,Dockerfile}` change, plus `workflow_dispatch` for base-image/security rebuilds. The package is **private in practice** (GHCR org default): both the host daemon (`docker login ghcr.io`, PAT with `read:packages`) and the poller's `.ghcr-auth.json` need credentials — verified on the first VM deploy, an anonymous pull returns `unauthorized`. (eps-backend still `build:`s the same Dockerfile from its on-VM checkout; only transact consumes the published image. Both derive from one `poll.sh`.)
3. **Compose**: copy `deploy.env.sample` → `deploy.env` (`EPS_TRANSACT_MCP_IMAGE=…`, optional `POLLER_ALERT_WEBHOOK`), drop a `.ghcr-auth.json` for the poller's `skopeo` app-image lookups, then bring the stack up with the invariant form:
   ```sh
   docker compose -p eps-transact-mcp --project-directory /deploy \
     --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml up -d
   ```
4. **Reverse proxy**: expose `https://mcp.eko.in/transact/mcp` (TLS) → `127.0.0.1:8788`. The domain is **path-namespaced per MCP server** — nginx `location /transact/` with a trailing-slash `proxy_pass http://127.0.0.1:8788/` strips the prefix, so the app still serves bare `/mcp` + `/healthz` unchanged (the transport emits no absolute URLs/redirects, so prefix-stripping is safe). `/context/` is **reserved** for the future remote eps-context-mcp (see `docs/superpowers/specs/2026-07-07-eps-context-mcp-remote-design.md`); bare `/` 404s. The proxy **must set/overwrite `x-real-ip`** (rate-limit fallback trusts it), must not expose :8788 directly, and must disable response *and* request buffering on `/transact/`. Full recipe below.

### Reverse proxy, TLS & auto-renewal

Examples use `mcp.example.com`; substitute your host. The container binds `127.0.0.1:8788` (loopback), so nginx is the only public ingress and plaintext `:8788` is never exposed.

**1. DNS** — point an A record at the VM's public IP, then confirm it resolves to *this* box:

```sh
dig +short mcp.example.com          # must equal:
curl -s ifconfig.me; echo           # the VM's own public IP
```

**2. Path-namespaced server block.** The trailing slash on `proxy_pass` strips the `/transact/` prefix (so the app sees `/mcp`, `/healthz`). `/context/` is reserved for a future second MCP server on the same domain; bare `/` 404s.

```nginx
# /etc/nginx/conf.d/eps-transact-mcp.conf
server {
    listen 80;
    server_name mcp.example.com;

    location /transact/ {
        proxy_pass http://127.0.0.1:8788/;   # trailing slash strips the prefix
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;              # MUST overwrite
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering         off;         # streamable HTTP — no buffering
        proxy_request_buffering off;
        proxy_read_timeout      120s;
    }

    location / { return 404; }               # reserve the namespace
}
```

**On a shared nginx that already serves other sites, do NOT reinstall nginx** (a package reinstall can upgrade the live binary). Add only the one config file, and be aware of two quiet footguns:

```sh
# a) An implicit default server: if NO existing block declares `default_server`
#    on :80, nginx routes unmatched traffic to the FIRST block loaded
#    (conf.d/*.conf loads alphabetically) — a new file could hijack it.
grep -rn "default_server" /etc/nginx/nginx.conf /etc/nginx/conf.d/
grep -rn "server_name"    /etc/nginx/nginx.conf /etc/nginx/conf.d/   # duplicate names only WARN, don't fail

# b) Apply changes with a GRACEFUL RELOAD, never restart — reload spins up new
#    workers and drains old ones with zero dropped connections for other sites:
nginx -t && systemctl reload nginx           # `systemctl restart` WOULD drop traffic
```

**3. TLS via Let's Encrypt.** The nginx plugin edits the block to add `:443` + an HTTP→HTTPS redirect. Open the firewall for both ports **permanently** (runtime-only rules evaporate on reboot and silently break renewal months later):

```sh
# RHEL/firewalld — persist 80 + 443:
firewall-cmd --permanent --add-service=http --add-service=https && firewall-cmd --reload
firewall-cmd --permanent --list-services            # confirm http + https listed
# (cloud VMs: also allow inbound 80 AND 443 in the security group, source = Any —
#  ACME validates from many rotating IPs and cannot be allow-listed to one address.)

certbot --nginx -d mcp.example.com
```

**4. Auto-renewal — verify a timer actually exists** (issuance does *not* create one on every distro; a cert with no renewal silently expires in ~90 days):

```sh
systemctl list-timers | grep -i certbot     # expect certbot-renew.timer scheduled
# nothing? enable the packaged timer:
systemctl enable --now certbot-renew.timer
# …or, if certbot was pip-installed (no unit), add cron instead:
#   ( crontab -l 2>/dev/null; echo '17 3,15 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"' ) | crontab -

certbot renew --dry-run                      # MUST end: "all simulated renewals succeeded"
```

> A `--dry-run` failure with **`Timeout during connect (likely firewall problem)`** is a network/port-80 reachability issue from the ACME servers' vantage point — **not** an nginx-config or redirect problem. An HTTP→HTTPS 301 on port 80 is fine; ACME follows it, and the plugin serves the challenge token on 80 regardless. Check firewall/security-group port 80 (source = Any) and that `dig` resolves to this VM. A one-off timeout is usually transient — re-run the dry-run.

### Verifying the deployment

Work outward from the container to the public URL — this localizes any failure to a single layer:

```sh
# 1. Containers healthy (app + poller both Up; app shows "(healthy)")
docker compose -p eps-transact-mcp --project-directory /deploy \
  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml ps

# 2. App direct on loopback — no nginx, no TLS. Expect: {"ok":true,"bundleVersion":"…","tools":N}
curl -s http://127.0.0.1:8788/healthz

# 3. Resource limits actually applied (non-zero Memory / NanoCpus)
docker inspect eps-transact-mcp-eps-transact-mcp-1 \
  --format 'mem={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}} init={{.HostConfig.Init}}'

# 4. Full public path, timed by layer (spot a slow DNS / TCP / TLS / app stage)
curl -s -o /dev/null \
  -w 'dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' \
  https://mcp.example.com/transact/healthz

# 5. Namespace reserved — bare /mcp must 404
curl -s -o /dev/null -w '%{http_code}\n' https://mcp.example.com/mcp     # expect 404

# 6. Real MCP handshake — list tools over the wire (POST-only; GET/DELETE = 405)
curl -s https://mcp.example.com/transact/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400
```

Survives a reboot only if Docker starts at boot — `systemctl is-enabled docker || systemctl enable docker`. Container `restart: unless-stopped` + docker-enabled = the stack returns automatically.

### Migration from the old co-located service

The transact service used to live inside `packages/eps-backend/docker-compose.prod.yml`. Removing it there does **not** stop the running container (the backend poller only touches `eps-backend`). On the existing VM, before standing up the new stack:

```sh
# stop/remove the orphaned old container
docker compose -p eps-backend --project-directory /deploy \
  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml up -d --remove-orphans
# (or: docker rm -f <old eps-transact-mcp container>)
```

Ensure port `8788` is free, then bring up the standalone `eps-transact-mcp` project (step 3). **Bootstrap order:** the `eps-poller:prod` image must be published once (merge the poller change, or `workflow_dispatch` `deploy-poller.yml`) before the transact stack can pull it.

### Keeping the remote server fresh

Fully hands-off now — no manual pull:

- **Image current per merge** — `deploy-eps-transact-mcp.yml` retags `:prod` on every green `main`. "Update the tools" = "merge the spec change".
- **Auto-pull** — the transact stack's own poller watches `eps-transact-mcp:prod` and recreates the service when the digest changes, exactly like eps-backend's. It runs the **same** `poll.sh`, configured via env for this stack: `SERVICE=eps-transact-mcp`, `DEPLOY_ENV_KEY=EPS_TRANSACT_MCP_IMAGE`, `REDIS_REQUIRED=0` (no Redis gate), `READYZ_URL=…/healthz`, `ALERT_SERVICE=eps-transact-mcp`. A distinct `transact-poller-state` volume keeps its lock/HOLD/last_good separate from the backend's.
- **Client always current** — remote users hit the URL and get whatever `:prod` the poller has deployed. Local stdio users get `@latest` + the startup update check (above).

## Test map

| File                         | Proves                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools.test.ts`              | exposure = exactly verification ∧ non-financial (registry-derived, not a hardcoded count); schema shape; naming; header assertion                                      |
| `parity.sdk-surface.test.ts` | eps.json ↔ sdk-surface same bundle version; per-slug method/path/required parity                                                                                       |
| `server.test.ts`             | signing (deterministic `signSecretKey` vs fixed clock), env→base-URL, allowlist gating, identity-param demotion+injection, error sanitization (no PII passthrough)     |
| `http.test.ts`               | 401/400 header validation, stateless initialize/list/call over independent POSTs, allowlist end-to-end, 429 throttle, access-log redaction (incl. malformed JSON body) |
| `uat-smoke.test.ts`          | env-gated live proof of base URL + auth + encoding                                                                                                                     |
| `update-check.test.ts`       | strict x.y.z compare (newer/equal/older/prerelease→unknown); silent on offline/404/bad-body; `EPS_NO_UPDATE_CHECK=1` skips the fetch                                   |

## Distribution

Two ways users get the server:

1. **Hosted HTTP** — `https://mcp.eko.in/transact/mcp` (streamable HTTP,
   credentials as headers; GHCR image deployed on push to `main`).
2. **npm stdio** — `npx -y @ekoindia/eps-transact-mcp@latest` (credentials from
   shell env; auto-published by `release.yml`). Wire it into any MCP client with
   `claude mcp add` / `codex mcp add` / the client's MCP config.

This runtime server is **not** distributed as a coding-agent plugin: it needs
per-user credentials and targets a partner's production agent, not a developer's
dev-time coding agent. It is intentionally absent from the repo-root
`.claude-plugin/marketplace.json` (which carries only the dev-time `eps` context
plugin).

## Staying up to date

The stdio bin (`src/update-check.ts`, wired only into `src/stdio.ts`) does a best-effort startup check against the npm `latest` dist-tag and prints a one-line stderr nudge when the running version is behind — silent on any failure, `EPS_NO_UPDATE_CHECK=1` opts out. The HTTP server deliberately skips it (remote users can't self-update; stderr there is operator log noise). Published via the content-gated `release.yml` auto-release; the documented install command pins `@latest` so `npx` re-resolves newest each launch. See the [package README](../packages/eps-transact-mcp/README.md#staying-up-to-date).

**Publishing — bootstrap done (2026-07-02).** `0.1.0` was published manually (`npm publish` from the package dir — OIDC can't create a brand-new scoped package), and the npm **Trusted Publisher** (repo + `release.yml`) is configured. From `0.1.1` on, `release.yml` auto-publishes content-changed versions tokenless via OIDC, same as the other `@ekoindia/*` packages.

## Phase 2 candidates (deliberately not built)

- OAuth 2.1 resource-server auth — needed only for claude.ai-web zero-install connectors; header auth covers Claude Code/API/Cursor today.
- Server-side partner entitlement/allowlist storage — requires the blocked Eko credential-issuance contract (roadmap Phase 5) to be meaningful.
- Financial (money-movement) tools — only behind explicit human-confirm gates, per roadmap.
- Shared-KV rate limiting.
- Multi-arch (`linux/arm64`) poller/app images — build only if a transact host is ever ARM; amd64-only today.
