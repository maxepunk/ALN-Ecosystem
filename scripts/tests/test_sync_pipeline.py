"""Pipeline-level tests for sync_notion_to_tokens.py (Tier E wave-2 fixes).

Covers:
- F-TOOL-01/07 + E8: abort-on-incomplete-fetch (no write, no prune), --force
- E8: prune defaults to dry-run reporting; --prune actually deletes
- F-TOOL-08/21: semantic validation warnings (memory type, rating, duplicates)
- F-TOOL-10: atomic tokens.json write
- F-TOOL-18: non-text rich_text blocks are skipped with a warning
- E11: RFID<->file alignment check folded into sync
"""
import json

import pytest

import sync_notion_to_tokens as sync


# ── Fakes ──────────────────────────────────────────────────────────────


def make_page(name, description, basic_type="Memory Token", owner_ids=(), extra_rich=None):
    rich = [{"type": "text", "text": {"content": description}, "plain_text": description}]
    if extra_rich:
        rich.extend(extra_rich)
    return {
        "id": f"page-{name}",
        "properties": {
            "Name": {"title": [{"type": "text", "text": {"content": name}, "plain_text": name}]},
            "Basic Type": {"select": {"name": basic_type}},
            "Description/Text": {"rich_text": rich},
            "Owner": {"relation": [{"id": oid} for oid in owner_ids]},
        },
    }


def fake_post_pages(pages_batches):
    """Build a post() fake returning successive paginated responses."""
    calls = {"n": 0}

    def post(url, json_data):
        i = calls["n"]
        calls["n"] += 1
        batch = pages_batches[i]
        if isinstance(batch, Exception):
            raise batch
        return batch

    return post


# ── Pagination completeness (F-TOOL-01) ────────────────────────────────


class TestQueryDatabaseAll:
    def test_missing_results_key_raises(self):
        post = fake_post_pages([{"object": "error", "status": 401}])
        with pytest.raises(sync.NotionFetchError):
            sync._query_database_all("db-id", post=post)

    def test_mid_pagination_failure_raises(self):
        post = fake_post_pages([
            {"results": [1, 2], "has_more": True, "next_cursor": "c1"},
            sync.NotionFetchError("HTTP 500"),
        ])
        with pytest.raises(sync.NotionFetchError):
            sync._query_database_all("db-id", post=post)

    def test_has_more_without_cursor_raises(self):
        post = fake_post_pages([{"results": [1], "has_more": True, "next_cursor": None}])
        with pytest.raises(sync.NotionFetchError):
            sync._query_database_all("db-id", post=post)

    def test_complete_pagination_returns_all(self):
        post = fake_post_pages([
            {"results": [1, 2], "has_more": True, "next_cursor": "c1"},
            {"results": [3], "has_more": False},
        ])
        assert sync._query_database_all("db-id", post=post) == [1, 2, 3]

    def test_force_returns_partial_on_failure(self, capsys):
        post = fake_post_pages([
            {"results": [1, 2], "has_more": True, "next_cursor": "c1"},
            sync.NotionFetchError("HTTP 500"),
        ])
        results = sync._query_database_all("db-id", post=post, force=True)
        assert results == [1, 2]
        assert "force" in capsys.readouterr().out.lower()


# ── Semantic validation (F-TOOL-08/21) ────────────────────────────────


class TestValidateTokens:
    VALID_TYPES = {"Personal", "Business", "Technical", "Mention", "Party"}

    def _token(self, **over):
        base = {
            "SF_RFID": "tok001", "SF_ValueRating": 3, "SF_MemoryType": "Personal",
            "SF_Group": "", "image": "assets/images/tok001.bmp",
            "audio": None, "video": None, "processingImage": None,
        }
        base.update(over)
        return base

    def test_clean_token_no_warnings(self):
        warnings = sync.validate_tokens({"tok001": self._token()}, self.VALID_TYPES)
        assert warnings == []

    def test_misspelled_memory_type_warns(self):
        tokens = {"tok001": self._token(SF_MemoryType="Personnal")}
        warnings = sync.validate_tokens(tokens, self.VALID_TYPES)
        assert any("Personnal" in w and "tok001" in w for w in warnings)

    def test_case_mismatch_memory_type_warns(self):
        tokens = {"tok001": self._token(SF_MemoryType="party")}
        warnings = sync.validate_tokens(tokens, self.VALID_TYPES)
        assert any("party" in w for w in warnings)

    def test_missing_memory_type_warns(self):
        tokens = {"tok001": self._token(SF_MemoryType=None)}
        assert any("SF_MemoryType" in w for w in sync.validate_tokens(tokens, self.VALID_TYPES))

    def test_out_of_range_rating_warns(self):
        for bad in (0, 6, -3):
            tokens = {"tok001": self._token(SF_ValueRating=bad)}
            warnings = sync.validate_tokens(tokens, self.VALID_TYPES)
            assert any("SF_ValueRating" in w for w in warnings), f"rating {bad} not flagged"

    def test_missing_rating_warns(self):
        tokens = {"tok001": self._token(SF_ValueRating=None)}
        assert any("SF_ValueRating" in w for w in sync.validate_tokens(tokens, self.VALID_TYPES))


