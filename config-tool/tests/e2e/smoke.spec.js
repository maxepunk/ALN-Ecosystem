// B0 BS.3 — the two config-tool smokes (D-B0.2r2): the REAL server
// (HTTPS, auth enforced) against a FIXTURE tree (toy-heist copy via the
// CONFIG_TOOL_* harness seams — the checked-in pack is never touched).
//
// Every API route is behind the gate (D-B0.2r2), so the login overlay
// IS the boot screen — both smokes start by logging in.
// Smoke 1: the shell — boot login, two-workspace sidebar, navigation.
// Smoke 2: the whole design loop — edit scoring, save into a DRAFT,
// publish through the engine's gate, verify the edit LANDED on disk.

'use strict';
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL_ROOT = path.resolve(__dirname, '../..');
const TOY_PACK = path.resolve(TOOL_ROOT, '../backend/tests/e2e/fixtures/packs/toy-heist');
const BACKEND_SSL = path.resolve(TOOL_ROOT, '../backend/ssl');
const PORT = 9123;
const BASE = `https://127.0.0.1:${PORT}`;
const PASSWORD = 'smoke-pass';

let tmpDir, server;

test.beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-tool-smoke-'));
  const packDir = path.join(tmpDir, 'live-pack');
  fs.cpSync(TOY_PACK, packDir, { recursive: true });
  const envPath = path.join(tmpDir, '.env');
  fs.writeFileSync(envPath, [
    `ADMIN_PASSWORD=${PASSWORD}`,
    'JWT_SECRET=smoke-secret',
    `SSL_KEY_PATH=${path.join(BACKEND_SSL, 'key.pem')}`,
    `SSL_CERT_PATH=${path.join(BACKEND_SSL, 'cert.pem')}`,
    '',
  ].join('\n'));

  server = spawn(process.execPath, [path.join(TOOL_ROOT, 'server.js')], {
    env: {
      ...process.env,
      CONFIG_PORT: String(PORT),
      CONFIG_TOOL_ENV_PATH: envPath,
      CONFIG_TOOL_PACK_DIR: packDir,
      CONFIG_TOOL_DATA_DIR: path.join(tmpDir, 'data'),
    },
    // stderr inherits so server diagnostics surface in the test log
    // (a piped-but-undrained stream loses them and risks backpressure).
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tool server never came up')), 15000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('ALN Config Tool:')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`tool server exited early (${code})`)));
  });
});

test.afterAll(async () => {
  if (server) {
    // Await the exit before removing the fixture the server still reads.
    const exited = new Promise((resolve) => {
      server.on('exit', resolve);
      setTimeout(resolve, 5000).unref();
    });
    server.kill('SIGTERM');
    await exited;
  }
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// The gate makes login the boot screen: complete it, then wait for the
// shell to initialize.
async function bootAndLogin(page) {
  await page.goto(BASE);
  await page.fill('#loginPassword', PASSWORD);
  await page.click('#loginForm button[type="submit"]');
  await page.locator('#loginOverlay').waitFor({ state: 'hidden' });
}

test('smoke 1 — boot login, two workspaces, section navigation, pack identity', async ({ page }) => {
  // The login overlay is the boot screen — and its Cancel is hidden
  // (nothing to fall back to before the first login).
  await page.goto(BASE);
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginCancel')).toBeHidden();
  await page.fill('#loginPassword', PASSWORD);
  await page.click('#loginForm button[type="submit"]');
  await expect(page.locator('#loginOverlay')).toBeHidden();

  // Two-workspace sidebar (Design / Venue)
  const groups = page.locator('.sidebar__group');
  await expect(groups).toHaveText(['Design', 'Venue']);

  // Economy renders (toy pack scoring table)
  await expect(page.locator('#section-economy .data-table').first()).toBeVisible();

  // The chrome names the EDITED pack (slice 3a), not baked ALN wording
  await expect(page).toHaveTitle(/Midnight Heist/);

  // Navigate to a Venue section and back
  await page.click('[data-section="infra"]');
  await expect(page.locator('#section-infra.active')).toBeVisible();
  await page.click('[data-section="economy"]');
  await expect(page.locator('#section-economy.active')).toBeVisible();
});

test('smoke 2 — the design loop: login → edit → draft save → publish → landed', async ({ page }) => {
  const packDir = path.join(tmpDir, 'live-pack');
  const before = JSON.parse(fs.readFileSync(path.join(packDir, 'game.json'), 'utf8'));
  const firstRating = Object.keys(before.scoring.baseValues)[0];

  await bootAndLogin(page);
  await expect(page.locator('#section-economy .data-table').first()).toBeVisible();

  // Edit the first base value
  const input = page.locator('#section-economy .data-table tbody tr').first().locator('input');
  await input.fill('123456');
  await expect(page.locator('#saveBtn')).toBeVisible();

  // Save — it lands in a DRAFT (draft bar appears), not live
  await page.click('#saveBtn');
  await expect(page.locator('.draft-bar__label')).toBeVisible();
  const liveAfterSave = JSON.parse(fs.readFileSync(path.join(packDir, 'game.json'), 'utf8'));
  expect(liveAfterSave.scoring.baseValues[firstRating])
    .toBe(before.scoring.baseValues[firstRating]);

  // Publish — through the engine's own gate — and verify it LANDED
  await page.click('.draft-bar__publish');
  await expect(page.locator('.draft-bar__label')).toBeHidden({ timeout: 30000 });
  const liveAfterPublish = JSON.parse(fs.readFileSync(path.join(packDir, 'game.json'), 'utf8'));
  expect(liveAfterPublish.scoring.baseValues[firstRating]).toBe(123456);
});
