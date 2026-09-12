/**
 * E2E: a venue with no lighting rig (Block 2 T1a D14, DoD a–d)
 *
 * The whole dormancy story, end to end, on a real orchestrator serving a
 * real GM scanner: the toy pack needs lighting, the pinned profile does not
 * install it, and everything downstream must treat that as an ABSENCE
 * somebody chose rather than a fault.
 *
 *   (a) a lighting command is refused with the door's words, and mints NO
 *       held item — a hold promises a later run, and nothing is coming
 *   (b) the cues that need only lighting are silenced; the MIXED cue stays
 *       live carrying the command that will be skipped — and both survive
 *       a restart, because dormancy is recomputed, never persisted
 *   (c) sync:full carries the latch with its door
 *   (d) the GM's dashboard shows grey, not red, and the silenced cues look
 *       silenced before anyone taps them
 *
 * Pack and profile are pinned PER CALL (the S5 seam), so this flow runs on
 * every Tier L leg and always tests the same venue.
 *
 * @group show-control
 * @group toy-pack
 * @group dormancy
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { connectWithAuth, disconnectSocket } = require('../../helpers/websocket-core');
const { sendGMCommand } = require('../helpers/gm-command');

const TOY_PACK = path.resolve(__dirname, '../fixtures/packs/toy-heist');
const DORMANT_PROFILE = path.resolve(__dirname, '../fixtures/profiles/toy-dormant-lighting.json');

const PINS = { https: true, timeout: 60000, packPath: TOY_PACK, profilePath: DORMANT_PROFILE };

/** Connect, take the connect-time sync:full, disconnect. */
async function syncFull(url, tag) {
  const socket = await connectWithAuth(url, ADMIN_PASSWORD, `${tag}_${Date.now()}`, 'gm');
  try {
    const sync = socket.initialSync;
    return sync.data || sync;
  } finally {
    disconnectSocket(socket);
  }
}

const summariesById = (sync) => Object.fromEntries(
  (sync.cueEngine?.cues || []).map((c) => [c.id, c])
);

