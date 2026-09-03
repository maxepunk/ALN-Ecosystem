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


# ── Phase 3 A2: pack identity embedded in the asset manifest ──────────────────
# The ESP32 gets its pack identity from a manifest field instead of a second
# sync loop; old firmware ignores the extra field (backward compatible).

class TestPackIdentity:
    def _pack_dir(self, tmp_path, manifest=None):
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        if manifest is not None:
            (pack_dir / "pack-manifest.json").write_text(json.dumps(manifest))
        return pack_dir

    def _assets(self, tmp_path):
        assets = tmp_path / "assets"
        (assets / "images").mkdir(parents=True)
        (assets / "audio").mkdir(parents=True)
        return assets

    def test_embeds_pack_identity_when_pack_dir_given(self, tmp_path):
        pack = {
            "packId": "about-last-night",
            "version": "1.0.0",
            "contentHash": "sha256:" + "a" * 64,
            "files": [],  # extra fields ignored by the identity extraction
        }
        manifest = gam.build_manifest(
            self._assets(tmp_path), pack_dir=self._pack_dir(tmp_path, pack)
        )
        assert manifest["pack"] == {
            "packId": "about-last-night",
            "version": "1.0.0",
            "contentHash": "sha256:" + "a" * 64,
        }

    def test_omits_pack_field_without_pack_dir_or_manifest(self, tmp_path):
        assets = self._assets(tmp_path)
        assert "pack" not in gam.build_manifest(assets)
        assert "pack" not in gam.build_manifest(
            assets, pack_dir=self._pack_dir(tmp_path)  # dir exists, no manifest
        )

    def test_unreadable_pack_manifest_is_tolerated(self, tmp_path):
        pack_dir = self._pack_dir(tmp_path)
        (pack_dir / "pack-manifest.json").write_text("{nope")
        manifest = gam.build_manifest(
            self._assets(tmp_path), pack_dir=pack_dir
        )
        assert "pack" not in manifest
