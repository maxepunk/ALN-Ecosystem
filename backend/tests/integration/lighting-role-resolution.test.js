/**
 * Lighting role resolution — the always-on integration proof
 * (A3 slice 4 S3/D-4.8).
 *
 * The toy lighting-role E2E is capability-gated and SKIPS on HA-less
 * runners, so the slice gate rests on THIS test instead: role → sceneId
 * resolution proven end-to-end through the REAL executeCommand and the
 * REAL profileService (the in-repo aln-full-kit profile), with only the
 * lighting service stubbed. Runs everywhere.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../src/services/lightingService', () => ({
  activateScene: jest.fn().mockResolvedValue(true),
  refreshScenes: jest.fn().mockResolvedValue(true),
  sceneExists: jest.fn().mockReturnValue(true),
  checkConnection: jest.fn(),
}));

const lightingService = require('../../src/services/lightingService');
const registry = require('../../src/services/serviceHealthRegistry');
const profileService = require('../../src/services/profileService');
const packService = require('../../src/services/packService');
const { executeCommand } = require('../../src/services/commandExecutor');

describe('lighting role resolution (integration: real profileService + real executeCommand)', () => {
  let tmpDir;
  const originalPackPath = process.env.PACK_PATH;
  const originalProfilePath = process.env.PROFILE_PATH;

  beforeEach(() => {
    jest.clearAllMocks();
    lightingService.activateScene.mockResolvedValue(true);
    registry.report('lighting', 'healthy', 'integration stub');
    profileService._resetForTesting();
    packService._resetForTesting();
    delete process.env.PACK_PATH;
    delete process.env.PROFILE_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-rolint-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalPackPath === undefined) delete process.env.PACK_PATH;
    else process.env.PACK_PATH = originalPackPath;
    if (originalProfilePath === undefined) delete process.env.PROFILE_PATH;
    else process.env.PROFILE_PATH = originalProfilePath;
    profileService._resetForTesting();
    packService._resetForTesting();
  });

  it('a role bound in the REAL aln-full-kit profile drives the real HA scene id', async () => {
    const result = await executeCommand({
      action: 'lighting:scene:activate',
      payload: { role: 'police-arrival-2' },
      source: 'cue',
    });
    expect(result.success).toBe(true);
    expect(lightingService.activateScene).toHaveBeenCalledWith('scene.police2');
  });

  it('an unbound role with no pack fallback fails with the contracted message', async () => {
    const result = await executeCommand({
      action: 'lighting:scene:activate',
      payload: { role: 'never-bound' },
      source: 'cue',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unresolvable lighting role 'never-bound'/);
    expect(lightingService.activateScene).not.toHaveBeenCalled();
  });

  it('an unbound role resolves through a PACK_PATH pack\'s lightingRoleFallbacks (ledger L7 path)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify({
      kind: 'game',
      schemaVersion: 2,
      id: 'role-int',
      lightingRoles: ['never-bound'],
      lightingRoleFallbacks: { 'never-bound': 'scene.fallback_test' },
      requires: ['lighting.roles'],
    }));
    process.env.PACK_PATH = tmpDir;
    const result = await executeCommand({
      action: 'lighting:scene:activate',
      payload: { role: 'never-bound' },
      source: 'cue',
    });
    expect(result.success).toBe(true);
    expect(lightingService.activateScene).toHaveBeenCalledWith('scene.fallback_test');
  });

  it('the GM concrete-sceneId form is untouched by the whole mechanism', async () => {
    // gm-sourced lighting commands cross the B0 operator floor
    // (lighting: → show-control); real GM traffic carries these claims
    // from its operator token, so the direct call supplies them too.
    const result = await executeCommand({
      action: 'lighting:scene:activate',
      payload: { sceneId: 'scene.direct' },
      source: 'gm',
      actor: { tier: 'operator', functions: ['show-control'] },
    });
    expect(result.success).toBe(true);
    expect(lightingService.activateScene).toHaveBeenCalledWith('scene.direct');
  });
});
