# ALN Scoring Logic - Single Source of Truth

Last verified: 2025-12-16

## Overview

This document defines the scoring system for ALN (About Last Night) Black Market mode. This is the **authoritative source** - all implementations must match these values.

## Base Values (SF_ValueRating)

| Rating | Value |
|--------|-------|
| 1 | $10,000 |
| 2 | $25,000 |
| 3 | $50,000 |
| 4 | $75,000 |
| 5 | $150,000 |

## Type Multipliers (SF_MemoryType)

| Type | Multiplier |
|------|------------|
| Personal | 1x |
| Business | 3x |
| Technical | 5x |
| UNKNOWN | 0x (no points) |

## Token Score Formula

```
tokenScore = BASE_VALUES[valueRating] × TYPE_MULTIPLIERS[memoryType]
```

**Examples:**
- 1-star Personal: $10,000 × 1 = $10,000
- 3-star Business: $50,000 × 3 = $150,000
- 5-star Technical: $150,000 × 5 = $750,000

## Group Completion Bonus

When a team collects ALL tokens in a group, they receive a bonus multiplier.

**Requirements:**
- Group must have 2+ tokens
- Group multiplier must be > 1x
- Team must collect ALL tokens in the group

**Formula:**
```
bonus = (groupMultiplier - 1) × totalGroupBaseScore
```

**Example: "Server Logs (x5)" group**
- Group contains 3 tokens worth $15,000 base
- Team collects all 3 tokens
- Bonus = (5 - 1) × $15,000 = $60,000
- Total group value = $15,000 + $60,000 = $75,000

## Implementation Locations

| Component | File | Lines | Notes |
|-----------|------|-------|-------|
| Backend Config | `backend/src/config/index.js` | 69-83 | Base values and type multipliers |
| Backend Group Logic | `backend/src/services/transactionService.js` | 330-387 | Group completion and bonus calculation |
| GM Scanner Config | `ALNScanner/src/core/scoring.js` | 15-29 | SCORING_CONFIG constant |
| GM Scanner Group Logic | `ALNScanner/src/core/dataManager.js` | 418-471 | calculateTeamScoreWithBonuses() |

## CRITICAL: Parity Warning

The scoring logic is implemented in TWO places with a subtle timing difference:

**Networked Mode (Backend)**
- Backend calculates score during scan processing
- Group completion check **includes the current token being scanned**
- This is the authoritative calculation

**Standalone Mode (GM Scanner)**
- GM Scanner calculates locally when offline
- Group completion check runs **after transaction is added**
- May have subtle timing differences in edge cases

**Maintenance Rule:**
When updating scoring logic, you MUST:
1. Update BOTH implementation files
2. Verify values match exactly
3. Test group completion behavior in both modes
4. Document any intentional differences

## tokens.json SF_Group Format

Groups are specified in `tokens.json` with the format:
```
"SF_Group": "Group Name (xN)"
```

Where `N` is the multiplier. Examples:
- `"Server Logs (x5)"` - 5x multiplier group
- `"Email Archives (x3)"` - 3x multiplier group
- `""` - No group (standalone token)

## Detective Mode Note

Detective mode uses star ratings (1-5) for display but does NOT use the Black Market scoring formulas. Detective mode scoring is a simple cumulative count, not currency-based.
