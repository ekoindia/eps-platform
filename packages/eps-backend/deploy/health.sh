#!/usr/bin/env bash
#
# Read-only health sweep for a poller-managed Compose stack on the VM.
# Mutates nothing: no up/down/restart/rm, no writes to /state, no image pulls.
# Run with no arguments for the usage guide.
#
# Reads the poller's state volume through its mountpoint rather than spawning a
# throwaway container: the VM runs the `vfs` storage driver, where a first
# `busybox` pull costs minutes. Requires root, which is how the VM is operated.

# Deliberately NOT `-e`: a single failing probe must not abort the sweep — the
# whole point is to see every check's verdict in one pass.
set -uo pipefail

PROJECT="${PROJECT:-eps-backend}"
DIR="${DIR:-/data/eps-backend}"
SERVICE="${SERVICE:-eps-backend}"
PORT="${PORT:-8787}"
STATE_VOL="${STATE_VOL:-${PROJECT}_eps-poller-state}"
IMAGE_ENV_KEY="${IMAGE_ENV_KEY:-EPS_BACKEND_IMAGE}"
# Set to check the public path through nginx too, e.g.
# PUBLIC_HEALTH_URL=https://api.eps.eko.in/healthz
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"

# The invariant Compose form — see docs/eps-backend-docker-ops.md §1. Every flag
# earns its place; dropping one does not always fail loudly.
dc() {
	docker compose -p "$PROJECT" \
		--project-directory "$DIR" \
		--env-file "$DIR/deploy.env" \
		-f "$DIR/docker-compose.prod.yml" "$@"
}

usage() {
	cat <<USAGE_TEXT
$(basename "$0") — read-only health sweep for a poller-managed Compose stack.

USAGE
  $(basename "$0") full            run every check; exit 1 if any FAILed
  $(basename "$0") logs [N]        follow the app log (last N lines, default 200)
  $(basename "$0") poller [N]      follow the poller log
  $(basename "$0") help            this message (also shown with no arguments)

WHAT 'full' CHECKS
  1. Services       state, health, restart count for every container
  2. Deployed build running image digest vs deploy.env, and the commit behind it
  3. Poller state   HOLD (with age + reason), last_good, remote_fail_count
  4. Probes         /healthz, /readyz, and optionally the public URL via nginx
  5. Store          Valkey PING, and whether REDIS_URL is configured at all
  6. Traffic        access-log line count (0 is normal on an idle box)
  7. Disk           storage driver, /data free space, docker system df

  Read-only throughout: it never restarts, pulls, or writes to /state. When a
  HOLD is latched it PRINTS the clearing command instead of running it.

ENVIRONMENT (defaults target the eps-backend stack)
  PROJECT            Compose project name             [$PROJECT]
  DIR                deploy directory on the VM       [$DIR]
  SERVICE            app service name                 [$SERVICE]
  PORT               loopback port for the probes     [$PORT]
  STATE_VOL          poller state volume              [$STATE_VOL]
  IMAGE_ENV_KEY      digest key inside deploy.env     [$IMAGE_ENV_KEY]
  PUBLIC_HEALTH_URL  also probe through nginx         [${PUBLIC_HEALTH_URL:-<unset>}]

EXAMPLES
  # eps-backend, including the public path through nginx
  PUBLIC_HEALTH_URL=https://api.eps.eko.in/healthz $(basename "$0") full

  # the transact stack reuses this same file
  PROJECT=eps-transact-mcp DIR=/data/eps-mcp SERVICE=eps-transact-mcp \\
  PORT=8788 STATE_VOL=eps-transact-mcp_transact-poller-state \\
  IMAGE_ENV_KEY=EPS_TRANSACT_MCP_IMAGE $(basename "$0") full

EXIT CODES
  0  all checks passed (or help was printed)
  1  at least one check FAILed
  2  bad arguments

DOCS
  packages/eps-backend/docs/eps-backend-docker-ops.md  (section 3)
USAGE_TEXT
}

case "${1:-help}" in
full) ;;
logs)
	dc logs -f --tail="${2:-200}" "$SERVICE"
	exit $?
	;;
