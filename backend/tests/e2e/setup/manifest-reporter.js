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
      'Tier L': { passed: 0, failed: 0, skipped: 0 },
      'Tier H (@hardware)': { passed: 0, failed: 0, skipped: 0 },
    };
  }

  onTestEnd(test, result) {
    const tier = test.titlePath().join(' ').includes('@hardware')
      ? 'Tier H (@hardware)' : 'Tier L';
    if (result.status === 'passed') this.tiers[tier].passed++;
    else if (result.status === 'skipped') this.tiers[tier].skipped++;
    else if (result.status === 'failed' || result.status === 'timedOut') this.tiers[tier].failed++;
  }

  onEnd() {
    const tools = hostToolManifest();
    const lines = [
      '',
      '── E2E capability manifest (this machine) ──────────────────',
      ...Object.entries(tools).map(([k, v]) => `  ${v ? '✓' : '✗'} ${k}`),
      '── Tier counts ─────────────────────────────────────────────',
      ...Object.entries(this.tiers).map(([tier, c]) =>
        `  ${tier}: ${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped`),
      '  (skips are capability-gated and LOUD — see each skip reason)',
      '─────────────────────────────────────────────────────────────',
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }

  printsToStdio() { return false; }
}

module.exports = ManifestReporter;
