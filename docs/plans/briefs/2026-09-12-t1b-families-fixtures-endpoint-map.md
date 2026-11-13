# T1b brief — equipment families, fixtures, endpoint map (Block 2, stage CS.2)

Read this file first. It is your single source of requirements; the exact
values in it are used verbatim. Vocabulary is defined in `CONTEXT.md`: §2
(engine ↔ pack contract), §4 (dormant vs fault), §5 (endpoints vs stack,
environment ladder, witness lights). Use those words as defined there.

Authority behind this brief: `docs/plans/2026-09-12-block2-hardening-plan.md`
§3 pin P1 (quoted in full below) and §4 "T1b"; the ratified spec
`docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md` §8 and §5
row M6+S1 (the profile's endpoints interior is C1 §1 verbatim; C1 is
`docs/plans/2026-07-09-phase3-1-installation-profile.md` §1).

## Where you work

Work in `/home/user/ALN-Ecosystem/` on the branch `claude/nice-curie-hescfv-t1b`,
which is already checked out. The ALN pack is the SUBMODULE at
`/home/user/ALN-Ecosystem/ALN-TokenData/`. (The top-level directories
`/home/user/ALN-TokenData` and `/home/user/ALNScanner` are stale clones; they
are never read or written.) Node dependencies are installed; the rung-1 rig
arms (session bus, Xvfb, PipeWire null sinks, witness Home Assistant,
Bluetooth mock) are up under `/tmp/rung1`; Playwright's Chromium is at
`/opt/pw-browsers/chromium`. Commit on the task branch. The orchestrator
pushes after review; you push nothing.

Model: Sonnet (plan §4). You dispatch no subagents; review comes from the
orchestrator after your report.

## Goal

The installation profile's equipment interior becomes the ratified C1 §1
shape, both packs declare the equipment families their content uses, a pure
module maps each family to the services that exist only to drive it,
fixtures for "dormant" and "require" exist, and two more Tier L legs run in
CI. Engine behavior does not change in this task: no production code calls
`resolve()` or `collectPackNeeds()` today (`grep -rn "gameRules/resolution\|gameRules/packNeeds" backend/src backend/scripts` returns nothing), and this task does not wire them. T1a consumes what you build.

## The pin you implement (plan §3 P1, verbatim)

> **P1. Equipment families → dormant services (refinement of M6's open
> interior, SB-2 ★).** The profile's `endpoints` interior is C1 §1
> verbatim: `display.main {installed, output?}`, `audio.sinks:
> [{id, installed, btAddress?, label?}]`, `lighting.instruments
> {installed, provider}`, `stations {count}`, `personal {expected}`.
> Dormancy keys on a family the pack MANIFEST declares as a need
> (`hardware.endpoints.<family>`) that the profile omits or declares
> `installed: false`. The pure module `gameRules/endpointServices.js`
> owns the map: `display.main → vlc, display`; `lighting.instruments →
> lighting`; `audio.sinks` (declared, none installed) → `sound, music`;
> `audio` dormant only when no sink AND no `display.main` (an installed
> display implies the HDMI sink). The Bluetooth service is the adapter,
> a capability: never profile-dormant. `stations` and `personal` map
> to no service. `hardware.stack.<svc>.onAbsent` is read for row
> severity only; a down stack service is a fault with verbs (C1 §2
> row 1) and never blocks a start. The simulation generator declares
> every family the manifest names, so rung 1 is never dormant.

Two orchestrator rulings refine P1 for this task (plan §9, rulings 2 and 3):

- **Stand-in markers.** The pinned interior has no `provider` field on
  `display.main`, so the simulation generator can no longer write
  `{provider: 'rung1-harness'}`. The generator emits the pinned interior
  with stand-in VALUES instead: `display.main.output = "rung1-xvfb"`,
  sink ids `rung1_hdmi` and `rung1_bt` (the null sinks the rig creates —
  see `backend/tests/rung1/provision.js` `ensurePipewire`),
  `lighting.instruments.provider = "home-assistant"`. The provisioning
  gate `harnessProvides()` in `provision.js` recognizes a harness stand-in
  by those markers: a `display.main.output` beginning `rung1-` or any
  `audio.sinks[].id` beginning `rung1_`. Its witness-scene and `-sim.`
  checks stay as they are. The `provider === 'rung1-harness'` clause is
  replaced by the marker check.
