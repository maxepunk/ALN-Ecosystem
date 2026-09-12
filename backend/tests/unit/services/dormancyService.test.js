'use strict';

/**
 * Block 2 T1a D4 — the dormancy FEED (plan §3 pin P6).
 *
 * One place decides what is dormant tonight and pushes that decision into
 * the two surfaces that act on it: the health registry (so the dashboard is
 * grey, not red) and the cue engine (so cues that need absent equipment are
 * silenced). Real manifests and real profiles by path — the dual-pack rule.
 */

// The system-reset leg below drives the REAL performSystemReset against the
// REAL health registry (the latch must survive it). Only its wiring
// collaborators are stubbed — they need live EventEmitters this file has no
// reason to build.
jest.mock('../../../src/websocket/listenerRegistry', () => ({
  cleanup: jest.fn(), addTrackedListener: jest.fn(),
}));
jest.mock('../../../src/websocket/broadcasts', () => ({
  cleanupBroadcastListeners: jest.fn(), setupBroadcastListeners: jest.fn(),
}));
jest.mock('../../../src/services/cueEngineWiring', () => ({
  setupCueEngineForwarding: jest.fn(),
}));

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

const ALN_MANIFEST = readJson(REPO_ROOT, 'ALN-TokenData', 'pack-manifest.json');
const ALN_FULL_KIT = readJson(REPO_ROOT, 'backend', 'config', 'profiles', 'aln-full-kit.json');
const TOY_DIR = path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', 'toy-heist');
const TOY_MANIFEST = readJson(TOY_DIR, 'pack-manifest.json');
const TOY_CUES = readJson(TOY_DIR, 'cues.json').cues;
const TOY_RIG = readJson(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures',
  'profiles', 'toy-test-rig.json');
const TOY_DORMANT = readJson(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures',
  'profiles', 'toy-dormant-lighting.json');

