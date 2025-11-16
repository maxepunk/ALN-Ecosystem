# Token Generator Skill Validation Report

**Date:** 2025-11-16
**Skill Path:** `.claude/skills/token-generator/skill.md`
**Validated Against:** skill-creator best practices

---

## Critical Issues ❌

### 1. Missing YAML Frontmatter (BLOCKER)

**Issue:** The skill.md file has NO YAML frontmatter metadata.

**Current:**
```markdown
# Token Generator Skill

**CRITICAL REQUIREMENT:** This skill facilitates...
```

**Required:**
```markdown
---
name: token-generator
description: >
  Use this skill when creating new memory tokens for the About Last Night...
  game. Provides interactive, conversational workflow for crafting tokens with
  narrative coherence, character balance, and gameplay tension between detective
  mode and blackmarket scoring. Guides through timeline gap filling, duplicate
  detection, and balance analysis. Requires pre-synced knowledge graph from
  sync_notion_for_token_gen.py.
---

# Token Generator Skill
```

**Impact:** Without frontmatter, Claude cannot properly discover or trigger this skill.

**Severity:** BLOCKER - Skill will not function

**Fix Required:** Add YAML frontmatter with `name` and `description` fields.

---

### 2. Incorrect File Naming (BLOCKER)

**Issue:** File is named `skill.md` but should be named `SKILL.md` (uppercase).

**Expected:** `.claude/skills/token-generator/SKILL.md`
**Actual:** `.claude/skills/token-generator/skill.md`

**Impact:** Skill loader expects `SKILL.md` (case-sensitive).

**Severity:** BLOCKER - Skill cannot be loaded

**Fix Required:** Rename `skill.md` → `SKILL.md`

---

### 3. Writing Style Inconsistency (MAJOR)

**Issue:** Skill uses second-person ("You MUST", "you should") instead of imperative/infinitive form.

**Current Examples:**
- Line 3: "You MUST engage in back-and-forth dialogue"
- Line 575: "You should immediately"
- Line 590: "NEVER start generating tokens"

**Correct Style:**
- "Engage in back-and-forth dialogue" (imperative)
- "Immediately load index.json" (imperative)
- "Never start generating tokens without user guidance" (infinitive)

