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

    // Team entry elements - UNIFIED (single input + clickable list)
    this.teamNameInput = page.locator('#teamNameInput');
    this.teamList = page.locator('#teamList');
    this.teamListLabel = page.locator('#teamListLabel');
    this.confirmTeamBtn = page.locator('button[data-action="app.confirmTeamId"]');

    // Scan screen elements
    this.currentTeam = page.locator('#currentTeam');
    this.scanStatus = page.locator('#scanStatus');
    // Note: Start Scanning button removed - NFC auto-starts on team confirmation
    this.manualEntryBtn = page.locator('button[data-action="app.manualEntry"]');
    // Note: Cancel Scan button removed - use Finish Team instead
    this.teamTokenCount = page.locator('#teamTokenCount');
    this.teamTotalValue = page.locator('#teamTotalValue');

    // Result screen elements
    this.resultStatus = page.locator('#resultStatus');
    this.resultTitle = page.locator('#resultStatus h2');
    this.resultValue = page.locator('#resultValue');
    // Note: Continue Scan button removed - use quick-dismiss (tap result screen)
    this.finishTeamBtn = page.locator('button[data-action="app.finishTeam"]');
    this.quickDismissHint = page.locator('.quick-dismiss-hint');

    // History screen elements
    this.historyBadge = page.locator('#historyBadge');
    this.historyButton = page.locator('button[data-action="app.showHistory"]');
    this.totalScans = page.locator('#totalScans');
    this.historyContainer = page.locator('#historyContainer');
    this.closeHistoryBtn = page.locator('button[data-action="app.closeHistory"]');

    // Scoreboard screen elements
    this.scoreboardButton = page.locator('button[data-action="app.showScoreboard"]');
    this.scoreboardContainer = page.locator('#scoreboardContainer');
    this.scoreboardEntries = page.locator('#scoreboardContainer .scoreboard-entry');
    this.closeScoreboardBtn = page.locator('button[data-action="app.closeScoreboard"]');

    // Team details screen elements
    this.teamDetailsContainer = page.locator('#teamDetailsContainer');
    this.teamDetailsTitle = page.locator('#teamDetailsTitle');
    this.teamDetailsSummary = page.locator('#teamDetailsSummary');
    this.teamBaseScore = page.locator('#teamBaseScore');
    this.teamBonusScore = page.locator('#teamBonusScore');
    this.closeTeamDetailsBtn = page.locator('button[data-action="app.closeTeamDetails"]');
    this.tokenDetailCards = page.locator('#teamDetailsContainer .token-card, #teamDetailsContainer .history-entry');

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
    this.viewFullHistoryBtn = page.locator('button[data-action="app.viewFullHistory"]');
    this.adminScoreBoard = page.locator('#admin-score-board');

    // Session status locators (dynamically rendered by MonitoringDisplay)
    this.sessionContainer = page.locator('#session-status-container');
    this.sessionEmpty = page.locator('#session-status-container .session-status--empty');
    this.sessionActive = page.locator('#session-status-container .session-status--active');
    this.sessionPaused = page.locator('#session-status-container .session-status--paused');
    this.sessionEnded = page.locator('#session-status-container .session-status--ended');

    // Session action buttons (visibility depends on session state)
    this.createSessionBtn = page.locator('button[data-action="app.adminCreateSession"]');
    this.pauseSessionBtn = page.locator('button[data-action="app.adminPauseSession"]');
    this.resumeSessionBtn = page.locator('button[data-action="app.adminResumeSession"]');
    this.endSessionBtn = page.locator('button[data-action="app.adminEndSession"]');
    this.resetAndCreateNewBtn = page.locator('button[data-action="app.adminResetAndCreateNew"]');

    // Video playback controls
    this.videoPlayBtn = page.locator('button[data-action="app.adminPlayVideo"]');
    this.videoPauseBtn = page.locator('button[data-action="app.adminPauseVideo"]');
    this.videoStopBtn = page.locator('button[data-action="app.adminStopVideo"]');
    this.videoSkipBtn = page.locator('button[data-action="app.adminSkipVideo"]');

    // Video queue management
    this.manualVideoInput = page.locator('#manual-video-input');
    this.addVideoToQueueBtn = page.locator('button[data-action="app.adminAddVideoToQueue"]');
    this.clearQueueBtn = page.locator('button[data-action="app.adminClearQueue"]');

    // Video status displays
    this.videoQueueContainer = page.locator('#video-queue-container');
    this.videoQueueList = page.locator('#video-queue-list');
    this.videoQueueCount = page.locator('#queue-count');
    this.videoProgressContainer = page.locator('#video-progress-container');
    this.videoProgressFill = page.locator('#video-progress-fill');
    this.videoProgressTime = page.locator('#video-progress-time');

    // Connection status indicators (system status)
    this.orchestratorStatus = page.locator('#orchestrator-status');
    this.vlcStatus = page.locator('#vlc-status');
    this.deviceCount = page.locator('#device-count');
    this.deviceList = page.locator('#device-list');
    this.deviceItems = page.locator('#device-list .device-item');

    // Admin transaction log (different from history screen)
    this.adminTransactionLog = page.locator('#admin-transaction-log');
    this.adminTransactionItems = page.locator('#admin-transaction-log .transaction-item');

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
   * Enter team name using unified text input
   * Works for both networked and standalone modes
   * @param {string} name - Team name (e.g., "001" or "Team Alpha")
   */
  async enterTeam(name) {
    await this.teamNameInput.fill(name);
  }

  /**
   * Select team from clickable team list
   * Auto-proceeds to scan screen after selection
   * @param {string} name - Team name to select
   */
  async selectTeamFromList(name) {
    await this.waitForTeamInList(name);
    await this.teamList.locator(`.team-list-item:has-text("${name}")`).click();
    await this.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Wait for team to appear in team list
   * Useful after session creation to ensure sync:full has been processed
   * @param {string} teamName - Team name to wait for
   * @param {number} timeout - Timeout in ms (default 10000)
   */
  async waitForTeamInList(teamName, timeout = 10000) {
    await this.teamList.locator(`.team-list-item:has-text("${teamName}")`).waitFor({
      state: 'visible',
      timeout
    });
  }

  /**
   * Confirm team selection and proceed to scan screen
   */
  async confirmTeam() {
    await this.confirmTeamBtn.click();
    await this.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get current team input value
   * @returns {Promise<string>}
   */
  async getTeamDisplay() {
    return await this.teamNameInput.inputValue();
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
   * Continue scanning (after result) via quick-dismiss
   * Taps the result screen (not a button) to trigger quick-dismiss
   */
  async continueScan() {
    // Quick-dismiss: tap the result screen itself (not a button)
    // The quick-dismiss handler returns to scan screen
    const resultScreen = this.page.locator('#resultScreen');
    await resultScreen.click({ position: { x: 10, y: 10 } }); // Top-left corner, away from buttons
    await this.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Finish team (from scan or result screen)
   * Works from either screen since both have the Finish Team button
   */
  async finishTeam() {
    // Click the visible Finish Team button (could be on scan or result screen)
    const finishBtn = this.page.locator('button[data-action="app.finishTeam"]:visible');
    await finishBtn.click({ timeout: 5000 });
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Cancel scan and return to team entry
   * @deprecated Use finishTeam() instead - cancelScan button was removed
   */
  async cancelScan() {
    // Redirect to finishTeam since cancelScan button was removed
    await this.finishTeam();
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
   * Note: History is an overlay that returns to previousScreen (could be scan, teamEntry, or result)
   */
  async closeHistory() {
    await this.closeHistoryBtn.click();
    // Wait for history screen to become hidden (don't assume which screen we return to)
    await this.historyScreen.waitFor({ state: 'hidden', timeout: 5000 });
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
   * @param {string} stationName - Station identifier (used as unique device ID for test isolation)
   * @param {string} password - Admin password
   */
  async manualConnect(url, stationName, password) {
    // Wait for connection modal to appear
    await this.connectionModal.waitFor({ state: 'visible', timeout: 5000 });

    // Fill server URL - this triggers production's assignStationName() with 500ms debounce
    await this.page.fill('#serverUrl', url);

    // CONDITION-BASED WAITING: Wait for production's auto-assignment to complete
    // Production flow: URL input → 500ms debounce → /api/state query → set stationNameDisplay.dataset.deviceId
    // We must wait for the ACTUAL condition (deviceId being set) not guess at timing.
    // This prevents race where we override early, then production overwrites our value.
    await this.page.waitForFunction(
      () => {
        const display = document.getElementById('stationNameDisplay');
        // Condition: production has finished auto-assignment (deviceId is non-empty)
        return display && display.dataset.deviceId && display.dataset.deviceId.length > 0;
      },
      { timeout: 5000 }
    );

    // NOW safe to override - production's auto-assignment is complete
    // handleConnectionSubmit() reads from stationNameDisplay.dataset.deviceId on submit
    if (stationName) {
      await this.page.evaluate((uniqueId) => {
        const display = document.getElementById('stationNameDisplay');
        if (display) {
          display.dataset.deviceId = uniqueId;
          display.textContent = uniqueId;
        }
      }, stationName);
    }

    // Fill password
    await this.page.fill('#gmPassword', password);

    // Submit form - handleConnectionSubmit reads our overridden deviceId
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
   * Adjust team score via team details screen
   * @param {number} delta - Score adjustment (+/-)
   * @param {string} [reason] - Optional reason for adjustment
   * @throws {Error} If intervention controls not visible or adjustment fails
   */
  async adjustTeamScore(delta, reason = '') {
    // PHASE 1: Wait for intervention controls to be visible
    // These are inside #teamInterventionControls which is display:none by default
    // and shown by renderTeamDetails() when session is active
    const interventionControls = this.page.locator('#teamInterventionControls');
    await interventionControls.waitFor({ state: 'visible', timeout: 5000 });
    console.log('[GMScannerPage] Intervention controls visible');

    // PHASE 2: Track any dialog/alert that appears (error conditions)
    let alertMessage = null;
    const dialogHandler = (dialog) => {
      alertMessage = dialog.message();
      console.log(`[GMScannerPage] Dialog appeared: ${alertMessage}`);
      dialog.dismiss();
    };
    this.page.on('dialog', dialogHandler);

    // PHASE 2b: Track console errors for silent failures
    const consoleErrors = [];
    const consoleHandler = (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`[GMScannerPage] Console error: ${msg.text()}`);
      }
    };
    this.page.on('console', consoleHandler);

    // PHASE 3: Fill inputs and click button
    await this.scoreAdjustmentInput.fill(String(delta));
    console.log(`[GMScannerPage] Filled adjustment input: ${delta}`);
    if (reason) {
      await this.scoreAdjustmentReason.fill(reason);
      console.log(`[GMScannerPage] Filled reason: ${reason}`);
    }

    await this.adjustScoreBtn.click();
    console.log('[GMScannerPage] Clicked adjust button');

    // PHASE 4: Wait for async response (WebSocket command + ACK)
    await this.page.waitForTimeout(2000);

    // Remove handlers
    this.page.off('dialog', dialogHandler);
    this.page.off('console', consoleHandler);

    // PHASE 5: Check for errors
    if (alertMessage) {
      throw new Error(`Score adjustment failed with alert: ${alertMessage}`);
    }
    if (consoleErrors.length > 0) {
      console.log(`[GMScannerPage] Console errors during adjustment: ${consoleErrors.join(', ')}`);
    }
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

  // NOTE: viewFullScoreboard() removed - button was removed as part of
  // admin scoreboard consolidation. Admin panel now has full scoreboard inline.

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
    // Find scoreboard entry with team ID and click it (entry is directly clickable)
    const entry = this.adminScoreBoard.locator(`.scoreboard-entry:has-text("${teamId}")`);
    await entry.click();
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

  // ============================================
  // Backend State Methods (Browser-Only E2E)
  // ============================================

  /**
   * Query backend state via Playwright's built-in HTTP client
   * Uses page.request which shares cookies/auth with browser context
   * @param {string} baseUrl - Orchestrator URL (e.g., 'https://localhost:3000')
   * @returns {Promise<Object>} Full game state from /api/state
   */
  async getStateFromBackend(baseUrl) {
    try {
      const response = await this.page.request.get(`${baseUrl}/api/state`);
      if (!response.ok()) {
        console.error(`[getStateFromBackend] HTTP ${response.status()}: ${await response.text()}`);
        return null;
      }
      return response.json();
    } catch (error) {
      console.error(`[getStateFromBackend] Error fetching ${baseUrl}/api/state:`, error.message);
      return null;
    }
  }

  /**
   * Wait for backend state to match predicate (condition-based waiting)
   * Polls /api/state until predicate returns true or timeout
   * @param {string} baseUrl - Orchestrator URL
   * @param {Function} predicate - (state) => boolean - condition to wait for
   * @param {number} timeout - Max wait time in ms (default 5000)
   * @returns {Promise<Object>} State that matched predicate
   * @throws {Error} If timeout exceeded before predicate matched
   */
  async waitForBackendState(baseUrl, predicate, timeout = 5000) {
    const startTime = Date.now();
    let lastState = null;
    let attempts = 0;
    while (Date.now() - startTime < timeout) {
      attempts++;
      const state = await this.getStateFromBackend(baseUrl);
      lastState = state;
      if (state && predicate(state)) return state;
      await this.page.waitForTimeout(100);
    }
    // Log the last state for debugging (focus on scores)
    const stateDebug = lastState ? {
      sessionName: lastState.session?.name,
      sessionStatus: lastState.session?.status,
      teams: lastState.session?.teams,
      scoreTeams: lastState.scores?.map(s => s.teamId),
      targetTeamScore: lastState.scores?.find(s => s.teamId === 'Team Alpha'),
      allScoresCount: lastState.scores?.length,
    } : null;
    console.error(`[waitForBackendState] Timeout after ${attempts} attempts. State debug:`,
      JSON.stringify(stateDebug, null, 2));
    throw new Error(`Timeout waiting for backend state after ${timeout}ms`);
  }

  /**
   * Get transaction count from history container
   * Uses visible DOM elements, not WebSocket events
   * Supports both old .transaction-card and new .token-card classes
   * @returns {Promise<number>} Number of transaction/token cards in history
   */
  async getHistoryTransactionCount() {
    return await this.page.locator('#historyContainer .transaction-card, #historyContainer .token-card').count();
  }

  // ============================================
  // Session Management Methods (Pure UI Flow)
  // ============================================

  /**
   * Create a new session via admin panel UI
   * Uses prompt dialog for session name (Pure UI, no WebSocket)
   * @param {string} name - Session name
   */
  async createSession(name) {
    // Ensure we're on admin panel
    await this.navigateToAdminPanel();

    // Wait for "Create New Session" button (no-session state)
    await this.createSessionBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Setup dialog handler BEFORE clicking
    this.page.once('dialog', dialog => dialog.accept(name));

    // Click create button
    await this.createSessionBtn.click();

    // Wait for session active state in UI
    await this.sessionActive.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Create a session with teams via admin panel UI
   * Creates session, then adds teams via scanner view
   * @param {string} name - Session name
   * @param {string[]} teams - Array of team names to add
   */
  async createSessionWithTeams(name, teams) {
    await this.createSession(name);

    // Switch to scanner view to add teams
    await this.scannerTab.click();
    await this.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

    // Add each team
    for (const team of teams) {
      await this.addNewTeam(team);
    }

    // Return to admin panel
    await this.navigateToAdminPanel();
  }

  /**
   * Pause the current session
   */
  async pauseSession() {
    await this.pauseSessionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.pauseSessionBtn.click();
    await this.sessionPaused.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Resume a paused session
   */
  async resumeSession() {
    await this.resumeSessionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.resumeSessionBtn.click();
    await this.sessionActive.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * End the current session
   * Handles confirmation dialog automatically
   */
  async endSession() {
    await this.endSessionBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Setup dialog handler BEFORE clicking
    this.page.once('dialog', dialog => dialog.accept());

    await this.endSessionBtn.click();
    await this.sessionEnded.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Reset and create a new session after previous one ended
   * @param {string} name - New session name
   */
  async resetAndCreateNew(name) {
    await this.resetAndCreateNewBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Setup dialog handlers BEFORE clicking
    // First: confirm reset, Second: prompt for name
    let dialogCount = 0;
    const dialogHandler = async (dialog) => {
      dialogCount++;
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      } else if (dialog.type() === 'prompt') {
        await dialog.accept(name);
      }
    };
    this.page.on('dialog', dialogHandler);

    await this.resetAndCreateNewBtn.click();
    await this.sessionActive.waitFor({ state: 'visible', timeout: 5000 });

    // Remove handler
    this.page.off('dialog', dialogHandler);
  }

  /**
   * Get current session state from UI
   * @returns {Promise<'none'|'active'|'paused'|'ended'>}
   */
  async getSessionState() {
    if (await this.sessionActive.isVisible()) return 'active';
    if (await this.sessionPaused.isVisible()) return 'paused';
    if (await this.sessionEnded.isVisible()) return 'ended';
    if (await this.sessionEmpty.isVisible()) return 'none';
    // Check for create button as fallback for empty state
    if (await this.createSessionBtn.isVisible()) return 'none';
    return 'none';
  }

  /**
   * Get current session name from UI
   * @returns {Promise<string|null>} Session name or null if no session
   */
  async getSessionName() {
    // Session name is typically in an element with class session-name or similar
    const sessionNameEl = this.page.locator('#session-status-container .session-name');
    if (await sessionNameEl.isVisible()) {
      return await sessionNameEl.textContent();
    }
    return null;
  }

  /**
   * Ensure no session exists (for test cleanup)
   * Ends any existing session via UI, then verifies "Create New Session" button is visible
   *
   * Use this in afterEach() to ensure clean state between tests:
   * - If session is active → end it
   * - If session is paused → resume then end it
   * - If session already ended or none → no action needed
   *
   * @param {string} baseUrl - Orchestrator URL for backend state verification
   * @throws {Error} If cleanup fails or button not visible within timeout
   */
  async ensureNoSession(baseUrl) {
    // Navigate to admin panel if not already there
    try {
      await this.navigateToAdminPanel();
    } catch (e) {
      // If navigation fails, page might be in bad state - try to recover
      console.log('ensureNoSession: navigateToAdminPanel failed, attempting recovery');
      await this.page.goto('/gm-scanner/');
      await this.page.waitForLoadState('networkidle');
      return; // Fresh page load means no session to clean up
    }

    // Check current session state via API (more reliable than UI)
    let state;
    try {
      state = await this.getStateFromBackend(baseUrl);
    } catch (e) {
      console.log('ensureNoSession: getStateFromBackend failed, assuming no session');
      return;
    }

    // If session exists and not ended, clean it up
    if (state.session && state.session.status !== 'ended') {
      console.log(`ensureNoSession: Found session in state "${state.session.status}", cleaning up`);

      // If paused, resume first (endSession requires active state)
      if (state.session.status === 'paused') {
        await this.resumeSession();
      }

      // End the session
      await this.endSession();
    }

    // Verify "Create New Session" button is now visible (no-session state)
    await this.createSessionBtn.waitFor({ state: 'visible', timeout: 5000 });
  }

  // ============================================
  // Video Control Methods
  // ============================================

  /**
   * Play video
   */
  async playVideo() {
    await this.videoPlayBtn.click();
  }

  /**
   * Pause video
   */
  async pauseVideo() {
    await this.videoPauseBtn.click();
  }

  /**
   * Stop video
   */
  async stopVideo() {
    await this.videoStopBtn.click();
  }

  /**
   * Skip to next video in queue
   */
  async skipVideo() {
    await this.videoSkipBtn.click();
  }

  /**
   * Add video to queue
   * @param {string} filename - Video filename to add
   */
  async addVideoToQueue(filename) {
    await this.manualVideoInput.fill(filename);
    await this.addVideoToQueueBtn.click();
  }

  /**
   * Clear video queue
   * Handles confirmation dialog if present
   */
  async clearVideoQueue() {
    // Setup dialog handler for potential confirmation
    this.page.once('dialog', dialog => dialog.accept());
    await this.clearQueueBtn.click();
  }

  /**
   * Get video queue count from UI
   * @returns {Promise<number>}
   */
  async getVideoQueueCount() {
    const text = await this.videoQueueCount.textContent();
    return parseInt(text, 10) || 0;
  }

  /**
   * Get video progress percentage from UI
   * @returns {Promise<number>} Progress as percentage (0-100)
   */
  async getVideoProgress() {
    const style = await this.videoProgressFill.getAttribute('style');
    const match = style?.match(/width:\s*(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Check if video is currently playing
   * @returns {Promise<boolean>}
   */
  async isVideoPlaying() {
    // Check if pause button is visible (indicates playing state)
    return await this.videoPauseBtn.isVisible();
  }

  // ============================================
  // System Status Methods
  // ============================================

  /**
   * Check if orchestrator is connected
   * @returns {Promise<boolean>}
   */
  async isOrchestratorConnected() {
    const classAttr = await this.orchestratorStatus.getAttribute('class');
    return classAttr?.includes('status-dot--connected') ?? false;
  }

  /**
   * Check if VLC is connected
   * @returns {Promise<boolean>}
   */
  async isVlcConnected() {
    const classAttr = await this.vlcStatus.getAttribute('class');
    return classAttr?.includes('status-dot--connected') ?? false;
  }

  /**
   * Get connected device count from UI
   * @returns {Promise<number>}
   */
  async getDeviceCount() {
    const text = await this.deviceCount.textContent();
    return parseInt(text, 10) || 0;
  }

  /**
   * Get list of connected devices
   * @returns {Promise<Array<{id: string, type: string}>>}
   */
  async getConnectedDevices() {
    const devices = [];
    const count = await this.deviceItems.count();
    for (let i = 0; i < count; i++) {
      const item = this.deviceItems.nth(i);
      const id = await item.getAttribute('data-device-id') || await item.textContent();
      const type = await item.getAttribute('data-device-type') || 'unknown';
      devices.push({ id: id?.trim(), type });
    }
    return devices;
  }

  // ============================================
  // Admin Transaction Log Methods
  // ============================================

  /**
   * Get transaction count from admin transaction log
   * @returns {Promise<number>}
   */
  async getAdminTransactionCount() {
    return await this.adminTransactionItems.count();
  }

  /**
   * Wait for a specific transaction to appear in admin log
   * @param {string} tokenId - Token ID to wait for
   * @param {number} timeout - Timeout in ms (default 5000)
   */
  async waitForTransactionInAdminLog(tokenId, timeout = 5000) {
    await this.page.locator(`#admin-transaction-log .transaction-item:has-text("${tokenId}")`).waitFor({
      state: 'visible',
      timeout
    });
  }

  // ============================================
  // Scoreboard & Team Details Methods
  // ============================================

  /**
   * Open scoreboard screen from scan screen (via scoreboard button)
   */
  async openScoreboard() {
    await this.scoreboardButton.click();
    await this.scoreboardScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Close scoreboard screen
   */
  async closeScoreboard() {
    await this.closeScoreboardBtn.click();
    await this.scoreboardScreen.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Get number of team entries in scoreboard
   * @returns {Promise<number>}
   */
  async getScoreboardEntryCount() {
    return await this.scoreboardEntries.count();
  }

  /**
   * Get team score from scoreboard by team ID
   * @param {string} teamId - Team identifier
   * @returns {Promise<string|null>} - Score text (e.g., "$1,500") or null if not found
   */
  async getTeamScoreFromScoreboard(teamId) {
    // Scope to main scoreboard screen to avoid conflict with admin panel scoreboard
    const entry = this.page.locator(`#scoreboardScreen .scoreboard-entry[data-arg="${teamId}"]`);
    const count = await entry.count();
    if (count === 0) return null;
    return await entry.locator('.scoreboard-score').textContent();
  }

  /**
   * Get team score as numeric value from scoreboard
   * @param {string} teamId - Team identifier
   * @returns {Promise<number|null>} - Score as number or null if not found
   */
  async getTeamScoreNumericFromScoreboard(teamId) {
    const scoreText = await this.getTeamScoreFromScoreboard(teamId);
    if (!scoreText) return null;
    // Parse "$1,500" -> 1500
    return parseInt(scoreText.replace(/[$,]/g, ''), 10);
  }

  /**
   * Check if a team appears in the scoreboard
   * @param {string} teamId - Team identifier
   * @returns {Promise<boolean>}
   */
  async hasTeamInScoreboard(teamId) {
    // Scope to main scoreboard screen to avoid conflict with admin panel scoreboard
    const entry = this.page.locator(`#scoreboardScreen .scoreboard-entry[data-arg="${teamId}"]`);
    return await entry.isVisible();
  }

  /**
   * Wait for a specific team to appear in scoreboard
   * @param {string} teamId - Team identifier
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForTeamInScoreboard(teamId, timeout = 10000) {
    // Scope to main scoreboard screen to avoid conflict with admin panel scoreboard
    await this.page.locator(`#scoreboardScreen .scoreboard-entry[data-arg="${teamId}"]`).waitFor({
      state: 'visible',
      timeout
    });
  }

  /**
   * Wait for team score to reach expected value in scoreboard
   * Uses Playwright's condition-based waiting (auto-retry until condition met)
   *
   * @param {string} teamId - Team identifier
   * @param {number} expectedScore - Expected score value
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForTeamScoreInScoreboard(teamId, expectedScore, timeout = 10000) {
    // Format expected score as it appears in DOM (e.g., "$52,500")
    const formattedScore = `$${expectedScore.toLocaleString()}`;

    // CONDITION-BASED WAITING: Wait for DOM element to contain expected score
    // page.waitForFunction() is Playwright's built-in condition waiter
    // Scope to #scoreboardScreen to avoid conflict with admin panel scoreboard
    await this.page.waitForFunction(
      ({ teamId, formattedScore }) => {
        const scoreEl = document.querySelector(`#scoreboardScreen .scoreboard-entry[data-arg="${teamId}"] .scoreboard-score`);
        return scoreEl && scoreEl.textContent.includes(formattedScore);
      },
      { teamId, formattedScore },
      { timeout }
    );
  }

  /**
   * Open team details screen by clicking on team in scoreboard
   * @param {string} teamId - Team identifier
   */
  async openTeamDetails(teamId) {
    // Scope to main scoreboard screen to avoid conflict with admin panel scoreboard
    const entry = this.page.locator(`#scoreboardScreen .scoreboard-entry[data-arg="${teamId}"]`);
    await entry.click();
    await this.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Close team details screen
   */
  async closeTeamDetails() {
    await this.closeTeamDetailsBtn.click();
    await this.teamDetailsScreen.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Get team details title text
   * @returns {Promise<string>}
   */
  async getTeamDetailsTitle() {
    return await this.teamDetailsTitle.textContent();
  }

  /**
   * Get base score from team details
   * @returns {Promise<string>}
   */
  async getTeamDetailsBaseScore() {
    return await this.teamBaseScore.textContent();
  }

  /**
   * Get bonus score from team details
   * @returns {Promise<string>}
   */
  async getTeamDetailsBonusScore() {
    return await this.teamBonusScore.textContent();
  }

  /**
   * Get count of token cards in team details
   * @returns {Promise<number>}
   */
  async getTeamDetailsTokenCount() {
    return await this.tokenDetailCards.count();
  }

  /**
   * Find token card in team details by token ID
   * @param {string} tokenId - Token ID to find
   * @returns {Promise<boolean>} - True if found
   */
  async hasTokenInTeamDetails(tokenId) {
    const card = this.page.locator(`#teamDetailsContainer .token-card:has-text("${tokenId}"), #teamDetailsContainer .history-entry:has-text("${tokenId}")`);
    return await card.count() > 0;
  }

  /**
   * Delete transaction from team details screen
   * @param {string} tokenId - Token ID of the transaction to delete
   */
  async deleteTransactionFromTeamDetails(tokenId) {
    // Find the token card and its delete button
    const card = this.page.locator(`#teamDetailsContainer .token-card:has-text("${tokenId}"), #teamDetailsContainer .history-entry:has-text("${tokenId}")`);
    const deleteBtn = card.locator('button[data-action="app.deleteTeamTransaction"]');

    // Setup dialog handler BEFORE clicking
    this.page.once('dialog', dialog => dialog.accept());
    await deleteBtn.click();

    // Wait for card to be removed
    await card.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Get all scoreboard entries with details
   * @returns {Promise<Array<{rank: number, team: string, score: string}>>}
   */
  async getAllScoreboardEntries() {
    const entries = await this.scoreboardEntries.all();
    const details = [];
    for (const entry of entries) {
      details.push({
        rank: parseInt(await entry.locator('.scoreboard-rank').textContent(), 10),
        team: await entry.locator('.scoreboard-team').textContent(),
        score: await entry.locator('.scoreboard-score').textContent()
      });
    }
    return details.sort((a, b) => a.rank - b.rank);
  }
}

module.exports = { GMScannerPage };
