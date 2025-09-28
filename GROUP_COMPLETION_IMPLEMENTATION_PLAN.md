# Group Completion & Bonus System Implementation Plan

## Executive Summary
Implement proper group completion detection and bonus calculation in the backend orchestrator to match the existing logic in the ALNScanner (GM scanner) submodule.

## Current State Analysis

### What Already Exists

#### In ALNScanner (GM Scanner) - FULLY WORKING:
1. **Group Format**: `"SF_Group": "Group Name (xN)"` where N is the multiplier
   - Example: `"Server Logs (x5)"` = 5x multiplier when group is complete
   - Example: `"Marcus' Memories (x1)"` = No bonus (1x multiplier)

2. **Group Completion Detection**:
   ```javascript
   // Check if team has ALL tokens in this group
   const hasAllTokens = groupTokenArray.every(tokenId => teamTokens.has(tokenId));
   ```

3. **Bonus Calculation**:
   - Only groups with multiplier > 1 AND more than 1 token qualify
   - Bonus = `tokenValue * (multiplier - 1)` for each token
   - Applied ONLY when ALL tokens in group are collected

#### In Backend Orchestrator - PARTIALLY WORKING:
1. **Token Service** (`/backend/src/services/tokenService.js`):
   - ✅ `parseGroupMultiplier()` - Extracts multiplier from `"Group (xN)"`
   - ✅ `extractGroupName()` - Gets group name without multiplier
   - ✅ Token loading sets `groupId` on tokens
   - ✅ Token loading extracts `groupMultiplier` during load
   - ❌ But `groupMultiplier` is NOT stored in Token model

2. **Transaction Service** (`/backend/src/services/transactionService.js`):
   - ✅ Has `isGroupComplete()` method
   - ❌ Current implementation is simplified/broken
   - ✅ Has `calculateGroupBonus()` method
   - ❌ Returns fixed multiplier, not actual bonus calculation
   - ✅ Has `updateTeamScore()` that checks for group completion
   - ❌ Doesn't properly calculate bonus amounts

3. **Token Model** (`/backend/src/models/token.js`):
   - ✅ Has `groupId` field
   - ❌ Missing `groupMultiplier` field
   - ✅ Has `isGrouped()` method
   - ❌ No method to get multiplier

## Implementation Requirements

### 1. Token Model Updates
**File**: `/backend/src/models/token.js`

Add `groupMultiplier` field to Token class:
```javascript
class Token {
  constructor(data = {}) {
    this.validate(data);
    Object.assign(this, data);
    // Ensure groupMultiplier defaults to 1 if not provided
    this.groupMultiplier = data.groupMultiplier || 1;
  }

  /**
   * Get group multiplier
   * @returns {number}
   */
  getGroupMultiplier() {
    return this.groupMultiplier || 1;
  }

  toJSON() {
    return {
      // ... existing fields ...
      groupId: this.groupId || null,
      groupMultiplier: this.groupMultiplier || 1,
      // ... rest of fields ...
    };
  }
}
```

### 2. Transaction Service - Group Completion Detection
**File**: `/backend/src/services/transactionService.js`

Replace simplified `isGroupComplete` with proper implementation:
```javascript
isGroupComplete(teamId, groupId) {
  if (!groupId) return false;

  // Get all tokens that belong to this group
  const groupTokens = Array.from(this.tokens.values())
    .filter(t => t.groupId === groupId);

  // Groups need at least 2 tokens to be completable
  if (groupTokens.length <= 1) return false;

  // Get current session to check transactions
  const sessionService = require('./sessionService');
  const session = sessionService.getCurrentSession();
  if (!session || !session.transactions) return false;

  // Get all token IDs this team has successfully scanned
  const teamScannedTokenIds = new Set(
    session.transactions
      .filter(tx =>
        tx.teamId === teamId &&
        tx.status === 'accepted'
      )
      .map(tx => tx.tokenId)
  );

  // Check if team has scanned ALL tokens in the group
  const allScanned = groupTokens.every(token =>
    teamScannedTokenIds.has(token.id)
  );

  return allScanned;
}
```

### 3. Transaction Service - Bonus Calculation
**File**: `/backend/src/services/transactionService.js`

Fix `calculateGroupBonus` to return actual bonus multiplier:
```javascript
calculateGroupBonus(groupId) {
  if (!groupId) return 0;

  // Find any token in this group to get the multiplier
  const groupToken = Array.from(this.tokens.values())
    .find(t => t.groupId === groupId);

  if (!groupToken) return 0;

  const multiplier = groupToken.getGroupMultiplier();

  // Only groups with multiplier > 1 give bonuses
  if (multiplier <= 1) return 0;

  // Return the multiplier for use in score calculation
  return multiplier;
}
```

### 4. Transaction Service - Score Update Logic
**File**: `/backend/src/services/transactionService.js`

