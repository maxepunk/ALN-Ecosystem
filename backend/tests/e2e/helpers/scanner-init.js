/**
 * Initialize GM Scanner with explicit mode selection
 *
 * CRITICAL: This function MUST clear localStorage before navigation to prevent
 * stale session restoration. Previous tests may leave gameSessionMode in localStorage,
 * causing the app to skip #gameModeScreen and silently fail mode selection.
 *
 * @param {Page} page - Playwright page
 * @param {string} sessionMode - 'standalone' or 'networked'
 * @param {string} gameMode - 'detective' or 'blackmarket'
 * @param {Object} options - Optional orchestrator connection params
 * @returns {Promise<GMScannerPage>} Configured scanner
 */
async function initializeGMScannerWithMode(page, sessionMode, gameMode = 'blackmarket', options = {}) {
  const { GMScannerPage } = require('./page-objects/GMScannerPage');
  const gmScanner = new GMScannerPage(page);

  // Navigate to scanner using relative URL (baseURL set in browser context)
  // Browser context isolation ensures localStorage is already clean
  await page.goto('/gm-scanner/', {
    waitUntil: 'networkidle',
    timeout: 10000
  });

  // Wait for app initialization to complete (loading screen may not always appear)
  try {
    await page.waitForSelector('#loadingScreen', { state: 'hidden', timeout: 2000 });
  } catch (e) {
    // Loading screen may already be hidden - that's fine
  }

  // Wait for game mode screen to be visible and READY for interaction
  await page.waitForSelector('#gameModeScreen', { state: 'visible', timeout: 10000 });

  // Select session mode using Page Object pattern (matches ALNScanner tests)
  if (sessionMode === 'networked') {
    await gmScanner.selectNetworkedMode();

    // Connect to orchestrator if provided
    if (options.orchestratorUrl && options.password) {
      await gmScanner.manualConnect(
        options.orchestratorUrl,
        options.stationName || 'Test_Station',
        options.password
      );
      await gmScanner.waitForConnection();
    }
  } else {
    await gmScanner.selectStandaloneMode();
  }

  // Set game mode (detective vs blackmarket)
  const currentModeText = await gmScanner.getModeText();
  const currentMode = currentModeText.toLowerCase().includes('detective') ? 'detective' : 'blackmarket';
  if (currentMode !== gameMode) {
    await gmScanner.toggleMode();
  }

  console.log(`✓ GM Scanner initialized: ${sessionMode} mode, ${gameMode} game mode`);
  return gmScanner;
}

/**
 * Get team score from scanner (works in both modes)
 *
 * IMPORTANT: This function reads production's calculated scores.
 * It does NOT recalculate scores (that would be testing test logic, not production).
 * If this returns 0 when it shouldn't, it indicates a production bug that must be fixed.
 *
 * @param {Page} page - Playwright page
 * @param {string} teamId - Team ID to get score for
 * @param {string} sessionMode - 'standalone' or 'networked'
 * @param {Socket} socket - Socket.io client (optional, required for accurate networked mode score)
 * @returns {Promise<number>} Team score
 */
async function getTeamScore(page, teamId, sessionMode, socket = null) {
  if (sessionMode === 'standalone') {
    // Standalone: read production's calculated score from localStorage
    // StandaloneDataManager should have calculated and saved this
    return await page.evaluate((tid) => {
      const sessionData = JSON.parse(localStorage.getItem('standaloneSession') || '{}');
      const team = sessionData.teams?.[tid];

      // ONLY read production's calculation - no fallback recalculation
      // If this is 0/undefined, test SHOULD FAIL (indicates production bug)
      return team?.score || 0;
    }, teamId);
  } else {
    // Networked: read from backend session via WebSocket (authoritative source)
    if (socket) {
      // WebSocket method: query backend session directly (most accurate)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for session state sync from backend'));
        }, 10000);

        // Listen for sync:full event (contains full session state)
        socket.once('sync:full', (event) => {
          clearTimeout(timeout);

          // Per AsyncAPI contract: scores[] contains TeamScore objects with currentScore
          // session.teams[] is just array of string team IDs (e.g., ["001", "002"])
          const scores = event.data?.scores;
          if (!scores || !Array.isArray(scores)) {
            reject(new Error('Invalid scores data in sync:full event'));
            return;
          }

          // Find team score in backend response (authoritative)
          const teamScore = scores.find(s => s.teamId === teamId);
          if (!teamScore) {
            resolve(0);  // Team not found = 0 score
            return;
          }

          // Return authoritative score from backend
          resolve(teamScore.currentScore || 0);
        });

        // Request state sync from backend via sync:request event
        // Per server.js:69, this is a simple event (no envelope wrapping)
        // Backend responds with sync:full event containing full session state
        socket.emit('sync:request');
      });
    } else {
      // FAIL FAST: Socket required for networked mode
      // Backward compatibility fallback removed - tests must use WebSocket for accurate scores
      throw new Error(`Socket required for getTeamScore() in networked mode. Tests must pass socket parameter to read authoritative backend session state.`);
    }
  }
}

/**
 * Scan a sequence of tokens
 * @param {GMScannerPage} scanner - Scanner page object
 * @param {Array<string>} tokenIds - Token IDs to scan
 * @param {string} teamId - Team ID for scanning
 */
async function scanTokenSequence(scanner, tokenIds, teamId) {
  // Enter team if not already on scan screen
  const onScanScreen = await scanner.page.isVisible(scanner.scanScreen);
  if (!onScanScreen) {
    await scanner.enterTeam(teamId);
    await scanner.confirmTeam();
  }

  // Scan each token
  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    console.log(`  Scanning token ${i + 1}/${tokenIds.length}: ${tokenId}`);

    await scanner.manualScan(tokenId);

    // Wait for result or error
    try {
      await scanner.waitForResult(3000);
      console.log(`    ✓ Token accepted: ${tokenId}`);

      // Continue to next scan (except on last token)
      if (i < tokenIds.length - 1) {
        await scanner.continueScan();
      }
    } catch (e) {
      // Check if error was shown (duplicate/invalid)
      const error = await scanner.getErrorMessage();
      if (error) {
        console.log(`    ✗ Token rejected: ${tokenId} (${error})`);
        // Continue scanning anyway
        if (i < tokenIds.length - 1) {
          await scanner.continueScan();
        }
      } else {
        throw e; // Unexpected error
      }
    }
  }
}

module.exports = { initializeGMScannerWithMode, getTeamScore, scanTokenSequence };
