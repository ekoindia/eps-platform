#!/usr/bin/env bash
# Pure-bash test harness (no bats). Each case runs in a ( ) subshell; results are
# aggregated through a SHARED file (subshell-local counters would always read 0),
# and errexit is disabled inside cases so a missing function records a FAIL
# instead of silently aborting the subshell.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
POLL="$HERE/../poll.sh"
RESULTS="$(mktemp)"; export RESULTS POLL HERE

# load: source poll.sh THEN drop errexit so assertions always run even if a
# function is undefined (fail-before-impl) or returns non-zero.
load() { source "$POLL"; set +e; }

# setup: fresh temp STATE_DIR + deploy.env dir, shims first on PATH, fast gate.
setup() {
	SHIM_STATE="$(mktemp -d)"; export SHIM_STATE STATE_DIR="$SHIM_STATE"
	local d; d="$(mktemp -d)"; export DEPLOY_ENV_FILE="$d/deploy.env"
	export PATH="$HERE/shims:$PATH"
	export READYZ_RETRIES=4 READYZ_DELAY_SEC=0 POLLER_ALERT_WEBHOOK=""
	unset SHIM_SKOPEO_FAIL SHIM_SKOPEO_DIGEST SHIM_READYZ_DEFAULT SHIM_REDIS_DEFAULT \
		SHIM_CTR_DEFAULT SHIM_REPODIGESTS SHIM_NEW_CID SHIM_IMGID \
		SHIM_PULL_FAIL SHIM_UP_FAIL 2>/dev/null || true
	: >"$SHIM_STATE/calls.log"
}
ok() { printf 'ok\t%s\n' "$1" >>"$RESULTS"; }
no() { printf 'no\t%s\t%s\n' "$1" "${2:-}" >>"$RESULTS"; }
eq() { [ "$2" = "$3" ] && ok "$1" || no "$1" "expected [$3] got [$2]"; }

# --- Task 1 cases ---
( setup; load
	echo "cid123" >"$SHIM_STATE/ps"
	export SHIM_IMGID=imgABC SHIM_REPODIGESTS="ghcr.io/ekoindia/eps-backend@sha256:LIVE"
	eq "running_repo_digest resolves RepoDigest" "$(running_repo_digest)" "sha256:LIVE"
)
( setup; load
	: >"$SHIM_STATE/ps"  # no container
	eq "running_repo_digest empty when no container" "$(running_repo_digest)" ""
)
( setup; export SHIM_SKOPEO_DIGEST=sha256:remote; load
	eq "remote_digest echoes :prod digest" "$(remote_digest)" "sha256:remote"
)
( setup; printf 'DOWN' >"$SHIM_STATE/redis_ping"; load
	if redis_ping; then no "redis_ping down → rc1" "rc0"; else ok "redis_ping down → rc1"; fi
)
( setup; load
	write_deploy_env "ghcr.io/ekoindia/eps-backend@sha256:abc"
	eq "write_deploy_env content" "$(cat "$DEPLOY_ENV_FILE" 2>/dev/null || true)" \
		"EPS_BACKEND_IMAGE=ghcr.io/ekoindia/eps-backend@sha256:abc"
)
( setup; load
	set_hold "because"; is_hold && ok "set_hold/is_hold" || no "set_hold/is_hold" "not set"
	clear_hold; is_hold && no "clear_hold" "still held" || ok "clear_hold"
)

