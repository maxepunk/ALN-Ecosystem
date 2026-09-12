# Green from a fresh Raspberry Pi OS install: what differs from the guide and the code

Research, 2026-09-12 (revised the same day to close eleven review gaps). Brief: `docs/plans/briefs/2026-09-12-green-fresh-install-research.md`.
Vocabulary: `CONTEXT.md` §5 (kit, venue, installation profile, blue/green).
Line numbers: `docs/plans/ROADMAP.md` and `CONTEXT.md` are cited against this docs
worktree; every other file against the main checkout (`DEPLOYMENT_GUIDE.md` and
`backend/CLAUDE.md` are byte-identical in both). External facts were gathered by
topic readers and by the reviser on 2026-09-12; every one has a URL in §7.

## Conclusions
A fresh 64-bit Desktop image today is Raspberry Pi OS **Trixie** (Debian 13, image dated 2026-06-18), not the
Bookworm the guide assumes (`DEPLOYMENT_GUIDE.md:1030`). Eight things differ in a way that matters this week.

1. **The desktop is Wayland (labwc); the code drives X11** (`DISPLAY=:0`, xdotool, wmctrl). Fix first: `sudo raspi-config` → Advanced Options → Wayland → **W1 X11**, reboot.
   The X11 stack (xserver-xorg, Openbox, lxpanel-pi) is on the Desktop image (§2.1, sourced to the image build and the metapackage); if it still comes up broken, blue runs the show (§2.1).
2. **WirePlumber 0.5.8 never reads `/etc/wireplumber/main.lua.d/`.** Fix: write `/etc/wireplumber/wireplumber.conf.d/51-aln-vlc-no-restore.conf`
   (§2.2; the rule keys are now sourced to WirePlumber's own script, with a `pw-dump` check). Do NOT copy blue's `.lua`: it passes the boot check and does nothing.
3. **The browser package and binary are `chromium`; the code spawns `chromium-browser`.** Fix: `sudo apt install chromium`, then `CHROMIUM_BIN=/usr/bin/chromium` in `backend/.env`.
4. **The guide installs Node 20 (end of life 2026-04-30); `backend/package.json` needs >= 22.** Fix: `setup_22.x`. Guide change.
5. **`pip install` is refused (Python 3.13, PEP 668).** Only if Thursday's Notion sync runs on green. Fix: `sudo apt install python3-requests python3-pil python3-dotenv python3-jsonschema`.
6. **192.168.0.191 is a router DHCP reservation keyed to blue's MAC; green has its own.** Fix at cutover: move the reservation to green's MAC (§2.6).
7. **The host timezone is machine state that is not in git.** `/health` publishes it and every hardware scanner adopts it; a wrong zone shifts every
   scan timestamp silently (§2.7). Fix: `sudo timedatectl set-timezone <blue's zone>` (read it on blue with `timedatectl`). Guide change, step 0.
8. **The certificate a clone delivers is for 10.0.0.177, not the venue address** (`backend/ssl/` is tracked, not ignored; expires 2026-10-24). Fix:
   establish what blue actually serves (fingerprint), copy THAT pair after the clone and before the first `npm start`, else regenerate with an IP SAN (§2.8).

Unchanged, no action: VLC 3.0.23 with `--vout=gles2` and D-Bus MPRIS; Docker via `get.docker.com`; NetworkManager; `/boot/firmware/config.txt`;
**BlueZ 5.82's `bluetoothctl` prints exactly the lines the parser reads, unchanged since 5.66** (§2.9); xdotool, wmctrl present (X11 only); DejaVu fonts
on the Desktop image; HEVC only; Playwright installs on arm64 Debian 13 (§6). Bench (§1b): the X11 session owns a real window, `pactl`/`pw-play`/`dbus-monitor` on PATH, `output:hdmi-stereo`.

**Copy from blue over the share** (paths on blue's disk; `~` = blue's login user): `~/ALN-Ecosystem/backend/ssl/cert.pem` + `key.pem`, only the pair
whose fingerprint blue serves, after checking SAN and `notAfter` (§2.8); `~/ALN-Ecosystem/backend/.env`, then audit it for blue-only values (§3);
`~/ha-config/` whole (the Home Assistant volume: `scenes.yaml`, owner account, token; copy BEFORE the first `docker run`, and run blue's exact HA image,
not `:stable`, §3); `~/ALN-Ecosystem/backend/public/videos/*.mp4` (idle-loop.mp4 included); `.../backend/public/music/`; `.../backend/public/audio/`
(files git lacks only); then the guide's verify block (`DEPLOYMENT_GUIDE.md:836-858`). Read, do not copy: `ALN-TokenData/pack-manifest.json` (contentHash →
pack commit), `/boot/firmware/config.txt` (compare), the profile file (diff), `timedatectl` (the zone), HA's version and image digest. Never: `backend/data/`,
`~/.pm2/`, `/var/lib/bluetooth/` (re-pair), the `.lua` drop-in.

**Pull from git:** `git clone --recurse-submodules https://github.com/maxepunk/ALN-Ecosystem.git ~/ALN-Ecosystem` on `main`, with submodules ALN-TokenData
(at blue's pack commit), ALNScanner + `data`, aln-memory-scanner + `data` (this one carries the ESP32 asset corpus and `assets/manifest.json`, §4),
arduino-cyd-player-scanner; the installation profile `backend/config/profiles/aln-full-kit.json` (verify it bound, §4). Built on green: `backend/` `npm install`;
ALNScanner `npm ci && npm run build` (the `npm start` prestart does it); `npm run music:seed`; `python3 scripts/generate_asset_manifest.py` only if the served manifest's pack hash differs from `/health`.

**Install, in the guide's order:** Imager 64-bit Desktop (user/hostname/WiFi/SSH; Localisation = blue's zone) → `raspi-config`: Desktop Autologin, Wayland → W1 X11 →
`usermod -aG video,audio,bluetooth` → `apt update && apt upgrade` → NodeSource `setup_22.x`, `nodejs` → `apt install vlc mpd git xdotool wmctrl chromium pulseaudio-utils
pipewire-bin dbus-bin` (renamed: chromium; added: `pactl`, and `pw-play`/`dbus-monitor`, normally present already — the line is idempotent) → disable `mpd`, `mpd.socket` →
`npm install -g pm2` → clone, `npm install` → certificate check + copy → Docker via `get.docker.com`, `usermod -aG docker`, HA container at blue's image digest on the copied
`~/ha-config` → WirePlumber `.conf` → timezone → address (router) → `npm start`, `pm2 save`, `pm2 startup` → media and manifest verify. Skip `ufw` (absent). Optional: the four `python3-*`.

## 1. The facts: today versus what the guide and the code assume

