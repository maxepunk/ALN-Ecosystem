# Runbook — Thursday's token sync on the Pi (green; blue only under containment)

Written 2026-09-12 from the code (fact sheet:
`.superpowers/sdd/2026-09-12-block2-hardening-plan/token-sync-workflow.md`,
every step cites file:line there). For the owner's review before the
practice run during the green setup. Plain words; the commands are
exact. Do not start this within two hours of a show.

## The Thursday runbook as the code allows it today

Assumes green, the v2 pipeline, an incremental content drop. Run from
`/home/<user>/ALN-Ecosystem` unless stated. **Do not start this within
two hours of a show.**

1. **Confirm you are on green and on v2.**
   ```bash
   git -C ALN-TokenData status -sb        # NOT production-2026-07
   git submodule status --recursive
   python3 -c "import json;print(json.load(open('ALN-TokenData/game.json'))['schemaVersion'])"   # must print 2
   ```
   If any of this says `production-2026-07` / `blue-2026-07`, stop and
   re-read §8 — you are on blue and the rules are different.

2. **Prove the environment.**
   ```bash
   python3 -V
   python3 -c "import requests, PIL, dotenv; print('deps ok')"
   python3 -c "import jsonschema; print('schema check ON')" || pip install jsonschema
   fc-list | grep -ci dejavu        # want a non-zero count (gap 9)
   test -f .env || echo 'no root .env — export NOTION_TOKEN in this shell'
   ```
   `NOTION_TOKEN` in `ALN-Ecosystem/.env` or exported. Never echo it.

3. **Drop any new audio/video FIRST** (the sync will not create them):
   `.wav`/`.mp3` named `{tokenId}.{ext}` into
   `aln-memory-scanner/assets/audio/`; `.mp4` named `{tokenId}.mp4` into
   `backend/public/videos/`.

4. **Preview.**
   ```bash
   python3 scripts/sync_notion_to_tokens.py --dry-run 2>&1 | tee /tmp/sync-dryrun.log
   ```
   Read the validation summary. Fix in Notion and re-run until you are
   happy; a group-multiplier conflict or malformed `(xN)` is a hard stop
   and must be fixed in Notion.

5. **Run the sync for real.**
   ```bash
   python3 scripts/sync_notion_to_tokens.py 2>&1 | tee /tmp/sync-$(date +%F).log
   ```
   Expect the tail: `Rebuilding pack manifest... Wrote ALN-TokenData/pack-manifest.json`,
   `Writing asset manifest... Wrote aln-memory-scanner/assets/manifest.json`,
   `✓ Successfully synced N tokens`. Add `--prune` only after reading the
   orphan report in the previous run.

6. **Check the blast radius before committing.**
   ```bash
   git -C ALN-TokenData status --short
   git -C aln-memory-scanner status --short | wc -l    # ≈ tokens you edited, NOT ~127 (gap 9)
   curl -sk https://localhost:3000/api/tokens | wc -c  # must stay < 50000 (gap 13)
   ```

7. **Validate before anything restarts.**
   ```bash
   node backend/scripts/validate-pack.js ALN-TokenData        # exit 0 required
   (cd backend && npx jest tests/contract/pack tests/contract/token-data)
   python3 -m pytest scripts/tests/                            # optional but cheap
   ```
   If freshness fails:
   `node backend/scripts/build-pack-manifest.js ALN-TokenData`, then
   re-run.

8. **Commit and push — three repos.**
   ```bash
   cd ALN-TokenData   && git add tokens.json game.json pack-manifest.json && \
                         git commit -m "sync: token content $(date +%F)" && git push origin HEAD:<branch>
   cd ../aln-memory-scanner && git add assets && \
                         git commit -m "sync: regenerate NeurAI displays $(date +%F)" && git push origin HEAD:main
   cd .. && git add ALN-TokenData aln-memory-scanner && \
            git commit -m "sync: bump token + asset pins $(date +%F)" && git push
   ```
   Optional, decide deliberately: bump the nested
   `aln-memory-scanner/data` pin so the web Player Scanner stops serving
   stale JSON (gap 12) — this is the pin handoff rule 4 defers.

9. **Restart the orchestrator.**
   ```bash
   cd backend
   pm2 restart aln-orchestrator
   pm2 logs aln-orchestrator --lines 80 | grep -E "Pack ACTIVATED|CAPABILITY GATE|COHERENCE|LEGACY"
   curl -sk https://localhost:3000/health | jq '.pack'
   ```
   `Pack ACTIVATED: about-last-night v1.0.0 (sha256:…)` with the NEW hash
   is the green light. A `CAPABILITY GATE:` line means the process is
   refusing to boot — read the problem list, fix the pack, re-run step 7.

10. **Reboot the ESP32 scanners, one at a time, after the restart.**
    Power-cycle each; watch the TFT for `Tokens: Synced` then
    `image n/N xx%` then `Assets: Synced`. Incremental: 1-3 min each.
    If a device shows `Assets: Partial`, reboot it again — failures are
    per-file and retry on the next boot. If it shows `Tokens: Cached`,
    it could not reach the orchestrator or the DB exceeded 50 KB.

11. **Reload every GM tablet** while it is online and pointed at the
    orchestrator. Confirm the settings header pack line shows the new
    hash prefix and `· network` (no bundled badge). A tablet that still
    shows the old hash is on the cache tier — check connectivity and
    reload again. Nothing will warn the GM on their own screen; you have
    to look.

