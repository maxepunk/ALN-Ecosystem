# Phase 3.1 — Installation-Profile Schema (C1)

**Date:** 2026-07-09
**Status:** DRAFT for owner review (deliverable 2 of the Phase 3.0 program
§10). Companion to the pack schemas
(docs/plans/2026-06-13-phase3-1-pack-schemas.md).
**Inputs:** kit-model decision (+stack/endpoints), capability vocabulary
(docs/proposals/2026-06-11-capability-vocabulary.md), B7/B8 (routing/
ducking = venue; lighting roles → instruments), F-TOOL-12 (versioned,
kinded profiles), kit-network posture decision (2026-07-09), preset-split
assessment (configtool-scripts review).

## 0. What an installation profile IS

**This event's slice of the kit.** The pack says what the GAME needs
(pack-manifest `hardware`); the installation profile says what is
INSTALLED tonight and how the pack's abstract names bind to physical
things. One resolution mechanism (C2) evaluates pack × profile → each
game element **runs / degrades / unavailable** — surfaced as the planning
view (before packing the van), the preflight (go/no-go before doors), and
the E2E harness manifest (same vocabulary, test profiles).

It REPLACES the config-tool preset system for venue concerns: versioned,
kinded, validated — and no longer pretending to capture game content.

## 1. Draft schema (annotated example — ALN full-kit install)

```jsonc
{
  "kind": "installation-profile",
  "schemaVersion": 1,
  "profileId": "vfw-hall-full-rig",
  "label": "VFW Hall — full kit",
  "version": 3,                            // bumped on every save (F-TOOL-12)
  "forPack": "about-last-night",           // optional pin; tooling warns on mismatch

  // ── Network posture (2026-07-09 decision) ──────────────────────────
  "network": {
    "mode": "kit-network",                 // kit-network (standard) | venue-wifi (fallback)
    "kitNetwork": {
      "ssid": "ALN-GAME",
      "orchestratorIp": "10.11.0.2",       // reserved on the kit router — set once, never varies
      "orchestratorName": "play.aboutlastnightgame.com",
      "localDnsOverride": true             // kit router answers for the name; offline-capable
    }
    // venue-wifi variant: { "dynamicDnsUpdate": true, "ttl": 60 } —
    // preflight adds a rebind-protection check (resolve the name FROM a
    // client on the venue LAN and require the private answer to survive)
  },

  // ── Layer 0: orchestrator present? ─────────────────────────────────
  // The stack is ONE switch (kit-model decision): orchestrator present ⇒
  // the whole service stack is expected live; absence of any stack
  // service is then a FAULT, never a tier characteristic.
  "orchestrator": true,                    // false = scanners-only tier zero

  // ── Endpoints: the dials (absence = DORMANT by configuration) ──────
  "endpoints": {
    "display.main":   { "installed": true, "output": "hdmi-0" },
    "audio.sinks": [
      { "id": "hdmi",        "installed": true },
      { "id": "bt-mainhall", "installed": true, "btAddress": "AA:BB:CC:DD:EE:FF", "label": "Main hall speaker" }
    ],
    "lighting.instruments": { "installed": true, "provider": "home-assistant" },
    "stations":  { "count": 3 },           // ESP32 scanners in tonight's kit
    "personal":  { "expected": true }      // player phones in play (Phase 4 Track E)
  },

  // ── B8: pack lighting roles → venue instruments ────────────────────
  // Keys must be ⊆ game.json lightingRoles; UNBOUND roles are flagged by
  // the planning view and preflight; at runtime an unbound role's cue
  // command is DISABLED at session start (C3 — never held-forever).
  "bindings": {
    "lighting": {
      "preshow":  { "ha": "scene.preshow_warm" },
      "reveal":   { "ha": "scene.reveal_strobe" },
      "blackout": { "ha": "scene.all_off" },
      "finale":   { "ha": "scene.finale_gold" }
    }
  },

  // ── B7: venue audio config (stays venue, never pack) ───────────────
  "audio": {
    "routes":  { "video": "hdmi", "music": "bt-mainhall", "sound": "hdmi" },
    "ducking": [
      { "when": "video", "duck": "music", "to": 20 },
      { "when": "sound", "duck": "music", "to": 40 }
    ]
  },

  // ── Venue env slice (the .env keys that are venue-owned) ───────────
  // Replaces the preset bundle's whole-env capture: ONLY venue keys
  // (network/infra); game-scoped keys (session duration etc.) moved to
  // game.json (B11). Key ownership map seeds from infra.js ENV_GROUPS.
  "env": {
    "HOME_ASSISTANT_URL": "http://localhost:8123",
    "VIDEO_DIR": null                       // null = default
  }
}
```

