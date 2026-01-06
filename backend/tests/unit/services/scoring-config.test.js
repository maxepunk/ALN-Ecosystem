/**
 * Scoring Config Tests
 * Validates shared config loading and parity with current values
 */

const path = require('path');
const fs = require('fs');

describe('Shared Scoring Config', () => {
  const configPath = path.join(__dirname, '../../../../ALN-TokenData/scoring-config.json');

  it('should load scoring config from ALN-TokenData submodule', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.version).toBe('1.0');
    expect(config.baseValues).toBeDefined();
    expect(config.typeMultipliers).toBeDefined();
  });

  it('should have all required base values (1-5 star ratings)', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.baseValues['1']).toBe(10000);
    expect(config.baseValues['2']).toBe(25000);
    expect(config.baseValues['3']).toBe(50000);
    expect(config.baseValues['4']).toBe(75000);
    expect(config.baseValues['5']).toBe(150000);
  });

  it('should have all required type multipliers', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.typeMultipliers['Personal']).toBe(1);
    expect(config.typeMultipliers['Business']).toBe(3);
    expect(config.typeMultipliers['Technical']).toBe(5);
    expect(config.typeMultipliers['UNKNOWN']).toBe(0);
  });

  it('should have UNKNOWN type multiplier as 0 (critical for security)', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // CRITICAL: Unknown tokens must score 0 to prevent exploitation
    expect(config.typeMultipliers['UNKNOWN']).toBe(0);
  });
});