Update `updateTeamScore` to properly apply bonuses:
```javascript
updateTeamScore(teamId, token) {
  let teamScore = this.teamScores.get(teamId);

  if (!teamScore) {
    teamScore = TeamScore.createInitial(teamId);
    this.teamScores.set(teamId, teamScore);

    // Also add to session if it doesn't have this team yet
    const sessionService = require('./sessionService');
    const session = sessionService.getCurrentSession();
    if (session && !session.scores.find(s => s.teamId === teamId)) {
      session.scores.push(teamScore.toJSON());
      sessionService.emit('team:created', { teamId });
    }
  }

  // Add base points
  teamScore.addPoints(token.value);
  teamScore.incrementTokensScanned();

  // Check for group completion bonus
  if (token.isGrouped()) {
    const wasCompleted = teamScore.hasCompletedGroup(token.groupId);

    if (!wasCompleted && this.isGroupComplete(teamId, token.groupId)) {
      teamScore.completeGroup(token.groupId);

      // Calculate total bonus for the entire group
      const multiplier = this.calculateGroupBonus(token.groupId);
      if (multiplier > 1) {
        // Get all tokens in this group
        const groupTokens = Array.from(this.tokens.values())
          .filter(t => t.groupId === token.groupId);

        // Calculate total bonus: (multiplier - 1) × sum of all token values
        let totalGroupBonus = 0;
        for (const groupToken of groupTokens) {
          totalGroupBonus += groupToken.value * (multiplier - 1);
        }

        teamScore.addBonus(totalGroupBonus);

        logger.info('Group completed', {
          teamId,
          groupId: token.groupId,
          multiplier,
          totalBonus: totalGroupBonus,
        });

        this.emit('group:completed', {
          teamId,
          groupId: token.groupId,
          bonus: totalGroupBonus,
          multiplier
        });
      }
    }
  }

  this.emit('score:updated', teamScore);
}
```

### 5. Team Score Model Update
**File**: `/backend/src/models/teamScore.js`

Ensure TeamScore properly tracks completed groups:
```javascript
class TeamScore {
  // ... existing code ...

  /**
   * Add bonus points
   * @param {number} bonus - Bonus points to add
   */
  addBonus(bonus) {
    this.bonusPoints = (this.bonusPoints || 0) + bonus;
    this.currentScore = this.currentScore + bonus;
    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Mark group as completed
   * @param {string} groupId - Group identifier
   */
  completeGroup(groupId) {
    if (!this.completedGroups) {
      this.completedGroups = [];
    }
    if (!this.completedGroups.includes(groupId)) {
      this.completedGroups.push(groupId);
    }
  }

  /**
   * Check if group was already completed
   * @param {string} groupId - Group identifier
   * @returns {boolean}
   */
  hasCompletedGroup(groupId) {
    return this.completedGroups && this.completedGroups.includes(groupId);
  }
}
```

## Testing Strategy

### 1. Unit Tests
- Test `parseGroupMultiplier()` with various formats
- Test `isGroupComplete()` with different transaction states
- Test bonus calculation with different multipliers
- Test score updates with group completion

### 2. Integration Tests
Create test scenario with:
- Group A (x3): 3 tokens
- Group B (x5): 2 tokens
- Group C (x1): 2 tokens (no bonus)
- Ungrouped tokens: 3 tokens

Test cases:
1. Team scans 2/3 tokens from Group A → No bonus
2. Team scans 3/3 tokens from Group A → 3x bonus applied
3. Team scans duplicate token → No additional points or bonus
4. Team scans all of Group C → No bonus (1x multiplier)

### 3. Manual Testing with GM Scanner
1. Start orchestrator
2. Connect GM scanner
3. Create session with no pre-assigned teams
4. Scan tokens from a group one by one
5. Verify bonus is applied when group is completed
6. Check admin dashboard shows correct scores

## Migration Considerations

### Existing Session Data
- Current sessions may have incomplete score data
- Need to handle sessions without `bonusPoints` field
- Completed groups array may not exist

### Backward Compatibility
- Token model changes should have defaults
- Score calculations should handle missing multipliers (default to 1)
- Group completion should handle missing groupId gracefully

## Implementation Order

1. **Phase 1**: Token Model Updates
   - Add groupMultiplier field
   - Update Token constructor and methods
   - Test token loading still works

2. **Phase 2**: Fix Group Detection
   - Implement proper isGroupComplete
   - Add session transaction checks
   - Test with mock data

3. **Phase 3**: Fix Bonus Calculation
   - Update calculateGroupBonus
   - Fix updateTeamScore logic
   - Ensure bonuses are added correctly

4. **Phase 4**: Testing & Validation
   - Run unit tests
   - Manual testing with GM scanner
   - Verify admin dashboard displays correctly

## Success Criteria

✅ Groups are properly detected when ALL tokens are scanned
✅ Bonuses are calculated as (multiplier - 1) × token value
✅ Bonuses are applied only once per group per team
✅ Admin dashboard shows correct score breakdowns
✅ GM scanner and orchestrator show matching scores
✅ New teams are created dynamically on first scan
✅ Sessions can be created with no pre-assigned teams

## Risk Mitigation

1. **Data Loss**: Backup session data before deployment
2. **Score Miscalculation**: Add logging for all score changes
3. **Performance**: Use Set for teamScannedTokenIds lookup
4. **Race Conditions**: Ensure atomic score updates

## Notes

- The ALNScanner already has this working perfectly - we're essentially porting that logic
- Group names are case-insensitive and normalized (spaces, quotes)
- Only multi-token groups with multiplier > 1 qualify for bonuses
- Bonus is applied to ALL tokens in the group, not just the last one scanned