const { withTimeout, TimeoutError } = require('../../../src/utils/withTimeout');

describe('withTimeout', () => {
  it('resolves with the value when the promise settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'x')).resolves.toBe('ok');
  });

  it('propagates rejection when the promise rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'x'))
      .rejects.toThrow('boom');
  });

  it('rejects with a TimeoutError when the promise never settles', async () => {
    const never = new Promise(() => {});
    const err = await withTimeout(never, 20, 'MPD command').catch(e => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.message).toMatch(/MPD command timed out after 20ms/);
  });

  it('clears the timer when the promise wins (no lingering handle)', async () => {
    const spy = jest.spyOn(global, 'clearTimeout');
    await withTimeout(Promise.resolve(1), 1000, 'x');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('uses a default label when none is provided', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20)).rejects.toThrow(/operation timed out after 20ms/);
  });
});
