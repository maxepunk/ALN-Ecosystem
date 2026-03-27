/**
 * Page Object Model for Public Scoreboard Display
 *
 * Encapsulates DOM interactions for the public scoreboard viewer.
 * Uses Playwright locators and web-first assertions.
 *
 * ARCHITECTURE:
 * - Single-page display optimized for TV/monitor
 * - Real-time updates via WebSocket
 * - Detective mode evidence cards + Black Market scores
 */

class ScoreboardPage {
  constructor(page) {
    this.page = page;

    // Connection status
    this.connectionStatus = page.locator('#connectionStatus');
    this.statusText = page.locator('#statusText');

    // Evidence page (detective mode discoveries, grouped by character/owner)
    // The scoreboard groups detective evidence by owner into .character-group cards.
    // Each group has .character-group__entry children for individual token exposures.
    // The page container (#evidencePage) shows .evidence-empty when nothing is exposed.
    this.evidencePage = page.locator('#evidencePage');
    this.evidenceContent = page.locator('#evidenceContent');
    this.evidenceGroups = page.locator('.character-group');
    this.evidenceEntries = page.locator('.character-group__entry');
    this.evidenceEmpty = page.locator('.evidence-empty');

    // Legacy locator aliases (kept for compatibility — point to real DOM selectors)
    this.heroEvidence = page.locator('#evidencePage');
    this.heroEvidenceActive = page.locator('.character-group');
    this.heroEvidenceEmpty = page.locator('.evidence-empty');
    this.heroEvidenceTeam = page.locator('.character-group__name');
    this.heroEvidenceText = page.locator('.character-group__entry');
    this.heroEvidenceTime = page.locator('.character-group__timestamp');
    this.evidenceFeed = page.locator('#evidenceContent');
    this.evidenceCards = page.locator('.character-group__entry');
    this.evidenceFeedEmpty = page.locator('.evidence-empty');

    // Score ticker (Black Market rankings)
    // The ticker uses .ticker-entry[data-team] elements inside #tickerContent.
    this.scoreTicker = page.locator('#scoreTicker');
    this.tickerContent = page.locator('#tickerContent');
    this.tickerEntries = page.locator('#tickerContent');
    this.scoreEntries = page.locator('.ticker-entry');
    this.tickerEmpty = page.locator('.ticker-empty');

    // Overlays
    this.displayModeOverlay = page.locator('#displayModeOverlay');
    this.loadingIndicator = page.locator('#loadingIndicator');
    this.flashOverlay = page.locator('#flashOverlay');

    // Timestamp display
    this.timestamp = page.locator('#timestamp');
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to the scoreboard page
   * @param {string} baseUrl - Orchestrator base URL
   */
  async goto(baseUrl) {
    const url = `${baseUrl}/scoreboard`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Navigate with custom device ID (useful for multi-display tests)
   * @param {string} baseUrl - Orchestrator base URL
   * @param {string} deviceId - Custom device identifier
   */
  async gotoWithDeviceId(baseUrl, deviceId) {
    const url = `${baseUrl}/scoreboard?deviceId=${deviceId}`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Navigate in kiosk mode (primary HDMI display)
   * @param {string} baseUrl - Orchestrator base URL
   */
  async gotoKiosk(baseUrl) {
    const url = `${baseUrl}/scoreboard?kiosk=true`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  // ============================================
  // CONNECTION STATUS
  // ============================================

  /**
   * Wait for WebSocket connection to be established
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForConnection(timeout = 30000) {
    await this.statusText.filter({ hasText: 'LIVE' }).waitFor({ state: 'visible', timeout });
  }

  /**
   * Check if scoreboard is connected
   * @returns {Promise<boolean>}
   */
  async isConnected() {
    const text = await this.statusText.textContent();
    return text === 'LIVE';
  }

  /**
   * Get the current connection status text
   * @returns {Promise<string>} - 'LIVE', 'OFFLINE', or 'CONNECTING'
   */
  async getStatusText() {
    return await this.statusText.textContent();
  }

  /**
   * Get the connection status class (connected, disconnected, connecting)
   * @returns {Promise<string>}
   */
  async getConnectionClass() {
    const className = await this.connectionStatus.getAttribute('class');
    if (className.includes('connected')) return 'connected';
    if (className.includes('disconnected')) return 'disconnected';
    if (className.includes('connecting')) return 'connecting';
    return 'unknown';
  }

  // ============================================
  // HERO EVIDENCE (Latest Discovery)
  // ============================================

  /**
   * Check if any evidence group is displaying (not empty state)
   * @returns {Promise<boolean>}
   */
  async hasHeroEvidence() {
    return await this.evidenceGroups.count() > 0;
  }

  /**
   * Wait for at least one evidence group to appear
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForHeroEvidence(timeout = 10000) {
    await this.evidenceGroups.first().waitFor({ state: 'visible', timeout });
  }

  /**
   * Get first evidence group details
   * @returns {Promise<{team: string, text: string, time: string}>}
   */
  async getHeroEvidenceDetails() {
    const firstGroup = this.evidenceGroups.first();
    return {
      team: await firstGroup.locator('.character-group__name').textContent(),
      text: await firstGroup.locator('.character-group__entry').first().textContent(),
      time: await firstGroup.locator('.character-group__timestamp').first().textContent()
    };
  }

  // ============================================
  // EVIDENCE FEED (Detective Mode)
  // ============================================

  /**
   * Get count of individual evidence entries across all character groups.
   * Each detective-mode transaction adds one entry inside a character-group card.
   * @returns {Promise<number>}
   */
  async getEvidenceCardCount() {
    return await this.evidenceEntries.count();
  }

  /**
   * Wait for evidence entries to appear.
   * Each detective transaction generates one .character-group__entry in the evidence page.
   * @param {number} expectedCount - Minimum number of evidence entries expected
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForEvidenceCards(expectedCount = 1, timeout = 10000) {
    await this.page.waitForFunction(
      (count) => document.querySelectorAll('.character-group__entry').length >= count,
      expectedCount,
      { timeout }
    );
  }

  /**
   * Wait for evidence entries to reach the expected count.
   * The scoreboard groups detective evidence by character (owner) into .character-group cards.
   * Each exposed token adds one .character-group__entry. Total evidence = entry count.
   * @param {number} expectedTotal - Total evidence entries expected
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForTotalEvidence(expectedTotal = 1, timeout = 10000) {
    await this.page.waitForFunction(
      (count) => {
        // Count individual evidence entries (one per exposed token)
        const entryCount = document.querySelectorAll('.character-group__entry').length;
        return entryCount >= count;
      },
      expectedTotal,
      { timeout }
    );
  }

  /**
   * Get total evidence entry count.
   * @returns {Promise<number>}
   */
  async getTotalEvidenceCount() {
    return await this.evidenceEntries.count();
  }

  /**
   * Check if evidence is empty (no characters exposed)
   * @returns {Promise<boolean>}
   */
  async isEvidenceFeedEmpty() {
    return await this.evidenceEmpty.isVisible();
  }

  /**
   * Get all evidence entry details from all character groups
   * @returns {Promise<Array<{owner: string, text: string, time: string}>>}
   */
  async getAllEvidenceCards() {
    const groups = await this.evidenceGroups.all();
    const details = [];
    for (const group of groups) {
      const owner = await group.locator('.character-group__name').textContent();
      const entries = await group.locator('.character-group__entry').all();
      for (const entry of entries) {
        details.push({
          team: owner.trim(),
          text: await entry.textContent(),
          time: await entry.locator('.character-group__timestamp').textContent().catch(() => '')
        });
      }
    }
    return details;
  }

  /**
   * Find evidence entry by text content
   * @param {string} searchText - Text to search for in evidence entries
   * @returns {Promise<boolean>} - True if found
   */
  async hasEvidenceContaining(searchText) {
    const count = await this.evidenceEntries.filter({ hasText: searchText }).count();
    return count > 0;
  }

  // ============================================
  // SCORE TICKER (Black Market Mode)
  // ============================================

  /**
   * Get count of score entries displayed in the ticker.
   * Entries use .ticker-entry[data-team] in the actual scoreboard DOM.
   * @returns {Promise<number>}
   */
  async getScoreEntryCount() {
    return await this.scoreEntries.count();
  }

  /**
   * Wait for score entries to appear in the ticker.
   * @param {number} expectedCount - Minimum number of entries expected
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForScoreEntries(expectedCount = 1, timeout = 10000) {
    await this.page.waitForFunction(
      (count) => document.querySelectorAll('.ticker-entry').length >= count,
      expectedCount,
      { timeout }
    );
  }

  /**
   * Check if score ticker is empty (shows "No scores recorded")
   * @returns {Promise<boolean>}
   */
  async isScoreTickerEmpty() {
    return await this.tickerEmpty.isVisible();
  }

  /**
   * Get team score from ticker by team ID.
   * Actual DOM: .ticker-entry[data-team="..."] .ticker-entry__score
   * @param {string} teamId - Team identifier
   * @returns {Promise<string|null>} - Score text (e.g., "$1,500") or null if not found
   */
  async getTeamScore(teamId) {
    const entry = this.page.locator(`.ticker-entry[data-team="${teamId}"]`);
    const count = await entry.count();
    if (count === 0) return null;
    return await entry.first().locator('.ticker-entry__score').textContent();
  }

  /**
   * Get team score as numeric value
   * @param {string} teamId - Team identifier
   * @returns {Promise<number|null>} - Score as number or null if not found
   */
  async getTeamScoreNumeric(teamId) {
    const scoreText = await this.getTeamScore(teamId);
    if (!scoreText) return null;
    // Parse "$1,500" -> 1500
    return parseInt(scoreText.replace(/[$,]/g, ''), 10);
  }

  /**
   * Get team rank from ticker by team ID.
   * Actual DOM: .ticker-entry[data-team="..."] .ticker-entry__rank
   * @param {string} teamId - Team identifier
   * @returns {Promise<number|null>} - Rank (1-based) or null if not found
   */
  async getTeamRank(teamId) {
    const entry = this.page.locator(`.ticker-entry[data-team="${teamId}"]`);
    const count = await entry.count();
    if (count === 0) return null;
    const rankText = await entry.first().locator('.ticker-entry__rank').textContent();
    // Rank is rendered as "#1", strip the "#"
    return parseInt(rankText.replace('#', ''), 10);
  }

  /**
   * Check if a team appears in the score ticker.
   * Actual DOM: .ticker-entry[data-team="..."]
   * @param {string} teamId - Team identifier
   * @returns {Promise<boolean>}
   */
  async hasTeamInScores(teamId) {
    const entry = this.page.locator(`.ticker-entry[data-team="${teamId}"]`);
    return await entry.isVisible();
  }

  /**
   * Wait for a specific team to appear in scores
   * @param {string} teamId - Team identifier
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForTeamInScores(teamId, timeout = 10000) {
    await this.page.locator(`.ticker-entry[data-team="${teamId}"]`).waitFor({ state: 'visible', timeout });
  }

  /**
   * Get all score entries sorted by rank
   * @returns {Promise<Array<{rank: number, team: string, score: string}>>}
   */
  async getAllScoreEntries() {
    // Only get the first set (ticker doubles content for scrolling, avoid duplicates)
    const entries = await this.scoreEntries.all();
    const seen = new Set();
    const details = [];
    for (const entry of entries) {
      const team = await entry.getAttribute('data-team');
      if (team && seen.has(team)) continue; // Skip duplicated scroll entries
      seen.add(team);
      const rankText = await entry.locator('.ticker-entry__rank').textContent();
      details.push({
        rank: parseInt(rankText.replace('#', ''), 10),
        team: await entry.locator('.ticker-entry__name').textContent(),
        score: await entry.locator('.ticker-entry__score').textContent()
      });
    }
    return details.sort((a, b) => a.rank - b.rank);
  }

  // ============================================
  // OVERLAYS & LOADING
  // ============================================

  /**
   * Check if display mode overlay is visible (video playing indication)
   * @returns {Promise<boolean>}
   */
  async isVideoOverlayVisible() {
    return await this.displayModeOverlay.isVisible();
  }

  /**
   * Check if loading indicator is visible
   * @returns {Promise<boolean>}
   */
  async isLoading() {
    return await this.loadingIndicator.isVisible();
  }

  /**
   * Wait for loading to complete
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForLoadingComplete(timeout = 10000) {
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout });
  }

  // ============================================
  // REAL-TIME UPDATE HELPERS
  // ============================================

  /**
   * Wait for a score update to be reflected on screen.
   * Actual DOM: .ticker-entry[data-team="..."] .ticker-entry__score
   * @param {string} teamId - Team to watch
   * @param {number} expectedScore - Expected score value
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForScoreUpdate(teamId, expectedScore, timeout = 10000) {
    await this.page.waitForFunction(
      ({ team, score }) => {
        const entry = document.querySelector(`.ticker-entry[data-team="${team}"]`);
        if (!entry) return false;
        const amountEl = entry.querySelector('.ticker-entry__score');
        if (!amountEl) return false;
        const currentScore = parseInt(amountEl.textContent.replace(/[$,]/g, ''), 10);
        return currentScore >= score;
      },
      { team: teamId, score: expectedScore },
      { timeout }
    );
  }

  /**
   * Wait for new evidence entries to appear (count increases).
   * Counts .character-group__entry elements in the evidence page.
   * @param {number} previousCount - Previous evidence entry count
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForNewEvidence(previousCount, timeout = 10000) {
    await this.page.waitForFunction(
      (prevCount) => document.querySelectorAll('.character-group__entry').length > prevCount,
      previousCount,
      { timeout }
    );
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Take a screenshot of the scoreboard
   * @param {string} name - Screenshot name
   */
  async screenshot(name) {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Get the page title
   * @returns {Promise<string>}
   */
  async getTitle() {
    return await this.page.title();
  }
}

module.exports = { ScoreboardPage };
