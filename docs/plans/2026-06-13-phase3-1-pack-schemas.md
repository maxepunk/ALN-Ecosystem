# Phase 3.1 — Pack Schema Drafts: game.json + pack-manifest

**Date:** 2026-06-13
**Status:** DRAFT for owner review (deliverable 1 of the Phase 3.0 program
doc §10). Proposes resolutions for O1 (entity/attribution model) and O2
(device-class registry + function assignment) — flagged inline.
**Inputs:** Tier A (A1-A7), Tier B (B1-B12), engine notes P1-P8,
kit-model decision, capability vocabulary, tokens.schema.json v1.
**Companions (next deliverables):** installation-profile schema (C1),
standalone-pack-loading design (§6.1), one-auth design (O3).

## 0. Design rules applied throughout

1. **ALN-v1 implementable subset, named variants behind seams** (Tier B
   synthesis note): every block lists `v1:` (what the engine implements in
   Phase 3) and `headroom:` (schema-expressed variants implemented when a
   game needs them; the Phase 4 toy pack exercises ONE non-ALN variant per
   area).
2. **game.json = rules; pack-manifest = inventory + requirements.** Rules
   answer "how does this game score/flow"; the manifest answers "what is
   IN this pack and what must a venue install provide".
3. **Wire compatibility is explicit:** where the schema renames a concept
   (entity vs team), the wire keeps the old field in Phase 3 with the
   mapping documented — contract migrations are their own coordinated
   changes, never schema side effects.

---

## 1. game.json (draft schema, shown as annotated example)

ALN expressed as the first pack. JSON5-style comments are annotation only;
the real file is plain JSON validated by `game.schema.json` (to be written
from this draft after review).

