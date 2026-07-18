# Scoreboard Evidence Navigation E2E Tests — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add L3 (Backend E2E) test coverage for the GM-driven scoreboard evidence page navigation feature on PR branch `claude/gm-scanner-page-scroll-Vl8ii` (PR #10). These tests validate the three-way integration (GM admin click → backend broadcast → scoreboard DOM transition) that is NOT covered by existing unit + contract tests.

**Architecture:** One new test file (`27-scoreboard-evidence-navigation.test.js`) + one new token-selection helper (`selectDetectiveTokens`) + POM extensions to `ScoreboardPage` and `GMScannerPage`. No changes to production code. Tests run via Playwright with orchestrator lifecycle managed per-test (same pattern as existing `23-scoreboard-live-data.test.js`).

**Tech Stack:** Playwright (E2E runner), Jest-style assertions, Socket.io (scoreboard ↔ backend), plain DOM for scoreboard.html state inspection via `page.evaluate`.

**Current Branch State:**
- Branch: `claude/gm-scanner-page-scroll-Vl8ii`
- ALNScanner submodule pinned at `4e435a4c` (scanner PR #8)
- `backend/public/gm-scanner` is a symlink to `ALNScanner/dist` — rebuild scanner dist if source changes mid-plan
- No pending working-tree changes

**TDD Note (special case):** This plan writes tests for an ALREADY-IMPLEMENTED feature. Each test should PASS on first run. A failing test = a bug in the PR (which is the point — that's what verification means). If a test fails, STOP and diagnose before proceeding.

**Pagination Contract (discovered from `backend/public/scoreboard.html:calculatePages`):**
- Available height = `window.innerHeight − 264`
- Per-owner group = `80 + 40 × entries.length` (single scan = 120px)
- Owners sorted **descending by `lastExposed`** (most recent scan on page 0)
- At 1280×720: ~3 owners/page. At 600×500: ~2 owners/page.

---

## Pre-flight checks (do before Task 1)

Run these from repo root to verify the environment is ready:

```bash
git status                                    # Expect: on branch claude/gm-scanner-page-scroll-Vl8ii, clean tree
git submodule status | head -5                # Expect: ALNScanner at 4e435a4c
ls backend/public/gm-scanner/index.html       # Expect: exists (symlink target present)
```

If any fail → STOP, see "Current Branch State" above for recovery.

---

## Task 1: Add `selectDetectiveTokens` helper

**Files:**
- Modify: `backend/tests/e2e/helpers/token-selection.js` (append function + re-export)

**Context:** The existing `selectTestTokens()` allocates tokens for blackmarket scoring tests (3 tier tokens + group tokens + 5 unique tokens). It does NOT select by `owner` field, which is what our tests need. A standalone helper keeps existing test callers untouched and isolates our requirement (10 distinct-owner tokens with `summary` + scoring fields for deterministic page layouts).

**Step 1: Verify production tokens have sufficient distinct owners**

Run:
```bash
curl -sk https://localhost:3000/api/tokens 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
    const owners=new Set(Object.values(d.tokens).filter(t=>t.owner&&t.summary&&t.SF_MemoryType&&t.SF_ValueRating).map(t=>t.owner)); \
    console.log('Distinct qualifying owners:', owners.size);"
```
Expected: `≥ 10`. If backend not running, start it first (`cd backend && npm run dev:no-video` in another terminal). If count < 10, STOP and investigate token data — feature cannot be tested.

**Step 2: Append the helper to token-selection.js**

Find the existing `module.exports` block at the bottom of `backend/tests/e2e/helpers/token-selection.js` and replace it with:

```javascript
/**
 * Select tokens suitable for scoreboard evidence-navigation testing.
 *
 * Scoreboard evidence pagination is owner-driven (one card per distinct
 * character). Tokens must have: `owner` (populates getExposedOwners),
 * `summary` (renders realistically in evidence entries), and the scoring
 * fields (persists as a detective transaction).
 *
 * Ordering is deterministic by owner name so page layouts are repeatable
 * across test runs at a fixed viewport.
 *
 * @param {string} orchestratorUrl - Backend URL
 * @param {Object} [opts]
 * @param {number} [opts.count=10] - Distinct-owner tokens to return
 * @returns {Promise<Array<Object>>} Tokens, one per unique owner
 * @throws {Error} When fewer than `count` qualifying tokens exist
 */
async function selectDetectiveTokens(orchestratorUrl, { count = 10 } = {}) {
  const tokens = await fetchTokenDatabase(orchestratorUrl);

  const qualifying = Object.values(tokens).filter(t =>
    t.owner && t.summary && t.SF_MemoryType && t.SF_ValueRating
  );

  // Deduplicate by owner. Iterate in a stable tokenId order so "first
  // token per owner" is deterministic regardless of JSON key order.
  const byOwner = new Map();
  for (const t of [...qualifying].sort((a, b) => a.SF_RFID.localeCompare(b.SF_RFID))) {
    if (!byOwner.has(t.owner)) byOwner.set(t.owner, t);
  }

  const selected = [...byOwner.values()]
    .sort((a, b) => a.owner.localeCompare(b.owner))
    .slice(0, count);

  if (selected.length < count) {
    throw new Error(
      `selectDetectiveTokens: need ${count} distinct-owner tokens with ` +
      `summary + scoring fields. Found ${selected.length} ` +
      `(pool: ${qualifying.length}, distinct owners: ${byOwner.size}).`
    );
  }

  console.log(`✓ Selected ${selected.length} detective tokens: ` +
    selected.map(t => `${t.SF_RFID}→${t.owner}`).join(', '));
  return selected;
}

module.exports = {
  selectTestTokens,
  selectDetectiveTokens,
  fetchTokenDatabase,
  findGroupTokens
};
```

**Step 3: Smoke-test the helper via a one-shot script**

Create a temp file `/tmp/test-helper.js`:

```javascript
const { selectDetectiveTokens } = require('./backend/tests/e2e/helpers/token-selection');
selectDetectiveTokens('https://localhost:3000', { count: 10 })
  .then(tokens => {
    console.log('✓', tokens.length, 'distinct owners:', tokens.map(t => t.owner));
    process.exit(0);
  })
  .catch(e => { console.error('✗', e.message); process.exit(1); });
```

Run (requires orchestrator running from Step 1):
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem && NODE_TLS_REJECT_UNAUTHORIZED=0 node /tmp/test-helper.js
```
Expected: `✓ 10 distinct owners: [ 'Alex Reeves', 'Ashe Motoko', ... ]`. Then `rm /tmp/test-helper.js`.

**Step 4: Commit**

```bash
git add backend/tests/e2e/helpers/token-selection.js
git commit -m "test(e2e): add selectDetectiveTokens helper for owner-driven tests

Selects distinct-owner tokens with summary + scoring fields for
scoreboard evidence navigation tests. Deterministic ordering via
owner-name sort enables repeatable page layouts at fixed viewports.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Extend `ScoreboardPage` with state-inspection helpers

**Files:**
- Modify: `backend/tests/e2e/helpers/page-objects/ScoreboardPage.js`

**Context:** Our tests need to observe scoreboard pagination state that is not exposed via the DOM in a clean way (e.g., current page index, total page count, manual-pause timer). The scoreboard's `state` object is declared with `let state = {...}` in a classic (non-module) `<script>` tag, so it is accessible from `page.evaluate` via lexical lookup in the page's global scope.

**Step 1: Verify `state` is reachable from `page.evaluate`**

Run the orchestrator if not already running. Open the scoreboard in a headless Playwright probe:

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && NODE_TLS_REJECT_UNAUTHORIZED=0 node -e "
const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const c = await b.newContext({ ignoreHTTPSErrors: true });
  const p = await c.newPage();
  await p.goto('https://localhost:3000/scoreboard', { waitUntil: 'networkidle' });
  const shape = await p.evaluate(() => ({
    hasState: typeof state !== 'undefined',
    pages: state?.pages?.length,
    currentPage: state?.currentPage,
    manualPauseTimer: state?.manualPauseTimer
  }));
  console.log(JSON.stringify(shape));
  await b.close();
})();
"
```
Expected: `{"hasState":true,"pages":0,"currentPage":0,"manualPauseTimer":null}`. If `hasState:false`, STOP and use `window.__state = state` injection instead (would require small modification to scoreboard.html — flag to user).

**Step 2: Add helper methods to the `ScoreboardPage` class**

Find the comment block `// UTILITIES` near the bottom of `backend/tests/e2e/helpers/page-objects/ScoreboardPage.js` (around line 445). Insert this block immediately BEFORE that comment:

