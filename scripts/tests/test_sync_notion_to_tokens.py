"""Characterization tests for the pure functions in sync_notion_to_tokens.py.

Phase 0 guardrails: these tests pin CURRENT behavior, including known
quirks from the 2026-06 platform review (F-TOOL-17, F-TOOL-08). Quirk pins
are explicitly marked "documented-bug pin" — when those findings are fixed,
flip the assertions deliberately as part of the fix commit.
"""
from sync_notion_to_tokens import (
    extract_timestamp,
    parse_sf_fields,
    segment_line_for_highlighting,
)


class TestParseSfFields:
    def test_parses_all_fields_happy_path(self):
        text = (
            "Some display text\n\n"
            "SF_RFID: [TAC001]\n"
            "SF_ValueRating: [4]\n"
            "SF_MemoryType: [Personal]\n"
            "SF_Group: [Server Logs (x5)]\n"
            "SF_Summary: [A memorable evening]\n"
        )
        result = parse_sf_fields(text)
        assert result == {
            "SF_RFID": "tac001",  # RFID is lowercased
            "SF_ValueRating": 4,
            "SF_MemoryType": "Personal",
            "SF_Group": "Server Logs (x5)",
            "SF_Summary": "A memorable evening",
        }

    def test_missing_fields_get_defaults(self):
        result = parse_sf_fields("no SF fields at all")
        assert result == {
            "SF_RFID": None,
            "SF_ValueRating": None,
            "SF_MemoryType": None,
            "SF_Group": "",  # group defaults to empty string, not None
            "SF_Summary": None,
        }

    def test_empty_brackets_yield_defaults(self):
        text = "SF_RFID: []\nSF_ValueRating: []\nSF_Group: []\nSF_Summary: []"
        result = parse_sf_fields(text)
        assert result["SF_RFID"] is None
        assert result["SF_ValueRating"] is None
        assert result["SF_Group"] == ""
        assert result["SF_Summary"] is None

    def test_field_names_match_case_insensitively(self):
        result = parse_sf_fields("sf_rfid: [ABC123]")
        assert result["SF_RFID"] == "abc123"

    def test_whitespace_inside_brackets_is_stripped(self):
        result = parse_sf_fields("SF_MemoryType: [ Business ]")
        assert result["SF_MemoryType"] == "Business"

    def test_summary_with_bracket_truncates_at_first_close_bracket(self):
        # documented-bug pin (F-TOOL-17): the `\[([^\]]*)\]` regex cannot
        # represent a `]` inside a value, so the summary silently truncates
        # at the first `]`. The truncated text propagates to the public
        # scoreboard evidence card with no warning. Flip when fixed.
        text = 'SF_Summary: [He said "do it [now]" and left]'
        result = parse_sf_fields(text)
        assert result["SF_Summary"] == 'He said "do it [now'

    def test_duplicate_rfid_lines_first_one_wins_silently(self):
        # documented-bug pin (F-TOOL-17): copy-paste template residue with
        # two SF_RFID lines is not flagged; re.search takes the first.
        text = "SF_RFID: [first01]\nSF_RFID: [second02]"
        result = parse_sf_fields(text)
        assert result["SF_RFID"] == "first01"

    def test_non_integer_rating_becomes_none_silently(self):
        # documented-bug pin (F-TOOL-08): `SF_ValueRating: [4.5]` raises
        # ValueError in int() and is silently coerced to None (token then
        # scores as UNKNOWN/0x downstream). Flip when fixed.
        result = parse_sf_fields("SF_ValueRating: [4.5]")
        assert result["SF_ValueRating"] is None

    def test_rating_with_surrounding_spaces_parses(self):
        result = parse_sf_fields("SF_ValueRating: [ 3 ]")
        assert result["SF_ValueRating"] == 3


class TestExtractTimestamp:
    def test_strips_token_prefix_and_extracts_time(self):
        ts, ts_type, rest = extract_timestamp("TAC001 - 11:32PM - The argument escalated")
        assert ts == "11:32PM"
        assert ts_type == "time"
        assert rest == "The argument escalated"

    def test_extracts_date_as_backstory(self):
        ts, ts_type, rest = extract_timestamp("ALR001 - 05/12/2022 - They met at the gala")
        assert ts == "05/12/2022"
        assert ts_type == "date"
        assert rest == "They met at the gala"

    def test_unknown_time_marker(self):
        ts, ts_type, _ = extract_timestamp("TAC002 - ??:??AM - Blurry memory")
        assert ts == "??:??AM"
        assert ts_type == "unknown"

    def test_unknown_date_marker(self):
        ts, ts_type, _ = extract_timestamp("TAC003 - ??/??/?? - Undated record")
        assert ts == "??/??/??"
        assert ts_type == "unknown"

    def test_no_timestamp_returns_text_with_prefix_stripped(self):
        ts, ts_type, rest = extract_timestamp("TAC004 - Just body text here")
        assert ts is None
        assert ts_type is None
        assert rest == "Just body text here"

    def test_no_prefix_no_timestamp_returns_input(self):
        ts, ts_type, rest = extract_timestamp("Plain text without any structure")
        assert (ts, ts_type) == (None, None)
        assert rest == "Plain text without any structure"

    def test_five_letter_token_code_is_not_stripped(self):
        # documented-bug pin (F-TOOL-17): TOKEN_PREFIX_PATTERN only matches
        # 2-4 letters + 2-4 digits, so a 5-letter code leaks into the
        # rendered BMP body text (and blocks timestamp extraction, since
        # the timestamp is no longer at string start). Flip when fixed.
        ts, ts_type, rest = extract_timestamp("TANGO001 - 11:32PM - Body")
        assert (ts, ts_type) == (None, None)
        assert rest == "TANGO001 - 11:32PM - Body"

    def test_hyphenated_token_code_is_not_stripped(self):
        # documented-bug pin (F-TOOL-17): codes like "TAC-001" miss the
        # prefix regex (hyphen between letters and digits). Flip when fixed.
        ts, ts_type, rest = extract_timestamp("TAC-001 - 11:32PM - Body")
        assert (ts, ts_type) == (None, None)
        assert rest == "TAC-001 - 11:32PM - Body"

    def test_timestamp_not_at_start_stays_in_body(self):
        # documented-bug pin (F-TOOL-17): timestamp regexes are anchored at
        # string start (after prefix strip), so "Recorded 11:32PM - ..."
        # keeps the timestamp in body text and loses the dim/bright header
        # semantics. Flip when fixed.
        ts, ts_type, rest = extract_timestamp("TAC005 - Recorded 11:32PM - details")
        assert (ts, ts_type) == (None, None)
        assert rest == "Recorded 11:32PM - details"


class TestSegmentLineForHighlighting:
    def test_highlights_all_caps_character_names(self):
        segments = segment_line_for_highlighting("Then ALEX saw the ledger")
        assert segments == [
            ("Then ", False),
            ("ALEX", True),
            (" saw the ledger", False),
        ]

    def test_possessive_name_is_one_segment(self):
        segments = segment_line_for_highlighting("MORGAN's keys")
        assert segments == [("MORGAN's", True), (" keys", False)]

    def test_line_without_names_is_single_segment(self):
        segments = segment_line_for_highlighting("nothing shouted here")
        assert segments == [("nothing shouted here", False)]
