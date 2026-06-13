/**
 * Seek Commands — Contract Validation Tests (Schema-only, no server)
 *
 * Decision C4 (2026-06-09): video:seek / music:seek added contract-first.
 * Payload is { position } in SECONDS. Validates both actions against the
 * gm:command action enum in asyncapi.yaml.
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('Seek commands — AsyncAPI contract (C4, F-GMCMD-21)', () => {
  it.each(['video:seek', 'music:seek'])('%s with position payload validates', (action) => {
    const cmd = {
      event: 'gm:command',
      data: { action, payload: { position: 42 } },
      timestamp: new Date().toISOString(),
    };
    expect(() => validateWebSocketEvent(cmd, 'gm:command')).not.toThrow();
  });
});
