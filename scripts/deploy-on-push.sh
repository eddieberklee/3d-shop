#!/bin/bash
# Deploy one pushed commit of main to Cloudflare. The git hook `pre-push`
# starts this in the background (see `scripts/install-deploy-hook.sh`).
#
#   scripts/deploy-on-push.sh <commit sha>
#
# It builds a clean copy of the commit in a temporary directory, so files that
# are not in git (`public/generated/`, `.env.local`) never reach the site.
# Log: ~/Library/Logs/3d-shop-deploy.log
set -u
sha="$1"
log="$HOME/Library/Logs/3d-shop-deploy.log"
lock="${TMPDIR:-/tmp}/3d-shop-deploy.lock"
exec >>"$log" 2>&1
say() { echo "$(date '+%F %T') ${sha:0:7} $*"; }

# The hook runs before the push ends. Wait until the commit is on origin's main.
on_origin=""
for _ in $(seq 1 30); do
  remote="$(git ls-remote origin refs/heads/main 2>/dev/null | cut -f1)"
  if [ -n "$remote" ] && git merge-base --is-ancestor "$sha" "$remote" 2>/dev/null; then on_origin=1; break; fi
  sleep 2
done
if [ -z "$on_origin" ]; then say "not on origin/main after 60 s (push refused?): no deploy"; exit 0; fi

# One deploy at a time. A lock older than 15 minutes is from a deploy that died.
waited=0
until mkdir "$lock" 2>/dev/null; do
  if [ -n "$(find "$lock" -maxdepth 0 -mmin +15 2>/dev/null)" ]; then rmdir "$lock" 2>/dev/null; continue; fi
  sleep 5
  waited=$((waited + 5))
  if [ "$waited" -ge 900 ]; then say "lock held for 15 minutes: no deploy"; exit 1; fi
done
work="$(mktemp -d "${TMPDIR:-/tmp}/3d-shop-deploy.XXXXXX")"
trap 'rm -rf "$work"; rmdir "$lock" 2>/dev/null' EXIT

# A newer commit has its own deploy: skip this one.
remote="$(git ls-remote origin refs/heads/main 2>/dev/null | cut -f1)"
if [ "$remote" != "$sha" ]; then say "main moved to ${remote:0:7}: skipped"; exit 0; fi

say "deploy started"
if git archive "$sha" | tar -x -C "$work" &&
  cd "$work" &&
  unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE &&
  npm ci --no-audit --no-fund >/dev/null &&
  npm run deploy; then
  say "DEPLOYED"
else
  say "FAILED (see the lines above)"
  exit 1
fi
