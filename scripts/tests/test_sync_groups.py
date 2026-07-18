"""D1b/D3b (A3 slice 2b): the sync derives the pack groups block and
hard-errors on same-group-different-multiplier conflicts."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sync_notion_to_tokens import derive_groups, write_groups_block  # noqa: E402


def test_derives_groups_from_suffixes_and_pure_names():
    tokens = {
        't1': {'SF_Group': 'Server Logs (x5)'},
        't2': {'SF_Group': 'Server Logs (x5)'},
        't3': {'SF_Group': 'Pure Name'},
        't4': {'SF_Group': ''},
    }
    assert derive_groups(tokens) == {
        'Server Logs': {'multiplier': 5},
        'Pure Name': {'multiplier': 1},
    }


def test_conflicting_multipliers_hard_error_names_both_tokens():
    tokens = {
        't1': {'SF_Group': 'Server Logs (x5)'},
        't2': {'SF_Group': 'Server Logs (x3)'},
    }
    with pytest.raises(SystemExit) as exc:
        derive_groups(tokens)
    msg = str(exc.value)
    assert 'GROUP MULTIPLIER CONFLICT' in msg
    assert 't1' in msg and 't2' in msg


def test_write_groups_block_merges_and_is_idempotent(tmp_path):
    game = tmp_path / 'game.json'
    game.write_text(json.dumps({'kind': 'game', 'scoring': {'baseValues': {'1': 1}}}))
    groups = {'Server Logs': {'multiplier': 5}}

    assert write_groups_block(game, groups) is True
    written = json.loads(game.read_text())
    assert written['groups'] == groups
    assert written['scoring'] == {'baseValues': {'1': 1}}  # merge preserves

    assert write_groups_block(game, groups) is False  # unchanged → no write
