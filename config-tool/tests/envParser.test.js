const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseEnvFile, serializeEnv, readEnv, writeEnv } = require('../lib/envParser');

describe('envParser', () => {
  describe('parseEnvFile', () => {
    it('parses key=value pairs', () => {
      const result = parseEnvFile('PORT=3000\nHOST=0.0.0.0');
      assert.strictEqual(result.values.PORT, '3000');
      assert.strictEqual(result.values.HOST, '0.0.0.0');
    });

    it('preserves comments and blank lines in structure', () => {
      const input = '# Server\nPORT=3000\n\n# VLC\nVLC_HOST=localhost';
      const result = parseEnvFile(input);
      assert.strictEqual(result.values.PORT, '3000');
      assert.strictEqual(result.lines.length, 5);
      assert.strictEqual(result.lines[0].type, 'comment');
      assert.strictEqual(result.lines[2].type, 'blank');
    });

    it('handles quoted values', () => {
      const result = parseEnvFile('JWT_SECRET="my secret key"');
      assert.strictEqual(result.values.JWT_SECRET, 'my secret key');
    });

    it('handles single-quoted values', () => {
      const result = parseEnvFile("JWT_SECRET='my secret key'");
      assert.strictEqual(result.values.JWT_SECRET, 'my secret key');
    });

    it('handles empty values', () => {
      const result = parseEnvFile('HOME_ASSISTANT_TOKEN=');
      assert.strictEqual(result.values.HOME_ASSISTANT_TOKEN, '');
    });

    it('handles values with = signs', () => {
      const result = parseEnvFile('TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc=');
      assert.strictEqual(result.values.TOKEN, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc=');
    });

    it('keeps unquoted inline # as part of the value (pin: diverges from backend dotenv)', () => {
      // The backend's dotenv strips unquoted inline comments
      // (`KEY=val # note` → "val"); this parser deliberately keeps them
      // (round-trip fidelity). Pinned so any change is made on purpose, in
      // lockstep with the backend's parser. See lib/envParser.js NOTE.
      const result = parseEnvFile('VLC_HOST=localhost # local only');
      assert.strictEqual(result.values.VLC_HOST, 'localhost # local only');
    });
  });

  describe('serializeEnv', () => {
    it('round-trips without data loss', () => {
      const input = '# Server Config\nPORT=3000\nHOST=0.0.0.0\n\n# VLC\nVLC_HOST=localhost\n';
      const parsed = parseEnvFile(input);
      const output = serializeEnv(parsed);
      assert.strictEqual(output, input);
    });

    it('does not accumulate trailing newlines on repeated round-trips', () => {
      const input = '# Server\nPORT=3000\n';
      let content = input;
      for (let i = 0; i < 5; i++) {
        const parsed = parseEnvFile(content);
        content = serializeEnv(parsed);
      }
      assert.strictEqual(content, input);
    });

    it('updates existing values in place', () => {
      const input = '# Server\nPORT=3000\nHOST=0.0.0.0';
      const parsed = parseEnvFile(input);
      parsed.values.PORT = '4000';
      const output = serializeEnv(parsed);
      assert.ok(output.includes('PORT=4000'));
      assert.ok(output.includes('# Server'));
    });

    it('quotes values containing spaces', () => {
      const parsed = parseEnvFile('SECRET=no-spaces');
      parsed.values.SECRET = 'has spaces here';
      const output = serializeEnv(parsed);
      assert.ok(output.includes('SECRET="has spaces here"'));
    });
  });

  describe('injection hardening (F-TOOL-03)', () => {
    it('rejects values containing newlines (env line injection)', () => {
      const parsed = parseEnvFile('HOST=localhost');
      parsed.values.HOST = '0.0.0.0\nADMIN_PASSWORD=hacked';
      assert.throws(() => serializeEnv(parsed), /newline/i);
    });

    it('rejects values containing carriage returns', () => {
      const parsed = parseEnvFile('HOST=localhost');
      parsed.values.HOST = '0.0.0.0\rADMIN_PASSWORD=hacked';
      assert.throws(() => serializeEnv(parsed), /newline/i);
    });

    it('escapes embedded double quotes and round-trips them', () => {
      const parsed = parseEnvFile('MSG=plain');
      parsed.values.MSG = 'he said "do it" loudly';
      const output = serializeEnv(parsed);
      assert.ok(output.includes('MSG="he said \\"do it\\" loudly"'));
      const reparsed = parseEnvFile(output);
      assert.strictEqual(reparsed.values.MSG, 'he said "do it" loudly');
    });

    it('round-trips a value that is only a quote character', () => {
      const parsed = parseEnvFile('Q=x');
      parsed.values.Q = '"';
      const reparsed = parseEnvFile(serializeEnv(parsed));
      assert.strictEqual(reparsed.values.Q, '"');
    });

    it('round-trips values with spaces and hashes unchanged', () => {
      const parsed = parseEnvFile('A=x\nB=y');
      parsed.values.A = 'value with # hash';
      parsed.values.B = 'spaced value';
      const reparsed = parseEnvFile(serializeEnv(parsed));
      assert.strictEqual(reparsed.values.A, 'value with # hash');
      assert.strictEqual(reparsed.values.B, 'spaced value');
    });
  });
});