test.describe('Dormancy — the venue with no lighting rig', () => {
  let browser = null;
  let orchestratorInfo = null;

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator(PINS);
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
  });

  test.afterEach(async () => {
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator(PINS);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await clearSessionData();
  });

  // ── (c) the latch reaches the wire ──────────────────────────────────
  test('sync:full reports lighting DORMANT, by the profile door', async () => {
    const sync = await syncFull(orchestratorInfo.url, 'DORMANCY_SYNC');

    expect(sync.serviceHealth.lighting).toEqual({
      status: 'dormant',
      door: 'profile',
      message: expect.any(String),
      lastChecked: expect.anything(),
    });
    expect(sync.serviceHealth.lighting.message).toContain('not installed tonight');

    // The profile identity travels with it (T1a D10) — a GM comparing a
    // grey row against the wrong venue has no way to tell otherwise.
    expect(sync.profile).toEqual({
      profileId: 'toy-dormant-lighting',
      forPack: 'midnight-heist',
    });

    // Sound rides audio.sinks, which this profile DOES install: dormancy is
    // per-family, not a blanket.
    expect(sync.serviceHealth.sound.status).not.toBe('dormant');
  });

  // ── (a) the command is refused, quietly ─────────────────────────────
  test('a lighting command is refused with the door wording and mints no held item', async () => {
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Dormant Night', teams: [] });

    const ack = await sendGMCommand(orchestratorInfo.url, 'lighting:scene:activate', {
      role: 'vault-alarm',
    });

    expect(ack.data.success).toBe(false);
    expect(ack.data.message).toMatch(/is not installed tonight$/);

    // No hold. A held item is a promise to run it when the service returns,
    // and the rig is not coming back tonight.
    const sync = await syncFull(orchestratorInfo.url, 'DORMANCY_HELD');
    expect(sync.heldItems).toEqual([]);
  });

  // ── (b) the cues are silenced, and stay silenced across a restart ───
  test('the lighting-only cues are silenced; the mixed cue stays live and says what it will skip', async () => {
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Dormant Night', teams: [] });

    const check = (sync, when) => {
      const by = summariesById(sync);
      expect({ when, id: 'vault-alarm-hit', disabledBy: by['vault-alarm-hit'].disabledBy })
        .toEqual({ when, id: 'vault-alarm-hit', disabledBy: 'dormant' });
      expect({ when, id: 'vault-sequence', disabledBy: by['vault-sequence'].disabledBy })
        .toEqual({ when, id: 'vault-sequence', disabledBy: 'dormant' });
      expect({ when, id: 'heist-sting', disabledBy: by['heist-sting'].disabledBy })
        .toEqual({ when, id: 'heist-sting', disabledBy: null });
      expect({ when, enabled: by['all-clear-chime'].enabled })
        .toEqual({ when, enabled: true });
      expect(by['all-clear-chime'].dormantCommands).toEqual([
        { action: 'lighting:scene:activate', service: 'lighting', door: 'profile' },
      ]);
    };

    check(await syncFull(orchestratorInfo.url, 'DORMANCY_CUES'), 'at session create');

    // Dormancy is RECOMPUTED at boot, never persisted — the restart is the
    // proof: the same picture has to be rebuilt from pack + profile alone.
    await stopOrchestrator();
    orchestratorInfo = await startOrchestrator({ ...PINS, preserveSession: true });

    check(await syncFull(orchestratorInfo.url, 'DORMANCY_CUES_RESTORED'), 'after a restart');
  });

  test('a wholly dormant cue refuses at fire, and still mints no held item', async () => {
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Dormant Night', teams: [] });
    await sendGMCommand(orchestratorInfo.url, 'session:start', {});

    const ack = await sendGMCommand(orchestratorInfo.url, 'cue:fire', { cueId: 'vault-alarm-hit' });

    expect(ack.data.success).toBe(false);
    expect(ack.data.message).toContain('not installed tonight');

    const sync = await syncFull(orchestratorInfo.url, 'DORMANCY_FIRE');
    expect(sync.heldItems).toEqual([]);
  });

  // ── (d) the GM sees grey, not red ───────────────────────────────────
  test('the GM dashboard shows lighting grey, and the silenced cues look silenced', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Dormant Night', ['Team Alpha']);
      await gmScanner.navigateToAdminPanel();

      // The collapse RULE, asserted against this run's real health: the
      // dashboard collapses exactly when nothing but profile-dormancy is
      // absent. (Which services are healthy varies by runner — Bluetooth
      // adapters, VLC binaries — so the expectation is derived from the
      // live snapshot rather than assumed.)
      const health = (await gmScanner.getStateFromBackend(orchestratorInfo.url)).serviceHealth || {};
      const needsAttention = Object.values(health).some(
        (v) => v.status !== 'healthy' && !(v.status === 'dormant' && v.door === 'profile')
      );
      const rootSelector = needsAttention ? '.health-dashboard--degraded' : '.health-dashboard--ok';
      await expect(page.locator(rootSelector)).toBeVisible();

      // The grey rows are behind the summary toggle when collapsed.
      if (!needsAttention) {
        await page.locator('.health-dashboard__summary').click();
        await expect(page.locator('.health-dashboard--degraded')).toBeVisible();
      }

      const lightingCard = page.locator('.health-service[data-service="lighting"]');
      await expect(lightingCard).toBeVisible();
      await expect(lightingCard).toHaveClass(/health-service--dormant/);
      await expect(lightingCard).not.toHaveClass(/health-service--down/);
      await expect(lightingCard).toContainText('Not installed tonight');
      // Nothing to probe, so no button that would only answer "not probed".
      await expect(lightingCard.locator('[data-action="admin.serviceCheck"]')).toHaveCount(0);

      // The silenced cues look silenced BEFORE anyone taps them.
      for (const cueId of ['vault-alarm-hit', 'vault-sequence']) {
        const tile = page.locator(`#quick-fire-grid button[data-cue-id="${cueId}"]`);
        await expect(tile).toBeVisible();
        await expect(tile).toBeDisabled();
        await expect(tile).toHaveClass(/cue-tile--disabled/);
      }
      // The mixed cue is live and wears its badge.
      const mixed = page.locator('#quick-fire-grid button[data-cue-id="all-clear-chime"]');
      await expect(mixed).toBeEnabled();
      await expect(mixed.locator('.cue-tile__badge')).toHaveText('1');
    } finally {
      await context.close();
    }
  });
});
