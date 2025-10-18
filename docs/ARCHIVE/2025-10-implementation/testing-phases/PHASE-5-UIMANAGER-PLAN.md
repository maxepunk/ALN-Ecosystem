# Phase 5 UIManager Testing - Step-by-Step Implementation Plan

**Created:** 2025-10-06
**Status:** 🔄 IN PROGRESS
**Objective:** Achieve comprehensive behavioral test coverage for UIManager (entire user interface)

---

## Current State Analysis

**UIManager Implementation:** 613 lines
**Current Test Coverage:** ~40% of functionality
**Behavioral Tests:** ~60% of existing tests (others are smoke tests)
**Effective Coverage:** ~24% of actual behavior tested properly

**Broken Tests:** 11 (8 smoke tests to rewrite, 3 good tests to fix)

**Untested Code:** 349 lines (58% of module) - all rendering functions

---

## Step-by-Step Implementation Plan

### STEP 1: Quick Fix - Team Display Tests (5 minutes)
**Goal:** Get 3 good existing tests passing

**Action:**
```javascript
// Add to Team Display describe block beforeEach:
beforeEach(() => {
  const teamDisplay = { textContent: '' };
  mockElements['teamDisplay'] = teamDisplay;
  UIManager.init();
});
```

**Expected Outcome:** 3 tests pass, 8 failures remain (all smoke tests)

---

### STEP 2: Rewrite Error Display Tests (30 minutes)
**Goal:** Replace 8 smoke tests with proper behavioral tests

**Current Problem:**
```javascript
// BAD - Smoke test
expect(mockDocument.createElement).toHaveBeenCalledWith('div');
```

**New Behavioral Tests:**

#### 2.1: Error Display DOM Output Tests
```javascript
it('should create error div with correct class and message', () => {
  UIManager.showError('Authentication failed');

  // Get the actual created error div
  const errorDiv = mockDocument.createElement.mock.results
    .find(r => r.value.tagName === 'div')?.value;

  // BEHAVIORAL: Verify actual properties
  expect(errorDiv.className).toBe('error-message');
  expect(errorDiv.textContent).toBe('Authentication failed');
});

it('should append error to container', () => {
  const containerAppendSpy = jest.spyOn(UIManager.errorContainer, 'appendChild');

  UIManager.showError('Test error');

  // BEHAVIORAL: Verify correct element appended
  expect(containerAppendSpy).toHaveBeenCalledTimes(1);
  const appendedElement = containerAppendSpy.mock.calls[0][0];
  expect(appendedElement.textContent).toBe('Test error');
});
```

#### 2.2: Toast Notification Tests
```javascript
it('should create toast with correct type classes', () => {
  const types = ['info', 'success', 'warning', 'error'];

  types.forEach(type => {
    UIManager.showToast(`Test ${type}`, type);

    const toast = mockDocument.createElement.mock.results
      .filter(r => r.value.className?.includes('toast'))
      .pop()?.value;

    expect(toast.className).toBe(`toast toast-${type}`);
    expect(toast.textContent).toBe(`Test ${type}`);
  });
});
```

**Expected Outcome:** All 11 error/toast tests passing with behavioral verification

---

### STEP 3: Add renderScoreboard() Tests (45 minutes)
**Goal:** Test team leaderboard rendering (36 lines, lines 218-253)

**Test Cases:**

#### 3.1: Empty State
```javascript
it('should display empty state when no teams', () => {
  global.DataManager.getTeamScores.mockReturnValue([]);

  UIManager.renderScoreboard();

  const container = mockElements['scoreboardContainer'];
  expect(container.innerHTML).toContain('No Teams Yet');
  expect(container.innerHTML).toContain('Teams will appear here after scanning');
});
```

#### 3.2: Team Ranking with Medals
```javascript
it('should display top 3 teams with medal emojis', () => {
  const teams = [
    { teamId: '001', score: 15000, tokenCount: 8, isFromBackend: false },
    { teamId: '002', score: 12000, tokenCount: 6, isFromBackend: false },
    { teamId: '003', score: 8000, tokenCount: 4, isFromBackend: false }
  ];
  global.DataManager.getTeamScores.mockReturnValue(teams);

  UIManager.renderScoreboard();

  const html = mockElements['scoreboardContainer'].innerHTML;
  expect(html).toContain('🥇'); // Rank 1
  expect(html).toContain('🥈'); // Rank 2
  expect(html).toContain('🥉'); // Rank 3
});
```

