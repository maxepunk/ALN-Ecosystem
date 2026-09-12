# Session Report Generator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a downloadable markdown session report from the GM Scanner admin panel when a game session ends, covering detective evidence, black market transactions, and player activity.

**Architecture:** Pure client-side report generation in the GM Scanner. A new `SessionReportGenerator` module assembles markdown from data already available via `sync:full` (transactions, player scans, scores) and local token data (character owner names). The Notion sync script is extended to populate a `character` field in `tokens.json` from the Elements→Characters Owner relation.

**Tech Stack:** ES6 modules (Vite), Python (Notion API), no new backend work.

---

## Task 1: Add Character Lookup to Notion Sync Script

**Files:**
- Modify: `scripts/sync_notion_to_tokens.py`

**Context:** The sync script fetches Elements from Notion and writes `tokens.json`. Elements have an "Owner" relation to the Characters database, but it's not currently read. We need to: (1) bulk-fetch all Characters to build a `{page_id: name}` map, (2) look up each element's Owner relation, (3) add a `"character"` field to each token entry.

**Step 1: Add Characters database constant and fetch function**

Add after `ELEMENTS_DATABASE_ID` (line 38):

```python
CHARACTERS_DATABASE_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
```

Add new function before `fetch_all_memory_tokens()`:

```python
def fetch_all_characters():
    """Fetch all characters from Notion and build {page_id: name} map."""
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        query_data = {}
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{CHARACTERS_DATABASE_ID}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching characters: {data}")
            break

        all_results.extend(data["results"])
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    # Build page_id -> name map
    character_map = {}
    for page in all_results:
        page_id = page["id"]
        name_data = page["properties"].get("Name", {}).get("title", [])
        name = name_data[0]["text"]["content"] if name_data else None
        if name:
            character_map[page_id] = name

    print(f"Loaded {len(character_map)} characters from Notion")
    return character_map
```

**Step 2: Update `process_token()` to accept and use character_map**

Change the function signature from:

```python
def process_token(page):
```

to:

```python
def process_token(page, character_map):
```

After the token_entry dict is built (after line 592), add:

```python
    # Look up character owner from Notion relation
    owner_refs = page["properties"].get("Owner", {}).get("relation", [])
    if owner_refs:
        owner_id = owner_refs[0]["id"]  # First owner (primary)
        token_entry["character"] = character_map.get(owner_id)
    else:
        token_entry["character"] = None
```

**Step 3: Update `main()` to fetch characters and pass to process_token**

In `main()`, after `pages = fetch_all_memory_tokens()` (line 626), add:

```python
    # Fetch character name map for Owner relation lookups
    print("Fetching characters from Notion...")
    character_map = fetch_all_characters()
    print()
```

Update the `process_token` call (line 636) from:

```python
        result = process_token(page)
```

to:

```python
        result = process_token(page, character_map)
```

**Step 4: Run the sync and verify output**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem && python3 scripts/sync_notion_to_tokens.py`

Expected: Script completes successfully, `ALN-TokenData/tokens.json` now has `"character"` field on each token.

Verify: `python3 -c "import json; data=json.load(open('ALN-TokenData/tokens.json')); first=list(data.values())[0]; print(first.get('character'))"`

Expected: Prints a character name (e.g., `ALEX`) or `None`.

**Step 5: Commit**

```bash
git add scripts/sync_notion_to_tokens.py ALN-TokenData/tokens.json
git commit -m "feat(sync): add character owner lookup from Notion Characters DB"
```

---

## Task 2: Update Token Data Submodule Across Scanners

**Files:**
- Modify: `ALN-TokenData/tokens.json` (already updated by Task 1)
- Update submodule refs in: `ALNScanner/data/`, `aln-memory-scanner/data/`

**Context:** The `ALN-TokenData` submodule was updated in Task 1. Nested submodules in ALNScanner and aln-memory-scanner need to pick up the new `tokens.json` with `character` fields.

**Step 1: Commit inside ALN-TokenData submodule**

```bash
cd ALN-TokenData
git add tokens.json
git commit -m "feat: add character owner field to token entries"
git push
cd ..
```

**Step 2: Update nested submodule refs**

```bash
cd ALNScanner/data && git pull origin main && cd ../..
cd aln-memory-scanner/data && git pull origin main && cd ../..
```

**Step 3: Stage updated submodule refs in parent repo**

```bash
git add ALN-TokenData ALNScanner/data aln-memory-scanner/data
git commit -m "chore: update token data submodule refs (character field)"
```

---

## Task 3: Create SessionReportGenerator Module

**Files:**
- Create: `ALNScanner/src/core/sessionReportGenerator.js`
- Test: `ALNScanner/tests/unit/core/sessionReportGenerator.test.js`

**Context:** This is the core module. It takes session data (transactions, playerScans, scores) and a token database, then produces a markdown string. It has no DOM dependencies — pure data transformation.

**Step 1: Write the failing tests**

Create `ALNScanner/tests/unit/core/sessionReportGenerator.test.js`:

```javascript
import { SessionReportGenerator } from '../../../src/core/sessionReportGenerator.js';
import { SCORING_CONFIG } from '../../../src/core/scoring.js';

