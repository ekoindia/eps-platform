# Auto-deploy poller — reuse for any ekoindia project

`poll.sh` is a generic auto-deploy sidecar. It is **not** eps-backend-specific:
every target value is an env var with a default ([`poll.sh`](./poll.sh) lines
4–25), and the image is published to GHCR as `ghcr.io/ekoindia/eps-poller:{sha,prod}`
by [`.github/workflows/deploy-poller.yml`](../../../../.github/workflows/deploy-poller.yml).
`eps-transact-mcp` already reuses it unmodified. This doc is how to point it at a
**new** `github.com/ekoindia` project on the same (or any) VM.

## What it does

Each tick it reads the registry digest of `IMAGE:WATCH_TAG` (skopeo, no pull). If
that differs from what the running container serves, it pins the new digest into
`deploy.env`, recreates **only** the target service, health-gates it, and either
records success (`last_good`) or rolls back / writes a `HOLD` sentinel that stops
further deploys until you clear it. Full algorithm: read [`poll.sh`](./poll.sh);
don't reimplement it.

## Deployment model: one poller per project

Each project is its **own** isolated compose stack with its own poller sidecar —
the eps-transact-mcp pattern, *not* one poller looping over many projects. One
project's `HOLD` or failed deploy never blocks another's. On a shared VM the
stacks coexist as separate compose projects and share nothing but the Docker
daemon.

## Prerequisite (outside this runbook)

The project's **own** CI must publish `ghcr.io/ekoindia/<project>:prod`. The
poller only *watches* a tag — it never builds. Copy the workflow shape from
[`.github/workflows/deploy-eps-transact-mcp.yml`](../../../../.github/workflows/deploy-eps-transact-mcp.yml):
build → push `:sha` → retag `:prod` via `docker buildx imagetools create`.

## Steps

Use eps-transact-mcp as the template — copy its two files and edit them:

- [`packages/eps-transact-mcp/deploy/docker-compose.prod.yml`](../../../eps-transact-mcp/deploy/docker-compose.prod.yml)
- [`packages/eps-transact-mcp/deploy/deploy.env.sample`](../../../eps-transact-mcp/deploy/deploy.env.sample)

### 1. Edit the poller `environment:` block

| Knob | Set to | Notes |
|---|---|---|
| `IMAGE` | `ghcr.io/ekoindia/<project>` | the watched image |
| `SERVICE` | `<project>` | **must** match the app service name in the compose file |
| `DEPLOY_ENV_KEY` | `<PROJECT>_IMAGE` | key the poller pins; app service must use `image: ${<PROJECT>_IMAGE}` |
| `READYZ_URL` | `http://<service>:<port>/healthz` | see reachability note below |
| `REDIS_REQUIRED` | `0`, or `1` if the app needs Redis | `1` adds a Redis ping to the gate |
| `ALERT_SERVICE` | `<project>` | label in alert payloads |
| `COMPOSE_PROJECT` | `<project>` | **must be unique on the VM** (namespaces all containers/networks/volumes) |

Leave `WATCH_TAG`, `PROJECT_DIR`, `COMPOSE_FILE`, `DEPLOY_ENV_FILE`, `STATE_DIR`
as-is. These are **in-container** paths (`/deploy`, `/state`) backed by the bind
mount `./:/deploy` and the named volume `<project>-poller-state:/state` — the
per-project isolation comes from the host dir and the volume name, so the paths
never change between stacks.

> **`READYZ_URL` reachability:** the URL is resolved from **inside the poller
> container**, not the host. So the poller and the app service must share a
> compose network, and the URL uses the service name + the app's **internal**
> port (transact: both on `transact-egress`, `http://eps-transact-mcp:8788/healthz`).
> It is the deploy gate only — independent of any compose `healthcheck:`.

> **Single-service recreate:** the poller runs `docker compose up -d --no-deps
> <SERVICE>` — it recreates that one service and nothing else. If your app needs
> DB migrations, ordered restarts of dependent services, or a warmup step as part
> of a deploy, the bare recreate won't do it — bake that into the image's entry
> point or don't rely on the poller for it.

### 2. Edit the app service + `deploy.env`

- App service: `image: ${<PROJECT>_IMAGE}`, a unique host port
  (`127.0.0.1:<port>:<port>` — backend 8787, transact 8788, pick a free one),
  and a `/healthz` (or equivalent) that returns 200 only when ready.
- `deploy.env`: seed with the **tag**, not a digest —
  `<PROJECT>_IMAGE=ghcr.io/ekoindia/<project>:prod`. The first `up -d` starts on
  the tag and the poller pins the immutable digest on its first tick (this is
  what `deploy.env.sample` does; it sidesteps multi-arch digest-parsing).

### 3. Shared-VM checklist

- **`COMPOSE_PROJECT` unique.** Compose namespaces networks and volumes by
  project name automatically, so a unique `COMPOSE_PROJECT` is what keeps stacks
  from cross-wiring — you do **not** need to rename the networks themselves.
- **Host port unique** — a collision on `127.0.0.1:<port>` fails `up`.
- **Own project dir** `/data/<project>/` — its own `deploy.env`,
  `docker-compose.prod.yml`, and `.ghcr-auth.json`. Never share a `deploy.env`
  across stacks.

### 4. VM prerequisites

GHCR images are **private**, so auth is needed in two places:
- Host daemon: `docker login ghcr.io -u manustays` (PAT with `read:packages`,
  scoped to read every image these stacks pull).
- Poller: mount `./.ghcr-auth.json` (a copy of `~/.docker/config.json`,
  `chmod 600`) — this is a long-lived credential, so restrict its permissions and
  rotate the PAT on the usual schedule.

Docker install, the `/data` data-root (vfs) gotcha, and nginx are **not** repeated
here — see the existing VM runbooks:
[eps-transact-mcp VM deploy](../../../../docs/local-roadmap/how-to-deploy-eps-transact-mcp-on-vm.md)
· [eps-backend VM deploy](../../docs/eps-backend-vm-deploy.md).

### 5. Bring up

```sh
cd /data/<project>
docker compose -p <project> --project-directory /deploy \
  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml up -d
```

## Verify & operate

- `docker compose -p <project> ... logs -f poller` — the loop logs
  `deploying <digest>` then `deployed <digest>` on a successful roll.
- **HOLD:** on a fault the poller writes `/state/HOLD` (inside the volume) and
  stops deploying. Inspect: `docker compose -p <project> ... exec poller cat /state/HOLD`.
  Clear after fixing: `... exec poller rm -f /state/HOLD`.
- Public projects need an nginx reverse proxy to `127.0.0.1:<port>` — pattern in
  the [transact VM runbook](../../../../docs/local-roadmap/how-to-deploy-eps-transact-mcp-on-vm.md).

`eps-transact-mcp` runs live under exactly this recipe
(`https://mcp.eko.in/transact/mcp`) — precedent that the pattern works, though
each new project still needs its own healthcheck and port verified.