```javascript
  // ============================================
  // EVIDENCE PAGE NAVIGATION (PR #10)
  // ============================================

  /**
   * Get current evidence page index (0-based).
   * @returns {Promise<number>}
   */
  async getCurrentPageIndex() {
    return await this.page.evaluate(() => state.currentPage);
  }

  /**
   * Get total evidence page count.
   * @returns {Promise<number>}
   */
  async getPageCount() {
    return await this.page.evaluate(() => state.pages.length);
  }

  /**
   * Get owner names on the currently-displayed evidence page.
   * @returns {Promise<string[]>}
   */
  async getCurrentPageOwners() {
    return await this.page.evaluate(() => {
      if (!state.pages.length) return [];
      return state.pages[state.currentPage] || [];
    });
  }

  /**
   * Check whether the manual-navigation pause timer is active
   * (set after GM Prev/Next/Jump; cleared after 60s).
   * @returns {Promise<boolean>}
   */
  async isManualPauseActive() {
    return await this.page.evaluate(() => state.manualPauseTimer !== null);
  }

  /**
   * Find the page index containing the given owner, or -1 if absent.
   * @param {string} owner
   * @returns {Promise<number>}
   */
  async findPageContainingOwner(owner) {
    return await this.page.evaluate(
      (o) => state.pages.findIndex(p => p.includes(o)),
      owner
    );
  }

  /**
   * Wait until the scoreboard has computed at least `expected` pages.
   * Pagination recalculates on every transaction:new event.
   * @param {number} expected - Minimum page count
   * @param {number} timeout
   */
  async waitForPageCount(expected, timeout = 15000) {
    await this.page.waitForFunction(
      (n) => state.pages.length >= n,
      expected,
      { timeout }
    );
  }

  /**
   * Wait until the current page index equals `expected`.
   * @param {number} expected - Target page index
   * @param {number} timeout
   */
  async waitForPageIndex(expected, timeout = 5000) {
    await this.page.waitForFunction(
      (n) => state.currentPage === n,
      expected,
      { timeout }
    );
  }

```