// Shared test fixtures
const mockTokenDatabase = {
  'sof001': {
    SF_RFID: 'sof001',
    SF_ValueRating: 3,
    SF_MemoryType: 'Personal',
    SF_Group: '',
    summary: '11:32PM - SOFIA discovers hidden files on MARCUS laptop.',
    character: 'SOFIA'
  },
  'mab001': {
    SF_RFID: 'mab001',
    SF_ValueRating: 5,
    SF_MemoryType: 'Technical',
    SF_Group: 'Server Logs (x5)',
    summary: '05/12/2022 - MARCUS refactors the prototype code.',
    character: 'MARCUS'
  },
  'alr001': {
    SF_RFID: 'alr001',
    SF_ValueRating: 2,
    SF_MemoryType: 'Business',
    SF_Group: '',
    summary: '03/20/2020 - ALEX files lawsuit against MARCUS.',
    character: 'ALEX'
  },
  'det001': {
    SF_RFID: 'det001',
    SF_ValueRating: 1,
    SF_MemoryType: 'Personal',
    SF_Group: '',
    summary: '04/07/2022 - DEREK meets OLIVER.',
    character: 'DEREK'
  }
};

const mockSession = {
  id: 'test-session-123',
  name: 'Test Game Night',
  startTime: '2026-02-16T19:00:00.000Z',
  endTime: '2026-02-16T21:15:00.000Z',
  status: 'ended',
  teams: ['Whitemetal Inc.', 'Shadow Corp'],
  metadata: { totalScans: 5, playerScanCount: 3 }
};

const mockScores = [
  { teamId: 'Whitemetal Inc.', score: 800000 },
  { teamId: 'Shadow Corp', score: 150000 }
];

const mockTransactions = [
  {
    id: 'tx-1',
    tokenId: 'sof001',
    teamId: 'Whitemetal Inc.',
    mode: 'detective',
    status: 'accepted',
    points: 0,
    timestamp: '2026-02-16T19:30:00.000Z',
    deviceId: 'GM_STATION_1',
    memoryType: 'Personal',
    valueRating: 3,
    summary: '11:32PM - SOFIA discovers hidden files on MARCUS laptop.'
  },
  {
    id: 'tx-2',
    tokenId: 'mab001',
    teamId: 'Shadow Corp',
    mode: 'blackmarket',
    status: 'accepted',
    points: 750000,
    timestamp: '2026-02-16T19:45:00.000Z',
    deviceId: 'GM_STATION_1',
    memoryType: 'Technical',
    valueRating: 5,
    summary: null
  },
  {
    id: 'tx-3',
    tokenId: 'alr001',
    teamId: 'Whitemetal Inc.',
    mode: 'blackmarket',
    status: 'accepted',
    points: 75000,
    timestamp: '2026-02-16T20:00:00.000Z',
    deviceId: 'GM_STATION_2',
    memoryType: 'Business',
    valueRating: 2,
    summary: null
  }
];

const mockPlayerScans = [
  {
    id: 'ps-1',
    tokenId: 'sof001',
    deviceId: 'PLAYER_42',
    deviceType: 'player',
    timestamp: '2026-02-16T19:15:00.000Z'
  },
  {
    id: 'ps-2',
    tokenId: 'mab001',
    deviceId: 'PLAYER_42',
    deviceType: 'player',
    timestamp: '2026-02-16T19:20:00.000Z'
  },
  {
    id: 'ps-3',
    tokenId: 'det001',
    deviceId: 'PLAYER_07',
    deviceType: 'player',
    timestamp: '2026-02-16T20:30:00.000Z'
  }
];

