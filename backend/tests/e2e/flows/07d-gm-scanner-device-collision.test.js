/**
 * E2E Test: GM Scanner Device ID Collision Detection
 * Tests auto-assignment prevents collisions and backend rejects duplicate connections
 */

const { test, expect } = require('@playwright/test');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { createTestSession } = require('../helpers/session-helpers');

test.describe('GM Scanner Device ID Collision Prevention', () => {
  let session;
  let orchestratorUrl;

  test.beforeEach(async ({ request }) => {
    // Create test session
    session = await createTestSession(request, {
      name: 'Collision Test Session',
      teams: 2
    });

    orchestratorUrl = process.env.ORCHESTRATOR_URL || 'https://localhost:3000';
  });

  test('should auto-assign sequential device IDs to prevent collision', async ({ browser }) => {
    // Scanner 1 connects
    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    const gmScanner1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
      orchestratorUrl,
      password: process.env.ADMIN_PASSWORD || 'admin123',
      sessionData: session
    });

    // Verify Scanner 1 got GM_Station_1
    const deviceId1 = await page1.evaluate(() => {
      const display = document.getElementById('stationNameDisplay');
      return display ? display.dataset.deviceId : null;
    });
    expect(deviceId1).toBe('GM_Station_1');

    // Scanner 2 connects
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page2 = await context2.newPage();
    const gmScanner2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', {
      orchestratorUrl,
      password: process.env.ADMIN_PASSWORD || 'admin123',
      sessionData: session
    });

    // Verify Scanner 2 got GM_Station_2 (auto-incremented)
    const deviceId2 = await page2.evaluate(() => {
      const display = document.getElementById('stationNameDisplay');
      return display ? display.dataset.deviceId : null;
    });
    expect(deviceId2).toBe('GM_Station_2');

    // Verify both scanners are in /api/state
    const stateResponse = await page1.request.get(`${orchestratorUrl}/api/state`);
    const state = await stateResponse.json();
    const gmDevices = state.devices.filter(d => d.type === 'gm');

    expect(gmDevices).toHaveLength(2);
    expect(gmDevices.some(d => d.deviceId === 'GM_Station_1')).toBe(true);
    expect(gmDevices.some(d => d.deviceId === 'GM_Station_2')).toBe(true);

    await context1.close();
    await context2.close();
  });

  test('should reject connection if deviceId already in use (backend safety net)', async ({ browser }) => {
    // Scanner 1 connects normally
    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
      orchestratorUrl,
      password: process.env.ADMIN_PASSWORD || 'admin123',
      sessionData: session
    });

    // Verify Scanner 1 connected with GM_Station_1
    const deviceId1 = await page1.evaluate(() => {
      const display = document.getElementById('stationNameDisplay');
      return display ? display.dataset.deviceId : null;
    });
    expect(deviceId1).toBe('GM_Station_1');

    // Scanner 2 tries to force same device ID via localStorage manipulation
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page2 = await context2.newPage();

    // Navigate to scanner
    await page2.goto(`${orchestratorUrl}/gm-scanner/`, { waitUntil: 'networkidle' });

    // Select networked mode
    await page2.click('button[data-action="app.selectGameMode"][data-arg="networked"]');

    // Wait for connection modal
    await page2.waitForSelector('#connectionModal[style*="flex"]', { timeout: 5000 });

    // Manually manipulate the display to force collision
    await page2.evaluate(() => {
      const display = document.getElementById('stationNameDisplay');
      if (display) {
        display.textContent = 'GM_Station_1';
        display.dataset.deviceId = 'GM_Station_1'; // Force duplicate
      }
    });

    // Fill server URL and password
    await page2.fill('#serverUrl', orchestratorUrl);
    await page2.fill('#gmPassword', process.env.ADMIN_PASSWORD || 'admin123');

    // Submit form
    const form = page2.locator('#connectionForm');
    await form.evaluate(f => f.requestSubmit());

    // Wait for error message
    await page2.waitForFunction(() => {
      const statusDiv = document.getElementById('connectionStatusMsg');
      return statusDiv && statusDiv.textContent.includes('DEVICE_ID_COLLISION');
    }, { timeout: 5000 });

    // Verify error message contains collision warning
    const errorText = await page2.locator('#connectionStatusMsg').textContent();
    expect(errorText).toContain('DEVICE_ID_COLLISION');
    expect(errorText).toContain('already connected');

    await context1.close();
    await context2.close();
  });
});
