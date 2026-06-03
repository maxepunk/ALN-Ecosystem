/**
 * Server→client subscribe oneOf completeness (P0.4 / CC-7)
 *
 * batch:ack and player:scan are genuine server→client events the GM Scanner
 * consumes (and forwards via orchestratorClient MESSAGE_TYPES), but they were
 * omitted from the AsyncAPI server→client subscribe oneOf. A strict-validation
 * middleware would drop them, and the scanner↔contract forwarding cross-check
 * (P0.4) stays red until they are declared here. This pins them in the contract.
 */
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const asyncapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
);

describe('subscribe oneOf completeness (P0.4)', () => {
  const subscribeEventNames = asyncapi.channels['/'].subscribe.message.oneOf
    .map(ref => ref.$ref.split('/').pop())
    .map(key => asyncapi.components.messages[key].name);

  it('declares batch:ack in the subscribe oneOf', () => {
    expect(subscribeEventNames).toContain('batch:ack');
  });

  it('declares player:scan in the subscribe oneOf', () => {
    expect(subscribeEventNames).toContain('player:scan');
  });
});
