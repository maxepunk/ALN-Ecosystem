# Token Generator Skill

**CRITICAL REQUIREMENT:** This skill facilitates INTERACTIVE, CONVERSATIONAL token creation. You MUST engage in back-and-forth dialogue with the user for each token. NEVER generate complete tokens without iterative refinement through questions and answers.

## Skill Purpose

This skill guides the user through creating new memory tokens for the About Last Night... immersive game, ensuring:
- Complete narrative coverage (timeline events → tokens)
- Character POV diversity
- No duplicate/redundant content
- Balanced detective mode vs blackmarket mode incentives
- Proper metadata for scoring system

## Knowledge Graph Location

All data is pre-synced to: `.claude/token-gen-cache/`

**BEFORE starting any work:** Verify the knowledge graph exists and load index.json

## Workflow States

### 1. INITIALIZATION
- Load `.claude/token-gen-cache/index.json`
- Present summary statistics
- Check for existing work session in `work-session/draft.json`
- Offer navigation options

### 2. NAVIGATION MODES

User can choose to work on:
- **Timeline Gap Filling**: Create tokens for unmapped timeline events
- **Character Balance**: Add tokens for under-represented characters
- **Thread Expansion**: Expand specific narrative threads
- **Orphan Resolution**: Create timeline events for orphaned tokens
- **Free Creation**: Craft tokens based on narrative opportunities

### 3. INTERACTIVE TOKEN CRAFTING

For EACH token, engage in iterative dialogue:

#### Stage 1: Context Gathering (ASK QUESTIONS)
```
Questions to ask:
1. Which timeline event does this token represent? (or should we create a new one?)
2. Whose POV should this token capture?
3. What specific narrative beat/moment should it cover?
4. What unique insight should this reveal?
5. What form should the memory take? (audio, document, image, video)
```

#### Stage 2: Duplicate Check (SHOW FINDINGS)
```
Before drafting, check:
- Does this timeline event already have tokens?
- If yes, what POVs are already covered?
- Are there existing tokens with similar narrative content?
- Display any potential duplicates and ask: "Should we differentiate or merge?"
```

#### Stage 3: Draft Proposal (COLLABORATIVE ITERATION)
```
Present draft token with:
- Display text (for NeurAI screen)
- Metadata (SF_ValueRating, SF_MemoryType, SF_Group, SF_Summary)
- Narrative value assessment
- Balance impact

ASK: "What should we adjust?"
ITERATE based on feedback
```

#### Stage 4: Balance Validation (DISCUSS TRADEOFFS)
```
Show impact:
- Points added to which category (Personal/Business/Technical)
- Detective mode incentive (is this narratively critical?)
- Group synergy opportunities
- Character token distribution impact

ASK: "Does this create the right gameplay tension?"
```

#### Stage 5: Approval (EXPLICIT USER CONFIRMATION)
```
MUST get explicit "yes" / "approve" / "lock it in" before marking status: "approved"
If user says "next" or "continue", token stays "in_progress"
```

### 4. SESSION MANAGEMENT

All tokens in current session are stored in: `work-session/draft.json`

**Draft.json Structure:**
```json
{
  "session_id": "session-YYYY-MM-DD-HHMM",
  "created_at": "ISO timestamp",
  "focus": "Brief description of session focus",
  "tokens": [
    {
      "status": "concept|in_progress|approved",
      "token": { /* token data */ },
      "iteration_history": [ /* changes */ ],
      "notes": [ /* user questions/decisions */ ]
    }
  ]
}
```

**Status transitions:**
- `concept`: Initial idea, major questions still open
- `in_progress`: Actively being refined
- `approved`: Locked in, ready for Notion sync

## Critical Data Files Reference

### index.json
Contains navigation map and quick stats. Load this FIRST.

### graph/characters.json
Complete character backgrounds:
```json
{
  "characters": [
    {
      "id": "notion-page-id",
      "slug": "marcus-chen",
      "name": "Dr. Marcus Chen",
      "background": {
        "overview": "Full background text",
        "emotions": "Character emotions/motivations",
        "primary_action": "Main objective"
      },
      "owned_elements": [ /* tokens this character owns */ ],
      "token_count": 8,
      "total_points": 22000
    }
  ]
}
```

### graph/timeline.json
Chronological events:
```json
{
  "events": [
    {
      "id": "notion-page-id",
      "date": "2042-01-15",
      "title": "Event description",
      "notes": "Additional context",
      "characters_involved": [ /* character references */ ],
      "linked_tokens": [ /* existing tokens for this event */ ],
      "has_tokens": true
    }
  ]
}
```

