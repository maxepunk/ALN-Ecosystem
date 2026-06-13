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
const TOKENS_PATH = path.join(TOKEN_DATA_DIR, 'tokens.json');
const SCHEMA_PATH = path.join(TOKEN_DATA_DIR, 'tokens.schema.json');

describe('ALN-TokenData/tokens.json schema contract', () => {
  let tokens;
  let schema;
  let validate;

  beforeAll(() => {
    tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
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

  it('group members carry the identical SF_Group string (multiplier parse depends on it)', () => {
    // The "(xN)" microformat is parsed independently by backend and GM
    // scanner — a typo'd variant inside one group silently splits it.
    const groups = new Map();
    for (const [key, token] of Object.entries(tokens)) {
      if (!token.SF_Group) continue;
      const name = token.SF_Group.replace(/ \(x\d+\)$/, '');
      if (!groups.has(name)) groups.set(name, new Set());
      groups.get(name).add(token.SF_Group);
    }
    const inconsistent = [...groups.entries()]
      .filter(([, variants]) => variants.size > 1)
      .map(([name, variants]) => `${name}: ${[...variants].join(' | ')}`);
    expect(inconsistent).toEqual([]);
  });

  it('SF_MemoryType values are scoreable against scoring-config.json (or null = intentional 0x)', () => {
    const scoringConfig = JSON.parse(
      fs.readFileSync(path.join(TOKEN_DATA_DIR, 'scoring-config.json'), 'utf8')
    );
    const knownTypes = new Set(Object.keys(scoringConfig.typeMultipliers || {}));
    const unscoreable = Object.entries(tokens)
      .filter(([, t]) => t.SF_MemoryType !== null && !knownTypes.has(t.SF_MemoryType))
      .map(([key, t]) => `${key}: '${t.SF_MemoryType}'`);
    expect(unscoreable).toEqual([]);
  });

  it('E2E fixture packs validate against the same schema (merge-readiness review minor)', () => {
    // The TOKENS_PATH injection seam runs the whole system on fixture packs —
    // a drifted fixture would make E2E exercise token shapes production can
    // never produce. Every pack under tests/e2e/fixtures/packs/ must satisfy
    // the same contract as production tokens.json.
    const packsDir = path.resolve(__dirname, '../../e2e/fixtures/packs');
    const packs = fs.readdirSync(packsDir).filter(f => f.endsWith('.tokens.json'));
    expect(packs.length).toBeGreaterThan(0); // the seam has at least one consumer

    for (const pack of packs) {
      const packTokens = JSON.parse(fs.readFileSync(path.join(packsDir, pack), 'utf8'));
      const valid = validate(packTokens);
      if (!valid) {
        const details = validate.errors
          .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
          .join('\n  ');
        throw new Error(`${pack} schema violations:\n  ${details}`);
      }
    }
  });
});
