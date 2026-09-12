/**
 * sync:full completeness contract (structural pin)
 *
 * The "missing service/field in a sync:full emit path" bug has recurred FOUR
 * times (scores:reset, offline:queue:processed, integration-test-server.js,
 * the soundService omission). Every emit path funnels through
 * buildSyncFullPayload(), so the structural invariant is: the builder's
 * output must carry EVERY key the AsyncAPI SyncFull payload declares
 * required — a field added to the contract without a builder change (or
 * removed from the builder without a contract change) fails HERE, not at a
 * venue mid-game.
 *
 * Self-updating: the required-key list is parsed from contracts/asyncapi.yaml
 * at test time, never hand-copied — extending the contract automatically
 * extends this pin.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { buildSyncFullPayload } = require('../../../src/websocket/syncHelpers');

// Real singletons — the builder only READS, and every build*State helper
// degrades gracefully on uninitialized services. Bluetooth is the one
// exception (its state getters shell out to bluetoothctl), so it is spied.
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const videoQueueService = require('../../../src/services/videoQueueService');
const bluetoothService = require('../../../src/services/bluetoothService');
const audioRoutingService = require('../../../src/services/audioRoutingService');
const lightingService = require('../../../src/services/lightingService');
const gameClockService = require('../../../src/services/gameClockService');
const cueEngineService = require('../../../src/services/cueEngineService');
const musicService = require('../../../src/services/musicService');
const soundService = require('../../../src/services/soundService');

describe('sync:full completeness (structural)', () => {
  let requiredKeys;

  beforeAll(() => {
    const asyncapi = yaml.load(
      fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
    );
    requiredKeys = asyncapi.components.messages.SyncFull.payload.properties.data.required;
  });

  beforeEach(() => {
    jest.spyOn(bluetoothService, 'isAvailable').mockResolvedValue(false);
    jest.spyOn(bluetoothService, 'getPairedDevices').mockResolvedValue([]);
    jest.spyOn(bluetoothService, 'getConnectedDevices').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses a plausible required-key list from the contract (sanity)', () => {
    expect(Array.isArray(requiredKeys)).toBe(true);
    // The contract had 14 required data keys before A2 added `pack` (15
    // total); a parse that finds fewer means the YAML path drifted — fix
    // the test, don't trust a vacuous pass.
    expect(requiredKeys.length).toBeGreaterThanOrEqual(15);
    expect(requiredKeys).toContain('session');
    expect(requiredKeys).toContain('pack');
  });

  it('builder output carries every AsyncAPI-required data key', async () => {
    const payload = await buildSyncFullPayload({
      sessionService,
      transactionService,
      videoQueueService,
      bluetoothService,
      audioRoutingService,
      lightingService,
      gameClockService,
      cueEngineService,
      musicService,
      soundService,
    });

    const missing = requiredKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(payload, key)
    );
    expect(missing).toEqual([]);
  });

  it('builder output carries every required key even with optional services absent', async () => {
    // The four historical regressions were emit paths that FORGOT a service.
    // Keys must survive as graceful defaults — a missing service must never
    // silently drop a contract-required field from the payload.
    const payload = await buildSyncFullPayload({
      sessionService,
      transactionService,
      videoQueueService,
      bluetoothService,
      audioRoutingService,
      lightingService,
      // gameClockService, cueEngineService, musicService, soundService omitted
    });

    const missing = requiredKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(payload, key)
    );
    expect(missing).toEqual([]);
  });
});
