#!/usr/bin/env bash
#
# install-production-push-guard.sh — install the production-device pre-push guard
# into every git checkout of this monorepo: the parent, the four submodules, and
# the two nested ALN-TokenData `data` checkouts inside the scanners.
#
# WHY: the production Pi is pinned to the production branch on all five repos.
# `main` on every remote is the in-development line and carries an incompatible
# token-data format (tokens v2). Nothing on this device may push to `main`, and
# nothing may rewrite or delete the production branch. Git hooks are not
# versioned, so this installer is what makes the guard reproducible on a second
# device. See DEPLOYMENT_GUIDE.md → "Token Update Before a Game".
#
# Idempotent: re-running overwrites a guard it installed earlier. It refuses to
# overwrite a pre-push hook it did not write.
#
# Usage (from anywhere):            scripts/install-production-push-guard.sh
# Deliberate, reviewed override:    git push --no-verify ...

set -euo pipefail

PROD_BRANCH="production-2026-07"
MARKER="ALN-PRODUCTION-PUSH-GUARD"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

hook_body() {
cat <<EOF
#!/bin/sh
# $MARKER — installed by scripts/install-production-push-guard.sh. Do not edit by hand.
# This device is the production orchestrator, pinned to $PROD_BRANCH.
#   * refuses every push to refs/heads/main
#   * refuses deleting or rewriting (non-fast-forward) refs/heads/$PROD_BRANCH
# Deliberate override: git push --no-verify
zero=0000000000000000000000000000000000000000
status=0
while read -r local_ref local_sha remote_ref remote_sha; do
  case "\$remote_ref" in
    refs/heads/main)
      echo "pre-push: BLOCKED. This is the production device; it never pushes to main." >&2
      echo "          main is the development line (incompatible token format). Work on main from a main checkout." >&2
      status=1 ;;
    refs/heads/$PROD_BRANCH)
      if [ "\$local_sha" = "\$zero" ]; then
        echo "pre-push: BLOCKED. Refusing to delete $PROD_BRANCH on the remote." >&2
        status=1
      elif [ "\$remote_sha" != "\$zero" ] && ! git merge-base --is-ancestor "\$remote_sha" "\$local_sha" 2>/dev/null; then
        echo "pre-push: BLOCKED. Non-fast-forward push to $PROD_BRANCH would rewrite the production branch." >&2
        echo "          Run: git fetch origin && git merge --ff-only origin/$PROD_BRANCH   then push again." >&2
        echo "          (If the remote commit is simply unknown locally, the fetch fixes that too.)" >&2
        status=1
      fi ;;
  esac
done
exit \$status
EOF
}

checkouts() {
  echo "."
  git submodule foreach --recursive --quiet 'echo "$displaypath"'
}

installed=0
while IFS= read -r rel; do
  hooks_dir="$(cd "$rel" && realpath -m "$(git rev-parse --git-path hooks)")"
  hook="$hooks_dir/pre-push"
  if [ -f "$hook" ] && ! grep -q "$MARKER" "$hook"; then
    echo "REFUSING: $rel already has a pre-push hook that is not ours: $hook" >&2
    exit 1
  fi
  mkdir -p "$hooks_dir"
  hook_body > "$hook"
  chmod +x "$hook"
  printf '  installed  %-28s -> %s\n' "$rel" "$hook"
  installed=$((installed + 1))
done < <(checkouts)

echo "Production push guard installed in $installed checkouts (branch: $PROD_BRANCH)."
echo "Test without side effects:  git push --dry-run origin HEAD:refs/heads/main   (must be BLOCKED)"
