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
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

# Filenames must match the ESP32's tokenId validation (lowercased, [a-z0-9_]+).
TOKEN_ID_PATTERN = re.compile(r"^[a-z0-9_]+$")

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

    Files whose stem isn't a legal tokenId (e.g. `placeholder.bmp`) are
    skipped deliberately — only game tokens belong in the manifest.
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
        if not TOKEN_ID_PATTERN.match(stem):
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


def build_manifest(assets_root: Path) -> dict:
    """Produce the manifest dict ready to `json.dump`."""
    return {
        "version": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "images": _scan_dir(assets_root / "images", IMAGE_EXTS),
        "audio": _scan_dir(assets_root / "audio", AUDIO_EXTS),
    }


def write_manifest(assets_root: Path, manifest: Optional[dict] = None) -> Path:
    """Write `manifest.json` into `assets_root`, returning its path."""
    manifest = manifest if manifest is not None else build_manifest(assets_root)
    out = assets_root / "manifest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
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
    because its stem isn't a legal tokenId so it never matches the filter.

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
            if not TOKEN_ID_PATTERN.match(stem):
                continue  # keep non-token files like placeholder.bmp
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
    manifest = build_manifest(assets_root)
    out = write_manifest(assets_root, manifest)
    print(
        f"Wrote {out} "
        f"(images={len(manifest['images'])}, audio={len(manifest['audio'])})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv))