#### 3.3: Score Formatting
```javascript
it('should format scores with locale separators', () => {
  const teams = [
    { teamId: '001', score: 15000, tokenCount: 8, isFromBackend: false }
  ];
  global.DataManager.getTeamScores.mockReturnValue(teams);

  UIManager.renderScoreboard();

  const html = mockElements['scoreboardContainer'].innerHTML;
  expect(html).toContain('$15,000'); // NOT $15000
});
```

#### 3.4: Backend vs Local Indicator
```javascript
it('should show backend indicator when scores from orchestrator', () => {
  const teams = [
    { teamId: '001', score: 15000, tokenCount: 8, isFromBackend: true }
  ];
  global.DataManager.getTeamScores.mockReturnValue(teams);

  UIManager.renderScoreboard();

  const html = mockElements['scoreboardContainer'].innerHTML;
  expect(html).toContain('Live from Orchestrator');
  expect(html).toContain('🔗');
});

it('should show local indicator when scores calculated locally', () => {
  const teams = [
    { teamId: '001', score: 15000, tokenCount: 8, isFromBackend: false }
  ];
  global.DataManager.getTeamScores.mockReturnValue(teams);

  UIManager.renderScoreboard();

  const html = mockElements['scoreboardContainer'].innerHTML;
  expect(html).toContain('Local Calculation');
  expect(html).toContain('📱');
});
```

