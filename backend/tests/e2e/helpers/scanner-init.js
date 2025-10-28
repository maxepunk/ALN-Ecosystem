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

module.exports = { initializeGMScannerWithMode };