describe('dormancyService (T1a D4, pin P6)', () => {
  let dormancyService, registry, cueEngineService, logger;

  beforeEach(() => {
    jest.resetModules();
    logger = require('../../../src/utils/logger');
    registry = require('../../../src/services/serviceHealthRegistry');
    cueEngineService = require('../../../src/services/cueEngineService');
    dormancyService = require('../../../src/services/dormancyService');
    dormancyService._resetForTesting();
    cueEngineService.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('compute() — pure over its three arguments', () => {
    it('the real ALN pack against the real full-kit profile: nothing dormant', () => {
      const result = dormancyService.compute({
        manifest: ALN_MANIFEST, profile: ALN_FULL_KIT, registry,
      });
      expect(result.dormantServiceIds).toEqual([]);
      expect(result.profileDormant).toEqual({});
      expect(result.operatorDormant).toEqual({});
    });

    it('the toy pack against toy-dormant-lighting: lighting is dormant by PROFILE', () => {
      const result = dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      });
      expect(result.dormantServiceIds).toEqual(['lighting']);
      expect(result.profileDormant.lighting).toEqual({
        reason: "'lighting.instruments' not installed tonight",
        door: 'profile',
      });
      expect(result.doorOf).toEqual({ lighting: 'profile' });
    });

    it('the toy pack against toy-test-rig: nothing dormant', () => {
      const result = dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_RIG, registry,
      });
      expect(result.dormantServiceIds).toEqual([]);
    });

    it('the operator latch adds its own service, with the operator door', () => {
      dormancyService.setOutOfService('vlc', 'TV died');
      const result = dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_RIG, registry,
      });
      expect(result.operatorDormant.vlc).toEqual({ reason: 'TV died', door: 'operator' });
      expect(result.dormantServiceIds).toEqual(['vlc']);
      expect(result.doorOf).toEqual({ vlc: 'operator' });
    });

    it('when both doors apply to one service the OPERATOR door wins', () => {
      // A human pulled the plug on equipment the profile already calls
      // absent: the human's act is the newer, more specific fact.
      dormancyService.setOutOfService('lighting', 'rig packed away');
      const result = dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      });
      expect(result.dormantServiceIds).toEqual(['lighting']);
      expect(result.doorOf).toEqual({ lighting: 'operator' });
    });
  });

  describe('the operator latch set', () => {
    it('setOutOfService / getOperatorLatches / putInService round-trip', () => {
      dormancyService.setOutOfService('vlc', 'TV died');
      expect(dormancyService.getOperatorLatches()).toEqual({ vlc: 'TV died' });
      dormancyService.putInService('vlc');
      expect(dormancyService.getOperatorLatches()).toEqual({});
    });

    it('refuses an unknown service id', () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      dormancyService.setOutOfService('teleporter', 'nope');
      expect(dormancyService.getOperatorLatches()).toEqual({});
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('apply() — the push into the registry and the cue engine', () => {
    beforeEach(() => {
      cueEngineService.loadCues(TOY_CUES);
    });

    it('marks the profile-dormant service in the registry with its door and wording', () => {
      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      }));

      const entry = registry.getStatus('lighting');
      expect(entry.status).toBe('dormant');
      expect(entry.door).toBe('profile');
      expect(entry.message).toBe('lighting is not installed tonight');
    });

    it('silences the toy cues that depend only on lighting, and no others', () => {
      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      }));

      const by = Object.fromEntries(
        cueEngineService.getCueSummaries().map((c) => [c.id, c])
      );
      expect(by['vault-alarm-hit'].disabledBy).toBe('dormant');
      expect(by['vault-sequence'].disabledBy).toBe('dormant');
      expect(by['heist-sting'].disabledBy).toBeNull();
      expect(by['all-clear-chime'].enabled).toBe(true);
      expect(by['all-clear-chime'].dormantCommands).toEqual([
        { action: 'lighting:scene:activate', service: 'lighting', door: 'profile' },
      ]);
    });

    it('warns ONCE that the profile still binds lighting names the venue cannot use', () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      }));

      const bindingWarns = warn.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => m.includes('bindings ignored'));
      expect(bindingWarns).toHaveLength(1);
      expect(bindingWarns[0]).toBe(
        'profile binds 2 lighting.instruments names but the family is not ' +
        'installed tonight — bindings ignored'
      );
    });

    it('does NOT warn about bindings when the family is installed', () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_RIG, registry,
      }));
      expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('bindings ignored')))
        .toHaveLength(0);
    });

    it('clears a latch the new computation no longer names', () => {
      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      }));
      expect(registry.isDormant('lighting')).toBe(true);

      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_RIG, registry,
      }));

      expect(registry.isDormant('lighting')).toBe(false);
      expect(registry.getStatus('lighting')).toMatchObject({
        status: 'down', message: 'awaiting first check',
      });
    });

    it('leaves non-dormant services alone', () => {
      registry.report('sound', 'healthy', 'pw-play present');
      dormancyService.apply(dormancyService.compute({
        manifest: TOY_MANIFEST, profile: TOY_DORMANT, registry,
      }));
      expect(registry.getStatus('sound')).toMatchObject({ status: 'healthy' });
    });
  });

  describe('recompute() — over the ACTIVE pack and the frozen profile', () => {
    it('reads packService and profileService, applies, and returns the result', () => {
      const packService = require('../../../src/services/packService');
      const profileService = require('../../../src/services/profileService');
      jest.spyOn(packService, 'getManifest').mockReturnValue(TOY_MANIFEST);
      jest.spyOn(profileService, 'getProfile').mockReturnValue(TOY_DORMANT);
      cueEngineService.loadCues(TOY_CUES);

      const result = dormancyService.recompute();

      expect(result.dormantServiceIds).toEqual(['lighting']);
      expect(registry.isDormant('lighting')).toBe(true);
    });

    it('with no profile loaded, EVERY family the pack declares is dormant', () => {
      const packService = require('../../../src/services/packService');
      const profileService = require('../../../src/services/profileService');
      jest.spyOn(packService, 'getManifest').mockReturnValue(TOY_MANIFEST);
      jest.spyOn(profileService, 'getProfile').mockReturnValue(null);

      // A packless/profileless boot declares every family absent; that is
      // the honest reading, and it must not throw.
      // toy declares lighting.instruments + audio.sinks; with nothing
      // installed, audio also falls under the "no sink and no display" rule.
      const result = dormancyService.recompute();
      expect(result.dormantServiceIds.sort())
        .toEqual(['audio', 'lighting', 'music', 'sound']);
    });
  });

  describe('operator latches survive a system reset, and are lost on a restart (DoD i)', () => {
    it('vlc stays dormant by operator across performSystemReset', async () => {
      const packService = require('../../../src/services/packService');
      const profileService = require('../../../src/services/profileService');
      jest.spyOn(packService, 'getManifest').mockReturnValue(TOY_MANIFEST);
      jest.spyOn(packService, 'getCues').mockReturnValue(TOY_CUES);
      jest.spyOn(profileService, 'getProfile').mockReturnValue(TOY_RIG);

      dormancyService.setOutOfService('vlc', 'TV died');
      dormancyService.recompute();
      expect(registry.getStatus('vlc')).toMatchObject({
        status: 'dormant', door: 'operator',
      });

      const { performSystemReset } = require('../../../src/services/systemReset');
      await performSystemReset({ emit: jest.fn() }, makeResetServices(cueEngineService));

      expect(registry.getStatus('vlc')).toMatchObject({
        status: 'dormant', door: 'operator', message: 'vlc is out of service',
      });
      expect(dormancyService.getOperatorLatches()).toEqual({ vlc: 'TV died' });
    });

    it('putInService clears the latch back to down on the next recompute', () => {
      const packService = require('../../../src/services/packService');
      const profileService = require('../../../src/services/profileService');
      jest.spyOn(packService, 'getManifest').mockReturnValue(TOY_MANIFEST);
      jest.spyOn(profileService, 'getProfile').mockReturnValue(TOY_RIG);

      dormancyService.setOutOfService('vlc', 'TV died');
      dormancyService.recompute();
      dormancyService.putInService('vlc');
      dormancyService.recompute();

      expect(registry.isDormant('vlc')).toBe(false);
      expect(registry.getStatus('vlc')).toMatchObject({
        status: 'down', message: 'awaiting first check',
      });
    });
  });
});

