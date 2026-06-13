# Decision Record: Kit Model & Scalable Install Tiers

**Date:** 2026-06-11
**Decided by:** owner (conversation during Phase 2.x planning)
**Supersedes/clarifies:** the "venue profile" framing in B7/B8 and the
Phase 2.x capability-vocabulary coupling; resolves the day-one "untested
deployment topologies" question's real meaning.

## The model

1. **Kit-based, production-owned hardware.** The game pack is not only a
   software/config/data bundle — a game ships as a KIT: data + config +
   the physical hardware it uses (NFC token objects always; optionally Pi
   orchestrator, GM tablets, player scanner hardware, HA-controlled light
   fixtures, Bluetooth/wired speakers, displays). Venues do not supply
   instruments; the production installs them.
2. **The install is SCALABLE per venue/event.** The required/available/
   feasible kit varies vastly: the engine must run a legitimate game at
   every tier —
   - minimum: a set of player scanners (phones and/or hardware) + tokens
   - ... through partial installs ...
   - full: Pi + player scanners (mixed phone/hardware) + GM tablets +
     HA lighting + speakers + displays
3. **Owner requirement (new, first-class):** the system should help
   CLARIFY what level of hardware install/investment unlocks what
   mechanics and game elements — at planning time, not just at runtime.

## Design consequences

- **Capability vocabulary is the spine** of the Phase 3 venue/install
  design. Every game element resolves to required capabilities; most of
  this is DERIVABLE from the pack itself (every cue action maps to a
  service; video moments need orchestrator+display+vlc; scoring needs
  only scanners) rather than hand-authored.
- **One resolution mechanism, three consumers:**
  1. *Planning view* — pack + proposed install tier → "runs fully /
     degrades (these cues hold) / unavailable (these elements don't
     exist tonight)". Usable before packing the van.
  2. *Preflight* — verify tonight's actual install against the same
     requirements (go/no-go).
  3. *Test harness* (Phase 2.x) — run the suite per tier; Phase 4's
     deployment-topology validation = the bottom rungs of this ladder.
- **"Venue profile" is really an INSTALLATION profile**: the record of
  this event's kit slice (which instruments installed, network, entity
  IDs after setup, calibration) — not bindings to a room's native
  instruments. Role→instrument binding remains (B8) but binds to the
  production's own installed kit.
- **Pack manifest gains a hardware dimension**: per-element capability
  requirements (mostly derived) + the physical kit list (token objects,
  required instrument types/counts per role).
- **Authoring-time visibility**: the Design workspace should surface
  "this cue raises the minimum install tier for this show element" when
  a designer adds capability-bearing actions.
- Deployment topologies (full networked / standalone GM /
  player-scanner-only / no-orchestrator) are install tiers, not special
  cases; the orchestrator itself is a capability.

## Refinement (owner, same day): stack vs endpoints

The "external services" (HA, VLC, MPD, PipeWire) are part of the
ORCHESTRATOR STACK — third-party only to avoid reinventing wheels, but
co-installed on the Pi and shipped wherever the orchestrator ships. The
capability model is therefore TWO layers:

1. **Stack (one switch):** orchestrator present or not. If present, the
   whole service stack is present. A stack service being unreachable is a
   FAULT (repair), never a tier characteristic.
2. **Endpoints (the dials):** which physical outputs are installed this
   event — fixtures, speakers, displays, BT devices. A service with no
   endpoints is DORMANT BY CONFIGURATION, not down ("a single smart bulb
   could change that" — no software change involved).

Consequences:
- **Health semantics must split fault/dormant.** Today `lighting: down`
  conflates "HA crashed" with "no fixtures installed". The installation
  profile tells serviceHealthRegistry which services are EXPECTED live;
  dormant services must not show red on the GM dashboard or block
  preflight (red that's always red trains GMs to ignore red).
- **Held vs disabled:** held-items = fault tolerance for services that
  should work (hold, repair, release). Game elements targeting domains
  with NO installed endpoints should be DISABLED at session start from
  the installation profile (the planning view already knows they're not
  in tonight's show) — never armed-then-held-forever.
- **Harness scope honesty:** test machines can be partial-stack
  (sandbox lacks VLC binaries) in ways production never is. The harness
  capability manifest models TEST environments; only endpoint absence is
  a realistic production-tier simulation. Shared vocabulary, distinct
  profiles.

## Audit: does this invalidate already-completed work? (2026-06-11)

**No rework required.** Reviewed Phase 0-2 + the 2.x-landed items against
the model:

Validated / strengthened:
- `gameRules/` (scoring, duplicatePolicy, cueVocabulary) IS the tier-zero
  logic — pure, dependency-free, exactly what the lowest install (scanners
  + tokens) runs on.
- The cueEngine split's `disabledCues` mechanism in the standing evaluator
  is the natural slot for "disable endpoint-less elements at session start
  from the installation profile" — Phase 3 feature on an existing seam.
- `validateCommand`'s resource-existence checks (sound files, scenes,
  sinks) are already endpoint-shaped — the embryo of preflight/planning.
- `LIGHTING_ENABLED=false` is an existing (crude) dormancy switch the
  installation profile generalizes.

Evolution points (recorded so they don't surprise later — none block
current work):
1. The asyncapi health `status` enum (healthy/degraded/down) gains a
   dormant/expected dimension with installation profiles — additive,
   coordinated (backend + GM dashboard), the domain-schema contract test
   makes it deliberate.
2. Held-vs-disabled: "hold on any down dependency" is correct for
   full-kit + faults; spurious for low-tier installs. Resolved when
   installation profiles land — current semantics are not final.
3. GM health dashboard needs dormant-awareness (renderer change in the
   Phase 3 UX pass; the four-domain split keeps it contained).
4. `SERVICE_DEPENDENCIES` rejections should eventually distinguish
   "service down" from "not installed tonight" for ad-hoc GM commands.
5. Harness framing: the 2026-06-11 degraded-path E2E tests are FAULT
   coverage (valid — services can crash mid-show), not install-tier
   simulation.

The only work this model would have genuinely broken was UNbuilt: the
Phase 2.x/3 capability vocabulary and venue-profile schema — corrected in
docs before any code existed (the elicitation track working at the
cheapest moment).

## Feeds
- Phase 2.x.1 capability manifest (vocabulary now = install-tier model)
- Phase 3.0/3.1 schemas (pack hardware manifest; installation profile)
- Phase 3 Venue workspace (planning view + preflight as one mechanism)
- Phase 4 acceptance (topology validation = tier ladder runs)
- B4/B10 elicited 2026-06-11 → distilled to engine principles in 2026-06-11-engine-design-notes-b4-b10.md (open items O1-O5 resolve in the 3.0/3.1 design docs); B8 flow design grounded in this model
