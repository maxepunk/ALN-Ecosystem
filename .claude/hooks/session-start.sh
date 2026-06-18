#!/bin/bash
# SessionStart hook — warms a Claude Code on the web container for ALN work.
#
# Fixes the three cold-start problems every remote session otherwise
# rediscovers by hand:
#   1. node_modules missing in the four npm workspaces (fresh clone)
#   2. Playwright browser build mismatch: the container ships pinned browser
#      builds under /opt/pw-browsers, but each repo's playwright-core may
#      expect a NEWER build number. Downloads are usually blocked, so we shim
#      the expected build dirs as symlinks onto the installed ones (minor
#      build skew is fine — proven across full Tier L runs).
#   3. ALNScanner/dist is untracked, but backend/public/gm-scanner symlinks
#      to it — backend E2E serves a broken scanner until a build exists.
#
# Idempotent; safe to run on warm containers (each step no-ops when done).
set -uo pipefail

# Web sessions only — local checkouts manage their own environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

log() { echo "[bootstrap] $*"; }

# ── 0. Submodule auth ────────────────────────────────────────────────────────
# The PARENT repo authenticates through the harness git proxy, but the four
# submodules point straight at github.com and need a token (the recurring
# Phase 2 pain). The harness credential helper reads /tmp/.ghcred; that file
# is container-local and absent on fresh containers. Self-heal it from an
# environment secret: add GH_SUBMODULES_TOKEN (fine-grained PAT, Contents
# read/write on the four submodule repos) to the Claude environment settings.
# Must run BEFORE submodule init — a fresh container can't even fetch
# submodules without it.
if [ ! -s /tmp/.ghcred ]; then
  if [ -n "${GH_SUBMODULES_TOKEN:-}" ]; then
    ( umask 077; printf 'password=%s' "$GH_SUBMODULES_TOKEN" > /tmp/.ghcred )
    log "submodule auth: provisioned /tmp/.ghcred from GH_SUBMODULES_TOKEN"
  else
    log "WARN: no submodule credential (/tmp/.ghcred missing, GH_SUBMODULES_TOKEN unset)"
    log "WARN: submodule fetch/push WILL FAIL — add GH_SUBMODULES_TOKEN to the environment"
  fi
fi
# Helper is SCOPED to github.com (review finding P17-M2): an unscoped global
# helper would hand the PAT to ANY host git contacts (e.g., a modified
# .gitmodules URL). Skip if the harness already provisioned a helper.
if ! git config --global --get credential.helper >/dev/null 2>&1 \
   && ! git config --global --get credential.https://github.com.helper >/dev/null 2>&1; then
  git config --global credential.https://github.com.helper \
    '!f() { echo "username=x-access-token"; cat /tmp/.ghcred; }; f'
elif git config --global --get credential.helper >/dev/null 2>&1 \
     && ! git config --global --get credential.https://github.com.helper >/dev/null 2>&1; then
  # Skip path taken because of an UNSCOPED helper: such a helper answers for
  # EVERY host git contacts — not just github.com. Warn loudly; never rewrite
  # credential config someone else owns from a bootstrap hook.
  log "WARN: UNSCOPED global credential.helper set (no github.com-scoped helper) — it may expose the PAT to non-GitHub hosts"
  log "WARN:   scope it to GitHub via the credential.https://github.com.helper key instead"
fi

# ── 1. Submodules ────────────────────────────────────────────────────────────
# SessionStart re-fires on resume/compact, so this must NEVER run a blanket
# 'git submodule update' — that detaches working branches back to the parent's
# pinned SHAs mid-session (active development happens ON branches inside the
# submodules). Instead: init only subtrees that are missing, then attach any
# detached submodule to the branch whose tip is exactly the pinned SHA.

# Init uninitialized subtrees only ('-' prefix in status), one level at a time.
init_missing_submodules() {
  local dir="$1"
  git -C "$dir" submodule status 2>/dev/null | while read -r line; do
    local path
    path=$(echo "$line" | awk '{print $2}')
    if [ "${line:0:1}" = "-" ]; then
      log "init submodule: $dir/$path"
      git -C "$dir" submodule update --init --recursive -- "$path" \
        || log "WARN: init failed for $dir/$path (network?)"
    else
      init_missing_submodules "$dir/$path"
    fi
  done
}
init_missing_submodules .

# Attach detached submodules to their working branch when unambiguous:
# exactly one remote branch points at the pinned SHA (re-pin discipline keeps
# pins == branch tips). Ambiguous or unknown pins stay detached, loudly.
git submodule foreach --recursive --quiet 'echo "$displaypath"' | while read -r sm; do
  if branch=$(git -C "$sm" symbolic-ref -q --short HEAD); then
    log "submodule $sm -> $branch"
    continue
  fi
  candidates=$(git -C "$sm" branch -r --points-at HEAD 2>/dev/null \
    | grep -v ' -> ' | sed 's|^ *origin/||')
  if [ "$(echo "$candidates" | grep -c .)" = "1" ]; then
    # If a LOCAL branch of that name exists at a DIFFERENT sha, checkout would
    # move the worktree away from the pin — stay detached and say so instead.
    local_sha=$(git -C "$sm" rev-parse -q --verify "refs/heads/$candidates" || true)
    if [ -n "$local_sha" ] && [ "$local_sha" != "$(git -C "$sm" rev-parse HEAD)" ]; then
      log "WARN: $sm pinned sha != local branch '$candidates' — leaving DETACHED (resolve by hand)"
    else
      git -C "$sm" checkout -q "$candidates" \
        && log "submodule $sm -> $candidates (attached from detached HEAD)" \
        || log "WARN: could not attach $sm to $candidates"
    fi
  else
    log "submodule $sm -> DETACHED at $(git -C "$sm" rev-parse --short HEAD)$( [ -n "$candidates" ] && echo " (candidates: $(echo $candidates | tr '\n' ' '))")"
  fi
