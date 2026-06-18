# Engine Design Notes — from the B4/B10 Elicitation (2026-06-11)

**Status:** distilled inputs for the Phase 3.0/3.1 design docs. B4/B10 are
considered SUFFICIENTLY elicited for drafting; remaining items are marked
open below and resolve at design-doc review, not in further conversation.

**Method note:** these are ENGINE principles. ALN appears only as "one
instantiation" evidence; the owner's personal creative philosophy is
deliberately not encoded — the engine serves other designers too.

## Principles

### P1 — The scoring entity is an abstract ledger, not a social group
The engine's score-holder ("team" today) is an identity that accumulates
value. Its SEMANTICS are game-defined: team, individual, wallet/account,
faction, character. Free-text creation at action time is a legitimate
mode — unverified identity can itself be gameplay (deception, fronts,
proxies) — so name validation/verification level is GAME POLICY, not
engine truth. Membership (which humans stand behind an entity) may be
deliberately untracked; the engine must not require a roster to function.
*(ALN instantiation: "shell accounts," informal sharing, misdirection
accounts.)*

### P2 — Attribution is a separate axis from the scoring entity
Who gets *narrative credit* for an action is distinct from which ledger
it lands on. The engine supports: a game-defined DEFAULT attribution
(including anonymous and NPC identities) and explicit opt-in credit to a
named identity. Attribution feeds reporting/post-game artifacts.
*(ALN: anonymous-by-default detective tips via the "Nova" NPC; opt-in
character credit consumed by the report pipeline.)*

### P3 — Device classes are part of the game-design palette
Three classes with distinct properties, all first-class:
- **Personal** (player-owned phones): identity-capable, zero-fabrication,
  rich input.
- **Shared station** (dedicated hardware): physically scarce, tactile,
  optionally BOUND to a scoring entity for the session (binding was the
  station's original design intent). Station COUNT is a kit dial —
  scarcity can be an intentional mechanic (negotiated access), not just a
  budget artifact.
- **Staffed** (operator devices): credentialed, full-capability.
A pack decides which classes a game uses and what each may do. The engine
holds no opinion that more devices or more engagement is better — device
roles, interaction density, and scan economics are design parameters.

### P4 — Functions are assignable to device classes, per game
What is hardcoded today as "player devices view, GM devices transact" is
ONE assignment of an underlying function set: view-content,
transact (by mode), entity-binding, session-lifecycle, show-control,
score-intervention, report-intake. The Phase 3 model: packs assign
functions to device classes, bounded by:
- **(a) declared interaction affordances** (P5), and
- **(b) an auth floor** (open question O3).
This enables staffed-station games (today's ALN), self-service games
(bound-station transacting), and hybrids — without engine changes.
Implementation implication: the transaction API becomes FUNCTION-gated
(device identity + pack-assigned permissions), not device-type-gated;
today's split APIs (authenticated GM WebSocket vs anonymous player HTTP)
are one hardcoded assignment.

### P5 — Interaction affordances belong in the capability model
Device classes declare input/output affordances (e.g., station:
coarse-tap only — EMI-constrained resistive touch, no text entry;
personal/staffed: text-entry, list-select, rich display). Function
assignment and interaction design are VALIDATED against affordances at
design time in the tooling ("free entity selection requires list-select +
text-entry → not assignable to stations unless entity-bound"). This is
the same capability-vocabulary machinery as install tiers, one level
down.

### P6 — Change economics differ by device class; primitives live accordingly
Firmware-bound devices (stations) get a SMALL, generic, engine-shipped
primitive set that packs configure (e.g., confirm/cancel, dismiss);
web devices get content-driven interactions. Never design a mechanic
whose iteration loop requires fleet reflashing.

### P7 — Personal-device channel: OS-level tap-to-web, not in-page NFC
For personal devices, the token→device channel is the OS handling NDEF
URL records (background tag reading), opening the web client with token
context — cross-platform (iOS+Android), zero-install. In-page NFC APIs
(WebNFC) are Android-only and rejected as the basis. Prerequisite trust
plumbing: real domain + real certificate for the LAN orchestrator
(benefits every web client in the system, including operator devices).
Existing assets: tokens already carry NDEF URL records; the web client
already has a URL-token entry path.
**Verification spikes (cheap, before design commitment):** (S1) tap an
existing production token with an iPhone — confirm background read fires;
(S2) prototype real-domain/real-cert on the orchestrator (e.g., owned
domain + DNS-01 issued cert resolving to a LAN address).

### P8 — Persistent session ≠ mandatory identification
On personal devices, a persistent session is the substrate; whether it is
IDENTIFIED is game policy. The engine supports pseudonymous-by-default
sessions with explicit identify/credit moments (consistent with P2), as
well as identified-at-onboarding games. Neither is the engine default.

## Open engine questions → resolve in Phase 3.0/3.1 design docs
- **O1**: game.json schema for the entity model (P1) + attribution model
  (P2): naming, defaults, NPC identities, credit flow.
- **O2**: device-class registry + affordance declaration format (P5) and
  the function-assignment table format (P4).
- **O3**: the auth floor — which functions (if any) are permanently
  operator-credentialed regardless of pack assignment, vs everything
  assignable in principle. (Security/abuse analysis owed in the design
  doc; owner inclination not yet recorded.)
- **O4**: interaction primitive library v1 scope (P6) — which primitives
  the engine ships first; gated on tap-to-web spikes S1/S2.
- **O5**: scan-economy expression — function assignment (P4) is the
  primary throughput lever; explicit rate knobs only if a design demands
  them.

## Relationship to current work
- **Blocks Phase 2.x: NOTHING.** The 2.x capability vocabulary covers the
  existing stack/endpoint set; device-class and affordance keys join
  additively later.
- Feeds Phase 3.0/3.1 directly (O1-O5 are design-doc agenda items).
- The report-pipeline intake (roster/accusation) consumes P2's
  attribution identities, not engine-tracked membership.
