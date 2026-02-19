/**
 * Infrastructure Section
 * Collapsible form groups mapping to .env variables.
 */
import * as api from '../utils/api.js';
import { el } from '../utils/formatting.js';
import { makeEnvField } from '../utils/formFields.js';

// Env var groups with field definitions
const ENV_GROUPS = [
  {
    label: 'Server', open: true, fields: [
      { key: 'NODE_ENV', label: 'Environment', type: 'select', options: ['development', 'production'] },
      { key: 'PORT', label: 'Port', type: 'number' },
      { key: 'HOST', label: 'Host', type: 'text' },
      { key: 'CORS_ORIGINS', label: 'CORS Origins', type: 'text', hint: 'Leave empty for auto-detect (RFC1918 + .local)' },
    ],
  },
  {
    label: 'HTTPS', fields: [
      { key: 'ENABLE_HTTPS', label: 'Enable HTTPS', type: 'boolean', hint: 'Required for Web NFC API' },
      { key: 'SSL_KEY_PATH', label: 'SSL Key Path', type: 'text' },
      { key: 'SSL_CERT_PATH', label: 'SSL Cert Path', type: 'text' },
      { key: 'HTTP_REDIRECT_PORT', label: 'HTTP Redirect Port', type: 'number' },
    ],
  },
  {
    label: 'Security', fields: [
      { key: 'JWT_SECRET', label: 'JWT Secret', type: 'password' },
      { key: 'JWT_EXPIRY', label: 'JWT Expiry', type: 'text', hint: 'e.g. 24h' },
      { key: 'ADMIN_PASSWORD', label: 'Admin Password', type: 'password' },
    ],
  },
  {
    label: 'VLC', fields: [
      { key: 'VLC_HOST', label: 'VLC Host', type: 'text' },
      { key: 'VLC_PORT', label: 'VLC Port', type: 'number' },
      { key: 'VLC_PASSWORD', label: 'VLC Password', type: 'password' },
      { key: 'VLC_RECONNECT_INTERVAL', label: 'Reconnect Interval (ms)', type: 'number' },
      { key: 'VLC_MAX_RETRIES', label: 'Max Retries', type: 'number' },
      { key: 'VIDEO_DIR', label: 'Video Directory', type: 'text' },
    ],
  },
  {
    label: 'Session', fields: [
      { key: 'MAX_PLAYERS', label: 'Max Players', type: 'number' },
      { key: 'MAX_GM_STATIONS', label: 'Max GM Stations', type: 'number' },
      { key: 'DUPLICATE_WINDOW', label: 'Duplicate Window (s)', type: 'number' },
      { key: 'SESSION_TIMEOUT', label: 'Session Timeout (min)', type: 'number' },
      { key: 'HEARTBEAT_INTERVAL', label: 'Heartbeat Interval (ms)', type: 'number' },
    ],
  },
  {
    label: 'Storage', fields: [
      { key: 'DATA_DIR', label: 'Data Directory', type: 'text' },
      { key: 'LOGS_DIR', label: 'Logs Directory', type: 'text' },
      { key: 'BACKUP_INTERVAL', label: 'Backup Interval', type: 'number' },
      { key: 'ARCHIVE_AFTER', label: 'Archive After (hours)', type: 'number' },
    ],
  },
  {
    label: 'Rate Limiting', fields: [
      { key: 'RATE_LIMIT_WINDOW', label: 'Window (ms)', type: 'number' },
      { key: 'RATE_LIMIT_MAX', label: 'Max Requests', type: 'number' },
    ],
  },
  {
    label: 'WebSocket', fields: [
      { key: 'WS_PING_TIMEOUT', label: 'Ping Timeout (ms)', type: 'number' },
      { key: 'WS_PING_INTERVAL', label: 'Ping Interval (ms)', type: 'number' },
      { key: 'WS_MAX_PAYLOAD', label: 'Max Payload (bytes)', type: 'number' },
    ],
  },
  {
    label: 'Logging', fields: [
      { key: 'LOG_LEVEL', label: 'Log Level', type: 'select', options: ['error', 'warn', 'info', 'debug'] },
      { key: 'LOG_FORMAT', label: 'Log Format', type: 'select', options: ['json', 'simple'] },
      { key: 'LOG_MAX_FILES', label: 'Max Log Files', type: 'number' },
      { key: 'LOG_MAX_SIZE', label: 'Max Log Size', type: 'text', hint: 'e.g. 10m' },
    ],
  },
  {
    label: 'Game', fields: [
      { key: 'TRANSACTION_HISTORY_LIMIT', label: 'Transaction History Limit', type: 'number' },
      { key: 'RECENT_TRANSACTIONS_COUNT', label: 'Recent Transactions Count', type: 'number' },
    ],
  },
  {
    label: 'Feature Flags', fields: [
      { key: 'ENABLE_OFFLINE_MODE', label: 'Offline Mode', type: 'boolean' },
      { key: 'ENABLE_VIDEO_PLAYBACK', label: 'Video Playback', type: 'boolean' },
      { key: 'ENABLE_ADMIN_PANEL', label: 'Admin Panel', type: 'boolean' },
      { key: 'ENABLE_DEBUGGING', label: 'Debugging', type: 'boolean' },
      { key: 'FEATURE_IDLE_LOOP', label: 'Idle Loop', type: 'boolean', hint: 'Disable for hands-on testing' },
    ],
  },
];

let envData = null;
let ctx = null;

export function render(container, config, context) {
  ctx = context;
  envData = { ...config.env };

  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Backend Environment'),
        el('div', { className: 'card__subtitle' }, 'Edit backend/.env — changes take effect on backend restart'),
      ),
    ),
  );

  for (const group of ENV_GROUPS) {
    const details = document.createElement('details');
    details.className = 'config-group';
    if (group.open) details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = group.label;
    details.appendChild(summary);

    const body = el('div', { className: 'config-group__body' });
    const grid = el('div', { className: 'form-grid' });
    const fieldOpts = { sectionName: 'infra', markDirty: ctx.markDirty };

    for (const field of group.fields) {
      grid.appendChild(makeEnvField(envData, field.key, field.label, field.type, {
        ...fieldOpts,
        options: field.options,
        hint: field.hint,
      }));
    }

    body.appendChild(grid);
    details.appendChild(body);
    card.appendChild(details);
  }

  container.appendChild(card);
}

export async function save() {
  // Only send keys that belong to this section's ENV_GROUPS
  const ownKeys = new Set(ENV_GROUPS.flatMap(g => g.fields.map(f => f.key)));
  const updates = {};
  for (const key of ownKeys) {
    if (envData[key] !== undefined) updates[key] = envData[key];
  }
  await api.putEnv(updates);
}