# --- Task 2 cases (inserted ABOVE the summary block; every case uses `load`) ---
seed_deploy() {            # common: a change is pending, redis up, container healthy
	echo "cidOLD" >"$SHIM_STATE/ps"
	export SHIM_IMGID=imgOLD SHIM_REPODIGESTS="ghcr.io/ekoindia/eps-backend@sha256:LIVE"
	export SHIM_SKOPEO_DIGEST=sha256:remote SHIM_NEW_CID=cidNEW
}
lg() { cat "$SHIM_STATE/last_good" 2>/dev/null || true; }
( setup; seed_deploy; load
	reconcile_once
	eq "happy path writes last_good=remote" "$(lg)" "sha256:remote"
	is_hold && no "happy path no HOLD" "held" || ok "happy path no HOLD"
)
( setup; seed_deploy; export SHIM_SKOPEO_DIGEST=sha256:LIVE; load  # remote==running → no-op
	reconcile_once
	[ -f "$SHIM_STATE/last_good" ] && no "no-op when unchanged" "deployed" || ok "no-op when unchanged"
)
( setup; seed_deploy; printf 'DOWN' >"$SHIM_STATE/redis_ping"; load  # redis down at poll
	reconcile_once
	grep -q "up -d" "$SHIM_STATE/calls.log" && no "redis down → no swap" "swapped" || ok "redis down → no swap"
)
( setup; seed_deploy
	printf 'FAIL FAIL FAIL FAIL' >"$SHIM_STATE/curl_readyz"; load      # image fault, redis up throughout
	reconcile_once
	# rollback target = prev (sha256:LIVE); rollback gate (default OK) → last_good=LIVE
	eq "image fault rolls back to prev" "$(lg)" "sha256:LIVE"
)
( setup; seed_deploy
	printf 'FAIL FAIL FAIL FAIL' >"$SHIM_STATE/curl_readyz"
	printf 'UP DOWN DOWN UP' >"$SHIM_STATE/redis_ping"; load           # redis blipped during gate
	reconcile_once
	is_hold && ok "redis blip in gate → HOLD no rollback" || no "redis blip in gate → HOLD" "not held"
	[ "$(lg)" = "sha256:LIVE" ] && no "blip → no rollback" "rolled back" || ok "blip → no rollback"
)
( setup; seed_deploy
	printf 'FAIL FAIL FAIL FAIL' >"$SHIM_STATE/curl_readyz"
	printf 'running false 0\nexited false 0\nexited false 1\nrunning false 1' >"$SHIM_STATE/ctr_state"; load
	reconcile_once                                                    # container unstable during gate
	is_hold && ok "container unstable → HOLD no rollback" || no "container unstable → HOLD" "not held"
)
( setup
	: >"$SHIM_STATE/ps"; export SHIM_SKOPEO_DIGEST=sha256:remote SHIM_NEW_CID=cidNEW
	printf 'FAIL FAIL FAIL FAIL' >"$SHIM_STATE/curl_readyz"; load     # first deploy (prev=""), fails
	reconcile_once
	is_hold && ok "first-deploy fail → HOLD (no rollback target)" || no "first-deploy fail → HOLD" "not held"
)
( setup; seed_deploy; export SHIM_UP_FAIL=1; load                    # `docker up` errors → deploy failure
	reconcile_once
	is_hold && ok "deploy up-failure → HOLD" || no "deploy up-failure → HOLD" "not held"
	[ -f "$SHIM_STATE/last_good" ] && no "up-failure no last_good" "wrote last_good" || ok "up-failure no last_good"
)
( setup; seed_deploy; export DEPLOY_ENV_FILE=/nonexistent/dir/deploy.env; load  # write_deploy_env fails
	reconcile_once
	is_hold && ok "deploy-env write failure → HOLD" || no "deploy-env write failure → HOLD" "not held"
	[ -f "$SHIM_STATE/last_good" ] && no "env-write failure no last_good" "wrote last_good" || ok "env-write failure no last_good"
)
( setup; seed_deploy; load                                          # HOLD present → reconcile no-op
	printf 'held\n' >"$SHIM_STATE/HOLD"                              # STATE_DIR==SHIM_STATE (setup)
	: >"$SHIM_STATE/calls.log"
	reconcile_once
	grep -q "skopeo" "$SHIM_STATE/calls.log" && no "HOLD → no work" "did work" || ok "HOLD → no work"
)
( setup; seed_deploy; export SHIM_SKOPEO_FAIL=1; load                # registry unreachable
	reconcile_once
	grep -q "up -d" "$SHIM_STATE/calls.log" && no "registry error → no swap" "swapped" || ok "registry error → no swap"
)

# --- Task 3 case ---
( setup; seed_deploy
	export POLLER_ONESHOT=1
	bash "$POLL" >/dev/null 2>&1 || true
	# oneshot main → one deploy attempt recorded
	[ -f "$SHIM_STATE/last_good" ] && ok "main oneshot performs one reconcile" || no "main oneshot" "no reconcile"
)