**Step 3: Verify the file parses cleanly**

Run:
```bash
cd backend && node -e "require('./tests/e2e/helpers/page-objects/ScoreboardPage.js'); console.log('✓ parses')"
```
Expected: `✓ parses`.

**Step 4: Commit**

```bash
git add backend/tests/e2e/helpers/page-objects/ScoreboardPage.js
git commit -m "test(e2e): add evidence page navigation helpers to ScoreboardPage

Inspect state.currentPage / state.pages / state.manualPauseTimer via
page.evaluate. Enables deterministic assertions on GM-driven page
transitions in PR #10 tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extend `GMScannerPage` with scoreboard evidence controls

**Files:**
- Modify: `backend/tests/e2e/helpers/page-objects/GMScannerPage.js`

**Context:** The PR adds a new admin panel section (`#scoreboard-evidence-section`) with Prev/Next/Jump buttons + owner dropdown. Tests need to click these and observe their disabled state + dropdown contents.

**Step 1: Add locators to the constructor**

Find the constructor block that ends with `// Phase 2: Game Clock, Active Cues, Spotify (MonitoringDisplay)` section (around line 187-190). Insert this block immediately AFTER the `this.nowPlayingSection` line (around line 190, before the closing `}` of the constructor):

```javascript

    // Scoreboard Evidence Navigation (PR #10 - Admin panel)
    this.scoreboardEvidenceSection = page.locator('#scoreboard-evidence-section');
    this.scoreboardEvidenceHint = page.locator('#scoreboard-evidence-hint');
    this.scoreboardPrevBtn = page.locator('#scoreboard-prev-btn');
    this.scoreboardNextBtn = page.locator('#scoreboard-next-btn');
    this.scoreboardJumpBtn = page.locator('#scoreboard-jump-btn');
    this.scoreboardOwnerDropdown = page.locator('#scoreboard-owner-dropdown');
```

