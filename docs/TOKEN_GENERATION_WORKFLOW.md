# AI-Assisted Token Generation Workflow

## Overview

This workflow enables interactive, AI-assisted creation of new memory tokens for the About Last Night... game, ensuring narrative coherence, character balance, and gameplay tension between detective mode (narrative value) and blackmarket mode (points).

## Architecture

**KISS Approach:** File-based knowledge graph + Claude Code skill

```
┌─────────────────┐
│  Notion         │  Source of Truth
│  (4 databases) │
└────────┬────────┘
         │ sync_notion_for_token_gen.py
         ▼
┌─────────────────────────────────────┐
│  Knowledge Graph (.claude/...)      │  Optimized for AI
│  - Characters (backgrounds)         │
│  - Timeline (chronological events)  │
│  - Existing tokens (organized)      │
│  - Gap analysis (what's missing)    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Claude Code Skill                  │  Interactive Session
│  /token-generator                   │
│  - Conversational Q&A               │
│  - Duplicate detection              │
│  - Balance analysis                 │
│  - Draft management                 │
└────────┬────────────────────────────┘
         │ draft.json
         ▼
┌─────────────────────────────────────┐
│  push_tokens_to_notion.py           │  Sync Back
│  - Create Notion Elements           │
│  - Link relationships               │
│  - Create timeline events (if needed)│
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  sync_notion_to_tokens.py           │  Asset Generation
│  - Generate NeurAI BMPs             │
│  - Update tokens.json               │
└─────────────────────────────────────┘
```

## Components

### 1. sync_notion_for_token_gen.py

**Location:** `scripts/sync_notion_for_token_gen.py`

**Purpose:** Fetches all narrative data from Notion and builds an optimized knowledge graph for AI agent navigation.

**What it fetches:**
- Elements database (existing tokens + all game elements)
- Characters database (complete backgrounds, relationships, motivations, arcs)
- Timeline database (chronological events with character involvement)

**What it generates:**
- `graph/characters.json` - Denormalized character nodes with owned tokens
- `graph/timeline.json` - Events with linked tokens and character context
- `graph/narrative-threads.json` - Thread coverage analysis
- `graph/correspondences.json` - Bidirectional timeline ↔ token mapping
- `current-state/all-tokens.json` - Flat lookup of existing tokens
- `current-state/tokens-by-*` - Tokens organized by timeline/character/thread
- `analysis/timeline-gaps.json` - Events without token representation
- `analysis/orphaned-tokens.json` - Tokens without timeline events
- `analysis/narrative-value.json` - Detective mode balance analysis
- `analysis/scoring-distribution.json` - Point distribution metrics
- `index.json` - Master navigation file

**Usage:**
```bash
export NOTION_TOKEN='your_token_here'
python3 scripts/sync_notion_for_token_gen.py
```

**Tested:** ✓ Mock data tests pass (scripts/test_sync_notion_mock.py)

### 2. token-generator Skill

**Location:** `.claude/skills/token-generator/skill.md`

**Purpose:** Interactive Claude Code skill for conversational token creation.

**Key Features:**
- **Conversational:** Never generates tokens without user Q&A
- **Context-aware:** Loads character backgrounds, timeline events, existing tokens
- **Duplicate detection:** Checks for similar narrative content
- **Balance analysis:** Shows impact on detective/blackmarket tension
- **Session management:** Maintains draft.json with token states (concept/in_progress/approved)

**Invocation:**
```bash
/token-generator
```

**Workflow:**
1. Load knowledge graph from `.claude/token-gen-cache/`
2. Present navigation options (timeline gaps, character balance, thread expansion)
3. Guide user through token creation with questions:
   - Which timeline event?
   - Whose POV?
   - What narrative beat?
   - What unique insight?
   - What form (audio, document, image, video)?
4. Check for duplicates
5. Draft token with metadata (SF_RFID, SF_ValueRating, SF_MemoryType, SF_Group, summary)
6. Show balance impact (points, detective mode tension)
7. Iterate based on feedback
8. Mark as approved only when user confirms
9. Save to `work-session/draft.json`

**Session State:**
All work saved to `.claude/token-gen-cache/work-session/draft.json` with:
- `session_id`
- `focus` (session goal)
- `tokens` array with status: concept → in_progress → approved

