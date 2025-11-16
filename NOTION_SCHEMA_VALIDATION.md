# Notion Schema Validation Report

**Date:** 2025-11-16
**Scripts Validated:**
- `scripts/sync_notion_for_token_gen.py`
- `scripts/push_tokens_to_notion.py`

**Schema Source:** `.claude/skills/about-last-night-notion/references/`

---

## Summary

✅ **PASS** - All property accesses are aligned with current Notion schema

**Databases Accessed:**
1. Elements (`18c2f33d-583f-8020-91bc-d84c7dd94306`) ✅
2. Characters (`18c2f33d-583f-8060-a6ab-de32ff06bca2`) ✅
3. Timeline (`1b52f33d-583f-80de-ae5a-d20020c120dd`) ✅

---

## Detailed Property Validation

### Elements Database ✅

**Properties Accessed in sync_notion_for_token_gen.py:**

| Script Property Access | Schema Property | Type | Status |
|----------------------|-----------------|------|--------|
| `props.get("Name")` | Name | Title | ✅ Match |
| `props.get("Basic Type")` | Basic Type | Select | ✅ Match |
| `props.get("Description/Text")` | Description/Text | Text | ✅ Match |
| `props.get("Timeline Event")` | Timeline Event | Relation → Timeline | ✅ Match |
| `props.get("Narrative Threads")` | Narrative Threads | Multi-select | ✅ Match |
| `props.get("Owner")` | Owner | Relation → Characters | ✅ Match |

**Properties Accessed in push_tokens_to_notion.py:**

| Script Property Access | Schema Property | Type | Status |
|----------------------|-----------------|------|--------|
| `"Name"` (create) | Name | Title | ✅ Match |
| `"Basic Type"` (create) | Basic Type | Select | ✅ Match |
| `"Status"` (create) | Status | Status | ✅ Match |
| `"Description/Text"` (create) | Description/Text | Text | ✅ Match |
| `"Narrative Threads"` (create) | Narrative Threads | Multi-select | ✅ Match |
| `"Timeline Event"` (create) | Timeline Event | Relation → Timeline | ✅ Match |
| `"Owner"` (create) | Owner | Relation → Characters | ✅ Match |

**Basic Type Values Used:**
- Script uses: `"Memory Token Image"` (default via `infer_basic_type()`)
- Schema has: Memory Token Image, Memory Token Audio, Memory Token Video, Memory Token Audio + Image
- ✅ **Valid** - Script uses correct value from schema

**Narrative Threads Values:**
Script passes user-provided thread names directly (no hardcoded values).
Schema has 13 thread options (Funding & Espionage, Marriage Troubles, etc.)
⚠️ **Risk:** No validation that thread names match schema multi-select options

**Recommendation:**
Add thread name validation in push script:
```python
VALID_THREADS = [
    "Funding & Espionage", "Underground Parties", "Memory Drug",
    "Marriage Troubles", "Ephemeral Echo", "Tech Development",
    "Advanced Technology", "Emergent Third Path", "Blackmail",
    "Unsanctioned Research", "Class Conflicts", "Murder Timeline",
    "Investigative Journalism", "The Senate Testimony"
]

for thread in token["narrative_threads"]:
    if thread not in VALID_THREADS:
        print(f"⚠ Warning: '{thread}' not in schema multi-select options")
```

---

### Characters Database ✅

**Properties Accessed in sync_notion_for_token_gen.py:**

| Script Property Access | Schema Property | Type | Status |
|----------------------|-----------------|------|--------|
| `props.get("Name")` | Name | Title | ✅ Match |
| `props.get("Type")` | Type | Select | ✅ Match |
| `props.get("Tier")` | Tier | Select | ✅ Match |
| `props.get("Character Logline")` | Character Logline | Text | ✅ Match |
| `props.get("Overview & Key Relationships")` | Overview & Key Relationships | Text | ✅ Match |
| `props.get("Emotion towards CEO & others")` | Emotion towards CEO & others | Text | ✅ Match |
| `props.get("Primary Action")` | Primary Action | Text | ✅ Match |
| `props.get("Owned Elements")` | Owned Elements | Relation → Elements | ✅ Match |
| `props.get("Events")` | Events | Relation → Timeline | ✅ Match |

**Properties Accessed in push_tokens_to_notion.py:**

The push script only READS characters (for character_slug → page_id lookup).
It does NOT create or modify character pages. ✅ Safe

---

### Timeline Database ✅

**Properties Accessed in sync_notion_for_token_gen.py:**

| Script Property Access | Schema Property | Type | Status |
|----------------------|-----------------|------|--------|
| `props.get("Description")` | Description | Title | ✅ Match |
| `props.get("Date")` | Date | Date | ✅ Match |
| `props.get("Notes")` | Notes | Text | ✅ Match |
| `props.get("Characters Involved")` | Characters Involved | Relation → Characters | ✅ Match |
| `props.get("Memory/Evidence")` | Memory/Evidence | Relation → Elements | ✅ Match |

**Properties Accessed in push_tokens_to_notion.py (create_timeline_event):**