**Step 2: Add control methods**

Find the last method in the class (near the closing `}` of the class, currently `isScoreboardActive()` or similar around line 830). Insert this block AFTER the last method and BEFORE the final `}` that closes the class:

```javascript

  // ============================================
  // SCOREBOARD EVIDENCE NAVIGATION (PR #10)
  // ============================================

  /**
   * Read enabled/disabled state of all four scoreboard evidence controls.
   * @returns {Promise<{prev: boolean, next: boolean, jump: boolean, dropdown: boolean}>}
   */
  async scoreboardControlsEnabled() {
    return {
      prev: !(await this.scoreboardPrevBtn.isDisabled()),
      next: !(await this.scoreboardNextBtn.isDisabled()),
      jump: !(await this.scoreboardJumpBtn.isDisabled()),
      dropdown: !(await this.scoreboardOwnerDropdown.isDisabled()),
    };
  }

  /**
   * Read all owner values in the Jump-to-Character dropdown
   * (excludes the empty placeholder option).
   * @returns {Promise<string[]>}
   */
  async scoreboardDropdownOptions() {
    return await this.scoreboardOwnerDropdown.evaluate(sel =>
      Array.from(sel.options).map(o => o.value).filter(v => v !== '')
    );
  }

  /**
   * Click Next on the scoreboard evidence nav.
   */
  async clickScoreboardNext() {
    await this.scoreboardNextBtn.click();
  }

  /**
   * Click Prev on the scoreboard evidence nav.
   */
  async clickScoreboardPrev() {
    await this.scoreboardPrevBtn.click();
  }

  /**
   * Select an owner from the dropdown and click Jump.
   * @param {string} owner - Character owner name (must be a dropdown option)
   */
  async jumpScoreboardToOwner(owner) {
    await this.scoreboardOwnerDropdown.selectOption(owner);
    await this.scoreboardJumpBtn.click();
  }

  /**
   * Wait until an owner appears in the dropdown.
   * @param {string} owner
   * @param {number} timeout
   */
  async waitForScoreboardOwner(owner, timeout = 10000) {
    await this.page.waitForFunction(
      (o) => {
        const dd = document.getElementById('scoreboard-owner-dropdown');
        if (!dd) return false;
        return Array.from(dd.options).some(opt => opt.value === o);
      },
      owner,
      { timeout }
    );
  }

```

**Step 3: Verify the file parses cleanly**

```bash
cd backend && node -e "require('./tests/e2e/helpers/page-objects/GMScannerPage.js'); console.log('✓ parses')"
```
Expected: `✓ parses`.

**Step 4: Commit**

```bash
git add backend/tests/e2e/helpers/page-objects/GMScannerPage.js
git commit -m "test(e2e): add scoreboard evidence nav helpers to GMScannerPage

Locators + click/inspect methods for the PR #10 admin panel section
(#scoreboard-evidence-section): Prev/Next/Jump buttons + owner dropdown.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create test file scaffold + Test 1 (controls disabled)

**Files:**
- Create: `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js`

**Context:** This is the first test — simplest case, minimal setup (just GM scanner, no scoreboard browser). Establishes the test file structure.

**Step 1: Write the test file**

Create `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js` with:

```javascript
/**
 * E2E Test: Scoreboard Evidence Navigation (PR #10)
 *
 * Validates the three-way integration not covered by unit + contract:
 *   GM admin panel click → backend broadcast → scoreboard DOM transition
 *
 * Unit tests prove command construction and renderer behavior in isolation.
 * Contract tests prove the backend broadcasts the right envelope.
 * These tests prove the wiring end-to-end, including the viewport-
 * independence claim (same owner jump reaches differently-paginated
 * scoreboards).
 *
 * Architecture note: tests share one orchestrator instance per test (same
 * pattern as 23-scoreboard-live-data.test.js). Each test restarts the
 * orchestrator in afterEach to reset session state.
 *
 * @group scoreboard
 */

