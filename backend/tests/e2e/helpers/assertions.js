/**
 * E2E Test Custom Assertions
 *
 * Custom assertions for E2E tests using Playwright expect.
 * Provides domain-specific assertions for ALN Ecosystem components.
 */

const { expect } = require('@playwright/test');

/**
 * Assert WebSocket event envelope structure
 * All events must follow wrapped envelope pattern per AsyncAPI contract.
 *
 * @param {Object} event - Event object
 * @param {string} expectedType - Expected event type
 */
function assertEventEnvelope(event, expectedType) {
  expect(event).toHaveProperty('event', expectedType);
  expect(event).toHaveProperty('data');
  expect(event).toHaveProperty('timestamp');
  expect(typeof event.timestamp).toBe('string');

  // Validate timestamp is valid ISO 8601
  const timestamp = new Date(event.timestamp);
  expect(timestamp.toString()).not.toBe('Invalid Date');
}

/**
 * Assert connection indicator shows correct status
 *
 * @param {Page} page - Playwright page
 * @param {boolean} shouldBeConnected - Expected connection state
 */
async function assertConnectionStatus(page, shouldBeConnected) {
  const statusEl = page.locator('#connectionStatus');

  if (shouldBeConnected) {
    await expect(statusEl).toHaveClass(/connected/);
    await expect(statusEl).toBeVisible();
  } else {
    await expect(statusEl).not.toHaveClass(/connected/);
  }
}

/**
 * Assert score display format matches mode
 *
 * @param {Page} page - Playwright page
 * @param {string} mode - 'detective' | 'blackmarket'
 * @param {number} scoreValue - Score value to check
 */
async function assertScoreFormat(page, mode, scoreValue) {
  const scoreEl = page.locator('#teamTotalValue');

  if (mode === 'detective') {
    // Stars format: ⭐⭐⭐
    await expect(scoreEl).toContainText('⭐');
  } else {
    // Currency format: $5000
    await expect(scoreEl).toContainText('$');
    await expect(scoreEl).toContainText(scoreValue.toString());
  }
}

/**
 * Assert VLC status matches expected state
 *
 * @param {Object} status - VLC status object from API
 * @param {string} expectedState - 'playing' | 'paused' | 'stopped'
 */
function assertVLCStatus(status, expectedState) {
  expect(status).toHaveProperty('state', expectedState);

  if (expectedState === 'playing') {
    expect(status.length).toBeGreaterThan(0); // Duration in seconds
    expect(status.information).toBeDefined();
    expect(status.information.category).toBeDefined();
    expect(status.information.category.meta).toHaveProperty('filename');
  }
}

/**
 * Assert transaction object structure
 *
 * @param {Object} transaction - Transaction object
 */
function assertTransactionStructure(transaction) {
  expect(transaction).toHaveProperty('id');
  expect(transaction).toHaveProperty('tokenId');
  expect(transaction).toHaveProperty('teamId');
  expect(transaction).toHaveProperty('deviceId');
  expect(transaction).toHaveProperty('mode');
  expect(transaction).toHaveProperty('points');
  expect(transaction).toHaveProperty('timestamp');

  // Validate mode enum
  expect(['detective', 'blackmarket']).toContain(transaction.mode);
}

/**
 * Assert session object structure
 *
 * @param {Object} session - Session object
 */
function assertSessionStructure(session) {
  expect(session).toHaveProperty('id');
  expect(session).toHaveProperty('name');
  expect(session).toHaveProperty('startTime');
  expect(session).toHaveProperty('status');
  expect(session).toHaveProperty('teams');
  expect(session).toHaveProperty('metadata');

  // Validate status enum
  expect(['active', 'paused', 'ended']).toContain(session.status);

  // Validate teams is array
  expect(Array.isArray(session.teams)).toBe(true);
}

/**
 * Assert score object structure
 *
 * @param {Object} score - Score object from sync:full or score:updated
 */
function assertScoreStructure(score) {
  // All 8 fields REQUIRED per AsyncAPI contract
  expect(score).toHaveProperty('teamId');
  expect(score).toHaveProperty('currentScore');
  expect(score).toHaveProperty('baseScore');
  expect(score).toHaveProperty('bonusPoints');
  expect(score).toHaveProperty('tokensScanned');
  expect(score).toHaveProperty('completedGroups');
  expect(score).toHaveProperty('adminAdjustments');
  expect(score).toHaveProperty('lastUpdate');

  // Validate types
  expect(typeof score.currentScore).toBe('number');
  expect(typeof score.baseScore).toBe('number');
  expect(typeof score.bonusPoints).toBe('number');
  expect(typeof score.tokensScanned).toBe('number');
  expect(Array.isArray(score.completedGroups)).toBe(true);
  expect(Array.isArray(score.adminAdjustments)).toBe(true);
}

/**
 * Assert video status structure
 *
 * @param {Object} videoStatus - Video status object
 */
function assertVideoStatusStructure(videoStatus) {
  expect(videoStatus).toHaveProperty('status');
  expect(videoStatus).toHaveProperty('queueLength');

  // Validate status enum
  expect(['idle', 'loading', 'playing', 'paused', 'completed', 'error'])
    .toContain(videoStatus.status);

  // Validate queueLength is number
  expect(typeof videoStatus.queueLength).toBe('number');
  expect(videoStatus.queueLength).toBeGreaterThanOrEqual(0);
}

