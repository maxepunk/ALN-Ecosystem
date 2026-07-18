#!/usr/bin/env python3
"""RETIRED (A3 slice 2b, D3b — 2026-07-18).

This standalone twin of the token sync predated the game-pack era: it
emitted tokens.json WITHOUT regenerating pack-manifest.json (breaking the
scanners' per-file sha1 verify) and, since D3b, would also skip the
authoring-time groups-block derivation and its multiplier-conflict hard
error. The supported pipeline is the real sync:

    cd <ALN-Ecosystem root>
    python3 scripts/sync_notion_to_tokens.py

It handles validation, NeurAI BMP generation, the game.json groups block,
the pack manifest, and the ESP32 asset manifest — none of which this twin
did. Kept as a stub so stale docs fail LOUDLY instead of silently
producing a drifted pack.
"""
import sys

sys.exit(
    "RETIRED: use scripts/sync_notion_to_tokens.py from the ALN-Ecosystem "
    "root (this twin skipped the pack manifest and the D3b groups "
    "derivation - see the docstring)."
)
