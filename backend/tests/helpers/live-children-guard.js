/**
 * Live-child guard — fail a test file that leaves a real OS process running.
 *
 * WHY: `initializeServices()` and several services start REAL ProcessMonitor
 * children (`dbus-monitor --system … org.bluez`, `pactl subscribe`). A suite
 * that starts them and never stops them does not fail — jest exits, the
 * children reparent to init, and they accumulate on the host forever. That is
 * how 2-3 strays appeared after every full run until 2026-09-15.
 *
 * HOW: ask the KERNEL, not the application. Scan /proc for processes whose
 * PPid is this jest worker. That is the ground truth about what this worker
 * forked, and it deliberately depends on no module state:
 *
 *   - A registry inside ProcessMonitor would be wiped by the ~20 suites that
 *     call `jest.resetModules()`, and the guard would then read a fresh empty
 *     registry and pass while a child was still running.
 *   - It also catches children spawned by anything else (a stray `execFile`
 *     that outlived its await, a service that shells out directly), not just
 *     ProcessMonitor.
 *
 * WHERE: `tests/helpers/jest-environment-guarded.js` calls this from the test
 * environment's `teardown()`, which runs AFTER every hook the test file itself
 * declared. An `afterAll` in a setup file cannot do this job: jest-circus runs
 * afterAll hooks in declaration order, and a setup file is declared first, so a
 * file that cleans up in its own root-level `afterAll` would be flagged before
 * it had the chance to clean up.
 */

const fs = require('fs');

// A stopped child gets this long to actually exit before it counts as leaked.
const GRACE_POLL_MS = 250;
const GRACE_POLLS = 4;

/**
 * Read a /proc field, returning null if the process is gone mid-scan.
 * @param {number|string} pid
 * @param {string} file - 'status' | 'cmdline'
 * @returns {string|null}
 */
function readProc(pid, file) {
  try {
    return fs.readFileSync(`/proc/${pid}/${file}`, 'utf8');
  } catch {
    // Exited between readdir and read — it is not a leak if it is already gone.
    return null;
  }
}

/**
 * Every live process forked by `ownerPid`.
 *
 * Zombies (State Z) are skipped: the child has already exited and is only
 * waiting to be reaped, so it holds no resources and SIGKILL would be a no-op.
 * Treating one as a leak would fail a file that did nothing wrong.
 *
 * @param {Object} [options]
 * @param {number} [options.ownerPid=process.pid]
 * @returns {Array<{pid: number, cmdline: string}>}
 */
function findLiveChildren({ ownerPid = process.pid } = {}) {
  const children = [];

  let entries;
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    // Not Linux, or /proc unavailable — the guard simply cannot run.
    return children;
  }

  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = parseInt(entry, 10);
    if (pid === ownerPid) continue;

    const status = readProc(pid, 'status');
    if (!status) continue;

    const ppidMatch = status.match(/^PPid:\s*(\d+)/m);
    if (!ppidMatch || parseInt(ppidMatch[1], 10) !== ownerPid) continue;

    const stateMatch = status.match(/^State:\s*(\S)/m);
    if (stateMatch && stateMatch[1] === 'Z') continue;

    const raw = readProc(pid, 'cmdline');
    if (raw === null) continue;
    const cmdline = raw.split('\0').filter(Boolean).join(' ')
      || (status.match(/^Name:\s*(.+)$/m) || [null, 'unknown'])[1].trim();

    children.push({ pid, cmdline });
  }

  return children;
}

/**
 * Assert this test file left no child process running.
 *
 * Survivors are SIGKILLed first and reported second, so a failing assertion
 * never also leaves a process behind.
 *
 * @returns {Promise<Array>} The (empty) leaked list, so callers can assert on it
 * @throws {Error} Listing every leaked child and how to fix it
 */
// SAFETY: this function kills. It must NEVER accept an owner pid. On
// 2026-09-18 a test called it with { ownerPid: 1 }, which SIGKILLed every
// user-owned process whose parent is init — the operator's desktop session,
// terminal and user systemd instance — and logged the show box out.
// findLiveChildren() above is read-only and keeps the parameter for tests.
async function assertNoLiveChildren() {
  const ownerPid = process.pid;
  // Grace period: a child the test file DID stop can still be mid-exit when
  // teardown runs (SIGTERM sent, process tearing down — /proc shows it with an
  // empty cmdline). Re-scan for up to ~1 s and report only what persists.
  let leaked = findLiveChildren({ ownerPid });
  for (let i = 0; i < GRACE_POLLS && leaked.length > 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, GRACE_POLL_MS));
    const still = new Set(findLiveChildren({ ownerPid }).map((c) => c.pid));
    leaked = leaked.filter((c) => still.has(c.pid));
  }
  if (leaked.length === 0) return [];

  for (const child of leaked) {
    // Re-verify parentage immediately before the kill (defence in depth).
    const status = readProc(child.pid, 'status');
    const ppid = status && status.match(/^PPid:\s*(\d+)/m);
    if (!ppid || parseInt(ppid[1], 10) !== process.pid) continue;
    try {
      process.kill(child.pid, 'SIGKILL');
    } catch {
      // Raced us and exited — gone either way.
    }
  }

  const detail = leaked.map((c) => `  - pid ${c.pid}: ${c.cmdline}`).join('\n');
  throw new Error(
    `This test file leaked ${leaked.length} live child process(es):\n${detail}\n\n`
    + 'They have been SIGKILLed, but the test file must stop them itself — otherwise '
    + 'they reparent to init and pile up on the host.\n'
    + 'Fix: stop the monitor in afterAll, or pair initializeServices() with '
    + 'afterAll(cleanupInitializedServices) from tests/helpers/service-reset.js.'
  );
}

module.exports = { findLiveChildren, assertNoLiveChildren };
