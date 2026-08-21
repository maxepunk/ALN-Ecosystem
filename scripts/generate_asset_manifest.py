#!/usr/bin/env python3
"""Generate the canonical asset manifest consumed by the ESP32 CYD scanner.

The manifest lists every image and audio file present in
`aln-memory-scanner/assets/` along with its SHA-1 and size. The ESP32 fetches
this file at boot via `GET /api/assets/manifest`, diffs it against its local
copy, and downloads only the files whose hash changed.

Can be used two ways:
  1. As a library: imported by `sync_notion_to_tokens.py` after it writes
     BMPs and keeps an authoritative view of what belongs there.
  2. As a CLI: `python3 scripts/generate_asset_manifest.py` regenerates the
     manifest from whatever is already on disk. Useful for bootstrapping when
     the Notion sync hasn't been run recently.

Also exposes `prune_orphans()` for removing asset files whose tokenId is not
in a provided allow-list (used by the Notion sync after it's assembled its
token set).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

# Filenames must match the ESP32's tokenId validation (lowercased, [a-z0-9_]+).
TOKEN_ID_PATTERN = re.compile(r"^[a-z0-9_]+$")

# Stems that look like legal tokenIds but are NOT game tokens. These are
# exempt from both the manifest and prune_orphans (F-TOOL-06: the tokenId
# pattern alone matches "placeholder", so an explicit exempt list is needed
# to keep the ESP32's unknown-token fallback image alive across syncs).
EXEMPT_STEMS = frozenset({"placeholder"})

# Supported extensions per asset type. Keep in sync with OpenAPI
# `/api/assets/audio/{tokenId}.{ext}` enum and the backend route regex.
IMAGE_EXTS = (".bmp",)
AUDIO_EXTS = (".wav", ".mp3")


def _sha1_file(path: Path) -> str:
    """Stream-hash a file so we never load large BMPs fully into memory."""
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _scan_dir(dirpath: Path, valid_exts: tuple[str, ...]) -> dict[str, dict]:
    """Walk a directory and produce `{tokenId: {sha1, size, ext?}}` entries.

    Files whose stem isn't a legal tokenId are skipped, as are explicitly
    exempt non-token files (`EXEMPT_STEMS`, e.g. `placeholder.bmp`) — only
    game tokens belong in the manifest.
    """
    entries: dict[str, dict] = {}
    if not dirpath.exists():
        return entries
    for child in sorted(dirpath.iterdir()):
        if not child.is_file():
            continue
        ext = child.suffix.lower()
        if ext not in valid_exts:
            continue
        stem = child.stem.lower()
        if stem in EXEMPT_STEMS or not TOKEN_ID_PATTERN.match(stem):
            continue
        entry: dict[str, object] = {
            "sha1": _sha1_file(child),
            "size": child.stat().st_size,
        }
        # Audio files carry their extension so the ESP32 knows whether to
        # request `.wav` or `.mp3`. Images are always `.bmp` (implied).
        if valid_exts == AUDIO_EXTS:
            entry["ext"] = ext.lstrip(".")
        entries[stem] = entry
    return entries


def _read_pack_identity(pack_dir: Path) -> Optional[dict]:
    """Pack identity for the ESP32 boot log (Phase 3 A2).

    The pack rides the EXISTING asset-manifest sync — the device gets its
    pack identity from a manifest field instead of a second sync loop.
    None when the pack has no manifest (pre-pack checkout) — old firmware
    ignores the missing/extra field either way (backward compatible).
    """
    try:
        data = json.loads((pack_dir / "pack-manifest.json").read_text(encoding="utf-8"))
        return {
            "packId": data["packId"],
            "version": data["version"],
            "contentHash": data["contentHash"],
        }
    except Exception:
        return None


def build_manifest(assets_root: Path, pack_dir: Optional[Path] = None) -> dict:
    """Produce the manifest dict ready to `json.dump`.

    `pack_dir` (the TOP-LEVEL ALN-TokenData checkout — never the nested
    `data/` submodule, whose pin may lag) adds the A2 `pack` identity
    field when its manifest is readable.
    """
    manifest = {
        "version": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "images": _scan_dir(assets_root / "images", IMAGE_EXTS),
        "audio": _scan_dir(assets_root / "audio", AUDIO_EXTS),
    }
    if pack_dir is not None:
        pack = _read_pack_identity(pack_dir)
        if pack:
            manifest["pack"] = pack
    return manifest


def write_manifest(assets_root: Path, manifest: Optional[dict] = None) -> Path:
    """Write `manifest.json` into `assets_root`, returning its path.

    Uses temp file + `Path.replace()` so a kill mid-write can never
    leave the manifest truncated. POSIX rename is atomic on the same
    filesystem (which `assets_root` always is). If the rename itself
    fails, the temp file is unlinked so we don't leave orphans behind.
    """
    manifest = manifest if manifest is not None else build_manifest(assets_root)
    out = assets_root / "manifest.json"
    tmp = assets_root / "manifest.json.tmp"
    out.parent.mkdir(parents=True, exist_ok=True)
    with tmp.open("w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.flush()
        os.fsync(f.fileno())
    try:
        tmp.replace(out)
    except Exception:
        # Best-effort cleanup. We swallow the unlink error (file may not
        # exist if replace partially succeeded on some filesystems) and
        # re-raise the original failure so callers see it.
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        raise
    return out


def prune_orphans(
    assets_root: Path,
    valid_token_ids: Iterable[str],
    *,
    dry_run: bool = False,
) -> list[Path]:
    """Delete image/audio files whose tokenId isn't in `valid_token_ids`.

    The canonical token set lives in Notion; anything here that isn't in that
    set is stale from a since-deleted token. `placeholder.bmp` is preserved
    via the explicit `EXEMPT_STEMS` list (its stem WOULD match the tokenId
    pattern), as is any file whose stem isn't a legal tokenId.

    Returns the list of (would-be) deleted paths.
    """
    allowed = {tid.lower() for tid in valid_token_ids}
    removed: list[Path] = []
    for subdir, exts in (("images", IMAGE_EXTS), ("audio", AUDIO_EXTS)):
        dirpath = assets_root / subdir
        if not dirpath.exists():
            continue
        for child in dirpath.iterdir():
            if not child.is_file():
                continue
            ext = child.suffix.lower()
            if ext not in exts:
                continue
            stem = child.stem.lower()
            if stem in EXEMPT_STEMS or not TOKEN_ID_PATTERN.match(stem):
                continue  # keep exempt/non-token files like placeholder.bmp
            if stem not in allowed:
                removed.append(child)
                if not dry_run:
                    child.unlink()
    return removed


def _cli(argv: list[str]) -> int:
    # Default location when run from the repo root.
    default_root = Path(__file__).resolve().parent.parent / "aln-memory-scanner" / "assets"
    assets_root = Path(argv[1]).resolve() if len(argv) > 1 else default_root
    if not assets_root.exists():
        print(f"error: assets root does not exist: {assets_root}", file=sys.stderr)
        return 1
    default_pack_dir = Path(__file__).resolve().parent.parent / "ALN-TokenData"
    manifest = build_manifest(assets_root, pack_dir=default_pack_dir)
    out = write_manifest(assets_root, manifest)
    print(
        f"Wrote {out} "
        f"(images={len(manifest['images'])}, audio={len(manifest['audio'])})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv))
