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

## Feeds
- Phase 2.x.1 capability manifest (vocabulary now = install-tier model)
- Phase 3.0/3.1 schemas (pack hardware manifest; installation profile)
- Phase 3 Venue workspace (planning view + preflight as one mechanism)
- Phase 4 acceptance (topology validation = tier ladder runs)
- B4/B10 elicitations still open; B8 flow design now grounded in this model