### graph/narrative-threads.json
Narrative threads with coverage:
```json
{
  "threads": [
    {
      "name": "Funding & Espionage",
      "slug": "funding-espionage",
      "token_count": 23,
      "total_points": 87500,
      "elements": [ /* all elements in thread */ ]
    }
  ]
}
```

### analysis/timeline-gaps.json
Events missing token representation:
```json
{
  "unmapped_events": [
    {
      "event_id": "evt_023",
      "date": "2042-03-20",
      "title": "Event title",
      "characters": ["Marcus Chen", "Victoria Zhao"]
    }
  ]
}
```

### current-state/all-tokens.json
All existing tokens (flat lookup):
```json
{
  "token_id": {
    "token_id": "board001",
    "element_name": "Board Meeting Presentation",
    "display_text": "Text shown on NeurAI screen",
    "SF_ValueRating": 3,
    "SF_MemoryType": "Business",
    "SF_Group": "Corporate Politics (x2)",
    "SF_Summary": "Summary text (max 350 chars)",
    "points": 3000,
    "narrative_threads": ["Funding & Espionage"],
    "timeline_event_ids": ["evt_001"],
    "owner_ids": ["marcus-chen-id"]
  }
}
```

## Duplicate Detection Algorithm

Two tokens are TOO SIMILAR if they:
1. Cover the SAME timeline event
2. From the SAME character POV
3. Without revealing UNIQUE narrative perspective

**Process:**
```
For new token:
1. Find tokens linked to same timeline event
2. Check if any have same character POV
   - If YES: HIGH risk duplicate - must differentiate or merge
3. Check tokens from same character in related threads
   - If similar content: MEDIUM risk - verify unique angle
4. Semantic check: does display text cover same narrative beat?
   - If YES: Document what makes this token's insight unique
```

## Balance Considerations

**Narrative Coherence Balance** (primary goal):
- Players should find story equally compelling regardless of discovery order
- High-value tokens should sometimes be narratively critical (detective mode tension)
- Dead-end high-value tokens should exist (pure scoring targets)
- Avoid clustering all critical narrative in low-value tokens (removes choice tension)

**Detective Mode Incentive:**
- Token is narratively critical if: linked to timeline, reveals plot/character arc, needed for puzzle
- Mix critical tokens across ALL value ratings (1-5)
- Summary field should tease narrative value without spoiling

**Group Synergies:**
- Groups should make thematic sense (related narrative beats)
- Avoid making groups too easy or too hard to complete
- Consider: can both teams realistically complete this group?

## Scoring System Reference

**Base Points (SF_ValueRating):**
- 1: 100 points
- 2: 500 points
- 3: 1000 points
- 4: 5000 points
- 5: 10000 points

**Type Multipliers (SF_MemoryType):**
- Personal: 1.0x
- Business: 3.0x
- Technical: 5.0x

**Final Token Value:** `base_points × type_multiplier`

**Group Completion Bonus:**
When team collects ALL tokens in a group:
`bonus = (multiplier - 1) × sum(all group token values)`

Example: "Evidence (x2)" group with 3 tokens (3000 + 1500 + 4500 = 9000 total)
Bonus = (2-1) × 9000 = 9000 points

## Token Field Specifications

**Required Fields:**
- `id`: Unique token_id (lowercase, alphanumeric, hyphens ok)
- `notion_element_name`: Full name for Notion Element page
- `character_pov`: Character slug (must exist in character graph)
- `narrative_threads`: Array of thread names (must match existing threads)
- `display_text`: Text shown on NeurAI screen (will be used for BMP generation)
- `SF_RFID`: Token ID (same as `id`)
- `SF_ValueRating`: 1-5
- `SF_MemoryType`: "Personal" | "Business" | "Technical"
- `SF_Group`: "Group Name (xN)" or empty string ""
- `summary`: Max 350 characters, for GM scanner display

**Optional Fields:**
- `timeline_event`: Notion page ID of timeline event (null if creating new event)
- `timeline_event_needed`: Object with new event details if timeline gap identified
- `detective_mode_reveals`: What this token reveals in detective mode
- `narrative_value`: "critical" | "supporting" | "dead_end"

## Conversational Flow Example

