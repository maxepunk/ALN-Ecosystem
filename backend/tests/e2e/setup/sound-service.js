/**
 * Sound Service Helper for E2E Testing
 *
 * Verifies pw-play is available and copies test audio fixtures
 * to the backend's public/audio directory where soundService expects them.
 *
 * Returns: { type: 'real' | 'unavailable', reason?: string }
 */

'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../../../src/utils/logger');

const execFileAsync = promisify(execFile);

const FIXTURE_AUDIO_DIR = path.join(__dirname, '../fixtures/test-assets/audio');
const PUBLIC_AUDIO_DIR = path.join(__dirname, '../../../public/audio');

// Audio files to copy from fixtures to public/audio
const TEST_AUDIO_FILES = ['test_tone.wav'];

/**
 * Check if pw-play binary is available
 * @returns {Promise<boolean>}
 */
async function isPwPlayAvailable() {
  try {
    await execFileAsync('which', ['pw-play'], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy test audio fixtures to backend public/audio directory
 */
function copyTestAudioFixtures() {
  // Ensure public/audio exists
  if (!fs.existsSync(PUBLIC_AUDIO_DIR)) {
    fs.mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true });
  }

  const copied = [];
  for (const file of TEST_AUDIO_FILES) {
    const src = path.join(FIXTURE_AUDIO_DIR, file);
    const dst = path.join(PUBLIC_AUDIO_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      copied.push(file);
    } else {
      logger.warn(`[E2E Sound] Fixture not found: ${src}`);
    }
  }
  return copied;
}

/**
 * Clean up test audio files from public/audio
 */
function cleanupTestAudioFixtures() {
  for (const file of TEST_AUDIO_FILES) {
    const dst = path.join(PUBLIC_AUDIO_DIR, file);
    try {
      if (fs.existsSync(dst)) fs.unlinkSync(dst);
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Setup sound service for E2E testing
 * @returns {Promise<{type: string, reason?: string, copiedFiles?: string[]}>}
 */
async function setupSound() {
  // 1. Check if pw-play is available
  if (!await isPwPlayAvailable()) {
    return { type: 'unavailable', reason: 'pw-play not installed (PipeWire required)' };
  }

  // 2. Copy test audio fixtures
  const copied = copyTestAudioFixtures();
  if (copied.length === 0) {
    return { type: 'unavailable', reason: 'no test audio fixtures found' };
  }

  logger.info(`[E2E Sound] pw-play available, copied ${copied.length} test audio file(s)`);
  return { type: 'real', copiedFiles: copied };
}

module.exports = { setupSound, cleanupTestAudioFixtures };
