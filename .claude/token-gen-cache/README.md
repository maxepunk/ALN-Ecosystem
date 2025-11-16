# Token Generation Workflow

This directory contains the knowledge graph for AI-assisted memory token creation.

## Directory Structure

```
.claude/token-gen-cache/
├── index.json                  # Master navigation file (load this first)
├── graph/                      # Denormalized graph nodes
│   ├── characters.json         # Complete character backgrounds
│   ├── timeline.json           # Chronological events
│   ├── narrative-threads.json  # Thread coverage analysis
│   └── correspondences.json    # Timeline ↔ Token mapping
├── current-state/              # Existing tokens organized by axis
│   ├── all-tokens.json         # Flat lookup by token ID
│   ├── tokens-by-timeline.json # Grouped by timeline event
│   ├── tokens-by-character.json # Grouped by character
│   └── tokens-by-thread.json   # Grouped by narrative thread
├── analysis/                   # Pre-computed gap analysis
│   ├── timeline-gaps.json      # Events missing tokens
│   ├── orphaned-tokens.json    # Tokens missing timeline
│   ├── narrative-value.json    # Detective mode balance
│   └── scoring-distribution.json # Point distribution
└── work-session/               # Active token creation
    ├── draft.json              # Current session tokens
    └── archive/                # Previous sessions

```

## Workflow

### 1. Sync Knowledge Graph from Notion

```bash
# Requires NOTION_TOKEN environment variable
export NOTION_TOKEN='your_token_here'

# Fetch all data and build knowledge graph
python3 scripts/sync_notion_for_token_gen.py
```

This fetches:
- All Elements (existing tokens + game props)
- All Characters (backgrounds, relationships, arcs)
- All Timeline events (chronological narrative)

And generates:
- Denormalized graph files
- Gap analysis (timeline without tokens, tokens without timeline)
- Scoring/balance metrics

### 2. Create Tokens with Claude Code Skill

```bash
# Invoke skill
/token-generator
```

The skill provides:
- Interactive, conversational token creation
- Timeline gap filling
- Character balance checking
- Duplicate detection
- Balance impact analysis

All work saved to `work-session/draft.json`

### 3. Push Approved Tokens to Notion

```bash
python3 scripts/push_tokens_to_notion.py
```

This:
- Reads approved tokens from draft.json
- Creates Notion Element pages
- Links to characters, timeline, narrative threads
- Optionally creates new timeline events

### 4. Generate Assets & Update tokens.json

```bash
python3 scripts/sync_notion_to_tokens.py
```

This:
- Generates NeurAI BMP display images
- Updates `ALN-TokenData/tokens.json` for gameplay
- Syncs to ESP32 scanner

### 5. Commit to Git

```bash
git add ALN-TokenData/tokens.json aln-memory-scanner/assets/images/
git commit -m "feat: add new memory tokens"
git push
```

## File Formats

### draft.json

```json
{
  "session_id": "session-2025-11-16-1430",
  "created_at": "2025-11-16T14:30:00Z",
  "focus": "Fill timeline gaps for marriage arc",
  "tokens": [
    {
      "status": "approved|in_progress|concept",
      "token": {
        "id": "victoria-lawyer-call",
        "notion_element_name": "Victoria's Lawyer Call - Sale Decision",
        "timeline_event": "evt_023",
        "character_pov": "victoria-zhao",
        "narrative_threads": ["Marriage Troubles", "Funding & Espionage"],
        "display_text": "I know what this means for us...",
        "SF_RFID": "victoria-lawyer-call",
        "SF_ValueRating": 4,
        "SF_MemoryType": "Business",
        "SF_Group": "Marriage Dissolution (x2)",
        "summary": "Victoria's call to lawyer explaining rationale",
        "narrative_value": "critical",
        "detective_mode_reveals": "Victoria's genuine protective motivation"
      },
      "iteration_history": [],
      "notes": []
    }
  ]
}
```

## Testing

Run tests to verify setup:

```bash
# Test with mock data (no NOTION_TOKEN required)
python3 scripts/test_sync_notion_mock.py
python3 scripts/test_skill_loading.py
python3 scripts/test_push_mock.py
```

All tests should pass with ✓ markers.

## Troubleshooting

### "Knowledge graph not found"

Run `python3 scripts/sync_notion_for_token_gen.py` to fetch data from Notion.

### "No draft found"

Use `/token-generator` skill to create tokens. The skill manages draft.json automatically.

### "Character not found in lookup"

Character slug in token doesn't match any character in graph/characters.json.
Check spelling and use correct slug format (lowercase, hyphens, no spaces).

### "NOTION_TOKEN not found"

Set environment variable:
```bash
export NOTION_TOKEN='your_token_here'
```

Or add to `.env` file in project root.
