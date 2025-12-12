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

    // Hero evidence card (latest discovery)
    this.heroEvidence = page.locator('#heroEvidence');
    this.heroEvidenceActive = page.locator('#heroEvidence:not(.empty)');
    this.heroEvidenceEmpty = page.locator('#heroEvidence.empty');
    this.heroEvidenceTeam = page.locator('#heroEvidence .hero-evidence__team');
    this.heroEvidenceText = page.locator('#heroEvidence .hero-evidence__summary');
    this.heroEvidenceTime = page.locator('#heroEvidence .hero-evidence__time');

    // Evidence feed grid (detective mode discoveries)
    this.evidenceFeed = page.locator('#evidenceFeed');
    this.evidenceCards = page.locator('.evidence-card');
    this.evidenceFeedEmpty = page.locator('.evidence-feed-empty');

    // Score ticker (Black Market rankings)
    this.scoreTicker = page.locator('#scoreTicker');
    this.tickerEntries = page.locator('#tickerEntries');
    this.scoreEntries = page.locator('.score-entry');
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
   * Check if hero evidence is displaying (not empty)
   * @returns {Promise<boolean>}
   */
  async hasHeroEvidence() {
    return await this.heroEvidenceActive.isVisible();
  }

  /**
   * Wait for hero evidence to appear
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForHeroEvidence(timeout = 10000) {
    await this.heroEvidenceActive.waitFor({ state: 'visible', timeout });
  }

  /**
   * Get hero evidence details
   * @returns {Promise<{team: string, text: string, time: string}>}
   */
  async getHeroEvidenceDetails() {
    return {
      team: await this.heroEvidenceTeam.textContent(),
      text: await this.heroEvidenceText.textContent(),
      time: await this.heroEvidenceTime.textContent()
    };
  }

  // ============================================
  // EVIDENCE FEED (Detective Mode)
  // ============================================

  /**
   * Get count of evidence cards in the feed
   * @returns {Promise<number>}
   */
  async getEvidenceCardCount() {
    return await this.evidenceCards.count();
  }

  /**
   * Wait for evidence cards to appear in feed
   * Note: This only counts FEED cards, not the hero evidence
   * @param {number} expectedCount - Minimum number of feed cards expected
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForEvidenceCards(expectedCount = 1, timeout = 10000) {
    await this.page.waitForFunction(
      (count) => document.querySelectorAll('.evidence-card').length >= count,
      expectedCount,
      { timeout }
    );
  }

  /**
   * Wait for total evidence (hero + feed) to reach expected count
   * The scoreboard displays evidence as: 1 hero card + N feed cards
   * So total evidence = (hasHero ? 1 : 0) + feedCardCount
   * @param {number} expectedTotal - Total evidence entries expected
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForTotalEvidence(expectedTotal = 1, timeout = 10000) {
    await this.page.waitForFunction(
      (count) => {
        // Count hero evidence (not empty)
        const heroEl = document.querySelector('#heroEvidence');
        const hasHero = heroEl && !heroEl.classList.contains('empty') ? 1 : 0;
        // Count feed cards
        const feedCount = document.querySelectorAll('.evidence-card').length;
        return (hasHero + feedCount) >= count;
      },
      expectedTotal,
      { timeout }
    );
  }

  /**
   * Get total evidence count (hero + feed)
   * @returns {Promise<number>}
   */
  async getTotalEvidenceCount() {
    const hasHero = await this.hasHeroEvidence() ? 1 : 0;
    const feedCount = await this.getEvidenceCardCount();
    return hasHero + feedCount;
  }

  /**
   * Check if evidence feed is empty
   * @returns {Promise<boolean>}
   */
  async isEvidenceFeedEmpty() {
    return await this.evidenceFeedEmpty.isVisible();
  }

  /**
   * Get all evidence card details
   * @returns {Promise<Array<{team: string, text: string, time: string}>>}
   */
  async getAllEvidenceCards() {
    const cards = await this.evidenceCards.all();
    const details = [];
    for (const card of cards) {
      details.push({
        team: await card.locator('.evidence-card__team').textContent(),
        text: await card.locator('.evidence-card__text').textContent(),
        time: await card.locator('.evidence-card__time').textContent()
      });
    }
    return details;
  }

  /**
   * Find evidence card by text content
   * @param {string} searchText - Text to search for in evidence
   * @returns {Promise<boolean>} - True if found
   */
  async hasEvidenceContaining(searchText) {
    const count = await this.evidenceCards.filter({ hasText: searchText }).count();
    return count > 0;
  }

  // ============================================
  // SCORE TICKER (Black Market Mode)
  // ============================================

  /**
   * Get count of score entries displayed
   * @returns {Promise<number>}
   */
  async getScoreEntryCount() {
    return await this.scoreEntries.count();
  }

  /**
   * Wait for score entries to appear
   * @param {number} expectedCount - Minimum number of entries expected
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForScoreEntries(expectedCount = 1, timeout = 10000) {
    await this.page.waitForFunction(
      (count) => document.querySelectorAll('.score-entry').length >= count,
      expectedCount,
      { timeout }
    );
  }

  /**
   * Check if score ticker is empty
   * @returns {Promise<boolean>}
   */
  async isScoreTickerEmpty() {
    return await this.tickerEmpty.isVisible();
  }

  /**
   * Get team score from ticker by team ID
   * @param {string} teamId - Team identifier
   * @returns {Promise<string|null>} - Score text (e.g., "$1,500") or null if not found
   */
  async getTeamScore(teamId) {
    const entry = this.scoreEntries.filter({ hasText: teamId });
    const count = await entry.count();
    if (count === 0) return null;
    return await entry.locator('.score-entry__amount').textContent();
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
   * Get team rank from ticker by team ID
   * @param {string} teamId - Team identifier
   * @returns {Promise<number|null>} - Rank (1-based) or null if not found
   */
  async getTeamRank(teamId) {
    const entry = this.scoreEntries.filter({ hasText: teamId });
    const count = await entry.count();
    if (count === 0) return null;
    const rankText = await entry.locator('.score-entry__rank').textContent();
    return parseInt(rankText, 10);
  }

  /**
   * Check if a team appears in the score ticker
   * @param {string} teamId - Team identifier
   * @returns {Promise<boolean>}
   */
  async hasTeamInScores(teamId) {
    const entry = this.page.locator(`.score-entry[data-team="${teamId}"]`);
    return await entry.isVisible();
  }

  /**
   * Wait for a specific team to appear in scores
   * @param {string} teamId - Team identifier
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForTeamInScores(teamId, timeout = 10000) {
    await this.page.locator(`.score-entry[data-team="${teamId}"]`).waitFor({ state: 'visible', timeout });
  }

  /**
   * Get all score entries sorted by rank
   * @returns {Promise<Array<{rank: number, team: string, score: string}>>}
   */
  async getAllScoreEntries() {
    const entries = await this.scoreEntries.all();
    const details = [];
    for (const entry of entries) {
      const rankText = await entry.locator('.score-entry__rank').textContent();
      details.push({
        rank: parseInt(rankText, 10),
        team: await entry.locator('.score-entry__team').textContent(),
        score: await entry.locator('.score-entry__amount').textContent()
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
   * Wait for a score update to be reflected on screen
   * @param {string} teamId - Team to watch
   * @param {number} expectedScore - Expected score value
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForScoreUpdate(teamId, expectedScore, timeout = 10000) {
    await this.page.waitForFunction(
      ({ team, score }) => {
        const entry = document.querySelector(`.score-entry[data-team="${team}"]`);
        if (!entry) return false;
        const amountEl = entry.querySelector('.score-entry__amount');
        if (!amountEl) return false;
        const currentScore = parseInt(amountEl.textContent.replace(/[$,]/g, ''), 10);
        return currentScore >= score;
      },
      { team: teamId, score: expectedScore },
      { timeout }
    );
  }

  /**
   * Wait for new evidence to appear (count increases)
   * @param {number} previousCount - Previous evidence count
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForNewEvidence(previousCount, timeout = 10000) {
    await this.page.waitForFunction(
      (prevCount) => document.querySelectorAll('.evidence-card').length > prevCount,
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