- **The dormant profile keeps its bindings.** `toy-dormant-lighting.json`
  is `toy-test-rig.json` with `lighting.instruments` removed from
  `endpoints` and nothing else changed (new `profileId` and `label`).
  Bindings under an absent family are ignored with a warning from T1a on
  (plan P2); in this task they are inert data.

## Deliverables

Each item ends with the check that proves it. Tests come first and are
seen to fail before the code that makes them pass (TDD); your report
carries the RED and GREEN output for every new test file.

### D1. Profile schema pins the endpoints interior

File: `backend/config/profiles/installation-profile.schema.json`. Replace
the open `endpoints` object with this interior. Every object has
`additionalProperties: false`.

| family | shape |
|---|---|
| `display.main` | object; required `installed` (boolean); optional `output` (string, minLength 1) |
| `audio.sinks` | array of objects; each required `id` (string, pattern `^[A-Za-z0-9][A-Za-z0-9_.:-]*$`), `installed` (boolean); optional `btAddress` (string, pattern `^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$`), `label` (string, minLength 1) |
| `lighting.instruments` | object; required `installed` (boolean); optional `provider` (string, minLength 1) |
| `stations` | object; required `count` (integer, minimum 0) |
| `personal` | object; required `expected` (boolean) |

Update the `endpoints` description to say the interior is pinned by C2
(this task) and name the five families. Keep the schema's `$schema` draft
(2020-12) and the AJV class the contract test already uses.

Tests, red first, in `backend/tests/contract/profile/installation-profile-schema.test.js`
(the existing suite; follow its style — the C1 example fixture there must
stay green): an unknown family key is refused; `installed: "yes"` is
refused; a sink without `id` is refused; a sink `btAddress` that is not
six hex pairs is refused; every profile under `backend/config/profiles/*.json`
and `backend/tests/e2e/fixtures/profiles/*.json` validates (iterate the
directories; the test names each file).

### D2. The ALN profile declares every family and its network

File: `backend/config/profiles/aln-full-kit.json`. Add, keeping the
existing keys unchanged:

```json
"network": {
  "mode": "kit-network",
  "kitNetwork": {
    "ssid": "aboutlastnetwork",
    "orchestratorIp": "192.168.0.191",
    "localDnsOverride": true
  }
},
"endpoints": {
  "display.main": { "installed": true, "output": "hdmi-0" },
  "audio.sinks": [ ...one entry per route target named in backend/config/environment/routing.json, id = that target name, installed: true... ],
  "lighting.instruments": { "installed": true, "provider": "home-assistant" },
  "stations": { "count": 3 },
  "personal": { "expected": false }
}
```

`orchestratorName` is deliberately absent (the owner has not stated the
kit's DNS name). For `audio.sinks`, read `backend/config/environment/routing.json`
and declare one sink per distinct route target it names, in the order
they appear; if that file names none, declare `[{ "id": "hdmi", "installed": true }]`
and say so in your report. `stations.count` is the pack manifest's
`station.recommended` (3); the owner corrects it at Stage B.

Check: the file validates under D1's schema (covered by D1's iteration
test) and `dormantServicesFor(alnManifest, alnFullKit)` (D6) returns `{}`.

### D3. The ALN pack manifest declares its families (submodule)

File: `/home/user/ALN-Ecosystem/ALN-TokenData/pack-manifest.json`. In
`hardware.endpoints`, beside the existing `display.main`, add:

