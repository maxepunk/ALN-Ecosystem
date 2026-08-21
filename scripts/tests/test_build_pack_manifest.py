"""Parity + behavior tests for build_pack_manifest.py (Phase 3 A2).

The critical property: this Python builder must stay BYTE-IDENTICAL to
backend/scripts/build-pack-manifest.js. Node is not available in this
test environment, so parity is proven transitively: the committed
pack-manifest.json files are pinned to the Node builder's output by
backend/tests/contract/pack/pack-schemas.test.js (manifest freshness),
and these tests assert the Python builder reproduces those committed
bytes exactly. If either builder drifts, one of the two suites fails.
"""

import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_pack_manifest  # noqa: E402

ECOSYSTEM_ROOT = Path(__file__).resolve().parents[2]
ALN_PACK = ECOSYSTEM_ROOT / "ALN-TokenData"
TOY_PACK = ECOSYSTEM_ROOT / "backend/tests/e2e/fixtures/packs/toy-heist"


@pytest.mark.parametrize("pack_dir", [ALN_PACK, TOY_PACK], ids=["aln", "toy-heist"])
def test_reproduces_committed_manifest_bytes(pack_dir):
    """Byte parity with the Node builder, transitively via the committed file."""
    manifest, manifest_path = build_pack_manifest.build(pack_dir)
    assert manifest_path.exists(), f"{pack_dir} has no committed manifest"
    committed = manifest_path.read_text(encoding="utf-8")
    assert build_pack_manifest.serialize(manifest) == committed, (
        f"Python builder output differs from the committed {manifest_path.name} "
        "(which the backend contract suite pins to the Node builder). "
        "The two builders have drifted — fix build_pack_manifest.py."
    )


def test_preserves_hand_authored_half():
    manifest, _ = build_pack_manifest.build(ALN_PACK)
    committed = json.loads((ALN_PACK / "pack-manifest.json").read_text())
    assert manifest["packId"] == committed["packId"]
    assert manifest["version"] == committed["version"]
    assert manifest["engine"] == committed["engine"]
    assert manifest["hardware"] == committed["hardware"]


def test_content_hash_format_and_determinism():
    files = build_pack_manifest.build_files(TOY_PACK)
    h1 = build_pack_manifest.content_hash(files)
    h2 = build_pack_manifest.content_hash(list(reversed(files)))
    assert re.match(r"^sha256:[0-9a-f]{64}$", h1)
    assert h1 == h2  # line-sort makes input order irrelevant


def test_skeleton_for_manifestless_pack(tmp_path):
    (tmp_path / "tokens.json").write_text("{}")
    manifest, _ = build_pack_manifest.build(tmp_path)
    assert manifest["packId"] == tmp_path.name
    assert manifest["version"] == "0.1.0"
    rationale = manifest["hardware"]["deviceClasses"][0]["rationale"]
    assert "TODO" in rationale  # fails schema validation until authored — by design
    assert [f["path"] for f in manifest["files"]] == ["tokens.json"]
    assert manifest["files"][0]["role"] == "tokens"


def test_excludes_schemas_legacy_and_tooling(tmp_path):
    for name in [
        "tokens.json", "game.json", "scoring-config.json",
        "tokens.schema.json", "pack-manifest.schema.json", "game.schema.json",
        "CLAUDE.md", "README.md", "tag-writer.html", ".hidden",
    ]:
        (tmp_path / name).write_text("x")
    (tmp_path / "shared").mkdir()
    (tmp_path / "shared/aln-tools.js").write_text("x")
    manifest, _ = build_pack_manifest.build(tmp_path)
    assert [f["path"] for f in manifest["files"]] == ["game.json", "tokens.json"]


def test_role_inference():
    role = build_pack_manifest.role_for
    assert role("game.json") == "game"
    assert role("tokens.json") == "tokens"
    assert role("strings.json") == "strings"
    assert role("assets/images/kaa001.bmp") == "asset-image"
    assert role("assets/audio/kaa001.wav") == "asset-audio"
    assert role("intro.mp4") == "asset-video"
    assert role("templates/report.md") == "template"
    assert role("misc.txt") == "other"
