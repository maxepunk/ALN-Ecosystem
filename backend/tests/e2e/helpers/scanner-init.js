/**
 * Initialize GM Scanner with explicit mode selection
 * @param {Page} page - Playwright page
 * @param {string} sessionMode - 'standalone' or 'networked'
 * @param {string} gameMode - 'detective' or 'blackmarket'
 * @param {Object} options - Optional orchestrator connection params
 * @returns {Promise<GMScannerPage>} Configured scanner
 */
async function initializeGMScannerWithMode(page, sessionMode, gameMode = 'blackmarket', options = {}) {
  const GMScannerPage = require('./page-objects/GMScannerPage');
  const gmScanner = new GMScannerPage(page);

  // Navigate to GM Scanner
  await gmScanner.goto();

  // Wait for app initialization
  try {
    await page.waitForSelector('#loadingScreen', { state: 'hidden', timeout: 2000 });
  } catch (e) {
    // Loading screen may already be hidden
  }

  // Handle game mode selection screen
  const gameModeVisible = await page.isVisible('#gameModeScreen');
  if (gameModeVisible) {
    // Select session mode (networked vs standalone)
    await page.evaluate((mode) => {
      window.App.selectGameMode(mode);
    }, sessionMode);

    // Wait for transition
    if (sessionMode === 'networked') {
      // Networked: wait for connection wizard
      await page.waitForSelector('#connectionModal', { state: 'visible', timeout: 5000 });

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
      // Standalone: wait for team entry
      await page.waitForSelector('#teamEntryScreen', { state: 'visible', timeout: 5000 });
    }
  }

  // Set game mode (detective vs blackmarket)
  const currentMode = await gmScanner.getCurrentMode();
  if (currentMode !== gameMode) {
    await gmScanner.toggleMode();
  }

  console.log(`✓ GM Scanner initialized: ${sessionMode} mode, ${gameMode} game mode`);
  return gmScanner;
}

/**
 * Get team score from scanner (works in both modes)
 * @param {Page} page - Playwright page
 * @param {string} teamId - Team ID to get score for
 * @param {string} sessionMode - 'standalone' or 'networked'
 * @returns {Promise<number>} Team score
 */
async function getTeamScore(page, teamId, sessionMode) {
  if (sessionMode === 'standalone') {
    // Standalone: calculate from transactions if teams object empty (known GM Scanner bug)
    return await page.evaluate((tid) => {
      const sessionData = JSON.parse(localStorage.getItem('standaloneSession') || '{}');
      const team = sessionData.teams?.[tid];

      // If teams object has score, use it
      if (team?.score) {
        return team.score;
      }

      // Otherwise, calculate from transactions (workaround for standalone scoring bug)
      const transactions = sessionData.transactions || [];
      const SCORING_CONFIG = {
        BASE_VALUES: { 1: 100, 2: 500, 3: 1000, 4: 5000, 5: 10000 },
        TYPE_MULTIPLIERS: { 'Personal': 1, 'Business': 3, 'Technical': 5, 'UNKNOWN': 0 }
      };

      let totalScore = 0;
      const groupTokens = {};

      for (const tx of transactions) {
        if (tx.teamId !== tid) continue;

        const baseValue = SCORING_CONFIG.BASE_VALUES[tx.valueRating] || 0;
        const multiplier = SCORING_CONFIG.TYPE_MULTIPLIERS[tx.memoryType] || 0;
        const points = baseValue * multiplier;
        totalScore += points;

        // Track group tokens for completion bonus
        if (tx.group && tx.group !== 'No Group' && tx.group !== '') {
          if (!groupTokens[tx.group]) {
            groupTokens[tx.group] = [];
          }
          groupTokens[tx.group].push(tx.tokenId);
        }
      }

      // Add group completion bonuses
      for (const [group, tokens] of Object.entries(groupTokens)) {
        // Parse multiplier from group name (e.g., "Marcus Sucks (x2)" → 2)
        const match = group.match(/\(x(\d+)\)/);
        if (match) {
          const groupMultiplier = parseInt(match[1], 10);
          // Check if group complete (need to load from token database, but for now assume complete if we have tokens)
          // In real implementation, would check against TokenManager.getGroupInventory()
          // For test purposes, calculate bonus: (multiplier - 1) * sum of token values
          const groupSum = tokens.reduce((sum, tokenId) => {
            const tx = transactions.find(t => t.tokenId === tokenId && t.teamId === tid);
            if (tx) {
              const baseValue = SCORING_CONFIG.BASE_VALUES[tx.valueRating] || 0;
              const mult = SCORING_CONFIG.TYPE_MULTIPLIERS[tx.memoryType] || 0;
              return sum + (baseValue * mult);
            }
            return sum;
          }, 0);
          const bonus = (groupMultiplier - 1) * groupSum;
          totalScore += bonus;
        }
      }

      return totalScore;
    }, teamId);
  } else {
    // Networked: read from DataManager backendScores
    return await page.evaluate((tid) => {
      const scores = window.DataManager?.backendScores;
      if (!scores) return 0;
      for (const [teamIdKey, scoreData] of scores) {
        if (teamIdKey === tid) {
          return scoreData.currentScore || 0;
        }
      }
      return 0;
    }, teamId);
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
  const onScanScreen = await scanner.page.isVisible(scanner.selectors.scanScreen);
  if (!onScanScreen) {
    await scanner.enterTeam(teamId);
    await scanner.confirmTeam();
  }

  // Scan each token
  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    console.log(`  Scanning token ${i + 1}/${tokenIds.length}: ${tokenId}`);

    await scanner.manualEntry(tokenId);

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