poller)
	dc logs -f --tail="${2:-200}" poller
	exit $?
	;;
help | -h | --help)
	usage
	exit 0
	;;
*)
	echo "error: unknown mode '$1'" >&2
	usage >&2
	exit 2
	;;
esac

FAILURES=0
hdr() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok() { printf '  \033[32mok\033[0m    %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAILURES=$((FAILURES + 1)); }
note() { printf '        %s\n' "$*"; }

printf '\033[1meps VM health — project=%s dir=%s\033[0m\n' "$PROJECT" "$DIR"

# --- 1. services -------------------------------------------------------------
# A climbing RestartCount is the crash-loop tell; a container can be "running"
# and still be dying every 20s.
hdr "1. Services"
if ! dc ps 2>/dev/null | tail -n +1; then
	bad "compose ps failed — wrong dir, missing deploy.env, or docker down"
fi
while read -r svc; do
	[ -n "$svc" ] || continue
	cid="$(dc ps -q "$svc" 2>/dev/null)"
	if [ -z "$cid" ]; then
		bad "$svc: no container"
		continue
	fi
	info="$(docker inspect "$cid" --format \
		'{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}|{{.State.StartedAt}}|{{.RestartCount}}')"
	IFS='|' read -r state health started restarts <<<"$info"
	desc="$svc: $state health=$health restarts=$restarts since=$started"
	if [ "$state" != "running" ]; then
		bad "$desc"
	elif [ "$health" = "unhealthy" ]; then
		bad "$desc"
	elif [ "${restarts:-0}" -gt 3 ]; then
		warn "$desc  (restart loop?)"
	else
		ok "$desc"
	fi
done < <(dc ps --services 2>/dev/null)

# --- 2. deployed build -------------------------------------------------------
# Two independent facts: what the poller WROTE to deploy.env, and what the
# container is actually RUNNING. A mismatch means the poller never applied it.
hdr "2. Deployed build"
cid="$(dc ps -q "$SERVICE" 2>/dev/null)"
if [ -z "$cid" ]; then
	bad "$SERVICE has no container — cannot resolve the running digest"
else
	imgid="$(docker inspect "$cid" --format '{{.Image}}' 2>/dev/null)"
	running="$(docker image inspect "$imgid" --format '{{join .RepoDigests "\n"}}' 2>/dev/null | head -n1)"
	revision="$(docker image inspect "$imgid" \
		--format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null)"
	wanted="$(grep -E "^${IMAGE_ENV_KEY}=" "$DIR/deploy.env" 2>/dev/null | head -n1 | cut -d= -f2-)"
	note "running:  ${running:-<unknown>}"
	note "deploy.env: ${wanted:-<unset>}"
	note "commit:   ${revision:-<no revision label>}"
	if [ -z "$running" ] || [ -z "$wanted" ]; then
		warn "could not compare digests"
	elif [ "$running" = "$wanted" ]; then
		ok "running digest matches deploy.env"
	else
		bad "running digest != deploy.env — poller has not applied the latest image"
	fi
fi

# --- 3. poller state ---------------------------------------------------------
# HOLD latches. Only a `deploy error <digest>` HOLD whose digest is already live
# auto-clears; every other reason blocks ALL future deploys until an operator
# removes it. See deploy/poller/poll.sh hold_is_falsified().
hdr "3. Poller state ($STATE_VOL)"
mount="$(docker volume inspect -f '{{.Mountpoint}}' "$STATE_VOL" 2>/dev/null)"
if [ -z "$mount" ] || [ ! -d "$mount" ]; then
	warn "state volume not readable (missing, or not running as root)"
else
	if [ -f "$mount/HOLD" ]; then
		reason="$(head -n1 "$mount/HOLD")"
		age=$(( $(date +%s) - $(stat -c %Y "$mount/HOLD") ))
		bad "HOLD set ${age}s ago: ${reason}"
		note "nothing has deployed since. Clear with:"
		note "  docker run --rm -v ${STATE_VOL}:/state busybox rm -f /state/HOLD"
	else
		ok "no HOLD — auto-deploy is live"
	fi
	note "last_good: $(cat "$mount/last_good" 2>/dev/null || echo '<none>')"
	fails="$(cat "$mount/remote_fail_count" 2>/dev/null)"
	if [ -n "${fails:-}" ] && [ "$fails" -gt 0 ] 2>/dev/null; then
		warn "remote_fail_count=$fails — registry auth/connectivity (check .ghcr-auth.json)"
	else
		ok "registry reachable (remote_fail_count=0)"
	fi
fi
alerts="$(dc logs --tail=200 poller 2>/dev/null | grep -E 'ALERT|HOLD' | tail -n 5)"
if [ -n "$alerts" ]; then
	note "recent poller alerts:"
	# One printf arg holds many lines — indent per line, not just the first.
	printf '%s\n' "$alerts" | sed 's/^/        /'
fi

# --- 4. probes ---------------------------------------------------------------
hdr "4. Probes"
if curl -fsS -m 5 "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
	ok "/healthz 200 (process alive)"
else
	bad "/healthz unreachable on localhost:${PORT}"
fi
if curl -fsS -m 5 "http://localhost:${PORT}/readyz" >/dev/null 2>&1; then
	ok "/readyz 200"
else
	bad "/readyz not ready — store down, or the app is failing to boot"
fi
if [ -n "$PUBLIC_HEALTH_URL" ]; then
	code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$PUBLIC_HEALTH_URL")"
	if [ "$code" = "200" ]; then
		ok "public $PUBLIC_HEALTH_URL → 200 (nginx forwarding)"
	else
		bad "public $PUBLIC_HEALTH_URL → $code (app may be fine; suspect nginx/TLS)"
	fi
fi

# --- 5. store ----------------------------------------------------------------
# With REDIS_URL unset, buildApp leaves `readiness` undefined and /readyz returns
# {ready:true} unconditionally (src/http/app.ts) — so the poller's deploy gate
# CANNOT detect a store fault, and sessions are lost on every redeploy.
hdr "5. Store"
if dc ps --services 2>/dev/null | grep -qx redis; then
	if dc exec -T redis valkey-cli ping 2>/dev/null | grep -q PONG; then
		ok "valkey PONG"
	else
		bad "valkey not responding to PING"
	fi
	if grep -qE '^REDIS_URL=.' "$DIR/.env" 2>/dev/null; then
		ok "REDIS_URL configured — /readyz is a real gate"
	else
		warn "REDIS_URL unset: app is on in-memory KV, valkey is running unused."
		note "/readyz always returns ready → the poller's deploy gate is a no-op,"
		note "and every redeploy drops all sessions/tokens."
		note "Fixing it needs REDIS_URL *and* KV_ENCRYPTION_KEY (config.ts throws otherwise)."
	fi
else
	ok "no redis service in this stack"
fi

# --- 6. traffic --------------------------------------------------------------
# /healthz and /readyz are excluded from the access log (src/http/app.ts), so an
# idle box logs nothing after its boot lines. Zero here is normal, not broken.
hdr "6. Traffic"
lines="$(dc logs --tail=500 "$SERVICE" 2>/dev/null | grep -c '"type":"access"')"
if [ "${lines:-0}" -gt 0 ]; then
	ok "$lines access lines in the last 500 log lines"
else
	warn "0 access lines — no non-health requests since the log window started."
	note "This is NORMAL for an idle box: /healthz and /readyz are not access-logged."
	note "Confirm logging works:  curl -s localhost:${PORT}/nope >/dev/null && $0 full | grep -i traffic"
fi

# --- 7. disk & driver --------------------------------------------------------
# The slow-vs-stuck discriminator: on vfs a single image pull takes 18-33 min.
hdr "7. Disk & storage driver"
docker info 2>/dev/null | grep -iE 'storage driver|docker root dir' | sed 's/^ */  /'
df -h /data 2>/dev/null | sed 's/^/  /'
docker system df 2>/dev/null | sed 's/^/  /'

hdr "Result"
if [ "$FAILURES" -eq 0 ]; then
	ok "all checks passed"
	exit 0
fi
bad "$FAILURES check(s) failed — see above"
exit 1