#### 3.5: Click Handlers
```javascript
it('should include onclick handlers for team details', () => {
  const teams = [
    { teamId: '001', score: 15000, tokenCount: 8, isFromBackend: false }
  ];
  global.DataManager.getTeamScores.mockReturnValue(teams);

  UIManager.renderScoreboard();

  const html = mockElements['scoreboardContainer'].innerHTML;
  expect(html).toContain(`onclick="App.showTeamDetails('001')`);
});
```

**Expected Outcome:** 6 renderScoreboard tests, all passing

---

### STEP 4: Add renderTeamDetails() Tests (60 minutes)
**Goal:** Test complex team detail rendering (106 lines, lines 260-365)

**Test Cases:**

#### 4.1: Empty State
```javascript
it('should display empty state when team has no tokens', () => {
  global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
    hasCompletedGroups: false,
    hasIncompleteGroups: false,
    hasUngroupedTokens: false,
    hasUnknownTokens: false,
    completedGroups: [],
    incompleteGroups: [],
    ungroupedTokens: [],
    unknownTokens: []
  });

  UIManager.renderTeamDetails('001', []);

  const html = mockElements['teamDetailsContainer'].innerHTML;
  expect(html).toContain('No Tokens');
  expect(html).toContain("This team hasn't scanned any tokens yet");
});
```

#### 4.2: Completed Groups Section
```javascript
it('should render completed groups with bonus badges', () => {
  const mockData = {
    hasCompletedGroups: true,
    completedGroups: [{
      displayName: 'MARCUS_SUCKS',
      bonusValue: 5000,
      multiplier: 2,
      tokens: [
        { rfid: 'rat001', memoryType: 'Technical', valueRating: 3, group: 'MARCUS_SUCKS (x2)' }
      ]
    }],
    hasIncompleteGroups: false,
    hasUngroupedTokens: false,
    hasUnknownTokens: false,
    incompleteGroups: [],
    ungroupedTokens: [],
    unknownTokens: []
  };

  global.DataManager.getEnhancedTeamTransactions.mockReturnValue(mockData);

  UIManager.renderTeamDetails('001', [{}]);

  const html = mockElements['teamDetailsContainer'].innerHTML;
  expect(html).toContain('✅ Completed Groups');
  expect(html).toContain('🏆'); // Completion badge
  expect(html).toContain('MARCUS_SUCKS');
  expect(html).toContain('COMPLETE');
  expect(html).toContain('+$5,000 bonus');
});
```

#### 4.3: In-Progress Groups Section
```javascript
it('should render in-progress groups with progress bars', () => {
  const mockData = {
    hasCompletedGroups: false,
    hasIncompleteGroups: true,
    incompleteGroups: [{
      displayName: 'SERVER_LOGS',
      progress: '2/5',
      percentage: 40,
      tokens: [
        { rfid: 'srv001', memoryType: 'Technical', valueRating: 2 }
      ]
    }],
    hasUngroupedTokens: false,
    hasUnknownTokens: false,
    completedGroups: [],
    ungroupedTokens: [],
    unknownTokens: []
  };

  global.DataManager.getEnhancedTeamTransactions.mockReturnValue(mockData);

  UIManager.renderTeamDetails('001', [{}]);

  const html = mockElements['teamDetailsContainer'].innerHTML;
  expect(html).toContain('🔶 In Progress Groups');
  expect(html).toContain('⏳'); // Progress badge
  expect(html).toContain('SERVER_LOGS');
  expect(html).toContain('2/5');
  expect(html).toContain('width: 40%'); // Progress bar
});
```

#### 4.4: Score Breakdown Display
```javascript
it('should display score breakdown with base, bonus, and total', () => {
  const scoreData = {
    baseScore: 11000,
    bonusScore: 4500,
    totalScore: 15500
  };

  global.DataManager.calculateTeamScoreWithBonuses.mockReturnValue(scoreData);
  global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
    hasCompletedGroups: false,
    hasIncompleteGroups: false,
    hasUngroupedTokens: false,
    hasUnknownTokens: false,
    completedGroups: [],
    incompleteGroups: [],
    ungroupedTokens: [],
    unknownTokens: []
  });

  UIManager.renderTeamDetails('001', []);

  // Check DOM elements updated
  expect(mockElements['teamBaseScore'].textContent).toBe('$11,000');
  expect(mockElements['teamBonusScore'].textContent).toBe('$4,500');
  expect(mockElements['teamTotalScore'].textContent).toBe('$15,500');
});
```

#### 4.5: Header Updates
```javascript
it('should update header with team ID and token count', () => {
  const transactions = [{ id: '1' }, { id: '2' }, { id: '3' }];

  global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
    hasCompletedGroups: false,
    hasIncompleteGroups: false,
    hasUngroupedTokens: false,
    hasUnknownTokens: false,
    completedGroups: [],
    incompleteGroups: [],
    ungroupedTokens: [],
    unknownTokens: []
  });

  UIManager.renderTeamDetails('042', transactions);

  expect(mockElements['teamDetailsTitle'].textContent).toBe('Team 042');
  expect(mockElements['teamDetailsSummary'].textContent).toBe('3 tokens collected');
});
```

**Expected Outcome:** 5+ renderTeamDetails tests, all passing

---

### STEP 5: Add renderTokenCard() Tests (30 minutes)
**Goal:** Test token card HTML generation (63 lines, lines 374-436)

**Test Cases:**

#### 5.1: Token with Bonus
```javascript
it('should render token card with bonus applied styling', () => {
  const token = {
    rfid: 'rat001',
    memoryType: 'Technical',
    valueRating: 3,
    group: 'MARCUS_SUCKS (x2)',
    isUnknown: false
  };

  global.DataManager.calculateTokenValue.mockReturnValue(3000);
  global.DataManager.parseGroupInfo.mockReturnValue({ multiplier: 2 });
  global.DataManager.SCORING_CONFIG = {
    BASE_VALUES: { 1: 500, 2: 1000, 3: 2000, 4: 4000, 5: 8000 },
    TYPE_MULTIPLIERS: { Technical: 1.5, Business: 1.0, Personal: 1.25 }
  };

  const html = UIManager.renderTokenCard(token, true, false);

  expect(html).toContain('bonus-applied');
  expect(html).toContain('rat001');
  expect(html).toContain('Technical');
  expect(html).toContain('$6,000'); // 3000 * 2 multiplier
  expect(html).toContain('2000 × 1.5x Technical × 2x group = $6,000');
});
```

#### 5.2: Unknown Token
```javascript
it('should render unknown token with no value', () => {
  const token = {
    rfid: 'UNKNOWN_123',
    memoryType: 'UNKNOWN',
    isUnknown: true
  };

  const html = UIManager.renderTokenCard(token, false, true);

  expect(html).toContain('unknown');
  expect(html).toContain('UNKNOWN_123');
  expect(html).toContain('Unknown token - No value');
  expect(html).toContain('❓ Unknown');
});
```

**Expected Outcome:** 2+ renderTokenCard tests, all passing

---

### STEP 6: Add renderTransactions() Tests (30 minutes)
**Goal:** Test transaction history rendering (43 lines, lines 442-484)

**Test Cases:**

#### 6.1: Empty State
```javascript
it('should display empty state when no transactions', () => {
  UIManager.renderTransactions([]);

  const html = mockElements['historyContainer'].innerHTML;
  expect(html).toContain('No Transactions Yet');
});
```

#### 6.2: Blackmarket Mode Value Display
```javascript
it('should format values as currency in blackmarket mode', () => {
  const transactions = [{
    teamId: '001',
    timestamp: '2025-10-06T10:00:00Z',
    rfid: 'rat001',
    memoryType: 'Technical',
    valueRating: 3,
    stationMode: 'blackmarket',
    group: 'MARCUS_SUCKS (x2)',
    isUnknown: false
  }];

  global.DataManager.calculateTokenValue.mockReturnValue(3000);

  UIManager.renderTransactions(transactions);

  const html = mockElements['historyContainer'].innerHTML;
  expect(html).toContain('$3,000');
  expect(html).toContain('Black Market');
});
```

#### 6.3: Detective Mode Value Display
```javascript
it('should format values as stars in detective mode', () => {
  const transactions = [{
    teamId: '001',
    timestamp: '2025-10-06T10:00:00Z',
    rfid: 'rat001',
    memoryType: 'Technical',
    valueRating: 3,
    stationMode: 'detective',
    group: 'MARCUS_SUCKS (x2)',
    isUnknown: false
  }];

  UIManager.renderTransactions(transactions);

  const html = mockElements['historyContainer'].innerHTML;
  expect(html).toContain('⭐⭐⭐');
  expect(html).toContain('Detective');
});
```

**Expected Outcome:** 3+ renderTransactions tests, all passing

---

### STEP 7: Add filterTransactions() Tests (30 minutes)
**Goal:** Test search/filter logic (20 lines, lines 489-508)

**Test Cases:**

#### 7.1: Search by RFID
```javascript
it('should filter transactions by RFID search', () => {
  const mockTransactions = [
    { rfid: 'rat001', teamId: '001', memoryType: 'Technical', group: 'A', stationMode: 'blackmarket', timestamp: '2025-10-06T10:00:00Z' },
    { rfid: 'asm001', teamId: '002', memoryType: 'Business', group: 'B', stationMode: 'detective', timestamp: '2025-10-06T11:00:00Z' }
  ];

  global.DataManager.transactions = mockTransactions;
  mockElements['searchFilter'] = { value: 'rat' };
  mockElements['modeFilter'] = { value: '' };

  const renderSpy = jest.spyOn(UIManager, 'renderTransactions');

  UIManager.filterTransactions();

  const filtered = renderSpy.mock.calls[0][0];
  expect(filtered).toHaveLength(1);
  expect(filtered[0].rfid).toBe('rat001');
});
```

#### 7.2: Filter by Mode
```javascript
it('should filter transactions by mode', () => {
  const mockTransactions = [
    { rfid: 'rat001', teamId: '001', memoryType: 'Technical', group: 'A', stationMode: 'blackmarket', timestamp: '2025-10-06T10:00:00Z' },
    { rfid: 'asm001', teamId: '002', memoryType: 'Business', group: 'B', stationMode: 'detective', timestamp: '2025-10-06T11:00:00Z' }
  ];

  global.DataManager.transactions = mockTransactions;
  mockElements['searchFilter'] = { value: '' };
  mockElements['modeFilter'] = { value: 'detective' };

  const renderSpy = jest.spyOn(UIManager, 'renderTransactions');

  UIManager.filterTransactions();

  const filtered = renderSpy.mock.calls[0][0];
  expect(filtered).toHaveLength(1);
  expect(filtered[0].stationMode).toBe('detective');
});
```

#### 7.3: Combined Search + Filter
```javascript
it('should apply both search and mode filter', () => {
  const mockTransactions = [
    { rfid: 'rat001', teamId: '001', memoryType: 'Technical', group: 'A', stationMode: 'blackmarket', timestamp: '2025-10-06T10:00:00Z' },
    { rfid: 'rat002', teamId: '002', memoryType: 'Business', group: 'B', stationMode: 'detective', timestamp: '2025-10-06T11:00:00Z' },
    { rfid: 'asm001', teamId: '003', memoryType: 'Personal', group: 'C', stationMode: 'blackmarket', timestamp: '2025-10-06T12:00:00Z' }
  ];

  global.DataManager.transactions = mockTransactions;
  mockElements['searchFilter'] = { value: 'rat' };
  mockElements['modeFilter'] = { value: 'detective' };

  const renderSpy = jest.spyOn(UIManager, 'renderTransactions');

  UIManager.filterTransactions();

  const filtered = renderSpy.mock.calls[0][0];
  expect(filtered).toHaveLength(1);
  expect(filtered[0].rfid).toBe('rat002');
});
```

**Expected Outcome:** 3+ filterTransactions tests, all passing

---

### STEP 8: Add showTokenResult() Tests (30 minutes)
**Goal:** Test scan result display (45 lines, lines 557-601)

**Test Cases:**

#### 8.1: Known Token Display
```javascript
it('should display known token with all metadata', () => {
  const token = {
    SF_RFID: 'rat001',
    SF_MemoryType: 'Technical',
    SF_ValueRating: 3,
    SF_Group: 'MARCUS_SUCKS (x2)'
  };

  global.Settings.stationMode = 'blackmarket';
  global.DataManager.calculateTokenValue.mockReturnValue(3000);

  UIManager.showTokenResult(token, 'rat001', false);

  expect(mockElements['resultStatus'].className).toBe('status-message success');
  expect(mockElements['resultStatus'].innerHTML).toContain('Transaction Complete!');
  expect(mockElements['resultRfid'].textContent).toBe('rat001');
  expect(mockElements['resultType'].textContent).toBe('Technical');
  expect(mockElements['resultGroup'].textContent).toBe('MARCUS_SUCKS (x2)');
  expect(mockElements['resultValue'].textContent).toBe('$3,000');
});
```

#### 8.2: Unknown Token Display
```javascript
it('should display unknown token with error styling', () => {
  global.Settings.stationMode = 'blackmarket';

  UIManager.showTokenResult(null, 'UNKNOWN_123', true);

  expect(mockElements['resultStatus'].className).toBe('status-message error');
  expect(mockElements['resultStatus'].innerHTML).toContain('Unknown Token');
  expect(mockElements['resultRfid'].textContent).toBe('UNKNOWN_123');
  expect(mockElements['resultType'].textContent).toBe('UNKNOWN');
  expect(mockElements['resultValue'].textContent).toBe('$0');
});
```

**Expected Outcome:** 2+ showTokenResult tests, all passing

---

### STEP 9: Update TEST-IMPROVEMENT-PLAN.md (15 minutes)
**Goal:** Document actual Phase 5 work completed

**Updates Needed:**
1. Add UIManager comprehensive testing section
2. Document Bug #1 found (malformed event data)
3. Update test counts (actual vs planned)
4. Update completion criteria

---

### STEP 10: Create debug.test.js (30 minutes)
**Goal:** Test debug logging utility (84 lines)

**Test Cases:**
- Message logging with timestamp
- Error vs normal logging
- Message array management (max limit)
- Panel DOM updates
- Console output verification

---

### STEP 11: Create nfcHandler.test.js (45 minutes)
**Goal:** Test NFC scanning module (165 lines)

**Test Cases:**
- NFC support detection
- Scan start/stop
- Token ID extraction from NDEF records
- Error handling
- Simulation mode

---

## Success Criteria

### Coverage Targets
- ✅ UIManager: 100% of functions tested (currently 40%)
- ✅ All tests are behavioral (verify DOM output, not just "doesn't crash")
- ✅ debug.js: Basic coverage (4-5 tests)
- ✅ nfcHandler.js: Comprehensive coverage (8-10 tests)

### Quality Metrics
- ✅ ZERO smoke tests (all verify actual behavior)
- ✅ All rendering functions have HTML output verification
- ✅ All filtering/calculation logic has data verification
- ✅ Edge cases tested (empty states, null handling)

### Bug Discovery
- ✅ Document all bugs found during testing
- ✅ Fix implementation bugs before marking tests complete

---

## Estimated Time

| Step | Duration | Cumulative |
|------|----------|------------|
| 1. Fix team display | 5 min | 5 min |
| 2. Rewrite error tests | 30 min | 35 min |
| 3. renderScoreboard | 45 min | 1h 20m |
| 4. renderTeamDetails | 60 min | 2h 20m |
| 5. renderTokenCard | 30 min | 2h 50m |
| 6. renderTransactions | 30 min | 3h 20m |
| 7. filterTransactions | 30 min | 3h 50m |
| 8. showTokenResult | 30 min | 4h 20m |
| 9. Update plan doc | 15 min | 4h 35m |
| 10. debug.test.js | 30 min | 5h 5m |
| 11. nfcHandler.test.js | 45 min | 5h 50m |

**Total Estimated Time:** ~6 hours

---

## Expected Outcomes

**Test Count:**
- Current: 563 tests (552 passing)
- After Phase 5: ~630 tests (all passing)
- New Tests Added: ~67 tests

**Bug Count:**
- Current: 1 bug found (malformed event data)
- Expected: 2-4 additional bugs from rendering tests

**Coverage:**
- UIManager: 40% → 100%
- debug.js: 0% → 80%
- nfcHandler.js: 0% → 85%

---

**Status:** Ready to begin Step 1
