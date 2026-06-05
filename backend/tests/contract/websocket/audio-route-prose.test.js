/**
 * audio:route:set contract prose (AC-5)
 *
 * The GM dropdown sends the specific PipeWire sink name (e.g.
 * bluez_output.AA_BB_CC_DD_EE_FF.1), and audioRoutingService.setStreamRoute
 * tolerates 'hdmi'/'bluetooth' OR a specific sink name. So the AsyncAPI prose
 * must NOT claim the sink is only 'hdmi'|'bluetooth' — that under-specifies the
 * real wire contract. (Doc-prose-only: no wire payload change.)
 *
 * Lives here (a yaml-loading contract test) rather than the HTTP-only
 * request-schema-validation suite, which has no AsyncAPI/yaml harness.
 */
const fs = require('fs');
const path = require('path');

const asyncapiPath = path.join(__dirname, '../../../contracts/asyncapi.yaml');

describe('audio:route:set prose (AC-5)', () => {
  it('documents the sink as hdmi|bluetooth|<specific PipeWire sink name>', () => {
    const text = fs.readFileSync(asyncapiPath, 'utf8');
    const line = text.split('\n').find(l => l.includes('`audio:route:set`'));
    expect(line).toBeDefined();
    expect(line).toMatch(/specific sink name|<sink-name>|PipeWire sink|pipewire-sink-name/i);
  });
});
