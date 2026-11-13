-- ALN orchestrator: bypass WirePlumber's stream-restore for VLC streams.
--
-- SUPERSEDED ON WIREPLUMBER 0.5+ (Debian 13 / Raspberry Pi OS Trixie
-- ships 0.5.8, which does not read Lua configuration at all). Use
-- 51-aln-vlc-no-restore.conf beside this file instead. This file
-- remains for machines still on WirePlumber 0.4 (Bookworm).
-- Procedure: ../../DEPLOYMENT_GUIDE.md → "6. Install the WirePlumber rule".
--
-- Why: WirePlumber's restore-stream module persists per-application (and
-- per-media.role) stream state — including mute/volume/sink. The orchestrator's
-- audioRoutingService now owns video stream state (volume persisted in
-- config:audioRouting.volumes, applied reactively in _identifySinkInput when
-- VLC creates a new sink-input). Having both WP and the orchestrator manage
-- the same state caused the 2026-05-22 incident where a stale muted state
-- persisted across sessions and silently broke video audio.
--
-- This rule tells WP to NOT save and NOT restore props/target for any
-- sink-input whose process binary is "vlc". Other apps (MPD, pw-play, future
-- apps) keep their normal WP-managed restore behavior — only VLC opts out.
--
-- Pattern source: /usr/share/wireplumber/main.lua.d/40-stream-defaults.lua
-- (the commented-out pw-play example demonstrates the same technique).

table.insert(stream_defaults.rules, {
  matches = {
    {
      { "application.process.binary", "matches", "vlc" },
    },
  },
  apply_properties = {
    ["state.restore-props"]  = false,
    ["state.restore-target"] = false,
  },
})