```
USER: /token-generator

AGENT: Loading knowledge graph from .claude/token-gen-cache/...

✓ Loaded index.json
✓ Knowledge graph last synced: 2025-11-16T14:30:00Z

Summary:
• 24 characters (156 existing tokens)
• 48 timeline events (12 missing tokens)
• 13 narrative threads
• 23 orphaned tokens (no timeline mapping)

Current session: No active draft found

What would you like to work on?
1. Fill timeline gaps (create tokens for unmapped events)
2. Balance character representation
3. Expand specific narrative thread
4. Resolve orphaned tokens (create timeline events)
5. Free exploration (browse and create)

USER: 1

AGENT: Loading timeline gaps from analysis/timeline-gaps.json...

Found 12 timeline events without token representation:

HIGH PRIORITY (critical narrative beats):
• evt_023 (2042-03-20) - "Marcus and Victoria's Final Argument"
  Characters: Marcus Chen, Victoria Zhao
  Threads: Marriage Troubles, Funding & Espionage

• evt_031 (2042-04-12) - "Walsh's Meeting with SynaptiCorp"
  Characters: James Walsh, Agent Kumar
  Threads: Funding & Espionage

MEDIUM PRIORITY:
[... more events ...]

Which event should we create tokens for? (Or type event ID)

USER: evt_023

AGENT: Great choice. Loading complete context for evt_023...

Timeline Event: "Marcus and Victoria's Final Argument" (2042-03-20)
Notes: "Pivotal moment where Victoria decides to proceed with company sale.
       Marcus discovers her secret meetings. Relationship irreparably damaged."

Characters involved:
• Marcus Chen (8 existing tokens, 22000 points)
• Victoria Zhao (12 existing tokens, 35000 points)

Narrative threads: Marriage Troubles, Funding & Espionage

Existing tokens for this event: NONE ✓ (no duplicates to worry about)

This event has NO token representation yet. We can create multiple tokens
from different POVs since it's a critical narrative moment.

Let's start with one token. Whose perspective should we capture?
1. Victoria Zhao - her reasoning for the sale
2. Marcus Chen - his sense of betrayal
3. Both (we'll create two tokens)

USER: Victoria

AGENT: Perfect. Let's craft Victoria's POV on this pivotal moment.

Loading Victoria's character background...

Victoria Zhao context:
• Role: CFO & Co-Founder
• Relationship to Marcus: Wife (estranged) and business partner
• Overview: "Brilliant businesswoman under intense investor pressure.
  Sees Marcus's unsanctioned research as existential threat to company..."
• Existing tokens: 12 (mostly business/financial perspective)

For this token, I need to understand:

1. What FORM should this memory take?
   a) Audio recording (her confiding in someone)
   b) Document (email, memo, journal entry)
   c) Image (photo, screenshot)
   d) Video (security footage, recorded call)

2. What SPECIFIC MOMENT or evidence should this capture?
   a) Her conversation with lawyer BEFORE the argument
   b) The actual argument itself (her side)
   c) Her reflection/journal entry AFTER
   d) Something else?

3. What UNIQUE INSIGHT should this reveal about Victoria?
   (What do we learn about her that we don't get from other tokens?)

USER: Audio recording, her talking to her lawyer before the argument.
      The insight should be that she's genuinely trying to protect people,
      not just being greedy like Marcus thinks.

AGENT: Excellent direction. That creates great dramatic irony - players
in detective mode learn Victoria's true motivation.

Let me check for potential duplicates...

Checking existing Victoria tokens:
• "victoria-investor-memo" - covers her business stress ✓ different angle
• "victoria-financial-report" - pure numbers, no emotion ✓ different
• "victoria-board-notes" - her public persona ✓ different

✓ NO DUPLICATES - This POV/moment is unique

Now let me draft the token...

**DRAFT TOKEN CONCEPT:**

**Form:** Audio recording (lawyer-client privileged call)
**POV:** Victoria Zhao
**Timeline:** evt_023 (2042-03-20, ~1 hour before argument)

**Display Text (for NeurAI screen):**
"I know what this means for us... for Marcus and me. But I can't let him
destroy everything we built. The employees, the investors, they're counting
on me to be the adult in the room. SynaptiCorp has the infrastructure, the
ethics board, the oversight he refuses to accept. If I don't do this now,
six months from now we're bankrupt... or worse, criminal defendants.
[pause, voice breaking] I still love him. God help me, I do. But I can't
let love blind me to what's right."

**Metadata (initial proposal):**
- SF_RFID: `victoria-lawyer-sale`
- SF_ValueRating: 4 (major plot revelation)
- SF_MemoryType: Business (corporate decision context)
- SF_Group: "Marriage Dissolution (x2)" (new group?)
- SF_Summary: "Victoria's call to lawyer explaining rationale for company
  sale; reveals genuine protective motivation and emotional toll"

**Balance Impact:**
- Points: 4 (rating) × 5000 (base) × 3.0 (Business) = **15,000 points**
- Narrative value: CRITICAL (reveals Victoria's true motivation)
- Detective mode tension: HIGH - expensive to scan (15k points sacrifice)
  but essential for understanding Victoria's arc

**Questions for you:**

1. Display text length OK? (Will fit on NeurAI screen with current length)

2. Value rating: I proposed 4 (5000 base) because this is major plot
   revelation. But we could go to 5 (10000 base) for 30k total points,
   making it even MORE expensive in detective mode. What's the right tension?

3. Group: Should this start a new "Marriage Dissolution (x2)" group?
   If so, we'd want to create 1-2 more tokens in this group (maybe Marcus's
   POV on the argument, or evidence of their earlier happy times for contrast).

4. Summary field: Should we reveal that it shows her "genuine protective
   motivation" or keep it more vague to preserve mystery?

5. Anything else to adjust in the display text or metadata?

USER: Rating 4 is good. Let's do the Marriage Dissolution group - we can
      create Marcus's POV next. Keep the summary as is.

AGENT: Perfect! Updating draft...

**STATUS UPDATE:**
✓ Token locked in as "in_progress" (pending your final approval)
✓ Added to work-session/draft.json
✓ Marked for new group: "Marriage Dissolution (x2)"

**Next Token Suggestion:** Since we're creating a x2 group, we should create
at least one more token to make the group completable.

Should we:
1. Create Marcus's POV on the same argument (evt_023)
2. Create an earlier "happier times" token for contrast
3. Finish and approve this one first, decide later

Also: Once you approve this token, I'll mark it status: "approved" and we
can move on. Does everything look good to approve?

USER: Approve it. Let's do Marcus next.

AGENT: ✓ Token "victoria-lawyer-sale" approved and locked!

Updated draft.json:
- session_id: session-2025-11-16-1430
- Approved tokens: 1
- In progress: 0
- Focus: "Fill timeline gaps for Marcus/Victoria marriage arc"

Now creating Marcus's POV on evt_023 "Marcus and Victoria's Final Argument"...

Loading Marcus Chen character context...
[... continues interactive process ...]
```