describe('SessionReportGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new SessionReportGenerator(mockTokenDatabase);
  });

  describe('constructor', () => {
    it('should store the token database', () => {
      expect(generator.tokenDatabase).toBe(mockTokenDatabase);
    });
  });

  describe('generate()', () => {
    it('should return a markdown string', () => {
      const report = generator.generate({
        session: mockSession,
        scores: mockScores,
        transactions: mockTransactions,
        playerScans: mockPlayerScans
      });
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should include session header with name', () => {
      const report = generator.generate({
        session: mockSession,
        scores: mockScores,
        transactions: mockTransactions,
        playerScans: mockPlayerScans
      });
      expect(report).toContain('# Session Report: Test Game Night');
    });

    it('should include session summary section', () => {
      const report = generator.generate({
        session: mockSession,
        scores: mockScores,
        transactions: mockTransactions,
        playerScans: mockPlayerScans
      });
      expect(report).toContain('## Session Summary');
      expect(report).toContain('Whitemetal Inc.');
      expect(report).toContain('Shadow Corp');
    });
  });

  describe('_buildSessionSummary()', () => {
    it('should include team count and list', () => {
      const summary = generator._buildSessionSummary(
        mockSession, mockScores, mockTransactions, mockPlayerScans
      );
      expect(summary).toContain('Whitemetal Inc.');
      expect(summary).toContain('Shadow Corp');
    });

    it('should include transaction counts by mode', () => {
      const summary = generator._buildSessionSummary(
        mockSession, mockScores, mockTransactions, mockPlayerScans
      );
      expect(summary).toContain('1 detective');
      expect(summary).toContain('2 black market');
    });

    it('should include leaderboard sorted by score descending', () => {
      const summary = generator._buildSessionSummary(
        mockSession, mockScores, mockTransactions, mockPlayerScans
      );
      // Shadow Corp ($750,000) should be before Whitemetal ($75,000 from tx)
      // But scores come from mockScores, so Whitemetal $800,000 is first
      const whiteIdx = summary.indexOf('Whitemetal Inc.');
      const shadowIdx = summary.indexOf('Shadow Corp');
      expect(whiteIdx).toBeLessThan(shadowIdx);
    });

    it('should include player scan count', () => {
      const summary = generator._buildSessionSummary(
        mockSession, mockScores, mockTransactions, mockPlayerScans
      );
      expect(summary).toContain('3');
    });
  });

  describe('_buildDetectiveSection()', () => {
    it('should only include detective mode transactions', () => {
      const section = generator._buildDetectiveSection(mockTransactions);
      expect(section).toContain('sof001');
      expect(section).not.toContain('mab001');
      expect(section).not.toContain('alr001');
    });

    it('should include Owner column from token database', () => {
      const section = generator._buildDetectiveSection(mockTransactions);
      expect(section).toContain('SOFIA');
    });

    it('should use Exposed By as the team column header', () => {
      const section = generator._buildDetectiveSection(mockTransactions);
      expect(section).toContain('Exposed By');
    });

    it('should include evidence summary', () => {
      const section = generator._buildDetectiveSection(mockTransactions);
      expect(section).toContain('SOFIA discovers hidden files');
    });

    it('should return a note when no detective transactions exist', () => {
      const section = generator._buildDetectiveSection([
        { ...mockTransactions[1] } // blackmarket only
      ]);
      expect(section).toContain('No detective transactions');
    });
  });

  describe('_buildBlackMarketSection()', () => {
    it('should only include blackmarket mode transactions', () => {
      const section = generator._buildBlackMarketSection(mockTransactions);
      expect(section).toContain('mab001');
      expect(section).toContain('alr001');
      expect(section).not.toContain('sof001');
    });

    it('should use Buried By as the team column header', () => {
      const section = generator._buildBlackMarketSection(mockTransactions);
      expect(section).toContain('Buried By');
    });

    it('should include scoring breakdown', () => {
      const section = generator._buildBlackMarketSection(mockTransactions);
      // mab001: rating 5 Technical = $150,000 × 5x = $750,000
      expect(section).toContain('$750,000');
      expect(section).toContain('Technical');
    });

    it('should include Owner column from token database', () => {
      const section = generator._buildBlackMarketSection(mockTransactions);
      expect(section).toContain('MARCUS');
      expect(section).toContain('ALEX');
    });

    it('should include per-team subtotals', () => {
      const section = generator._buildBlackMarketSection(mockTransactions);
      expect(section).toContain('Shadow Corp');
      expect(section).toContain('Whitemetal Inc.');
    });

    it('should return a note when no blackmarket transactions exist', () => {
      const section = generator._buildBlackMarketSection([
        { ...mockTransactions[0] } // detective only
      ]);
      expect(section).toContain('No black market transactions');
    });
  });

  describe('_buildPlayerActivitySection()', () => {
    it('should list all player scans', () => {
      const section = generator._buildPlayerActivitySection(
        mockPlayerScans, mockTransactions
      );
      expect(section).toContain('sof001');
      expect(section).toContain('mab001');
      expect(section).toContain('det001');
    });

    it('should include Owner column from token database', () => {
      const section = generator._buildPlayerActivitySection(
        mockPlayerScans, mockTransactions
      );
      expect(section).toContain('SOFIA');
      expect(section).toContain('DEREK');
    });

    it('should identify tokens scanned but never turned in', () => {
      const section = generator._buildPlayerActivitySection(
        mockPlayerScans, mockTransactions
      );
      // det001 was scanned by player but never turned in via GM
      expect(section).toContain('det001');
      expect(section).toMatch(/never turned in|not processed/i);
    });

    it('should identify most active devices', () => {
      const section = generator._buildPlayerActivitySection(
        mockPlayerScans, mockTransactions
      );
      // PLAYER_42 scanned 2 tokens, PLAYER_07 scanned 1
      expect(section).toContain('PLAYER_42');
    });

    it('should return a note when no player scans exist', () => {
      const section = generator._buildPlayerActivitySection([], mockTransactions);
      expect(section).toContain('No player scan');
    });
  });

  describe('_formatCurrency()', () => {
    it('should format numbers with dollar sign and commas', () => {
      expect(generator._formatCurrency(750000)).toBe('$750,000');
      expect(generator._formatCurrency(10000)).toBe('$10,000');
      expect(generator._formatCurrency(0)).toBe('$0');
    });
  });

  describe('_formatTimestamp()', () => {
    it('should format ISO timestamp to readable local time', () => {
      const formatted = generator._formatTimestamp('2026-02-16T19:30:00.000Z');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('_getTokenOwner()', () => {
    it('should return character name from token database', () => {
      expect(generator._getTokenOwner('sof001')).toBe('SOFIA');
      expect(generator._getTokenOwner('mab001')).toBe('MARCUS');
    });

    it('should return "Unknown" for tokens not in database', () => {
      expect(generator._getTokenOwner('nonexistent')).toBe('Unknown');
    });

    it('should return "Unknown" for tokens without character field', () => {
      generator.tokenDatabase = { 'test': { SF_RFID: 'test' } };
      expect(generator._getTokenOwner('test')).toBe('Unknown');
    });
  });

  describe('_formatDuration()', () => {
    it('should format duration in hours and minutes', () => {
      // mockSession: 19:00 to 21:15 = 2h 15m
      const formatted = generator._formatDuration(
        mockSession.startTime, mockSession.endTime
      );
      expect(formatted).toContain('2h');
      expect(formatted).toContain('15m');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ALNScanner && npx jest tests/unit/core/sessionReportGenerator.test.js --no-coverage`

Expected: FAIL — module does not exist yet.

**Step 3: Implement SessionReportGenerator**

Create `ALNScanner/src/core/sessionReportGenerator.js`:

```javascript
/**
 * Session Report Generator
 * Assembles a downloadable markdown report from session data.
 *
 * Data sources (all from sync:full payload + local token DB):
 * - session: id, name, startTime, endTime, teams
 * - scores: [{teamId, score}]
 * - transactions (recentTransactions): enriched with memoryType, valueRating
 * - playerScans: [{tokenId, deviceId, timestamp}]
 * - tokenDatabase: local tokens.json (has character field)
 *
 * @module core/sessionReportGenerator
 */

import { SCORING_CONFIG } from './scoring.js';

export class SessionReportGenerator {
  /**
   * @param {Object} tokenDatabase - Token database keyed by tokenId
   */
  constructor(tokenDatabase) {
    this.tokenDatabase = tokenDatabase || {};
  }

  /**
   * Generate a full markdown session report.
   *
   * @param {Object} data
   * @param {Object} data.session - Session object (id, name, startTime, endTime, teams)
   * @param {Array} data.scores - Team scores [{teamId, score}]
   * @param {Array} data.transactions - Enriched transactions from sync:full
   * @param {Array} data.playerScans - Player scan records
   * @returns {string} Markdown report
   */
  generate({ session, scores, transactions, playerScans }) {
    const duration = this._formatDuration(session.startTime, session.endTime);
    const date = this._formatDate(session.startTime);
    const teamCount = (session.teams || []).length;

    const sections = [
      `# Session Report: ${session.name}`,
      `**${date} | Duration: ${duration} | Teams: ${teamCount}**`,
      '',
      this._buildSessionSummary(session, scores, transactions, playerScans),
      this._buildDetectiveSection(transactions),
      this._buildBlackMarketSection(transactions),
      this._buildPlayerActivitySection(playerScans, transactions),
    ];

    return sections.join('\n');
  }

  /**
   * Build the session summary section.
   */
  _buildSessionSummary(session, scores, transactions, playerScans) {
    const accepted = transactions.filter(tx => tx.status === 'accepted');
    const detective = accepted.filter(tx => tx.mode === 'detective');
    const blackmarket = accepted.filter(tx => tx.mode === 'blackmarket');
    const uniqueTokens = new Set(accepted.map(tx => tx.tokenId));

    // Sort scores descending
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    const leaderboard = sortedScores
      .map((s, i) => `${i + 1}. **${s.teamId}** — ${this._formatCurrency(s.score)}`)
      .join('\n');

    const lines = [
      '## Session Summary',
      '',
      `- **Teams:** ${(session.teams || []).join(', ')}`,
      `- **Total Transactions:** ${accepted.length} (${detective.length} detective, ${blackmarket.length} black market)`,
      `- **Player Scans:** ${playerScans.length}`,
      `- **Unique Tokens Processed:** ${uniqueTokens.size}`,
      '',
      '### Final Standings',
      '',
      leaderboard,
      '',
      '---',
      '',
    ];

    return lines.join('\n');
  }

  /**
   * Build the detective evidence log section.
   */
  _buildDetectiveSection(transactions) {
    const detective = transactions
      .filter(tx => tx.status === 'accepted' && tx.mode === 'detective')
      .sort((a, b) => a.tokenId.localeCompare(b.tokenId));

    const lines = [
      '## Detective Evidence Log',
      '',
    ];

    if (detective.length === 0) {
      lines.push('*No detective transactions this session.*');
      lines.push('');
      lines.push('---');
      lines.push('');
      return lines.join('\n');
    }

    lines.push('| Token | Owner | Exposed By | Time | Evidence |');
    lines.push('|-------|-------|------------|------|----------|');

    for (const tx of detective) {
      const owner = this._getTokenOwner(tx.tokenId);
      const time = this._formatTimestamp(tx.timestamp);
      const evidence = (tx.summary || '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${tx.tokenId} | ${owner} | ${tx.teamId} | ${time} | ${evidence} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Build the black market transactions section.
   */
  _buildBlackMarketSection(transactions) {
    const blackmarket = transactions
      .filter(tx => tx.status === 'accepted' && tx.mode === 'blackmarket')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const lines = [
      '## Black Market Transactions',
      '',
    ];

    if (blackmarket.length === 0) {
      lines.push('*No black market transactions this session.*');
      lines.push('');
      lines.push('---');
      lines.push('');
      return lines.join('\n');
    }

    lines.push('| Token | Owner | Buried By | Points | Rating | Type | Breakdown |');
    lines.push('|-------|-------|-----------|--------|--------|------|-----------|');

    for (const tx of blackmarket) {
      const owner = this._getTokenOwner(tx.tokenId);
      const rating = tx.valueRating || 0;
      const type = tx.memoryType || 'UNKNOWN';
      const baseValue = SCORING_CONFIG.BASE_VALUES[rating] || 0;
      const multiplier = SCORING_CONFIG.TYPE_MULTIPLIERS[type]
        ?? SCORING_CONFIG.TYPE_MULTIPLIERS.UNKNOWN ?? 0;
      const breakdown = `${this._formatCurrency(baseValue)} × ${multiplier}x`;
      lines.push(
        `| ${tx.tokenId} | ${owner} | ${tx.teamId} | ${this._formatCurrency(tx.points)} | ${rating}★ | ${type} | ${breakdown} |`
      );
    }

    // Per-team subtotals
    const teamTotals = {};
    for (const tx of blackmarket) {
      teamTotals[tx.teamId] = (teamTotals[tx.teamId] || 0) + tx.points;
    }

    lines.push('');
    lines.push('### Team Subtotals');
    lines.push('');
    const sortedTeams = Object.entries(teamTotals).sort((a, b) => b[1] - a[1]);
    for (const [teamId, total] of sortedTeams) {
      lines.push(`- **${teamId}:** ${this._formatCurrency(total)}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Build the player activity section.
   */
  _buildPlayerActivitySection(playerScans, transactions) {
    const lines = [
      '## Player Activity',
      '',
    ];

    if (playerScans.length === 0) {
      lines.push('*No player scans this session.*');
      lines.push('');
      return lines.join('\n');
    }

    // Scan log table
    const sorted = [...playerScans].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    lines.push('| Token | Owner | Device | Time |');
    lines.push('|-------|-------|--------|------|');

    for (const scan of sorted) {
      const owner = this._getTokenOwner(scan.tokenId);
      const time = this._formatTimestamp(scan.timestamp);
      lines.push(`| ${scan.tokenId} | ${owner} | ${scan.deviceId} | ${time} |`);
    }

    // Stats
    lines.push('');
    lines.push('### Activity Stats');
    lines.push('');

    // Most active devices
    const deviceCounts = {};
    for (const scan of playerScans) {
      deviceCounts[scan.deviceId] = (deviceCounts[scan.deviceId] || 0) + 1;
    }
    const sortedDevices = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]);
    lines.push('**Most Active Devices:**');
    for (const [deviceId, count] of sortedDevices) {
      lines.push(`- ${deviceId}: ${count} scan${count !== 1 ? 's' : ''}`);
    }

    // Most scanned tokens
    lines.push('');
    const tokenCounts = {};
    for (const scan of playerScans) {
      tokenCounts[scan.tokenId] = (tokenCounts[scan.tokenId] || 0) + 1;
    }
    const sortedTokens = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1]);
    const topTokens = sortedTokens.filter(([, count]) => count > 1);
    if (topTokens.length > 0) {
      lines.push('**Most Scanned Tokens:**');
      for (const [tokenId, count] of topTokens) {
        const owner = this._getTokenOwner(tokenId);
        lines.push(`- ${tokenId} (${owner}): ${count} scans`);
      }
      lines.push('');
    }

    // Tokens scanned but never turned in
    const processedTokenIds = new Set(
      transactions
        .filter(tx => tx.status === 'accepted')
        .map(tx => tx.tokenId)
    );
    const scannedTokenIds = new Set(playerScans.map(ps => ps.tokenId));
    const neverTurnedIn = [...scannedTokenIds].filter(id => !processedTokenIds.has(id));

    if (neverTurnedIn.length > 0) {
      lines.push('**Tokens Scanned but Never Turned In:**');
      for (const tokenId of neverTurnedIn.sort()) {
        const owner = this._getTokenOwner(tokenId);
        lines.push(`- ${tokenId} (${owner})`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  // --- Utility methods ---

  /**
   * Look up the character owner name for a token.
   * @param {string} tokenId
   * @returns {string} Character name or 'Unknown'
   */
  _getTokenOwner(tokenId) {
    const token = this.tokenDatabase[tokenId];
    return token?.character || 'Unknown';
  }

  /**
   * Format a number as currency with dollar sign and commas.
   * @param {number} amount
   * @returns {string}
   */
  _formatCurrency(amount) {
    return '$' + (amount || 0).toLocaleString('en-US');
  }

  /**
   * Format an ISO timestamp to local readable time (HH:MM).
   * @param {string} isoTimestamp
   * @returns {string}
   */
  _formatTimestamp(isoTimestamp) {
    if (!isoTimestamp) return '—';
    const date = new Date(isoTimestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format an ISO timestamp to a readable date string.
   * @param {string} isoTimestamp
   * @returns {string}
   */
  _formatDate(isoTimestamp) {
    if (!isoTimestamp) return 'Unknown Date';
    const date = new Date(isoTimestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format duration between two ISO timestamps as "Xh Ym".
   * @param {string} startTime
   * @param {string} endTime
   * @returns {string}
   */
  _formatDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'Unknown';
    const ms = new Date(endTime) - new Date(startTime);
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd ALNScanner && npx jest tests/unit/core/sessionReportGenerator.test.js --no-coverage`

Expected: All tests PASS.

**Step 5: Commit**

```bash
cd ALNScanner
git add src/core/sessionReportGenerator.js tests/unit/core/sessionReportGenerator.test.js
git commit -m "feat(report): add SessionReportGenerator with unit tests"
```

---

## Task 4: Wire Report Download into GM Scanner UI

**Files:**
- Modify: `ALNScanner/src/ui/renderers/SessionRenderer.js` (add button)
- Modify: `ALNScanner/src/app/app.js` (add handler)
- Test: `ALNScanner/tests/unit/app/app.sessionReport.test.js`

**Context:** When a session is in the `ended` state, SessionRenderer shows a "Reset & New Session" button. We add a "Download Report" button next to it. The app.js handler gathers data from the existing DataManager/SessionManager state, passes it to SessionReportGenerator, and triggers a browser download.

**Step 1: Write the failing test for the download handler**

Create `ALNScanner/tests/unit/app/app.sessionReport.test.js`:

```javascript
import { SessionReportGenerator } from '../../../src/core/sessionReportGenerator.js';

// Test that the report generator is invoked correctly by the app handler.
// We test the integration point — data assembly and download trigger.

describe('Session Report Download', () => {
  let generator;

  const mockTokenDatabase = {
    'tok001': { SF_RFID: 'tok001', character: 'ALEX' }
  };

  const mockSessionData = {
    session: {
      id: 'sess-1',
      name: 'Game Night',
      startTime: '2026-02-16T19:00:00.000Z',
      endTime: '2026-02-16T21:00:00.000Z',
      status: 'ended',
      teams: ['Team A']
    },
    scores: [{ teamId: 'Team A', score: 100000 }],
    transactions: [],
    playerScans: []
  };

  beforeEach(() => {
    generator = new SessionReportGenerator(mockTokenDatabase);
  });

  it('should generate a markdown string from session data', () => {
    const report = generator.generate(mockSessionData);
    expect(report).toContain('# Session Report: Game Night');
    expect(report).toContain('Team A');
  });

  it('should generate a valid filename', () => {
    const name = mockSessionData.session.name;
    const date = '2026-02-16';
    const filename = `session-report-${name.toLowerCase().replace(/\s+/g, '-')}-${date}.md`;
    expect(filename).toBe('session-report-game-night-2026-02-16.md');
  });
});
```

**Step 2: Run test to verify it passes (generator already exists)**

Run: `cd ALNScanner && npx jest tests/unit/app/app.sessionReport.test.js --no-coverage`

Expected: PASS (tests the generator, not DOM).

**Step 3: Add "Download Report" button to SessionRenderer**

In `ALNScanner/src/ui/renderers/SessionRenderer.js`, in the `ended` state block (lines 193-209), add a button before "Reset & New Session":

Change the `session-controls` div from:

```html
<div class="session-controls">
    <button class="btn btn-primary" data-action="app.adminResetAndCreateNew">
        Reset & New Session
    </button>
</div>
```

to:

```html
<div class="session-controls">
    <button class="btn btn-secondary" data-action="app.downloadSessionReport">
        Download Report
    </button>
    <button class="btn btn-primary" data-action="app.adminResetAndCreateNew">
        Reset & New Session
    </button>
</div>
```

**Step 4: Add handler in app.js**

In `ALNScanner/src/app/app.js`, add the following method after `adminEndSession()` (around line 1014):

```javascript
  /**
   * Download session report as markdown file.
   * Gathers data from current sync:full state and token database.
   */
  async downloadSessionReport() {
    try {
      const { SessionReportGenerator } = await import('../core/sessionReportGenerator.js');

      // Gather data from DataManager (populated by sync:full)
      const sessionData = this.dataManager.getSessionData();
      const scores = this.dataManager.getScores();
      const transactions = this.dataManager.getTransactions();
      const playerScans = this.dataManager.getPlayerScans();
      const tokenDatabase = this.tokenManager?.database || {};

      if (!sessionData) {
        this.uiManager.showError('No session data available for report.');
        return;
      }

      const generator = new SessionReportGenerator(tokenDatabase);
      const markdown = generator.generate({
        session: sessionData,
        scores,
        transactions,
        playerScans
      });

      // Generate filename
      const date = sessionData.startTime
        ? new Date(sessionData.startTime).toISOString().split('T')[0]
        : 'unknown';
      const safeName = (sessionData.name || 'session')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const filename = `session-report-${safeName}-${date}.md`;

      // Trigger browser download
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.uiManager.showToast('Report downloaded', 'info');
    } catch (error) {
      console.error('Failed to generate session report:', error);
      this.uiManager.showError('Failed to generate report.');
    }
  }
```

**Step 5: Verify data accessor methods exist on DataManager**

The handler calls `getSessionData()`, `getScores()`, `getTransactions()`, and `getPlayerScans()` on the UnifiedDataManager. Check whether these methods exist; if not, add thin accessors that delegate to the active storage strategy's state.

Check `ALNScanner/src/core/unifiedDataManager.js` for these methods. The sync:full handler in NetworkedStorage populates internal state — these accessors expose it.

If any method is missing, add it to `unifiedDataManager.js` as a pass-through. For example:

```javascript
getPlayerScans() {
  return this.strategy?.getPlayerScans?.() || [];
}
```

And the corresponding method on NetworkedStorage.js:

```javascript
getPlayerScans() {
  return this._playerScans || [];
}
```

Where `_playerScans` is populated from `sync:full.playerScans` in the existing sync handler.

**Step 6: Run existing tests to verify no regressions**

Run: `cd ALNScanner && npm test`

Expected: All 926+ tests pass.

**Step 7: Commit**

```bash
cd ALNScanner
git add src/ui/renderers/SessionRenderer.js src/app/app.js src/core/unifiedDataManager.js src/core/storage/NetworkedStorage.js tests/unit/app/app.sessionReport.test.js
git commit -m "feat(report): wire Download Report button into ended session UI"
```

---

## Task 5: Verify Data Accessor Methods on DataManager

**Files:**
- Modify (if needed): `ALNScanner/src/core/unifiedDataManager.js`
- Modify (if needed): `ALNScanner/src/core/storage/NetworkedStorage.js`

**Context:** Task 4's `downloadSessionReport()` calls four methods on `this.dataManager`: `getSessionData()`, `getScores()`, `getTransactions()`, `getPlayerScans()`. These must return the data populated by `sync:full`. This task verifies they exist and adds them if missing.

**Step 1: Check which methods already exist**

Search `ALNScanner/src/core/unifiedDataManager.js` and `ALNScanner/src/core/storage/NetworkedStorage.js` for `getSessionData`, `getScores`, `getTransactions`, `getPlayerScans`.

**Step 2: Add any missing accessor methods**

For each missing method, add a pass-through on `UnifiedDataManager`:

```javascript
methodName() {
  return this.strategy?.methodName?.() || defaultValue;
}
```

And the corresponding implementation on `NetworkedStorage` that returns data from its internal state (populated by `_handleSyncFull()`).

**Step 3: Add corresponding methods to LocalStorage.js (return empty defaults)**

Since session reports are networked-only, LocalStorage accessors should return safe defaults:

```javascript
getPlayerScans() { return []; }
getSessionData() { return null; }
```

**Step 4: Run tests**

Run: `cd ALNScanner && npm test`

Expected: All tests pass.

**Step 5: Commit (if changes were needed)**

```bash
cd ALNScanner
git add src/core/unifiedDataManager.js src/core/storage/NetworkedStorage.js src/core/storage/LocalStorage.js
git commit -m "feat(report): add data accessor methods for session report generation"
```

---

## Task 6: Documentation Updates

**Files:**
- Modify: `CLAUDE.md` (root — Token Data Schema section)
- Modify: `ALNScanner/CLAUDE.md` (add report generator)
- Modify: `ALN-TokenData/CLAUDE.md` (if exists — token schema)

**Step 1: Update root CLAUDE.md Token Data Schema**

In the Token Data Schema section, add `character` field to the JSON example:

```json
{
  "tokenId": {
    "image": "assets/images/{tokenId}.bmp" | null,
    "audio": "assets/audio/{tokenId}.{wav|mp3}" | null,
    "video": "{tokenId}.mp4" | null,
    "processingImage": "assets/images/{tokenId}.bmp" | null,
    "SF_RFID": "tokenId",
    "SF_ValueRating": 1-5,
    "SF_MemoryType": "Personal" | "Business" | "Technical",
    "SF_Group": "Group Name (xN)" | "",
    "summary": "Optional summary text",
    "character": "CHARACTER_NAME" | null
  }
}
```

Add a note in the Data Flow section:
```
character: Resolved from Notion Elements→Characters Owner relation during sync
```

**Step 2: Update ALNScanner/CLAUDE.md**

Add to the Module Responsibilities > Core Layer section:

```
- [sessionReportGenerator.js](src/core/sessionReportGenerator.js) - Markdown session report generator (networked mode, download on session end)
```

Add a brief section under "Admin Panel (Networked Mode Only)":

```
### Session Report (SessionReportGenerator)

When a session ends, the "Download Report" button generates a markdown file containing:
- Session summary (teams, scores, duration, transaction counts)
- Detective Evidence Log (tokens exposed, with Owner and evidence summary)
- Black Market Transactions (tokens buried, with scoring breakdown)
- Player Activity (scan timeline, most active devices, tokens never turned in)

Data sourced entirely from `sync:full` payload + local token database (`data/tokens.json`).
Standalone mode: Not supported (no player scan data available).
```

**Step 3: Update ALN-TokenData CLAUDE.md (if exists)**

Check if `ALN-TokenData/CLAUDE.md` exists. If so, add `character` to the token schema documentation.

**Step 4: Commit**

```bash
git add CLAUDE.md ALNScanner/CLAUDE.md
git commit -m "docs: document session report generator and character token field"
```

---

## Task 7: End-to-End Smoke Test

**Context:** Manual verification that the full flow works: sync token data, start a session, process some transactions, end the session, download the report.

**Step 1: Verify token data has character field**

```bash
python3 -c "
import json
with open('ALN-TokenData/tokens.json') as f:
    data = json.load(f)
with_char = sum(1 for t in data.values() if t.get('character'))
print(f'{with_char}/{len(data)} tokens have character field')
"
```

Expected: Most tokens have a character name.

**Step 2: Run GM Scanner unit tests**

Run: `cd ALNScanner && npm test`

Expected: All tests pass (including new sessionReportGenerator tests).

**Step 3: Run backend unit tests**

Run: `cd backend && npm test`

Expected: All tests pass (no backend changes, but verify no regressions from token data change).

**Step 4: Manual browser test (if backend running)**

1. Start backend: `cd backend && npm run dev:full`
2. Start GM Scanner: `cd ALNScanner && npm run dev`
3. Connect, create session, process a few tokens, end session
4. Click "Download Report" — verify `.md` file downloads with correct content

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address smoke test findings"
```