class TestAssetAlignment:
    def test_orphan_asset_file_reported(self, tmp_path):
        images = tmp_path / "images"
        images.mkdir()
        (images / "tok001.bmp").write_bytes(b"x")
        (images / "stale99.bmp").write_bytes(b"x")
        (images / "placeholder.bmp").write_bytes(b"x")
        tokens = {"tok001": {"image": "assets/images/tok001.bmp", "audio": None, "video": None, "processingImage": None}}
        warnings = sync.check_asset_alignment(
            tokens, images_dir=images, audio_dir=tmp_path / "none", videos_dir=tmp_path / "none"
        )
        assert any("stale99" in w for w in warnings)
        assert not any("placeholder" in w for w in warnings)
        assert not any("tok001.bmp" in w for w in warnings)

    def test_token_without_assets_reported(self, tmp_path):
        tokens = {"ghost01": {"image": None, "audio": None, "video": None, "processingImage": None}}
        warnings = sync.check_asset_alignment(
            tokens, images_dir=tmp_path / "none", audio_dir=tmp_path / "none", videos_dir=tmp_path / "none"
        )
        assert any("ghost01" in w for w in warnings)

    def test_idle_loop_video_exempt(self, tmp_path):
        videos = tmp_path / "videos"
        videos.mkdir()
        (videos / "idle-loop.mp4").write_bytes(b"x")
        warnings = sync.check_asset_alignment(
            {}, images_dir=tmp_path / "none", audio_dir=tmp_path / "none", videos_dir=videos
        )
        assert warnings == []


# ── Rich text tolerance (F-TOOL-18) ────────────────────────────────────


class TestJoinRichText:
    def test_joins_text_blocks(self):
        blocks = [
            {"type": "text", "text": {"content": "a"}},
            {"type": "text", "text": {"content": "b"}},
        ]
        assert sync.join_rich_text(blocks, "Page X") == "ab"

    def test_skips_mention_block_with_warning(self, capsys):
        blocks = [
            {"type": "text", "text": {"content": "before "}},
            {"type": "mention", "mention": {"type": "page"}, "plain_text": "@Someone"},
            {"type": "text", "text": {"content": " after"}},
        ]
        result = sync.join_rich_text(blocks, "Page X")
        assert result == "before  after"
        out = capsys.readouterr().out
        assert "Page X" in out and "mention" in out


# ── Atomic write (F-TOOL-10) ───────────────────────────────────────────


class TestWriteTokensJson:
    def test_writes_atomically_no_tmp_left(self, tmp_path):
        path = tmp_path / "tokens.json"
        sync.write_tokens_json(path, {"a": 1})
        assert json.loads(path.read_text()) == {"a": 1}
        assert list(tmp_path.glob("*.tmp")) == []

    def test_failure_leaves_original_intact(self, tmp_path):
        path = tmp_path / "tokens.json"
        path.write_text('{"original": true}')
        with pytest.raises(TypeError):
            sync.write_tokens_json(path, {"bad": object()})
        assert json.loads(path.read_text()) == {"original": True}
        assert list(tmp_path.glob("*.tmp")) == []


# ── main() abort posture (F-TOOL-01/07 + E8) ───────────────────────────


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    """Point all module path globals into a tmp tree; stub BMP generation."""
    assets_root = tmp_path / "aln-memory-scanner" / "assets"
    images = assets_root / "images"
    audio = assets_root / "audio"
    videos = tmp_path / "videos"
    for d in (images, audio, videos):
        d.mkdir(parents=True)
    tokens_json = tmp_path / "tokens.json"
    tokens_json.write_text(json.dumps({"pre001": {"SF_RFID": "pre001"}}))

    monkeypatch.setattr(sync, "ECOSYSTEM_ROOT", tmp_path)
    monkeypatch.setattr(sync, "ASSETS_ROOT", assets_root)
    monkeypatch.setattr(sync, "ASSETS_IMAGES", images)
    monkeypatch.setattr(sync, "ASSETS_AUDIO", audio)
    monkeypatch.setattr(sync, "VIDEOS_DIR", videos)
    monkeypatch.setattr(sync, "TOKENS_JSON", tokens_json)
    # D3b: main() writes the derived groups block to GAME_JSON_PATH — the
    # sandbox MUST redirect it or pipeline tests corrupt the real pack
    # (caught 2026-07-18: a sandbox run emptied ALN's groups block).
    game_json = tmp_path / "game.json"
    game_json.write_text(json.dumps({"kind": "game"}))
    monkeypatch.setattr(sync, "GAME_JSON_PATH", game_json)
    monkeypatch.setattr(
        sync, "generate_neurai_display",
        lambda rfid, text: f"assets/images/{rfid}.bmp",
    )
    return {"tokens_json": tokens_json, "images": images, "audio": audio}


