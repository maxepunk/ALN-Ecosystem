# Green from a fresh Raspberry Pi OS install: what differs from the guide and the code

Research, 2026-09-12. Brief: `docs/plans/briefs/2026-09-12-green-fresh-install-research.md`.
Vocabulary: `CONTEXT.md` §5 (kit, venue, installation profile, blue/green).
Line numbers: `docs/plans/ROADMAP.md` and `CONTEXT.md` are cited against this docs
worktree; every other file against the main checkout (`DEPLOYMENT_GUIDE.md` and
`backend/CLAUDE.md` are byte-identical in both). External facts were gathered by
topic readers on 2026-09-12; every one has a URL in §7.

## Conclusions

A fresh 64-bit Desktop image today is Raspberry Pi OS **Trixie** (Debian 13, image dated 2026-06-18), not the
Bookworm the guide assumes (`DEPLOYMENT_GUIDE.md:1030`). Six things differ in a way that matters this week.

1. **The desktop is Wayland (labwc); the code drives X11** (`DISPLAY=:0`, xdotool, wmctrl). Fix, before anything
   else: `sudo raspi-config` → Advanced Options → Wayland → **W1 X11**, reboot. Guide change (step 0).
2. **WirePlumber 0.5.8 never reads `/etc/wireplumber/main.lua.d/`.** Fix: write `/etc/wireplumber/wireplumber.conf.d/51-aln-vlc-no-restore.conf`
   (§2.2). Do NOT copy blue's `.lua`: it passes the boot check and does nothing. Guide + `backend/CLAUDE.md` change; 3-line code change for the path check.
3. **The browser package and binary are `chromium`; the code spawns `chromium-browser`.** Fix: `sudo apt install chromium`,
   then `CHROMIUM_BIN=/usr/bin/chromium` in `backend/.env`. Config change now; guide change.
4. **The guide installs Node 20 (end of life 2026-04-30); `backend/package.json` needs >= 22.** Fix: `setup_22.x`. Guide change.
5. **`pip install` is refused (Python 3.13, PEP 668).** Only if Thursday's Notion sync runs on green. Fix:
   `sudo apt install python3-requests python3-pil python3-dotenv python3-jsonschema`. Guide change.
6. **192.168.0.191 is a router DHCP reservation keyed to blue's MAC; green has its own.** Fix at cutover: move the
   reservation to green's MAC on the router. If set on green instead, confirm it survives a reboot (Trixie's nmcli
   writes profiles under `/run`). Cutover step; the guide gets the venue values.

Unchanged, no action: VLC 3.0.23 with `--vout=gles2` and D-Bus MPRIS; Docker via `get.docker.com`; NetworkManager;
`/boot/firmware/config.txt`; BlueZ, xdotool, wmctrl present (X11 only); DejaVu fonts on the Desktop image; HEVC only.
Bench checks (§1b): `pactl`/`pw-play` on PATH, the `output:hdmi-stereo` profile, speaker pairing (BlueZ 5.66 → 5.82).

**Copy from blue over the share** (paths on blue's disk; `~` = blue's login user): `~/ALN-Ecosystem/backend/ssl/cert.pem` + `key.pem`
(the tablets and the Pi 4 display accepted this one); `~/ALN-Ecosystem/backend/.env`; `~/ha-config/` whole (the Home Assistant
volume: seven scenes, owner account, token; copy BEFORE the first `docker run`); `~/ALN-Ecosystem/backend/public/videos/*.mp4`
(idle-loop.mp4 included); `.../backend/public/music/`; `.../backend/public/audio/` (files git lacks only). Read, do not copy:
`ALN-TokenData/pack-manifest.json` (contentHash → pack commit), `/boot/firmware/config.txt` (compare), the profile file (diff).
Never: `backend/data/`, `~/.pm2/`, `/var/lib/bluetooth/` (re-pair), the `.lua` drop-in.

