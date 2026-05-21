/**
 * E2E Test: GM Scanner Admin Panel — Music Playlist Control
 *
 * Narrative: "A GM picks a music playlist mid-show and starts playback"
 *
 * Smoke test of the music playback path end-to-end:
 *   GM Scanner picker → music:loadPlaylist gm:command → backend musicService
 *   → MPD socket → MPD plays → service:state push (domain music) → UI updates
 *
 * Verifies:
 *   - Music section renders with the seeded "All Tracks" playlist as an option
 *   - Selecting a playlist via the picker triggers playback (track title
 *     swaps from "No track" to a real MPD-reported title within 5 seconds)
 *
 * Skips automatically if the music service is unhealthy (e.g., MPD not
 * spawned), mirroring the 07d-04 spotify pattern.
 *
 * @group admin-panel
 * @group music
 */

const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

const MUSIC_DIR = path.resolve(__dirname, '../../../public/music');

/**
 * Returns true when at least one MP3 is present in backend/public/music/.
 * The directory is gitignored — fresh CI clones won't have any tracks even
 * if the seed playlist (committed) references them. Without MP3s, MPD adds
 * non-existent filenames, the queue stays empty, the track title never
 * updates, and the test times out misleadingly.
 */
function musicLibraryPopulated() {
  try {
    return fs.readdirSync(MUSIC_DIR).some(f => f.toLowerCase().endsWith('.mp3'));
  } catch {
    return false;
  }
}

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let serviceHealth = null;

/**
 * Fetch serviceHealth snapshot from /api/state.
 * Same helper as 07d-03 / 07d-04.
 */
async function fetchServiceHealth(orchestratorUrl) {
  const https = require('https');
  const stateResponse = await new Promise((resolve, reject) => {
    const url = new URL('/api/state', orchestratorUrl);
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
  return stateResponse.serviceHealth || {};
}

test.describe('GM Scanner — Music Playlist Control', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode`);
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    serviceHealth = await fetchServiceHealth(orchestratorInfo.url);
    console.log('Service health snapshot:', Object.entries(serviceHealth).map(
      ([k, v]) => `${k}:${v.status}`
    ).join(', '));
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('select All Tracks playlist → playback starts and track title updates', async () => {
    if (serviceHealth.music?.status !== 'healthy') {
      console.log(`Music not healthy (${serviceHealth.music?.status || 'unknown'}) — skipping`);
      test.skip(true, 'Music service not healthy');
      return;
    }
    if (!musicLibraryPopulated()) {
      console.log('backend/public/music/ is empty — skipping (Pi-only test, requires real MP3s)');
      test.skip(true, 'Music library not populated');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();

      // Music section is rendered by MusicRenderer subscribed to StateStore 'music'
      // domain. The picker is populated from state.playlists (delivered via
      // sync:full on connect). Selectors use BEM (music__X) per the renderer.
      const picker = page.locator('.music__playlist-picker');
      await expect(picker).toBeVisible({ timeout: 10000 });

      // The seeded "All Tracks" playlist (66 MP3s, all-tracks id) should be
      // the first option (it's `unshift`'d by the seed script).
      await expect(picker.locator('option')).toContainText(['All Tracks']);

      // Initial track-title state shows "No track" (set by MusicRenderer
      // when state.track is null/empty).
      const trackTitle = page.locator('.music__track-title');
      await expect(trackTitle).toBeVisible();
      await expect(trackTitle).toHaveText('No track');

      // Changing the picker fires `admin.musicLoadPlaylist` which sends
      // `music:loadPlaylist` via WebSocket — backend musicService.loadPlaylist
      // adds tracks AND auto-plays (the queue ends with `play` per Phase 1.6).
      await picker.selectOption('all-tracks');

      // Wait for MPD to start playback and report a real track title via
      // service:state. 5 seconds is enough for the MPD `add` + `play` round-trip.
      await expect(trackTitle).not.toHaveText('No track', { timeout: 5000 });
      const title = await trackTitle.textContent();
      console.log(`Music playing: ${title}`);

    } finally {
      await context.close();
    }
  });
});
