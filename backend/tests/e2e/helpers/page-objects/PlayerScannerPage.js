/**
 * PlayerScannerPage - Page Object Model for ALN Player Scanner PWA
 *
 * Encapsulates interactions with the Player Scanner web application,
 * supporting both standalone (GitHub Pages) and networked (orchestrator) modes.
 *
 * @file backend/tests/e2e/helpers/page-objects/PlayerScannerPage.js
 * @see /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/aln-memory-scanner/index.html
 * @see /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/aln-memory-scanner/js/orchestratorIntegration.js
 * @see /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/docs/E2E_TEST_IMPLEMENTATION_PLAN.md (lines 202-242)
 */

class PlayerScannerPage {
  /**
   * Creates a PlayerScannerPage instance
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  constructor(page) {
    this.page = page;

    /**
     * UI Selectors
     * Based on index.html structure (lines 629-728)
     */
    this.selectors = {
      // Connection Status (networked mode)
      connectionStatus: '#connection-status',
      statusDot: '.status-dot',
      statusText: '.status-text',
      configLink: '.config-link',

      // Loading State
      loadingScreen: '#loadingScreen',
      spinner: '.spinner',

      // Welcome Screen
      welcomeScreen: '#welcomeScreen',
      logo: '.logo',
      scanMethodInfo: '#scanMethodInfo',

      // Scanner Container
      scannerContainer: '#scannerContainer',
      scannerVideo: '#scanner-video',
      scannerOverlay: '.scanner-overlay',
      scanningStatus: '.status.scanning',

      // Memory Display
      memoryDisplay: '#memoryDisplay',
      memoryStatus: '#memoryStatus',
      memoryImage: '#memoryImage',
      audioPlaceholder: '#audioPlaceholder',
      audioControls: '#audioControls',
      memoryAudio: '#memoryAudio',

      // Manual Entry Modal
      manualEntryModal: '#manualEntryModal',
      manualTokenId: '#manualTokenId',

      // Video Processing Modal
      videoProcessing: '#video-processing',
      processingContent: '.processing-content',
      processingSpinner: '.processing-spinner',

      // NFC Indicator
      nfcIndicator: '#nfcIndicator',
      nfcStatus: '#nfcStatus',

      // Install Prompt
      installPrompt: '#installPrompt',

      // Buttons
      startScanningBtn: 'button:has-text("Start Scanning")',
      manualEntryBtn: 'button:has-text("Manual Entry")',
      stopScanningBtn: 'button:has-text("Stop Scanning")',
      continueScanningBtn: 'button:has-text("Continue Scanning")',
      viewCollectionBtn: 'button:has-text("View Collection")',
      playAudioBtn: 'button:has-text("Play Audio")',
      stopAudioBtn: 'button:has-text("Stop")',
      submitManualEntryBtn: 'button:has-text("Submit")',
      cancelManualEntryBtn: 'button:has-text("Cancel")',
      installNowBtn: 'button:has-text("Install Now")',
      installLaterBtn: 'button:has-text("Later")',

      // Error Messages
      errorMessage: '.error-message',
    };
  }

  // ==================== NAVIGATION ====================

  /**
   * Navigate to Player Scanner in standalone mode (GitHub Pages)
   * @param {string} url - GitHub Pages URL (default: http://localhost:8000)
   * @returns {Promise<void>}
   * @example
   * await scanner.gotoStandalone('https://username.github.io/aln-memory-scanner/');
   */
  async gotoStandalone(url = 'http://localhost:8000') {
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.waitForInitialization();

    // Wait for condition: orchestrator initialized in standalone mode
    await this.waitForOrchestratorReady('standalone');

    // Verify standalone mode (should always pass after condition-based wait)
    const isStandalone = await this.page.evaluate(() => {
      return window.orchestrator?.isStandalone === true;
    });

    if (!isStandalone) {
      // This should never happen after condition-based wait
      throw new Error('FATAL: Standalone mode not detected after waiting for condition');
    }
  }

  /**
   * Navigate to Player Scanner in networked mode (orchestrator-hosted)
   * @param {string} baseUrl - Orchestrator URL (default: https://localhost:3000)
   * @returns {Promise<void>}
   * @example
   * await scanner.gotoNetworked('https://orchestrator-ip:3000');
   */
  async gotoNetworked(baseUrl = 'https://localhost:3000') {
    const url = `${baseUrl}/player-scanner/`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.waitForInitialization();

    // Wait for condition: orchestrator initialized in networked mode
    await this.waitForOrchestratorReady('networked');

    // CRITICAL FIX: Wait for orchestrator to establish connection
    // Without this, scanToken() will queue offline instead of sending HTTP POST
    await this.waitForOrchestratorConnected();

    // Verify networked mode (should always pass after condition-based wait)
    const isNetworked = await this.page.evaluate(() => {
      return window.orchestrator?.isStandalone === false;
    });

    if (!isNetworked) {
      // This should never happen after condition-based wait
      throw new Error('FATAL: Networked mode not detected after waiting for condition');
    }
  }

  /**
   * Wait for app initialization (loading screen disappears, welcome screen shows)
   * @returns {Promise<void>}
   */
  async waitForInitialization() {
    // Wait for loading to complete
    await this.page.waitForSelector(this.selectors.loadingScreen, {
      state: 'hidden',
      timeout: 10000
    });

    // Wait for welcome screen to appear
    await this.page.waitForSelector(this.selectors.welcomeScreen, {
      state: 'visible',
      timeout: 5000
    });
  }

  /**
   * Wait for orchestrator to be initialized with condition-based polling.
   * Uses condition-based waiting (not arbitrary timeout).
   *
   * @param {string|null} expectedMode - Expected mode ('networked', 'standalone', or null for any)
   * @returns {Promise<void>}
   * @throws {Error} If orchestrator not initialized within timeout or wrong mode detected
   */
  async waitForOrchestratorReady(expectedMode = null) {
    await this.page.waitForFunction(
      (mode) => {
        // Wait for orchestrator object to exist
        if (!window.orchestrator) return false;

        // If no mode specified, just check existence
        if (mode === null) return true;

        // Verify mode if specified
        if (mode === 'networked') {
          return window.orchestrator.isStandalone === false;
        } else if (mode === 'standalone') {
          return window.orchestrator.isStandalone === true;
        }

        return false;
      },
      expectedMode,  // ARG must come BEFORE options in Playwright API
      { timeout: 5000, polling: 10 }  // Poll every 10ms (not too fast, not too slow)
    );
  }

  /**
   * Wait for orchestrator to establish connection (networked mode only).
   * Uses condition-based polling to wait for orchestrator.connected === true.
   *
   * CRITICAL: orchestratorIntegration.js performs async connection check on init.
   * Initial check takes ~5s, then polls every 10s. Tests MUST wait for this.
   *
   * @returns {Promise<void>}
   * @throws {Error} If connection not established within timeout
   * @see aln-memory-scanner/js/orchestratorIntegration.js:224-246 (connection monitoring)
   */
  async waitForOrchestratorConnected() {
    await this.page.waitForFunction(
      () => {
        // Wait for orchestrator to report connected status
        if (!window.orchestrator) return false;
        return window.orchestrator.connected === true;
      },
      { timeout: 15000, polling: 100 }  // 15s timeout for initial connection check
    );
  }

  /**
   * Wait for orchestrator to report disconnected status (networked mode only).
   * Uses condition-based polling to wait for orchestrator.connected === false.
   *
   * CRITICAL: After context.setOffline(true), connection monitor must detect offline state.
   * Connection check runs every 10s, so next check could be up to 10s away.
   * This method waits for actual state change, not arbitrary timeout.
   *
   * @returns {Promise<void>}
   * @throws {Error} If disconnection not detected within timeout
   * @see aln-memory-scanner/js/orchestratorIntegration.js:201-238 (checkConnection)
   */
  async waitForOrchestratorDisconnected() {
    await this.page.waitForFunction(
      () => {
        // Wait for orchestrator to report disconnected status
        if (!window.orchestrator) return false;
        return window.orchestrator.connected === false;
      },
      { timeout: 15000, polling: 100 }  // 15s timeout to allow for next connection check cycle
    );
  }

  // ==================== SCANNING ====================

  /**
   * Start scanning (QR or NFC depending on device capabilities)
   * @returns {Promise<void>}
   */
  async startScanning() {
    await this.page.click(this.selectors.startScanningBtn);

    // Wait for scanner container to become active
    await this.page.waitForSelector(`${this.selectors.scannerContainer}.active`, {
      timeout: 5000
    });
  }

  /**
   * Stop scanning and return to welcome screen
   * @returns {Promise<void>}
   */
  async stopScanning() {
    await this.page.click(this.selectors.stopScanningBtn);

    // Wait for welcome screen to reappear
    await this.page.waitForSelector(`${this.selectors.welcomeScreen}:not(.hidden)`, {
      timeout: 5000
    });
  }

  /**
   * Simulate a token scan by calling handleScan() directly
   * This bypasses the UI and simulates the scan result being processed.
   * Matches the NFC simulation pattern used in GM Scanner tests.
   *
   * @param {string} tokenId - Token ID to scan
   * @returns {Promise<void>}
   * @example
   * await scanner.simulateScan('test_image_01');
   */
  async simulateScan(tokenId) {
    await this.page.evaluate((id) => {
      if (!window.app) {
        throw new Error('Player Scanner app not initialized');
      }
      // Call handleScan directly (simulates NFC/QR scan result)
      window.app.handleScan(id);
    }, tokenId);

    // Wait for memory display to become active (condition-based, not arbitrary timeout)
    await this.waitForMemoryDisplay();
  }

  /**
   * Open manual entry modal
   * @returns {Promise<void>}
   */
  async openManualEntry() {
    await this.page.click(this.selectors.manualEntryBtn);

    // Wait for modal to appear
    await this.page.waitForSelector(`${this.selectors.manualEntryModal}.active`, {
      timeout: 3000
    });
  }

  /**
   * Enter token ID via manual entry modal
   * @param {string} tokenId - Token ID to enter
   * @returns {Promise<void>}
   * @example
   * await scanner.manualScan('mab002');
   */
  async manualEntry(tokenId) {
    // Open modal if not already open
    const modalVisible = await this.page.isVisible(`${this.selectors.manualEntryModal}.active`);
    if (!modalVisible) {
      await this.openManualEntry();
    }

    // Enter token ID
    await this.page.fill(this.selectors.manualTokenId, tokenId);

    // Submit
    await this.page.click(this.selectors.submitManualEntryBtn);

    // Wait for modal to close
    await this.page.waitForSelector(this.selectors.manualEntryModal, {
      state: 'hidden',
      timeout: 3000
    });
  }

  /**
   * Cancel manual entry modal
   * @returns {Promise<void>}
   */
  async cancelManualEntry() {
    await this.page.click(this.selectors.cancelManualEntryBtn);

    // Wait for modal to close
    await this.page.waitForSelector(this.selectors.manualEntryModal, {
      state: 'hidden',
      timeout: 3000
    });
  }

  /**
   * Wait for memory display to appear after scan
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<void>}
   */
  async waitForMemoryDisplay(timeout = 5000) {
    await this.page.waitForSelector(`${this.selectors.memoryDisplay}.active`, {
      timeout
    });
  }

  /**
   * Continue scanning after viewing memory
   * @returns {Promise<void>}
   */
  async continueScan() {
    await this.page.click(this.selectors.continueScanningBtn);

    // Wait for scanner to become active again
    await this.page.waitForSelector(`${this.selectors.scannerContainer}.active`, {
      timeout: 5000
    });
  }

  // ==================== MEDIA INTERACTION ====================

  /**
   * Get the displayed image source URL
   * @returns {Promise<string|null>} - Image src attribute or null if not visible
   */
  async getDisplayedImage() {
    const isVisible = await this.page.isVisible(this.selectors.memoryImage);
    if (!isVisible) {
      return null;
    }

    return await this.page.getAttribute(this.selectors.memoryImage, 'src');
  }

  /**
   * Check if audio controls are visible
   * @returns {Promise<boolean>}
   */
  async hasAudioControls() {
    return await this.page.isVisible(`${this.selectors.audioControls}.active`);
  }

  /**
   * Check if audio placeholder is visible (audio-only token)
   * @returns {Promise<boolean>}
   */
  async hasAudioPlaceholder() {
    const placeholder = this.page.locator(this.selectors.audioPlaceholder);
    const display = await placeholder.evaluate(el => window.getComputedStyle(el).display);
    return display !== 'none';
  }

  /**
   * Play audio for the current memory
   * @returns {Promise<void>}
   */
  async playAudio() {
    const hasControls = await this.hasAudioControls();
    if (!hasControls) {
      throw new Error('Audio controls not visible - no audio for this token');
    }

    await this.page.click(this.selectors.playAudioBtn);
  }

  /**
   * Stop audio playback
   * @returns {Promise<void>}
   */
  async stopAudio() {
    await this.page.click(this.selectors.stopAudioBtn);
  }

  /**
   * Get audio element state
   * @returns {Promise<{src: string, paused: boolean, currentTime: number, duration: number}>}
   */
  async getAudioState() {
    return await this.page.evaluate((selector) => {
      const audio = document.querySelector(selector);
      if (!audio) return null;

      return {
        src: audio.src,
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration
      };
    }, this.selectors.memoryAudio);
  }

  // ==================== CONNECTION STATUS (Networked Mode) ====================

  /**
   * Get connection status indicator state
   * @returns {Promise<{status: string, connected: boolean}>}
   * @example
   * const status = await scanner.getConnectionStatus();
   * // Returns: { status: 'Online', connected: true }
   */
  async getConnectionStatus() {
    const statusText = await this.page.textContent(this.selectors.statusText);
    const isConnected = await this.page.evaluate((selector) => {
      const statusElement = document.querySelector(selector);
      return statusElement?.classList.contains('connected') ?? false;
    }, this.selectors.connectionStatus);

    return {
      status: statusText.trim(),
      connected: isConnected
    };
  }

  /**
   * Check if connected to orchestrator
   * @returns {Promise<boolean>}
   */
  async isConnected() {
    const status = await this.getConnectionStatus();
    return status.connected;
  }

  /**
   * Get offline queue size (networked mode only)
   * @returns {Promise<number>}
   */
  async getOfflineQueueSize() {
    return await this.page.evaluate(() => {
      if (!window.orchestrator) return 0;
      return window.orchestrator.offlineQueue?.length ?? 0;
    });
  }

  /**
   * Get orchestrator integration status
   * @returns {Promise<{isStandalone: boolean, connected: boolean, queueSize: number, deviceId: string}>}
   */
  async getOrchestratorStatus() {
    return await this.page.evaluate(() => {
      if (!window.orchestrator) {
        return {
          isStandalone: true,
          connected: false,
          queueSize: 0,
          deviceId: null
        };
      }

      return {
        isStandalone: window.orchestrator.isStandalone,
        connected: window.orchestrator.connected,
        queueSize: window.orchestrator.offlineQueue?.length ?? 0,
        deviceId: window.orchestrator.deviceId
      };
    });
  }

  /**
   * Open configuration page
   * @returns {Promise<void>}
   */
  async openConfiguration() {
    await this.page.click(this.selectors.configLink);

    // Wait for navigation to config.html
    await this.page.waitForURL(/config\.html$/);
  }

  // ==================== COLLECTION ====================

  /**
   * View collection (opens alert with collected token list)
   * @returns {Promise<void>}
   */
  async viewCollection() {
    await this.page.click(this.selectors.viewCollectionBtn);

    // Wait for alert to appear (handled by page.on('dialog'))
  }

  /**
   * Get count of collected tokens
   * @returns {Promise<number>}
   */
  async getCollectedCount() {
    return await this.page.evaluate(() => {
      if (!window.app) return 0;
      return window.app.scannedTokens?.size ?? 0;
    });
  }

  /**
   * Get list of collected token IDs
   * @returns {Promise<string[]>}
   */
  async getCollectedTokenIds() {
    return await this.page.evaluate(() => {
      if (!window.app) return [];
      return Array.from(window.app.scannedTokens || []);
    });
  }

  /**
   * Check if a token has been collected
   * @param {string} tokenId - Token ID to check
   * @returns {Promise<boolean>}
   */
  async hasCollectedToken(tokenId) {
    return await this.page.evaluate((id) => {
      if (!window.app) return false;
      return window.app.scannedTokens?.has(id) ?? false;
    }, tokenId);
  }

  /**
   * Clear all collected tokens (localStorage)
   * @returns {Promise<void>}
   */
  async clearCollection() {
    await this.page.evaluate(() => {
      localStorage.removeItem('alnMemoryScanner');
      if (window.app) {
        window.app.scannedTokens = new Set();
      }
    });
  }

  // ==================== STATE VERIFICATION ====================

  /**
   * Check if video processing modal is visible
   * @returns {Promise<boolean>}
   */
  async isVideoProcessingModalVisible() {
    return await this.page.isVisible(`${this.selectors.videoProcessing}.active`);
  }

  /**
   * Wait for video processing modal to appear
   * @param {number} timeout - Timeout in milliseconds (default: 3000)
   * @returns {Promise<void>}
   */
  async waitForVideoProcessingModal(timeout = 3000) {
    await this.page.waitForSelector(`${this.selectors.videoProcessing}.active`, {
      timeout
    });
  }

  /**
   * Wait for video processing modal to disappear
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<void>}
   */
  async waitForVideoProcessingModalHidden(timeout = 5000) {
    await this.page.waitForSelector(this.selectors.videoProcessing, {
      state: 'hidden',
      timeout
    });
  }

  /**
   * Get current screen state
   * @returns {Promise<'loading'|'welcome'|'scanner'|'memory'>}
   */
  async getCurrentScreen() {
    return await this.page.evaluate((selectors) => {
      if (document.querySelector(`${selectors.loadingScreen}:not([style*="display: none"])`)) {
        return 'loading';
      }
      if (document.querySelector(`${selectors.scannerContainer}.active`)) {
        return 'scanner';
      }
      if (document.querySelector(`${selectors.memoryDisplay}.active`)) {
        return 'memory';
      }
      if (document.querySelector(`${selectors.welcomeScreen}:not(.hidden)`)) {
        return 'welcome';
      }
      return 'unknown';
    }, this.selectors);
  }

  /**
   * Get memory status text (new vs revisited)
   * @returns {Promise<string>}
   */
  async getMemoryStatus() {
    return await this.page.textContent(this.selectors.memoryStatus);
  }

  /**
   * Check if memory is marked as new
   * @returns {Promise<boolean>}
   */
  async isNewMemory() {
    const status = await this.getMemoryStatus();
    return status.includes('✨ New Memory!');
  }

  /**
   * Check if memory is marked as revisited
   * @returns {Promise<boolean>}
   */
  async isRevisitedMemory() {
    const status = await this.getMemoryStatus();
    return status.includes('✓ Memory Revisited');
  }

  // ==================== ERROR HANDLING ====================

  /**
   * Get error message text (if visible)
   * @returns {Promise<string|null>}
   */
  async getErrorMessage() {
    const isVisible = await this.page.isVisible(this.selectors.errorMessage);
    if (!isVisible) {
      return null;
    }

    return await this.page.textContent(this.selectors.errorMessage);
  }

  /**
   * Check if error message is currently displayed
   * @returns {Promise<boolean>}
   */
  async hasErrorMessage() {
    return await this.page.isVisible(this.selectors.errorMessage);
  }

  /**
   * Wait for error message to appear
   * @param {number} timeout - Timeout in milliseconds (default: 3000)
   * @returns {Promise<string>} - Error message text
   */
  async waitForError(timeout = 3000) {
    await this.page.waitForSelector(this.selectors.errorMessage, {
      state: 'visible',
      timeout
    });

    return await this.getErrorMessage();
  }

  /**
   * Wait for error message to disappear (auto-dismisses after 3s)
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<void>}
   */
  async waitForErrorDismissed(timeout = 5000) {
    await this.page.waitForSelector(this.selectors.errorMessage, {
      state: 'hidden',
      timeout
    });
  }

  // ==================== PWA FEATURES ====================

  /**
   * Check if install prompt is visible
   * @returns {Promise<boolean>}
   */
  async isInstallPromptVisible() {
    return await this.page.isVisible(`${this.selectors.installPrompt}.show`);
  }

  /**
   * Trigger PWA install prompt
   * @returns {Promise<void>}
   */
  async installPWA() {
    await this.page.click(this.selectors.installNowBtn);
  }

  /**
   * Dismiss PWA install prompt
   * @returns {Promise<void>}
   */
  async dismissInstallPrompt() {
    await this.page.click(this.selectors.installLaterBtn);

    // Wait for prompt to hide
    await this.page.waitForSelector(this.selectors.installPrompt, {
      state: 'hidden',
      timeout: 3000
    });
  }

  /**
   * Check if running as installed PWA
   * @returns {Promise<boolean>}
   */
  async isInstalledPWA() {
    return await this.page.evaluate(() => {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.navigator.standalone === true;
    });
  }

  // ==================== DEVICE CAPABILITIES ====================

  /**
   * Get available scan methods (QR, NFC, Manual Entry)
   * @returns {Promise<{qr: boolean, nfc: boolean, manual: boolean}>}
   */
  async getAvailableScanMethods() {
    return await this.page.evaluate(() => {
      const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasNFC = 'NDEFReader' in window;

      return {
        qr: hasCamera,
        nfc: hasNFC,
        manual: true // Always available
      };
    });
  }

  /**
   * Get scan method info text from welcome screen
   * @returns {Promise<string>}
   */
  async getScanMethodInfo() {
    return await this.page.textContent(this.selectors.scanMethodInfo);
  }

  /**
   * Check if NFC indicator is visible
   * @returns {Promise<boolean>}
   */
  async isNFCIndicatorVisible() {
    return await this.page.isVisible(`${this.selectors.nfcIndicator}.active`);
  }

  /**
   * Get NFC status text
   * @returns {Promise<string>}
   */
  async getNFCStatus() {
    return await this.page.textContent(this.selectors.nfcStatus);
  }

  // ==================== DEBUG & TESTING ====================

  /**
   * Get app internal state (for debugging)
   * @returns {Promise<{tokens: number, scanned: number, isScanning: boolean}>}
   */
  async getAppState() {
    return await this.page.evaluate(() => {
      if (!window.app) {
        return { tokens: 0, scanned: 0, isScanning: false };
      }

      return {
        tokens: Object.keys(window.app.tokens || {}).length,
        scanned: window.app.scannedTokens?.size ?? 0,
        isScanning: window.app.isScanning
      };
    });
  }

  /**
   * Simulate scan by directly calling handleScan method
   * @param {string} tokenId - Token ID to simulate
   * @returns {Promise<void>}
   */
  async simulateScan(tokenId) {
    await this.page.evaluate((id) => {
      if (window.app) {
        window.app.handleScan(id);
      }
    }, tokenId);
  }

  /**
   * Load test token database (for testing with custom tokens)
   * @param {Object} tokens - Token database object
   * @returns {Promise<void>}
   */
  async loadTestTokens(tokens) {
    await this.page.evaluate((tokenData) => {
      if (window.app) {
        window.app.tokens = tokenData;
      }
    }, tokens);
  }

  /**
   * Get localStorage data (for debugging persistence)
   * @returns {Promise<Object>}
   */
  async getLocalStorageData() {
    return await this.page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          data[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          data[key] = localStorage.getItem(key);
        }
      }
      return data;
    });
  }

  /**
   * Clear all localStorage (reset app state)
   * @returns {Promise<void>}
   */
  async clearAllStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Take screenshot of current state
   * @param {string} filename - Screenshot filename
   * @returns {Promise<void>}
   */
  async screenshot(filename) {
    await this.page.screenshot({ path: filename, fullPage: true });
  }

  /**
   * Wait for console error
   * @param {number} timeout - Timeout in milliseconds (default: 3000)
   * @returns {Promise<string>} - Error message
   */
  async waitForConsoleError(timeout = 3000) {
    return await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('No console error within timeout'));
      }, timeout);

      this.page.once('console', msg => {
        if (msg.type() === 'error') {
          clearTimeout(timeoutId);
          resolve(msg.text());
        }
      });
    });
  }
}

module.exports = PlayerScannerPage;