# --- Task 4 case: consecutive remote_digest failure alerting ---
( setup; seed_deploy; export SHIM_SKOPEO_FAIL=1 REMOTE_FAIL_ALERT_THRESHOLD=2 POLLER_ALERT_WEBHOOK=http://hook; load
	reconcile_once   # fail 1 — counter=1, below threshold
	grep -q "http://hook" "$SHIM_STATE/calls.log" && no "no alert before threshold" "alerted early" || ok "no alert before threshold"
	reconcile_once   # fail 2 — counter=2 = threshold → alert fires
	grep -q "http://hook" "$SHIM_STATE/calls.log" && ok "alert at consecutive-fail threshold" || no "alert at consecutive-fail threshold" "no webhook"
)

# --- Task 5 cases: shared-poller env knobs (SERVICE / DEPLOY_ENV_KEY / REDIS_REQUIRED) ---
# write_deploy_env writes the overridden key AND preserves unrelated lines.
( setup; load
	export DEPLOY_ENV_KEY=EPS_TRANSACT_MCP_IMAGE
	printf 'UNRELATED=keepme\nEPS_TRANSACT_MCP_IMAGE=old\n' >"$DEPLOY_ENV_FILE"
	write_deploy_env "ghcr.io/ekoindia/eps-transact-mcp@sha256:new"
	grep -q '^UNRELATED=keepme$' "$DEPLOY_ENV_FILE" && ok "write_deploy_env preserves unrelated key" \
		|| no "write_deploy_env preserves unrelated key" "clobbered"
	eq "write_deploy_env rewrites overridden key" \
		"$(grep '^EPS_TRANSACT_MCP_IMAGE=' "$DEPLOY_ENV_FILE")" \
		"EPS_TRANSACT_MCP_IMAGE=ghcr.io/ekoindia/eps-transact-mcp@sha256:new"
	[ "$(grep -c '^EPS_TRANSACT_MCP_IMAGE=' "$DEPLOY_ENV_FILE")" = "1" ] \
		&& ok "write_deploy_env leaves no stale pin" || no "write_deploy_env leaves no stale pin" "dup"
)
# REDIS_REQUIRED=0: redis is DOWN throughout, yet the deploy proceeds and commits
# last_good — the redis gate and dependency-fault classification both no-op.
( setup; seed_deploy; printf 'DOWN DOWN DOWN DOWN' >"$SHIM_STATE/redis_ping"
	export REDIS_REQUIRED=0; load
	reconcile_once
	eq "REDIS_REQUIRED=0 deploys despite redis down" "$(lg)" "sha256:remote"
	is_hold && no "REDIS_REQUIRED=0 no HOLD" "held" || ok "REDIS_REQUIRED=0 no HOLD"
)
# SERVICE knob: the recreate command targets the overridden service, not eps-backend.
( setup
	echo "cidOLD" >"$SHIM_STATE/ps"
	export IMAGE=ghcr.io/ekoindia/eps-transact-mcp SERVICE=eps-transact-mcp REDIS_REQUIRED=0
	export SHIM_IMGID=imgOLD SHIM_REPODIGESTS="ghcr.io/ekoindia/eps-transact-mcp@sha256:LIVE"
	export SHIM_SKOPEO_DIGEST=sha256:remote SHIM_NEW_CID=cidNEW; load
	reconcile_once
	grep -q 'up -d --no-deps eps-transact-mcp' "$SHIM_STATE/calls.log" \
		&& ok "SERVICE knob targets overridden service" || no "SERVICE knob targets overridden service" "wrong service"
)

# --- summary (added once; Tasks 2–3 insert their cases ABOVE this block) ---
PASS="$(grep -c '^ok' "$RESULTS" || true)"
FAIL="$(grep -c '^no' "$RESULTS" || true)"
grep '^no' "$RESULTS" | sed 's/^no\t/FAIL - /'
printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
rm -f "$RESULTS"
[ "$FAIL" -eq 0 ]
