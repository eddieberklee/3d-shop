#!/bin/bash
# Install the git hook that deploys each push of main to Cloudflare.
# Run once in each clone: `bash scripts/install-deploy-hook.sh`.
# Git hooks are not part of a clone, so each computer that pushes needs this
# (and a `wrangler login`). All worktrees of the clone share the hook.
set -euo pipefail
hooks="$(git rev-parse --path-format=absolute --git-common-dir)/hooks"
mkdir -p "$hooks"
cat >"$hooks/pre-push" <<'HOOK'
#!/bin/bash
# Installed by scripts/install-deploy-hook.sh: deploy pushes of main to Cloudflare.
[ "$1" = "origin" ] || exit 0
while read -r _local_ref local_sha remote_ref _remote_sha; do
  if [ "$remote_ref" = "refs/heads/main" ] && [ "${local_sha//0/}" != "" ]; then
    # The script comes from the pushed commit itself.
    script="$(mktemp "${TMPDIR:-/tmp}/3d-shop-deploy-script.XXXXXX")"
    if git show "$local_sha:scripts/deploy-on-push.sh" >"$script" 2>/dev/null; then
      nohup bash "$script" "$local_sha" >/dev/null 2>&1 &
    fi
  fi
done
exit 0
HOOK
chmod +x "$hooks/pre-push"
echo "Installed $hooks/pre-push"
