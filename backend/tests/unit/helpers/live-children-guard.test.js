/**
 * Unit tests for the live-child guard.
 *
 * Deliberately does NOT mock child_process: the guard's whole subject is real
 * OS processes, read from /proc. Every child is started INSIDE the try so the
 * finally always owns it, even if an expectation throws first.
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { findLiveChildren, assertNoLiveChildren } = require('../../helpers/live-children-guard');

/** @returns {boolean} true while /proc/<pid> still exists */
function procExists(pid) {
  try {
    fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** Poll until the pid is fully gone (SIGKILL is async; node reaps on close). */
async function waitForGone(pid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!procExists(pid)) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return !procExists(pid);
}

/** Kill and fully reap a child, so no test leaks into the environment teardown. */
async function reap(proc) {
  if (!proc || proc.killed === undefined) return;
  try { proc.kill('SIGKILL'); } catch { /* already dead */ }
  await waitForGone(proc.pid, 5000);
}

describe('findLiveChildren', () => {
  it('returns nothing when this process has no children', () => {
    expect(findLiveChildren()).toEqual([]);
  });

  it('finds a real child of this process, with its cmdline', async () => {
    let proc;
    try {
      proc = spawn('sleep', ['30']);
      const found = findLiveChildren().find((c) => c.pid === proc.pid);

      expect(found).toBeDefined();
      expect(found.cmdline).toBe('sleep 30');
    } finally {
      await reap(proc);
    }
  });

  it('is invisible to a foreign ownerPid', async () => {
    let proc;
    try {
      proc = spawn('sleep', ['30']);
      // pid 1 did not fork this child, so it must not show up as pid 1's.
      expect(findLiveChildren({ ownerPid: 1 }).find((c) => c.pid === proc.pid)).toBeUndefined();
      expect(procExists(proc.pid)).toBe(true);
    } finally {
      await reap(proc);
    }
  });

  it('ignores a pid that has already exited', async () => {
    let deadPid;
    const proc = spawn('true', []);
    deadPid = proc.pid;
    await new Promise((resolve) => proc.on('close', resolve));
    await waitForGone(deadPid, 2000);

    expect(procExists(deadPid)).toBe(false);
    expect(findLiveChildren().find((c) => c.pid === deadPid)).toBeUndefined();
  });

  // NOTE on zombies: `findLiveChildren` skips State Z, but that branch is not
  // unit-testable from Node. Node installs a SIGCHLD handler and reaps every
  // child it spawned as soon as it exits, so a child of THIS process is never
  // observable in state Z — by the time a test could look, /proc/<pid> is gone.
  // The skip exists for the real case it does occur in: a grandchild reparented
  // to the worker, or a child whose exit raced the scan. Verified by reading
  // /proc semantics rather than by a test, per RV-13's "if not reproducible,
  // drop that case and say so".
});

describe('assertNoLiveChildren', () => {
  it('does not throw when nothing is running', async () => {
    await expect(assertNoLiveChildren()).resolves.toEqual([]);
  });

  it('KILLS and reports a real leaked child', async () => {
    let proc;
    try {
      proc = spawn('sleep', ['30']);
      const pid = proc.pid;

      await expect(assertNoLiveChildren()).rejects.toThrow(/leaked 1 live child process/);
      expect(await waitForGone(pid)).toBe(true);
    } finally {
      await reap(proc);
    }
  });

  it('names the pid and cmdline, and the fix, in the message', async () => {
    let proc;
    try {
      proc = spawn('sleep', ['31']);
      let message = '';
      try {
        await assertNoLiveChildren();
      } catch (err) {
        message = err.message;
      }

      expect(message).toContain(`pid ${proc.pid}`);
      expect(message).toContain('sleep 31');
      expect(message).toContain('cleanupInitializedServices');
      expect(message).toContain('SIGKILLed');
    } finally {
      await reap(proc);
    }
  });

  it('accepts no owner override — it only ever acts on children of this process', async () => {
    // A former version accepted { ownerPid } and a test passed 1, which killed
    // every user-owned child of init (the operator's desktop session). The
    // killing function must be uncallable with a foreign owner.
    expect(assertNoLiveChildren.length).toBe(0);
    const { assertNoLiveChildren: fn } = require('../../helpers/live-children-guard');
    await expect(fn({ ownerPid: 1 })).resolves.toEqual([]); // argument is ignored, nothing killed
  });

  it('gives a child that was already told to stop time to exit (no false leak)', async () => {
    let proc;
    try {
      proc = spawn('sleep', ['30']);
      const pid = proc.pid;
      proc.kill('SIGTERM'); // the test file DID stop it; it just has not exited yet
      await expect(assertNoLiveChildren()).resolves.toEqual([]);
      expect(await waitForGone(pid)).toBe(true);
    } finally {
      await reap(proc);
    }
  });
});
