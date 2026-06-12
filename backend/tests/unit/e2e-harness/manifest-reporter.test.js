/**
 * ManifestReporter final-outcome counting (review E2E-N1)
 *
 * Playwright's onTestEnd fires once per ATTEMPT. The original reporter
 * counted attempts directly, so a fail-then-pass-on-retry test bumped BOTH
 * failed (attempt 1) and flaky (attempt 2) — a flaky-but-green run printed
 * "1 failed" against exit code 0. Counts must derive from FINAL outcomes
 * via test.outcome().
 */

const ManifestReporter = require('../../e2e/setup/manifest-reporter');

function stubTest(id, titlePath, outcome) {
  return {
    id,
    titlePath: () => titlePath,
    outcome: () => outcome,
  };
}

/** Replay one onTestEnd per attempt status, with retry = attempt index. */
function replayAttempts(reporter, test, statuses) {
  statuses.forEach((status, retry) => reporter.onTestEnd(test, { status, retry }));
}

describe('ManifestReporter — counts derive from final outcomes, not attempts', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function output() {
    return logSpy.mock.calls.map(args => args.join(' ')).join('\n');
  }

  it('counts a fail-then-pass-on-retry test ONCE as flaky (never as failed)', () => {
    const reporter = new ManifestReporter();
    replayAttempts(reporter,
      stubTest('t1', ['', 'flows', 'recovers eventually'], 'flaky'),
      ['failed', 'passed']);

    reporter.onEnd();

    expect(reporter.tiers['Tier L']).toEqual({ passed: 0, failed: 0, skipped: 0, flaky: 1 });
    expect(output()).toContain('Tier L: 0 passed, 0 failed, 0 skipped, 1 flaky');
    // The loud FLAKY section still NAMES the test with its passing retry
    expect(output()).toContain('FLAKY (passed only on retry');
    expect(output()).toContain('flows › recovers eventually (passed on retry 1)');
  });

  it('counts a test that fails every attempt ONCE as failed (not once per retry)', () => {
    const reporter = new ManifestReporter();
    replayAttempts(reporter,
      stubTest('t2', ['', 'flows', 'always broken'], 'unexpected'),
      ['failed', 'timedOut', 'failed']);

    reporter.onEnd();

    expect(reporter.tiers['Tier L']).toEqual({ passed: 0, failed: 1, skipped: 0, flaky: 0 });
    expect(output()).toContain('Tier L: 0 passed, 1 failed, 0 skipped, 0 flaky');
  });

  it('counts passed/skipped finals and routes @hardware titles to Tier H', () => {
    const reporter = new ManifestReporter();
    replayAttempts(reporter, stubTest('t3', ['', 'flows', 'plain pass'], 'expected'), ['passed']);
    replayAttempts(reporter, stubTest('t4', ['', 'flows', 'gated skip'], 'skipped'), ['skipped']);
    replayAttempts(reporter, stubTest('t5', ['', 'show @hardware', 'bt pairs'], 'expected'), ['passed']);

    reporter.onEnd();

    expect(reporter.tiers['Tier L']).toEqual({ passed: 1, failed: 0, skipped: 1, flaky: 0 });
    expect(reporter.tiers['Tier H (@hardware)']).toEqual({ passed: 1, failed: 0, skipped: 0, flaky: 0 });
    expect(output()).toContain('Tier H (@hardware): 1 passed, 0 failed, 0 skipped, 0 flaky');
    // No flaky section when nothing was flaky
    expect(output()).not.toContain('FLAKY');
  });
});
