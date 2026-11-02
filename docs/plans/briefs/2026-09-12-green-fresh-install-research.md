# Research brief — a fresh Raspberry Pi OS install on green versus what the guide and the code assume

You are a researcher. Work only under `/home/user/ALN-Ecosystem/` for
repository reads; the top-level `/home/user/ALNScanner` and
`/home/user/ALN-TokenData` directories are stale clones: never read
them. You may use web search and web fetch for external facts. You
write exactly one file. Change nothing else, run no git write commands,
dispatch no subagents. Model: Opus. If a web tool fails, say so in the
document and continue from the repository facts; never stop silently.

## Goal
The owner builds a second Raspberry Pi 5 ("green") this week from a
FRESH Raspberry Pi OS install and follows `DEPLOYMENT_GUIDE.md` to make
it the production machine for a show on 2026-09-18. The current
production Pi ("blue") runs an older release; the guide and the code
assume Raspberry Pi OS Bookworm 64-bit Desktop with Xorg and LXDE
(`DEPLOYMENT_GUIDE.md` near line 1031). Find every place where a fresh
install today differs from that assumption, and say what to do about
each. Known facts, do not re-derive: the venue reaches the orchestrator
at 192.168.0.191; the tablets accepted blue's self-signed certificate
once; the ESP32 scanners skip certificate checks; no player phones, no
QR codes; DNS is not set up and is not a priority.

## Repository facts to read first (cite file:line)
`DEPLOYMENT_GUIDE.md` in full; `backend/CLAUDE.md` sections "Display
Control Architecture", "WirePlumber Configuration Dependency",
"Raspberry Pi 5 Specifics"; `docs/wireplumber/51-aln-vlc-no-restore.lua`;
`backend/src/utils/displayDriver.js` (xdotool/wmctrl, DISPLAY);
`backend/src/services/vlcMprisService.js` (launch flags, `--vout`,
D-Bus); `backend/src/services/audioRoutingService.js` (pactl, sink
names); `backend/src/services/bluetoothService.js` (bluetoothctl,
dbus-monitor); `backend/src/services/musicService.js` (MPD spawn);
`backend/src/utils/dockerHelper.js` and `lightingService.js` (Docker,
the Home Assistant container); `scripts/requirements.txt` and
`scripts/sync_notion_to_tokens.py` lines 200–215 (fonts);
`backend/package.json` engines; the PM2 config the guide names
(`ecosystem.config.js`); the autostart material the guide describes.

## External facts to establish with sources (URL and the date read)
The current Raspberry Pi OS release name and Debian base for a fresh
64-bit Desktop image today; whether the Pi 5 desktop session is Wayland
(labwc or Wayfire) or X11 by default, and how to force X11 if the code
needs it; the PipeWire and WirePlumber versions and whether WirePlumber
still reads `/etc/wireplumber/main.lua.d/*.lua` or needs the newer
`.conf` format; the VLC version and whether `--vout=gles2` and D-Bus
MPRIS control still apply; the Chromium package name and whether
`--kiosk` and `--password-store=basic` still apply; the Python version
and whether requests, Pillow, python-dotenv and jsonschema install
cleanly, and whether `fonts-dejavu-core` is present by default; the
Node.js version available and whether the guide's NodeSource script
still works on that release; Docker Engine availability for the
Home Assistant container; BlueZ; xdotool and wmctrl availability and
whether they work under the default session; NetworkManager static
address configuration.

## Questions
1. A table: each external fact, the value on a fresh install today, the
   value the guide or code assumes, differ or not.
2. For each difference: what breaks (code path, file:line) and the
   smallest fix: a guide change, a config change, a package, or a code
   change. Say which.
3. What must be COPIED from blue, not recreated: every file or directory
   with its path on blue, from the guide and the roadmap's "machine
   state that is not in git" list (`docs/plans/ROADMAP.md` §6):
   certificates, `.env`, the Home Assistant volume, media files, the
   WirePlumber drop-in, anything else found.
4. What is PULLED from git: repositories and branches (main), submodule
   initialisation, the scanner build, what is built on the machine.
5. What is INSTALLED: apt packages, Node, PM2, Docker, in the guide's
   order, with any package renamed or absent on the new release.
6. Green as the home development environment afterwards (real
   substitute hardware, rung 2): what the test tooling needs on the
   machine to run the unit, integration and end-to-end suites
   (`backend/tests/rung1/up.sh`, `provision.js`, `backend/package.json`
   scripts), and what of that collides with the production install on
   the same machine: users, `/tmp` state, ports, the PM2 orchestrator
   versus test-spawned ones, the real Home Assistant versus the witness
   one, the real audio session versus the rig's.

## Completion criterion
Every external fact has a source URL; every repository claim has
file:line; every difference has a named fix; the copy, pull and install
lists are complete against the guide and the roadmap list.

## Output
Write `/home/user/ALN-Ecosystem/docs/plans/2026-09-12-green-fresh-install-research.md`
for a cold reader in plain language: sections 1 to 6, a "Sources"
section, and a final "Ranked list of what breaks on a fresh install if
nothing is done". Reply with at most five lines: status, the path, the
three largest differences.
