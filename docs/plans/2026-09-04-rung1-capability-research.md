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
| VLC headless | **WORKS** | apt `vlc-bin vlc-plugin-base`; **refuses to run as root** — run as a dedicated user; `cvlc -I http --vout dummy --aout dummy` serves `status.json` (the exact interface vlcService drives) |
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

**Result:** run 1 (33843990405) in flight at time of writing. Steps 2-4
(modprobe verdict, /dev/vhci check, btvirt launch) completed and their
logs carry the answer; step 5 HANGS — the backgrounded `bluetoothd`
holds the step's descriptors open (workflow bug, fix queued: detach with
`setsid`/`nohup` or run it foreground with a timeout). Verdict + fix
folded here when the job's 10-minute timeout reaps it.

**One more probe gotcha for the recipe file:** a step that backgrounds a
daemon must fully detach it, or the Actions runner waits on the step
until job timeout.

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
