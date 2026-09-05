/**
 * B0 BS.1 — the pack-gate runner (design r2 D-B0.1r2 step 3, the
 * child-process seam ruled viable by the red-team's A1 self-refutation).
 *
 * `node backend/scripts/validate-pack.js <dir>` runs the ENGINE'S OWN
 * activation gate against an arbitrary pack directory in an isolated
 * child process — parity by construction (it IS activatePack), state
 * mutation and logger side effects contained, no module-graph leakage
 * into the calling tool (the A1 CRITICAL). Machine-readable verdict on
 * stdout; exit 0 = gate passed, 1 = refused, 2 = runner misuse.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUNNER = path.resolve(__dirname, '../../../scripts/validate-pack.js');
const ALN_PACK = path.resolve(__dirname, '../../../../ALN-TokenData');

function runGate(dir) {
  try {
    const out = execFileSync('node', [RUNNER, dir], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    });
    return { code: 0, verdict: JSON.parse(out) };
  } catch (err) {
    const out = err.stdout ? String(err.stdout) : '';
    let verdict = null;
    try { verdict = JSON.parse(out); } catch { /* non-JSON = runner crash */ }
    return { code: err.status, verdict };
  }
}

describe('scripts/validate-pack.js — the gate runner seam', () => {
  jest.setTimeout(30000);

  it('passes the real ALN pack and reports its identity', () => {
    const { code, verdict } = runGate(ALN_PACK);
    expect(code).toBe(0);
    expect(verdict.ok).toBe(true);
    expect(verdict.packId).toBe('about-last-night');
    expect(verdict.contentHash).toMatch(/^sha256:[0-9a-f]{16,64}$/);
    expect(verdict.problems).toEqual([]);
  });

  it('REFUSES a gate-illegal draft with the engine\'s own problem text (exit 1)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-gate-'));
    try {
      for (const f of ['tokens.json', 'game.json', 'cues.json', 'strings.json',
        'theme.json', 'pack-manifest.json', 'tokens.schema.json', 'game.schema.json',
        'cues.schema.json', 'strings.schema.json', 'theme.schema.json']) {
        const src = path.join(ALN_PACK, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, f));
      }
      // Break the theme: headerless — the gate refuses declared-but-unusable.
      fs.writeFileSync(path.join(tmp, 'theme.json'),
        JSON.stringify({ rating: { display: 'none' } }));
      const { code, verdict } = runGate(tmp);
      expect(code).toBe(1);
      expect(verdict.ok).toBe(false);
      expect(verdict.problems.join('\n')).toMatch(/theme/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('reports a manifest-less directory as ok:true with NULL identity — the packless posture the caller must refuse for publish', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-gate-'));
    try {
      fs.writeFileSync(path.join(tmp, 'tokens.json'), '{}');
      const { code, verdict } = runGate(tmp);
      expect(code).toBe(0);
      expect(verdict.ok).toBe(true);
      expect(verdict.packId).toBeNull();
      expect(verdict.contentHash).toBeNull();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('exits 2 on missing/nonexistent dir argument — misuse, distinct from refusal', () => {
    const { code } = runGate(path.join(os.tmpdir(), 'aln-definitely-not-a-dir-xyz'));
    expect(code).toBe(2);
  });
});