```jsonc
{
  "kind": "game",
  "schemaVersion": 1,
  "id": "about-last-night",
  "title": "About Last Night",

  // ── B1: modes are game-defined ─────────────────────────────────────
  // detective/blackmarket stop being engine vocabulary. Wire `mode` field
  // stays a string, validated at runtime against this list.
  "modes": [
    {
      "id": "blackmarket",
      "label": "Black Market",
      "verb": "Sell",                       // strings used by scanners/report
      "scoringPolicy": "standard",          // v1 enum: standard | none (B2)
      "countsTowardGroups": true,           // A1: only these modes complete groups
      "displayBehavior": {                  // B5: what an accepted tx shows where
        "surface": "scoreboard-rankings",
        "when": "immediate"
      }
    },
    {
      "id": "detective",
      "label": "Detective",
      "verb": "Expose",
      "scoringPolicy": "none",
      "countsTowardGroups": false,
      "displayBehavior": {
        "surface": "scoreboard-evidence",
        "fields": ["summary", "owner"],
        "when": "immediate"
      }
    }
  ],

  // ── B2/B6: scoring tables + numeric semantics ──────────────────────
  // Absorbs ALN-TokenData/scoring-config.json (migration: loader reads
  // game.json first, falls back to scoring-config.json until cutover).
  "scoring": {
    "baseValues": { "1": 10000, "2": 25000, "3": 50000, "4": 75000, "5": 150000 },
    "typeMultipliers": { "Personal": 1, "Mention": 3, "Business": 3, "Party": 5, "Technical": 5, "UNKNOWN": 0 },
    "display": { "unit": "currency-usd", "format": "$#,###" },   // B6: $ leaves the engine
    "semantics": { "allowNegative": true }                        // admin adjustments may go below 0
  },

  // ── B3 + A1: group/collection rules ────────────────────────────────
  "groupRules": {
    "type": "all",                          // v1: all | headroom: threshold, ordered
    "minSize": 2,                           // groups below this never complete (A1/F-SCAN-09)
    "completion": {
      "bonusFormula": "multiplier-minus-one-times-base"  // v1: the only formula
    }
  },

  // ── A2: token claim policy ─────────────────────────────────────────
  "duplicatePolicy": {
    "claim": "once",                        // v1: once (FCFS, session-scoped, all transacting modes)
                                            // headroom: per-entity | unlimited
    "view": "unlimited"                     // content viewing never consumes (engine invariant today;
                                            // expressed here so a pack COULD constrain it later)
  },

  // ── O1 PROPOSAL (P1): the scoring entity model ─────────────────────
  // The engine's score-holder is an abstract LEDGER. The pack names it,
  // sets creation policy, and decides whether membership is tracked.
  // WIRE NOTE: the wire field stays `teamId` in Phase 3 (alias of
  // entityId); renaming the wire is a separate coordinated contract change.
  "entities": {
    "label": { "singular": "Account", "plural": "Accounts" },   // ALN fiction: shell accounts
    "creation": "freeform-at-action",       // v1: freeform-at-action (any non-empty string, GM-typed)
                                            // headroom: pre-registered | both
    "membership": "untracked"               // v1: untracked (P1: no roster required)
                                            // headroom: roster (B4 follow-up elicitation)
  },

  // ── O1 PROPOSAL (P2): attribution — separate axis from the ledger ──
  // Who gets NARRATIVE credit, distinct from which ledger scores. Feeds
  // the B9 report bundle, never the score math.
  "attribution": {
    "default": { "id": "nova", "label": "Nova", "kind": "npc" },  // anonymous-by-default via NPC
    "optIn": {
      "enabled": true,
      "kind": "character"                   // credit claimable by character identity
    }
    // v1 implementable subset: the DEFAULT is engine-applied to every
    // transaction's attribution field; opt-in credit is captured via the
    // Track D report intake (no in-flow UI yet). The schema is the
    // contract; the capture surface grows in Phase 4 (Track E).
  },

  // ── O2 PROPOSAL (P4): function assignment table ────────────────────
  // Functions are the engine's fixed vocabulary; packs assign them to
  // device classes (registry in §3). Assignments are validated against
  // class AFFORDANCES (P5) at design time, and against the AUTH FLOOR
  // (O3, design pending — floor candidates marked).
  "functions": {
    "view-content":       { "classes": ["personal", "station", "staffed"] },
    "transact":           { "classes": ["staffed"], "modes": ["blackmarket", "detective"] },
    "entity-binding":     { "classes": [] },          // ALN: stations unbound
    "session-lifecycle":  { "classes": ["staffed"] }, // O3 floor candidate
    "show-control":       { "classes": ["staffed"] }, // O3 floor candidate
    "score-intervention": { "classes": ["staffed"] }, // O3 floor candidate
    "report-intake":      { "classes": ["staffed"] }
  },

  // ── B11: game clock + phases ───────────────────────────────────────
  "gameClock": {
    "duration": 7200,                       // seconds (out of env config)
    "overtimeAt": 7200,                     // gameclock:overtime threshold
    "phases": [                             // ALN = degenerate single phase
      { "id": "main", "label": "Game", "start": { "at": 0 } }
    ]
    // headroom: phases with {start: {trigger: "<event>"}}; phase:changed
    // becomes a cue trigger event (B11)
  },

  // ── B8: lighting role vocabulary ───────────────────────────────────
  // Cues reference these names; the installation profile (C1) binds them
  // to HA scenes / WLED instruments. Declared here so tooling can validate
  // cues.json and flag UNBOUND roles at preflight.
  "lightingRoles": ["preshow", "reveal", "blackout", "finale"],

  // ── A3 slices: catalog file refs (filled as slices land) ───────────
  "strings": "strings.json",                // window titles, mode labels, verbs, emoji...
  "theme": "theme.json",                    // colors, branding, scoreboard look, BMP theme
  "cues": "cues.json",                      // existing format + role refs (B8)

  // ── B12: display surfaces ──────────────────────────────────────────
  "surfaces": {
    "idleLoop": { "video": "idle-loop.mp4" },
    "scoreboard": { "contentTypes": ["rankings", "evidence-board"] }
    // headroom: pack-defined additional surfaces
  },

  // ── B9: report ─────────────────────────────────────────────────────
  // Bundle SCHEMA is engine-versioned (not pack); the pack supplies the
  // themed rendering. ALN's template stays byte-compatible with today's
  // markdown (golden master) until the GenAI pipeline migrates.
  "report": {
    "template": "templates/session-report.md.hbs"
  }
}
```

### v1 / headroom summary (the honesty table)

