/**
 * Page Object Model for GM Scanner
 *
 * Encapsulates DOM interactions for maintainable E2E tests.
 * Uses Playwright locators and web-first assertions.
 *
 * NO window globals - pure DOM interaction via data-action attributes.
 *
 * ARCHITECTURE:
 * - Views (top-level): #scanner-view (default), #admin-view, #debug-view (networked only)
 * - Screens (within scanner-view): Toggle with .active class
 * - L2 tests focus on standalone mode (scanner-view only, no backend)
 */

class GMScannerPage {
  constructor(page) {
    this.page = page;

    // View locators (top-level containers, networked mode only)
    this.scannerView = page.locator('#scanner-view');
    this.adminView = page.locator('#admin-view');
    this.debugView = page.locator('#debug-view');

    // Screen locators (within scanner-view, toggled with .active class)
    this.loadingScreen = page.locator('#loadingScreen.active');
    this.settingsScreen = page.locator('#settingsScreen.active');
    this.gameModeScreen = page.locator('#gameModeScreen.active');
    this.teamEntryScreen = page.locator('#teamEntryScreen.active');
    this.scanScreen = page.locator('#scanScreen.active');
    this.resultScreen = page.locator('#resultScreen.active');
    this.historyScreen = page.locator('#historyScreen.active');
    this.scoreboardScreen = page.locator('#scoreboardScreen.active');
    this.teamDetailsScreen = page.locator('#teamDetailsScreen.active');

    // Mode selection buttons
    this.standaloneBtn = page.locator('button[data-action="app.selectGameMode"][data-arg="standalone"]');
    this.networkedBtn = page.locator('button[data-action="app.selectGameMode"][data-arg="networked"]');

    // Team entry elements
    this.teamDisplay = page.locator('#teamDisplay');
    this.confirmTeamBtn = page.locator('button[data-action="app.confirmTeamId"]');
    this.clearTeamBtn = page.locator('button[data-action="app.clearTeamId"]');

    // Scan screen elements
    this.currentTeam = page.locator('#currentTeam');
    this.scanStatus = page.locator('#scanStatus');
    this.scanButton = page.locator('#scanButton[data-action="app.startScan"]');
    this.manualEntryBtn = page.locator('button[data-action="app.manualEntry"]');
    this.cancelScanBtn = page.locator('button[data-action="app.cancelScan"]');
    this.teamTokenCount = page.locator('#teamTokenCount');
    this.teamTotalValue = page.locator('#teamTotalValue');

    // Result screen elements
    this.resultStatus = page.locator('#resultStatus');
    this.resultTitle = page.locator('#resultTitle');
    this.resultValue = page.locator('#resultValue');
    this.continueScanBtn = page.locator('button[data-action="app.continueScan"]');
    this.finishTeamBtn = page.locator('button[data-action="app.finishTeam"]');

    // History screen elements
    this.historyBadge = page.locator('#historyBadge');
    this.historyButton = page.locator('button[data-action="app.showHistory"]');
    this.totalScans = page.locator('#totalScans');
    this.historyContainer = page.locator('#historyContainer');
    this.closeHistoryBtn = page.locator('button[data-action="app.closeHistory"]');

    // Settings elements
    this.settingsButton = page.locator('button[data-action="app.showSettings"]');
    this.deviceIdInput = page.locator('#deviceId');
    this.modeIndicator = page.locator('#modeIndicator');
    this.saveSettingsBtn = page.locator('button[data-action="app.saveSettings"]');

    // Connection wizard and status (networked mode)
    this.connectionModal = page.locator('#connectionModal');
    this.connectionStatus = page.locator('#connectionStatus');

    // View tabs (networked mode only)
    this.adminTab = page.locator('[data-view="admin"]');
    this.scannerTab = page.locator('[data-view="scanner"]');

    // Admin panel elements (networked mode only)
    this.scoreAdjustmentInput = page.locator('#scoreAdjustmentInput');
    this.scoreAdjustmentReason = page.locator('#scoreAdjustmentReason');
    this.adjustScoreBtn = page.locator('button[data-action="app.adjustTeamScore"]');
    this.resetScoresBtn = page.locator('button[data-action="app.adminResetScores"]');
    this.viewFullScoreboardBtn = page.locator('button[data-action="app.viewFullScoreboard"]');
    this.viewFullHistoryBtn = page.locator('button[data-action="app.viewFullHistory"]');
    this.adminScoreBoard = page.locator('#admin-score-board');

    // Error displays
    this.errorToast = page.locator('.toast.error:visible');
    this.errorMessage = page.locator('.error-message:visible');

    // Display control elements (Phase 4.2 - Admin panel)
    this.nowShowingValue = page.locator('#now-showing-value');
    this.nowShowingIcon = page.locator('#now-showing-icon');
    this.pendingQueueCount = page.locator('#pending-queue-count');
    this.returnsToContainer = page.locator('#returns-to-container');
    this.returnsToMode = page.locator('#returns-to-mode');
    this.btnIdleLoop = page.locator('#btn-idle-loop');
    this.btnScoreboard = page.locator('#btn-scoreboard');
  }

