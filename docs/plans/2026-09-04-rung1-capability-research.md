# Rung-1 capability research — measured, per environment (2026-09-04)

**Why this doc exists:** the owner directed empirical grounding before the
rung-1 harness is designed ("did we ever try running the daemon?"). Every
claim below is a measurement from an actual run, not an assumption; where a
question is still open, the open instrument is named. Method: **probe, then
verdict, per capability, per environment** — the same honesty pattern the
harness itself will implement.

**The principle under test** (owner-ratified in the sitting): run the real
software wherever the real software can run; fake only the physics.

## Environment A: the remote dev container

Ubuntu 24.04.4, root, apt + pip available, outbound via the agent proxy.

| Capability | Verdict | Evidence / recipe |
|---|---|---|
| Docker daemon | **WORKS** | `dockerd --iptables=false --bridge=none --storage-driver=vfs` boots in seconds; `docker info` exit 0; alpine pulled through the proxy and ran with `--network=host` |
| MPD | **WORKS** | apt `mpd mpc`; minimal conf with `type "null"` audio_output; `mpc status` answers |
| VLC headless | **WORKS** | apt `vlc-bin vlc-plugin-base`; **refuses to run as root** — run as a dedicated user. CORRECTED by the CS.1 engine audit: the engine drives VLC over **MPRIS on a D-Bus session bus** (`vlcMprisService` shells out to `dbus-send`), NOT the HTTP interface this row first claimed. `cvlc -I dummy --control dbus` on a shared bus answers the engine's exact `PlaybackStatus` call (proven cross-uid with a permissive bus config) |
| pipewire + pactl | **WORKS** | apt `pipewire pipewire-pulse wireplumber pulseaudio-utils`; no systemd user session, so boot under `dbus-run-session` with an explicit `XDG_RUNTIME_DIR`; `pactl load-module module-null-sink` succeeds, sink listed. (A benign `Failed to set fd limit` warning from dbus-daemon.) |
| Home Assistant (container) | **WORKS, end-to-end** | Pinned `ghcr.io/home-assistant/home-assistant:stable`; `--network=host -v <config>:/config`; first HTTP response **21 s** after `docker run`. Full flow proven: programmatic onboarding → token → `scene.turn_on` → demo light `off → on` (**SCENE_DRIVES_LIGHT: PASS**) |
| HA persistence | **WORKS** | Container restart: user + auth survive (login flow succeeds, states readable). Restart-to-ready time NOT cleanly measured (a wrong readiness probe burned ~120 s of the clock; ceiling 141 s) — re-measure in CI |
| Python for HA-via-pip (fallback path) | **AVAILABLE** | python3.12 and 3.13 both already installed (`python3` symlink is 3.11) |
| btvirt binary | **INSTALLABLE** | Ubuntu 24.04 packages it as **`bluez-test-tools`** (NOT `bluez-tests`) |
| Virtual Bluetooth device | **BLOCKED** | `mknod /dev/vhci c 10 137` succeeds but btvirt gets "Failed to open Virtual HCI device" — host kernel lacks `hci_vhci`, container cannot modprobe. Kernel wall, evidence recorded |

### Gotchas that would have been CI flakes (found by refusing to gloss)

1. **HA onboarding `integration` step needs `redirect_uri`** alongside
   `client_id` (it returns a browser `auth_code`). Without it: HTTP 400 and
   onboarding never completes. With it: all four steps report done. The
   fixture recipe MUST include it.
2. **`/api/onboarding` disappears after onboarding completes** (404). It is
   therefore a valid readiness probe ONLY on first boot; post-onboarding
   readiness must poll `/auth/providers` (or any always-on endpoint).
3. **VLC refuses root** — the harness runs it as a dedicated user.
4. **Package name drift**: `bluez-tests` → `bluez-test-tools` on Ubuntu.
5. Observed, not load-bearing: the demo light did not restore its
   pre-restart state (came back `off` after being scene-set `on`). The
   harness re-runs its scene assertion per boot, so nothing rests on
   restore behavior.