**Tested:** ✓ Can load knowledge graph and navigate (scripts/test_skill_loading.py)

### 3. push_tokens_to_notion.py

**Location:** `scripts/push_tokens_to_notion.py`

**Purpose:** Syncs approved tokens from draft.json back to Notion.

**What it does:**
1. Reads `work-session/draft.json`
2. Filters tokens with `status: "approved"`
3. Creates Notion Element pages with:
   - Name, Basic Type, Status
   - Description/Text (display text + SF_ fields)
   - Owner relation (character)
   - Narrative Threads (multi-select)
   - Timeline Event relation
4. Optionally creates new timeline events (if token.timeline_event_needed)
5. Archives session to `work-session/archive/`

**Usage:**
```bash
python3 scripts/push_tokens_to_notion.py
```

**Interactive prompts:**
- Confirms tokens to create
- Asks whether to archive session after sync

**Tested:** ✓ Field extraction and page structure validated (scripts/test_push_mock.py)

### 4. Existing Asset Generation

**Location:** `scripts/sync_notion_to_tokens.py` (unchanged)

**Purpose:** Generates NeurAI display BMPs and updates tokens.json for gameplay.

**Usage:**
```bash
python3 scripts/sync_notion_to_tokens.py
```

This existing script remains the final step to prepare tokens for deployment.

## Complete Workflow

### Initial Setup (One-Time)

```bash
# 1. Set Notion token
export NOTION_TOKEN='your_token_here'

# Or add to .env file
echo "NOTION_TOKEN=your_token_here" >> .env

# 2. Sync knowledge graph
python3 scripts/sync_notion_for_token_gen.py
```

### Token Creation Session

```bash
# 1. Start skill
/token-generator

# Skill loads knowledge graph and guides you through:
# - Selecting timeline gap or narrative focus
# - Crafting token through Q&A
# - Checking duplicates
# - Analyzing balance
# - Iterating until approved

# 2. Review session
cat .claude/token-gen-cache/work-session/draft.json

# 3. Push approved tokens to Notion
python3 scripts/push_tokens_to_notion.py

# 4. Generate assets and update tokens.json
python3 scripts/sync_notion_to_tokens.py

# 5. Commit to git
git add ALN-TokenData/tokens.json aln-memory-scanner/assets/images/
git commit -m "feat: add tokens for [timeline event/character/thread]"
git push

# 6. Refresh knowledge graph for next session
python3 scripts/sync_notion_for_token_gen.py
```

## Token Structure

Each token in draft.json contains:

**Required Fields:**
- `id`: Unique token_id (lowercase, alphanumeric, hyphens)
- `notion_element_name`: Full name for Notion Element page
- `character_pov`: Character slug (must exist in character graph)
- `narrative_threads`: Array of thread names
- `display_text`: Text shown on NeurAI screen (for BMP generation)
- `SF_RFID`: Token ID (same as `id`)
- `SF_ValueRating`: 1-5 (maps to points)
- `SF_MemoryType`: "Personal" | "Business" | "Technical" (multiplier)
- `SF_Group`: "Group Name (xN)" or empty string ""
- `summary`: Max 350 chars, for GM scanner display

**Optional Fields:**
- `timeline_event`: Notion page ID of timeline event
- `timeline_event_needed`: Object with new event details (if gap identified)
- `detective_mode_reveals`: What this reveals in detective mode
- `narrative_value`: "critical" | "supporting" | "dead_end"

## Scoring System

**Point Calculation:**
```
token_value = base_points(SF_ValueRating) × type_multiplier(SF_MemoryType)

Base Points:
  1 → 100
  2 → 500
  3 → 1000
  4 → 5000
  5 → 10000

Type Multipliers:
  Personal → 1.0x
  Business → 3.0x
  Technical → 5.0x
```

**Group Completion Bonus:**
```
When team collects ALL tokens in group:
  bonus = (multiplier - 1) × sum(all group token values)

Example: "Evidence (x2)" with 3 tokens (3000 + 1500 + 4500 = 9000)
  bonus = (2-1) × 9000 = 9000 points
```

## Balance Philosophy

