/**
 * Audio & Environment Section
 * Stream routing table, ducking rules, Bluetooth + Lighting env settings.
 */
import * as api from '../utils/api.js';
import { el } from '../utils/formatting.js';
import { makeEnvField } from '../utils/formFields.js';

const SINK_OPTIONS = ['hdmi', 'bluetooth', 'combine-bt'];
const STREAMS = ['video', 'spotify', 'sound'];

let routingData = null;
let envData = null;
let ctx = null;

export function render(container, config, context) {
  ctx = context;
  routingData = JSON.parse(JSON.stringify(config.routing));
  envData = { ...config.env };

  renderStreamRouting(container);
  renderDuckingRules(container);
  renderBluetoothSettings(container);
  renderLightingSettings(container);
}

function renderStreamRouting(container) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Stream Routing'),
        el('div', { className: 'card__subtitle' }, 'Primary and fallback audio output per stream'),
      ),
    ),
  );

  const table = el('table', { className: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Stream'),
        el('th', {}, 'Primary Sink'),
        el('th', {}, 'Fallback Sink'),
      ),
    ),
    el('tbody', {},
      ...STREAMS.map(stream => {
        const route = routingData.routes?.[stream] || { sink: 'hdmi', fallback: 'hdmi' };

        const sinkSelect = el('select', {
          onChange: () => {
            if (!routingData.routes) routingData.routes = {};
            if (!routingData.routes[stream]) routingData.routes[stream] = {};
            routingData.routes[stream].sink = sinkSelect.value;
            ctx.markDirty('audio');
          },
        },
          ...SINK_OPTIONS.map(opt =>
            el('option', { value: opt, ...(opt === route.sink ? { selected: true } : {}) }, opt)
          ),
        );

        const fallbackSelect = el('select', {
          onChange: () => {
            if (!routingData.routes) routingData.routes = {};
            if (!routingData.routes[stream]) routingData.routes[stream] = {};
            routingData.routes[stream].fallback = fallbackSelect.value;
            ctx.markDirty('audio');
          },
        },
          ...SINK_OPTIONS.map(opt =>
            el('option', { value: opt, ...(opt === route.fallback ? { selected: true } : {}) }, opt)
          ),
        );

        return el('tr', {},
          el('td', { style: { fontWeight: '600', textTransform: 'capitalize' } }, stream),
          el('td', {}, sinkSelect),
          el('td', {}, fallbackSelect),
        );
      }),
    ),
  );

  card.appendChild(table);

  const fieldOpts = { sectionName: 'audio', markDirty: ctx.markDirty };
  const defaultGrid = el('div', { className: 'form-grid', style: { marginTop: '12px' } },
    makeEnvField(envData, 'AUDIO_DEFAULT_OUTPUT', 'Default Output', 'select', { ...fieldOpts, options: ['hdmi', 'bluetooth', 'combine-bt'] }),
  );
  card.appendChild(defaultGrid);

  container.appendChild(card);
}

function renderDuckingRules(container) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Ducking Rules'),
        el('div', { className: 'card__subtitle' }, 'Auto-reduce volume when overlapping streams play'),
      ),
      el('button', {
        className: 'btn btn--small',
        onClick: () => addDuckingRule(rulesContainer),
        textContent: '+ Add Rule',
      }),
    ),
  );

  const rulesContainer = el('div', {});

  if (!routingData.ducking) routingData.ducking = [];

  for (let i = 0; i < routingData.ducking.length; i++) {
    rulesContainer.appendChild(buildDuckingRow(i, rulesContainer));
  }

  if (routingData.ducking.length === 0) {
    rulesContainer.appendChild(el('div', { className: 'empty-state' }, 'No ducking rules. Click "+ Add Rule" to create one.'));
  }

  card.appendChild(rulesContainer);
  container.appendChild(card);
}