| Block | v1 implements | Headroom in schema only |
|---|---|---|
| modes | ALN's two; runtime validation replaces Joi enum | 1 or 3+ modes; scoringPolicy variants |
| scoring | tables + display + allowNegative | non-monetary units beyond formatting |
| groupRules | `all` + minSize 2 | `threshold`, `ordered` (+ `group:completed` progress field, B3 contract review) |
| duplicatePolicy | `claim: once` | per-entity, unlimited |
| entities | freeform-at-action, untracked | pre-registered, roster (B4 elicitation pending) |
| attribution | engine-applied default; intake via Track D | in-flow opt-in UI (Phase 4 / Track E) |
| functions | ALN assignment enforced server-side (= today's behavior, now data) | non-ALN assignments (toy pack exercises ONE: e.g. station view+transact bound) |
| gameClock | duration + overtimeAt + single phase | multi-phase, trigger-driven starts |
| surfaces | built-in three, themable | pack-defined surfaces |

---

## 2. pack-manifest.json (draft, annotated example)

```jsonc
{
  "kind": "pack-manifest",
  "schemaVersion": 1,
  "packId": "about-last-night",
  "version": "1.0.0",                       // draft+publish bumps this (Q1 decided)
  "contentHash": "sha256:…",                // over the file inventory; staleness visibility (A2 program)
  "createdAt": "2026-06-13T00:00:00Z",
  "engine": { "minVersion": "3.0.0" },      // engine compat gate at load time

  // ── File inventory (reuses the ESP32 sha1+size manifest machinery) ──
  "files": [
    { "path": "game.json",        "role": "game",    "sha1": "…", "size": 4096 },
    { "path": "tokens.json",      "role": "tokens",  "sha1": "…", "size": 65536 },
    { "path": "strings.json",     "role": "strings", "sha1": "…", "size": 2048 },
    { "path": "theme.json",       "role": "theme",   "sha1": "…", "size": 1024 },
    { "path": "cues.json",        "role": "cues",    "sha1": "…", "size": 8192 },
    { "path": "templates/session-report.md.hbs", "role": "template", "sha1": "…", "size": 4096 },
    { "path": "assets/images/jaw001.bmp", "role": "asset-image", "sha1": "…", "size": 230456 },
    { "path": "videos/jaw001.mp4", "role": "asset-video", "sha1": "…", "size": 10485760 }
    // …completeness validation: every token media ref, cue sound/video
    // ref, and surface ref must resolve to an inventory entry (pack
    // manager's validate; fixes the preset system's missing-assets gap)
  ],

  // ── Hardware manifest (kit-model decision) ─────────────────────────
  // What the KIT must contain / the install must provide. The C2
  // resolution mechanism evaluates this against an installation profile
  // → runs / degrades / unavailable (planning view + preflight + harness).
  "hardware": {
    "deviceClasses": [
      { "class": "staffed", "min": 1,
        "rationale": "transact + session-lifecycle assigned here (game.json functions)" },
      { "class": "station", "min": 0, "recommended": 3,
        "rationale": "intel gathering; scarcity is a design lever (P3)" },
      { "class": "personal", "min": 0,
        "rationale": "optional player phones (tap-to-web, Phase 4/Track E)" }
    ],
    "tokens": { "count": 81, "tech": "nfc-ntag" },   // physical token objects
    "stack": {
      // Which orchestrator-stack services this pack's CONTENT exercises,
      // with per-service absence behavior (vocabulary = capability doc).
      "vlc":      { "usedBy": "video tokens, idle loop", "onAbsent": "degrade" },
      "music":    { "usedBy": "cue playlists",           "onAbsent": "degrade" },
      "sound":    { "usedBy": "cue sound effects",       "onAbsent": "degrade" },
      "lighting": { "usedBy": "lightingRoles",           "onAbsent": "degrade" }
      // "degrade" = game runs, elements held/disabled per C3 dormancy
      // semantics; "require" would make preflight a hard NO-GO
    },
    "endpoints": {
      "display.main":  { "usedBy": "surfaces", "onAbsent": "degrade" },
      "lighting.fixtures": { "roles": ["preshow", "reveal", "blackout", "finale"], "onAbsent": "degrade" }
    }
  }
}
```

Manifest notes:
- **Pack = ALN-TokenData submodule extended** (E9, tooling proposal §5):
  game.json, strings, theme, templates, and this manifest live beside
  tokens.json; backend/scanner asset dirs join the inventory via path
  mapping at publish time (asset-bundle design detail for the pack-store
  work, B0.1).
- **tokens.json stays its own file** (not embedded): it is the largest,
  most independently-edited artifact, with its own schema (v1 today, v2
  below) and its own producer (Notion sync — ALN-specific tooling, per
  the owner-confirmed pipeline question).

---

## 3. O2 PROPOSAL — engine device-class registry (P3/P5)

Engine-shipped (NOT per-pack): the registry defines the classes and their
declared affordances; packs reference classes in `functions` and the
manifest. Tooling validates `functions` against affordances at design time.

```jsonc
// engine: device-classes.json (versioned with the engine)
{
  "schemaVersion": 1,
  "affordanceVocabulary": [
    "coarse-tap", "text-entry", "list-select", "rich-display",
    "audio-out", "nfc-read", "camera"
  ],
  "classes": {
    "personal": {
      "affordances": ["text-entry", "list-select", "rich-display", "audio-out", "nfc-read", "camera"],
      "identity": "session-pseudonymous",     // P8: persistent session, identification = game policy
      "delivery": "web"                        // interactions ship as content (P6)
    },
    "station": {
      "affordances": ["coarse-tap", "rich-display", "audio-out", "nfc-read"],
      // NO text-entry / list-select: EMI-filtered resistive touch, double-tap only —
      // the validation rule that blocks "pick an account on the touchscreen" designs (P5)
      "identity": "device-bound",              // optionally entity-BOUND per session (P3)
      "delivery": "firmware"                   // small engine-shipped primitive set only (P6, O4)
    },
    "staffed": {
      "affordances": ["text-entry", "list-select", "rich-display", "audio-out", "nfc-read", "camera"],
      "identity": "credentialed",              // operator-authenticated (O3 anchors here)
      "delivery": "web"
    }
  }
}
```

Validation rules (pack manager + CI):
1. Every class in `game.json functions` exists in the registry.
2. A function's interaction needs must be satisfiable by the class's
   affordances (rule table starts small: `transact with free entity
   selection` requires `text-entry|list-select` OR `entity-binding`;
   grows with O4 primitives).
3. Functions marked auth-floor (pending O3) reject assignment below
   `staffed` until O3 lands.

---

## 4. tokens.schema v2 — structured group field (A1 coordinated change)

Kills the `"(xN)"` microformat. v2 token (changes only):

```jsonc
{
  "jaw001": {
    "SF_RFID": "jaw001",
    "SF_ValueRating": 3,
    "SF_MemoryType": "Business",
    "group": { "id": "server-logs", "label": "Server Logs", "multiplier": 5 },  // was "SF_Group": "Server Logs (x5)"
    "…": "unchanged fields"
  }
}
```

- Coordinated change: backend `tokenService` parser, GM scanner
  (`tokenManager` + `LocalStorage`), Notion sync writer (ALN-specific
  producer), schema, and a migration script (v1→v2 mechanical rewrite).
  Lands as ONE A1 slice with the toy pack authored natively in v2.
- Loader accepts both during migration (v2 first, v1 fallback with the
  parse shim that exists today).

## 5. Open points for owner review (the only decisions in this doc)

1. **O1 naming:** "entity" as the engine term with pack-supplied labels
   ("Account" for ALN) — and `teamId` kept as the wire alias through
   Phase 3. OK?
2. **O1 attribution v1 scope:** engine applies the pack default to every
   transaction; opt-in credit captured via report intake (Track D), with
   in-flow capture deferred to Phase 4. OK?
3. **O2 affordance floor for stations** as written (coarse-tap, no text
   entry) — matches the CYD hardware audit. OK?
4. **O3 floor candidates** marked in `functions` (session-lifecycle,
   show-control, score-intervention staffed-only regardless of pack):
   this is my recommendation going INTO the O3 design section, not a
   decision here.
5. **scoring-config.json absorption** into game.json (with fallback shim
   during migration) — retires one shared file and the F-TOOL-05 class
   with it once A2 runtime loading lands. OK?
