"""Tests for generate_asset_manifest.py — placeholder exemption (F-TOOL-06),
prune behavior, and atomic manifest write.
"""
import json

import generate_asset_manifest as gam


def _make_assets(tmp_path, images=(), audio=()):
    (tmp_path / "images").mkdir()
    (tmp_path / "audio").mkdir()
    for name in images:
        (tmp_path / "images" / name).write_bytes(b"img-bytes")
    for name in audio:
        (tmp_path / "audio" / name).write_bytes(b"aud-bytes")
    return tmp_path


class TestPlaceholderExemption:
    """F-TOOL-06: placeholder.bmp must never be pruned nor manifested."""

    def test_prune_preserves_placeholder_even_with_empty_allowlist(self, tmp_path):
        root = _make_assets(tmp_path, images=["placeholder.bmp", "abc123.bmp"])
        removed = gam.prune_orphans(root, [])
        assert (root / "images" / "placeholder.bmp").exists()
        assert not (root / "images" / "abc123.bmp").exists()
        assert [p.name for p in removed] == ["abc123.bmp"]

    def test_prune_keeps_allowed_tokens(self, tmp_path):
        root = _make_assets(
            tmp_path,
            images=["placeholder.bmp", "tok001.bmp", "stale01.bmp"],
            audio=["tok001.wav", "stale01.mp3"],
        )
        removed = gam.prune_orphans(root, ["tok001"])
        names = sorted(p.name for p in removed)
        assert names == ["stale01.bmp", "stale01.mp3"]
        assert (root / "images" / "placeholder.bmp").exists()
        assert (root / "images" / "tok001.bmp").exists()

    def test_prune_dry_run_deletes_nothing(self, tmp_path):
        root = _make_assets(tmp_path, images=["stale01.bmp"])
        removed = gam.prune_orphans(root, [], dry_run=True)
        assert [p.name for p in removed] == ["stale01.bmp"]
        assert (root / "images" / "stale01.bmp").exists()

    def test_manifest_excludes_placeholder(self, tmp_path):
        root = _make_assets(
            tmp_path, images=["placeholder.bmp", "tok001.bmp"], audio=["tok001.wav"]
        )
        manifest = gam.build_manifest(root)
        assert "placeholder" not in manifest["images"]
        assert "tok001" in manifest["images"]
        assert manifest["audio"]["tok001"]["ext"] == "wav"

    def test_non_token_stems_still_skipped(self, tmp_path):
        root = _make_assets(tmp_path, images=["Not-A-Token!.bmp"])
        manifest = gam.build_manifest(root)
        assert manifest["images"] == {}
        removed = gam.prune_orphans(root, [])
        assert removed == []


class TestWriteManifest:
    def test_write_manifest_atomic_no_tmp_left(self, tmp_path):
        root = _make_assets(tmp_path, images=["tok001.bmp"])
        out = gam.write_manifest(root)
        assert out.exists()
        assert not (root / "manifest.json.tmp").exists()
        data = json.loads(out.read_text())
        assert "tok001" in data["images"]