const { test, expect, chromium } = require('@playwright/test');
const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectDetectiveTokens } = require('../helpers/token-selection');
const { ScoreboardPage } = require('../helpers/page-objects/ScoreboardPage');

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => !isMobile, 'Scoreboard nav tests only run on mobile-chrome project');

const TEAM = 'Evidence Team';
const LARGE_VIEWPORT = { width: 1280, height: 720 };  // ~3 owners/page
const SMALL_VIEWPORT = { width: 600, height: 500 };    // ~1-2 owners/page

let browser = null;
let orchestratorInfo = null;
let detectiveTokens = null;

test.describe('Scoreboard Evidence Navigation (GM-driven)', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors'
      ]
    });
    detectiveTokens = await selectDetectiveTokens(orchestratorInfo.url, { count: 10 });
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
  });

  test.afterEach(async () => {
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
  });

  // Shared helper: scan all detective tokens for one team.
  // Caller is responsible for being on the scan screen.
  async function scanAllTokens(gmScanner, tokens = detectiveTokens) {
    for (let i = 0; i < tokens.length; i++) {
      await gmScanner.manualScan(tokens[i].SF_RFID);
      await gmScanner.waitForResult();
      if (i < tokens.length - 1) await gmScanner.continueScan();
    }
  }

  // ====================================================
  // TEST 1: Controls disabled with no evidence
  // ====================================================

  test('admin controls are disabled when no detective evidence exists', async () => {
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const gmPage = await createPage(gmContext);

    try {
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Controls Disabled Test', [TEAM]);
      await gmScanner.navigateToAdminPanel();

      // Section itself must be visible (networked mode)
      await expect(gmScanner.scoreboardEvidenceSection).toBeVisible();

      const state = await gmScanner.scoreboardControlsEnabled();
      expect(state.prev).toBe(false);
      expect(state.next).toBe(false);
      expect(state.jump).toBe(false);
      expect(state.dropdown).toBe(false);

      const hint = await gmScanner.scoreboardEvidenceHint.textContent();
      expect(hint.trim()).toBe('Awaiting evidence...');

      const options = await gmScanner.scoreboardDropdownOptions();
      expect(options).toEqual([]);
    } finally {
      await gmPage.close();
      await gmContext.close();
    }
  });

});
```

**Step 2: Run the new test**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome 2>&1 | tail -40
```
Expected: `1 passed`. If fails, diagnose (log output, selectors) before proceeding.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js
git commit -m "test(e2e): scaffold scoreboard evidence nav tests + Test 1

Test 1 verifies Prev/Next/Jump/Dropdown are all disabled when the
session has no detective transactions, and the 'Awaiting evidence'
hint is displayed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Test 2 — Dropdown populates after detective scan

**Files:**
- Modify: `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js` (append test)

**Step 1: Append Test 2 after Test 1**

Insert BEFORE the final `});` (closing the `test.describe`):

```javascript

  // ====================================================
  // TEST 2: Detective scan populates dropdown + enables controls
  // ====================================================

  test('detective scan enables controls and populates owner dropdown', async () => {
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const gmPage = await createPage(gmContext);

    try {
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Dropdown Populate Test', [TEAM]);

      // Scan ONE detective token
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);

      const token = detectiveTokens[0];
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult();

      // Navigate to admin panel and verify the owner appears in the dropdown
      await gmScanner.navigateToAdminPanel();
      await gmScanner.waitForScoreboardOwner(token.owner, 10000);

      const options = await gmScanner.scoreboardDropdownOptions();
      expect(options).toEqual([token.owner]);

      const state = await gmScanner.scoreboardControlsEnabled();
      expect(state.prev).toBe(true);
      expect(state.next).toBe(true);
      expect(state.jump).toBe(true);
      expect(state.dropdown).toBe(true);

      const hint = await gmScanner.scoreboardEvidenceHint.textContent();
      expect(hint.trim()).toMatch(/1 character on board/);
    } finally {
      await gmPage.close();
      await gmContext.close();
    }
  });
```

