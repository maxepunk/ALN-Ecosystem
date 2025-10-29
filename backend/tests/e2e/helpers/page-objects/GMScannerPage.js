/**
 * GMScannerPage - Page Object Model for GM Scanner PWA
 *
 * Provides a high-level API for interacting with the GM Scanner interface in E2E tests.
 * Supports both networked and standalone modes.
 *
 * @example
 * const page = await browser.newPage();
 * const gmScanner = new GMScannerPage(page);
 * await gmScanner.goto();
 * await gmScanner.enterTeam('001');
 * await gmScanner.manualEntry('sof002');
 * const result = await gmScanner.waitForResult();
 * expect(result.tokenId).toBe('sof002');
 */

class GMScannerPage {
  /**
   * @param {import('playwright').Page} page - Playwright page object
   */
  constructor(page) {
    this.page = page;

    // Define all selectors used across the GM Scanner UI
    this.selectors = {
      // Header and navigation
      connectionStatus: '#connectionStatus',
      modeIndicator: '#modeIndicator',
      deviceIdDisplay: '#deviceIdDisplay',
      historyButton: 'button[onclick="App.showHistory()"]',
      historyBadge: '#historyBadge',
      scoreboardButton: '#scoreboardButton',
      settingsButton: 'button[onclick="App.showSettings()"]',

      // Screens
      loadingScreen: '#loadingScreen',
      gameModeScreen: '#gameModeScreen',
      teamEntryScreen: '#teamEntryScreen',
      scanScreen: '#scanScreen',
      resultScreen: '#resultScreen',
      historyScreen: '#historyScreen',
      scoreboardScreen: '#scoreboardScreen',
      teamDetailsScreen: '#teamDetailsScreen',
      settingsScreen: '#settingsScreen',

      // View tabs (networked mode only)
      viewSelector: '#viewSelector',
      scannerTab: 'button[data-view="scanner"]',
      adminTab: 'button[data-view="admin"]',
      debugTab: 'button[data-view="debug"]',
      scannerView: '#scanner-view',
      adminView: '#admin-view',
      debugView: '#debug-view',

      // Connection wizard modal
      connectionModal: '#connectionModal',
      scanServersBtn: '#scanServersBtn',
      discoveryStatus: '#discoveryStatus',
      discoveredServers: '#discoveredServers',
      serverUrl: '#serverUrl',
      stationName: '#stationName',
      gmPassword: '#gmPassword',
      connectionStatusMsg: '#connectionStatusMsg',
      connectionForm: '#connectionForm',

      // Team entry
      teamDisplay: '#teamDisplay',
      numpadButtons: '.numpad button',
      clearButton: 'button.clear',
      enterButton: 'button.enter',

      // Scan screen
      currentTeam: '#currentTeam',
      scanStatus: '#scanStatus',
      scanButton: '#scanButton',
      manualEntryButton: 'button[onclick="App.manualEntry()"]',
      cancelScanButton: 'button[onclick="App.cancelScan()"]',
      teamTokenCount: '#teamTokenCount',
      teamTotalValue: '#teamTotalValue',
      teamValueLabel: '#teamValueLabel',

      // Result screen
      resultStatus: '#resultStatus',
      resultRfid: '#resultRfid',
      resultType: '#resultType',
      resultGroup: '#resultGroup',
      resultValue: '#resultValue',
      continueScanButton: 'button[onclick="App.continueScan()"]',
      finishTeamButton: 'button[onclick="App.finishTeam()"]',

      // History screen
      historyContainer: '#historyContainer',
      searchFilter: '#searchFilter',
      modeFilter: '#modeFilter',
      totalScans: '#totalScans',
      uniqueTeams: '#uniqueTeams',
      totalValue: '#totalValue',
      avgValue: '#avgValue',

      // Scoreboard screen
      scoreboardContainer: '#scoreboardContainer',
      scoreboardEntry: '.scoreboard-entry',

      // Team details screen
      teamDetailsTitle: '#teamDetailsTitle',
      teamDetailsSummary: '#teamDetailsSummary',
      teamDetailsContainer: '#teamDetailsContainer',
      teamBaseScore: '#teamBaseScore',
      teamBonusScore: '#teamBonusScore',
      teamTotalScore: '#teamTotalScore',
      teamInterventionControls: '#teamInterventionControls',
      scoreAdjustmentInput: '#scoreAdjustmentInput',
      scoreAdjustmentReason: '#scoreAdjustmentReason',

      // Settings screen
      deviceId: '#deviceId',
      modeToggle: '#modeToggle',
      modeText: '#modeText',

      // Admin view (networked mode only)
      sessionStatusContainer: '#session-status-container',
      videoInfo: '#video-info',
      videoProgressFill: '#video-progress-fill',
      videoProgressTime: '#video-progress-time',
      videoQueueList: '#video-queue-list',
      manualVideoInput: '#manual-video-input',
      orchestratorStatus: '#orchestrator-status',
      vlcStatus: '#vlc-status',
      deviceCount: '#device-count',
      deviceList: '#device-list',
      adminScoreBoard: '#admin-score-board',
      adminTransactionLog: '#admin-transaction-log',

      // Debug view
      debugContent: '#debugContent',

      // Error display
      errorContainer: '.error-container',
      errorMessage: '.error-message',
      toast: '.toast',
    };
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Navigate to the GM Scanner page
   * @param {string} [mode] - Optional mode override ('networked' or 'standalone')
   */
  async goto(mode) {
    const baseUrl = process.env.ORCHESTRATOR_URL || 'https://localhost:3000';
    const url = mode ? `${baseUrl}/gm-scanner/?mode=${mode}` : `${baseUrl}/gm-scanner/`;
    await this.page.goto(url);

    // Accept self-signed certificate if needed
    await this.acceptSelfSignedCert();

    // Wait for app to initialize by checking for final screen
    // App shows either gameModeScreen (no saved mode) or teamEntry (saved mode)
    // Loading screen may appear/disappear too fast to catch (~100ms), so wait for actual outcome
    await this.page.waitForSelector('#gameModeScreen.active, #teamEntryScreen.active', {
      state: 'visible',
      timeout: 10000
    });
  }

  /**
   * Accept self-signed SSL certificate (Playwright automatically handles this)
   * This method is a placeholder for documentation purposes
   */
  async acceptSelfSignedCert() {
    // Playwright automatically handles self-signed certs with ignoreHTTPSErrors: true
    // This is configured in playwright.config.js
  }

  /**
   * Authenticate with admin password (HTTP authentication)
   * @param {string} password - Admin password
   * @returns {Promise<string>} JWT token
   */
  async authenticate(password) {
    const baseUrl = process.env.ORCHESTRATOR_URL || 'https://localhost:3000';
    const response = await this.page.request.post(`${baseUrl}/api/admin/auth`, {
      data: { password }
    });
    const data = await response.json();
    return data.token;
  }

  // ============================================
  // CONNECTION WIZARD METHODS (Networked Mode)
  // ============================================

  /**
   * Open the connection wizard modal
   */
  async openConnectionWizard() {
    await this.page.click(this.selectors.connectionStatus);
    await this.page.waitForSelector(this.selectors.connectionModal, { state: 'visible' });
  }

  /**
   * Scan for servers using UDP discovery
   * @returns {Promise<Array>} Array of discovered servers
   */
  async scanForServers() {
    await this.page.click(this.selectors.scanServersBtn);
    await this.page.waitForSelector(this.selectors.discoveryStatus, { timeout: 5000 });

    // Wait for discovery to complete (3s timeout in app)
    await this.page.waitForTimeout(3500);

    // Get discovered servers
    const servers = await this.page.$$eval(this.selectors.discoveredServers + ' .server-item',
      elements => elements.map(el => el.textContent.trim())
    );
    return servers;
  }

  /**
   * Select a server from the discovered list
   * @param {string} url - Server URL to select
   */
  async selectServer(url) {
    await this.page.evaluate((serverUrl) => {
      selectServer(serverUrl);
    }, url);
  }

  /**
   * Manually connect to orchestrator
   * @param {string} url - Server URL
   * @param {string} stationName - Station name
   * @param {string} password - Admin password
   */
  async manualConnect(url, stationName, password) {
    await this.page.fill(this.selectors.serverUrl, url);
    await this.page.fill(this.selectors.stationName, stationName);
    await this.page.fill(this.selectors.gmPassword, password);
    await this.page.click('button[type="submit"]');
  }

  /**
   * Wait for connection to be established
   * @param {number} [timeout=10000] - Timeout in milliseconds
   */
  async waitForConnection(timeout = 10000) {
    await this.page.waitForSelector(this.selectors.connectionStatus + '.connected', { timeout });
    await this.page.waitForSelector(this.selectors.connectionModal, { state: 'hidden', timeout: 5000 });
  }

  /**
   * Cancel networked mode and return to game mode selection
   */
  async cancelNetworkedMode() {
    await this.page.evaluate(() => cancelNetworkedMode());
    await this.page.waitForSelector(this.selectors.gameModeScreen, { state: 'visible' });
  }

  // ============================================
  // TEAM SELECTION METHODS
  // ============================================

  /**
   * Enter team ID using numpad
   * @param {string} teamId - Team ID (e.g., "001")
   */
  async enterTeam(teamId) {
    await this.page.waitForSelector(this.selectors.teamEntryScreen, { state: 'visible' });

    // Click each digit
    for (const digit of teamId) {
      await this.page.click(`button[onclick="App.appendNumber(${digit})"]`);
    }

    // Verify team display
    const displayedTeam = await this.page.textContent(this.selectors.teamDisplay);
    if (displayedTeam.trim() !== teamId) {
      throw new Error(`Team ID mismatch: expected ${teamId}, got ${displayedTeam}`);
    }
  }

  /**
   * Clear the team ID
   */
  async clearTeam() {
    await this.page.click(this.selectors.clearButton);
  }

  /**
   * Confirm team ID and proceed to scan screen
   */
  async confirmTeam() {
    await this.page.click(this.selectors.enterButton);
    await this.page.waitForSelector(this.selectors.scanScreen, { state: 'visible' });
  }

  // ============================================
  // SCANNING METHODS
  // ============================================

  /**
   * Start NFC scanning
   */
  async startScan() {
    await this.page.click(this.selectors.scanButton);
    // Wait for scan status to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Stop NFC scanning
   */
  async stopScan() {
    // NFC scanning stops automatically when token is detected
    // This is a no-op for manual entry testing
  }

  /**
   * Use manual entry to simulate NFC scan
   * @param {string} tokenId - Token ID (e.g., "sof002")
   */
  async manualEntry(tokenId) {
    // CRITICAL: Set up dialog handler BEFORE clicking button to avoid race condition
    // The prompt() dialog shows synchronously when button is clicked
    const dialogPromise = this.page.waitForEvent('dialog');

    // Trigger the manual entry dialog
    await this.page.click(this.selectors.manualEntryButton);

    // Wait for and handle the dialog
    const dialog = await dialogPromise;
    await dialog.accept(tokenId);

    // Small delay for UI update after dialog acceptance
    await this.page.waitForTimeout(100);
  }

  /**
   * Wait for result screen to appear
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<Object>} Transaction result details
   */
  async waitForResult(timeout = 5000) {
    await this.page.waitForSelector(this.selectors.resultScreen, { state: 'visible', timeout });

    // Extract result data
    return {
      tokenId: await this.page.textContent(this.selectors.resultRfid),
      type: await this.page.textContent(this.selectors.resultType),
      group: await this.page.textContent(this.selectors.resultGroup),
      value: await this.page.textContent(this.selectors.resultValue),
    };
  }

  /**
   * Continue scanning (return to scan screen)
   */
  async continueScan() {
    await this.page.click(this.selectors.continueScanButton);
    await this.page.waitForSelector(this.selectors.scanScreen, { state: 'visible' });
  }

  /**
   * Finish team (return to team entry)
   */
  async finishTeam() {
    await this.page.click(this.selectors.finishTeamButton);
    await this.page.waitForSelector(this.selectors.teamEntryScreen, { state: 'visible' });
  }

  /**
   * Cancel scan and return to team entry
   */
  async cancelScan() {
    await this.page.click(this.selectors.cancelScanButton);
    await this.page.waitForSelector(this.selectors.teamEntryScreen, { state: 'visible' });
  }

  // ============================================
  // MODE SWITCHING
  // ============================================

  /**
   * Toggle between Detective and Black Market modes
   */
  async toggleMode() {
    await this.page.click(this.selectors.modeIndicator);
    await this.page.waitForTimeout(300); // Wait for mode change animation
  }

  /**
   * Get current game mode
   * @returns {Promise<string>} 'detective' or 'blackmarket'
   */
  async getCurrentMode() {
    const text = await this.page.textContent(this.selectors.modeIndicator);
    return text.toLowerCase().includes('detective') ? 'detective' : 'blackmarket';
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Open transaction history screen
   */
  async openHistory() {
    await this.page.click(this.selectors.historyButton);
    await this.page.waitForSelector(this.selectors.historyScreen, { state: 'visible' });
  }

  /**
   * Close history screen
   */
  async closeHistory() {
    await this.page.click('button[onclick="App.closeHistory()"]');
  }

  /**
   * Open scoreboard screen
   */
  async openScoreboard() {
    await this.page.click(this.selectors.scoreboardButton);
    await this.page.waitForSelector(this.selectors.scoreboardScreen, { state: 'visible' });
  }

  /**
   * Close scoreboard screen
   */
  async closeScoreboard() {
    await this.page.click('button[onclick="App.closeScoreboard()"]');
  }

  /**
   * Open settings screen
   */
  async openSettings() {
    await this.page.click(this.selectors.settingsButton);
    await this.page.waitForSelector(this.selectors.settingsScreen, { state: 'visible' });
  }

  /**
   * Save settings and return to team entry
   */
  async saveSettings() {
    await this.page.click('button[onclick="App.saveSettings()"]');
    await this.page.waitForSelector(this.selectors.teamEntryScreen, { state: 'visible' });
  }

  /**
   * Switch to admin tab (networked mode only)
   */
  async switchToAdminTab() {
    await this.page.click(this.selectors.adminTab);
    await this.page.waitForSelector(this.selectors.adminView, { state: 'visible' });
  }

  /**
   * Switch to debug tab (networked mode only)
   */
  async switchToDebugTab() {
    await this.page.click(this.selectors.debugTab);
    await this.page.waitForSelector(this.selectors.debugView, { state: 'visible' });
  }

  /**
   * Switch to scanner tab
   */
  async switchToScannerTab() {
    await this.page.click(this.selectors.scannerTab);
    await this.page.waitForSelector(this.selectors.scannerView, { state: 'visible' });
  }

  // ============================================
  // SCOREBOARD
  // ============================================

  /**
   * Get team rankings from scoreboard
   * @returns {Promise<Array>} Array of team ranking objects
   */
  async getTeamRankings() {
    await this.page.waitForSelector(this.selectors.scoreboardEntry, { timeout: 5000 });

    return await this.page.$$eval(this.selectors.scoreboardEntry, entries => {
      return entries.map(entry => ({
        rank: entry.querySelector('.scoreboard-rank')?.textContent.trim(),
        team: entry.querySelector('.scoreboard-team')?.textContent.trim(),
        score: entry.querySelector('.scoreboard-score')?.textContent.trim(),
        tokens: entry.querySelector('.scoreboard-tokens')?.textContent.trim(),
      }));
    });
  }

  /**
   * Click on a team in the scoreboard
   * @param {string} teamId - Team ID to click
   */
  async clickTeam(teamId) {
    await this.page.click(`${this.selectors.scoreboardEntry}:has-text("Team ${teamId}")`);
    await this.page.waitForSelector(this.selectors.teamDetailsScreen, { state: 'visible' });
  }

  /**
   * Get team details
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} Team details object
   */
  async getTeamDetails(teamId) {
    await this.clickTeam(teamId);

    return {
      title: await this.page.textContent(this.selectors.teamDetailsTitle),
      summary: await this.page.textContent(this.selectors.teamDetailsSummary),
      baseScore: await this.page.textContent(this.selectors.teamBaseScore),
      bonusScore: await this.page.textContent(this.selectors.teamBonusScore),
      totalScore: await this.page.textContent(this.selectors.teamTotalScore),
    };
  }

  /**
   * Close team details screen
   */
  async closeTeamDetails() {
    await this.page.click('button[onclick="App.closeTeamDetails()"]');
    await this.page.waitForSelector(this.selectors.scoreboardScreen, { state: 'visible' });
  }

  // ============================================
  // ADMIN INTERVENTIONS (Networked Mode Only)
  // ============================================

  /**
   * Adjust team score
   * @param {string} teamId - Team ID
   * @param {number} delta - Score change (positive or negative)
   * @param {string} [reason] - Reason for adjustment
   */
  async adjustScore(teamId, delta, reason = '') {
    // Navigate to team details if not already there
    if (!await this.page.isVisible(this.selectors.teamInterventionControls)) {
      await this.clickTeam(teamId);
    }

    await this.page.fill(this.selectors.scoreAdjustmentInput, delta.toString());
    if (reason) {
      await this.page.fill(this.selectors.scoreAdjustmentReason, reason);
    }
    await this.page.click('button[onclick="App.adjustTeamScore()"]');

    // Wait for adjustment to be processed
    await this.page.waitForTimeout(500);
  }

  // ============================================
  // STATE VERIFICATION
  // ============================================

  /**
   * Get connection status
   * @returns {Promise<string>} 'connected', 'connecting', or 'disconnected'
   */
  async getConnectionStatus() {
    const statusElement = await this.page.$(this.selectors.connectionStatus);
    const classes = await statusElement.getAttribute('class');

    if (classes.includes('connected')) return 'connected';
    if (classes.includes('connecting')) return 'connecting';
    return 'disconnected';
  }

  /**
   * Get session statistics from scan screen
   * @returns {Promise<Object>} Session stats (token count, total value)
   */
  async getSessionStats() {
    return {
      tokenCount: await this.page.textContent(this.selectors.teamTokenCount),
      totalValue: await this.page.textContent(this.selectors.teamTotalValue),
    };
  }

  /**
   * Get transaction count from history badge
   * @returns {Promise<number>} Number of transactions
   */
  async getTransactionCount() {
    const badgeText = await this.page.textContent(this.selectors.historyBadge);
    return parseInt(badgeText, 10) || 0;
  }

  /**
   * Check if scanner is in offline mode
   * @returns {Promise<boolean>} True if offline
   */
  async isOffline() {
    const status = await this.getConnectionStatus();
    return status === 'disconnected';
  }

  /**
   * Check if networked mode is active
   * @returns {Promise<boolean>} True if networked
   */
  async isNetworkedMode() {
    return await this.page.isVisible(this.selectors.viewSelector);
  }

  /**
   * Check if standalone mode is active
   * @returns {Promise<boolean>} True if standalone
   */
  async isStandaloneMode() {
    return !(await this.isNetworkedMode());
  }

  // ============================================
  // ERROR CHECKING
  // ============================================

  /**
   * Get current error message if displayed
   * @returns {Promise<string|null>} Error message or null
   */
  async getErrorMessage() {
    const errorElement = await this.page.$(this.selectors.errorMessage);
    if (!errorElement) return null;
    return await errorElement.textContent();
  }

  /**
   * Check if error message is displayed
   * @returns {Promise<boolean>} True if error visible
   */
  async hasErrorMessage() {
    return await this.page.isVisible(this.selectors.errorMessage);
  }

  /**
   * Wait for error to appear
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<string>} Error message text
   */
  async waitForError(timeout = 5000) {
    await this.page.waitForSelector(this.selectors.errorMessage, { state: 'visible', timeout });
    return await this.getErrorMessage();
  }

  // ============================================
  // ADMIN PANEL METHODS (Networked Mode Only)
  // ============================================

  /**
   * Create a new session
   * @param {string} name - Session name
   * @param {Array<string>} teams - Array of team IDs
   */
  async adminCreateSession(name, teams = []) {
    await this.switchToAdminTab();
    // Implementation depends on admin panel UI structure
    // This is a placeholder for future implementation
    throw new Error('Admin session creation not yet implemented in page object');
  }

  /**
   * Play video from admin panel
   */
  async adminPlayVideo() {
    await this.switchToAdminTab();
    await this.page.click('button[onclick="App.adminPlayVideo()"]');
  }

  /**
   * Pause video from admin panel
   */
  async adminPauseVideo() {
    await this.switchToAdminTab();
    await this.page.click('button[onclick="App.adminPauseVideo()"]');
  }

  /**
   * Stop video from admin panel
   */
  async adminStopVideo() {
    await this.switchToAdminTab();
    await this.page.click('button[onclick="App.adminStopVideo()"]');
  }

  /**
   * Skip video from admin panel
   */
  async adminSkipVideo() {
    await this.switchToAdminTab();
    await this.page.click('button[onclick="App.adminSkipVideo()"]');
  }

  /**
   * Add video to queue manually
   * @param {string} videoFilename - Video filename (e.g., "jaw001.mp4")
   */
  async adminAddVideoToQueue(videoFilename) {
    await this.switchToAdminTab();
    await this.page.fill(this.selectors.manualVideoInput, videoFilename);
    await this.page.click('button[onclick="App.adminAddVideoToQueue()"]');
  }

  /**
   * Clear entire video queue
   */
  async adminClearQueue() {
    await this.switchToAdminTab();
    await this.page.click('button[onclick="App.adminClearQueue()"]');
  }

  /**
   * Reset all scores
   */
  async adminResetScores() {
    await this.switchToAdminTab();

    // Handle confirmation dialog
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });

    await this.page.click('button[onclick="App.adminResetScores()"]');
  }

  /**
   * Clear transaction history
   */
  async adminClearTransactions() {
    await this.switchToAdminTab();

    // Handle confirmation dialog
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });

    await this.page.click('button[onclick="App.adminClearTransactions()"]');
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Take a screenshot
   * @param {string} filename - Screenshot filename
   */
  async screenshot(filename) {
    await this.page.screenshot({ path: filename, fullPage: true });
  }

  /**
   * Wait for specified time
   * @param {number} ms - Milliseconds to wait
   */
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Get current screen ID
   * @returns {Promise<string>} Active screen ID
   */
  async getCurrentScreen() {
    const activeScreen = await this.page.$('.screen.active');
    if (!activeScreen) return null;
    return await activeScreen.getAttribute('id');
  }

  /**
   * Check if element is visible
   * @param {string} selector - CSS selector
   * @returns {Promise<boolean>} True if visible
   */
  async isVisible(selector) {
    return await this.page.isVisible(selector);
  }
}

module.exports = GMScannerPage;
