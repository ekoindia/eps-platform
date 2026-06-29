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

# --- summary (added once; Tasks 2–3 insert their cases ABOVE this block) ---
PASS="$(grep -c '^ok' "$RESULTS" || true)"
FAIL="$(grep -c '^no' "$RESULTS" || true)"
grep '^no' "$RESULTS" | sed 's/^no\t/FAIL - /'
printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
rm -f "$RESULTS"
[ "$FAIL" -eq 0 ]
