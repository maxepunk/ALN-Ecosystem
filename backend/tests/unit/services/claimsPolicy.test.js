/**
 * Per-mode claims flag through processScan (A3 slice 2 — owner ruling D3s2)
 *
 * The pure-rule half lives in gameRules/duplicatePolicy.test.js; this
 * suite pins the SERVICE wiring — a real pack with a non-consuming mode,
 * real session, real processScan:
 * - a non-consuming scan is accepted, REPEATABLE, and registers nothing
 *   (transaction:accepted carries deviceTracking null → the per-device
 *   registry never learns it);
 * - a consuming claim on a token previously scanned non-consumingly is
 *   NOT blocked;
 * - consuming FCFS/per-device behavior is unchanged.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const transactionService = require('../../../src/services/transactionService');
const sessionService = require('../../../src/services/sessionService');
const packService = require('../../../src/services/packService');
const Token = require('../../../src/models/token');
const { resetAllServices } = require('../../helpers/service-reset');

const HASH = `sha256:${'c'.repeat(64)}`;

function makeToken(id, value = 100) {
  return new Token({
    id,
    name: `Token ${id}`,
    value,
    memoryType: 'Technical',
    groupId: null,
    mediaAssets: { image: null, audio: null, video: null, processingImage: null },
    metadata: { rating: 3 },
  });
}

describe('claims flag through processScan (D3s2)', () => {
  let tmpDir;
  const originalPackPath = process.env.PACK_PATH;

  beforeEach(async () => {
    await resetAllServices();
    packService._resetForTesting();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-claims-'));
    fs.writeFileSync(path.join(tmpDir, 'pack-manifest.json'), JSON.stringify({
      kind: 'pack-manifest', schemaVersion: 1, packId: 'claims-pack', version: '0.0.1',
      contentHash: HASH, engine: { minVersion: '3.0.0' },
      files: [{ path: 'tokens.json', role: 'tokens', sha1: '0'.repeat(40), size: 2 }],
    }));
    fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify({
      kind: 'game', schemaVersion: 1, id: 'claims-pack',
      modes: [
        {
          id: 'sell', label: 'Sell', scoringPolicy: 'standard', entityRole: 'ledger',
          countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' },
        },
        {
          id: 'inspect', label: 'Inspect', scoringPolicy: 'none', entityRole: 'ledger',
          countsTowardGroups: false, claims: 'non-consuming', displayBehavior: { surface: 'none' },
        },
      ],
    }));
    process.env.PACK_PATH = tmpDir;

    await sessionService.createSession({ name: 'Claims test', teams: ['Team Alpha', 'Team Beta'] });
    await sessionService.startGame();
    transactionService.tokens.set('tok1', makeToken('tok1'));
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalPackPath === undefined) {
      delete process.env.PACK_PATH;
    } else {
      process.env.PACK_PATH = originalPackPath;
    }
    packService._resetForTesting();
  });

  const scan = (mode, overrides = {}) => transactionService.processScan({
    tokenId: 'tok1',
    teamId: 'Team Alpha',
    deviceId: 'GM_A',
    deviceType: 'gm',
    mode,
    ...overrides,
  });

  it('a non-consuming scan is accepted and REPEATABLE on the same device', async () => {
    const first = await scan('inspect');
    expect(first.status).toBe('accepted');

    const second = await scan('inspect');
    expect(second.status).toBe('accepted');
  });

  it('a non-consuming scan emits deviceTracking null — the per-device registry never learns it', async () => {
    const payloads = [];
    transactionService.on('transaction:accepted', (p) => payloads.push(p));

    await scan('inspect');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].deviceTracking).toBeNull();
    const session = sessionService.getCurrentSession();
    expect(session.getDeviceScannedTokensArray('GM_A')).toEqual([]);
  });

  it('a consuming claim is NOT blocked by a prior non-consuming scan — by another team, even', async () => {
    await scan('inspect');

    const claim = await scan('sell', { teamId: 'Team Beta', deviceId: 'GM_B' });
    expect(claim.status).toBe('accepted');
    expect(claim.points).toBe(100);
  });

  it('a non-consuming scan of an already-CLAIMED token still works (repeatable action)', async () => {
    const claim = await scan('sell');
    expect(claim.status).toBe('accepted');

    const inspect = await scan('inspect', { teamId: 'Team Beta', deviceId: 'GM_B' });
    expect(inspect.status).toBe('accepted');
  });

  it('consuming FCFS is unchanged: the second consuming claim rejects, naming the claimant', async () => {
    await scan('sell');
    const payloads = [];
    transactionService.on('transaction:accepted', (p) => payloads.push(p));

    const second = await scan('sell', { teamId: 'Team Beta', deviceId: 'GM_B' });

    expect(second.status).toBe('duplicate');
    expect(second.message).toMatch(/claimed by Team Alpha/);
    expect(payloads).toHaveLength(0);
  });

  it('a consuming scan still registers deviceTracking (the gated emission gates only non-consuming)', async () => {
    const payloads = [];
    transactionService.on('transaction:accepted', (p) => payloads.push(p));

    await scan('sell');

    expect(payloads[0].deviceTracking).toEqual({ deviceId: 'GM_A', tokenId: 'tok1' });
    // The registry assertion in the non-consuming test is meaningful only
    // if THIS harness actually wires the persistence listener — prove it.
    const session = sessionService.getCurrentSession();
    expect(session.getDeviceScannedTokensArray('GM_A')).toEqual(['tok1']);
  });
});