**Step 2: Run — only the new test**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome -g "detective scan enables" 2>&1 | tail -30
```
Expected: `1 passed`.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js
git commit -m "test(e2e): Test 2 — dropdown populates after detective scan

One detective scan should un-disable all four controls and add the
scanned token's owner to the Jump dropdown, with hint showing
'1 character on board'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Test 3 — Next/Prev navigate pages, including wraparound

**Files:**
- Modify: `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js`

**Context:** Scan 10 tokens at small viewport (forces 5+ pages), open the scoreboard, then click Next/Prev from GM. Assertions use `waitForPageIndex` (polls `state.currentPage`) — not page-dot DOM — for robustness.

**Step 1: Append Test 3**

Insert BEFORE the final `});`:

```javascript

  // ====================================================
  // TEST 3: Next/Prev navigate scoreboard pages
  // ====================================================

  test('Next and Prev advance the scoreboard through evidence pages', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Nav Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);

      // Wait for pagination to settle (≥3 pages expected at 600x500 with 10 owners)
      await scoreboard.waitForPageCount(3, 20000);
      const pageCount = await scoreboard.getPageCount();
      console.log(`Scoreboard at ${SMALL_VIEWPORT.width}x${SMALL_VIEWPORT.height} produced ${pageCount} pages`);
      expect(pageCount).toBeGreaterThanOrEqual(3);

      // Confirm starting page is 0 (initial render)
      expect(await scoreboard.getCurrentPageIndex()).toBe(0);

      // GM navigates
      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickScoreboardNext();
      await scoreboard.waitForPageIndex(1);

      await gmScanner.clickScoreboardNext();
      await scoreboard.waitForPageIndex(2);

      await gmScanner.clickScoreboardPrev();
      await scoreboard.waitForPageIndex(1);

      // Wraparound: Prev from page 0 goes to last page
      await gmScanner.clickScoreboardPrev();  // 1 → 0
      await scoreboard.waitForPageIndex(0);
      await gmScanner.clickScoreboardPrev();  // 0 → last
      await scoreboard.waitForPageIndex(pageCount - 1);
    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
```

**Step 2: Run the new test**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome -g "Next and Prev" 2>&1 | tail -40
```
Expected: `1 passed`. If pagination doesn't reach 3 pages, check the small-viewport calculation (`600 - 264 = 336 available`, `120px/owner` = ~2/page, 10 owners = 5 pages).

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js
git commit -m "test(e2e): Test 3 — Next/Prev navigate evidence pages

Scan 10 distinct-owner detective tokens at small viewport (forces ≥3
pages). Verify Next advances 0→1→2, Prev returns 2→1→0, and Prev
from page 0 wraps to the last page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Test 4 — Jump to owner

**Files:**
- Modify: `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js`

**Step 1: Append Test 4**

Insert BEFORE the final `});`:

```javascript

  // ====================================================
  // TEST 4: Jump to owner lands on that character's page
  // ====================================================

  test('Jump-to-Character navigates scoreboard to the page containing that owner', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Jump Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);

      await scoreboard.waitForPageCount(3, 20000);

      // Pick a token whose owner is NOT on page 0 (forces a real jump).
      // Most-recently-scanned owner is on page 0 (sorted descending by
      // lastExposed). Use the first-scanned owner (oldest → last page).
      const targetOwner = detectiveTokens[0].owner;
      const targetPage = await scoreboard.findPageContainingOwner(targetOwner);
      expect(targetPage).toBeGreaterThan(0);

      await gmScanner.navigateToAdminPanel();
      await gmScanner.waitForScoreboardOwner(targetOwner);
      await gmScanner.jumpScoreboardToOwner(targetOwner);

      await scoreboard.waitForPageIndex(targetPage);
      const owners = await scoreboard.getCurrentPageOwners();
      expect(owners).toContain(targetOwner);
    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
```