function buildDuckingRow(index, rulesContainer) {
  const rule = routingData.ducking[index];

  const whenSelect = el('select', {
    onChange: () => { rule.when = whenSelect.value; ctx.markDirty('audio'); },
  },
    ...STREAMS.map(s => el('option', { value: s, ...(s === rule.when ? { selected: true } : {}) }, s)),
  );

  const duckSelect = el('select', {
    onChange: () => { rule.duck = duckSelect.value; ctx.markDirty('audio'); },
  },
    ...STREAMS.map(s => el('option', { value: s, ...(s === rule.duck ? { selected: true } : {}) }, s)),
  );

  const rangeLabel = el('span', { className: 'mono', style: { minWidth: '40px', textAlign: 'right' } }, `${rule.to}%`);
  const toRange = el('input', {
    type: 'range', min: '0', max: '100', value: String(rule.to),
    onInput: () => {
      rule.to = parseInt(toRange.value);
      rangeLabel.textContent = `${rule.to}%`;
      ctx.markDirty('audio');
    },
  });

  const fadeInput = el('input', {
    type: 'number', value: String(rule.fadeMs), min: '0', step: '100',
    style: { width: '80px' },
    onInput: () => { rule.fadeMs = parseInt(fadeInput.value) || 0; ctx.markDirty('audio'); },
  });

  const deleteBtn = el('button', {
    className: 'btn btn--small btn--danger', textContent: '\u00d7',
    onClick: () => {
      routingData.ducking.splice(index, 1);
      ctx.markDirty('audio');
      refreshDuckingRules(rulesContainer);
    },
  });

  const row = el('div', { className: 'ducking-row' },
    el('div', {}, el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'When '), whenSelect),
    el('div', {}, el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'duck '), duckSelect),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'to'), toRange, rangeLabel,
    ),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
      fadeInput, el('span', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'ms'),
    ),
    deleteBtn,
  );
  return row;
}

function addDuckingRule(rulesContainer) {
  routingData.ducking.push({ when: 'video', duck: 'spotify', to: 20, fadeMs: 500 });
  ctx.markDirty('audio');
  refreshDuckingRules(rulesContainer);
}

function refreshDuckingRules(rulesContainer) {
  rulesContainer.textContent = '';
  for (let i = 0; i < routingData.ducking.length; i++) {
    rulesContainer.appendChild(buildDuckingRow(i, rulesContainer));
  }
  if (routingData.ducking.length === 0) {
    rulesContainer.appendChild(el('div', { className: 'empty-state' }, 'No ducking rules.'));
  }
}

function renderBluetoothSettings(container) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', { className: 'card__title' }, 'Bluetooth'),
    ),
  );

  const btOpts = { sectionName: 'audio', markDirty: ctx.markDirty };
  const grid = el('div', { className: 'form-grid' },
    makeEnvField(envData, 'BLUETOOTH_SCAN_TIMEOUT_SEC', 'Scan Timeout (seconds)', 'number', btOpts),
    makeEnvField(envData, 'BLUETOOTH_CONNECT_TIMEOUT_SEC', 'Connect Timeout (seconds)', 'number', btOpts),
  );

  card.appendChild(grid);
  container.appendChild(card);
}

function renderLightingSettings(container) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', { className: 'card__title' }, 'Lighting (Home Assistant)'),
    ),
  );

  const lightOpts = { sectionName: 'audio', markDirty: ctx.markDirty };
  const grid = el('div', { className: 'form-grid' },
    makeEnvField(envData, 'LIGHTING_ENABLED', 'Lighting Enabled', 'boolean', lightOpts),
    makeEnvField(envData, 'HOME_ASSISTANT_URL', 'Home Assistant URL', 'url', lightOpts),
    makeEnvField(envData, 'HOME_ASSISTANT_TOKEN', 'HA Access Token', 'password', lightOpts),
    makeEnvField(envData, 'HA_DOCKER_MANAGE', 'Auto-manage HA Docker', 'boolean', lightOpts),
  );

  card.appendChild(grid);
  container.appendChild(card);
}

export async function save() {
  // Save routing config
  await api.putRouting(routingData);
  // Save env vars that belong to audio/environment
  const envUpdates = {};
  for (const key of [
    'AUDIO_DEFAULT_OUTPUT',
    'BLUETOOTH_SCAN_TIMEOUT_SEC', 'BLUETOOTH_CONNECT_TIMEOUT_SEC',
    'HOME_ASSISTANT_URL', 'HOME_ASSISTANT_TOKEN', 'LIGHTING_ENABLED', 'HA_DOCKER_MANAGE',
  ]) {
    if (envData[key] !== undefined) envUpdates[key] = envData[key];
  }
  if (Object.keys(envUpdates).length > 0) {
    await api.putEnv(envUpdates);
  }
}
