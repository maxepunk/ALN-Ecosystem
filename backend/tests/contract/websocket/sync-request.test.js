/**
 * sync:request — Contract presence test (CC-3)
 * Asserts the client→server sync:request event is declared in the AsyncAPI
 * publish channel, so strict-validation middleware won't drop admin refresh.
 */
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const asyncapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
);

describe('sync:request — AsyncAPI publish contract (CC-3)', () => {
  it('declares a SyncRequest message in components.messages', () => {
    const messages = asyncapi.components.messages;
    const match = Object.values(messages).find(m => m.name === 'sync:request');
    expect(match).toBeDefined();
  });

  it('lists SyncRequest in the publish channel oneOf', () => {
    const refs = asyncapi.channels['/'].publish.message.oneOf.map(o => o.$ref);
    expect(refs).toContain('#/components/messages/SyncRequest');
  });
});
