/**
 * Standalone Scoring Debug Script
 * Minimal reproduction of mab002 scoring bug with full diagnostics
 */

const { chromium } = require('@playwright/test');

async function debugStandaloneScoring() {
  console.log('=== Starting Standalone Scoring Debug Session ===\n');

  const browser = await chromium.launch({
    headless: true, // Run headless (no X server available)
    slowMo: 0
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture ALL console messages from browser
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });

  // Load GM Scanner in standalone mode
  console.log('Loading GM Scanner from submodule...\n');
  await page.goto('file:///home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner/index.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Select standalone mode
  console.log('Selecting standalone mode...\n');
  await page.evaluate(() => {
    window.App.selectSessionMode('standalone');
  });
  await page.waitForTimeout(500);

  // Select blackmarket game mode
  console.log('Selecting blackmarket game mode...\n');
  await page.evaluate(() => {
    window.App.selectGameMode('blackmarket');
  });
  await page.waitForTimeout(500);

  // Enter team ID
  console.log('Entering team 001...\n');
  await page.evaluate(() => {
    window.App.currentTeamId = '001';
    window.UIManager.showScreen('scan');
  });
  await page.waitForTimeout(500);

  // Scan sequence: sof002, rat002, mab002
  const tokens = [
    { id: 'sof002', expected: 500, name: 'Personal 2-star, no group' },
    { id: 'rat002', expected: 15000, name: 'Business 4-star, no group' },
    { id: 'mab002', expected: 10000, name: 'Personal 5-star, Marcus Sucks (x2) group' }
  ];

  let expectedTotal = 0;

  for (const token of tokens) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Scanning token: ${token.id} (${token.name})`);
    console.log(`Expected points: ${token.expected}`);
    console.log(`${'='.repeat(80)}\n`);

    await page.evaluate((tokenId) => {
      if (!window.UIManager.updateScoreboard) {
        window.UIManager.updateScoreboard = () => {};
      }
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, token.id);

    await page.waitForTimeout(2000); // Wait for processing

    // Read current score from localStorage
    const scoreData = await page.evaluate(() => {
      const sessionData = JSON.parse(localStorage.getItem('standaloneSession') || '{}');
      return {
        teams: sessionData.teams,
        transactions: sessionData.transactions
      };
    });

    const team001 = scoreData.teams?.['001'];
    expectedTotal += token.expected;

    console.log(`\n--- Score After ${token.id} ---`);
    if (team001) {
      console.log(`  Base Score: ${team001.baseScore}`);
      console.log(`  Bonus Points: ${team001.bonusPoints}`);
      console.log(`  Total Score: ${team001.score}`);
      console.log(`  Tokens Scanned: ${team001.tokensScanned}`);
      console.log(`  Completed Groups: ${JSON.stringify(team001.completedGroups)}`);
    } else {
      console.log(`  ERROR: Team 001 not found in session data!`);
    }

    console.log(`\n  Expected Total So Far: ${expectedTotal}`);
    console.log(`  Actual Total: ${team001?.score || 0}`);
    console.log(`  Difference: ${(team001?.score || 0) - expectedTotal}`);

    // Click continue to scan next
    if (token.id !== 'mab002') {
      await page.click('#continueScanButton');
      await page.waitForTimeout(500);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL RESULTS');
  console.log(`${'='.repeat(80)}\n`);

  const finalScore = await page.evaluate(() => {
    const sessionData = JSON.parse(localStorage.getItem('standaloneSession') || '{}');
    return sessionData.teams?.['001'];
  });

  console.log('Final Team 001 Score:', finalScore);
  console.log(`\nExpected Total: 25500`);
  console.log(`Actual Total: ${finalScore?.score || 0}`);
  console.log(`BUG: Missing ${25500 - (finalScore?.score || 0)} points`);

  if (finalScore?.score === 15500) {
    console.log(`\n❌ BUG CONFIRMED: mab002's 10,000 points missing!`);
  } else if (finalScore?.score === 25500) {
    console.log(`\n✅ BUG FIXED: All points counted correctly!`);
  } else {
    console.log(`\n⚠️  UNEXPECTED: Score is ${finalScore?.score}, expected 15500 (bug) or 25500 (fixed)`);
  }

  console.log('\n=== Debug Session Complete ===\n');

  await browser.close();
}

debugStandaloneScoring().catch(console.error);