## 2. Resolution (C2 contract, summarized)

`resolve(packManifest.hardware, profile) → per-element status`:

| Pack requirement | Profile state | Result |
|---|---|---|
| stack service used by content | orchestrator: true | expected LIVE — absence at preflight/runtime = **FAULT** |
| anything | orchestrator: false | tier zero: standalone-capable elements only; all orchestrator features **unavailable (by design)** |
| endpoint `onAbsent: degrade` | not installed | **DORMANT**: dependent cues/surfaces disabled at session start (C3), dashboard shows "not installed tonight" |
| endpoint `onAbsent: require` | not installed | preflight **NO-GO** |
| lighting role | unbound | planning view + preflight flag; runtime = disabled cue commands |
| deviceClass min | count below min | preflight **NO-GO** (e.g. staffed ≥ 1 for ALN) |

Same function, three faces: planning view (tool, hypothetical profiles),
preflight (tool + validateCommand extension, tonight's profile), harness
(capabilities.js — already speaking this vocabulary).

## 3. Preflight checklist derivation (what the one button runs)

1. Stack: every service healthy (existing registry + service:check).
2. Network: per posture — kit-network: router reachable, local DNS answers
   `orchestratorName` with `orchestratorIp`; venue-wifi: A record matches
   current IP, client-side resolve survives rebind protection.
3. Certificate: valid ≥ N days remaining (warn at 14).
4. Bindings: every pack lighting role bound AND each bound HA scene exists
   (live-fetched).
5. Pack references resolvable: sounds/videos/scenes via validateCommand
   sweep; every consumer reports the ACTIVE pack version/hash (A2
   staleness — catches stale scanner dist).
6. Devices: staffed count ≥ pack min; stations synced (asset manifest
   current); audio sinks present (named BT speakers connected).

Output: go/no-go checklist, each line traceable to a profile or manifest
field.

## 4. v1 / headroom

| Area | v1 implements | Headroom |
|---|---|---|
| network | kit-network checks; posture field | venue-wifi dynamic-DNS updater + rebind probe (E2 build) |
| endpoints | display/audio/lighting/stations as above | WLED-direct provider; multi-display |
| resolution | preflight + harness faces | planning view UI (Track B page) |
| bindings | lighting roles → HA scenes | per-role WLED presets; audio "roles" if a pack ever needs them |
| env slice | key allowlist from infra.js groups | per-key validation schema |

## 5. Storage & tooling

- Lives in the config-tool profile store (B0.1), NOT in the pack; kinded +
  versioned; export/import as single JSON.
- Legacy presets: importable one-time as `legacy-snapshot` (owner decision
  pending from the pre-read, §8.2 there); no new presets after cutover.

## 6. Open points for owner review

1. Kit router: is a specific travel router model already owned/chosen, or
   should the E2 work include selecting one? (Affects whether `kitNetwork`
   needs router-API fields for automated checks vs manual checklist items.)
2. `stations.count` as a plain dial (no per-station identity) for v1 —
   entity-BINDING of stations (P3) would add per-station entries when a
   game uses it. OK to defer per-station identity to that game?
3. The venue env-key allowlist: I'll derive it from infra.js ENV_GROUPS
   and mark game-scoped keys for migration to game.json (B11) — flag any
   keys you consider venue-owned that I might classify as game-owned
   (candidate: `SESSION_TIMEOUT` → moving to game.json gameClock.duration).
