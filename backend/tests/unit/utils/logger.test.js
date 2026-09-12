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

describe('Logger process-safety', () => {
  test('does not exit the process on a logged exception/rejection (exitOnError is false)', () => {
    const logger = require('../../../src/utils/logger');
    // Winston exits the process after its exceptionHandlers/rejectionHandlers run
    // when exitOnError is true (the default). Because this logger configures those
    // handlers, a default exitOnError would process.exit(1) the orchestrator on ANY
    // unhandled rejection (and kill Playwright workers in E2E). The orchestrator
    // must survive a stray rejection, so exitOnError MUST be false.
    expect(logger.exitOnError).toBe(false);
  });
});

describe('Closed-output-pipe guard (P22)', () => {
  // When the process that owns the other end of stdout/stderr dies (a
  // Playwright worker, a PM2 daemon), every Console write fails. Winston's
  // OWN uncaughtException handler — registered unconditionally by the
  // `exceptionHandlers` option — then fans the failure back through the same
  // closed Console transport, and the orchestrator writes ~40 MB/s into its
  // own log file until the disk is gone. The guard is an `error` listener on
  // each stream that silences the Console transport on the two closed-pipe
  // codes and writes ONE line through the file transports.
  const GUARD_LINE = /console output closed \((EPIPE|ERR_STREAM_DESTROYED)\); console transport silenced/;

  let logger;
  let consoleTransport;
  let captureTransport;
  let lines;

  const streamError = (code) => Object.assign(new Error(`write ${code}`), { code });
  const guardLines = () => lines.filter(line => GUARD_LINE.test(line));

  beforeEach(() => {
    logger = require('../../../src/utils/logger');
    consoleTransport = logger.transports.find(t => t instanceof winston.transports.Console);
    lines = [];
    captureTransport = new winston.transports.Stream({
      stream: new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } }),
      format: winston.format.json(),
    });
    logger.add(captureTransport);
  });

  afterEach(() => {
    // Detach only what this test added; the module's own stream listeners stay.
    logger.remove(captureTransport);
    consoleTransport.silent = false;
  });

  test('an EPIPE on stdout silences the Console transport and writes one guard line', () => {
    expect(consoleTransport.silent).toBeFalsy();

    // Without the guard this THROWS: an 'error' event with no listener is
    // rethrown synchronously by EventEmitter.emit().
    process.stdout.emit('error', streamError('EPIPE'));

    expect(consoleTransport.silent).toBe(true);
    expect(guardLines()).toHaveLength(1);
    expect(guardLines()[0]).toContain('console output closed (EPIPE); console transport silenced');
  });

  test('an ERR_STREAM_DESTROYED on stdout silences the Console transport', () => {
    expect(consoleTransport.silent).toBeFalsy();

    process.stdout.emit('error', streamError('ERR_STREAM_DESTROYED'));

    expect(consoleTransport.silent).toBe(true);
    // The guard LINE is write-once per process and was spent by the first
    // test in this file; silencing itself stays idempotent.
    expect(guardLines()).toHaveLength(0);
  });

  test('stderr is guarded too, and the guard line is never written twice', () => {
    expect(consoleTransport.silent).toBeFalsy();

    process.stderr.emit('error', streamError('EPIPE'));

    expect(consoleTransport.silent).toBe(true);
    expect(guardLines()).toHaveLength(0);
  });

  test('an unrelated stream error is absorbed without silencing the console', () => {
    process.stdout.emit('error', streamError('ENOSPC'));

    expect(consoleTransport.silent).toBeFalsy();
    expect(guardLines()).toHaveLength(0);
  });
});
