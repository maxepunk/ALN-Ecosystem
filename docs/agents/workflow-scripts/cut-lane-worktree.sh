#!/usr/bin/env bash
# Cut and provision one lane worktree from the designated branch (recipe proven 2026-09-12 in a throwaway probe).
# Usage: cut-lane-worktree.sh <lane> [scanner]   — <lane> in credentials|supervisor|self-heal|arms; "scanner" also
# creates the ALNScanner branch of the same name inside the worktree's submodule (lanes that edit the scanner).
set -euo pipefail
LANE="$1"; WITH_SCANNER="${2:-}"
ROOT=/home/user/ALN-Ecosystem
BASE=claude/nice-curie-hescfv
BR="$BASE-$LANE"
WT="$ROOT/.worktrees/$LANE"
cd "$ROOT"
git worktree add "$WT" -b "$BR" "$BASE"
git -C "$WT" submodule update --init --recursive ALNScanner
git -C "$WT" submodule update --init ALN-TokenData
# The backend suite also reads both player scanners (tests/unit/player-scanner, the contract and
# integration player-scanner suites); without them six backend suites fail in the worktree (2026-10-30).
git -C "$WT" submodule update --init --recursive aln-memory-scanner
git -C "$WT" submodule update --init arduino-cyd-player-scanner
ln -s "$ROOT/backend/node_modules" "$WT/backend/node_modules"
ln -s "$ROOT/ALNScanner/node_modules" "$WT/ALNScanner/node_modules"
if [ "$WITH_SCANNER" = "scanner" ]; then
  git -C "$WT/ALNScanner" checkout -q -b "$BR"
fi
echo "worktree $WT on $BR (parent) $( [ "$WITH_SCANNER" = scanner ] && echo "+ ALNScanner branch $BR" )"
(cd "$WT/backend" && npx jest tests/unit/utils/processMonitor.test.js tests/unit/player-scanner 2>&1 | grep -E '^Tests:')
(cd "$WT/ALNScanner" && npx jest tests/unit/ui/renderers/HealthRenderer.test.js 2>&1 | grep -E '^Tests:')