/** Minimal service set for the REAL performSystemReset (real registry). */
function makeResetServices(cueEngineService) {
  return {
    sessionService: {
      getCurrentSession: jest.fn().mockReturnValue(null),
      endSession: jest.fn().mockResolvedValue(),
      reset: jest.fn().mockResolvedValue(),
      setupScoreListeners: jest.fn(),
      setupPersistenceListeners: jest.fn(),
      setupGameClockListeners: jest.fn(),
    },
    transactionService: { reset: jest.fn(), registerSessionListener: jest.fn() },
    videoQueueService: { reset: jest.fn() },
    offlineQueueService: { reset: jest.fn().mockResolvedValue() },
    displayControlService: { reset: jest.fn(), init: jest.fn() },
    vlcService: {
      reset: jest.fn(),
      checkConnection: jest.fn().mockResolvedValue(true),
      startPlaybackMonitor: jest.fn(),
      _resolveOwner: jest.fn().mockResolvedValue(undefined),
    },
    bluetoothService: { reset: jest.fn(), init: jest.fn().mockResolvedValue() },
    audioRoutingService: {
      reset: jest.fn(), init: jest.fn().mockResolvedValue(), loadDuckingRules: jest.fn(),
    },
    lightingService: { reset: jest.fn() },
    gameClockService: { reset: jest.fn() },
    cueEngineService,
    soundService: { reset: jest.fn(), checkHealth: jest.fn().mockResolvedValue(true) },
  };
}
