/**
 * Service Domain State Contract (Phase 2)
 *
 * Validates every service:state domain's REAL producer output against the
 * formalized per-domain schemas in contracts/asyncapi.yaml
 * (components.schemas.DomainState*). These wire shapes are what the GM
 * Scanner's StateStore shallow-merges — a removed/renamed key silently
 * orphans scanner state forever, so required keys may never disappear
 * without a coordinated contract + scanner change.
 *
 * Also pins: the ServiceState envelope's domain enum and the schema set
 * stay in lockstep (a new domain must ship with a schema).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

process.env.ENABLE_VIDEO_PLAYBACK = 'false';

const ASYNCAPI_PATH = path.resolve(__dirname, '../../../contracts/asyncapi.yaml');

describe('service:state domain shapes match contract schemas', () => {
  let validators = {};
  let domainEnum = [];

  // domain → live producer of the pushed `state` payload
  const producers = {
    music: () => require('../../../src/services/musicService').getState(),
    video: () => require('../../../src/services/videoQueueService').getState(),
    health: () => require('../../../src/services/serviceHealthRegistry').getSnapshot(),
    bluetooth: () => require('../../../src/services/bluetoothService').getState(),
    audio: () => require('../../../src/services/audioRoutingService').getState(),
    lighting: () => require('../../../src/services/lightingService').getState(),
    sound: () => require('../../../src/services/soundService').getState(),
    gameclock: () => require('../../../src/services/gameClockService').getState(),
    cueengine: () => require('../../../src/services/cueEngineService').getState(),
    held: () => {
      // broadcasts.js pushHeldState envelope: { items: buildHeldItemsState(...) }
      const { buildHeldItemsState } = require('../../../src/websocket/syncHelpers');
      const cueEngineService = require('../../../src/services/cueEngineService');
      const videoQueueService = require('../../../src/services/videoQueueService');
      return { items: buildHeldItemsState(cueEngineService, videoQueueService) };
    },
  };

  beforeAll(() => {
    const doc = yaml.load(fs.readFileSync(ASYNCAPI_PATH, 'utf8'));
    const schemas = doc.components.schemas || {};
    const ajv = new Ajv({ allErrors: true, strict: false });

    for (const [name, schema] of Object.entries(schemas)) {
      if (name.startsWith('DomainState')) {
        const domain = name.replace('DomainState', '').toLowerCase();
        validators[domain] = ajv.compile(schema);
      }
    }

    domainEnum = doc.components.messages.ServiceState
      .payload.properties.data.properties.domain.enum;
  });

  it('every domain in the ServiceState enum has a schema, and vice versa', () => {
    expect(Object.keys(validators).sort()).toEqual([...domainEnum].sort());
  });

  describe.each([
    'music', 'video', 'health', 'bluetooth', 'audio',
    'lighting', 'sound', 'gameclock', 'cueengine', 'held',
  ])('%s domain', (domain) => {
    it('live getState() output validates against its contract schema', () => {
      const state = producers[domain]();
      const validate = validators[domain];
      const valid = validate(state);
      if (!valid) {
        const details = validate.errors
          .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
          .join('\n  ');
        throw new Error(
          `${domain} getState() violates DomainState schema:\n  ${details}\n` +
          `state: ${JSON.stringify(state, null, 2)}`
        );
      }
      expect(valid).toBe(true);
    });
  });

  it('held items carry the type-prefixed wire IDs the prefix dispatch routes on', () => {
    const HeldItemsStore = require('../../../src/services/heldItemsStore');
    const store = new HeldItemsStore();
    const heldCue = store.holdItem({ type: 'cue', cueId: 'c1', reason: 'service_down', blockedBy: ['vlc'] });
    const heldVideo = store.holdItem({ type: 'video', tokenId: 't1', videoFile: 't1.mp4', reason: 'vlc_down' });

    const validate = validators.held;
    expect(validate({ items: [heldCue, heldVideo] })).toBe(true);
    expect(heldCue.id).toMatch(/^held-cue-\d+$/);
    expect(heldVideo.id).toMatch(/^held-video-\d+$/);
  });

  it('cueengine state with loaded cues still validates (populated case)', () => {
    const cueEngineService = require('../../../src/services/cueEngineService');
    cueEngineService.loadCues([
      { id: 'contract-test-cue', label: 'X', commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }] },
    ]);
    try {
      expect(validators.cueengine(cueEngineService.getState())).toBe(true);
    } finally {
      cueEngineService.loadCues([]);
    }
  });
});
