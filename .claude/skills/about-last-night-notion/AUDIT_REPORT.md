# About Last Night Notion Skill - Audit Report
**Date:** 2025-11-16
**Status:** Issues Identified - Fixes In Progress

## Executive Summary

The `about-last-night-notion` skill has several critical issues that prevent it from being immediately usable:

1. **File reference errors** pointing to non-existent scripts
2. **Misleading security documentation** suggesting a pre-configured token exists
3. **API version confusion** without clear guidance
4. **Missing critical documentation** about SF_ field parsing and sync workflow
5. **Hardcoded paths** in the sync script that won't work for other users

## Detailed Issues

### 1. File Reference Errors (Priority: HIGH)

**Location:** `SKILL.md` lines 102, 380

**Issue:**
References to `scripts/sync_to_tokens.py` but actual file is `scripts/sync_notion_to_tokens.py`

**Impact:**
Users following the skill instructions will encounter broken links.

**Fix:**
Update all references to use correct filename: `scripts/sync_notion_to_tokens.py`

---

### 2. Misleading Token Documentation (Priority: CRITICAL)

**Location:**
- `SKILL.md` lines 36-43
- `SECURITY_NOTICE.md` lines 3-9

**Issue:**
Documentation states "This skill includes a pre-configured integration token" but the actual value is placeholder `YOUR_NOTION_TOKEN_HERE`. This creates false expectations.

**Impact:**
Users will be confused when the token doesn't work. The skill appears broken out-of-the-box.

**Fix:**
- Update SECURITY_NOTICE.md to explain this is a PRIVATE project requiring user's own token
- Update SKILL.md to clearly state: "You MUST set NOTION_TOKEN environment variable"
- Remove misleading language about "pre-configured" tokens
- Explain how to get a token from Notion integrations

---

### 3. API Version Confusion (Priority: MEDIUM)

**Location:** `SKILL.md` lines 61-76

**Issue:**
Mentions Notion API version 2025-09-03 introduced "significant changes" but:
- Doesn't explain these are BREAKING changes
- All examples use old 2022-06-28 pattern
- No clear guidance on which version to use
- Web search confirms 2025-09-03 completely restructured databases → data sources

**Impact:**
Users may attempt to use new API version and encounter breaking changes without understanding why examples don't work.

**Fix:**
- Clearly state 2025-09-03 is a BREAKING CHANGE
- Recommend using 2022-06-28 for stability (what sync script uses)
- Add warning that upgrading requires significant code changes
- Link to official Notion upgrade guide

---

### 4. Missing SF_ Field Documentation (Priority: CRITICAL)

**Location:** Missing from all documentation

**Issue:**
The sync script (`sync_notion_to_tokens.py`) uses a critical pattern NOT documented anywhere in the skill:

**SF_ Field Format in Notion Description/Text:**
```
Display text for scanner (shows on NeurAI display)

SF_RFID: [tokenId]
SF_ValueRating: [1-5]
SF_MemoryType: [Personal|Business|Technical]
SF_Group: [Group Name (xN)]
SF_Summary: [Optional summary]
```

**Parsing Logic:**
1. Extract text BEFORE first "SF_" → display text for NeurAI screens
2. Parse SF_ fields using regex patterns
3. Generate NeurAI BMP if display text exists
4. Map to tokens.json structure

**Impact:**
Users won't know how to structure their Notion data. The skill is incomplete without this.

**Fix:**
Create `references/sync-workflow.md` with complete documentation:
- SF_ field format specification
- Display text extraction pattern
- NeurAI BMP generation process
- Complete tokens.json mapping
- Example Notion entries

---

### 5. Missing NeurAI Display Generation Documentation (Priority: HIGH)

**Location:** Missing from all documentation

**Issue:**
The sync script generates 240x320 NeurAI-styled BMP displays but this isn't documented:
- Red branding with ASCII logo
- Text wrapping and truncation
- Dual deployment (PWA + ESP32)
- Font requirements

**Impact:**
Users won't understand what the sync script produces or why BMPs appear in their assets.

**Fix:**
Document in `references/sync-workflow.md`:
- NeurAI display design specifications
- Font requirements (DejaVu Sans Mono)
- Deployment paths (aln-memory-scanner/assets/images + arduino-cyd-player-scanner/sd-card-deploy/images)

---

### 6. Incomplete tokens.json Schema Documentation (Priority: MEDIUM)

**Location:** `SKILL.md` lines 111-125

**Issue:**
Example tokens.json schema doesn't explain critical patterns:
- **Video tokens**: `image: null`, `processingImage: {path}` (processing screen while video queues)
- **Regular tokens**: `image: {path}`, `processingImage: null`
- **Placeholder fallback**: Uses `assets/images/placeholder.bmp` if no image found

**Impact:**
Users won't understand the video vs regular token distinction.

**Fix:**
Add comprehensive tokens.json schema documentation in `references/sync-workflow.md` with:
- All field descriptions
- Video token special handling
- Placeholder pattern
- Complete example entries (video, audio, image, audio+image types)

---

### 7. Hardcoded Path in Sync Script (Priority: CRITICAL)

**Location:** `scripts/sync_notion_to_tokens.py` line 41

**Issue:**
```python
ECOSYSTEM_ROOT = Path("/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem")
```

This is a hardcoded absolute path specific to one user's machine.

**Impact:**
Script will FAIL for anyone else. Not portable.

**Fix:**
Change to relative path detection:
```python
ECOSYSTEM_ROOT = Path(__file__).parent.parent  # Auto-detect from script location
```

---

### 8. Missing Notion API Best Practices (Priority: LOW)

**Location:** `SKILL.md` line 309

**Issue:**
Best practices mention "Fetch Fresh Schema Information" but don't explain WHY this matters for the About Last Night project specifically:
- Narrative Threads multi-select options change frequently
- Status options may be added during production
- Formula/Rollup properties evolve

**Impact:**
Minor - users might hard-code select options instead of fetching dynamically.

**Fix:**
Add project-specific note about schema evolution during production.

---

## Recommended Fixes Priority Order

1. **CRITICAL** - Fix hardcoded path in sync_notion_to_tokens.py (breaks for all users)
2. **CRITICAL** - Create references/sync-workflow.md with SF_ field documentation
3. **CRITICAL** - Update SECURITY_NOTICE.md to remove "pre-configured token" claims
4. **HIGH** - Fix file reference errors in SKILL.md
5. **HIGH** - Add NeurAI display generation documentation
6. **MEDIUM** - Clarify API version guidance (2022-06-28 vs 2025-09-03)
7. **MEDIUM** - Enhance tokens.json schema documentation
8. **LOW** - Add project-specific best practices notes

## Testing Checklist

After fixes are applied:

- [ ] Verify all file references point to existing files
- [ ] Test sync script with auto-detected paths
- [ ] Confirm SECURITY_NOTICE accurately reflects token requirements
- [ ] Validate SF_ field parsing examples match actual sync script logic
- [ ] Check all code examples use consistent API version (2022-06-28)
- [ ] Ensure references/sync-workflow.md is linked from SKILL.md

## Notes

The skill has good structure and comprehensive schema documentation. The issues are primarily:
1. Incomplete documentation of the actual sync workflow
2. Misleading claims about pre-configured tokens
3. Portability issues in the sync script itself

Once these are fixed, the skill will be production-ready and genuinely useful for About Last Night Notion automation.