```json
"audio.sinks": { "usedBy": "cue sound effects, music, video audio", "onAbsent": "degrade" },
"lighting.instruments": { "usedBy": "lighting cues", "onAbsent": "degrade" }
```

Then rebuild: `node backend/scripts/build-pack-manifest.js ALN-TokenData`
(run from `/home/user/ALN-Ecosystem`). The `contentHash` changes. In the
submodule: `git checkout -b claude/nice-curie-hescfv` from its current
HEAD, commit the manifest with the message
`pack: declare audio.sinks and lighting.instruments equipment families (Block 2 T1b)`.
In the parent, stage the moved pin (`git add ALN-TokenData`) in your task
commit.

Check: `git -C ALN-TokenData status --porcelain` is empty on that branch;
`git diff --cached --submodule` in the parent shows the pin moving to your
submodule commit; the backend contract tests that verify manifest
freshness pass (`tests/contract/http/pack.test.js`,
`tests/contract/pack/pack-schemas.test.js`).

### D4. The toy pack declares its families and gains two cues

Directory: `backend/tests/e2e/fixtures/packs/toy-heist/`.

`pack-manifest.json` `hardware.endpoints` (currently `{}`) becomes:

```json
"lighting.instruments": { "usedBy": "lighting cues (role-addressed)", "onAbsent": "degrade" },
"audio.sinks": { "usedBy": "cue sound effects", "onAbsent": "degrade" }
```

`cues.json` gains two cues after the existing two (ids are new; roles
are the two the toy `game.json` already declares; the sound file is the
one the existing `heist-sting` cue already uses):

```json
{ "id": "all-clear-chime", "label": "All Clear Chime", "icon": "sound", "quickFire": true,
  "commands": [
    { "action": "sound:play", "payload": { "file": "attention.wav" } },
    { "action": "lighting:scene:activate", "payload": { "role": "all-clear" } }
  ] },
{ "id": "vault-sequence", "label": "Vault Sequence", "icon": "alert", "quickFire": true,
  "timeline": [
    { "at": 0, "action": "sound:play", "payload": { "file": "attention.wav" } },
    { "at": 1, "action": "lighting:scene:activate", "payload": { "role": "vault-alarm" } }
  ],
  "duration": 3 }
```

Match both cues to `ALN-TokenData/cues.schema.json` (it is the authoring
half of the cue contract; adjust field names to what it requires and say
so in the report if a field above is not what the schema wants). Rebuild
the manifest: `node backend/scripts/build-pack-manifest.js backend/tests/e2e/fixtures/packs/toy-heist`.

Check: the pack passes the activation gate — prove it with the existing
contract test that loads fixture packs if one covers the toy pack, else
with a boot: `cd backend && PACK_PATH=tests/e2e/fixtures/packs/toy-heist ENABLE_VIDEO_PLAYBACK=false ENABLE_MUSIC_PLAYBACK=false node -e "require('./src/services/packService').activatePack(); console.log('activated')"` (adapt to the real activation entry point — read `packService.js` — and paste the command and its output). Grep the E2E flows and unit tests for `vault-alarm-hit`, `heist-sting`, and any literal cue COUNT for the toy pack; a test that counted cues by number gets its expectation updated to 4, and the report names it.

### D5. The require fixture pack

Directory: `backend/tests/e2e/fixtures/packs/toy-heist-require/` — a copy
of the toy pack AFTER D4, with exactly one difference in
`pack-manifest.json`: `hardware.endpoints["lighting.instruments"].onAbsent`
is `"require"`. Rebuild its manifest with the builder. `packId` stays
`midnight-heist` and `version` stays as it is; the pack's identity is its
`contentHash` (plan §9 ruling 4). Leave `KNOWN_PACK_DIRS` in
`backend/tests/e2e/setup/session-env.js` unchanged.

Check: `diff -r` between the two packs shows only the manifest
(`onAbsent` line and `contentHash`); the schema contract test that
validates fixture manifests passes.

### D6. The endpoint map (pure module)

