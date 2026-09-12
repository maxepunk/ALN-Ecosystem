# MemoryType Expansion & Empty Field Handling

**Date:** 2026-03-05
**Status:** Design

## Summary

Two changes to game business logic:

1. Add MemoryType `Mention` (3x multiplier) and `Party` (5x multiplier)
2. Tokens with empty/missing `SF_MemoryType` or `SF_ValueRating` should score $0 (not be rejected, and not silently default to non-zero values)

## Current Behavior (Problems)

### Problem 1: Adding a new MemoryType breaks the backend

The `Token` model constructor (`backend/src/models/token.js:14`) validates every token against `tokenSchema` at startup. The schema hardcodes a Joi enum:

```javascript
// validators.js:19
memoryType: Joi.string().valid('Technical', 'Business', 'Personal').required()
```

Any token with a type not in this list **crashes the backend on boot**. This is brittle — the scoring system already handles unknown types gracefully (0x multiplier), making this enum redundant gatekeeping.

### Problem 2: Empty fields silently get non-zero scores

When `SF_MemoryType` is empty, `tokenService.js:118` defaults it to `'Personal'` before validation sees it. This means:
- Empty type → scored as Personal (1x) instead of $0
- The data quality issue is hidden from operators

When `SF_ValueRating` is empty, `tokenService.js:53` defaults to rating 1 ($10k base) instead of $0.

### Problem 3: Backend config has unnecessary complexity

`backend/src/config/index.js` has two issues:
- **Hardcoded fallback** (lines 19-25): If `scoring-config.json` can't be loaded, the system silently uses hardcoded defaults. This masks deployment errors and requires maintaining values in two places.
- **Manual per-type mapping** (lines 78-83): Each type is manually mapped to a lowercase key. Every new type requires adding another line here.

### Problem 4: UI shows wrong multiplier for unknown types

`uiManager.js:663` uses `|| 1` fallback for multiplier display, showing "1x" for unknown types instead of "0x".

## Design

### Layer 1: Scoring Config (single source of truth)

**File:** `ALN-TokenData/scoring-config.json`

Add new types:
```json
{
  "typeMultipliers": {
    "Personal": 1,
    "Business": 3,
    "Technical": 5,
    "Mention": 3,
    "Party": 5,
    "UNKNOWN": 0
  }
}
```

### Layer 2: Backend Config Loading (eliminate tech debt)

**File:** `backend/src/config/index.js`

1. **Remove hardcoded fallback** — if `scoring-config.json` is missing, throw. A missing config file is a broken deployment.

2. **Dynamic type mapping** — replace manual per-type listing with:
```javascript
typeMultipliers: Object.fromEntries(
  Object.entries(sharedScoringConfig.typeMultipliers)
    .map(([k, v]) => [k.toLowerCase(), v])
),
```

This means new types added to `scoring-config.json` are automatically available — no code change needed.

### Layer 3: Token Loading (fix silent defaults)

**File:** `backend/src/services/tokenService.js`

| Line | Current | New | Effect |
|------|---------|-----|--------|
| 53 | `\|\| config.game.valueRatingMap[1]` | `\|\| 0` | Missing rating → $0 base |
| 56 | `(type \|\| 'personal')` | `(type \|\| 'unknown')` | Missing type → 0x multiplier |
| 118 | `\|\| 'Personal'` | `\|\| 'UNKNOWN'` | Missing type stored as UNKNOWN |

### Layer 4: Validation Schema (remove enum restriction)

**File:** `backend/src/utils/validators.js`

Change `tokenSchema.memoryType` from:
```javascript
memoryType: Joi.string().valid('Technical', 'Business', 'Personal').required()
```
To:
```javascript
memoryType: Joi.string().required()
```

The scoring system already handles unknown types (0x multiplier). Enum validation is redundant — it only adds maintenance burden and breaks on new types.

**File:** `backend/contracts/openapi.yaml`

- Remove `SF_MemoryType` enum restriction (line 1046)
- Remove `SF_MemoryType` and `SF_ValueRating` from the `required` list (lines 1008-1011) — tokens with empty fields should be loadable

**File:** `backend/contracts/asyncapi.yaml`

- Update description to include Mention/Party

### Layer 5: UI Display

**File:** `ALNScanner/src/ui/uiManager.js:663`

Change `|| 1` to `?? 0` for accurate multiplier display.