| # | Fact | On a fresh install today (2026-09-12) | What the guide or code assumes | Differs? | Sources (all read 2026-09-12) |
|---|---|---|---|---|---|
| 1 | OS release, Debian base | Raspberry Pi OS Trixie, Debian 13; 64-bit Desktop image dated 18 Jun 2026, kernel 6.18 | Bookworm 64-bit Desktop (`DEPLOYMENT_GUIDE.md:1030`); `/boot/firmware/config.txt` (`:1074`) | Release differs; the boot config path is the same | raspberrypi.com/software/operating-systems; raspberrypi.com/documentation/computers/os.html; raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os |
| 2 | Pi 5 desktop session | Wayland with the labwc compositor, on all models, since Oct 2024 and still in Trixie; Wayfire is gone (raspi-config 20250814 "Remove wayfire option", 20260710 "Remove wayfire support"). The Desktop image is built with BOTH `rpd-wayland-core` and `rpd-x-core` (pi-gen stage3); `rpd-x-core` depends on `xserver-xorg, xinit, xcompmgr, x11-xserver-utils, openbox, lxpanel-pi, lpplug-*`. raspi-config → Advanced Options → Wayland → "W1 X11" ("Openbox window manager with X11 backend") sets lightdm's `user-session`/`autologin-session`/`greeter-session` to `rpd-x` | Xorg/LXDE session (`DEPLOYMENT_GUIDE.md:1030-1033`); `DISPLAY=:0` (`backend/src/utils/displayDriver.js:56`); xdotool/wmctrl window control (`:104`, `:289-290`, `:319`); `--vout=gles2` "within Xorg" (`backend/src/services/vlcMprisService.js:64`); lxpanel/pcmanfm/lxsession (`backend/scripts/desktop-control.sh:14-37`) | **Yes** (default session); the X11 stack is present, one switch away | raspberrypi.com/news/a-new-release-of-raspberry-pi-os; RPi-Distro/raspi-config `trixie` branch source + debian/changelog; RPi-Distro/pi-gen stage3 package list; raspberrypi-ui/rpd-metas debian/control |
| 3 | PipeWire | 1.4.2 (Debian trixie package 1.4.2-1, Depends `pipewire-bin`); PipeWire is the audio server, `pipewire-pulse` gives the PulseAudio socket. `pw-play` and `pw-dump` are in `pipewire-bin`; `pactl` in `pulseaudio-utils`; `dbus-monitor` and `dbus-send` in `dbus-bin` (a dependency of `dbus` 1.16.2-2) | VLC started with `-A pulse` (`vlcMprisService.js:53`); `pactl` everywhere (`backend/src/services/audioRoutingService.js:158`, `:215`, `:948`); `pw-play` probed with `which` and spawned (`backend/src/services/soundService.js:44`, `:75`); `dbus-monitor --session` for MPRIS (`backend/src/services/mprisPlayerBase.js:205-207`) and `--system` for BlueZ (`bluetoothService.js:497-499`), parsed by `backend/src/utils/dbusSignalParser.js:39` | No (same mechanism, newer version). Bench check: `pactl info`, the `output:hdmi-stereo` profile | packages.debian.org/trixie/source/pipewire; /trixie/pipewire (Depends); /trixie/arm64/pipewire-bin/filelist; /trixie/arm64/pulseaudio-utils/filelist; /trixie/dbus (Depends); /trixie/arm64/dbus-bin/filelist |
| 4 | WirePlumber config format | 0.5.8 (trixie package 0.5.8-2). Since 0.5, Lua config files are not read at all; drop-ins are SPA-JSON `.conf` files in `wireplumber.conf.d/`, searched in `/etc/wireplumber/` for host overrides. Stream rules live under the `stream.rules` key; the stream script honours node props `state.restore-props` / `state.restore-target` equal to the string `"false"` | Lua drop-in at `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua` (`DEPLOYMENT_GUIDE.md:1168-1184`; `backend/CLAUDE.md:608`, `:619-651`; `docs/wireplumber/51-aln-vlc-no-restore.lua:18-28`); boot check of that exact path (`audioRoutingService.js:618`) | **Yes** | packages.debian.org/trixie/source/wireplumber; sources.debian.org wireplumber 0.5.8-2 debian/NEWS; WirePlumber docs: migration, conf_file, locations, settings; wireplumber 0.5.8 `src/scripts/node/state-stream.lua` |
| 5 | VLC | 3.0.23 (Debian 3.0.23-0+deb13u1; Pi build +rpt1, 2026-03-23). `libgles2_plugin.so` ships in `vlc-plugin-video-output`; `libdbus_plugin.so` (MPRIS `org.mpris.MediaPlayer2.vlc`) ships in `vlc-plugin-base`; Mesa V3D supports Pi 5 GLES | Unpinned `vlc` (`DEPLOYMENT_GUIDE.md:51`, `:1056`); `cvlc` (`vlcMprisService.js:114`); `--vout=gles2` on Pi 5 (`:75-77`); D-Bus MPRIS, no HTTP interface (`DEPLOYMENT_GUIDE.md:189`) | No | packages.debian.org/trixie/vlc; RPi-Distro/vlc tags; vlc-plugin-video-output and vlc-plugin-base file lists; videolan vlc-3.0 MODULES_LIST; vlc dbus.c; docs.mesa3d.org v3d |
| 6 | Chromium | Package and binary `chromium` (Debian 152.0.7977.82-1~deb13u1); `chromium-browser` was the pre-Bookworm Pi build. `--kiosk` is in Raspberry Pi's own kiosk tutorial; `--password-store=basic` is in Chromium's docs | `chromium-browser` package (`DEPLOYMENT_GUIDE.md:1056`, `:1290`, `:1295`), binary default (`displayDriver.js:165`; `DEPLOYMENT_GUIDE.md:257-261`; `backend/.env.example:171-172`); flags (`displayDriver.js:166-171`; `backend/CLAUDE.md:232`) | **Yes** (name); flags unchanged | packages.debian.org/trixie/chromium; raspberrypi.com kiosk tutorial; chromium password_storage.md; forums.raspberrypi.com t=339831 |
| 7 | Python | 3.13.5; `pip install` into the system interpreter is refused (PEP 668, `externally-managed-environment`); apt has python3-requests 2.32.3, python3-pil 11.1.0, python3-dotenv 1.0.1, python3-jsonschema 4.19.2; `fonts-dejavu-core` 2.37-8 is on the Desktop image (absent on Lite) | "Python 3" (`DEPLOYMENT_GUIDE.md:19`); `pip install -r scripts/requirements.txt` (`scripts/requirements.txt:2`); DejaVu Sans Mono at `/usr/share/fonts/truetype/dejavu/` (`scripts/sync_notion_to_tokens.py:207-208`), Liberation fallback (`:212-213`), PIL default (`:215`) | **Yes** (install method); fonts: no | downloads.raspberrypi.org image manifests (lite and desktop); Debian bookworm release notes 5.2.2; packages.debian.org trixie pages; forums.raspberrypi.com t=358400 |
| 8 | Node.js | Debian ships 20.19.2; NodeSource `setup_20.x` still runs on Trixie (no codename gate; keys re-signed Jan 2026 for 20/22/24); Node 20 reached end of life 2026-04-30 | Node 20+ via `setup_20.x` (`DEPLOYMENT_GUIDE.md:15`, `:46`, `:1055`); `engines.node >= 22.0.0` (`backend/package.json:127-129`); CI runs Node 22 (`.github/workflows/test.yml:33`, `rung1.yml:38`) | **Yes** (guide contradicts package.json; the fresh install makes it bite) | packages.debian.org/stable/nodejs; nodesource/distributions setup_20.x; nodesource.com GPG post; Node EOL schedule |
| 9 | Docker Engine | No Pi-OS-specific 64-bit package; Docker's Debian instructions cover Trixie and arm64, and `download.docker.com/linux/debian/dists/trixie/stable/binary-arm64/` exists; Debian's own `docker.io` 26.1.5 also installs | `curl -fsSL https://get.docker.com \| sudo sh` (`DEPLOYMENT_GUIDE.md:735`); `docker` on PATH (`backend/src/utils/dockerHelper.js:20`); existing container named `homeassistant` (`:743`; `backend/src/services/lightingService.js:459-462`) | No | docs.docker.com raspberry-pi-os and debian install pages; download.docker.com dists listing; packages.debian.org/trixie/docker.io |
| 10 | BlueZ | 5.82 (Bookworm had 5.66); preinstalled with the desktop. `bluetoothctl` 5.82 prints device lines with `"%s%s%sDevice %s %s\n"` and `show` prints `Powered:` via `print_property` — byte-identical to 5.66; the ChangeLog for 5.67–5.82 has no bluetoothctl output entry; `--timeout` is `bt_shell`'s own option (`src/shared/shell.c`) | No install step; "do not disable bluetooth" (`DEPLOYMENT_GUIDE.md:1538`); `bluetoothctl` output parsed by regex (`backend/src/services/bluetoothService.js:27`, `:33`, `:117-118`); `bluetoothctl --timeout N scan on` (`:165-170`); `dbus-monitor` on `org.bluez` (`:495-502`) | **No** (verified, §2.9); the bench pairing stays as an acceptance step, not a parser test | packages.debian.org/trixie/bluez and /bookworm/bluez; bluez 5.82 and 5.66 `client/main.c`; bluez 5.82 `ChangeLog`; bluez 5.82 `src/shared/shell.c` |
| 11 | xdotool, wmctrl | Both in trixie apt (xdotool 1:3.20160805.1-5.1; wmctrl 1.07+git20240228); both X11-only; they do not work under labwc (community reports; `wlrctl` is the Wayland replacement). Openbox, which W1 installs as the window manager, is an EWMH window manager — wmctrl's target | apt names (`backend/CLAUDE.md:231`; `DEPLOYMENT_GUIDE.md:51`); window control verified on Xorg (`displayDriver.js:9-18`) | Packages: no. Behaviour: tied to row 2 | packages.debian.org/trixie/xdotool and /wmctrl; forums.raspberrypi.com t=371406 |
| 12 | Static address, dnsmasq | NetworkManager (`nmcli`/`nmtui`) since Bookworm, unchanged; Trixie's nmcli writes new profiles under `/run/NetworkManager/system-connections` (trixie-feedback #3); `dnsmasq` 2.91 installable, not installed | nmcli, connection name discovered (`DEPLOYMENT_GUIDE.md:1103-1120`), placeholder 192.168.1.x (`:1111-1113`); no dnsmasq anywhere (DNS deferred: `ROADMAP.md:609`); `ufw` (`:1206`) | Mechanism: no. Persistence quirk plus the MAC-keyed reservation: action needed | raspberrypi.com configuration docs; bookworm announcement; packages.debian.org/trixie/dnsmasq; github raspberrypi/trixie-feedback #3 |
| 13 | Host timezone | Whatever the Imager's Localisation subtab was given (it autocompletes the zone from a capital city), else the image default; `timedatectl set-timezone` alters the `/etc/localtime` symlink | Derived from the host at runtime (`backend/src/utils/timezone.js:51-54`), published in `/health` (`backend/src/routes/healthRoutes.js:38`), applied by every ESP32 with `setenv("TZ", tz, 1); tzset()` (`arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:377-385`); the validator report prints `toLocaleString()` (`backend/scripts/validate-session.js:125`). The guide's Imager step names hostname, user, WiFi, SSH only (`DEPLOYMENT_GUIDE.md:1036-1037`) | **Yes** (machine state, not in git; nothing warns) | man7.org timedatectl(1); raspberrypi.com getting-started (Imager Localisation) |
| 14 | The certificate a clone delivers (repository fact, checked with `openssl x509` on 2026-09-12) | `backend/ssl/cert.pem`: `CN=10.0.0.177`, SAN `IP:10.0.0.177, DNS:raspberrypi.local, DNS:localhost`, valid 2025-10-24 → 2026-10-24; both files are in the checkout and no `.gitignore` excludes `backend/ssl/` (root `.gitignore`, 67 lines, has no ssl/pem/cert entry; `backend/` has no `.gitignore`). Chrome matches the SAN only (CN ignored since Chrome 58); an IP host needs an `iPAddress` SAN that matches exactly (RFC 2818 §3.1) | Served by default (`backend/.env.example:111-112`; `backend/ecosystem.config.js:22-23`); the guide's recipes emit no SAN (`DEPLOYMENT_GUIDE.md:454-458` `/CN=localhost`, `:463-467`); the plan says "blue's self-signed certificate copied to green, the warning accepted once per tablet" (`ROADMAP.md:772-775`) | **Yes** — at 192.168.0.191 this file is a name mismatch; what blue serves must be established, not assumed (§2.8) | developer.chrome.com chrome-58-deprecations; rfc-editor.org RFC 2818 §3.1; docs.openssl.org openssl-req (`-addext`) |
| 15 | Playwright on arm64 Debian 13 (rung 2 only) | Playwright's system requirements list "Debian 12 / 13, Ubuntu 22.04 / 24.04 / 26.04 (x86-64 or arm64)" and Node "latest 22.x, 24.x or 26.x" | `backend/playwright.config.js:81-92` declares the project as plain `chromium` (`devices['Desktop Chrome']`, no `executablePath`, no `channel`); CI runs `npx playwright install chromium --with-deps` (`.github/workflows/test.yml:269-271`); `playwright ^1.56.1`, `@playwright/test ^1.57.0` (`backend/package.json:122`, `:110`) | No (supported); fallback named in §6 | playwright.dev/docs/intro (system requirements) |
| 16 | Home Assistant `:stable` | Resolves to 2026.9.2 (released 2026-09-11) on 2026-09-12; UI scenes are stored in `scenes.yaml` in the config directory; `/api/config` reports `version` | `ghcr.io/home-assistant/home-assistant:stable` (`DEPLOYMENT_GUIDE.md:747`); the seven `scene.*` ids bound by `backend/config/profiles/aln-full-kit.json:48-66` exist only in the volume (`DEPLOYMENT_GUIDE.md:773-775`; `ROADMAP.md:754-756`) | Version skew against blue is unknown until read on blue; fix is to run blue's exact image (§3) | github.com/home-assistant/core/releases/latest; home-assistant.io scene editor docs; developers.home-assistant.io REST API; home-assistant.io container install; docs.docker.com pull by digest |