File: `backend/src/gameRules/endpointServices.js` (new; pure — no I/O,
no requires from `services/`). Exports:

- `ENDPOINT_FAMILIES` = `['display.main', 'audio.sinks', 'lighting.instruments', 'stations', 'personal']` (frozen).
- `servicesForFamily(familyId)` → `display.main` → `['vlc', 'display']`; `lighting.instruments` → `['lighting']`; `audio.sinks` → `['sound', 'music']`; `stations` and `personal` → `[]`; any other id → throws `Error("unknown equipment family '<id>'")`.
- `dormantServicesFor(manifest, profile)` → `{ [serviceId]: { reason } }`. Inputs: the pack manifest object (reads `hardware.endpoints`, absent → `{}`) and the profile object (reads `endpoints`, absent → `{}`). For each family the manifest names: the family is UNINSTALLED when the profile omits it, or (objects) declares `installed: false`, or (`audio.sinks`) has no entry with `installed: true`. An uninstalled family marks every service from `servicesForFamily` dormant with `reason` = `"'<family>' not installed tonight"`. Additionally `audio` is dormant, reason `"no audio sink installed tonight and no display"`, when the manifest names `audio.sinks`, none is installed, AND `display.main` is uninstalled in the profile (absent or `installed: false`). `bluetooth` never appears. A family the manifest names that is not in `ENDPOINT_FAMILIES` throws (the schema also refuses it; failing loudly here keeps the map honest).

Tests, red first, `backend/tests/unit/gameRules/endpointServices.test.js`,
loading the real files: `(ALN manifest, aln-full-kit.json)` → `{}`;
`(toy manifest, toy-test-rig.json)` → `{}`; `(toy manifest, toy-dormant-lighting.json)`
→ exactly `{ lighting: {...} }`; a profile declaring `audio.sinks` with
none installed and `display.main` installed → exactly `sound` and `music`;
the same with `display.main` absent → `sound`, `music`, `audio`;
`installed: false` on `lighting.instruments` behaves as absent; the
result never contains `bluetooth` in any case; `stations` and `personal`
uninstalled add nothing; a manifest without `hardware.endpoints` → `{}`;
an unknown family throws.

### D7. Profiles for the rig and the fixtures; the generator

- `backend/tests/e2e/fixtures/profiles/toy-test-rig.json` gains
  `"endpoints": { "lighting.instruments": { "installed": true, "provider": "home-assistant" }, "audio.sinks": [ { "id": "rung1_hdmi", "installed": true }, { "id": "rung1_bt", "installed": true } ] }`.
- New `backend/tests/e2e/fixtures/profiles/toy-dormant-lighting.json`:
  the same file with `profileId` `toy-dormant-lighting`, `label`
  `Toy heist — test rig, lighting not installed`, and `endpoints` without
  `lighting.instruments`. Bindings unchanged.
- `backend/scripts/lib/simulationProfile.js`: for each `endpoint` need,
  emit the pinned interior with the stand-in markers from the ruling
  above (`display.main` → `{ installed: true, output: 'rung1-xvfb' }`;
  `audio.sinks` → the two `rung1_*` sinks installed; `lighting.instruments`
  → `{ installed: true, provider: 'home-assistant' }`; `stations` →
  `{ count: <manifest station recommended, else min, else 0> }`; `personal`
  → `{ expected: false }`); an unknown family throws. The generator takes
  the manifest's `hardware` as a third argument if it needs the station
  count — keep the two existing call sites working (grep for
  `generateSimulationProfile(`).
- `backend/tests/rung1/provision.js` `harnessProvides`: the marker check
  from the ruling replaces the `provider === 'rung1-harness'` clause.

Tests, red first: `backend/tests/unit/rung1/provision.test.js` (update
the simulation-shape fixture; add: output `rung1-xvfb` alone gates true;
a `rung1_` sink alone gates true; a real-venue profile with `hdmi-0` and
`hdmi` sinks and no witness bindings gates false); a generator test
(`backend/tests/unit/scripts/simulationProfile.test.js` — create it if no
generator test exists; check first) proving the generated profile for
BOTH packs validates against D1's schema with AJV and that
`dormantServicesFor(manifest, generated)` is `{}` for both.