12. **Final identity sweep** (the preflight eyeball):
    orchestrator `/health.pack.contentHash` ==
    `/api/pack/manifest.contentHash` == each tablet's settings hash
    prefix == each ESP32's serial `CONFIG` "Game pack:" line
    (`Application.h:1071-1083`; needs `DEBUG_MODE` or the 30-second boot
    override). Any mismatch means that consumer is running different
    rules than the server.


---

## Where the code and the assumption differ

The owner's assumption — *"the sync script creates the required BMP files
and everything else"* — is right about the BMPs and wrong about
"everything else" in nine specific ways.

1. **Audio is never created or copied.** The sync only *looks* for
   `{rfid}.{mp3,wav,ogg}` already sitting in
   `aln-memory-scanner/assets/audio` (`sync_notion_to_tokens.py:697`,
   `:554-582`). A new audio memory needs the file placed there by hand
   before the sync, or its `audio` field is written `null` and the token
   plays nothing. Only 3 audio files exist today.
2. **Video is never created or copied either.** Same pattern against
   `backend/public/videos` (`:699`, `:584-603`). A new video token needs
   the `.mp4` dropped into `backend/public/videos/` (git-excluded —
   `DEPLOYMENT_GUIDE.md:677`) before the sync, or the `video` field is
   `null` and no TV playback is possible.
3. **A BMP is generated only when the Notion page has display text.**
   No text before the `SF_` block → no BMP, and the token silently gets
   `placeholder.bmp` (`:685-694`, `:701-706`).
4. **The sync commits nothing and pushes nothing.** Zero git calls.
   The result sits dirty across **two** submodules plus the parent (§3).
5. **There is no backup.** Atomic writes, yes; a `.backup` copy, no.
   `ALN-TokenData/CLAUDE.md:21` describes a file that does not exist.
   Git is the only rollback.
6. **There is no report file.** Validation, orphans and per-token lines
   go to stdout only; nothing is persisted (`:1107-1116`, `:1174-1182`).
7. **New files on disk do not reach the running orchestrator.** The pack
   is frozen at `activatePack()` (`packService.js:1215-1245`); the only
   feedback is one log warn per drift (`:1254-1268`). No hot reload, no
   admin command, and `system:reset` does not re-activate. **Restart is
   mandatory.**
8. **…except for two channels that ARE live, which is worse than
   uniform.** `/api/tokens` re-reads tokens.json per request
   (`tokenService.js:75-119`) and the asset endpoints re-read the asset
   dir on mtime (`resourceRoutes.js:32-46`). So an ESP32 rebooted after
   the sync but **before** the orchestrator restart gets the NEW tokens
   and NEW images from a server still scoring on the OLD pack. Reboot
   devices only after the restart.
9. **A font difference silently rewrites every BMP.** `load_font` falls
   DejaVu → Liberation → PIL bitmap default
   (`sync_notion_to_tokens.py:203-215`). If green's font packages differ
   from whatever machine produced the committed BMPs, every one of the
   127 images re-renders to different bytes → a 29 MB git diff → a new
   sha1 for every asset → **a full 38 MB re-sync on every ESP32**, i.e.
   5-15 min per device. Before Thursday, run the sync once on green and
   check `git -C aln-memory-scanner status --short | wc -l`: if it is
   ~127 rather than "the tokens I edited", green's fonts differ. Install
   `fonts-dejavu-core` and re-run before committing.

Four more gaps that are not about the sync script but will bite on
Thursday:

10. **Forgetting the pack-manifest rebuild breaks GM tablets silently.**
    A hand edit to any pack file without
    `node backend/scripts/build-pack-manifest.js ALN-TokenData` leaves
    the manifest stale. The orchestrator boots fine (the gate does not
    check freshness), but each tablet's staged refresh fails the sha1
    compare (`packLoader.js:226-229`) and quietly falls back to its
    cached — old — rules. The full sync does this step for you
    (`sync_notion_to_tokens.py:1193`); manual edits do not.
11. **The GM scanner never notices a mid-session pack change.** Load is
    once, at app start (`packLoader.js:23-26`). The mismatch is logged
    server-side only (`socketServer.js:139-148`). The self-heal is T5 of
    Block 2 — designed, ratified, **not built**
    (`2026-09-04-phase3-c2c3-resolution-dormancy.md:349-355`;
    `2026-09-12-block2-hardening-plan.md:284`).
12. **The web Player Scanner reads the NESTED pin.** `./data/tokens.json`
    (`aln-memory-scanner/js/app.js:64`) is the `aln-memory-scanner/data`
    submodule, today at `15d8d2e` on `feature/dry-scoring-config` —
    already behind. Thursday's sync does not touch it, and handoff rule 4
    defers the PWA deploy to final cutover. **The web player scanner will
    show stale token JSON** (its images, served from
    `backend/public/player-scanner → aln-memory-scanner`, will be
    current). Decide deliberately whether to bump that pin.
13. **The ESP32 token-DB ceiling is 50,000 bytes** (`config.h:90`) and
    today's `/api/tokens` payload is ~34.2 KB. A large content drop can
    cross it, at which point every device logs `Token DB too large` and
    keeps its cached database (`TokenService.h:223-228`) — a failure that
    looks like "the new tokens just didn't show up". Check
    `curl -sk https://localhost:3000/api/tokens | wc -c` after the sync.

---