### Incidental audit finding

`pactl` was ABSENT in this container yet the backend integration suite
passes 348/348 here — confirming the existing test suites never touch real
audio tooling locally. Everything to date is rung-0-verified; the rung-1
harness is the first real-services audit of the engine.

## Environment B: GitHub Actions runners (ubuntu-latest)

Known from months of CI: the full engine runs there hardware-free (toy
profile), Playwright E2E, pactl installed for audio tests. The OPEN
question is virtual Bluetooth — runners are full VMs (sudo + modprobe
plausible), the opposite side of the container's kernel wall.

**Instrument:** `.github/workflows/capability-probe.yml` — dispatch-only
probe (self-scoped push trigger until the file reaches the default branch,
since `workflow_dispatch` only registers there; main is merge-train-only).
Steps: `modprobe hci_vhci` → device check → `bluez-test-tools` install →
`btvirt -l2` → adapter listing → power/scan. Every step tolerant; the log
is the deliverable.

**Result (run 33843990405) — CORRECTED CLAIM: hci_vhci is absent from
the DEFAULT runner image.** ("Definitive/impossible" was an overclaim —
it proved only the out-of-the-box state; the `linux-modules-extra`
escalation path was untested. The amended probe below tests it.)
Kernel `6.17.0-1022-azure`;
`modprobe: FATAL: Module hci_vhci not found in directory
/lib/modules/6.17.0-1022-azure` — the Azure runner kernel does not ship
the module AT ALL, and `bluetoothctl` cannot open the management socket
(the Bluetooth stack appears compiled out entirely). Nothing to load,
nothing to emulate. So virtual BT is dormant at BOTH hosted-CI rungs,
each with distinct recorded evidence: the dev container hits the
no-module-control wall; the runner kernel simply omits the stack.

**Escalation VERDICT (probe run 3, job 100942769424, 2026-09-04
07:11Z) — exhausted, "unreachable" now EARNED:**
`linux-modules-extra-6.17.0-1022-azure` EXISTS and installed cleanly
(51 MB, `MODULES_EXTRA=INSTALLED`) — and still:
`modprobe bluetooth` → `FATAL: Module bluetooth not found`
(`BT_CORE=FAIL`); `modprobe hci_vhci` → same (`MODPROBE_RETRY=FAIL`,
`VHCI_DEVICE=ABSENT`); btvirt "Failed to open Virtual HCI device";
mgmt socket unopenable throughout. The Azure kernel compiles the
Bluetooth stack out entirely — it is not in the default image AND not
in modules-extra. Hosted-CI BT ceiling = the dbusmock rung; real
BlueZ + virtual radio needs a self-hosted runner (the Pi, onboard BT,
post-Phase-3 blue/green). Verdict is per-image (ubuntu-24.04
20260831.293.1, kernel 6.17.0-1022-azure); re-probing a future image
costs ~1 minute via the probe workflow.

**Original escalation rationale (kept for the record):**
Ubuntu cloud kernels keep optional drivers in
`linux-modules-extra-<version>-azure` — a known Actions pattern for
virtual CAN / loopback audio. The amended probe installs it, then
retries `modprobe bluetooth` and `modprobe hci_vhci` separately so the
log says which layer unlocks. If it passes, real-BlueZ btvirt testing
IS viable on hosted CI; if it fails, "unreachable on hosted CI" becomes
earned, and a self-hosted Pi runner (onboard BT; the post-Phase-3
blue/green arrangement) is the real-BT-in-CI path.

## Bluetooth workaround PROVEN in the dev container: dbusmock-BlueZ

