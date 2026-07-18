/**
 * Token Database Schema Contract (Phase 2)
 *
 * Validates the ACTUAL ALN-TokenData/tokens.json against its JSON Schema
 * (ALN-TokenData/tokens.schema.json) plus the cross-key invariants the
 * schema language can't express. This is the enforcement gate for the
 * shared token format consumed by the backend and all three scanners —
 * the Notion sync script validates opportunistically, this test always.
 *
 * Monorepo-relative paths (same pattern as the scanner request-schema
 * contract tests): runs in the parent repo checkout.
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');

const TOKEN_DATA_DIR = path.resolve(__dirname, '../../../../ALN-TokenData');
const TOKENS_FILE = path.join(TOKEN_DATA_DIR, 'tokens.json');
const SCHEMA_PATH = path.join(TOKEN_DATA_DIR, 'tokens.schema.json');

describe('ALN-TokenData/tokens.json schema contract', () => {
  let tokens;
  let schema;
  let validate;

  beforeAll(() => {
    tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    validate = ajv.compile(schema);
  });

  it('tokens.json validates against tokens.schema.json', () => {
    const valid = validate(tokens);
    if (!valid) {
      // Readable failure: list each offending token + error
      const details = validate.errors
        .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
        .join('\n  ');
      throw new Error(`tokens.json schema violations:\n  ${details}`);
    }
    expect(valid).toBe(true);
  });

  it('every SF_RFID equals its object key (cross-key invariant)', () => {
    const mismatches = Object.entries(tokens)
      .filter(([key, token]) => token.SF_RFID !== key)
      .map(([key, token]) => `${key} -> SF_RFID '${token.SF_RFID}'`);
    expect(mismatches).toEqual([]);
  });

  it('every named SF_Group is declared in game.json groups (v2 — multipliers are pack rules)', () => {
    // v2 cutover (A3 slice 2b, D1b): SF_Group is the PURE name (schema
    // makes a "(xN)" suffix illegal) and the multiplier lives ONLY in
    // game.json `groups`. An undeclared name would read 1x silently —
    // this mirrors the engine's activation gate at contract level.
    const { groups } = JSON.parse(
      fs.readFileSync(path.join(TOKEN_DATA_DIR, 'game.json'), 'utf8')
    );
    const undeclared = Object.entries(tokens)
      .filter(([, t]) => t.SF_Group && t.SF_Group.trim())
      .filter(([, t]) => !(groups || {})[t.SF_Group.trim()])
      .map(([key, t]) => `${key}: '${t.SF_Group}'`);
    expect(undeclared).toEqual([]);
  });

  it('SF_MemoryType values are scoreable against game.json scoring (or null = intentional 0x)', () => {
    const { scoring } = JSON.parse(
      fs.readFileSync(path.join(TOKEN_DATA_DIR, 'game.json'), 'utf8')
    );
    const knownTypes = new Set(Object.keys(scoring.typeMultipliers || {}));
    const unscoreable = Object.entries(tokens)
      .filter(([, t]) => t.SF_MemoryType !== null && !knownTypes.has(t.SF_MemoryType))
      .map(([key, t]) => `${key}: '${t.SF_MemoryType}'`);
    expect(unscoreable).toEqual([]);
  });

  it('E2E fixture packs validate against the same schema (merge-readiness review minor)', () => {
    // The PACK_PATH injection seam runs the whole system on fixture packs —
    // a drifted fixture would make E2E exercise token shapes production can
    // never produce. Every pack DIRECTORY under tests/e2e/fixtures/packs/
    // (parity-pack, toy-heist, future packs) must carry a tokens.json that
    // satisfies the same contract as production tokens.json.
    const packsDir = path.resolve(__dirname, '../../e2e/fixtures/packs');
    const packs = fs.readdirSync(packsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    expect(packs.length).toBeGreaterThan(0); // the seam has at least one consumer

    for (const pack of packs) {
      const tokensFile = path.join(packsDir, pack, 'tokens.json');
      expect(fs.existsSync(tokensFile)).toBe(true); // a pack dir without tokens.json cannot boot
      const packTokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
      const valid = validate(packTokens);
      if (!valid) {
        const details = validate.errors
          .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
          .join('\n  ');
        throw new Error(`${pack}/tokens.json schema violations:\n  ${details}`);
      }
    }
  });
});