**Narrative Coherence Balance:**
- Players find story equally compelling regardless of discovery order
- High-value tokens should SOMETIMES be narratively critical (creates detective mode tension)
- Dead-end high-value tokens should exist (pure scoring targets)
- Avoid clustering all critical narrative in low-value tokens (removes choice tension)

**Detective Mode Incentive:**
- Token is narratively critical if: linked to timeline, reveals plot/character arc, needed for puzzle
- Mix critical tokens across ALL value ratings (1-5)
- Summary field should tease narrative value without spoiling

**Example Tension:**
- 15,000 point token (rating 5, Business) is ALSO a critical alibi reveal
- Player choice: Scan for points (blackmarket) OR reveal story (detective mode, 0 points)
- This creates meaningful gameplay decision

## Duplicate Detection

Two tokens are TOO SIMILAR if they:
1. Cover the SAME timeline event
2. From the SAME character POV
3. Without revealing UNIQUE narrative perspective

**The skill automatically:**
- Checks existing tokens for same event + POV
- Warns if similar content detected
- Prompts user to differentiate or merge

## Timeline-Token Correspondence

**Design Goal:** Every timeline event should have at least one token. Every token should map to at least one timeline event.

**Current State:**
- Timeline events without tokens → `analysis/timeline-gaps.json`
- Tokens without timeline events → `analysis/orphaned-tokens.json`

**The skill guides:**
- Filling timeline gaps (creating tokens for unmapped events)
- Resolving orphaned tokens (creating timeline events for them)

## Testing

All scripts have been tested with mock data:

```bash
# Test sync script parsing
python3 scripts/test_sync_notion_mock.py

# Test skill can load knowledge graph
python3 scripts/test_skill_loading.py

# Test push workflow
python3 scripts/test_push_mock.py
```

All tests should pass with ✓ markers.

## Files Created

```
ALN-Ecosystem/
├── .claude/
│   ├── skills/
│   │   └── token-generator/
│   │       └── skill.md                    # Claude Code skill
│   └── token-gen-cache/
│       ├── README.md                       # Cache documentation
│       ├── index.json                      # Master navigation
│       ├── graph/                          # Denormalized nodes
│       │   ├── characters.json
│       │   ├── timeline.json
│       │   ├── narrative-threads.json
│       │   └── correspondences.json
│       ├── current-state/                  # Existing tokens
│       │   ├── all-tokens.json
│       │   ├── tokens-by-timeline.json
│       │   ├── tokens-by-character.json
│       │   └── tokens-by-thread.json
│       ├── analysis/                       # Gap analysis
│       │   ├── timeline-gaps.json
│       │   ├── orphaned-tokens.json
│       │   ├── narrative-value.json
│       │   └── scoring-distribution.json
│       └── work-session/
│           ├── draft.json                  # Active session
│           └── archive/                    # Previous sessions
├── scripts/
│   ├── sync_notion_for_token_gen.py       # Fetch & build knowledge graph
│   ├── push_tokens_to_notion.py           # Sync approved tokens back
│   ├── test_sync_notion_mock.py           # Test with mock data
│   ├── test_skill_loading.py              # Test skill can load graph
│   └── test_push_mock.py                  # Test push workflow
└── docs/
    └── TOKEN_GENERATION_WORKFLOW.md       # This file
```

## Next Steps

1. **Set NOTION_TOKEN** in environment or .env file
2. **Run initial sync:** `python3 scripts/sync_notion_for_token_gen.py`
3. **Invoke skill:** `/token-generator`
4. **Create your first token** through guided conversation
5. **Push to Notion:** `python3 scripts/push_tokens_to_notion.py`
6. **Generate assets:** `python3 scripts/sync_notion_to_tokens.py`

## Troubleshooting

See `.claude/token-gen-cache/README.md` for common issues and solutions.

## Design Principles

1. **KISS:** File-based, minimal dependencies, no new infrastructure
2. **Conversational:** AI never generates tokens without user Q&A
3. **Source of Truth:** Notion remains canonical, knowledge graph is cache
4. **Session-Scoped:** Work in batches, review together before sync
5. **Automated Sync:** Scripts handle bidirectional Notion ↔ Git flow
6. **Narrative-First:** Balance is about story coherence, not just math