## File Operations During Session

**Reading files (use Read tool):**
- `.claude/token-gen-cache/index.json` - on initialization
- `.claude/token-gen-cache/graph/*.json` - as needed for context
- `.claude/token-gen-cache/analysis/*.json` - for gap/duplicate checks
- `.claude/token-gen-cache/current-state/*.json` - for existing token lookup

**Writing files (use Write tool):**
- `.claude/token-gen-cache/work-session/draft.json` - continuously update during session

**NEVER modify:** graph/, current-state/, analysis/ files (read-only during session)

## Session Completion

When user indicates session is complete:

1. Show session summary:
   ```
   Session Summary:
   - Total tokens created: X
   - Approved: X
   - In progress: X
   - Timeline gaps filled: X
   - New timeline events needed: X
   - Total points added: X
   ```

2. Remind user of next steps:
   ```
   Next steps to deploy these tokens:
   1. Review: cat .claude/token-gen-cache/work-session/draft.json
   2. Sync to Notion: python3 scripts/push_tokens_to_notion.py
   3. Generate assets: python3 scripts/sync_notion_to_tokens.py
   4. Commit to git: git add ALN-TokenData/tokens.json && git commit
   ```

3. Archive draft:
   ```
   Archive this session? (Moves to work-session/archive/session-{id}.json)
   This clears draft.json for next session.
   ```

## Error Handling

**If index.json missing:**
```
⚠ Knowledge graph not found at .claude/token-gen-cache/index.json

Please run the sync script first:
  python3 scripts/sync_notion_for_token_gen.py

This will fetch all data from Notion and build the knowledge graph.
```

**If draft.json corrupted:**
```
⚠ Found corrupted draft.json. Creating backup...
✓ Backed up to work-session/draft.json.backup
Starting fresh session.
```

**If duplicate detected:**
```
⚠ DUPLICATE RISK DETECTED

Existing token "board001" covers similar narrative beat:
- Same timeline event: evt_001
- Same character POV: Marcus Chen
- Similar content: Board meeting presentation

Options:
1. Differentiate: Adjust this token to reveal different aspect
2. Merge: Enhance existing token instead of creating new one
3. Proceed anyway: Both tokens serve different purposes (explain why)

What should we do?
```

## Important Reminders

1. **ALWAYS BE CONVERSATIONAL** - Ask questions, don't just generate
2. **ITERATE** - Never finalize without user approval
3. **CHECK DUPLICATES** - Before drafting, verify uniqueness
4. **SHOW IMPACT** - Display balance/scoring implications
5. **VALIDATE CONTINUOUSLY** - Save to draft.json after each significant update
6. **EXPLICIT APPROVAL** - Only mark "approved" when user confirms
7. **MAINTAIN CONTEXT** - Reference character backgrounds, timeline, existing tokens
8. **THINK NARRATIVELY** - Balance is about story coherence, not just math

## Skill Invocation

User activates with: `/token-generator` or skill invocation

You should immediately:
1. Load index.json
2. Check for existing draft.json
3. Present navigation options
4. Wait for user direction

NEVER start generating tokens without user guidance on what to work on.
