/**
 * Boot-wiring contract: initializeServices() loads the venue ducking rules
 * (config/environment/routing.json `ducking` array) into audioRoutingService.
 *
 * Regression pin for the slice-4 S4 cutover (726b552): retiring the venue
 * cues.json block from app.js also removed the function-scoped
 * `const fs = require('fs').promises` that the ducking-rules block below it
 * still used. The resulting ReferenceError was swallowed by the block's
 * catch (logged as "Failed to load ducking rules"), so every boot ran with
 * the ducking engine inactive while the unit suite stayed green. CI lint
 * (no-undef) caught it; this test pins the BEHAVIOR so the wiring cannot
 * silently degrade again.
 *
 * Mock-hygiene note: jest.config.base sets clearMocks/resetMocks/restoreMocks,
 * which wipe spy call records between tests — so the calls are captured into
 * a plain variable in beforeAll, immediately after init runs.
 */

const fs = require('fs');
const path = require('path');
const audioRoutingService = require('../../../src/services/audioRoutingService');
const { initializeServices } = require('../../../src/app');

describe('initializeServices ducking-config wiring', () => {
  let capturedRuleLoads;

  beforeAll(async () => {
    const spy = jest.spyOn(audioRoutingService, 'loadDuckingRules');
    await initializeServices();
    capturedRuleLoads = spy.mock.calls.map((call) => call[0]);
    spy.mockRestore();
  });

  it('loads the routing.json ducking rules into audioRoutingService at boot', () => {
    const routingPath = path.join(__dirname, '../../../config/environment/routing.json');
    const routing = JSON.parse(fs.readFileSync(routingPath, 'utf8'));

    // The venue file really declares rules — otherwise this pin is vacuous.
    expect(Array.isArray(routing.ducking)).toBe(true);
    expect(routing.ducking.length).toBeGreaterThan(0);

    // Boot handed exactly those rules to the routing service.
    expect(capturedRuleLoads).toContainEqual(routing.ducking);
  });
});