### D8. Two more Tier L legs

File: `.github/workflows/test.yml`, job `backend-e2e-tier-l`. Replace the
`matrix.pack` list with `include` entries carrying `leg`, `pack`, and
`profile`:

| leg | pack (E2E_PACK_PATH) | profile (E2E_PROFILE_PATH) |
|---|---|---|
| `production` | `` (empty = ALN-TokenData) | `` (empty = generated simulation profile) |
| `toy-heist` | `tests/e2e/fixtures/packs/toy-heist` | `` |
| `toy-dormant-lighting` | `tests/e2e/fixtures/packs/toy-heist` | `tests/e2e/fixtures/profiles/toy-dormant-lighting.json` |
| `toy-require-dormant` | `tests/e2e/fixtures/packs/toy-heist-require` | `tests/e2e/fixtures/profiles/toy-dormant-lighting.json` |

The job name becomes `Backend E2E Tier L (${{ matrix.leg }})`; the
artifact name uses `matrix.leg`; `E2E_PROFILE_PATH` is set from
`matrix.profile` (an empty value behaves as unset — verify in
`backend/tests/e2e/setup/session-env.js` and `test-server.js`, which read
it with `|| null`). `fail-fast: false` stays. The Test Summary job is
unchanged. Check: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/test.yml'))"` exits 0 and the job has four legs.

### D9. Proof runs

From `backend/`, in this order, pasting each command and its summary
line into the report:

1. `npm test -- --coverage` (unit + contract, once, after all code is in).
2. `npm run coverage:check`.
3. `npm run lint`.
4. The four Tier L legs locally, each with its own command, e.g.
   `E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist E2E_PROFILE_PATH=tests/e2e/fixtures/profiles/toy-dormant-lighting.json npm run test:e2e:tier-l`.
   You run as root, and VLC refuses to run as root, so video flows will
   skip loudly through the capability gate; that is expected here and
   the report lists every skipped test with the reason the reporter
   printed. Zero failures is the bar. A failure caused by your change is
   yours to fix; a failure you can show is unrelated to your change
   (reproduces identically on the task branch's base commit
   `a9c42ff`) is reported with that evidence, not fixed.

## Guardrails

Edit only the files this brief names, plus the tests it names and any
test whose literal cue count D4 changes. Existing tests keep their
assertions; if one blocks you, report it (status DONE_WITH_CONCERNS or
BLOCKED) instead of weakening it. When a value you need is not in this
brief or the files it points at, stop and ask (NEEDS_CONTEXT) rather than
invent one. Winston logger, never `console.log`, in `src/`.

## Completion criterion

Done means all of these are true and evidenced in the report: every new
test file went red then green; both manifests rebuilt (new
`contentHash`) and the freshness tests green; the four profiles validate
under the pinned schema; `dormantServicesFor` returns the exact sets
listed in D6; `harnessProvides` gates true for both generated profiles;
the workflow parses with four legs; `npm test`, the ratchet, and lint are
green; the four Tier L legs ran locally with zero failures and every skip
listed with its reason; one submodule commit on `claude/nice-curie-hescfv`
in ALN-TokenData; parent commits on `claude/nice-curie-hescfv-t1b` with
the pin moved; nothing pushed.

## Report

Write the full report to
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/t1b-report.md`
with these sections: Status; Commits (parent and submodule, short SHA +
subject); TDD evidence per new test file (RED command + failing lines;
GREEN command + summary line); Proof runs (the D9 commands with summary
lines, and a table of the four legs: passed / skipped with reasons /
failed / duration); Files changed; Deviations from this brief (each with
the reason); Concerns. Then reply with at most 15 lines: status
(DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT), the commits, a
one-line test summary, concerns, and the report path.