### 1b. Not covered by the readers: check on the bench, one command each

- After W1 X11 and a reboot: `echo $XDG_SESSION_TYPE` prints `x11`; `DISPLAY=:0 wmctrl -m` names Openbox; `DISPLAY=:0 xdotool getdisplaygeometry` prints the TV size; then `npm start`, the panel shows `display` healthy, the kiosk is on the TV, and one video plays through `--vout=gles2`. This is the gate for §2.1; §2.1 names the contingency.
- `command -v pactl pw-play dbus-monitor pw-dump` — `pactl` comes from `pulseaudio-utils`; the guide never installs it (CI does: `.github/workflows/test.yml:38`). `pw-play`/`pw-dump` come from `pipewire-bin`, `dbus-monitor` from `dbus-bin`; both are dependencies of packages the image carries, so they should already be present — the apt line in §5 names them anyway. (`mpc` is rig-only, `rung1.yml:70`; the engine speaks MPD directly, `backend/src/services/musicService.js:47-48`.)
- `pactl list cards short` then `pactl list sinks short` — the `output:hdmi-stereo` profile (`audioRoutingService.js:948`) and an HDMI sink must exist under PipeWire 1.4. The profile and `backend/config/environment/routing.json` use logical ids (`hdmi`, `bluetooth`), so no file carries a hardware sink name; any `bluez_output.*` sink is classed `bluetooth` at runtime (`audioRoutingService.js:247-248`).
- `command -v chromium-browser` — if a compatibility wrapper exists on Trixie nothing breaks; set `CHROMIUM_BIN` anyway.
- `raspi-config` → System Options → Boot / Auto Login — the "Desktop Autologin" entry (`DEPLOYMENT_GUIDE.md:1038-1041`) was not re-verified on Trixie.
- The `hdmi_*` lines in `/boot/firmware/config.txt` (`DEPLOYMENT_GUIDE.md:1072-1081`) are legacy firmware keys; whether the Pi 5 KMS driver honours them was not checked. Compare blue's file, and test a cold boot with the TV attached.
- Speaker pairing from the GM panel — an acceptance step (`CURRENT-STATE.md:73-74`), no longer a parser question (§2.9); if it fails, §2.9 names the by-hand route.
- `systemctl --user status wireplumber` after installing the `.conf` drop-in (§2.2): a parse error shows there. Then, with a video playing, `pw-dump | grep -c '"state.restore-props": "false"'` prints at least 1 — the only check that proves the rule matched VLC.
- `timedatectl` on both machines: `Time zone:` must match (§2.7).
- The MPD package version on Trixie was not checked; the orchestrator writes its own config (`musicService.js:47-48`), so only the "disable the system unit" step matters (`DEPLOYMENT_GUIDE.md:1059-1060`).

## 2. Each difference: what breaks, where, and the smallest fix

### 2.1 Wayland session (the largest)

What breaks. `displayDriver.js:56` sets `DISPLAY=:0` and `:104` finds the kiosk window with
`xdotool search --name`; `:289-290` bring it forward with `xdotool windowactivate` + `wmctrl -b add,fullscreen`;
`:319` hides it with `windowminimize`. Under labwc these have no X window manager to talk to. The kiosk is
never shown or hidden, and the driver reports the display service down (`displayDriver.js:208-212`, `:240`, `:377`).
VLC is started `--fullscreen --video-on-top` (`vlcMprisService.js:53-55`) with `--vout=gles2`, chosen for Xorg
(`:64`); under Wayland it would run through XWayland at best, untested. `desktop-control.sh:14-37` looks for
lxpanel, pcmanfm and lxsession; it is guarded (`pgrep` first) and becomes a no-op, which is harmless on a Pi 5.
The guide states the Xorg/LXDE assumption at `DEPLOYMENT_GUIDE.md:1030-1033` and depends on it at `:1122-1158`
(boot-to-running, `DISPLAY=:0`).

Smallest fix: a guide change. Add to step 0, right after imaging: `sudo raspi-config` → Advanced Options →
Wayland → **W1 X11** → reboot. Then check `echo $XDG_SESSION_TYPE` prints `x11` and
`DISPLAY=:0 xdotool getdisplaygeometry` prints the TV size. The readers confirmed the option labels from the
`trixie` branch of raspi-config; the numeric code of the Advanced Options entry (A6 in Oct 2024) was not
confirmed, so the guide should name the entry by its label.

Why the switch is more than a menu string (added on review). `do_wayland()` in the `trixie` branch offers
"W1 X11 — Openbox window manager with X11 backend" and, for W1, sets `/etc/lightdm/lightdm.conf`'s
`user-session`, `autologin-session` and `greeter-session` to `rpd-x` (or `LXDE-pi-x`) and asks to reboot.
That session exists on the Desktop image: pi-gen's desktop stage installs `rpd-wayland-core` AND `rpd-x-core`
(stage3 `00-packages-nr`), and `rpd-x-core` depends on `xserver-xorg, xinit, xcompmgr, x11-xserver-utils,
openbox, lxpanel-pi` and the `lpplug-*` panel plugins (rpd-metas `debian/control`); the Trixie announcement
names `rpd-x-core` as the base "for an X-based image". raspi-config's changelog through 20260730 removes
Wayfire twice and never X11. Openbox is an EWMH window manager, which is exactly what `wmctrl` drives
(packages.debian.org/trixie/wmctrl), so xdotool/wmctrl have a real target. What is NOT established by a source:
that VLC's `--vout=gles2` and the Chromium kiosk behave on Trixie's Xorg + Mesa on a Pi 5 — blue proves the
same combination on Bookworm's Xorg, and the bench gate in §1b is the proof for Trixie. Note that
`desktop-control.sh:14-37` expects `lxpanel`, `pcmanfm --desktop` and `lxsession`; the X stack now names
`lxpanel-pi` and no `lxsession`, so the prestart hook is a guarded no-op (~290 MB not freed; harmless).

Contingency, named. (a) If the desktop does not come up after W1: `grep -n session /etc/lightdm/lightdm.conf`
must show `rpd-x` on all three keys; `sudo apt install --reinstall rpd-x-core`; reboot. (b) If the session comes
up but a window cannot be controlled (`DISPLAY=:0 wmctrl -l` empty, or `xdotool search` finds nothing while the
kiosk is visible), do not debug it on show week: blue runs the show — rollback is physical and immediate
(`ROADMAP.md:448-450`) — and the Wayland display driver (`wlrctl`, forums t=371406) becomes a lane, not a bench
note. Raspberry Pi no longer develops the X11 path, so that lane is the real fix later; not this week.

### 2.2 WirePlumber drop-in format

What breaks. The guide (`DEPLOYMENT_GUIDE.md:1168-1184`), `backend/CLAUDE.md:608-651` and the canonical
file `docs/wireplumber/51-aln-vlc-no-restore.lua:18-28` install a Lua rule into `/etc/wireplumber/main.lua.d/`.
WirePlumber 0.5 does not read Lua config at all. WirePlumber then restores VLC's saved volume and mute on
every new stream, which is the 2026-05-22 incident (silent video audio after a restart). The only runtime
check is `audioRoutingService.js:618-629`: it tests that the Lua path exists and logs a warning. If the
owner copies blue's `.lua` file to green, the warning goes away and the rule still does nothing. That is
why the file must be recreated, not copied.

Where the replacement syntax comes from (added on review). WirePlumber 0.5.8's own stream script,
`src/scripts/node/state-stream.lua`, reads its rules with `Conf.get_section_as_json ("stream.rules", Json.Array {})`
and restores a stream's properties only when `Settings.get_boolean ("node.stream.restore-props")` is true AND
`stream_props ["state.restore-props"] ~= "false"`; the target likewise on `state.restore-target`. So the key is
`stream.rules`, the per-node switch is the node property `state.restore-props` / `state.restore-target`, and the
value the script compares against is the STRING `"false"` — write it quoted. The rule shape
(`matches = [ {…} ]`, `actions = { update-props = {…} }`) is the 0.5 form shown on the migration page for
`monitor.alsa.rules` and `monitor.bluez.rules`; the global `node.stream.restore-props` (default `true`, settings
page) stays on — only VLC opts out, as the Lua rule did (`docs/wireplumber/…lua:21`, `application.process.binary`
"vlc"; `cvlc` execs `vlc`).

Smallest fix: a config change on the machine, plus a guide change. Write this file:

```
# /etc/wireplumber/wireplumber.conf.d/51-aln-vlc-no-restore.conf
# ALN orchestrator: do not save or restore stream props/target for VLC.
# The orchestrator owns VLC's stream volume (audioRoutingService).
stream.rules = [
  {
    matches = [
      { application.process.binary = "vlc" }
    ]
    actions = {
      update-props = {
        state.restore-props = "false"
        state.restore-target = "false"
      }
    }
  }
]
```

Then `systemctl --user restart wireplumber && systemctl --user status wireplumber` (must be active; a
syntax error is in `journalctl --user -u wireplumber`). Unit check: play a video and run
`pw-dump | grep -c '"state.restore-props": "false"'` — at least 1 means the rule matched VLC's stream node
(`pw-dump` is in `pipewire-bin`; a wrong key passes the status check and fails this one). Prove it end to end:
set the video volume from the GM panel, restart the orchestrator, play again; the volume must be what the
orchestrator set. Code change (small, optional this week): make `audioRoutingService.js:618` accept either path
(`main.lua.d/…lua` or `wireplumber.conf.d/…conf`) so green does not warn on every boot. Add the `.conf`
beside the `.lua` under `docs/wireplumber/` and rewrite guide §5 and the CLAUDE.md section.

### 2.3 Chromium package and binary name

