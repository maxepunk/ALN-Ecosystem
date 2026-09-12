#!/usr/bin/env python3
"""build_pack_manifest.py — (re)generate a pack's pack-manifest.json.

Python port of backend/scripts/build-pack-manifest.js for the sync
pipeline (which runs where Node may not be installed). The two builders
MUST stay byte-identical: tests/test_build_pack_manifest.py proves this
transitively by asserting this builder reproduces the COMMITTED
manifests, which backend/tests/contract/pack/pack-schemas.test.js pins
to the Node builder (the manifest-freshness contract test).

Machine-maintains the INVENTORY half of the manifest (files[] with
sha1+size, and contentHash over the sorted "path:sha1" lines) while
PRESERVING the hand-authored half (packId, version, engine, hardware,
createdAt) from an existing manifest. A pack with no manifest yet gets a
skeleton with TODO hardware that fails schema validation until authored —
intentional: the hardware section is a design statement, never derivable.

Usage: python3 build_pack_manifest.py <packDir>
"""

import hashlib
import json
import re
import sys
from pathlib import Path

EXCLUDE = {
    "pack-manifest.json",
    "game.schema.json",
    "pack-manifest.schema.json",
    "tokens.schema.json",
    "scoring-config.json",  # legacy shared file — retired by the migration, never pack inventory
    "CLAUDE.md",
    "README.md",
}

SKIP_DIRS = {"node_modules", "shared"}


def role_for(rel_path):
    if rel_path == "game.json":
        return "game"
    if rel_path == "tokens.json":
        return "tokens"
    if rel_path == "strings.json":
        return "strings"
    if rel_path == "theme.json":
        return "theme"
    if rel_path == "cues.json":
        return "cues"
    if rel_path.startswith("templates/"):
        return "template"
    if re.match(r"^assets/images/", rel_path):
        return "asset-image"
    if re.match(r"^assets/audio/", rel_path):
        return "asset-audio"
    if re.search(r"\.mp4$", rel_path):
        return "asset-video"
    return "other"


def _walk(directory, base, out):
    for entry in sorted(directory.iterdir()):
        if entry.name.startswith("."):
            continue
        rel = entry.relative_to(base).as_posix()
        if entry.is_dir():
            if entry.name in SKIP_DIRS:
                continue
            _walk(entry, base, out)
        elif entry.is_file():
            if rel in EXCLUDE:
                continue
            if rel.endswith(".html"):
                continue
            out.append(rel)
    return out


def build_files(pack_dir):
    pack_dir = Path(pack_dir)
    files = []
    for rel in sorted(_walk(pack_dir, pack_dir, [])):
        buf = (pack_dir / rel).read_bytes()
        files.append({
            "path": rel,
            "role": role_for(rel),
            "sha1": hashlib.sha1(buf).hexdigest(),
            "size": len(buf),
        })
    return files


def content_hash(files):
    lines = "\n".join(sorted(f"{f['path']}:{f['sha1']}" for f in files))
    return f"sha256:{hashlib.sha256(lines.encode('utf-8')).hexdigest()}"


def build(pack_dir):
    """Build the manifest dict for pack_dir (does not write).

    Key ORDER matters: it must match the Node builder exactly for byte
    parity of the serialized output.
    """
    pack_dir = Path(pack_dir)
    manifest_path = pack_dir / "pack-manifest.json"
    existing = (
        json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest_path.exists()
        else {}
    )

    files = build_files(pack_dir)
    manifest = {
        "kind": "pack-manifest",
        "schemaVersion": 1,
        "packId": existing.get("packId") or pack_dir.name,
        "version": existing.get("version") or "0.1.0",
        "contentHash": content_hash(files),
    }
    if existing.get("createdAt"):
        manifest["createdAt"] = existing["createdAt"]
    manifest["engine"] = existing.get("engine") or {"minVersion": "3.0.0"}
    manifest["files"] = files
    manifest["hardware"] = existing.get("hardware") or {
        "deviceClasses": [
            {"class": "staffed", "min": 1, "rationale": "TODO: author the hardware section"}
        ],
    }
    return manifest, manifest_path


def serialize(manifest):
    """Byte-identical to the Node builder's JSON.stringify(m, null, 2) + '\\n'."""
    return json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"


def write_manifest(pack_dir):
    manifest, manifest_path = build(pack_dir)
    manifest_path.write_text(serialize(manifest), encoding="utf-8")
    return manifest, manifest_path


if __name__ == "__main__":
    if len(sys.argv) != 2 or not Path(sys.argv[1]).is_dir():
        print("Usage: python3 build_pack_manifest.py <packDir>", file=sys.stderr)
        sys.exit(1)
    m, p = write_manifest(Path(sys.argv[1]).resolve())
    print(f"{p}: {len(m['files'])} files, {m['contentHash'][:23]}…")