**Step 2: Run the new test**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome -g "Jump-to-Character" 2>&1 | tail -30
```
Expected: `1 passed`.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js
git commit -m "test(e2e): Test 4 — Jump to owner lands on correct page

Select the first-scanned owner (oldest, so not on page 0), jump
via dropdown + button, assert scoreboard currentPage contains them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Test 5 — Viewport-independent owner jump (THE key test)

**Files:**
- Modify: `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js`

**Context:** This is the test that replaces the PR's "manual two-scoreboard smoke". Two scoreboards at different viewports compute different page layouts. A single GM owner-jump should land BOTH on a page containing the owner (different page indices is fine; what matters is the owner is visible on each).

**Step 1: Append Test 5**

Insert BEFORE the final `});`:

```javascript

  // ====================================================
  // TEST 5: Viewport-independent owner jump
  //         (validates PR #10's "owner keeps both aligned" claim)
  // ====================================================

  test('owner jump lands both differently-sized scoreboards on pages containing the owner', async () => {
    const largeCtx = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: LARGE_VIEWPORT
    });
    const smallCtx = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const largePage = await createPage(largeCtx);
    const smallPage = await createPage(smallCtx);
    const gmPage = await createPage(gmContext);
    const sbLarge = new ScoreboardPage(largePage);
    const sbSmall = new ScoreboardPage(smallPage);

    try {
      // Unique device IDs so both scoreboards can coexist.
      await sbLarge.gotoWithDeviceId(orchestratorInfo.url, 'SCOREBOARD_LARGE');
      await sbLarge.waitForConnection(10000);
      await sbSmall.gotoWithDeviceId(orchestratorInfo.url, 'SCOREBOARD_SMALL');
      await sbSmall.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Viewport Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);

      await sbLarge.waitForPageCount(2, 20000);
      await sbSmall.waitForPageCount(3, 20000);

      const largePages = await sbLarge.getPageCount();
      const smallPages = await sbSmall.getPageCount();
      console.log(`Large viewport: ${largePages} pages, Small viewport: ${smallPages} pages`);
      // Different page counts is the whole point of this test.
      expect(smallPages).toBeGreaterThan(largePages);

      // Pick an owner that is NOT on page 0 of EITHER scoreboard (oldest).
      const targetOwner = detectiveTokens[0].owner;
      const largeTargetPage = await sbLarge.findPageContainingOwner(targetOwner);
      const smallTargetPage = await sbSmall.findPageContainingOwner(targetOwner);
      expect(largeTargetPage).toBeGreaterThanOrEqual(0);
      expect(smallTargetPage).toBeGreaterThanOrEqual(0);

      await gmScanner.navigateToAdminPanel();
      await gmScanner.waitForScoreboardOwner(targetOwner);
      await gmScanner.jumpScoreboardToOwner(targetOwner);

      // Both scoreboards must land on a page containing the owner.
      // The page INDICES may differ (viewport independence) — we assert
      // containment, not equality.
      await sbLarge.waitForPageIndex(largeTargetPage);
      await sbSmall.waitForPageIndex(smallTargetPage);

      const largeOwners = await sbLarge.getCurrentPageOwners();
      const smallOwners = await sbSmall.getCurrentPageOwners();
      expect(largeOwners).toContain(targetOwner);
      expect(smallOwners).toContain(targetOwner);

      // If the target is on different pages between the two, we've
      // proved viewport independence. If both happen to be index 0,
      // the test still validates the contract.
      if (largeTargetPage !== smallTargetPage) {
        console.log(`✓ Viewport drift confirmed: large p${largeTargetPage} vs small p${smallTargetPage}`);
      }
    } finally {
      await largePage.close();
      await smallPage.close();
      await gmPage.close();
      await largeCtx.close();
      await smallCtx.close();
      await gmContext.close();
    }
  });
