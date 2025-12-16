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
 * @param {string} options.orchestratorUrl - Orchestrator URL (required for networked mode)
 * @param {string} options.password - Admin password (required for networked mode)
 * @param {string} options.stationName - Scanner station name (optional)
 * @param {string} options.deviceId - Override device ID (optional, auto-generated if not provided)
 * @returns {Promise<GMScannerPage>} Configured scanner
 */
async function initializeGMScannerWithMode(page, sessionMode, gameMode = 'blackmarket', options = {}) {
  const { GMScannerPage } = require('./page-objects/GMScannerPage');
  const gmScanner = new GMScannerPage(page);

  // CRITICAL: Clear stale localStorage and set unique identifiers BEFORE page loads
  // This prevents:
  // 1. DEVICE_ID_COLLISION when parallel browser projects run same tests
  // 2. Session mode restoration causing app to skip #gameModeScreen
  const uniqueDeviceId = options.deviceId || `Test_Scanner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const uniqueStationName = options.stationName || `Test_Station_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  await page.addInitScript(({ deviceId, stationName }) => {
    // CONDITION-BASED FIX: Clear ALL scanner state before setting fresh values
    // Without this, gameSessionMode persists and app skips #gameModeScreen
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('aln_') || key === 'gameSessionMode' || key === 'transactions' || key === 'scannedTokens')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Now set fresh unique identifiers
    localStorage.setItem('deviceId', deviceId);
    // Pre-set station name so connectionWizard uses our unique ID instead of auto-assigning
    localStorage.setItem('aln_station_name', stationName);
  }, { deviceId: uniqueDeviceId, stationName: uniqueStationName });

  // CONDITION-BASED WAIT: Ensure orchestrator is healthy before navigating
  // This prevents flaky failures when orchestrator is still starting up
  if (options.orchestratorUrl) {
    const healthUrl = `${options.orchestratorUrl}/health`;
    const maxWaitMs = 30000;
    const startTime = Date.now();
    let healthy = false;

    while (!healthy && (Date.now() - startTime) < maxWaitMs) {
      try {
        const response = await page.request.get(healthUrl);
        if (response.ok()) {
          healthy = true;
        }
      } catch (e) {
        // Orchestrator not ready yet, keep polling
      }
      if (!healthy) {
        await new Promise(r => setTimeout(r, 100)); // Poll every 100ms
      }
    }

    if (!healthy) {
      throw new Error(`Orchestrator not healthy at ${healthUrl} after ${maxWaitMs}ms`);
    }
  }

  // Navigate to scanner using relative URL
  // baseURL is set via process.env.ORCHESTRATOR_URL in browser-contexts.js
  await page.goto('/gm-scanner/', {
    waitUntil: 'networkidle',
    timeout: 30000  // Increased from 10s - Vite dev server can be slow on Pi
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
      // Generate unique stationName if not provided - prevents DEVICE_ID_COLLISION
      // when parallel browser projects (chromium + mobile-chrome) run same tests
      const uniqueStationName = options.stationName || `Test_Station_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await gmScanner.manualConnect(
        options.orchestratorUrl,
        uniqueStationName,
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
 * BROWSER-ONLY E2E PATTERN: Reads score from visible UI or backend API.
 * Does NOT use WebSocket connections - tests should only use browser interactions.
 *
 * @param {Page} page - Playwright page
 * @param {string} teamId - Team ID to get score for
 * @param {string} sessionMode - 'standalone' or 'networked'
 * @param {string} orchestratorUrl - Orchestrator URL (required for networked mode)
 * @returns {Promise<number>} Team score
 */
async function getTeamScore(page, teamId, sessionMode, orchestratorUrl = null) {
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
    // Networked: read from backend via HTTP API (Playwright's built-in request)
    if (!orchestratorUrl) {
      throw new Error('orchestratorUrl required for getTeamScore() in networked mode');
    }

    // Use Playwright's page.request to query backend state
    const response = await page.request.get(`${orchestratorUrl}/api/state`);
    const state = await response.json();

    // Per AsyncAPI contract: scores[] contains TeamScore objects with currentScore
    const scores = state?.scores;
    if (!scores || !Array.isArray(scores)) {
      return 0;
    }

    // Find team score in backend response (authoritative)
    const teamScore = scores.find(s => s.teamId === teamId);
    return teamScore?.currentScore || 0;
  }
}

/**
 * Scan a sequence of tokens
 * @param {GMScannerPage} scanner - Scanner page object
 * @param {Array<string>} tokenIds - Token IDs to scan
 * @param {string} teamName - Team name for scanning (e.g., 'Team Alpha', 'Detectives')
 * @param {string} sessionMode - 'standalone' or 'networked'
 */
async function scanTokenSequence(scanner, tokenIds, teamName, sessionMode = 'standalone') {
  // Enter team if not already on scan screen
  const onScanScreen = await scanner.page.isVisible(scanner.scanScreen);
  if (!onScanScreen) {
    // Use mode-appropriate team entry method
    if (sessionMode === 'networked') {
      await scanner.selectTeam(teamName);
    } else {
      await scanner.enterTeamName(teamName);
    }
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
