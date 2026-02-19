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
});