  /**
   * Navigate to scanner homepage
   *
   * NOTE: This method is now deprecated in favor of initializeGMScannerWithMode()
   * which properly handles localStorage clearing to prevent stale state.
   * Kept for backward compatibility with existing tests.
   */
  async goto() {
    await this.page.goto('/gm-scanner/');
    await this.page.waitForLoadState('networkidle');

    // Wait for game mode screen (app should load fresh)
    await this.gameModeScreen.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Select standalone mode
   */
  async selectStandaloneMode() {
    await this.standaloneBtn.click();
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Select networked mode
   */
  async selectNetworkedMode() {
    await this.networkedBtn.click();
    // Connection wizard modal should appear
    await this.page.locator('#connectionModal').waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Enter team name in standalone mode
   * @param {string} name - Team name
   */
  async enterTeamName(name) {
    await this.page.locator('#standaloneTeamName').fill(name);
  }

  /**
   * Select team from dropdown in networked mode
   * @param {string} name - Team name to select
   */
  async selectTeam(name) {
    await this.page.locator('#teamSelect').selectOption(name);
  }

  /**
   * Confirm team selection
   */
  async confirmTeam() {
    await this.confirmTeamBtn.click();
    await this.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get current team display value
   * @returns {Promise<string>}
   */
  async getTeamDisplay() {
    return await this.teamDisplay.textContent();
  }

  /**
   * Get current team on scan screen
   * @returns {Promise<string>}
   */
  async getCurrentTeam() {
    return await this.currentTeam.textContent();
  }

  /**
   * Perform manual token scan via prompt dialog
   * @param {string} tokenId - Token ID to scan
   */
  async manualScan(tokenId) {
    // Setup dialog handler BEFORE clicking button (use once, not waitForEvent)
    // This prevents the click from hanging when dialog appears
    this.page.once('dialog', dialog => dialog.accept(tokenId));

    // Click manual entry button (dialog will be auto-handled)
    await this.manualEntryBtn.click();

    // Wait for result screen to appear
    await this.resultScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Wait for result screen to appear
   */
  async waitForResult() {
    await this.resultScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get result status text
   * @returns {Promise<string>}
   */
  async getResultStatus() {
    return await this.resultStatus.textContent();
  }

  /**
   * Get result title text
   * @returns {Promise<string>}
   */
  async getResultTitle() {
    return await this.resultTitle.textContent();
  }

  /**
   * Get result value text
   * @returns {Promise<string>}
   */
  async getResultValue() {
    return await this.resultValue.textContent();
  }

  /**
   * Continue scanning (after result)
   */
  async continueScan() {
    await this.continueScanBtn.click();
    await this.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Finish team (after result)
   */
  async finishTeam() {
    await this.finishTeamBtn.click();
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Cancel scan and return to team entry
   */
  async cancelScan() {
    await this.cancelScanBtn.click();
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get team token count
   * @returns {Promise<number>}
   */
  async getTokenCount() {
    const text = await this.teamTokenCount.textContent();
    return parseInt(text, 10);
  }

  /**
   * Get team total value
   * @returns {Promise<number>}
   */
  async getTotalValue() {
    const text = await this.teamTotalValue.textContent();
    return parseInt(text, 10);
  }

  /**
   * Open history screen
   */
  async openHistory() {
    await this.historyButton.click();
    await this.historyScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Close history screen
   */
  async closeHistory() {
    await this.closeHistoryBtn.click();
    await this.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get history total scans count
   * @returns {Promise<number>}
   */
  async getHistoryTotalScans() {
    const text = await this.totalScans.textContent();
    return parseInt(text, 10);
  }

  /**
   * Get history badge count
   * @returns {Promise<number|null>} Returns null if badge is hidden
   */
  async getHistoryBadgeCount() {
    const isVisible = await this.historyBadge.isVisible();
    if (!isVisible) return null;

    const text = await this.historyBadge.textContent();
    return parseInt(text, 10);
  }

  /**
   * Open settings screen
   */
  async openSettings() {
    await this.settingsButton.click();
    await this.settingsScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Set device ID in settings
   * @param {string} deviceId
   */
  async setDeviceId(deviceId) {
    await this.deviceIdInput.fill(deviceId);
  }

  /**
   * Get device ID from settings
   * @returns {Promise<string>}
   */
  async getDeviceId() {
    return await this.deviceIdInput.inputValue();
  }

  /**
   * Save settings and return to team entry screen
   */
  async saveSettings() {
    await this.saveSettingsBtn.click();
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Toggle mode (detective/blackmarket) via mode indicator
   */
  async toggleMode() {
    await this.modeIndicator.click();
  }

  /**
   * Get current mode text
   * @returns {Promise<string>}
   */
  async getModeText() {
    return await this.modeIndicator.textContent();
  }

  /**
   * Manual connection to orchestrator (networked mode)
   * @param {string} url - Orchestrator URL (e.g., 'https://localhost:3000')
   * @param {string} stationName - Station identifier
   * @param {string} password - Admin password
   */
  async manualConnect(url, stationName, password) {
    // Wait for connection modal to appear
    await this.connectionModal.waitFor({ state: 'visible', timeout: 5000 });

    // Fill server URL (triggers auto-assignment of station name)
    await this.page.fill('#serverUrl', url);

    // Wait for station name to be auto-assigned (display updates with GM_Station_N format)
    // NOTE: stationName parameter is now ignored - station names are auto-assigned
    await this.page.waitForFunction(() => {
      const display = document.getElementById('stationNameDisplay');
      return display && display.dataset.deviceId && display.dataset.deviceId.length > 0;
    }, { timeout: 5000 });

    // Fill password
    await this.page.fill('#gmPassword', password);

    // Submit connection form (triggers handleConnectionSubmit via event listener)
    const form = this.page.locator('#connectionForm');
    await form.evaluate(f => f.requestSubmit());
  }

  /**
   * Wait for WebSocket connection established
   * @param {number} timeout - Max wait time in ms (default 10000)
   */
  async waitForConnection(timeout = 10000) {
    // Wait for connection - check for error or success
    // Per Architecture Refactoring 2025-11: Connection wizard closes after success,
    // so we check for team entry screen and view selector (networked mode indicators)
    await this.page.waitForFunction(() => {
      // Check for error message in connection form (if still visible)
      const errorMsg = document.querySelector('#connectionStatusMsg');
      if (errorMsg && errorMsg.style.display !== 'none' && errorMsg.textContent.includes('❌')) {
        throw new Error(`Connection failed: ${errorMsg.textContent}`);
      }

      // Check for successful networked mode initialization:
      // - Connection modal should be hidden
      // - View selector (admin tabs) should be visible
      // - Team entry screen should be visible
      const modal = document.querySelector('#connectionModal');
      const viewSelector = document.querySelector('#viewSelector');
      const teamEntry = document.querySelector('#teamEntryScreen');

      const modalHidden = !modal || modal.style.display === 'none';
      const viewSelectorVisible = viewSelector && viewSelector.style.display !== 'none';
      const teamEntryVisible = teamEntry && teamEntry.classList.contains('active');

      return modalHidden && viewSelectorVisible && teamEntryVisible;
    }, { timeout });

    // Additional verification: wait for team entry screen locator
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 2000 });
  }

  /**
   * Disconnect WebSocket (for testing reconnection scenarios)
   * Uses page.evaluate to programmatically disconnect the socket
   */
  async disconnectWebSocket() {
    // Programmatically disconnect via the exposed window objects
    await this.page.evaluate(() => {
      // Try to access the orchestrator client and disconnect
      if (window.orchestratorClient?.socket) {
        window.orchestratorClient.socket.disconnect();
      } else if (window.connectionManager?.client?.socket) {
        window.connectionManager.client.socket.disconnect();
      }
    });

    // Wait for disconnected status in UI
    await this.page.waitForTimeout(1000);
  }

  /**
   * Reconnect WebSocket after disconnection
   */
  async reconnectWebSocket() {
    // Programmatically reconnect via the exposed window objects
    await this.page.evaluate(() => {
      if (window.orchestratorClient?.socket) {
        window.orchestratorClient.socket.connect();
      } else if (window.connectionManager?.client?.socket) {
        window.connectionManager.client.socket.connect();
      }
    });

    // Wait for reconnection
    await this.waitForConnection();
  }

  /**
   * Get error message from toast or inline error display
   * @returns {Promise<string|null>} Error message text, or null if no error visible
   */
  async getErrorMessage() {
    // Check for toast notification
    if (await this.errorToast.isVisible()) {
      return await this.errorToast.textContent();
    }

    // Check for inline error message
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }

    // Check for result screen error
    const resultError = this.page.locator('#resultScreen.active .error-text');
    if (await resultError.isVisible()) {
      return await resultError.textContent();
    }

    return null;
  }

  /**
   * Get connection status text
   * @returns {Promise<string>} Connection status (e.g., "Connected", "Disconnected", "Connecting...")
   */
  async getConnectionStatus() {
    if (await this.connectionStatus.isVisible()) {
      const text = await this.connectionStatus.textContent();
      return text.trim().toLowerCase();  // Normalize whitespace and capitalization
    }
    return 'unknown';
  }

  /**
   * Navigate to admin panel and wait for complete initialization
   * Contract: Returns only when admin modules initialized AND data loaded
   *
   * Flow:
   * 1. Click admin tab → show admin view
   * 2. Wait for AdminController.initialized === true (DI chain complete)
   * 3. Wait for backendScores Map exists (sync:full received and processed)
   *
   * MonitoringDisplay requests sync:full on init (via _requestInitialState)
   * Backend responds with sync:full → populates backendScores Map
   *
   * @returns {Promise<void>}
   */
  async navigateToAdminPanel() {
    await this.adminTab.click();
    await this.adminView.waitFor({ state: 'visible', timeout: 5000 });

    // Wait for admin modules initialized (DOM-based detection)
    // Phase 3 removed window.__app hack - use observable DOM state instead
    // MonitoringDisplay.updateSessionDisplay() populates #session-status-container
    // when admin modules are initialized
    await this.page.waitForFunction(() => {
      const container = document.querySelector('#session-status-container');
      // Container has content when MonitoringDisplay has initialized and rendered
      return container && container.children.length > 0;
    }, { timeout: 5000 });

    // Wait for initial data loaded (DOM-based detection)
    // MonitoringDisplay._requestInitialState() triggers sync:full
    // Backend responds → MonitoringDisplay.updateSystemDisplay() updates #orchestrator-status
    // Green dot (status-dot--connected class) indicates connection confirmed
    await this.page.waitForFunction(() => {
      const statusDot = document.querySelector('#orchestrator-status');
      // Status dot has 'status-dot--connected' class when orchestrator connection confirmed
      return statusDot && statusDot.classList.contains('status-dot--connected');
    }, { timeout: 10000 });  // Longer timeout for network request + processing

    console.log('✓ Admin panel navigation complete - data loaded');
  }

  /**
   * Adjust team score via admin panel UI
   * @param {number} delta - Score adjustment (+/-)
   * @param {string} [reason] - Optional reason for adjustment
   */
  async adjustTeamScore(delta, reason = '') {
    await this.scoreAdjustmentInput.fill(String(delta));
    if (reason) {
      await this.scoreAdjustmentReason.fill(reason);
    }
    await this.adjustScoreBtn.click();
  }

  /**
   * Delete transaction via team details screen
   * Works in both networked and standalone modes
   * @param {string} transactionId - Transaction ID to delete
   */
  async deleteTransaction(transactionId) {
    // Locate delete button by data-arg attribute
    const deleteBtn = this.page.locator(`button[data-action="app.deleteTeamTransaction"][data-arg="${transactionId}"]`);

    // Verify button exists before proceeding
    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Setup dialog handler BEFORE clicking to accept confirmation
    this.page.once('dialog', dialog => dialog.accept());

    // Click delete button
    await deleteBtn.click();

    // ✅ Event-driven architecture: Don't wait for immediate DOM changes
    // Test will wait for transaction:deleted broadcast
    // Flow: broadcast → MonitoringDisplay → DataManager.removeTransaction() → event → main.js → UI render
    // DOM updates happen asynchronously after event chain completes
  }

  /**
   * Reset all team scores via admin panel UI
   * Handles confirmation dialog automatically
   */
  async resetAllScores() {
    // Setup dialog handler BEFORE clicking
    this.page.once('dialog', dialog => dialog.accept());
    await this.resetScoresBtn.click();
  }

  /**
   * Navigate to full scoreboard from admin panel
   */
  async viewFullScoreboard() {
    await this.viewFullScoreboardBtn.click();
    await this.scoreboardScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Navigate to full history from admin panel
   */
  async viewFullHistory() {
    await this.viewFullHistoryBtn.click();
    await this.historyScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Click team name in admin score board
   * @param {string} teamId - Team ID to click
   */
  async clickTeamInScoreBoard(teamId) {
    // Find row with team ID and click first cell
    const row = this.adminScoreBoard.locator(`tbody tr:has-text("${teamId}")`);
    await row.locator('td:first-child').click();
  }

  // ============================================
  // Display Control Methods (Phase 4.2)
  // ============================================

  /**
   * Set display mode to Idle Loop
   */
  async setDisplayIdleLoop() {
    await this.btnIdleLoop.click();
  }

  /**
   * Set display mode to Scoreboard
   */
  async setDisplayScoreboard() {
    await this.btnScoreboard.click();
  }

  /**
   * Get current "Now Showing" display text
   * @returns {Promise<string>}
   */
  async getNowShowing() {
    return await this.nowShowingValue.textContent();
  }

  /**
   * Get current "Now Showing" icon
   * @returns {Promise<string>}
   */
  async getNowShowingIcon() {
    return await this.nowShowingIcon.textContent();
  }

  /**
   * Check if Idle Loop button is active
   * @returns {Promise<boolean>}
   */
  async isIdleLoopActive() {
    const classAttr = await this.btnIdleLoop.getAttribute('class');
    return classAttr?.includes('active') ?? false;
  }

  /**
   * Check if Scoreboard button is active
   * @returns {Promise<boolean>}
   */
  async isScoreboardActive() {
    const classAttr = await this.btnScoreboard.getAttribute('class');
    return classAttr?.includes('active') ?? false;
  }

  /**
   * Get "Returns To" mode text (visible during video playback)
   * @returns {Promise<string|null>} Returns null if container is hidden
   */
  async getReturnsToMode() {
    const isVisible = await this.returnsToContainer.isVisible();
    if (!isVisible) return null;
    return await this.returnsToMode.textContent();
  }

  /**
   * Get pending queue count
   * @returns {Promise<number>}
   */
  async getPendingQueueCount() {
    const text = await this.pendingQueueCount.textContent();
    return parseInt(text, 10);
  }
}

module.exports = { GMScannerPage };