/**
 * Assert sync:full data structure
 *
 * @param {Object} syncData - sync:full event data
 */
function assertSyncFullStructure(syncData) {
  expect(syncData).toHaveProperty('session');
  expect(syncData).toHaveProperty('scores');
  expect(syncData).toHaveProperty('recentTransactions');
  expect(syncData).toHaveProperty('videoStatus');
  expect(syncData).toHaveProperty('devices');
  expect(syncData).toHaveProperty('systemStatus');

  // Validate arrays
  expect(Array.isArray(syncData.scores)).toBe(true);
  expect(Array.isArray(syncData.recentTransactions)).toBe(true);
  expect(Array.isArray(syncData.devices)).toBe(true);

  // Validate video status
  assertVideoStatusStructure(syncData.videoStatus);

  // Validate system status
  expect(syncData.systemStatus).toHaveProperty('orchestrator');
  expect(syncData.systemStatus).toHaveProperty('vlc');
}

/**
 * Assert device object structure
 *
 * @param {Object} device - Device object
 */
function assertDeviceStructure(device) {
  expect(device).toHaveProperty('deviceId');
  expect(device).toHaveProperty('type');
  expect(device).toHaveProperty('name');
  expect(device).toHaveProperty('connectionTime');

  // Validate type enum
  expect(['gm', 'player']).toContain(device.type);
}

/**
 * Assert team ID format (3-digit zero-padded)
 *
 * @param {string} teamId - Team ID to validate
 */
function assertTeamIdFormat(teamId) {
  expect(teamId).toMatch(/^[0-9]{3}$/);
}

/**
 * Assert element is visible
 *
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector
 */
async function assertVisible(page, selector) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
}

/**
 * Assert element is hidden
 *
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector
 */
async function assertHidden(page, selector) {
  const element = page.locator(selector);
  await expect(element).toBeHidden();
}

/**
 * Assert element contains text
 *
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector
 * @param {string} text - Expected text
 */
async function assertContainsText(page, selector, text) {
  const element = page.locator(selector);
  await expect(element).toContainText(text);
}

/**
 * Assert admin adjustment structure
 *
 * @param {Object} adjustment - Admin adjustment object
 */
function assertAdminAdjustmentStructure(adjustment) {
  expect(adjustment).toHaveProperty('delta');
  expect(adjustment).toHaveProperty('gmStation');
  expect(adjustment).toHaveProperty('reason');
  expect(adjustment).toHaveProperty('timestamp');

  expect(typeof adjustment.delta).toBe('number');
  expect(typeof adjustment.gmStation).toBe('string');
  expect(typeof adjustment.reason).toBe('string');
}

/**
 * Assert group completion event structure
 *
 * @param {Object} groupCompletion - Group completion event data
 */
function assertGroupCompletionStructure(groupCompletion) {
  expect(groupCompletion).toHaveProperty('teamId');
  expect(groupCompletion).toHaveProperty('group');
  expect(groupCompletion).toHaveProperty('bonusPoints');
  expect(groupCompletion).toHaveProperty('completedAt');

  assertTeamIdFormat(groupCompletion.teamId);
  expect(typeof groupCompletion.bonusPoints).toBe('number');
  expect(groupCompletion.bonusPoints).toBeGreaterThan(0);
}

/**
 * Assert error event structure
 *
 * @param {Object} error - Error event data
 */
function assertErrorStructure(error) {
  expect(error).toHaveProperty('code');
  expect(error).toHaveProperty('message');

  // Validate error code is from known list
  const validErrorCodes = [
    'AUTH_REQUIRED',
    'PERMISSION_DENIED',
    'VALIDATION_ERROR',
    'SESSION_NOT_FOUND',
    'TOKEN_NOT_FOUND',
    'DUPLICATE_TRANSACTION',
    'INVALID_REQUEST',
    'VLC_ERROR',
    'INTERNAL_ERROR'
  ];

  expect(validErrorCodes).toContain(error.code);
}

/**
 * Assert transaction result structure
 *
 * @param {Object} result - Transaction result data
 */
function assertTransactionResultStructure(result) {
  expect(result).toHaveProperty('status');
  expect(result).toHaveProperty('transactionId');
  expect(result).toHaveProperty('tokenId');
  expect(result).toHaveProperty('teamId');
  expect(result).toHaveProperty('points');
  expect(result).toHaveProperty('message');

  // Validate status enum
  expect(['accepted', 'duplicate', 'error']).toContain(result.status);
}

module.exports = {
  // Event envelope
  assertEventEnvelope,

  // UI state
  assertConnectionStatus,
  assertScoreFormat,
  assertVisible,
  assertHidden,
  assertContainsText,

  // VLC
  assertVLCStatus,

  // Data structures
  assertTransactionStructure,
  assertSessionStructure,
  assertScoreStructure,
  assertVideoStatusStructure,
  assertSyncFullStructure,
  assertDeviceStructure,
  assertAdminAdjustmentStructure,
  assertGroupCompletionStructure,
  assertErrorStructure,
  assertTransactionResultStructure,

  // Validation
  assertTeamIdFormat,
};