**From skill-creator:**
> Write the entire skill using **imperative/infinitive form** (verb-first instructions),
> not second person. Use objective, instructional language (e.g., "To accomplish X,
> do Y" rather than "You should do X").

**Impact:** Inconsistent with skill best practices, harder for AI to parse as instructions.

**Severity:** MAJOR - Functional but not following conventions

**Fix Required:** Convert all "you" references to imperative form.

---

## Structural Issues ⚠️

### 4. Missing Bundled Resources Structure

**Issue:** Skill has no `scripts/`, `references/`, or `assets/` directories.

**Expected Structure:**
```
.claude/skills/token-generator/
├── SKILL.md (required)
├── scripts/ (optional, but recommended)
│   └── validate_draft.py (suggested)
├── references/ (optional, but recommended)
│   ├── scoring-formulas.md
│   ├── notion-schema.md
│   └── example-tokens.json
└── assets/ (optional)
    └── session-template.json
```

**Current Structure:**
```
.claude/skills/token-generator/
└── skill.md (only file)
```

**Recommendations:**

1. **Move detailed content to references/**
   - Lines 249-270 (Scoring System Reference) → `references/scoring-formulas.md`
   - Lines 210-290 (Token Field Specifications) → `references/token-schema.md`
   - Lines 292-489 (Conversational Flow Example) → `references/example-session.md`

2. **Add validation script:**
   - `scripts/validate_draft.py` - Validate draft.json schema before push
   - Benefits: Deterministic validation, token-efficient, reusable

3. **Add session template:**
   - `assets/session-template.json` - Empty session structure

**Benefits of Restructuring:**
- SKILL.md becomes leaner (currently 591 lines → target ~300 lines)
- Detailed references loaded only when needed
- Progressive disclosure (metadata → SKILL.md → references as needed)

**Severity:** MODERATE - Skill works but violates progressive disclosure principle

---

### 5. Knowledge Graph Location Hard-Coded

**Issue:** Skill hard-codes `.claude/token-gen-cache/` path.

**Current:**
```markdown
All data is pre-synced to: `.claude/token-gen-cache/`
```

**Problem:** Path is relative to repository root, not skill directory.

**Recommendation:**
- Document that path is relative to workspace root
- OR: Add path configuration in frontmatter metadata

**Severity:** MINOR - Works but could be clearer

---

## Content Quality ✅ STRENGTHS

### Excellent Conversational Design
- **CRITICAL REQUIREMENT** prominently placed
- Clear 5-stage interactive process
- 200+ line example conversation showing proper flow
- Explicit approval requirements

### Comprehensive Workflow Coverage
- Multiple navigation modes (timeline gaps, character balance, threads)
- Duplicate detection algorithm
- Balance considerations (detective mode tension)
- Session state management

### Error Handling
- Clear error templates for missing files
- Duplicate detection warnings
- Corrupted draft handling

---

## Validation Checklist

Based on skill-creator validation criteria:

- [ ] ❌ **YAML frontmatter present** (MISSING)
- [ ] ❌ **Correct filename (SKILL.md)** (Currently: skill.md)
- [ ] ⚠️ **Imperative/infinitive writing style** (Uses "you" throughout)
- [ ] ⚠️ **Progressive disclosure (references/ for details)** (All content in one file)
- [ ] ⚠️ **Bundled resources structure** (No scripts/references/assets)
- [x] ✅ **Clear purpose statement**
- [x] ✅ **When to use guidance**
- [x] ✅ **How to use instructions**
- [ ] ⚠️ **Resource references** (No bundled resources to reference)

**Validation Score: 3/9 Passing**

---

## Required Fixes Before Merge

### Priority 1 (BLOCKERS)

1. **Add YAML Frontmatter:**
```yaml
---
name: token-generator
description: >
  Use PROACTIVELY when creating new memory tokens for the About Last Night...
  immersive game. Provides interactive, conversational workflow for token
  creation ensuring narrative coherence, character POV diversity, no duplicates,
  and balanced detective/blackmarket incentives. Guides through timeline gap
  filling, duplicate detection, balance analysis, and session management.
  Requires pre-synced knowledge graph (.claude/token-gen-cache/) from
  sync_notion_for_token_gen.py. Never auto-generates tokens—always conversational.
---
```

2. **Rename file:** `skill.md` → `SKILL.md`

3. **Convert to imperative form:**
   - Replace "You MUST" → "Must"
   - Replace "you should" → "Should" or restructure to imperative
   - Replace "NEVER start" → "Never start"

### Priority 2 (RECOMMENDED)

4. **Extract to references/:**
   - Create `references/scoring-formulas.md` (scoring system details)
   - Create `references/token-schema.md` (field specifications)
   - Create `references/example-session.md` (conversational flow example)
   - Update SKILL.md to reference these: "See references/scoring-formulas.md"

5. **Add validation script:**
   - Create `scripts/validate_draft.py` for draft.json schema validation
   - Reference in SKILL.md error handling section

6. **Add session template:**
   - Create `assets/session-template.json` with empty session structure

### Priority 3 (POLISH)

7. **Run packaging validation:**
```bash
scripts/package_skill.py .claude/skills/token-generator/
```

8. **Test skill invocation:**
```bash
# Verify skill triggers correctly
/token-generator
```

---

## Estimated Effort

- **Priority 1 fixes:** ~30 minutes
- **Priority 2 restructuring:** ~1-2 hours
- **Priority 3 validation:** ~15 minutes

**Total:** 2-3 hours for complete compliance

---

## Recommendations Summary

**Before Merge:**
1. Add YAML frontmatter ❌ BLOCKER
2. Rename skill.md → SKILL.md ❌ BLOCKER
3. Convert to imperative form ⚠️ MAJOR

**Follow-Up PR:**
4. Extract content to references/ ⚠️ MODERATE
5. Add validation script ⚠️ MODERATE
6. Add session template 💡 NICE-TO-HAVE

---

**Validation Status:** ❌ BLOCKED - Cannot merge without Priority 1 fixes
**Skill Quality (post-fix):** ✅ HIGH - Excellent content, needs structural compliance