done

# Auth preflight: prove WRITE access to each TOP-LEVEL submodule remote, so
# broken submodule auth surfaces at session start — never mid-push. The repos
# are publicly readable, so a read probe (ls-remote) passes even with no
# credential; only 'push --dry-run' exercises auth. Dry-run never updates
# remote refs. (Nested data/ submodules share the ALN-TokenData remote.)
git submodule foreach --quiet 'echo "$displaypath"' | while read -r sm; do
  if GIT_TERMINAL_PROMPT=0 timeout 15 git -C "$sm" push --dry-run origin \
       "HEAD:refs/heads/zz-auth-preflight-dry-run" >/dev/null 2>&1; then
    log "submodule push auth OK: $sm"
  else
    log "WARN: submodule PUSH auth FAILED: $sm ($(git -C "$sm" remote get-url origin))"
    log "WARN:   pushes from this session will fail — check GH_SUBMODULES_TOKEN"
  fi
done

# ── 2. npm dependencies ──────────────────────────────────────────────────────
# Cold containers only (node_modules absent). npm ci, not install: container
# npm version skew rewrites lockfile metadata under 'npm install', and a hook
# must never dirty the tree. Mid-session dependency changes are the session's
# own responsibility.
for dir in backend ALNScanner aln-memory-scanner config-tool; do
  if [ -f "$dir/package.json" ] && [ ! -d "$dir/node_modules" ]; then
    log "npm ci: $dir (cold container)"
    (cd "$dir" && npm ci --prefer-offline --no-audit --no-fund --loglevel=error) \
      || log "WARN: npm ci failed in $dir"
  fi
done

# ── 3. Playwright browser shims ──────────────────────────────────────────────
# For every chromium build a repo's playwright-core expects but the container
# lacks, alias it to the newest build actually installed.
BROWSERS="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
if [ -d "$BROWSERS" ]; then
  # Newest REAL (non-symlink) installs to use as shim targets.
  real_chromium=$(find "$BROWSERS" -maxdepth 1 -type d -name 'chromium-[0-9]*' | sort -V | tail -1)
  real_headless=$(find "$BROWSERS" -maxdepth 1 -type d -name 'chromium_headless_shell-[0-9]*' | sort -V | tail -1)
  chromium_bin=""; headless_bin=""
  if [ -n "$real_chromium" ]; then
    chromium_bin=$(find "$real_chromium" -type f -name 'chrome' | head -1)
  fi
  if [ -n "$real_headless" ]; then
    headless_bin=$(find "$real_headless" -type f \( -name 'headless_shell' -o -name 'chrome-headless-shell' \) | head -1)
  fi

  for repo in backend ALNScanner; do
    bj="$repo/node_modules/playwright-core/browsers.json"
    [ -f "$bj" ] || continue
    while read -r name rev; do
      case "$name" in
        chromium)
          # Inner layout changed across builds (chrome-linux/chrome vs
          # chrome-linux64/chrome) — provide BOTH so any build number resolves.
          want="$BROWSERS/chromium-$rev"
          if [ ! -e "$want" ] && [ -n "$chromium_bin" ]; then
            mkdir -p "$want/chrome-linux" "$want/chrome-linux64"
            ln -s "$chromium_bin" "$want/chrome-linux/chrome"
            ln -s "$chromium_bin" "$want/chrome-linux64/chrome"
            touch "$want/DEPENDENCIES_VALIDATED" "$want/INSTALLATION_COMPLETE"
            log "shim: chromium-$rev -> $(basename "$real_chromium")"
          fi
          ;;
        chromium-headless-shell)
          # Same layout split: chrome-linux/headless_shell (old) vs
          # chrome-headless-shell-linux64/chrome-headless-shell (new).
          want="$BROWSERS/chromium_headless_shell-$rev"
          if [ ! -e "$want" ] && [ -n "$headless_bin" ]; then
            mkdir -p "$want/chrome-headless-shell-linux64" "$want/chrome-linux"
            ln -s "$headless_bin" "$want/chrome-headless-shell-linux64/chrome-headless-shell"
            ln -s "$headless_bin" "$want/chrome-linux/headless_shell"
            touch "$want/DEPENDENCIES_VALIDATED" "$want/INSTALLATION_COMPLETE"
            log "shim: chromium_headless_shell-$rev -> $(basename "$real_headless")"
          fi
          ;;
      esac
    done < <(node -e '
      const j = require(process.argv[1]);
      for (const b of j.browsers)
        if (["chromium", "chromium-headless-shell"].includes(b.name))
          console.log(b.name, b.revision);
    ' "$PWD/$bj" 2>/dev/null)
  done

  # Persist for the session — playwright finds the shims without per-command
  # env. Guarded: SessionStart re-fires on resume/compact and must not append
  # a duplicate line each time.
  if [ -n "${CLAUDE_ENV_FILE:-}" ] \
     && ! grep -q "^export PLAYWRIGHT_BROWSERS_PATH=" "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo "export PLAYWRIGHT_BROWSERS_PATH=\"$BROWSERS\"" >> "$CLAUDE_ENV_FILE"
  fi
else
  log "WARN: no browser dir at $BROWSERS — E2E will need 'npx playwright install chromium'"
fi

# ── 4. GM Scanner dist (backend E2E serves backend/public/gm-scanner -> this) ─
if [ ! -f "ALNScanner/dist/index.html" ] && [ -d "ALNScanner/node_modules" ]; then
  log "building ALNScanner dist (first run on this container)"
  (cd ALNScanner && npm run build --silent) || log "WARN: ALNScanner build failed"
fi

log "done — submodules, deps, playwright shims, scanner dist ready"