```

**Step 2: Run the new test**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome -g "viewport-independent" 2>&1 | tail -40
```
Expected: `1 passed`. Watch for the `✓ Viewport drift confirmed` log — proves we exercised the interesting path.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js
git commit -m "test(e2e): Test 5 — viewport-independent owner jump

Two scoreboards at 1280x720 and 600x500 produce different page counts.
A single GM owner-jump lands both on a page containing the owner
(page indices may differ). This replaces the PR #10 manual two-
scoreboard smoke test.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Test 6 — Auto-cycle pauses after manual navigation

**Files:**
- Modify: `backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js`

**Context:** `MANUAL_PAUSE_MS = 60000` in scoreboard.html. Rather than wait 60s, we inspect `state.manualPauseTimer` (set on manual nav, cleared after 60s) AND verify no auto-advance during a 15s observation window (longer than the 12-18s normal cycle interval).

**Step 1: Append Test 6**

Insert BEFORE the final `});`:

```javascript

  // ====================================================
  // TEST 6: Auto-cycle pauses after manual navigation
  // ====================================================

  test('manual navigation suspends the auto-cycle timer', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Pause Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);
      await scoreboard.waitForPageCount(3, 20000);

      // Pre-manual: manualPauseTimer is null, auto-cycle is running
      expect(await scoreboard.isManualPauseActive()).toBe(false);

      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickScoreboardNext();
      await scoreboard.waitForPageIndex(1);

      // Post-manual: manualPauseTimer MUST be active
      expect(await scoreboard.isManualPauseActive()).toBe(true);

      // Observe for 15s — longer than the 12-18s auto-cycle interval.
      // Page index must NOT change.
      await sbPage.waitForTimeout(15000);
      expect(await scoreboard.getCurrentPageIndex()).toBe(1);
      expect(await scoreboard.isManualPauseActive()).toBe(true);
    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
```

**Step 2: Run the new test**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome -g "manual navigation suspends" 2>&1 | tail -30
```
Expected: `1 passed`. Runtime includes the 15s observation window + setup — expect ~60-75s for this test alone.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/27-scoreboard-evidence-navigation.test.js
git commit -m "test(e2e): Test 6 — manual navigation suspends auto-cycle

Verify state.manualPauseTimer is set after a GM Next/Prev click, and
the page index does not advance during a 15s observation window
(longer than the 12-18s normal auto-cycle interval).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Run the full suite + push

**Step 1: Run the entire new test file**

```bash
cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome 2>&1 | tail -60
```
Expected: `6 passed`. Total runtime: ~5-8 minutes.

If any test fails in isolation-run context but passed individually, diagnose:
- State leakage between tests (afterEach orchestrator restart is the backstop)
- Submodule dist staleness (re-run `cd ALNScanner && npm run build` at repo root then retry)

**Step 2: Run the full E2E suite to confirm no regressions**

```bash
cd backend && npm run test:e2e 2>&1 | tail -30
```
Expected: previous baseline (121 passed, 28 skipped) + 6 new = **127 passed, 28 skipped**. Investigate any previously-passing test that fails.

**Step 3: Push the branch**

```bash
git push origin claude/gm-scanner-page-scroll-Vl8ii
```
Expected: PR #10 picks up the new commits automatically.

**Step 4: Report to user**

Report:
- Number of new tests added (6)
- Full E2E suite pass count before/after
- Any surprising findings (e.g., viewport-drift confirmed / not confirmed in Test 5)
- Readiness for merge

---

## Rollback

If the tests expose a bug in the PR:
1. `git log --oneline` — identify the test commit that caught it
2. Do NOT revert the test commits. Instead, fix the bug in the PR code.
3. If the bug is in our test (not the PR), fix the test and amend the commit.
4. Re-run: `cd backend && npm run test:e2e -- tests/e2e/flows/27-scoreboard-evidence-navigation.test.js --project=mobile-chrome`

If Task 1 Step 1 reports `< 10 distinct owners`:
- The production token database has regressed. Either (a) lower `count` to what's available (min 5 will still give multi-page layouts at small viewport), or (b) STOP and fix token data first. Do not proceed with a lower count without user confirmation.
