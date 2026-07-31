# Poller alternatives + VM observability — evaluation (2026-07-30)

Decision record. Question asked: is there reliable FOSS software to replace
`poll.sh` — something configurable for multiple projects (Docker or direct
deployment) with extras like app monitoring, easier log access, and restarts?

**Outcome: keep the poller for deploys; add a separate observability layer.**
No off-the-shelf tool does pull-based deploy *with* a health gate, automatic
rollback, and a HOLD sentinel — which is the whole reason `poll.sh` exists. The
real gap on the VM is observability (logs, health alerting), which is additive
and does not touch the deploy path.

## Context — what the VM runs

One shared Azure RHEL box, three stacks (`eps-transact-mcp`,
`eko-business-dashboard`, `eps-backend`), each its own compose project with its
own poller container off the shared `ghcr.io/ekoindia/eps-poller:prod` image.
Host nginx + certbot already terminate TLS for `connect.eko.in`, `mcp.eko.in`,
`bizdash.eko.in`, and `api.eps.eko.in`. Docker data-root is on `/data` with the
**vfs** storage driver — no layer sharing, so every added image costs full-size
disk.

Two constraints ruled out most candidates:

1. **Pull-based is deliberate.** No VM credentials in CI, no self-hosted runner,
   no inbound SSH from GitHub. Anything push-based inverts this.
2. **nginx already owns :80/:443** for four sites. Any tool that wants to be the
   reverse proxy is a direct conflict.

## Options considered

| Tool | Multi-project | Deploy model | Health gate + rollback | Verdict |
| --- | --- | --- | --- | --- |
| **Watchtower** | yes (label-scoped) | pull, registry watch | **none** | Downgrade. Explicitly "no rollback system, no approval step, no safety net". `containrrr/watchtower` archived 2025-12-17; `nicholas-fedor/watchtower` is the live fork (not an official successor) |
| **Komodo** (Rust, ~10k★) | yes, multi-server | build + compose deploy | partial, configurable | Closest single-pane fit; see below |
| **Coolify** (~50k★) / **Dokploy** | yes (PaaS) | git-push | yes-ish | **Rejected** — both want to own the reverse proxy (Traefik). Non-starter beside the existing nginx |
| **Portainer CE**, **Dockge** | yes | manual / git stacks | none | Management UI only; no gated deploy |
| **Dozzle** + **Uptime Kuma** | yes | none (observability) | n/a | **Chosen additive layer** |
| **podman quadlet auto-update** | yes | pull, systemd | **yes**, built in | Genuinely good design, but means migrating off Docker |
| **Kamal** (37signals) | yes | **push** from CI | yes | Conflicts with constraint 1 |
| **Argo CD / Flux** | yes | pull, GitOps | yes | Kubernetes only |

## Recommended: additive observability, no deploy migration

- **[Dozzle](https://dozzle.dev)** — live log UI across every container on the
  box, one small container, read-only Docker socket. Replaces juggling
  `docker compose -p <project> … logs -f` across four stacks.
- **Uptime Kuma** — polls `/healthz`, `/api/healthz`,
  `mcp.eko.in/transact/healthz`; notifies on failure. Also the natural sink for
  `POLLER_ALERT_WEBHOOK`, which is currently the only fault signal for a HOLD,
  PAT expiry, or registry outage.

Both bind loopback and sit behind an nginx server block with basic auth. Restart
and exec are already available via the invariant compose command; a UI for them
is a want, not a need.

## If one pane of glass becomes the actual goal: Komodo

Real engineering (Rust, actively developed), multi-server core/periphery,
compose-stack aware, with built-in logs, restarts, alerts, and resource graphs.
Cost: it becomes the deploy authority, so the health-gate + auto-rollback + HOLD
semantics in `poll.sh` must be re-implemented or given up. That is a project, not
a swap — only worth it if the number of stacks or servers grows well past three.

## vfs disk caveat

Every added image copies all layers in full on this host. Dozzle and Uptime Kuma
are ~50 MB each; a Komodo core + periphery + database is not. Check
`df -h /data && docker system df` before adding anything.

## Sources

- [Watchtower archived + fork status](https://watchtowerdocker.com/blog/watchtower-discontinued-archived-2026.html)
- [nicholas-fedor/watchtower](https://github.com/nicholas-fedor/watchtower)
- [Komodo vs Portainer vs Dockge (2026)](https://techfuelhq.com/homelab/komodo-vs-portainer-vs-dockge-2026/)
- [Self-hosted deployment tools compared](https://haloy.dev/blog/self-hosted-deployment-tools-compared)
- [Coolify vs Dokploy](https://contabo.com/blog/blog-coolify-vs-dokploy-comparison/)