**File:** `ALNScanner/src/styles/screens/admin.css`

Add CSS for new types:
```css
.token-card .token-type.type-mention { background: #dcfce7; color: #166534; }
.token-card .token-type.type-party { background: #f3e8ff; color: #6b21a8; }
```

(Mention = green like Business currently is. Business gets a new distinct color to avoid collision. Party = purple.)

**Note:** Business currently uses `background: #dcfce7; color: #166534` (green). Since Mention should be green, we should give Business a different color. Options:
- Business → emerald/teal to differentiate from Mention's green
- Or keep Business green and give Mention a different shade

Decision: Give Mention its own green shade and leave Business as-is. Use a lime/bright green for Mention:
```css
.token-card .token-type.type-mention { background: #d9f99d; color: #365314; }
```

### Layer 6: Dead Code Cleanup

**File:** `backend/src/services/tokenService.js`

Remove `getTestTokens()` (lines 142-150) — dead code with invalid types (`'visual'`, `'audio'`, `'mixed'`), only referenced by its own test.

**File:** `backend/tests/unit/services/tokenService.test.js`

Remove corresponding `getTestTokens` test block.

### Layer 7: Tests

| File | Change |
|------|--------|
| `backend/tests/unit/services/scoring-config.test.js` | Add Mention/Party multiplier assertions |
| `ALNScanner/tests/unit/core/scoring-config.test.js` | Add Mention/Party multiplier assertions |
| `backend/tests/unit/services/tokenService.test.js` | Update tests expecting Personal default → UNKNOWN; add empty type/rating → $0 tests; remove getTestTokens tests |
| `config-tool/tests/configManager.test.js` | Add Mention/Party to mock scoring config |

### Layer 8: Documentation

| File | Change |
|------|--------|
| `docs/SCORING_LOGIC.md` | Add Mention/Party to multiplier table, document empty-field → $0 behavior |
| `CLAUDE.md` | Update TYPE_MULTIPLIERS, SF_MemoryType enum references |
| `ALNScanner/CLAUDE.md` | Update "Valid Memory Types" section |
| `ALN-TokenData/CLAUDE.md` | Update token schema SF_MemoryType values |
| `backend/contracts/README.md` | Update if it references type enum |

### Layer 9: Python Scripts (nice-to-have)

| File | Change |
|------|--------|
| `aln-memory-scanner/create_placeholders.py` | Add Mention/Party color entries |
| `aln-memory-scanner/generate-qr.py` | Add Mention/Party color entries |

## Files That Need NO Changes

These already handle new types correctly:

- `ALNScanner/src/core/scoring.js` — loads config dynamically, uses `??` fallback to UNKNOWN
- `ALNScanner/src/core/storage/LocalStorage.js` — delegates to scoring.js
- `ALNScanner/src/app/app.js:725` — already defaults to 'UNKNOWN'
- `backend/src/websocket/broadcasts.js` — already uses `|| 'UNKNOWN'`
- `backend/src/websocket/syncHelpers.js` — already uses `|| 'UNKNOWN'` and `|| 0`
- `config-tool/public/js/sections/economy.js` — renders dynamically from config
- `config-tool/public/js/components/tokenBrowser.js` — renders dynamically from data
- `backend/src/services/cueEngineService.js` — string passthrough, no enum
- Player scanner / ESP32 — don't score tokens

## Scoring Formula (unchanged)

```
tokenScore = baseValues[SF_ValueRating] x typeMultipliers[SF_MemoryType]
```

Updated multiplier table:

| Type | Multiplier |
|------|-----------|
| Personal | 1x |
| Mention | 3x |
| Business | 3x |
| Party | 5x |
| Technical | 5x |
| UNKNOWN / empty | 0x |

Empty `SF_ValueRating` → base value $0 (instead of defaulting to rating 1).

## Risk Assessment

**Low risk:** Scoring config, CSS, documentation, Python scripts — additive changes only.

**Medium risk:** Removing `tokenSchema` enum — but the scoring system already handles unknown types, and the enum only existed as a startup-time crash hazard.

**Medium risk:** Changing empty-field defaults from Personal/$10k to UNKNOWN/$0 — any existing tokens in `tokens.json` with empty fields will change score. Should verify no production tokens rely on the silent default behavior.

**Low risk:** Removing config fallback — only breaks if scoring-config.json is genuinely missing (deployment error that should be caught).
