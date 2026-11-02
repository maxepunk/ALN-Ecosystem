/**
 * GM Scanner ↔ AsyncAPI Conformance (cross-component contract test)
 *
 * These checks compare the GM Scanner client against the backend's AsyncAPI
 * contract — they are inherently cross-component and require BOTH artifacts to
 * be present. That is only true in the monorepo, so they live here in the
 * backend contract layer (which always has contracts/asyncapi.yaml as a sibling
 * and the ALNScanner submodule checked out) rather than in ALNScanner's own
 * unit suite, where the backend contract does not exist (ENOENT in standalone CI).
 *
 * Two directions are covered:
 *   1. server→client: the scanner's MESSAGE_TYPES forwarding list must equal the
 *      AsyncAPI subscribe oneOf set (was WS-2 in ALNScanner). Pairs with
 *      tests/contract/websocket/subscribe-oneof.test.js, which pins the contract
 *      side (batch:ack, player:scan).
 *   2. client→server: every gm:command action the admin controllers emit must be
 *      a member of the AsyncAPI GmCommand action enum (was gmCommandActionConformance).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { MESSAGE_TYPES } = require('../../../../ALNScanner/src/network/orchestratorClient');

const CONTRACT_PATH = path.join(__dirname, '../../../contracts/asyncapi.yaml');
const ADMIN_DIR = path.resolve(__dirname, '../../../../ALNScanner/src/admin');

function loadContract() {
  return yaml.load(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

function loadActionEnum(doc) {
  return new Set(
    doc.components.messages.GmCommand.payload.properties.data.properties.action.enum
  );
}

function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsFiles(full)); // recurse into subdirs (e.g. utils/)
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function collectControllerActions() {
  const found = new Map(); // action -> [relative file paths]
  const re = /sendCommand\(\s*this\.connection,\s*'([^']+)'/g;
  // Recursive so a future controller in a subdirectory can't emit a non-contract
  // action that silently slips past the safety net.
  for (const file of collectJsFiles(ADMIN_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
      const action = m[1];
      if (!found.has(action)) found.set(action, []);
      found.get(action).push(path.relative(ADMIN_DIR, file));
    }
  }
  return found;
}

describe('GM Scanner ↔ AsyncAPI conformance', () => {
  describe('server→client: MESSAGE_TYPES equals the subscribe oneOf set (WS-2)', () => {
    it('the scanner forwarding list matches the AsyncAPI server→client subscribe set', () => {
      const doc = loadContract();

      const contractEvents = doc.channels['/'].subscribe.message.oneOf
        .map(ref => ref['$ref'].split('/').pop())     // message key, e.g. 'SyncFull'
        .map(key => doc.components.messages[key].name) // event name, e.g. 'sync:full'
        .sort();

      const clientEvents = [...MESSAGE_TYPES].sort();

      expect(clientEvents).toEqual(contractEvents);
    });
  });

  describe('client→server: gm:command action-enum conformance (AC-1/CC-6/AC-4)', () => {
    it('every controller-emitted action is a member of the AsyncAPI GmCommand enum', () => {
      const enumSet = loadActionEnum(loadContract());
      const actions = collectControllerActions();

      expect(actions.size).toBeGreaterThan(0); // sanity: we actually parsed something

      const violations = [];
      for (const [action, files] of actions) {
        if (!enumSet.has(action)) {
          violations.push(`${action} (emitted by ${files.join(', ')})`);
        }
      }

      expect(violations).toEqual([]);
    });

    it('the enum contains the contract-defined system reset action', () => {
      const enumSet = loadActionEnum(loadContract());
      expect(enumSet.has('system:reset')).toBe(true);
    });
  });

  // Block 2 T1a D11: the health vocabulary is exactly three words, and it
  // is the SAME three words at every contract site that speaks it. The
  // registry is the authority (HEALTH_STATUSES); the contracts quote it.
  // `degraded` was deleted — a fourth word at any site re-opens the drift
  // the factsheet found (sync:full said [healthy, down], DomainStateHealth
  // said [healthy, degraded, down], the code said neither).
  describe('the three health enum sites agree with the registry', () => {
    const OPENAPI_PATH = path.join(__dirname, '../../../contracts/openapi.yaml');
    const { HEALTH_STATUSES } = require('../../../src/services/serviceHealthRegistry');

    function healthEnumSites() {
      const async = loadContract();
      const open = yaml.load(fs.readFileSync(OPENAPI_PATH, 'utf8'));
      return {
        'asyncapi sync:full.serviceHealth':
          async.components.messages.SyncFull.payload.properties.data
            .properties.serviceHealth.additionalProperties.properties.status.enum,
        'asyncapi DomainStateHealth':
          async.components.schemas.DomainStateHealth.additionalProperties
            .properties.status.enum,
        'openapi GameState.serviceHealth':
          open.components.schemas.GameState.properties.serviceHealth
            .additionalProperties.properties.status.enum,
      };
    }

    it('each site enumerates exactly the registry HEALTH_STATUSES', () => {
      expect([...HEALTH_STATUSES].sort()).toEqual(['dormant', 'down', 'healthy']);
      for (const [site, values] of Object.entries(healthEnumSites())) {
        expect({ site, values: [...values].sort() })
          .toEqual({ site, values: [...HEALTH_STATUSES].sort() });
      }
    });

    it('no site still carries the deleted word `degraded`', () => {
      for (const [site, values] of Object.entries(healthEnumSites())) {
        expect({ site, hasDegraded: values.includes('degraded') })
          .toEqual({ site, hasDegraded: false });
      }
    });

    it('DomainStateHealth requires the ninth service, display (P16)', () => {
      const async = loadContract();
      expect(async.components.schemas.DomainStateHealth.required).toContain('display');
    });
  });
});
