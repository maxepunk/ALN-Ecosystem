# Decision: Kit Network Posture — the kit brings its own network

**Date:** 2026-07-09
**Decided by:** owner ("B makes sense"), from the S2 venue-mobility question
**Context:** Spike S2 (real domain + DNS-01 cert) raised: what happens when
the Pi joins a different network per venue / gets a dynamic IP?

## Decision

**Standard posture: the kit includes its own network** (travel router, or
Pi as AP). Player and operator devices join the KIT's WiFi, not the venue's.

Consequences:
- The subnet is identical at every venue; the orchestrator holds one
  reserved IP forever; the public A record
  (e.g. `play.aboutlastnightgame.com` → kit LAN IP) is set ONCE.
- DNS rebind protection is under kit control (no venue-router surprises).
- **Fully offline-capable:** the kit router's local DNS answers for the
  orchestrator name; the publicly-issued certificate validates against the
  device clock, not the network. Cert renewals (90-day) happen at home
  between events via Cloudflare DNS-01.
- Simplifies device onboarding (one known SSID) and reduces the role of
  UDP discovery to a fallback.

**Fallback posture: venue-wifi** — for venues where riding house WiFi is
required. The Pi updates its own A record via the Cloudflare API on
boot/network-change (it already holds the DNS-edit token for cert
renewal); short TTL. Known risk, checked at preflight: venue-router DNS
rebind protection may drop public names resolving to RFC1918 addresses.

## Where it lands

- Installation-profile schema (C1): `network.mode: kit-network |
  venue-wifi` with per-mode preflight checks — drafted in
  docs/plans/2026-07-09-phase3-1-installation-profile.md.
- E2 (Phase 3 Track C infra): cert issuance + the boot-time DNS updater.
- Kit inventory: the travel router becomes a first-class kit item
  (pack-manifest hardware guidance references network posture).
- Spike S2 is unchanged (run at home; proves cert mechanics). Optional
  five-minute extension: phone joins kit WiFi → name resolves via local
  DNS → no cert warning.

## Router hardware (owner, 2026-07-09)

Owner owns a **TP-Link Archer** and will dedicate it to the kit, with the
requirement that guidance be **router-agnostic** (hardware must be
replaceable).

**Architecture consequence — DNS lives on the Pi, not the router.** Stock
consumer firmware (TP-Link included) often cannot serve custom local DNS
records, and router-resident config dies with the hardware. Instead:

- The **Pi runs dnsmasq** as the LAN's DNS server (answering
  `play.aboutlastnightgame.com` → its own reserved IP, forwarding
  everything else upstream when internet exists).
- The router's ONLY required capabilities — supported by virtually every
  consumer router including stock Archers — are: (1) WPA2 AP with a fixed
  SSID, (2) a DHCP reservation for the Pi, (3) a DHCP option handing out
  the Pi's IP as the network's DNS server.
- E2 guidance is therefore written as a 3-requirement checklist (any
  router) + a model-specific appendix (the owned Archer's menus). Swapping
  hardware = re-doing three settings; all logic stays in the kit's
  versioned Pi config.
- Failure note: if the Pi is down, LAN DNS is down — acceptable, since
  nothing the name points to works without the Pi anyway.