| Script Property Access | Schema Property | Type | Status |
|----------------------|-----------------|------|--------|
| `"Description"` (create) | Description | Title | ✅ Match |
| `"Date"` (create) | Date | Date | ✅ Match |
| `"Notes"` (create) | Notes | Text | ✅ Match |
| `"Characters Involved"` (create) | Characters Involved | Relation → Characters | ✅ Match |

---

## SF Field Parsing ✅

**Script Pattern (sync_notion_for_token_gen.py:180-227):**

```python
def parse_sf_fields(description_text):
    """Parse SF_ fields from Description/Text property"""
    patterns = {
        "SF_RFID": r'SF_RFID:\s*\[([^\]]+)\]',
        "SF_ValueRating": r'SF_ValueRating:\s*\[(\d+)\]',
        "SF_MemoryType": r'SF_MemoryType:\s*\[(Personal|Business|Technical)\]',
        "SF_Group": r'SF_Group:\s*\[([^\]]*)\]',
        "SF_Summary": r'SF_Summary:\s*\[([^\]]+)\]'
    }
```

**Actual Notion Format (from existing token docs/TOKEN_GENERATION_WORKFLOW.md):**

```
Display text here

SF_RFID: [token_id]
SF_ValueRating: [1-5]
SF_MemoryType: [Personal|Business|Technical]
SF_Group: [Group Name (xN)]
SF_Summary: [Optional summary]
```

✅ **Perfect Match** - Regex patterns align with documented format

**Scoring Calculation Validation:**

Script scoring constants match backend configuration:
```python
# Script (sync_notion_for_token_gen.py:67-79)
VALUE_RATING_MAP = {1: 100, 2: 500, 3: 1000, 4: 5000, 5: 10000}
TYPE_MULTIPLIERS = {"Personal": 1.0, "Business": 3.0, "Technical": 5.0}

# Backend (backend/src/config/tokenConfig.js)
VALUE_RATING_MAP: {1: 100, 2: 500, 3: 1000, 4: 5000, 5: 10000}
TYPE_MULTIPLIERS: {Personal: 1.0, Business: 3.0, Technical: 5.0}
```

✅ **Exact Match** - Scoring logic consistent with backend

---

## API Version ⚠️ MINOR CONCERN

**Script Uses:**
```python
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",  # Older stable version
    "Content-Type": "application/json"
}
```

**Current Notion API:** `2025-09-03` (newer version with breaking changes)

**Analysis:**
- Script explicitly uses `2022-06-28` (stable, well-documented version)
- This is INTENTIONAL per about-last-night-notion skill guidance:
  > "For compatibility: This skill uses the older 2022-06-28 API version in examples,
  > which is more stable and widely documented."

✅ **Acceptable** - Conscious decision for stability

**Future Consideration:**
When ready to migrate to 2025-09-03:
- `/v1/databases/{id}/query` → `/v1/data_sources/{id}/query`
- Test pagination behavior (may have changed)
- Update both sync and push scripts together

---

## Database IDs ✅

**Hard-Coded in Scripts:**
```python
ELEMENTS_DATABASE_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DATABASE_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
TIMELINE_DATABASE_ID = "1b52f33d-583f-80de-ae5a-d20020c120dd"
```

**Schema Documentation:**
- Elements: `18c2f33d-583f-8020-91bc-d84c7dd94306` ✅
- Characters: `18c2f33d-583f-8060-a6ab-de32ff06bca2` ✅
- Timeline: `1b52f33d-583f-80de-ae5a-d20020c120dd` ✅

✅ **Perfect Match**

---

## Error Handling for Missing Properties ✅

**Script Uses Safe Extractors:**

```python
def safe_extract_text(prop, prop_type="rich_text"):
    """Safely extract text from Notion property"""
    if not prop:
        return ""
    # ... safe extraction with fallback to ""

def safe_extract_select(prop):
    """Safely extract select value"""
    if not prop or not prop.get("select"):
        return ""
    # ...
```

✅ **Good Practice** - Handles missing/null properties gracefully

**However:**
- No logging when properties are unexpectedly missing
- Silent failures could mask schema changes

**Recommendation:**
Add optional verbose logging:
```python
def safe_extract_text(prop, prop_type="rich_text", warn_missing=False, prop_name=""):
    if not prop:
        if warn_missing:
            print(f"⚠ Warning: Property '{prop_name}' is missing or null")
        return ""
    # ...
```

---

## Pagination Handling ✅

**Script Implementation:**
```python
def fetch_database_with_pagination(database_id, filter_obj=None, sorts=None):
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor
        # ... fetch
        all_results.extend(data["results"])
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")
```

✅ **Correct** - Follows Notion pagination best practices

**Tested With:**
- Mock data (test scripts) ✅
- Real Notion API: ⚠️ Received 403 (databases not shared yet)

---

## Relation Handling ✅

**Script correctly handles all relation types:**

**One-to-Many (Characters → Owned Elements):**
```python
owned_element_ids = safe_extract_relation(props.get("Owned Elements"))
# Returns list of page IDs
```

