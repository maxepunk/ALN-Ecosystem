'use strict';

/**
 * Distinguishable error so callers can tell a timeout apart from the wrapped
 * operation's own rejection.
 */
class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'ETIMEDOUT';
  }
}

/**
 * Race a promise against a timeout. If the promise settles first, its result
 * (or rejection) is returned. If the timeout fires first, rejects with a
 * TimeoutError. The timer is always cleared so it never keeps the event loop
 * alive. The losing promise (e.g. a wedged operation) is intentionally
 * abandoned — the caller decides what to do with the dead resource.
 *
 * @param {Promise} promise - the operation to bound
 * @param {number} ms - timeout in milliseconds
 * @param {string} [label='operation'] - included in the TimeoutError message
 * @returns {Promise}
 */
function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout, TimeoutError };