The decisive code fact: `bluetoothService` drives the `bluetoothctl`
CLI and parses output — no kernel or radio dependency in our code. So
the substitutable layer is the BlueZ DAEMON (software), not the radio
(physics). `python-dbusmock` ships a maintained bluez5 template;
spiked here: mocked `org.bluez` on a private system bus, mock adapter
added, and the real unmodified `bluetoothctl list` returned
`Controller 00:01:02:03:04:05 rung1-mock-adapter [default]`. (Recipe
notes: needs a python matching apt's `python3-dbus` bindings — a
`python3.12 -m venv --system-site-packages` + pip `python-dbusmock`;
the `mgmt_socket` stderr warning is expected kernel-less noise and does
not affect the D-Bus path.)

**The BT coverage ladder as measured:** unit mocks (exists) →
dbusmock-BlueZ (PROVEN here; portable to any runner; covers our whole
management surface against a controllable fake daemon) → btvirt
(real BlueZ, virtual radio: container impossible, hosted CI pending
the modules-extra probe) → real adapter (rung 2 / the Pi). CS.1 must
verify per-subcommand that everything our service uses rides D-Bus
against the mock (show, scan, info, pair, connect, disconnect,
remove) — checklist, not assumption.

## The GitHub rate-limit investigation — RESOLVED (mechanism confirmed)

Symptom: from 04:26Z, every review-thread read (the one GraphQL-backed
method) failed with "rate limit exceeded for user ID 105341611" while
~40 REST calls as the same identity succeeded all morning.

Findings, each evidence-backed:
1. The owner's PAT read of `/rate_limit` showed **graphql used: 0** —
   the user-global GraphQL bucket was NEVER touched. No third-party
   consumer exists on the account.
2. The exhausted bucket is therefore the **user × GitHub-App pairing
   bucket** (user-to-server tokens carry their own 5,000/hr GraphQL
   budget, invisible to a PAT, but attributed to the user in error
   text).
3. The consumer: this session's own CI cadence. Four near-simultaneous
   pushes fired four concurrent 8-job Test runs; each run emits dozens
   of check events; the PR-subscription relay's per-event work under
   the same app pairing drained the shared bucket; the session's own
   thread reads then found it empty. Self-inflicted, invisible from
   the owner's side.
4. Controlled confirmation: with ALL workflow activity stopped
   (06:47Z), a single pre-registered probe at ~07:07Z SUCCEEDED —
   the pairing bucket refills in event-quiet. (An earlier "quiet"
   experiment was invalidated by its own author pushing during the
   window; the control condition must be VERIFIED from the runs list,
   never assumed.)

Standing mitigations: batch pushes (one per logical milestone); REST
thread-reads (reviews + comments both empty ⇒ no threads — an inline
review comment always has a parent review) whenever CI is or was
recently active; treat active-CI windows as GraphQL-dark. Upstream
report for Anthropic: (a) relay enrichment sharing the session's
user-to-server budget is a footgun; (b) the GitHub MCP exposes no
`/rate_limit` reader and surfaces no rate-limit headers — one trivial
tool would have collapsed this investigation into a single call.

**Probe gotchas (run-1 lessons, fixed in the workflow):**
`bluetoothctl` drops to an interactive prompt and hangs a step unless
wrapped in `timeout`; an undetached backgrounded daemon holds a step
open until job timeout. Every probe step is bounded now, so re-running
the probe when runner images change kernels costs ~1 minute.

## Consequences for the CS.1 harness design

- The harness implements the same probe-then-verdict pattern per
  capability: run real where the probe passes, mark dormant WITH the
  recorded reason where it fails ("virtual BT: unsupported on this runner
  (no /dev/vhci)"), never silently skip.
- The recipes above (HA onboarding sequence incl. `redirect_uri`, VLC
  non-root + dummy outs, MPD null output, pipewire under dbus-run-session,
  dockerd flags for containers) are the seed of the harness bring-up
  scripts and the CI job.
- This dev container is a full rung-1 host for the software stack (HA,
  VLC, MPD, audio) — spike iteration happens here in minutes; GitHub CI is
  the recurring automated instance and additionally carries the btvirt leg
  if the probe passes.