What breaks. `displayDriver.js:165` spawns `process.env.CHROMIUM_BIN || 'chromium-browser'`. With no such
binary the spawn errors, the driver reports `display` down (`:240`), and the scoreboard never appears on
the TV. The dev container already shows this exact failure (`docs/plans/2026-09-12-container-baseline.md:203`,
"spawn chromium-browser ENOENT"). The guide's apt lines (`DEPLOYMENT_GUIDE.md:1056`, `:1290`) fail on the
package name; `backend/.env.example:171-172` and `DEPLOYMENT_GUIDE.md:257-261` say the default is right
for Raspberry Pi OS, which was true on blue and is not on Trixie. The Pi 4 remote display
(`DEPLOYMENT_GUIDE.md:1287-1303`) is a separate machine and is not rebuilt this week; its section needs the
same rename whenever it is reimaged (and the labwc autostart file differs from `lxsession`, not checked).

Smallest fix: a config change. `sudo apt install chromium`, then in `backend/.env`:
`CHROMIUM_BIN=/usr/bin/chromium` (the seam already exists). The flags `--kiosk`, `--password-store=basic`
and `--ignore-certificate-errors` (`displayDriver.js:166-171`) are still valid. Guide change: the two apt
lines and the CHROMIUM_BIN note. Code change (optional): default to `chromium` when `chromium-browser` is
absent; the unit tests pin today's default (`backend/tests/unit/utils/displayDriver.test.js:64`, `:723`, `:746`).

### 2.4 Node version

What breaks. `DEPLOYMENT_GUIDE.md:46` and `:1055` run NodeSource `setup_20.x`; `backend/package.json:127-129`
declares `node >= 22.0.0`. `npm install` prints an engine warning and continues; the engine has not been
shown to fail on 20.19, but it is unsupported by its own manifest and Node 20 stopped receiving security
fixes on 2026-04-30. CI and the rung-1 rig run Node 22 (`.github/workflows/test.yml:33`, `rung1.yml:38`).
The scanner build (Vite 7, `ALNScanner/package.json:43`) needs Node 20.19+ or 22.12+; either passes.

Smallest fix: a guide change. `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -` at
`:46` and `:1055`, and "Node 22 (LTS)" at `:15`. NodeSource re-signed its repositories for Trixie in
January 2026 for the 20, 22 and 24 lines, so the script works as before.

### 2.5 Python packages

What breaks. `scripts/requirements.txt:2` says `pip install -r`. On Trixie that command exits with
`externally-managed-environment`. The sync script needs requests and Pillow, dotenv optionally, and
jsonschema as a soft dependency (`scripts/sync_notion_to_tokens.py:795-804`). Fonts are fine: the Desktop
image ships `fonts-dejavu-core`, which is the first path the script tries (`:207-208`). This only matters
on green if the Thursday token sync is run there (`docs/plans/CURRENT-STATE.md:74-75` says to practice it once).
`scripts/generate_asset_manifest.py` is exempt: it imports the standard library only (`:23-30`).

Smallest fix: a guide change and a comment change in `requirements.txt`. Either
`sudo apt install python3-requests python3-pil python3-dotenv python3-jsonschema`, or a venv:
`python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt`.

### 2.6 The reserved address

What breaks. `CONTEXT.md:439-446`: the kit router hands the Pi its address by DHCP reservation, and
`ROADMAP.md:446-447`: green takes the reserved address at cutover. A reservation is keyed to a MAC
address, and green's is new. Without a router change green boots on some other address and every
tablet and hardware scanner keeps calling 192.168.0.191. The guide's static-IP step is marked optional
and uses placeholders (`DEPLOYMENT_GUIDE.md:1101-1120`, `192.168.1.100`). On Trixie, a profile written by
`nmcli con mod` may land under `/run/NetworkManager/system-connections/` and be gone after a reboot.

Smallest fix: a cutover step, no change on green. On the router, move the 192.168.0.191 reservation from
blue's MAC to green's when blue is unplugged (the swap is physical and instant; rollback is the reverse).
If the address is set on green instead: `sudo nmcli con mod "<name>" ipv4.method manual
ipv4.addresses 192.168.0.191/24 ipv4.gateway <router> ipv4.dns <router>`, reboot, then
`ip addr` and `ls /etc/NetworkManager/system-connections/`; if the profile is only under `/run`, copy it
to `/etc/NetworkManager/system-connections/` (mode 600) and `nmcli con reload`. At home leave DHCP on;
two machines cannot hold the venue address at once. Guide change: the venue values and this note.

### 2.7 Host timezone (added on review)

What breaks. `backend/src/utils/timezone.js:51-54` derives the POSIX TZ string from the host
(`Intl.DateTimeFormat().resolvedOptions().timeZone`, i.e. `/etc/localtime`); `/health` publishes it
(`backend/src/routes/healthRoutes.js:38`); every hardware scanner reads `/health` and applies it with
`setenv("TZ", tz, 1); tzset()` (`OrchestratorService.h:377-385`), so every scan it stamps is in the host's zone;
the post-session validator prints session times with `toLocaleString()` (`backend/scripts/validate-session.js:125`).
A fresh image carries whatever the Imager's Localisation subtab was given (it autocompletes the zone from a
chosen capital city) or the default; blue's is already right. The guide's Imager step names hostname, user,
WiFi and SSH only (`DEPLOYMENT_GUIDE.md:1036-1037`) and §5 step 0 of the first draft repeated that. Nothing
warns; the error is invisible until a report is read after the show.

Smallest fix: a guide change (step 0) and one command. On blue: `timedatectl` (read the `Time zone:` line).
On green: `sudo timedatectl set-timezone <that zone>` (it alters the `/etc/localtime` symlink), or set it in the
Imager's Localisation subtab, or `raspi-config` → Localisation Options. Verify:
`curl -sk https://localhost:3000/health | grep -o '"timezone":"[^"]*"'` prints the same string on both machines.
Home Assistant's clock is separate: the guide's `docker run` (`:743-747`) passes no `-e TZ`, so HA uses the
`time_zone` in the copied volume (`/api/config` shows it) — nothing to do when the volume is copied.

### 2.8 The certificate (added on review)