**Pull from git:** `git clone --recurse-submodules https://github.com/maxepunk/ALN-Ecosystem.git ~/ALN-Ecosystem` on `main`, with
submodules ALN-TokenData (at blue's pack commit), ALNScanner + `data`, aln-memory-scanner + `data`, arduino-cyd-player-scanner.
Built on green: `backend/` `npm install`; ALNScanner `npm ci && npm run build` (the `npm start` prestart does it); `npm run music:seed`.

**Install, in the guide's order:** Imager 64-bit Desktop (user/hostname/SSH) → `raspi-config`: Desktop Autologin, Wayland → W1 X11 →
`usermod -aG video,audio,bluetooth` → `apt update && apt upgrade` → NodeSource `setup_22.x`, `nodejs` → `apt install vlc mpd git
xdotool wmctrl chromium pulseaudio-utils` (renamed: chromium; added: pulseaudio-utils for `pactl`) → disable `mpd`, `mpd.socket` →
`npm install -g pm2` → clone, `npm install` → Docker via `get.docker.com`, `usermod -aG docker`, HA container on the copied `~/ha-config`
→ WirePlumber `.conf` → address (router) → `npm start`, `pm2 save`, `pm2 startup`. Skip `ufw` (absent). Optional: the four `python3-*`.

## 1. The facts: today versus what the guide and the code assume

| # | Fact | On a fresh install today (2026-09-12) | What the guide or code assumes | Differs? | Sources (all read 2026-09-12) |
|---|---|---|---|---|---|
| 1 | OS release, Debian base | Raspberry Pi OS Trixie, Debian 13; 64-bit Desktop image dated 18 Jun 2026, kernel 6.18 | Bookworm 64-bit Desktop (`DEPLOYMENT_GUIDE.md:1030`); `/boot/firmware/config.txt` (`:1074`) | Release differs; the boot config path is the same | raspberrypi.com/software/operating-systems; raspberrypi.com/documentation/computers/os.html; raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os |
| 2 | Pi 5 desktop session | Wayland with the labwc compositor, on all models, since Oct 2024 and still in Trixie; Wayfire is gone. X11 is chosen in `raspi-config` → Advanced Options → Wayland → "W1 X11" (Openbox on X11) | Xorg/LXDE session (`DEPLOYMENT_GUIDE.md:1030-1033`); `DISPLAY=:0` (`backend/src/utils/displayDriver.js:56`); xdotool/wmctrl window control (`:104`, `:289-290`, `:319`); `--vout=gles2` "within Xorg" (`backend/src/services/vlcMprisService.js:64`); lxpanel/pcmanfm/lxsession (`backend/scripts/desktop-control.sh:14-37`) | **Yes** | raspberrypi.com/news/a-new-release-of-raspberry-pi-os; RPi-Distro/raspi-config `trixie` branch source |
| 3 | PipeWire | 1.4.2 (Debian trixie package 1.4.2-1); PipeWire is the audio server, `pipewire-pulse` gives the PulseAudio socket | VLC started with `-A pulse` (`vlcMprisService.js:53`); `pactl` everywhere (`backend/src/services/audioRoutingService.js:158`, `:215`, `:948`); `pw-play` for sounds (`backend/src/services/soundService.js:44`, `:75`) | No (same mechanism, newer version). Bench check: `pactl info`, the `output:hdmi-stereo` profile | packages.debian.org/trixie/source/pipewire |
| 4 | WirePlumber config format | 0.5.8 (trixie package 0.5.8-2). Since 0.5, Lua config files are not read at all; drop-ins are SPA-JSON `.conf` files in `wireplumber.conf.d/`, searched in `/etc/wireplumber/` for host overrides | Lua drop-in at `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua` (`DEPLOYMENT_GUIDE.md:1168-1184`; `backend/CLAUDE.md:608`, `:619-651`; `docs/wireplumber/51-aln-vlc-no-restore.lua:18-28`); boot check of that exact path (`audioRoutingService.js:618`) | **Yes** | packages.debian.org/trixie/source/wireplumber; sources.debian.org wireplumber 0.5.8-2 debian/NEWS; WirePlumber docs: migration, conf_file, locations |
| 5 | VLC | 3.0.23 (Debian 3.0.23-0+deb13u1; Pi build +rpt1, 2026-03-23). `libgles2_plugin.so` ships in `vlc-plugin-video-output`; `libdbus_plugin.so` (MPRIS `org.mpris.MediaPlayer2.vlc`) ships in `vlc-plugin-base`; Mesa V3D supports Pi 5 GLES | Unpinned `vlc` (`DEPLOYMENT_GUIDE.md:51`, `:1056`); `cvlc` (`vlcMprisService.js:114`); `--vout=gles2` on Pi 5 (`:75-77`); D-Bus MPRIS, no HTTP interface (`DEPLOYMENT_GUIDE.md:189`) | No | packages.debian.org/trixie/vlc; RPi-Distro/vlc tags; vlc-plugin-video-output and vlc-plugin-base file lists; videolan vlc-3.0 MODULES_LIST; vlc dbus.c; docs.mesa3d.org v3d |
| 6 | Chromium | Package and binary `chromium` (Debian 152.0.7977.82-1~deb13u1); `chromium-browser` was the pre-Bookworm Pi build. `--kiosk` is in Raspberry Pi's own kiosk tutorial; `--password-store=basic` is in Chromium's docs | `chromium-browser` package (`DEPLOYMENT_GUIDE.md:1056`, `:1290`, `:1295`), binary default (`displayDriver.js:165`; `DEPLOYMENT_GUIDE.md:257-261`; `backend/.env.example:171-172`); flags (`displayDriver.js:166-171`; `backend/CLAUDE.md:232`) | **Yes** (name); flags unchanged | packages.debian.org/trixie/chromium; raspberrypi.com kiosk tutorial; chromium password_storage.md; forums.raspberrypi.com t=339831 |
| 7 | Python | 3.13.5; `pip install` into the system interpreter is refused (PEP 668, `externally-managed-environment`); apt has python3-requests 2.32.3, python3-pil 11.1.0, python3-dotenv 1.0.1, python3-jsonschema 4.19.2; `fonts-dejavu-core` 2.37-8 is on the Desktop image (absent on Lite) | "Python 3" (`DEPLOYMENT_GUIDE.md:19`); `pip install -r scripts/requirements.txt` (`scripts/requirements.txt:2`); DejaVu Sans Mono at `/usr/share/fonts/truetype/dejavu/` (`scripts/sync_notion_to_tokens.py:207-208`), Liberation fallback (`:212-213`), PIL default (`:215`) | **Yes** (install method); fonts: no | downloads.raspberrypi.org image manifests (lite and desktop); Debian bookworm release notes 5.2.2; packages.debian.org trixie pages; forums.raspberrypi.com t=358400 |
| 8 | Node.js | Debian ships 20.19.2; NodeSource `setup_20.x` still runs on Trixie (no codename gate; keys re-signed Jan 2026 for 20/22/24); Node 20 reached end of life 2026-04-30 | Node 20+ via `setup_20.x` (`DEPLOYMENT_GUIDE.md:15`, `:46`, `:1055`); `engines.node >= 22.0.0` (`backend/package.json:127-129`); CI runs Node 22 (`.github/workflows/test.yml:33`, `rung1.yml:38`) | **Yes** (guide contradicts package.json; the fresh install makes it bite) | packages.debian.org/stable/nodejs; nodesource/distributions setup_20.x; nodesource.com GPG post; Node EOL schedule |
| 9 | Docker Engine | No Pi-OS-specific 64-bit package; Docker's Debian instructions cover Trixie and arm64, and `download.docker.com/linux/debian/dists/trixie/stable/binary-arm64/` exists; Debian's own `docker.io` 26.1.5 also installs | `curl -fsSL https://get.docker.com \| sudo sh` (`DEPLOYMENT_GUIDE.md:735`); `docker` on PATH (`backend/src/utils/dockerHelper.js:20`); existing container named `homeassistant` (`:743`; `backend/src/services/lightingService.js:459-462`) | No | docs.docker.com raspberry-pi-os and debian install pages; download.docker.com dists listing; packages.debian.org/trixie/docker.io |
| 10 | BlueZ | 5.82 (Bookworm had 5.66); preinstalled with the desktop | No install step; "do not disable bluetooth" (`DEPLOYMENT_GUIDE.md:1538`); `bluetoothctl` output parsed by regex (`backend/src/services/bluetoothService.js:26`, `:117`, `:165`); `dbus-monitor` on `org.bluez` (`:495-501`) | Version differs; bench check the parser | packages.debian.org/trixie/bluez and /bookworm/bluez |
| 11 | xdotool, wmctrl | Both in trixie apt (xdotool 1:3.20160805.1-5.1; wmctrl 1.07+git20240228); both X11-only; they do not work under labwc (community reports; `wlrctl` is the Wayland replacement) | apt names (`backend/CLAUDE.md:231`; `DEPLOYMENT_GUIDE.md:51`); window control verified on Xorg (`displayDriver.js:9-18`) | Packages: no. Behaviour: tied to row 2 | packages.debian.org/trixie/xdotool and /wmctrl; forums.raspberrypi.com t=371406 |
| 12 | Static address, dnsmasq | NetworkManager (`nmcli`/`nmtui`) since Bookworm, unchanged; Trixie's nmcli writes new profiles under `/run/NetworkManager/system-connections` (trixie-feedback #3); `dnsmasq` 2.91 installable, not installed | nmcli, connection name discovered (`DEPLOYMENT_GUIDE.md:1103-1120`), placeholder 192.168.1.x (`:1111-1113`); no dnsmasq anywhere (DNS deferred: `ROADMAP.md:609`); `ufw` (`:1206`) | Mechanism: no. Persistence quirk plus the MAC-keyed reservation: action needed | raspberrypi.com configuration docs; bookworm announcement; packages.debian.org/trixie/dnsmasq; github raspberrypi/trixie-feedback #3 |

### 1b. Not covered by the readers: check on the bench, one command each

- `command -v pactl pw-play mpc` — `pactl` comes from `pulseaudio-utils`; the guide never installs it (CI does: `.github/workflows/test.yml:38`). Install it if missing.
- `pactl list cards short` then `pactl list sinks short` — the `output:hdmi-stereo` profile (`audioRoutingService.js:948`) and an HDMI sink must exist under PipeWire 1.4. The profile and `backend/config/environment/routing.json` use logical ids (`hdmi`, `bluetooth`), so no file carries a hardware sink name.
- `command -v chromium-browser` — if a compatibility wrapper exists on Trixie nothing breaks; set `CHROMIUM_BIN` anyway.
- `raspi-config` → System Options → Boot / Auto Login — the "Desktop Autologin" entry (`DEPLOYMENT_GUIDE.md:1038-1041`) was not re-verified on Trixie.
- The `hdmi_*` lines in `/boot/firmware/config.txt` (`DEPLOYMENT_GUIDE.md:1072-1081`) are legacy firmware keys; whether the Pi 5 KMS driver honours them was not checked. Compare blue's file, and test a cold boot with the TV attached.
- `bluetoothctl show` from the GM panel flow — BlueZ 5.82's `bluetoothctl` output format against the parser at `bluetoothService.js:26`.
- `systemctl --user status wireplumber` after installing the `.conf` drop-in (§2.2): a parse error shows there.
- The MPD package version on Trixie was not checked; the orchestrator writes its own config (`backend/src/services/musicService.js:47-48`), so only the "disable the system unit" step matters (`DEPLOYMENT_GUIDE.md:1059-1060`).

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
confirmed, so the guide should name the entry by its label. Raspberry Pi no longer develops the X11 path,
so the real fix later is a code change (a Wayland display driver, e.g. `wlrctl`); not this week.

### 2.2 WirePlumber drop-in format

What breaks. The guide (`DEPLOYMENT_GUIDE.md:1168-1184`), `backend/CLAUDE.md:608-651` and the canonical
file `docs/wireplumber/51-aln-vlc-no-restore.lua:18-28` install a Lua rule into `/etc/wireplumber/main.lua.d/`.
WirePlumber 0.5 does not read Lua config at all. WirePlumber then restores VLC's saved volume and mute on
every new stream, which is the 2026-05-22 incident (silent video audio after a restart). The only runtime
check is `audioRoutingService.js:618-629`: it tests that the Lua path exists and logs a warning. If the
owner copies blue's `.lua` file to green, the warning goes away and the rule still does nothing. That is
why the file must be recreated, not copied.

Smallest fix: a config change on the machine, plus a guide change. Write this file (SPA-JSON, the 0.5
format; the readers confirmed the format and the directory, not this exact rule syntax, so verify as
below):

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
        state.restore-props = false
        state.restore-target = false
      }
    }
  }
]
```

Then `systemctl --user restart wireplumber && systemctl --user status wireplumber` (must be active; a
syntax error is in `journalctl --user -u wireplumber`). Prove it: play a video, set the video volume from
the GM panel, restart the orchestrator, play again; the volume must be what the orchestrator set.
Code change (small, optional this week): make `audioRoutingService.js:618` accept either path
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

### 2.7 Not differences, but worth one line each

- Docker: `get.docker.com` selects the Debian path and Trixie arm64 packages exist. Same as the guide.
- The `pi` user: `backend/ecosystem.config.js:94-98` (`user: 'pi'`, `/home/pi/...`) is only the unused
  `pm2 deploy` block; the guide never runs `pm2 deploy`. Imager sets the user name at flash time
  (`DEPLOYMENT_GUIDE.md:1036-1037`). No action.
- `ecosystem.config.js:4`, `:47`, `:70` say "8GB Pi" and cap memory at 2 GB; harmless on a Pi 5.
- The Pi 5 video settings now do live in the guide (`DEPLOYMENT_GUIDE.md:1083-1099`), pointing at
  `backend/CLAUDE.md:686-728`; Appendix C's "agent document only" line is out of date.
- `ufw` is not on a fresh image; the firewall section (`DEPLOYMENT_GUIDE.md:1202-1216`) can be skipped.

## 3. Copied from blue, not recreated

Blue is reachable as a network share; paths below are as they appear on blue's own disk. `~` is blue's
login user's home. Copy with a tool that keeps permissions (`rsync -a` over the share, or `cp -a`), then
fix ownership on green (`chown -R <green-user>` on the copied trees).

| What | Path on blue | Why copied | Source |
|---|---|---|---|
| Certificate and key | `~/ALN-Ecosystem/backend/ssl/cert.pem`, `~/ALN-Ecosystem/backend/ssl/key.pem` | The tablets and the Pi 4 display accepted this self-signed certificate once; a new one means every device warns again. Key file mode 600. | `DEPLOYMENT_GUIDE.md:447-517`; `backend/ecosystem.config.js:22-23`; `ROADMAP.md:501-507`, Appendix C `:773-775` |
| Environment file | `~/ALN-Ecosystem/backend/.env` | ADMIN_PASSWORD, JWT_SECRET, HOME_ASSISTANT_TOKEN and ~30 other keys. After copying, set `CHROMIUM_BIN=/usr/bin/chromium` (§2.3). Mode 600. | `DEPLOYMENT_GUIDE.md:119-165`; `.gitignore:55` |
| Home Assistant volume | `~/ha-config/` (the directory mounted at `/config`) | The seven `scene.*` definitions, the owner account, and the long-lived token exist only here. Copy before the first `docker run` and mount the copy; HA migrates the config forward on first start (watch `docker logs homeassistant`). The bulb integrations copy too; at the venue blue and green never run at once. Alternative per the guide: capture the seven scenes as YAML and recreate. | `DEPLOYMENT_GUIDE.md:742-747`, `:771-790` (owner task `:777`); `ROADMAP.md:501-507`, `:754-756` |
| Game videos | `~/ALN-Ecosystem/backend/public/videos/*.mp4` incl. `idle-loop.mp4` | Git-excluded (`.gitignore:10`); every non-null `video` in tokens.json plus the profile's `bindings.surfaces` file. Must be HEVC. `loopimages/` is in git. | `DEPLOYMENT_GUIDE.md:814-832`; `backend/config/profiles/aln-full-kit.json:71` |
| Music library | `~/ALN-Ecosystem/backend/public/music/` | Git-excluded (`.gitignore:17-19`); `music-playlists.json` references it. Run `npm run music:seed` after. | `DEPLOYMENT_GUIDE.md:819`, `:828`, `:857` |
| Cue sounds | `~/ALN-Ecosystem/backend/public/audio/` | In git (8 wav files in the checkout); copy only files blue has that git lacks. | `DEPLOYMENT_GUIDE.md:820`, `:829`; `.gitignore:26` |

Read on blue, but not copied:

- `~/ALN-Ecosystem/ALN-TokenData/pack-manifest.json` — its `contentHash` identifies the pack blue runs;
  check out the same commit on green (§4) so `/health` reports the same hash (`DEPLOYMENT_GUIDE.md:1659-1661`).
- `/boot/firmware/config.txt` and `cmdline.txt` — compare the HDMI lines against `DEPLOYMENT_GUIDE.md:1074-1081`; do not copy a Bookworm boot config onto Trixie.
- `~/ALN-Ecosystem/backend/config/profiles/aln-full-kit.json` — diff against git; carry any hand edit (e.g. the speaker sink id) as a commit, not a copy.
- `~/ALN-Ecosystem/backend/.env` versus `backend/.env.example` — a key present in one and not the other is a doc defect to report (`ROADMAP.md:765-766`).

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
- Built on green:
  - `backend/`: `npm install` (`DEPLOYMENT_GUIDE.md:1069`).
  - GM scanner: `ALNScanner/` `npm ci && npm run build`; `npm start` does it through the prestart hook
    (`backend/package.json` scripts `prestart` → `backend/scripts/build-scanner.sh:24-33`). Served through
    the in-repo symlink `backend/public/gm-scanner → ../../ALNScanner/dist`.
  - Player scanner: no build; served through the symlink `backend/public/player-scanner → ../../aln-memory-scanner`.
  - Music playlist: `npm run music:seed` after the copy (`DEPLOYMENT_GUIDE.md:857`).
- Not on green: ESP32 firmware is flashed to the scanners separately (`CURRENT-STATE.md:74`).

## 5. Installed, in the guide's order, with renames and additions

| Step | Guide | Fresh Trixie install | Change |
|---|---|---|---|
| 0 | Imager: 64-bit Desktop, user, hostname, SSH (`:1036-1037`) | Same; the image is Trixie | none |
| 0 | `raspi-config` → Desktop Autologin (`:1038-1041`) | Same entry expected (not re-verified) | verify |
| 0 | — | `raspi-config` → Advanced Options → Wayland → **W1 X11**, reboot | **added** |
| 0 | `usermod -aG video,audio,bluetooth $USER` (`:1044`) | Same | none |
| 1 | `apt update && apt upgrade -y` (`:1052`) | Same | none |
| 1 | NodeSource `setup_20.x` (`:1055`) | `setup_22.x` | **changed** |
| 1 | `apt install nodejs vlc mpd git xdotool wmctrl chromium-browser` (`:1056`) | `apt install nodejs vlc mpd git xdotool wmctrl chromium pulseaudio-utils` | **renamed** chromium; **added** pulseaudio-utils (`pactl`) |
| 1 | disable `mpd`, `mpd.socket` (`:1059-1060`) | Same | none |
| 1 | `npm install -g pm2` (`:1063`) | Same | none |
| 1 | clone, `npm install` (`:1067-1069`) | Same; pin the pack commit (§4) | none |
| 2 | HDMI lines in `/boot/firmware/config.txt` (`:1074-1081`) | Same path; keys may be ignored on Pi 5 (§1b) | verify |
| 2b | HEVC only, `--vout=gles2` (`:1083-1099`) | Same | none |
| 3 | static IP by nmcli (`:1101-1120`) | Router reservation at cutover, or nmcli with the persistence check (§2.6) | **changed** |
| 4 | `npm start`, `pm2 save`, `pm2 startup` (`:1130-1132`) | Same; the boot-race test (`:1152-1158`) runs on X11 as before | none |
| 5 | WirePlumber Lua drop-in (`:1168-1184`) | The `.conf` drop-in of §2.2 | **changed** |
| HA | `get.docker.com`, `usermod -aG docker`, `docker run … -v ~/ha-config:/config` (`:735-747`) | Same, with the copied `~/ha-config` | none |
| — | `ufw` rules (`:1206-1208`) | `ufw` is absent; skip | skip |
| — | `pip install -r scripts/requirements.txt` (`scripts/requirements.txt:2`) | apt `python3-requests python3-pil python3-dotenv python3-jsonschema`, or a venv | **changed** (optional on green) |

## 6. Green as the home development environment afterwards (rung 2)

Ruling R17 (`docs/plans/2026-09-12-block2-hardening-plan.md:52`): once green is ready, development moves
to it as the real-substitute-hardware rung. The test tooling and where it collides with the production install:

What the suites need on the machine:

- Unit and contract (`npm test`): Node 22 and `pulseaudio-utils` (`.github/workflows/test.yml:38`). Nothing else.
- Integration (`npm run test:integration`): same, plus Docker for `test:docker` (`backend/package.json` scripts, `sg docker`).
- E2E Tier L (`npm run test:e2e:tier-l`): Playwright's Chromium (`npx playwright install chromium --with-deps`,
  `test.yml:271`; arm64 Debian 13 support was not checked by the readers; the fallback is the system
  `chromium` through `CHROMIUM_BIN`, which `tests/rung1/up.sh:90-99` already prefers) and the rung-1 stack:
  `vlc-bin vlc-plugin-base dbus xvfb xdotool pipewire pipewire-pulse wireplumber pulseaudio-utils bluez python3-dbusmock python3-dbus` (`test.yml:289`).
- The rung-1 rig (`backend/tests/rung1/up.sh`, `engine.sh`, `probe.sh`): the same plus `mpd mpc wmctrl bluez-test-tools` (`rung1.yml:69-76`); `up.sh` runs as root.
- Blue's frozen state is the rollback; the production checkout must stay on `main`. Use a second clone
  (e.g. `~/dev/ALN-Ecosystem`) for branches and worktrees; the `gm-scanner` symlink is per checkout, so a
  dev clone is self-contained. A branch checkout in `~/ALN-Ecosystem` changes what PM2 runs at the next restart.

Where it collides with production on the same machine:

| Resource | Production (PM2 orchestrator) | Rig / E2E | Collision and rule |
|---|---|---|---|
| Users | Everything as the desktop login user (`up.sh:5-8` describes the venue) | `up.sh:29,38` creates `rung1vlc`; `engine.sh:48` boots the engine as it; `up.sh` itself needs root | Two users share `/tmp`. Run `sudo bash tests/rung1/down.sh` and `sudo rm -f /tmp/aln-*` before `pm2 start`, or the production engine cannot write its own files. |
| `/tmp` state | `/tmp/aln-mpd.*` (`musicService.js:47-48`), `/tmp/aln-pm-*.pid` (`vlcMprisService.js:117`; `displayDriver.js:53`; `bluetoothService.js:501`) | Same names, swept by `up.sh:47-54` only when no `node src/server.js` runs; `engine.sh:31-41` refuses on foreign-owned files | One engine at a time. `pm2 stop aln-orchestrator` before the rig or E2E. |
| Ports | 3000 (HTTPS), 8000 (redirect), 8888/udp (discovery) | Rig engine 3199 (`engine.sh:14`); E2E servers on dynamic ports (`tests/e2e/setup/test-server.js:153`); Playwright's `webServer` runs `npm run dev:no-video` on 3000 (`backend/playwright.config.js:55`, `:127-132`) | The Playwright webServer collides with PM2 on 3000; stop PM2 first. |
| Home Assistant, port 8123 | Container `homeassistant`, host network (`DEPLOYMENT_GUIDE.md:743-747`); restarted by the engine at boot (`lightingService.js:451-479`) | Container `rung1-ha`, host network (`provision.js:34`, `:470-471`); `provision.js:146-150` refuses when 8123 answers and `rung1-ha` is not the one running | `docker stop homeassistant` before the rig; `docker start homeassistant` (or a PM2 restart) after. Never let the rig adopt the real HA: the refuse-foreign guard exists for this. |
| VLC and MPRIS | `cvlc` owning `org.mpris.MediaPlayer2.vlc` on the user's session bus, on `:0` | Rig: private session bus (`up.sh:60`), Xvfb `:99` (`up.sh:62`, `provision.js:316-320`). E2E harness: `vlc-service.js:98-104` uses the ambient bus and `DISPLAY` default `:0`; `session-env.js:60` puts the display on `:99` | E2E without PM2 stopped means two VLCs on one bus name and one screen. Also `displayDriver.js:147` kills any `chromium … --kiosk` on launch, so a second engine kills the production kiosk. |
| Audio session | The login user's PipeWire, HDMI and Bluetooth sinks, the WirePlumber `.conf` | Rig: its own PipeWire under `XDG_RUNTIME_DIR=/tmp/rung1/xdg` with null sinks (`provision.js:345`, `:378`) | Separate by design. Check once that the rig's PipeWire does not claim the HDMI card (`pactl list cards` in both contexts); if it does, production audio is stolen while the rig runs. |
| Bluetooth | Real BlueZ on the system bus | Mock on a private system bus (`up.sh:118-120`); `btvirt` needs `/dev/vhci` (`probe.sh:45-53`), untested on the Pi kernel | Separate. `probe.sh` records the gap with a reason. |
| Data and logs | `backend/data/`, `backend/logs/` | Rig `/tmp/rung1/engine-data`, `engine-logs` (`up.sh:113-114`); E2E `/tmp/aln-e2e-env/w<slot>` (`test-server.js:83`) | Separate. |
| Desktop | `npm start` prestart stops lxpanel/pcmanfm (`desktop-control.sh`); `npm run stop` restores | The rig does not touch the desktop | None; on Trixie X11 the script may be a no-op (§2.1). |

Short form: on green, testing and the show never run at the same time. Sequence: `pm2 stop aln-orchestrator`,
`docker stop homeassistant`, run the rig or the suites, `sudo bash tests/rung1/down.sh`, `sudo rm -f /tmp/aln-*`,
`docker start homeassistant`, `pm2 start aln-orchestrator`. The preflight on the GM panel is the check that
production is whole again.

## 7. Sources (all read 2026-09-12)

OS and session
- https://www.raspberrypi.com/software/operating-systems/ — "Release Date: 18 Jun 2026; Codename: Trixie; Kernel 6.18; Debian 13 (trixie)".
- https://www.raspberrypi.com/documentation/computers/os.html — "The latest version of Raspberry Pi OS is based on Debian Trixie."
- https://www.raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os/ — Trixie announcement, 2 Oct 2025.
- https://www.debian.org/releases/trixie/ — Debian 13 is trixie.
- https://www.raspberrypi.com/news/a-new-release-of-raspberry-pi-os/ — "Raspberry Pi Desktop now runs Wayland by default across all models"; the A6 Wayland / W1 X11 menu path (Oct 2024).
- https://raw.githubusercontent.com/RPi-Distro/raspi-config/trixie/raspi-config — `do_wayland()` offers "W1 X11" and "W2 Labwc".
- https://en.wikipedia.org/wiki/Raspberry_Pi_OS — latest release 6.3, 18 June 2026; labwc default.

PipeWire and WirePlumber
- https://packages.debian.org/trixie/source/pipewire — pipewire 1.4.2-1.
- https://packages.debian.org/trixie/source/wireplumber — wireplumber 0.5.8-2.
- https://sources.debian.org/src/wireplumber/0.5.8-2/debian/NEWS/ — 0.5 config is JSON, incompatible with 0.4 Lua files.
- https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/migration.html — "Starting with WirePlumber 0.5, Lua configuration files are no longer supported"; `wireplumber.conf.d/` replaces `main.lua.d/`.
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

Python and fonts
- https://downloads.raspberrypi.org/raspios_lite_arm64/images/raspios_lite_arm64-2026-06-19/2026-06-18-raspios-trixie-arm64-lite.info — python3 3.13.5-1, python3-venv; no font packages.
- https://downloads.raspberrypi.org/raspios_arm64/images/raspios_arm64-2026-06-19/2026-06-18-raspios-trixie-arm64.info — fonts-dejavu-core 2.37-8, python3-pip present.
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

Docker
- https://docs.docker.com/engine/install/raspberry-pi-os/ — 64-bit users follow the Debian instructions.
- https://docs.docker.com/engine/install/debian/ — Trixie 13 and Bookworm 12; arm64 supported.
- https://download.docker.com/linux/debian/dists/ and …/dists/trixie/stable/ — `trixie/` and `binary-arm64/` exist.
- https://packages.debian.org/trixie/docker.io — 26.1.5+dfsg1-9+deb13u1.

BlueZ, xdotool, wmctrl
- https://packages.debian.org/trixie/bluez — 5.82-1.1; https://packages.debian.org/bookworm/bluez — 5.66-1+deb12u2.
- https://packages.debian.org/trixie/xdotool — X11 XTEST; https://packages.debian.org/trixie/wmctrl — EWMH X window managers.
- https://forums.raspberrypi.com/viewtopic.php?t=371406 — xdotool breaks under Wayland; `wlrctl` works on labwc.

Network
- https://www.raspberrypi.com/documentation/computers/configuration.html — static IP by nmcli, DHCP reservation recommended.
- https://www.raspberrypi.com/news/bookworm-the-new-version-of-raspberry-pi-os/ — NetworkManager replaced dhcpcd.
- https://packages.debian.org/trixie/dnsmasq — 2.91-1+deb13u2.
- https://github.com/raspberrypi/trixie-feedback/issues/3 — nmcli writes profiles under `/run/NetworkManager/system-connections`.

## 8. Web-tool failures reported by the readers

None. All nine readers reported `webToolFailed: false`. Partial results worth knowing:

- OS reader: a direct `curl` of raspberrypi.com/documentation/computers/configuration.html got HTTP 403 (bot protection); WebFetch on other raspberrypi.com pages worked. The raspi-config script fetch was truncated at ~500 lines, so the numeric code of the Advanced Options entry that opens the Wayland menu is not confirmed; the W1/W2 labels are.
- Chromium reader: chromium.googlesource.com source pages and source.chromium.org returned 404/empty for the raw switch definitions; peter.sh's switch list was truncated. Both flags were confirmed from Raspberry Pi's tutorial and Chromium's own docs instead.
- Python reader: one trixie release-notes URL 404'd (wrong chapter name); the bookworm chapter and trixie's issues page were used. The literal `EXTERNALLY-MANAGED` marker file was not located in the package file lists.
- Node reader: NodeSource's support matrix (DEV_README) still lists Debian 10–12 only; the script source and NodeSource's Trixie post were treated as authoritative.
- Docker reader: WebFetch's summary misstated a link path; the raw HTML was fetched and the correct URL used.
- PipeWire reader: two guessed URLs 404'd and were recovered by search.
- Network reader: the "NetworkManager uses dnsmasq-base for hotspots" detail rests on secondary sources only; it is not used here.

## 9. Ranked: what breaks on a fresh install if nothing is done

1. **Wayland session.** No scoreboard on the TV, display service down, VLC fullscreen unverified. Whole show-control surface. (§2.1)
2. **Router reservation on blue's MAC.** Green is unreachable at 192.168.0.191; every tablet and scanner fails. Not an OS change, a cutover step. (§2.6)
3. **Chromium binary name.** Kiosk spawn fails, display service down, even after the X11 fix. (§2.3)
4. **WirePlumber Lua drop-in ignored.** Silent: video audio can come back muted after a restart, and copying blue's file hides the warning. (§2.2)
5. **Node 20.** Engine warning, unsupported runtime, no security fixes. Runs, probably. (§2.4)
6. **Python pip refusal.** Thursday's token sync fails if run on green. (§2.5)
7. **BlueZ 5.82 `bluetoothctl` output.** Speaker pairing from the panel may mis-parse; unverified. (§1b)
8. **`desktop-control.sh` no-op.** ~290 MB not freed. Harmless on a Pi 5. (§2.1)
9. **`ufw` absent.** Nothing to do on the kit network. (§2.7)
