# Capability Vocabulary (shared draft)

**Date:** 2026-06-11 (Phase 2.x.1 deliverable; co-designed seed for the
Phase 3.1 installation-profile schema)
**Consumers:** (1) E2E harness manifest (`tests/e2e/helpers/capabilities.js`),
(2) Phase 3 venue preflight / planning view, (3) installation-profile schema.
One vocabulary, three consumers — per the kit-model decision
(docs/decisions/2026-06-11-kit-model-install-tiers.md).

## Two layers (stack vs endpoints)

| Layer | Meaning | Absence means |
|---|---|---|
| **Stack** | a service of the orchestrator stack is reachable/operable | FAULT in production; "tool not installed" on test machines |
| **Endpoint** | a physical output/input is installed for this event | DORMANT by configuration (a tier characteristic, never a fault) |

## Stack capability keys (v1)

Aligned 1:1 with `serviceHealthRegistry` ids — these are probeable today:

| Key | Service | Probe substrate |
|---|---|---|
| `vlc` | video playback | D-Bus MPRIS reachability |
| `music` | MPD playback | mpd socket ping |
| `sound` | pw-play effects | pw-play/pipewire presence |
| `audio` | PipeWire routing | pactl reachability |
| `bluetooth` | BT speaker mgmt | bluetoothctl/BlueZ |
| `lighting` | Home Assistant | HA API reachability |
| `gameclock`, `cueengine` | in-process | always healthy when orchestrator runs (listed for registry completeness; not environment-variable) |

`orchestrator` itself is the layer-0 switch (its absence = the
scanners-only install tier); web/test consumers observe it implicitly by
whether the API answers.

## Endpoint capability keys (v1 draft — Phase 3.1 finalizes)

Not yet probeable as first-class objects; the installation profile will
declare them and preflight will verify:

| Key (draft) | Examples | Notes |
|---|---|---|
| `display.*` | TV/projector outputs | today implicit in vlc/scoreboard |
| `audio.sink.*` | HDMI, named BT speakers, wired | today: pactl sink list |
| `lighting.fixture.*` | HA entities / WLED instruments | bound to pack ROLES (B8) |
| `station.*` | ESP32 scanners (count, optional entity binding) | kit-count dial; scarcity is a design lever |
| `device-class affordances` | coarse-tap, text-entry, list-select, rich-display | engine-design-notes P5; constrains function assignment |

## Harness scope honesty

Test machines can be PARTIAL-STACK (no cvlc binary) in ways production
never is — the harness manifest models test environments and is therefore
a superset-varying profile over the same keys, not an install-tier
simulator. Only endpoint absence realistically simulates a production
tier. (Recorded in the kit-model decision; restated here because this doc
is the vocabulary's home.)

## Rules of use (harness)

- Primary-path tests: `requireCapabilities(test, caps, [...])` — loud
  skip listing what's missing. Never a silent environment branch.
- Designed-degradation tests: `requireDegraded(test, caps, [...])` —
  named tests that RUN where something is down (fault coverage a healthy
  Pi can't exercise).
- The run report prints the manifest so "all green" always discloses
  what was actually probed.