class TestMainAbortPosture:
    def test_fetch_failure_exits_1_without_write_or_prune(self, sandbox, monkeypatch, capsys):
        orphan = sandbox["images"] / "orphan99.bmp"
        orphan.write_bytes(b"x")

        def boom(force=False, post=None):
            raise sync.NotionFetchError("HTTP 500 mid-pagination")

        monkeypatch.setattr(sync, "fetch_all_memory_tokens", boom)
        with pytest.raises(SystemExit) as exc:
            sync.main([])
        assert exc.value.code == 1
        # tokens.json untouched, orphan not pruned
        assert json.loads(sandbox["tokens_json"].read_text()) == {"pre001": {"SF_RFID": "pre001"}}
        assert orphan.exists()
        assert "ABORT" in capsys.readouterr().out.upper()

    def test_characters_failure_also_aborts(self, sandbox, monkeypatch):
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        monkeypatch.setattr(sync, "fetch_all_memory_tokens", lambda force=False, post=None: [page])

        def boom(force=False, post=None):
            raise sync.NotionFetchError("characters DB gone")

        monkeypatch.setattr(sync, "fetch_all_characters", boom)
        with pytest.raises(SystemExit) as exc:
            sync.main([])
        assert exc.value.code == 1
        assert json.loads(sandbox["tokens_json"].read_text()) == {"pre001": {"SF_RFID": "pre001"}}

    def test_empty_character_map_warns_loudly(self, sandbox, monkeypatch, capsys):
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        monkeypatch.setattr(sync, "fetch_all_memory_tokens", lambda force=False, post=None: [page])
        monkeypatch.setattr(sync, "fetch_all_characters", lambda force=False, post=None: {})
        sync.main([])
        out = capsys.readouterr().out
        assert "WARNING" in out and "owner" in out.lower()


class TestMainPruneGating:
    def _wire(self, monkeypatch, pages):
        monkeypatch.setattr(sync, "fetch_all_memory_tokens", lambda force=False, post=None: pages)
        monkeypatch.setattr(sync, "fetch_all_characters", lambda force=False, post=None: {"char-1": "Ashe Motoko"})

    def test_prune_defaults_to_dry_run_report(self, sandbox, monkeypatch, capsys):
        orphan = sandbox["images"] / "orphan99.bmp"
        orphan.write_bytes(b"x")
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        self._wire(monkeypatch, [page])

        sync.main([])
        out = capsys.readouterr().out
        assert orphan.exists(), "default run must NOT delete"
        assert "would remove" in out.lower()
        assert "--prune" in out
        # tokens.json WAS rewritten
        assert "tok001" in json.loads(sandbox["tokens_json"].read_text())

    def test_explicit_prune_deletes(self, sandbox, monkeypatch):
        orphan = sandbox["images"] / "orphan99.bmp"
        orphan.write_bytes(b"x")
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        self._wire(monkeypatch, [page])

        sync.main(["--prune"])
        assert not orphan.exists()

    def test_dry_run_writes_nothing(self, sandbox, monkeypatch):
        orphan = sandbox["images"] / "orphan99.bmp"
        orphan.write_bytes(b"x")
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        self._wire(monkeypatch, [page])

        sync.main(["--dry-run", "--prune"])
        assert orphan.exists()
        assert json.loads(sandbox["tokens_json"].read_text()) == {"pre001": {"SF_RFID": "pre001"}}

    def test_prune_skipped_on_over_half_shrink(self, sandbox, monkeypatch, capsys):
        # Existing tokens.json has 3 tokens; Notion now returns 1 (>50% drop —
        # e.g. a bulk-archived DB). --prune must be refused, not honored.
        sandbox["tokens_json"].write_text(json.dumps({
            "pre001": {"SF_RFID": "pre001"},
            "pre002": {"SF_RFID": "pre002"},
            "pre003": {"SF_RFID": "pre003"},
        }))
        orphan = sandbox["images"] / "orphan99.bmp"
        orphan.write_bytes(b"x")
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        self._wire(monkeypatch, [page])

        sync.main(["--prune"])
        out = capsys.readouterr().out
        assert orphan.exists(), "prune must be skipped on a suspicious shrink"
        assert "PRUNE SKIPPED" in out
        assert "--force" in out

    def test_force_overrides_shrink_prune_guard(self, sandbox, monkeypatch):
        sandbox["tokens_json"].write_text(json.dumps({
            "pre001": {"SF_RFID": "pre001"},
            "pre002": {"SF_RFID": "pre002"},
            "pre003": {"SF_RFID": "pre003"},
        }))
        orphan = sandbox["images"] / "orphan99.bmp"
        orphan.write_bytes(b"x")
        page = make_page("Token A", "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]")
        self._wire(monkeypatch, [page])

        sync.main(["--prune", "--force"])
        assert not orphan.exists()

    def test_duplicate_rfid_warns_with_both_titles(self, sandbox, monkeypatch, capsys):
        desc = "Body\n\nSF_RFID: [tok001]\nSF_ValueRating: [3]\nSF_MemoryType: [Personal]"
        self._wire(monkeypatch, [make_page("First Page", desc), make_page("Second Page", desc)])

        sync.main([])
        out = capsys.readouterr().out
        assert "First Page" in out and "Second Page" in out
        assert "duplicate" in out.lower()
