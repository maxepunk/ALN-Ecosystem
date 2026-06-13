/**
 * Capability-manifest reporter (Phase 2.x.2)
 *
 * Prints, at the END of every E2E run:
 *  - the HOST TOOL manifest (which stack binaries/daemons this machine has —
 *    the reason capability skips happened)
 *  - pass/fail/skip counts split by tier (@hardware tag vs Tier L)
 *
 * "All green" must always disclose what was actually probed — a run where
 * the show was silently skipped can never again look like a full pass.
 *
 * SCOPE HONESTY: this manifest describes the TEST machine (stack-tool
 * presence). Production install tiers vary by ENDPOINTS, not stack — see
 * docs/proposals/2026-06-11-capability-vocabulary.md.
 */

const { execFileSync } = require('child_process');

function which(bin) {
  try { execFileSync('which', [bin], { stdio: 'pipe' }); return true; }
  catch { return false; }
}

function hostToolManifest() {
  return {
    'cvlc (vlc)': which('cvlc'),
    'mpd (music)': which('mpd'),
    'pactl (audio/sound)': which('pactl'),
    'bluetoothctl (bluetooth)': which('bluetoothctl'),
    'docker (lighting/HA)': which('docker'),
  };
}

class ManifestReporter {
  constructor() {
    this.tiers = {
      'Tier L': { passed: 0, failed: 0, skipped: 0, flaky: 0 },
      'Tier H (@hardware)': { passed: 0, failed: 0, skipped: 0, flaky: 0 },
    };
    this.flakyTests = [];
    // test.id → { test, lastRetry }. Counts are derived from FINAL outcomes
    // in onEnd() — onTestEnd fires once per ATTEMPT, so counting there
    // double-counts a fail-then-pass retry (attempt 1 bumped failed, attempt
    // 2 bumped flaky → "1 failed" printed against exit 0).
    this._tests = new Map();
  }

  onTestEnd(test, result) {
    const entry = this._tests.get(test.id) || { test, lastRetry: 0 };
    entry.lastRetry = Math.max(entry.lastRetry, result.retry);
    this._tests.set(test.id, entry);
  }

  onEnd() {
    // Final outcomes only: test.outcome() folds all attempts into
    // 'expected' | 'unexpected' | 'flaky' | 'skipped'. A pass on retry is a
    // FLAKE, not a pass (merge-readiness review CI nit: retries:2 silently
    // masked Tier L flakes) — count and NAME them so an "all green" run
    // discloses what only passed on a second attempt.
    for (const { test, lastRetry } of this._tests.values()) {
      const tier = test.titlePath().join(' ').includes('@hardware')
        ? 'Tier H (@hardware)' : 'Tier L';
      switch (test.outcome()) {
        case 'expected': this.tiers[tier].passed++; break;
        case 'skipped': this.tiers[tier].skipped++; break;
        case 'flaky':
          this.tiers[tier].flaky++;
          this.flakyTests.push(`${test.titlePath().slice(1).join(' › ')} (passed on retry ${lastRetry})`);
          break;
        default: this.tiers[tier].failed++; // 'unexpected'
      }
    }

    const tools = hostToolManifest();
    const lines = [
      '',
      '── E2E capability manifest (this machine) ──────────────────',
      ...Object.entries(tools).map(([k, v]) => `  ${v ? '✓' : '✗'} ${k}`),
      '── Tier counts ─────────────────────────────────────────────',
      ...Object.entries(this.tiers).map(([tier, c]) =>
        `  ${tier}: ${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped, ${c.flaky} flaky`),
      '  (skips are capability-gated and LOUD — see each skip reason)',
      ...(this.flakyTests.length > 0 ? [
        '── FLAKY (passed only on retry — investigate, do not ignore) ',
        ...this.flakyTests.map(t => `  ⚠ ${t}`),
      ] : []),
      '─────────────────────────────────────────────────────────────',
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }

  printsToStdio() { return false; }
}

module.exports = ManifestReporter;
