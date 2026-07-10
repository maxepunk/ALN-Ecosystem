# Phase 3.1 — The One-Auth Story (O3)

**Date:** 2026-07-09
**Status:** DRAFT for owner review (deliverable 4 of the program §10;
resolves program §6.2 / O3).
**Fixed input (owner, 2026-07-09):** the THREE-FUNCTION FLOOR —
`session-lifecycle`, `show-control`, `score-intervention` are permanently
operator-credentialed; all other functions are pack-assignable.
**Problem:** the system has four ad-hoc identity mechanisms today — GM
password→JWT WebSocket (all-or-nothing admin), anonymous player HTTP with
self-asserted deviceId, the config-tool's decided-but-unbuilt LAN auth,
and a hardcoded scoreboard password. Phase 3/4 adds bound stations and
pseudonymous player sessions. These must be ONE model with different
credential strengths, not five systems.

## 1. The model: identity tier × device class → granted functions

Every client holds ONE kind of token (JWT, same secret family, same
verification path) whose claims are:

```jsonc
{
  "tier": "operator" | "device" | "session",
  "class": "staffed" | "station" | "personal" | "display",
  "deviceId": "GM_01",
  "functions": ["view-content", "transact:blackmarket", "transact:detective", "..."],
  "packHash": "sha256:…",      // grants were computed against THIS pack
  "exp": 1780000000
}
```

`functions` are computed **at issuance**:

```
granted = packAssignment(class) ∩ tierCeiling(tier) − (FLOOR if tier ≠ operator)
```

- **FLOOR (fixed):** `session-lifecycle`, `show-control`,
  `score-intervention` are never minted into a non-operator token — and
  re-checked at execution time (defense in depth). The pack VALIDATOR
  rejects any pack assigning floor functions below staffed, so authors
  find out at design time, not at the venue.
- Enforcement is **by function, not by transport or route class**: the
  WebSocket `gm:command` handler and the HTTP routes both resolve the
  caller's token and check the required function. Today's "authenticated
  GM WebSocket vs anonymous player HTTP" becomes just ALN's particular
  grant table.

## 2. The three tiers (credential strengths)

| Tier | Credential | Issued how | Identifies |
|---|---|---|---|
| **operator** | ADMIN_PASSWORD | `POST /api/admin/auth` (exists today) | a trusted staff member's device |
| **device** | enrollment (v1: self-asserted deviceId, as today; headroom: per-device enrollment secret) | token minted on first contact / station boot | a piece of kit hardware |
| **session** | none (pseudonymous, P8) | server-issued on first visit, persisted client-side | a browser/person-session — NOT a verified person |

- **operator** ⊇ everything: floor functions + all pack grants for
  staffed. This is today's GM token, unchanged in power.
- **device** carries the pack's station-class grants. ALN v1: stations
  only `view-content` — behaviorally identical to today. A future
  bound-station game grants `transact` + `entity-binding` to enrolled
  stations; the enrollment-secret headroom exists for exactly that game
  (self-asserted IDs are fine while stations can't transact).
- **session** is Phase 4's player-phone substrate: pseudonymous by
  default; "claim credit" moments (P2, via the entity mechanism per the
  corrected attribution model) work WITHOUT upgrading the tier —
  identification is game policy, never an auth requirement.

## 3. Surface-by-surface mapping

| Surface | Today | Under one-auth |
|---|---|---|
| GM scanner (networked) | password→JWT, all-or-nothing | operator token; same UX, grants now explicit |
| Player scanner POST /api/scan | anonymous + deviceId | device-tier token (auto-minted), function `view-content` — same wire behavior, now expressible per pack |
| ESP32 | anonymous + deviceId | device tier, same as PWA; enrollment headroom when a game binds stations |
| config-tool | (unbuilt; decided LAN+password+HTTPS) | SAME `POST /api/admin/auth` → operator token with `aud: config-tool`; one secret, one issuance path; B0.3 consumes this directly |
| Scoreboard | hardcoded password (extraction pre-fix) | device tier, class `display`, function `observe` (read-only state); the hardcoded password dies in the strings/theming slice |
| Player phones (Phase 4) | — | session tier; venue onboarding mints it silently |

## 4. Threat posture (what the floor buys)

Adversary model: a curious/mischievous player on the kit WiFi with a
browser and the venue's public knowledge (no secrets).

- **Floor as blast-radius cap:** even a maximally mis-authored pack plus a
  bug in grant computation cannot hand session-end, cue firing, or score
  editing to a non-operator token — issuance never mints them and
  execution re-checks tier.
- **Token theft scope:** session/device tokens grant at most pack-assigned
  player functions (worst case in ALN v1: fake view-content scans — the
  same exposure as today's anonymous API). Operator tokens remain the
  crown jewels: 24h expiry as today; HTTPS-only transport (E2's real cert
  makes this honest).
- **Pack tampering ≠ privilege escalation:** grants are computed
  server-side from the SERVER's active pack; a client-modified pack copy
  changes nothing. `packHash` in the token makes stale-grant detection
  explicit after a pack switch (re-issue on mismatch).
- **Self-asserted deviceId (v1)** is accepted exactly where it is today —
  tiers whose grants can't affect scoring or the show. The rule going
  forward: any grant beyond view/observe requires operator or enrolled
  credentials.

## 5. v1 implementable subset (behavior-identical for ALN)

Phase 3 implements: token claims + issuance-time grant computation + the
function check in `commandExecutor`/routes + config-tool auth (B0.3) +
scoreboard observe token. ALN's grant table reproduces today's behavior
exactly — the proof is the existing test suites passing unchanged plus new
contract tests pinning: (a) floor functions rejected for non-operator
tokens, (b) grants recomputed on pack switch. Enrollment secrets and
session-tier UX are Phase 4 (Track E) — the schema and claims carry them
from day one so nothing is re-plumbed.

## 6. Open points for owner review

1. **Token lifetimes:** operator 24h (today's value) / device 7d /
   session 30d — sane defaults for a game weekend + at-home prep?
2. **Scoreboard as `display` class** with a read-only `observe` function —
   any objection to the scoreboard needing a (silently auto-minted) token
   where today it connects openly?
