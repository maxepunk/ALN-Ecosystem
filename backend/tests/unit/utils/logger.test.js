// tests/unit/utils/logger.test.js
const winston = require('winston');
const { Writable } = require('stream');

describe('Logger Error Serialization', () => {
  test('Error objects in metadata are serialized with message and stack', (done) => {
    // Create a test logger with the same format chain as production
    const logger = require('../../../src/utils/logger');

    // Capture output
    const chunks = [];
    const capture = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); }
    });

    logger.add(new winston.transports.Stream({ stream: capture, format: winston.format.json() }));

    const testError = new Error('test failure');
    logger.error('Operation failed', { error: testError, context: 'test' });

    setImmediate(() => {
      const output = JSON.parse(chunks[chunks.length - 1]);
      expect(output.metadata.error).toBeDefined();
      expect(output.metadata.error).not.toEqual({});
      expect(output.metadata.error.message).toBe('test failure');
      expect(output.metadata.error.stack).toContain('test failure');
      logger.remove(logger.transports[logger.transports.length - 1]);
      done();
    });
  });
});
