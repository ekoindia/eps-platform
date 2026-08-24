# eps-backend — Production VM Deploy Runbook

Pull-based auto-deploy for `ghcr.io/ekoindia/eps-backend` on a single private
VM. A poller container watches the `:prod` tag in GHCR and reconciles the
running image every 30 seconds, with a health gate and automatic rollback.

> To onboard a **new** ekoindia project onto the same poller, see the
> [poller README](../deploy/poller/README.md) — it reuses this same sidecar for
> any project.

> Already bootstrapped and just need to operate the stack? The
> [Docker ops cheatsheet](./eps-backend-docker-ops.md) has the day-2 one-liners:
> status, logs, restarts, `.env` changes, Redis, capacity, triage.

---

## Contents

1. [Pre-production setup checklist](#pre-production-setup-checklist)
2. [Bootstrap](#bootstrap)
3. [How a deploy happens](#how-a-deploy-happens)
4. [Manual rollback](#manual-rollback)
5. [Clearing HOLD](#clearing-hold)
6. [Alerts](#alerts)
7. [Ongoing ops](#ongoing-ops)

---

## Pre-production setup checklist

One-time human actions, NOT automated. Do these (in order) before the pipeline
is trusted. The pull-based design has no gate other than the `main` merge, so
these are load-bearing — skipping them either bypasses the deploy gate or leaves
the pipeline silently inert.

### 1. Branch protection on `main` (the merge gate IS the deploy gate)

Merging to `main` → green CI → image publish → poller deploys to the prod VM
(with real secrets). The PR-into-`main` merge is the production deploy button.

GitHub → **Settings → Rules → Rulesets** (or Settings → Branches), target `main`:

- [ ] **Require a pull request before merging** (≥1 approval; dismiss stale
      approvals on new commits).
- [ ] **Require status checks to pass** — select the **CI** check (job
      "CI OK"); tick "require branches up to date before merging". `CI OK` is the
      aggregator job that gates on every other CI job, so it is the only name to
      select — do not add the individual jobs, they are path-filtered and skip
      legitimately.
- [ ] **Block force pushes** and **block deletions**.
- [ ] **Enforce for administrators** (no bypass — otherwise the deploy gate has
      a hole).

### 2. GHCR package private + access (push for CI, read for the VM)

The image is private (locked decision). CI must push; the VM must pull read-only.

- [ ] **Create the package** — it is created on first publish (see step 3). New
      org packages default to private.
- [ ] **Verify** at org/user → **Packages → eps-backend → Package settings**:
      visibility = **Private**; **Manage Actions access** grants the `eps-platform`
      repo **Write** (this backs `permissions: packages: write` in the workflow).
- [ ] **Create the VM's read-only credential** — GitHub → Settings → Developer
      settings → Personal access tokens: fine-grained **Packages: Read** for this
      package, or classic PAT scope **`read:packages`**; ensure that token's owner
      has **Read** under the package's **Manage access**.
- [ ] On the VM, use that token for `docker login ghcr.io` in
      [Bootstrap Step 4](#step-4--log-in-to-ghcr-and-create-the-authfile). It must
      store a **plain** token (no credential helper) — else `.ghcr-auth.json` has no
      usable secret and the poller's skopeo gets 401. Step 4 documents the explicit
      authfile workaround if your host uses a credStore.

### 3. Arm the pipeline (merge to `main`) + run the first deploy manually

`workflow_run` only fires using the copy of `deploy-eps-backend.yml` on the
**default branch (`main`)**. It currently lives on `dev`, so the pipeline does
nothing until merged to `main`. And a fresh VM has nothing to reconcile, so the
first deploy is hands-on; the poller takes over afterward.

- [ ] **Merge `dev` → `main`** (PR) — puts `deploy-eps-backend.yml` + code on
      `main`. The green CI run on that merge publishes the **first image**
      (`:<sha>` + moves `:prod`). If it doesn't fire on the arming merge itself,
      push one harmless **backend-affecting** follow-up commit to `main` — the
      deploy workflow path-guards on `packages/eps-backend/**` (plus root
      `package*.json`, `.githooks/setup.mjs`, and the workflow itself), so a
      commit outside those paths publishes nothing.
- [ ] **Confirm the first image exists** at `:prod` in GHCR before bootstrapping
      — Bootstrap Step 6 seeds `deploy.env` from it (chicken-and-egg: seed needs an
      image, image needs the workflow on `main`; so **merge first, then bootstrap**).
- [ ] **Run the [Bootstrap](#bootstrap) steps on the VM** (Docker + NTP,
      `/data/eps-backend` files, `.env` secrets, GHCR login + authfile, seed `deploy.env`,
      auth smoke-test, `up -d`, then [DNS/nginx/TLS](#step-9--publish-it-dns-nginx-tls)
      and [pointing the frontend at it](#step-10--point-the-frontend-at-it)).
- [ ] **Thereafter:** every green `main` push auto-deploys within ~30 s — no
      manual steps unless a deploy HOLDs (see [Clearing HOLD](#clearing-hold)).

---

## Bootstrap

Complete these steps once, in order, before the poller starts managing the
stack.

> **Shared-VM note (production reality):** eps-backend deploys onto the same VM
> as eps-transact-mcp. On a shared VM, use a per-project directory `/data/eps-backend/`
> — substitute `--project-directory /data/eps-backend` in every compose command below —
> with its own `deploy.env`, `.env`, and `.ghcr-auth.json` (never shared across
> stacks; see the [poller README](../deploy/poller/README.md) shared-VM
> checklist). Steps 1–2 (Docker, NTP) are already done on that VM. Before
> copying anything, check capacity: `df -h /data && df -i /data &&
docker system df && free -m` — the VM's Docker data-root uses the `vfs`
> storage driver, which shares no layers between images, so image storage (not
> container count) drives disk use. Copy the deploy files from the merged
> `main` SHA, not a local working tree, so compose/poller config matches the
> published image.

### Step 1 — Install Docker Engine and the Compose plugin

Follow the official Docker Engine installation guide for your distro (Ubuntu
example: `apt-get install docker-ce docker-ce-cli containerd.io
docker-buildx-plugin docker-compose-plugin`). Verify:

    docker version
    docker compose version

Both commands must succeed. Ensure the Docker daemon starts on boot
(`systemctl enable --now docker`).

### Step 2 — Synchronise the clock (NTP)

Digest comparisons and JWT validation are time-sensitive. Enable and start an
NTP client before anything else:

    timedatectl set-ntp true
    timedatectl status          # confirm "System clock synchronized: yes"

### Step 3 — Copy the deploy directory to the VM

Place these files from `packages/eps-backend/` at `/data/eps-backend` on the VM so the
invariant compose command can find them:

    /data/eps-backend/docker-compose.prod.yml
    /data/eps-backend/.env.example
    /data/eps-backend/health.sh            # from deploy/health.sh; chmod +x

`health.sh` is the read-only day-2 health sweep (service states, running digest
vs `deploy.env`, poller `HOLD`, probes, store, logs, disk) plus `logs` /
`poller` log shortcuts. Run it with no arguments for the full usage guide;
`health.sh full` runs the sweep. Like the compose file it is copied here by
hand, not baked into the image — re-copy it when it changes upstream. Details:
[Docker ops §3](./eps-backend-docker-ops.md#3-status--health).

The poller is NOT built on the VM — the compose file pulls the shared
`ghcr.io/ekoindia/eps-poller:prod` image (same image as the eps-transact-mcp
and eko-business-dashboard stacks; source in `deploy/poller/`, published by
`deploy-poller.yml`). Each stack still runs its own poller container —
fault/HOLD isolation — only the image is shared.

Ownership and permissions: the files need to be readable by the user running
Docker. On most setups `root` or a `docker` group member is fine.

### Step 4 — Log in to GHCR and create the authfile

The `ghcr.io/ekoindia/eps-backend` image is private. The user running Docker
must authenticate before the poller can pull:

```sh
docker login ghcr.io
```

Use a GitHub Personal Access Token (PAT) with `read:packages` scope as the
password, or a machine account token.

After logging in, create a deterministic authfile at `/data/eps-backend/.ghcr-auth.json`.
The poller mounts this path rather than `~/.docker/config.json`, which is empty
under `sudo` without `-H` or in systemd units where `$HOME` is unset:

```sh
cp ~/.docker/config.json /data/eps-backend/.ghcr-auth.json && chmod 600 /data/eps-backend/.ghcr-auth.json
```

**credStore caveat:** if `docker login` used a credential helper, `config.json`
contains a `credStore` key but no inline `auth` token — the copy above will not
contain any credentials and skopeo will get a 401. In that case, create the
authfile explicitly with an inline base64 token:

```sh
printf '{"auths":{"ghcr.io":{"auth":"%s"}}}\n' "$(printf '%s:%s' "$GHCR_USER" "$GHCR_PAT" | base64 -w0)" > /data/eps-backend/.ghcr-auth.json && chmod 600 /data/eps-backend/.ghcr-auth.json
```

The poller mounts `/data/eps-backend/.ghcr-auth.json` read-only at
`/root/.docker/config.json` inside the container and sets `REGISTRY_AUTH_FILE`
to that path. The `docker compose pull` path goes through the Docker socket and
already uses the host daemon's auth context.

### Step 5 — Create `/data/eps-backend/.env` with production secrets

Copy `.env.example` to `/data/eps-backend/.env` and fill in all required values:

```sh
cp /data/eps-backend/.env.example /data/eps-backend/.env
$EDITOR /data/eps-backend/.env
```

At minimum you need `JWT_SECRET`, the `SIMPLIBANK_*` and `EKO_*` variables
(including `SIMPLIBANK_HISTORY_API_HOST` / `_PORT` / `_PATH` — transaction
history runs on a different box, and each unset part silently falls back to the
main upstream),
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`,
`GITHUB_REPO`, `REDIS_URL`, and `KV_ENCRYPTION_KEY`. See `.env.example` for
the full list and inline notes. Restrict file permissions:

```sh
chmod 600 /data/eps-backend/.env
```

To also serve the public context-MCP endpoint from this process, add:

```sh
CONTEXT_BUNDLE_URL=https://eps.eko.in/agent/eps.json
# CONTEXT_BUNDLE_TTL_SEC=900   # optional; default 900
```

Setting it mounts `/context/*` (see Step 9b); unsetting it and recreating the
container removes those routes without touching auth — that is the kill switch
for the one public, anonymous surface on this box.

### Step 6 — Seed `/data/eps-backend/deploy.env` with the current `:prod` digest

The poller will overwrite this file on every reconciliation, but it must exist
for the first `up -d`. Seed it with the **tag**, not a digest — the poller pins
the immutable digest on its first real deploy (poller README pattern; also
sidesteps multi-arch digest parsing and old-buildx `--format` incompatibility,
which bit the first production bootstrap):

```sh
printf 'EPS_BACKEND_IMAGE=ghcr.io/ekoindia/eps-backend:prod\n' > /data/eps-backend/deploy.env
```

> **Bootstrap is never health-gated:** the seed pins the current `:prod`, so
> the poller sees remote == running and idles until the next `main` merge
> publishes a new digest. Automatic rollback needs no prior state — on a failed
> health gate the poller redeploys whatever digest was running before the
> attempt (`prev` in `poll.sh`), so it works from the first poller-driven
> deploy onward. `/state/last_good` (written on each successful gate) feeds
> only the _manual_ rollback procedure below.

### Step 7 — Smoke-test in-container auth

Before starting the full stack, confirm that the authfile works for skopeo
inside the poller container. This catches credStore/empty-token problems before
they cause silent failures in the live pipeline:

```sh
docker compose -p eps-backend --project-directory /data/eps-backend --env-file /data/eps-backend/deploy.env -f /data/eps-backend/docker-compose.prod.yml run --rm --entrypoint skopeo poller inspect docker://ghcr.io/ekoindia/eps-backend:prod
```

`--entrypoint` is required: the shared `eps-poller` image's entrypoint is
`poll.sh`, so without it the trailing args are swallowed and the full poller
loop starts in the foreground instead (Ctrl-C and re-run with `--entrypoint`
if that happens — a foreground poller with no redis just logs
"redis down — deploy paused" each tick and deploys nothing; if it manages to
resolve the remote digest in those logs, auth is in fact proven).

This must print a manifest (containing a `Digest:` field). A `401` /
"authentication required" error means the authfile has no valid token — fix it
(see the credStore caveat in Step 4) before proceeding.

### Step 8 — Bring up the stack

```sh
docker compose -p eps-backend --project-directory /data/eps-backend --env-file /data/eps-backend/deploy.env -f /data/eps-backend/docker-compose.prod.yml up -d
```

Wait a few seconds, then confirm all three containers are running:

```sh
docker compose -p eps-backend --project-directory /data/eps-backend --env-file /data/eps-backend/deploy.env -f /data/eps-backend/docker-compose.prod.yml ps
```

Expected: `redis`, `eps-backend`, and `poller` with status `Up` (eps-backend
will show `(healthy)` once the healthcheck passes). The backend is reachable at
`127.0.0.1:8787` — point your reverse proxy there.

### Step 9 — Publish it: DNS, nginx, TLS

The container binds `127.0.0.1:8787` only and is never exposed directly. Host
nginx terminates TLS and proxies to it. The examples use `api.eps.eko.in`;
substitute your own hostname.

**Pick the hostname before anything else** — it is load-bearing for cookies. The
backend issues `SameSite=Lax` session cookies, which a browser only sends on
requests to the same registrable domain as the page. A backend on a _different_
domain (say `eps-backend.example.net` while the site is `eps.eko.in`) makes those
cookies third-party and auth silently breaks. Use a subdomain of the site's own
domain.

1. **DNS** — an `A` record for `api.eps.eko.in` pointing at the VM's public
   address. On a shared box this is the same address the other sites already use;
   confirm with `dig +short <existing-host>`.

2. **nginx** — a new file, never an edit of an existing site's block. On RHEL:

```nginx
# /etc/nginx/conf.d/eps-backend.conf
server {
      listen 80;
      server_name api.eps.eko.in;

      location / {
            proxy_pass http://127.0.0.1:8787;
            proxy_http_version 1.1;

            proxy_set_header Host              $host;
            # MUST overwrite, not append: the backend's rate limiter trusts
            # X-Real-IP for its per-client bucket, so a client-supplied value
            # would let one caller spoof another's quota.
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_read_timeout 120s;
      }
}
```

No path prefix and no trailing slash on `proxy_pass` — the backend's routes
(`/healthz`, `/me`, `/auth/admin/github/callback`) sit at the root, and the
GitHub OAuth callback URL must match byte for byte.

```sh
nginx -t && systemctl reload nginx   # reload, never restart: other sites share this nginx
```

3. **TLS** — `certbot --nginx -d api.eps.eko.in`. Then verify the renewal timer actually exists (it did not, the first time, on this VM):

```sh
systemctl list-timers | grep certbot || systemctl enable --now certbot-renew.timer
firewall-cmd --permanent --list-ports    # must include 80/tcp and 443/tcp
```

4. **Verify** — `curl -f https://api.eps.eko.in/healthz`.

5. **Upstream allowlist** — production SimpliBank restricts client IPs, so send Eko the VM's **outbound** address, which is not necessarily the one DNS points at:

```sh
curl -s ifconfig.me     # run ON the VM
```

Confirm in the cloud console that this address is static (a reserved public IP
or a NAT gateway) before requesting the allowlist entry — a dynamic one will
silently start returning 403s after a reallocation.

### Step 9b — Publish the context MCP server on `mcp.eko.in/context/`

Only when `CONTEXT_BUNDLE_URL` is set (Step 5). The `mcp.eko.in` vhost already
exists for eps-transact-mcp and is path-namespaced; `/context/` was reserved for
this. Edit that file — do **not** create a second vhost for the same name.

The rate limit is not optional: this is an anonymous, unmetered endpoint, and
nginx is the only thing metering it. The zone must sit at `http{}` level, i.e.
the top of the file, above `server {`:

```nginx
# /etc/nginx/conf.d/eps-transact-mcp.conf   (the mcp.eko.in vhost)

# Anonymous unmetered endpoint: the proxy is the only abuse control.
# 10 MB tracks ~160k client IPs; mcp.eko.in resolves straight to this VM, so
# $binary_remote_addr is the real client (re-check if a CDN is ever put in front).
limit_req_zone $binary_remote_addr zone=mcpctx:10m rate=10r/s;

server {
    server_name mcp.eko.in;
    # ... existing location /transact/ ...

    # Prefix PRESERVED — no URI on proxy_pass, no trailing slash: the backend
    # serves /context/mcp itself. Its own vhost (api.eps.eko.in) stays
    # prefix-free because the GitHub OAuth callback must match byte for byte.
    location /context/ {
        limit_req zone=mcpctx burst=20 nodelay;
        limit_req_status 429;
        client_max_body_size 1m;          # JSON-RPC bodies are tiny

        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        # MUST overwrite — the backend's rate limiter trusts X-Real-IP
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # streamable HTTP: no buffering either direction
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 120s;
    }

    location / { return 404; }
}
```

```sh
nginx -t && systemctl reload nginx

curl -s https://mcp.eko.in/context/healthz     # {"ok":true,"bundleVersion":"…","source":"remote"}
curl -s https://mcp.eko.in/transact/healthz    # regression: still 200
curl -s -o /dev/null -w '%{http_code}\n' https://mcp.eko.in/   # 404, namespace stays clean
```

`/context/healthz` answers `503` until the first bundle fetch succeeds, which is
the correct signal — but do **not** point the container healthcheck or the
poller's gate at it: `/readyz` deliberately ignores the bundle so a site outage
cannot fail an auth deploy.

### Step 10 — Point the frontend at it

The website reads its backend base from `VITE_EPS_BACKEND_URL`, defaulting to the
same-origin path `/api` (`src/lib/auth/client.ts`). That default only works where
something actually _serves_ `/api`: in development the Vite dev server proxies it
(`vite.config.ts`), and in production the host must. With neither, `/api/me` falls
through to the SPA fallback and returns `index.html` with a **200**, which is how
`/console` once rendered a "signed-in" user built from the site's own HTML.

**Prefer a same-origin rewrite over an absolute URL.** Routing `/api` through the
site's own origin keeps session cookies first-party, so there is no credentialed
CORS to configure, no preflight, and no `SameSite=None`. Pointing
`VITE_EPS_BACKEND_URL` at `https://api.eps.eko.in` instead makes every console
request cross-site and drags all of that in.

On Vercel, add a `routes` entry — **not** a `rewrites` one, because only `routes`
can expand an environment variable, which keeps the backend hostname out of the
repository:

```json
{
	"routes": [
		{
			"src": "/api/(.*)",
			"dest": "${EPS_BACKEND_ORIGIN}/$1",
			"env": ["EPS_BACKEND_ORIGIN"]
		}
	]
}
```

- `EPS_BACKEND_ORIGIN` is a **Vercel project environment variable** (Production,
  and Preview if previews should reach a backend) set to `https://api.eps.eko.in`.
  No `VITE_` prefix: it is expanded at the edge per request, never compiled into
  the client bundle. Only names listed in `env` are expandable; an unset variable
  is left as the literal string `${EPS_BACKEND_ORIGIN}`, which fails loudly.
- `/$1` strips the `/api` prefix, mirroring the dev proxy's
  `rewrite: (p) => p.replace(/^\/api/, "")`.
- **Leave `VITE_EPS_BACKEND_URL` unset.** Setting it would send the browser
  straight to the backend origin and bypass this proxy entirely.
- **Ordering matters.** `vercel.json` already ends its `rewrites` with a catch-all
  SPA fallback (`/((?!assets/).*)`); the `/api` rule must win over it. `routes` are
  the lower-level primitive and are evaluated in array order, so put this first —
  then **verify on a preview deployment** (`curl https://<preview>/api/healthz`
  should return the backend's JSON, not HTML) before relying on it in production.

If the host cannot do a rewrite at all, set `VITE_EPS_BACKEND_URL` to the absolute
origin and configure the backend for it: `CORS_ORIGINS` listing the exact site
origin(s), `Access-Control-Allow-Credentials: true`, `OPTIONS` preflight handling,
and cookies that survive the cross-site hop.

---

## How a deploy happens

1. A pull request is merged into `main` (branch protection enforces CI passing
   before merge; the merge gate is therefore the deploy gate).
2. The **Deploy eps-backend** workflow (`deploy-eps-backend.yml`) triggers on
   `workflow_run` when the CI workflow completes successfully for a push to
   `main`. A stale-run guard skips the publish if the built SHA is no longer
   the tip of `origin/main` (a faster merge landed while this run was queued).
3. The workflow builds the image, pushes it tagged as `:sha`, then atomically
   repoints `:prod` at that exact digest with `docker buildx imagetools create`.
   No rebuild occurs during the retag step — the digest is canonical.
4. Within at most 30 seconds the poller calls `skopeo inspect` and detects that
   the remote `:prod` digest differs from what the running container was pulled
   from. It writes the new image reference to `/data/eps-backend/deploy.env`, pulls the
   image, and calls `docker compose up -d --no-deps eps-backend`.
5. The health gate polls `http://eps-backend:8787/readyz` up to 10 times with a
   3-second delay between attempts. Redis availability is checked in parallel.
6. If the gate passes, the poller records the digest in `/state/last_good` and
   sends an `INFO` alert.
7. If the gate fails, the poller checks whether the failure is a dependency
   fault (Redis down or the container itself crashing) or a pure image fault,
   then either holds (dependency/first-deploy) or rolls back to the previous
   known-good digest (image fault).

---

## Manual rollback

Use this procedure to pin the stack to any previously published digest,
bypassing the poller's automatic selection. Follow the steps in order — HOLD
must come FIRST. Manual rollback is used when a bad image passed `/readyz` but
is functionally broken: `:prod` still points at the bad digest, so within one
poll interval the poller would re-detect the remote tag and redeploy the bad
image, clobbering the rollback.

**1. Set HOLD to pause the poller.**

```sh
docker run --rm -v eps-backend_eps-poller-state:/state busybox sh -c 'echo "manual rollback" > /state/HOLD'
```

**2. Find the target digest.**

The last automatically verified digest is in the poller state volume:

```sh
docker run --rm -v eps-backend_eps-poller-state:/state busybox cat /state/last_good
```

For an older digest, check the GHCR package history or your deploy logs for a
`sha256:` string.

**3. Write the known-good digest to `/data/eps-backend/deploy.env`.**

```sh
printf 'EPS_BACKEND_IMAGE=ghcr.io/ekoindia/eps-backend@%s\n' "sha256:<64-hex-digest>" > /data/eps-backend/deploy.env
```

Replace `sha256:<64-hex-digest>` with the full digest including the `sha256:`
prefix — e.g. `sha256:abc123…` (64 hex characters after the colon). The
`@sha256:` separator is mandatory; the complete image reference must be of the
form `ghcr.io/ekoindia/eps-backend@sha256:<64 hex>`.

**4. Recreate the backend with the invariant compose command.**

```sh
docker compose -p eps-backend --project-directory /data/eps-backend --env-file /data/eps-backend/deploy.env -f /data/eps-backend/docker-compose.prod.yml up -d --no-deps eps-backend
```

Only `eps-backend` is recreated; `redis` and `poller` are left running.

**5. Verify.**

    curl -f http://127.0.0.1:8787/healthz && echo OK
    curl -f http://127.0.0.1:8787/readyz  && echo READY

`/healthz` is a liveness check. `/readyz` additionally checks Redis and is
what the poller gates on before recording a deploy as successful.

**6. Leave HOLD in place until a corrected image is published to `:prod`.**

Do **not** clear HOLD while `:prod` still points at the bad digest — doing so
will let the poller re-detect the unchanged remote tag and redeploy the bad
image. Only remove HOLD after a fix has been merged to `main` and CI has moved
`:prod` to a good digest. See [Clearing HOLD](#clearing-hold) for the removal
command and its safety note.

---

## Clearing HOLD

HOLD is a sentinel file at `/state/HOLD` inside the `eps-poller-state` named
volume. When HOLD is set, the poller logs `HOLD set (...)` on every tick and
takes no action.

**HOLD is set automatically in three situations:**

- **Dependency fault during deploy:** Redis was down or the container was
  crash-looping when the health gate ran. The failing image is left running.
  Fix the dependency, verify Redis is reachable, then clear HOLD.
- **First-deploy image fault:** The very first deploy of an image failed the
  health gate and there is no previous known-good digest to roll back to.
  Inspect the container logs, fix the image or configuration, then clear HOLD.
- **Failed rollback:** The rollback image also failed the health gate. Both the
  new and old images are suspect. Investigate both before clearing HOLD.
- **Manual rollback:** HOLD was set manually during a [manual rollback](#manual-rollback).
  Do **not** clear HOLD while `:prod` still points at the bad image — doing so will
  let the poller redeploy it. Only clear HOLD after a fix has been merged to `main`
  and CI has moved `:prod` to a good digest.

**One HOLD form clears itself.** `docker compose up -d` can recreate the container
on the target image and *still* exit non-zero. The poller used to take that at
face value and write `deploy error <digest>` for a deploy that had in fact landed
— pinning production to that image until a human noticed. It now verifies the
live digest before declaring a deploy failed, and on startup clears a HOLD of
exactly the form `deploy error <digest>` when that digest is the one running.

The three fault forms above are **never** auto-cleared: each of them means the
live image never passed the health gate, so clearing them would skip the gate
permanently. Neither is a manual freeze — as long as its text is not
`deploy error <digest>`, which `touch /state/HOLD` and any free-text reason
satisfy.

A HOLD that stays set now re-alerts every `HOLD_REALERT_SEC` (default 3600)
rather than logging one line per tick, so a latched HOLD cannot go unnoticed the
way it did between 2026-07-31 and 2026-08-05. Set `POLLER_ALERT_WEBHOOK` in
`/data/eps-backend/.env` for those alerts to leave the container — without it the
poller warns at boot that alerts are log-only.

**To clear HOLD and resume automatic deploys:**

```sh
docker run --rm -v eps-backend_eps-poller-state:/state busybox rm -f /state/HOLD
```

Confirm the poller resumes by tailing its logs:

```sh
docker logs -f $(docker compose -p eps-backend --project-directory /data/eps-backend --env-file /data/eps-backend/deploy.env -f /data/eps-backend/docker-compose.prod.yml ps -q poller)
```

You should see normal `[poller] deploying ...` or idle tick output without the
`HOLD set` message.

---

## Alerts

The poller always writes structured log lines to stderr. To also receive
webhook notifications on deploy, rollback, and fault events, add this line to
`/data/eps-backend/.env`:

    POLLER_ALERT_WEBHOOK=https://your.webhook.endpoint/path

The poller reads `/data/eps-backend/.env` via its `env_file` configuration in
`docker-compose.prod.yml`. Restart the poller after editing:

```sh
docker compose -p eps-backend --project-directory /data/eps-backend --env-file /data/eps-backend/deploy.env -f /data/eps-backend/docker-compose.prod.yml up -d --no-deps poller
```

**Payload format** — the poller POSTs JSON on every alert:

    {"level":"INFO"|"WARN"|"CRIT","service":"eps-backend","message":"<text>"}

Levels: `INFO` for successful deploys; `WARN` for rollbacks and transient
issues; `CRIT` for faults that set HOLD.

**Without a webhook**, monitor the poller with:

```sh
docker logs -f <poller-container-id>
```

---

## Ongoing ops

Policy and background below; the day-to-day commands (status, logs, restarts,
`.env` changes, Redis inspection, capacity, triage) are in the
[Docker ops cheatsheet](./eps-backend-docker-ops.md).

### KV store tiers (Valkey / no-KV degraded mode / managed)

The stack's `redis` service runs **Valkey** (`valkey/valkey:8-alpine`), the
FOSS BSD-licensed Redis fork — same RESP protocol, same `redis-cli` ping from
the poller, same data files. The service keeps the name `redis` so
`REDIS_URL`, the poller, and the compose network assertions never change.
Migration note: Valkey 8 reads a Redis 7 AOF/RDB volume in place, but the
upgrade is one-way — snapshot the `eps-redis-data` volume first if a rollback
to `redis:7` must stay possible. Worst case of losing the volume is a mass
re-login (it holds only tokens, counters, and cache).

Redundancy tiers, in order of preference:

1. **Valkey container** (default, this stack) — durable across restarts and
   deploys.
2. **In-memory degraded mode** — remove `REDIS_URL` (and the `redis` service)
   and set `REDIS_REQUIRED=0` in the poller env so its Redis health gate is
   skipped. Constraint: **exactly one backend process** (no PM2/cluster
   replicas — process-local state, not merely per-VM). Every backend restart
   logs all users out and resets rate-limit counters; a stale access JWT then
   sees 401 `CONNECT_SESSION_EXPIRED` on connect/dashboard routes until the
   frontend's refresh-retry path lands the user back at login.
3. **Upstash free tier** (managed, `rediss://` URL) — when running a KV
   container on the VM is undesirable; same setup as the Vercel deploy doc.
   Current traffic (~200 DAU) is far below the free 500k commands/month.

The choice is deployment-time only; the backend never fails over between
stores at runtime.

### Kernel TCP settings (`tcp_tw_recycle` — fixed 2026-08-23)

`net.ipv4.tcp_tw_recycle=1` was set on this host and was **silently dropping
~30% of incoming connections** to every vhost it serves — `api.eps.eko.in`,
`mcp.eko.in` (`/transact/` and `/context/`), and the co-hosted sites.

The mechanism: with that flag, the kernel caches the last TCP timestamp seen
*per source IP* and rejects any SYN carrying a lower one. That assumes one clock
per IP, which is false for anything behind carrier NAT and for clients that
randomise timestamps per connection (macOS, Linux >= 4.10). Affected SYNs are
discarded with no RST and nothing in any log — the client just retransmits for
~20s and gives up. Linux removed the option in 4.12 for exactly this reason.

Symptoms, if it ever comes back (a reboot onto an unfixed sysctl would do it):

- From outside, ~30% of requests hang the full client timeout; the rest connect
  in ~50ms. Bimodal, at any request rate, including one request every 3 seconds.
- `curl -w` shows `dns=0.004 tcp=0.000000` on the failures — the connection is
  never established, so nginx and the app never see it.
- `tcpdump -ni any 'host <client-ip> and tcp port 443 and tcp[tcpflags] & tcp-syn != 0'`
  shows the SYN arriving and being retransmitted 6 times with **no SYN-ACK**.
- `netstat -s`: *"passive connections rejected because of time stamp"* climbs,
  and *"SYNs to LISTEN sockets dropped"* climbs while
  *"times the listen queue of a socket overflowed"* stays flat. That pairing is
  the signature — it rules out backlog exhaustion, which is the tempting
  misdiagnosis (`somaxconn` is 128 here, and its overflow counter is large but
  accumulated over a multi-year uptime, so read *deltas*, never totals).

Fix (immediate, no restart, no downtime):

```sh
sysctl -w net.ipv4.tcp_tw_recycle=0
echo 'net.ipv4.tcp_tw_recycle = 0' > /etc/sysctl.d/99-tcp-tw.conf
```

Leave `tcp_timestamps=1` (PAWS, window scaling) and `tcp_tw_reuse=1`
(client-side, safe). Verified after the change: 146 requests over 180s with 0
failures, versus 43 requests and 13 failures in the same window before.

Related, still outstanding: `net.core.somaxconn` and `net.ipv4.tcp_max_syn_backlog`
are both 128 (kernel defaults) on a host fronting several public sites — worth
raising to 1024/4096 plus `listen ... backlog=1024` in nginx during the overlay2
maintenance window (the backlog change needs an nginx *restart*, not a reload).
Uptime is over 2000 days, so the kernel is unpatched; that reboot is overdue.

### Log rotation

Log rotation is built into the stack. All three services (`redis`, `eps-backend`,
`poller`) use the `json-file` driver with `max-size: 10m` and `max-file: 5`.
No additional log rotation configuration is needed.

### Image pruning

Old image layers accumulate on the VM after each deploy. Schedule a periodic
prune — for example, a daily cron job:

    # /etc/cron.daily/docker-image-prune
    #!/bin/sh
    docker image prune -f

Or with crontab:

    0 3 * * * docker image prune -f >> /var/log/docker-prune.log 2>&1

### `KV_ENCRYPTION_KEY` stability

`KV_ENCRYPTION_KEY` is a **stable secret**. It encrypts GitHub OAuth tokens and
refresh-token claims at rest in Redis using AES-256-GCM. Rotating this key
requires flushing all encrypted values from Redis and forcing all users to
re-authenticate — it is not a routine redeploy operation. Never rotate it
casually. If rotation is required, run the Redis key flush described in the
README's "Rollback" section (`rt:*` and `ghtoken:*` patterns) before deploying
the new key.

### Pre-merge ops (one-time human actions)

See the [Pre-production setup checklist](#pre-production-setup-checklist) at the
top of this runbook — branch protection on `main`, GHCR private-package access,
and arming the pipeline (merge to `main`) + first manual deploy.