What breaks. The checkout's `backend/ssl/cert.pem` is `CN=10.0.0.177` with SAN `IP:10.0.0.177,
DNS:raspberrypi.local, DNS:localhost`, valid 2025-10-24 to 2026-10-24 (after the 2026-09-18 show, inside the
season). It and `key.pem` are in the checkout and no `.gitignore` excludes `backend/ssl/` (the root file's 67
lines have no ssl/pem/cert entry; `backend/` has none): a fresh clone delivers this pair, and `npm start` serves
it (`.env.example:111-112`, `ecosystem.config.js:22-23`) with no warning. Chrome ignores the CN and matches only
the SAN (Chrome 58 removed CN matching), and for an IP host RFC 2818 §3.1 requires an `iPAddress` SAN that
"must exactly match the IP in the URI" — so at 192.168.0.191 this file is a name mismatch. Web NFC needs the
secure context (`DEPLOYMENT_GUIDE.md:445`); the brief's fact is only that the tablets accepted blue's certificate
once. Whether blue serves this file or one generated later for the venue address is not knowable from the
repository. The guide's recipes (`:454-458` `-subj "/CN=localhost"`, `:463-467` `/CN=your-pi-hostname.local`) emit
no SAN at all, so "regenerate per the guide" is not a working fallback. If the copy is skipped, or done after
the first `npm start` and never restarted, green serves the 10.0.0.177 file silently.

Smallest fix: a checked copy, then a guide change. (1) Establish what blue serves. On blue:
`openssl x509 -in ~/ALN-Ecosystem/backend/ssl/cert.pem -noout -fingerprint -sha256 -ext subjectAltName -enddate`;
from any kit-network machine: `openssl s_client -connect 192.168.0.191:3000 </dev/null 2>/dev/null | openssl x509
-noout -fingerprint -sha256 -ext subjectAltName -enddate`. Same fingerprint = the file on disk is what the tablets
accepted; the SAN and `notAfter` printed are the ones that matter. (2) Copy blue's pair to green AFTER the clone and
BEFORE the first `npm start`; `chmod 600 backend/ssl/key.pem`; `git status` will show `backend/ssl/*` modified —
leave it uncommitted and do not `git checkout`/`git pull` over it. Verify on green with the same `s_client` line
against `localhost:3000`: the fingerprint must equal blue's. (3) If `notAfter` falls before a show, or the SAN does
not name 192.168.0.191 and a tablet warns with a name error, regenerate WITH an IP SAN:
`openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout ssl/key.pem -out ssl/cert.pem -subj "/CN=192.168.0.191"
-addext "subjectAltName=IP:192.168.0.191,DNS:localhost"` (`-addext` is an `openssl req` option) — then every tablet and
the Pi 4 display warn and accept once again (`ROADMAP.md:772-775`). Guide change: replace `:451-467` with the SAN
recipe and the fingerprint check. Note for the record: the private key is in the repository history; secrets
rotation is deferred by ruling (`CURRENT-STATE.md:76-77`), and the real fix is row 8.19 (`ROADMAP.md:609`).

### 2.9 BlueZ 5.66 → 5.82: verified not a difference (added on review)

What the parser reads. `bluetoothService.js:27` `DEVICE_LINE_REGEX = /^Device ([0-9A-Fa-f:]{17}) (.+)$/`;
`:33` `SCAN_DEVICE_REGEX` matches `[NEW]`/`[CHG] Device <MAC> <name>` and already tolerates the colour escapes
`bluetoothctl` puts around NEW/CHG; `:117-118` runs `bluetoothctl show` and tests `/Powered:\s*yes/i`;
`:165-170` spawns `bluetoothctl --timeout <s> scan on`; `:495-502` watches `org.bluez` `PropertiesChanged` with
`dbus-monitor --system` (D-Bus, version-neutral).

What 5.82 prints (bluez `client/main.c` at tag 5.82, read 2026-09-12). `print_device()`:
`bt_shell_printf("%s%s%sDevice %s %s\n", description ? "[" : "", description ? : "", description ? "] " : "",
address, name)`, with `device_added()` calling `print_device(proxy, COLORED_NEW)` and `property_changed()` building
`"[" COLORED_CHG "] Device %s "`; `cmd_show()` calls `print_property(adapter->proxy, "Powered")` (and, since before
5.66, `"PowerState"` as an extra line). The 5.66 file has the same three code paths, character for character.
The ChangeLog from 5.67 to 5.82 contains no entry about `bluetoothctl` output, `show`, `devices`, `scan` or
`timeout`. `--timeout` is `bt_shell`'s own option (`src/shared/shell.c`: `{ "timeout", required_argument, 0, 't' }`,
"Timeout in seconds for non-interactive mode"), unchanged. So the regexes hold; row 10 is "No".

Smallest fix: none. Contingency, named: if the panel's scan/pair still fails on the bench, pair by hand —
`bluetoothctl`, then `scan on`, `pair <MAC>`, `trust <MAC>`, `connect <MAC>` — and check `pactl list sinks short`
shows `bluez_output.<MAC>.1`; the routing service classes any `bluez_output.*` sink as `bluetooth`
(`audioRoutingService.js:247-248`, `:1013-1014`), so no file needs the sink name and the profile carries only a
label (`aln-full-kit.json:28-32`, "W-KING X10"). Ducking on the real speaker (`ROADMAP.md:473-474`) is then
testable from the panel. A genuine parser failure would be a lane change to `:27`, `:33` or `:118` — known now,
not discovered on the bench.

### 2.10 Not differences, but worth one line each

- Docker: `get.docker.com` selects the Debian path and Trixie arm64 packages exist. Same as the guide.
- The `pi` user: `backend/ecosystem.config.js:94-98` (`user: 'pi'`, `/home/pi/...`) is only the unused
  `pm2 deploy` block; the guide never runs `pm2 deploy`. Imager sets the user name at flash time
  (`DEPLOYMENT_GUIDE.md:1036-1037`). No action.
- `ecosystem.config.js:4`, `:47`, `:70` say "8GB Pi" and cap memory at 2 GB; harmless on a Pi 5.
- The Pi 5 video settings now do live in the guide (`DEPLOYMENT_GUIDE.md:1083-1099`), pointing at
  `backend/CLAUDE.md:686-728`; Appendix C's "agent document only" line is out of date.
- `ufw` is not on a fresh image; the firewall section (`DEPLOYMENT_GUIDE.md:1202-1216`) can be skipped.
- Doc defect found on review: `DEPLOYMENT_GUIDE.md:810` says the scanner-side images/audio are in
  `ALN-TokenData/assets/`; that directory does not exist. They are in `aln-memory-scanner/assets/` (§4).

## 3. Copied from blue, not recreated

Blue is reachable as a network share; paths below are as they appear on blue's own disk. `~` is blue's
login user's home. Copy with a tool that keeps permissions (`rsync -a` over the share, or `cp -a`), then
fix ownership on green (`chown -R <green-user>` on the copied trees).

| What | Path on blue | Why copied, and the check | Source |
|---|---|---|---|
| Certificate and key | `~/ALN-Ecosystem/backend/ssl/cert.pem`, `~/ALN-Ecosystem/backend/ssl/key.pem` | The tablets and the Pi 4 display accepted the certificate blue SERVES once; a new one means every device warns again. First establish that this file is that certificate (sha256 fingerprint of the file = fingerprint from `openssl s_client -connect 192.168.0.191:3000`), read its SAN and `notAfter` (§2.8). Copy after the clone, before the first `npm start`, over the tracked 10.0.0.177 pair the clone delivers; key mode 600. If the fingerprints differ or the date fails, regenerate with the IP-SAN recipe instead. | `DEPLOYMENT_GUIDE.md:445`, `:447-517`; `backend/ecosystem.config.js:22-23`; `.env.example:111-112`; `ROADMAP.md:501-507`, `:772-775`; §2.8 |
| Environment file | `~/ALN-Ecosystem/backend/.env` | ADMIN_PASSWORD, JWT_SECRET, HOME_ASSISTANT_TOKEN and ~30 other keys. Mode 600. Then AUDIT for blue-only values: `grep -n -E '^(PACK_PATH\|PROFILE_PATH\|SSL_KEY_PATH\|SSL_CERT_PATH\|VIDEO_DIR\|HOME_ASSISTANT_URL\|HOME_ASSISTANT_TOKEN\|HA_DOCKER_CONTAINER\|SCOREBOARD_WINDOW_MARKER\|IDLE_LOOP_FILE\|CHROMIUM_BIN)=' backend/.env`. Rules: `PACK_PATH`/`PROFILE_PATH` are "LOUD warn when active" seams a production machine leaves unset (`.env.example:68-74`) — an absolute path from blue's disk does not refuse boot, it degrades lighting and the idle loop (`DEPLOYMENT_GUIDE.md:717-721`), so delete or repoint; `SSL_*_PATH` stay relative `./ssl/…` (`:111-112`); `HOME_ASSISTANT_URL` stays `http://localhost:8123` (`:139`); `HOME_ASSISTANT_TOKEN` (`:140`) was issued by the HA instance in the copied volume and is valid only with that volume — if HA is recreated from scratch, mint a new token; `HA_DOCKER_CONTAINER` (`:147`) must equal the `docker run --name` (`DEPLOYMENT_GUIDE.md:740-741`); set `CHROMIUM_BIN=/usr/bin/chromium` (§2.3); `SCOREBOARD_WINDOW_MARKER` (`:162`) and `IDLE_LOOP_FILE` (`:168`) are normally unset. Then key-set diff against `.env.example`: a key in one and not the other is a doc defect (`ROADMAP.md:765-768`, Appendix C's five undocumented keys are exactly this list). | `DEPLOYMENT_GUIDE.md:119-165`; `.gitignore:55`; `backend/.env.example:60`, `:66-74`, `:108-112`, `:136-147`, `:162`, `:168`, `:170-172` |
| Home Assistant volume | `~/ha-config/` (the directory mounted at `/config`) | The seven `scene.*` definitions (`scenes.yaml` — the scene editor reads and writes that file), the owner account, and the long-lived token exist only here. Copy before the first `docker run` and mount the copy. VERSION: on 2026-09-12 `:stable` is 2026.9.2 (released 2026-09-11); blue's version is unknown to this document — read it on blue with `curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" http://localhost:8123/api/config` (field `version`) and blue's image with `docker inspect homeassistant --format '{{.Config.Image}}'` + `docker images --digests ghcr.io/home-assistant/home-assistant`. Smallest fix: run green on blue's EXACT image — `docker run … ghcr.io/home-assistant/home-assistant@sha256:<blue's digest>` in place of `:stable` — so no migration happens this week; upgrade both later. If `:stable` is used anyway, HA migrates `.storage` on first start (watch `docker logs homeassistant`); `scenes.yaml` is not part of that migration. Either way, verify: `curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8123/api/states \| grep -o '"entity_id":"scene\.[a-z0-9_]*"' \| sort` lists the seven ids of `aln-full-kit.json:48-66`, then one scene from the GM panel on a bulb. Fallback (days, so do the version check first): author the seven scenes by hand from the profile's bindings (`DEPLOYMENT_GUIDE.md:785-790`). The bulb integrations copy too; at the venue blue and green never run at once. | `DEPLOYMENT_GUIDE.md:742-747`, `:771-790` (owner task `:777`); `ROADMAP.md:501-507`, `:754-756`; §7 Home Assistant, Docker |
| Game videos | `~/ALN-Ecosystem/backend/public/videos/*.mp4` incl. `idle-loop.mp4` | Git-excluded (`.gitignore:10`); every non-null `video` in tokens.json plus the profile's `bindings.surfaces` file. Must be HEVC. `loopimages/` is in git. Verify with the guide's block 1 (`:841-847`): the node one-liner prints `videos OK` and `ls public/videos/idle-loop.mp4` succeeds. | `DEPLOYMENT_GUIDE.md:814-832`, `:836-847`; `backend/config/profiles/aln-full-kit.json:71` |
| Music library | `~/ALN-Ecosystem/backend/public/music/` | Git-excluded (`.gitignore:17-19`); `music-playlists.json` references it. Run `npm run music:seed` after (guide block 3, `:856-857`). | `DEPLOYMENT_GUIDE.md:819`, `:828`, `:857` |
| Cue sounds | `~/ALN-Ecosystem/backend/public/audio/` | In git: seven wav files in the checkout (`15min`, `30min`, `60min`, `90min`, `attention`, `policesounds`, `tension`), which are exactly the seven `ALN-TokenData/cues.json` references; `test_tone.wav` is the gitignored E2E scratch copy (`.gitignore:21-26`), not content. Copy only files blue has that git lacks. Verify with the guide's block 2 (`:849-854`): prints `sounds OK`. | `DEPLOYMENT_GUIDE.md:820`, `:829`, `:849-854`; `.gitignore:26` |

Read on blue, but not copied:

- `~/ALN-Ecosystem/ALN-TokenData/pack-manifest.json` — its `contentHash` identifies the pack blue runs;
  check out the same commit on green (§4) so `/health` reports the same hash (`DEPLOYMENT_GUIDE.md:1659-1661`).
- `/boot/firmware/config.txt` and `cmdline.txt` — compare the HDMI lines against `DEPLOYMENT_GUIDE.md:1074-1081`; do not copy a Bookworm boot config onto Trixie.
- `~/ALN-Ecosystem/backend/config/profiles/aln-full-kit.json` — diff against git; carry any hand edit as a commit, not a copy (§4 has the verification).
- `~/ALN-Ecosystem/backend/.env` versus `backend/.env.example` — a key present in one and not the other is a doc defect to report (`ROADMAP.md:765-766`).
- `timedatectl` — the `Time zone:` line (§2.7).
- Home Assistant's `version` (`/api/config`) and image digest (`docker images --digests`) — the pin for green (§3 table).
- The served certificate's sha256 fingerprint, SAN and `notAfter` (§2.8).

Not carried over, by design:

- `~/ALN-Ecosystem/backend/data/` — a new machine starts clean (`DEPLOYMENT_GUIDE.md:832-834`); it is the backup medium's job (`:1638`).
- `~/.pm2/` — regenerated by `pm2 save` and `pm2 startup` (`DEPLOYMENT_GUIDE.md:1131-1132`).
- `/var/lib/bluetooth/` — re-pair the speaker from the GM panel; pairing is per computer and safe (`ROADMAP.md:491-492`).
- `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua` — replaced by the `.conf` in §2.2.
- Audio routing volumes (in `backend/data/`) — reset to defaults from `backend/config/environment/routing.json`.

## 4. Pulled from git

- Repository: `https://github.com/maxepunk/ALN-Ecosystem.git` (the guide's `[user]` placeholder at
  `DEPLOYMENT_GUIDE.md:33`, `:1067`; the issue tracker names the owner in `CLAUDE.md`). Branch `main`.
  `git clone --recurse-submodules … ~/ALN-Ecosystem` then `git submodule update --init --recursive`.
- Submodules (`CLAUDE.md` "Submodule Architecture"): `ALN-TokenData` (the pack the backend reads,
  `DEPLOYMENT_GUIDE.md:671-674`), `ALNScanner` with nested `data`, `aln-memory-scanner` with nested `data`,
  `arduino-cyd-player-scanner`. All on `main`. Pin `ALN-TokenData` to blue's pack commit
  (`git -C ALN-TokenData checkout <sha>`), verify with `node backend/scripts/build-pack-manifest.js ALN-TokenData && git -C ALN-TokenData diff --quiet pack-manifest.json` (`DEPLOYMENT_GUIDE.md:1669`).
- ESP32 asset corpus (added on review): `aln-memory-scanner/assets/` — 127 BMPs in `images/`, 3 audio files
  (`asm031.wav`, `rat031.mp3`, `tac001.wav`) and `manifest.json` (13 KB). The backend serves asset sync from
  there (`backend/src/routes/resourceRoutes.js:17-22` resolves `ASSET_ROOT`, `IMAGES_DIR`, `AUDIO_DIR`,
  `MANIFEST_PATH` into the submodule); `aln-memory-scanner/.gitignore` has two lines (`node_modules/`,
  `coverage/`), so the manifest and corpus arrive with the clone. The guide's `ALN-TokenData/assets/`
  (`DEPLOYMENT_GUIDE.md:810`) does not exist. The manifest embeds the pack identity read from
  `pack-manifest.json` (`scripts/generate_asset_manifest.py:87-101`), so after pinning the pack commit check
  `curl -sk https://localhost:3000/api/assets/manifest | grep -o '"contentHash":"[^"]*"'` against `/health`'s
  `pack.contentHash`; on a mismatch, or on 404 ("Asset manifest not generated yet", `resourceRoutes.js:74-76`),
  run `python3 scripts/generate_asset_manifest.py` (standard library only, `:23-30`; optional assets-root
  argument, `:192-199`) and re-check. Then one hardware scanner does a full sync (`ROADMAP.md:475-476`;
  `CURRENT-STATE.md:74`) — the Stage-B gate this corpus exists for.
- Installation profile (added on review): `backend/config/profiles/aln-full-kit.json` is in git and the
  default path (`DEPLOYMENT_GUIDE.md:704-705`); `PROFILE_PATH` must be unset (§3, `.env` audit). Verify it
  bound: `/health` reports `profile` (`healthRoutes.js:45`), and after boot fire one lighting cue or activate a
  scene from the panel and grep the log — zero L7/L12 warnings (`DEPLOYMENT_GUIDE.md:722-724`).
- Built on green:
  - `backend/`: `npm install` (`DEPLOYMENT_GUIDE.md:1069`).
  - GM scanner: `ALNScanner/` `npm ci && npm run build`; `npm start` does it through the prestart hook
    (`backend/package.json` scripts `prestart` → `backend/scripts/build-scanner.sh:24-33`). Served through
    the in-repo symlink `backend/public/gm-scanner → ../../ALNScanner/dist`.
  - Player scanner: no build; served through the symlink `backend/public/player-scanner → ../../aln-memory-scanner`.
  - Music playlist: `npm run music:seed` after the copy (`DEPLOYMENT_GUIDE.md:857`).
  - Asset manifest: only on the mismatch/404 above.
- Not on green: ESP32 firmware is flashed to the scanners separately (`CURRENT-STATE.md:74`).

## 5. Installed, in the guide's order, with renames and additions

| Step | Guide | Fresh Trixie install | Change |
|---|---|---|---|
| 0 | Imager: 64-bit Desktop, user, hostname, WiFi, SSH (`:1036-1037`) | Same, plus the Localisation subtab set to blue's time zone (or `timedatectl set-timezone` after boot, §2.7); the image is Trixie | **added** (timezone) |
| 0 | `raspi-config` → Desktop Autologin (`:1038-1041`) | Same entry expected (not re-verified) | verify |
| 0 | — | `raspi-config` → Advanced Options → Wayland → **W1 X11**, reboot; §1b's session check | **added** |
| 0 | `usermod -aG video,audio,bluetooth $USER` (`:1044`) | Same | none |
| 1 | `apt update && apt upgrade -y` (`:1052`) | Same | none |
| 1 | NodeSource `setup_20.x` (`:1055`) | `setup_22.x` | **changed** |
| 1 | `apt install nodejs vlc mpd git xdotool wmctrl chromium-browser` (`:1056`) | `apt install nodejs vlc mpd git xdotool wmctrl chromium pulseaudio-utils pipewire-bin dbus-bin` | **renamed** chromium; **added** pulseaudio-utils (`pactl`), pipewire-bin (`pw-play`, `pw-dump`), dbus-bin (`dbus-monitor`) — the last two are dependencies of `pipewire`/`dbus` and normally present; naming them is idempotent |
| 1 | disable `mpd`, `mpd.socket` (`:1059-1060`) | Same | none |
| 1 | `npm install -g pm2` (`:1063`) | Same | none |
| 1 | clone, `npm install` (`:1067-1069`) | Same; pin the pack commit (§4) | none |
| 1b | — | Certificate: fingerprint check on blue, copy the served pair over the tracked one, before the first `npm start` (§2.8) | **added** |
| 2 | HDMI lines in `/boot/firmware/config.txt` (`:1074-1081`) | Same path; keys may be ignored on Pi 5 (§1b) | verify |
| 2b | HEVC only, `--vout=gles2` (`:1083-1099`) | Same | none |
| 3 | static IP by nmcli (`:1101-1120`) | Router reservation at cutover, or nmcli with the persistence check (§2.6) | **changed** |
| 4 | `npm start`, `pm2 save`, `pm2 startup` (`:1130-1132`) | Same; the boot-race test (`:1152-1158`) runs on X11 as before | none |
| 4b | Media verify (`:836-858`) | Same: blocks 1 (videos + idle loop), 2 (cue sounds), 3 (`music:seed`); plus the asset-manifest hash check (§4) | **carried in** (was missing from the first draft) |
| 5 | WirePlumber Lua drop-in (`:1168-1184`) | The `.conf` drop-in of §2.2, with the `pw-dump` check | **changed** |
| HA | `get.docker.com`, `usermod -aG docker`, `docker run … -v ~/ha-config:/config … :stable` (`:735-747`) | Same, with the copied `~/ha-config` and blue's image digest in place of `:stable`; the seven-scene check (§3) | **changed** (version pin) |
| — | `ufw` rules (`:1206-1208`) | `ufw` is absent; skip | skip |
| — | `pip install -r scripts/requirements.txt` (`scripts/requirements.txt:2`) | apt `python3-requests python3-pil python3-dotenv python3-jsonschema`, or a venv | **changed** (optional on green) |

## 6. Green as the home development environment afterwards (rung 2)

Ruling R17 (`docs/plans/2026-09-12-block2-hardening-plan.md:52`): once green is ready, development moves
to it as the real-substitute-hardware rung. The test tooling and where it collides with the production install:

What the suites need on the machine:

- Unit and contract (`npm test`): Node 22 and `pulseaudio-utils` (`.github/workflows/test.yml:38`). Nothing else.
- Integration (`npm run test:integration`): same, plus Docker for `test:docker` (`backend/package.json` scripts, `sg docker`).
- E2E (`npm run test:e2e`, `test:e2e:tier-l`): Playwright's own Chromium. `backend/playwright.config.js:81-92`
  declares the project as plain `chromium` (`devices['Desktop Chrome']`, launch args only — no `executablePath`,
  no `channel`), so the suites need `npx playwright install chromium --with-deps` (`test.yml:269-271`) to have
  succeeded; Playwright's system requirements list "Debian 12 / 13, Ubuntu 22.04 / 24.04 / 26.04 (x86-64 or
  arm64)" (playwright.dev, read 2026-09-12), so it is expected to install on green (`playwright ^1.56.1`,
  `@playwright/test ^1.57.0`, `backend/package.json:122`, `:110`). If it does not: a one-line code change,
  `launchOptions.executablePath: process.env.CHROMIUM_BIN || undefined` at `playwright.config.js:89`, pointing at
  the system `chromium`. Plus the rung-1 stack: `vlc-bin vlc-plugin-base dbus xvfb xdotool pipewire pipewire-pulse
  wireplumber pulseaudio-utils bluez python3-dbusmock python3-dbus` (`test.yml:289`).
- The rung-1 rig (`backend/tests/rung1/up.sh`, `engine.sh`, `probe.sh`): the same plus `mpd mpc wmctrl
  bluez-test-tools` (`rung1.yml:69-76`); `up.sh` runs as root and resolves its kiosk browser as `CHROMIUM_BIN` →
  `/opt/pw-browsers/chromium` → Playwright's own executable path (`up.sh:85-99`) — that fallback covers the rig,
  not the Playwright suites.
- Blue's frozen state is the rollback; the production checkout must stay on `main`. Use a second clone
  (e.g. `~/dev/ALN-Ecosystem`) for branches and worktrees; the `gm-scanner` symlink is per checkout, so a
  dev clone is self-contained. A branch checkout in `~/ALN-Ecosystem` changes what PM2 runs at the next restart.

Where it collides with production on the same machine:

| Resource | Production (PM2 orchestrator) | Rig / E2E | Collision and rule |
|---|---|---|---|
| Users | Everything as the desktop login user (`up.sh:5-8` describes the venue) | `up.sh:29,38` creates `rung1vlc`; `engine.sh:48` boots the engine as it; `up.sh` itself needs root | Two users share `/tmp`. Run `sudo bash tests/rung1/down.sh` and `sudo rm -f /tmp/aln-*` before `pm2 start`, or the production engine cannot write its own files. |
| `/tmp` state | `/tmp/aln-mpd.*` (`musicService.js:47-48`), `/tmp/aln-pm-*.pid` (`vlcMprisService.js:117`; `displayDriver.js:53`; `bluetoothService.js:501`; `mprisPlayerBase.js:209`) | Same names, swept by `up.sh:47-54` only when no `node src/server.js` runs; `engine.sh:31-41` refuses on foreign-owned files | One engine at a time. `pm2 stop aln-orchestrator` before the rig or E2E. |
| Ports | 3000 (HTTPS), 8000 (redirect), 8888/udp (discovery) | Rig engine 3199 (`engine.sh:14`); E2E suites start their own orchestrators on dynamic ports (`tests/e2e/setup/test-server.js:153`); Playwright's `webServer` block is commented out (`backend/playwright.config.js:124-135`), `baseURL` defaults to `https://localhost:3000` (`:55`) | No port clash by itself (corrected on review: the first draft said the webServer collides on 3000); PM2 is still stopped first because of the `/tmp`, VLC and kiosk rows. |
| Home Assistant, port 8123 | Container `homeassistant`, host network (`DEPLOYMENT_GUIDE.md:743-747`); restarted by the engine at boot (`lightingService.js:451-479`) | Container `rung1-ha`, host network (`provision.js:34`, `:470-471`); `provision.js:146-150` refuses when 8123 answers and `rung1-ha` is not the one running | `docker stop homeassistant` before the rig; `docker start homeassistant` (or a PM2 restart) after. Never let the rig adopt the real HA: the refuse-foreign guard exists for this. |
| VLC and MPRIS | `cvlc` owning `org.mpris.MediaPlayer2.vlc` on the user's session bus, on `:0` | Rig: private session bus (`up.sh:60`), Xvfb `:99` (`up.sh:62`, `provision.js:316-320`). E2E harness: `vlc-service.js:98-104` uses the ambient bus and `DISPLAY` default `:0`; `session-env.js:60` puts the display on `:99` | E2E without PM2 stopped means two VLCs on one bus name and one screen. Also `displayDriver.js:147` kills any `chromium … --kiosk` on launch, so a second engine kills the production kiosk. |
| Audio session | The login user's PipeWire, HDMI and Bluetooth sinks, the WirePlumber `.conf` | Rig: its own PipeWire under `XDG_RUNTIME_DIR=/tmp/rung1/xdg` with null sinks (`provision.js:345`, `:378`) | Separate by design. Check once that the rig's PipeWire does not claim the HDMI card (`pactl list cards` in both contexts); if it does, production audio is stolen while the rig runs. |
| Bluetooth | Real BlueZ on the system bus | Mock on a private system bus (`up.sh:118-120`); `btvirt` needs `/dev/vhci` (`probe.sh:45-53`), untested on the Pi kernel | Separate. `probe.sh` records the gap with a reason. |
| Data and logs | `backend/data/`, `backend/logs/` | Rig `/tmp/rung1/engine-data`, `engine-logs` (`up.sh:113-114`); E2E `/tmp/aln-e2e-env/w<slot>` (`test-server.js:83`) | Separate. |
| Desktop | `npm start` prestart stops lxpanel/pcmanfm (`desktop-control.sh`); `npm run stop` restores | The rig does not touch the desktop | None; on Trixie X11 the script is a no-op (§2.1: the panel is `lxpanel-pi`, there is no `lxsession`). |

Short form: on green, testing and the show never run at the same time. Sequence: `pm2 stop aln-orchestrator`,
`docker stop homeassistant`, run the rig or the suites, `sudo bash tests/rung1/down.sh`, `sudo rm -f /tmp/aln-*`,
`docker start homeassistant`, `pm2 start aln-orchestrator`. The preflight on the GM panel is the check that
production is whole again.

## 7. Sources (all read 2026-09-12)

OS and session
- https://www.raspberrypi.com/software/operating-systems/ — "Release Date: 18 Jun 2026; Codename: Trixie; Kernel 6.18; Debian 13 (trixie)".
- https://www.raspberrypi.com/documentation/computers/os.html — "The latest version of Raspberry Pi OS is based on Debian Trixie."
- https://www.raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os/ — Trixie announcement, 2 Oct 2025; "you can now get a base desktop by installing either the rpd-wayland-core (Wayland) or rpd-x-core packages"; "For an X-based image, install rpd-x-core."
- https://www.debian.org/releases/trixie/ — Debian 13 is trixie.
- https://www.raspberrypi.com/news/a-new-release-of-raspberry-pi-os/ — "Raspberry Pi Desktop now runs Wayland by default across all models"; the A6 Wayland / W1 X11 menu path (Oct 2024).
- https://raw.githubusercontent.com/RPi-Distro/raspi-config/trixie/raspi-config — `do_wayland()`: "W1 X11" "Openbox window manager with X11 backend", "W2 Labwc"; W1 sets lightdm `user-session`/`autologin-session`/`greeter-session` to `rpd-x` (or `LXDE-pi-x`), `ASK_TO_REBOOT=1`.
- https://raw.githubusercontent.com/RPi-Distro/raspi-config/trixie/debian/changelog — topmost 20260730; "Remove wayfire option" (20250814), "Remove wayfire support" (20260710); no entry removes X11.
- https://raw.githubusercontent.com/RPi-Distro/pi-gen/master/stage3/00-install-packages/00-packages-nr — the desktop stage's package list: `rpd-wayland-core`, `rpd-x-core` (the `trixie` branch path 404'd; `master` builds the current release). stage4 adds `rpd-x-extras`, `rpd-wayland-extras`.
- https://raw.githubusercontent.com/raspberrypi-ui/rpd-metas/master/debian/control — `rpd-x-core` Depends: `rpd-common, xserver-xorg, xinit, gldriver-test, xcompmgr, x11-xserver-utils, openbox, lxpanel-pi, lpplug-*`; `rpd-wayland-core` Depends: `labwc, wf-panel-pi, …`.
- https://en.wikipedia.org/wiki/Raspberry_Pi_OS — latest release 6.3, 18 June 2026; labwc default.

PipeWire and WirePlumber
- https://packages.debian.org/trixie/source/pipewire — pipewire 1.4.2-1.
- https://packages.debian.org/trixie/pipewire — Depends `pipewire-bin (= 1.4.2-1)`.
- https://packages.debian.org/trixie/arm64/pipewire-bin/filelist — `/usr/bin/pw-play`, `/usr/bin/pw-dump`, `/usr/bin/pw-cli`, ….
- https://packages.debian.org/trixie/arm64/pulseaudio-utils/filelist — `/usr/bin/pactl`.
- https://packages.debian.org/trixie/dbus — dbus 1.16.2-2 Depends `dbus-bin`, `dbus-daemon`.
- https://packages.debian.org/trixie/arm64/dbus-bin/filelist — `/usr/bin/dbus-monitor`, `/usr/bin/dbus-send`.
- https://packages.debian.org/trixie/mpc — mpc 0.35-1 (rig only).
- https://packages.debian.org/trixie/source/wireplumber — wireplumber 0.5.8-2.
- https://sources.debian.org/src/wireplumber/0.5.8-2/debian/NEWS/ — 0.5 config is JSON, incompatible with 0.4 Lua files.
- https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/migration.html — "Starting with WirePlumber 0.5, Lua configuration files are no longer supported"; `wireplumber.conf.d/` replaces `main.lua.d/`; the 0.5 rule form `matches = [ … ] actions = { update-props = { … } }` (examples `monitor.alsa.rules`, `monitor.bluez.rules`).
- https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/settings.html — `node.stream.restore-props` (default true: "restore the previously stored stream parameters when the stream is activated"), `node.stream.restore-target` (default true).
- https://raw.githubusercontent.com/PipeWire/wireplumber/0.5.8/src/scripts/node/state-stream.lua — `Conf.get_section_as_json ("stream.rules", Json.Array {})`; `stream_props ["state.restore-props"] ~= "false"`; `stream_props ["state.restore-target"] ~= "false"` (GitHub mirror; gitlab.freedesktop.org refused the fetch, §8).
- https://raw.githubusercontent.com/PipeWire/wireplumber/0.5.8/src/config/wireplumber.conf — no `stream.rules` in the default file (the host drop-in supplies it); settings schema lists `node.stream.restore-props`, `node.stream.restore-target`.
- https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/conf_file.html — `.d` directory loading.
- https://pipewire.pages.freedesktop.org/wireplumber/daemon/locations.html — search order incl. `/etc/wireplumber`.

VLC
- https://packages.debian.org/trixie/vlc — 3.0.23-0+deb13u1.
- https://github.com/RPi-Distro/vlc/tags — `pios/1:3.0.23-0+deb13u1+rpt1`, 23 Mar 2026.
- https://packages.debian.org/trixie/arm64/vlc-plugin-video-output/filelist — `libgles2_plugin.so`.
- https://packages.debian.org/trixie/arm64/vlc-plugin-base/filelist — `libdbus_plugin.so`.
- https://github.com/videolan/vlc-3.0/blob/master/modules/MODULES_LIST — gles2 module.
- https://github.com/RPi-Distro/vlc/blob/pios/trixie/debian/control — build-depends on GLES/EGL and libdbus.
- https://github.com/videolan/vlc/blob/master/modules/control/dbus/dbus.c — `org.mpris.MediaPlayer2.vlc`.
- https://docs.mesa3d.org/drivers/v3d.html — V3D 7.1 on Raspberry Pi 5, conformant GLES 3.1.
- https://forums.raspberrypi.com/viewtopic.php?t=393434 — Pi 5 kiosk threads favour `--vout=drm` (context only).

Chromium
- https://packages.debian.org/trixie/chromium — chromium 152.0.7977.82-1~deb13u1.
- https://packages.debian.org/bookworm/chromium — bookworm is oldstable.
- https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/ — `chromium … --kiosk …`.
- https://chromium.googlesource.com/chromium/src/+/master/docs/linux/password_storage.md — `--password-store=basic`.
- https://forums.raspberrypi.com/viewtopic.php?t=339831 — `chromium-browser` was the Pi-customised build.

Certificate
- https://developer.chrome.com/blog/chrome-58-deprecations — "Remove support for commonName matching in certificates"; only `subjectAlternativeName` "leaves it unambiguous whether a certificate is expressing a binding to an IP address or a domain name".
- https://www.rfc-editor.org/rfc/rfc2818 — §3.1: "the iPAddress subjectAltName must be present in the certificate and must exactly match the IP in the URI."
- https://docs.openssl.org/master/man1/openssl-req/ — `-addext ext`: "Add a specific extension to the certificate (if -x509 is in use)"; example `-addext "subjectAltName = DNS:foo.co.uk"`; `-days` "number of days from today to certify the certificate for".

Python and fonts
- https://downloads.raspberrypi.org/raspios_lite_arm64/images/raspios_lite_arm64-2026-06-19/2026-06-18-raspios-trixie-arm64-lite.info — python3 3.13.5-1, python3-venv; no font packages (read by the Python reader; 403 on the revision pass, §8).
- https://downloads.raspberrypi.org/raspios_arm64/images/raspios_arm64-2026-06-19/2026-06-18-raspios-trixie-arm64.info — fonts-dejavu-core 2.37-8, python3-pip present (same).
- https://www.debian.org/releases/bookworm/amd64/release-notes/ch-information.en.html — §5.2.2 externally-managed interpreters.
- https://www.debian.org/releases/trixie/release-notes/issues.en.html — no change to that policy in trixie.
- https://forums.raspberrypi.com/viewtopic.php?t=358400 — the `externally-managed-environment` error on Raspberry Pi OS.
- https://packages.debian.org/trixie/python3-requests, /python3-pil, /python3-dotenv, /python3-jsonschema, /fonts-dejavu-core — versions in §1 row 7.

Node.js
- https://packages.debian.org/stable/nodejs and https://packages.debian.org/source/trixie/nodejs — 20.19.2+dfsg-1+deb13u2, arm64.
- https://github.com/nodesource/distributions/blob/master/scripts/deb/setup_20.x — checks `/etc/debian_version` only.
- https://nodesource.com/blog/gpg-signature-warnings-debian-13-ubuntu-nodesource — keys re-signed for Debian 13; applies to Node 20, 22, 24.
- https://nodesource.com/blog/nodesource-nodejs-binary-distributions-new-page — install scripts keep working.
- https://dev.to/endoflifeai/nodejs-end-of-life-dates-official-eol-schedule-for-every-version-6do — Node 20 EOL 30 Apr 2026.

Docker and Home Assistant
- https://docs.docker.com/engine/install/raspberry-pi-os/ — 64-bit users follow the Debian instructions.
- https://docs.docker.com/engine/install/debian/ — Trixie 13 and Bookworm 12; arm64 supported.
- https://download.docker.com/linux/debian/dists/ and …/dists/trixie/stable/ — `trixie/` and `binary-arm64/` exist.
- https://packages.debian.org/trixie/docker.io — 26.1.5+dfsg1-9+deb13u1.
- https://docs.docker.com/reference/cli/docker/image/pull/ — "Pull an image by digest": `docker pull <image>@sha256:…` "allows you to 'pin' an image to that version, and guarantee that the image you're using is always the same".
- https://docs.docker.com/reference/cli/docker/image/ls/ — `docker images --digests` shows the DIGEST column (the flag used to read blue's digest).
- https://github.com/home-assistant/core/releases/latest — Release 2026.9.2, published 11 Sep 2026 (what `:stable` resolves to on 2026-09-12).
- https://www.home-assistant.io/installation/linux — the container `docker run … ghcr.io/home-assistant/home-assistant:stable`; update = `docker pull …:stable`, `docker stop`, `docker rm`, re-run.
- https://developers.home-assistant.io/docs/api/rest/ — `GET /api/config` returns `version`, `time_zone`, …; `GET /api/states` returns every entity's `entity_id`; header `Authorization: Bearer TOKEN`.
- https://www.home-assistant.io/docs/scene/editor/ — "The scene editor reads and writes to the file `scenes.yaml` in the root of your configuration folder"; each scene has an `id`.

BlueZ, xdotool, wmctrl
- https://packages.debian.org/trixie/bluez — 5.82-1.1; https://packages.debian.org/bookworm/bluez — 5.66-1+deb12u2.
- https://raw.githubusercontent.com/bluez/bluez/5.82/client/main.c — `print_device()`: `"%s%s%sDevice %s %s\n"`; `device_added()` → `print_device(proxy, COLORED_NEW)`; `property_changed()` → `"[" COLORED_CHG "] Device %s "`; `cmd_show()` → `print_property(adapter->proxy, "Powered")`, `"PowerState"`.
- https://raw.githubusercontent.com/bluez/bluez/5.66/client/main.c — the same three code paths, identical.
- https://raw.githubusercontent.com/bluez/bluez/5.82/ChangeLog — no entry 5.67–5.82 mentions bluetoothctl output, `show`, `devices`, `scan` or `timeout`.
- https://raw.githubusercontent.com/bluez/bluez/5.82/src/shared/shell.c — `{ "timeout", required_argument, 0, 't' }`, "Timeout in seconds for non-interactive mode".
- https://packages.debian.org/trixie/xdotool — X11 XTEST; https://packages.debian.org/trixie/wmctrl — EWMH X window managers.
- https://forums.raspberrypi.com/viewtopic.php?t=371406 — xdotool breaks under Wayland; `wlrctl` works on labwc.

Network
- https://www.raspberrypi.com/documentation/computers/configuration.html — static IP by nmcli, DHCP reservation recommended.
- https://www.raspberrypi.com/news/bookworm-the-new-version-of-raspberry-pi-os/ — NetworkManager replaced dhcpcd.
- https://packages.debian.org/trixie/dnsmasq — 2.91-1+deb13u2.
- https://github.com/raspberrypi/trixie-feedback/issues/3 — nmcli writes profiles under `/run/NetworkManager/system-connections`.

Timezone
- https://man7.org/linux/man-pages/man1/timedatectl.1.html — `set-timezone`: "Set the system time zone to the specified value … This call will alter the /etc/localtime symlink"; `list-timezones`; `status`.
- https://www.raspberrypi.com/documentation/computers/getting-started.html — Imager Customization tab, Localisation subtab: "choose your capital city. Imager autocompletes the time zone and keyboard layout for that city" (the page fetch was truncated before this section; the sentence came through search, §8).

Test tooling
- https://playwright.dev/docs/intro — System requirements: "Debian 12 / 13, Ubuntu 22.04 / 24.04 / 26.04 (x86-64 or arm64)"; "Node.js: latest 22.x, 24.x or 26.x".

## 8. Web-tool failures reported by the readers and the reviser

Readers (first pass): none. All nine readers reported `webToolFailed: false`. Partial results worth knowing:

- OS reader: a direct `curl` of raspberrypi.com/documentation/computers/configuration.html got HTTP 403 (bot protection); WebFetch on other raspberrypi.com pages worked. The raspi-config script fetch was truncated at ~500 lines, so the numeric code of the Advanced Options entry that opens the Wayland menu is not confirmed; the W1/W2 labels are (and the reviser's fetch reached `do_wayland()` itself, §7).
- Chromium reader: chromium.googlesource.com source pages and source.chromium.org returned 404/empty for the raw switch definitions; peter.sh's switch list was truncated. Both flags were confirmed from Raspberry Pi's tutorial and Chromium's own docs instead.
- Python reader: one trixie release-notes URL 404'd (wrong chapter name); the bookworm chapter and trixie's issues page were used. The literal `EXTERNALLY-MANAGED` marker file was not located in the package file lists.
- Node reader: NodeSource's support matrix (DEV_README) still lists Debian 10–12 only; the script source and NodeSource's Trixie post were treated as authoritative.
- Docker reader: WebFetch's summary misstated a link path; the raw HTML was fetched and the correct URL used.
- PipeWire reader: two guessed URLs 404'd and were recovered by search.
- Network reader: the "NetworkManager uses dnsmasq-base for hotspots" detail rests on secondary sources only; it is not used here.

Reviser (gap-closure pass, 2026-09-12):

- The Trixie image manifests (`downloads.raspberrypi.org` and `.com`, the `.info` files and the directory listing) returned HTTP 403 on every attempt, so "which packages are on the Desktop image" was established from the image build instead: pi-gen's stage3 package list plus the `rpd-x-core` metapackage's control file (§7). The readers' earlier `.info` reads stand for the Python/font facts.
- `gitlab.freedesktop.org` (WirePlumber source) answered with an Anubis anti-bot page; the GitHub mirror `PipeWire/wireplumber` at tag 0.5.8 was used for `state-stream.lua` and `wireplumber.conf`.
- `freedesktop.org`'s systemd man page for `timedatectl` returned 403; man7.org's copy was used.
- RPi-Distro/pi-gen has no `trixie` branch path for stage4/stage3 package lists (404); `master` was used.
- raspberrypi.com getting-started was truncated before the Imager Localisation section; the sentence quoted in §7 came through search results pointing at that page.
- home-assistant.io's scene integration page does not say where UI scenes are stored; the scene editor page does (`scenes.yaml`).
- Three forum threads surfaced for "X11 on Trixie" (t=394204, p=2341782, t=389477) contain no staff statement on X11 status; they were not used as evidence.

## 9. Ranked: what breaks on a fresh install if nothing is done

1. **Wayland session.** No scoreboard on the TV, display service down, VLC fullscreen unverified. Whole show-control surface. The X11 stack is on the image; the switch is one menu entry; the contingency is blue. (§2.1)
2. **Router reservation on blue's MAC.** Green is unreachable at 192.168.0.191; every tablet and scanner fails. Not an OS change, a cutover step. (§2.6)
3. **The certificate.** A clone serves the 10.0.0.177 file; if the copy is skipped, mis-ordered, or copies a file blue does not actually serve, the tablets warn or NFC stops in a "secure context" that is not. Checked copy, or the IP-SAN recipe. (§2.8)
4. **Chromium binary name.** Kiosk spawn fails, display service down, even after the X11 fix. (§2.3)
5. **WirePlumber Lua drop-in ignored.** Silent: video audio can come back muted after a restart, and copying blue's file hides the warning; a wrong `.conf` key passes the status check — the `pw-dump` line is the real test. (§2.2)
6. **Host timezone.** Silent: every hardware-scanner timestamp and the validator report shift by hours; nothing warns until a report is read. (§2.7)
7. **Home Assistant version skew.** `:stable` is 2026.9.2; blue's is unknown until read; a migration surprise on show week has a days-long fallback. Run blue's digest. (§3)
8. **Node 20.** Engine warning, unsupported runtime, no security fixes. Runs, probably. (§2.4)
9. **Python pip refusal.** Thursday's token sync fails if run on green. (§2.5)
10. **`desktop-control.sh` no-op.** ~290 MB not freed. Harmless on a Pi 5. (§2.1)
11. **`ufw` absent.** Nothing to do on the kit network. (§2.10)

Cleared on review, not ranked: BlueZ 5.82's `bluetoothctl` output (§2.9); Playwright on arm64 Debian 13 (§6);
`pw-play`/`dbus-monitor` packages (§1 row 3, §5); the ESP32 asset corpus and manifest (§4); the cue-sound count
(seven, §3); the media verify block (§5 row 4b).
