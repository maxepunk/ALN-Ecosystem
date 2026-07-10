# STAGING: ALN-TokenData A1 artifacts (pending submodule write access)

These four files are the A1 slice-1 pack artifacts whose real home is the
ALN-TokenData repo (branch `claude/phase3-foundations`, commit `0b5cd93`).
They are staged HERE because the authoring session had no write access to
the submodule repos (proxy session-scoping).

Two recovery paths, either works:

**Path 1 — plain files (this directory):** copy the four files into an
ALN-TokenData checkout on `claude/phase3-foundations`, commit, push.

**Path 2 — the exact commit:** the full commit is pushed to THIS repo as
ref `staging/tokendata-phase3-a1`. From an ALN-TokenData checkout:

    git fetch https://github.com/maxepunk/ALN-Ecosystem staging/tokendata-phase3-a1
    git checkout claude/phase3-foundations
    git merge --ff-only FETCH_HEAD     # tip was 3e60fad -> becomes 0b5cd93
    git push origin claude/phase3-foundations

**After either path:** bump the parent submodule pin to the pushed commit,
DELETE the transient loud-skip guard in
`backend/tests/contract/pack/pack-schemas.test.js`, delete this directory
and the staging ref:

    git push origin :refs/heads/staging/tokendata-phase3-a1