**Many-to-Many (Elements → Timeline):**
```python
timeline_ids = safe_extract_relation(props.get("Timeline Event"))
# Returns list (can be empty, one, or multiple)
```

**Bidirectional Resolution:**
- Script fetches ALL databases upfront
- Builds lookups (character_lookup, element_lookup, timeline_lookup)
- Resolves relations by ID → no orphaned references

✅ **Robust** - Handles all relation patterns correctly

---

## Known Gaps & Recommendations

### 1. No Schema Validation for Multi-Select Values ⚠️

**Issue:** Script accepts any string for Narrative Threads without validating against schema.

**Risk:** Typos create invalid multi-select values that appear in Notion but don't match existing options.

**Fix:**
```python
# In push_tokens_to_notion.py
VALID_NARRATIVE_THREADS = [
    "Funding & Espionage", "Underground Parties", "Memory Drug",
    "Marriage Troubles", "Ephemeral Echo", "Tech Development",
    "Advanced Technology", "Emergent Third Path", "Blackmail",
    "Unsanctioned Research", "Class Conflicts", "Murder Timeline",
    "Investigative Journalism", "The Senate Testimony"
]

def validate_token_metadata(token):
    for thread in token.get("narrative_threads", []):
        if thread not in VALID_NARRATIVE_THREADS:
            raise ValueError(f"Invalid narrative thread: '{thread}'")
```

### 2. No Validation for Basic Type Selection ⚠️

**Issue:** `infer_basic_type()` always returns `"Memory Token Image"` regardless of actual token media.

**Current:**
```python
def infer_basic_type(token):
    return "Memory Token Image"
```

**Better:**
```python
def infer_basic_type(token):
    """Infer Basic Type from token metadata"""
    # Could check for video/audio in display_text or media_type field
    # For now, require explicit user specification
    return token.get("basic_type", "Memory Token Image")
```

**Recommendation:** Add `basic_type` field to token schema in draft.json

### 3. Character Slug Generation Has Edge Cases ⚠️

**Current:**
```python
slug = name.lower().replace(" ", "-").replace(".", "")
```

**Edge Cases:**
- "Dr. Marcus Chen" → "dr-marcus-chen" ✅
- "Victoria Zhao-Smith" → "victoria-zhao-smith" ✅
- "Agent O'Connor" → "agent-oconnor" ⚠️ (apostrophe removed, no hyphen)
- "José García" → "josé-garcía" ⚠️ (accents preserved, may cause lookup issues)

**Recommendation:**
```python
import re
import unicodedata

def generate_slug(name):
    # Normalize unicode (remove accents)
    name = unicodedata.normalize('NFKD', name)
    name = name.encode('ascii', 'ignore').decode('ascii')
    # Lowercase
    name = name.lower()
    # Replace spaces and non-alphanumeric with hyphens
    name = re.sub(r'[^a-z0-9]+', '-', name)
    # Remove leading/trailing hyphens
    name = name.strip('-')
    return name
```

### 4. No Duplicate Page Detection in Push Script ⚠️

**Issue:** Running `push_tokens_to_notion.py` twice creates duplicate Element pages.

**Fix:** Check if token already exists before creating:
```python
def check_token_exists(token_id):
    """Check if token with SF_RFID already exists"""
    result = requests.post(
        f"https://api.notion.com/v1/databases/{ELEMENTS_DATABASE_ID}/query",
        headers=headers,
        json={
            "filter": {
                "property": "Description/Text",
                "rich_text": {"contains": f"SF_RFID: [{token_id}]"}
            }
        }
    )
    return len(result.json().get("results", [])) > 0
```

### 5. Timeline Event Creation Lacks Date Validation ⚠️

**Issue:** Script creates timeline events with optional date field.

**Risk:** Events without dates break chronological sorting.

**Recommendation:** Require date for new timeline events:
```python
if not event_details.get("date"):
    raise ValueError("Timeline events require a date field")
```

---

## Testing Status

### Mock Data Tests ✅
- `test_sync_notion_mock.py` → ✅ Passing
- `test_skill_loading.py` → ✅ Passing
- `test_push_mock.py` → ✅ Passing

### Real Notion API Tests ⚠️
- Attempted: `python3 scripts/sync_notion_for_token_gen.py`
- Result: 403 Forbidden (databases not shared with integration)
- Status: **Pending database access**

**Next Step:** Share the three databases with Notion integration and re-test.

---

## Final Verdict

✅ **APPROVED** - Scripts are fully aligned with Notion schema

**Minor Improvements Recommended:**
1. Add narrative thread validation
2. Improve slug generation for edge cases
3. Add duplicate detection in push script
4. Require date for timeline event creation
5. Add basic type inference or require explicit specification

**Critical for Production:**
- Share databases with Notion integration
- Run full end-to-end test with real API
- Validate created pages in Notion UI

**Estimated Risk:** LOW - All property accesses match schema, safe extractors prevent crashes

---

**Validation Completed:** 2025-11-16
**Reviewed By:** Claude Code
**Schema Version:** 2022-06-28 Notion API
