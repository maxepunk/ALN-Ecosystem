/**
 * Command Form Component
 * Sequential command list with dynamic payload forms per action type.
 */
import * as api from '../utils/api.js';
import { el } from '../utils/formatting.js';

const ACTION_DEFS = {
  'sound:play': { label: 'Play Sound', category: 'sound', fields: [
    { key: 'file', type: 'sound-picker', label: 'Sound File', required: true },
    { key: 'volume', type: 'range', label: 'Volume', min: 0, max: 100, default: 100 },
    { key: 'target', type: 'sink-picker', label: 'Output Target' },
  ]},
  'sound:stop': { label: 'Stop Sound', category: 'sound', fields: [
    { key: 'file', type: 'sound-picker', label: 'Sound File (blank = all)' },
  ]},
  'lighting:scene:activate': { label: 'Activate Scene', category: 'lighting', fields: [
    { key: 'sceneId', type: 'scene-picker', label: 'Scene', required: true },
  ]},
  'video:queue:add': { label: 'Queue Video', category: 'video', fields: [
    { key: 'videoFile', type: 'video-picker', label: 'Video File', required: true },
  ]},
  'video:play': { label: 'Resume Video', category: 'video', fields: [] },
  'video:pause': { label: 'Pause Video', category: 'video', fields: [] },
  'video:stop': { label: 'Stop Video', category: 'video', fields: [] },
  'spotify:play': { label: 'Play Spotify', category: 'spotify', fields: [] },
  'spotify:pause': { label: 'Pause Spotify', category: 'spotify', fields: [] },
  'spotify:stop': { label: 'Stop Spotify', category: 'spotify', fields: [] },
  'spotify:next': { label: 'Next Track', category: 'spotify', fields: [] },
  'spotify:previous': { label: 'Previous Track', category: 'spotify', fields: [] },
  'spotify:playlist': { label: 'Set Playlist', category: 'spotify', fields: [
    { key: 'uri', type: 'text', label: 'Playlist URI', required: true },
  ]},
  'spotify:volume': { label: 'Spotify Volume', category: 'spotify', fields: [
    { key: 'volume', type: 'range', label: 'Volume', min: 0, max: 100 },
  ]},
  'audio:volume:set': { label: 'Set Stream Volume', category: 'audio', fields: [
    { key: 'stream', type: 'select', label: 'Stream', options: ['video', 'spotify', 'sound'], required: true },
    { key: 'volume', type: 'range', label: 'Volume', min: 0, max: 100 },
  ]},
  'audio:route:set': { label: 'Route Stream', category: 'audio', fields: [
    { key: 'stream', type: 'select', label: 'Stream', options: ['video', 'spotify', 'sound'], required: true },
    { key: 'sink', type: 'sink-picker', label: 'Sink', required: true },
  ]},
  'cue:fire': { label: 'Fire Cue', category: 'cue', fields: [
    { key: 'cueId', type: 'cue-picker', label: 'Cue', required: true },
  ]},
  'cue:enable': { label: 'Enable Cue', category: 'cue', fields: [
    { key: 'cueId', type: 'cue-picker', label: 'Cue', required: true },
  ]},
  'cue:disable': { label: 'Disable Cue', category: 'cue', fields: [
    { key: 'cueId', type: 'cue-picker', label: 'Cue', required: true },
  ]},
  'display:idle-loop': { label: 'Show Idle Loop', category: 'display', fields: [] },
  'display:scoreboard': { label: 'Show Scoreboard', category: 'display', fields: [] },
  'display:toggle': { label: 'Toggle Display', category: 'display', fields: [] },
};

export { ACTION_DEFS };

// Cached asset lists
let soundsCache = null;
let videosCache = null;
let scenesCache = null;

export async function ensureAssets() {
  if (!soundsCache) {
    try { soundsCache = await api.getSounds(); } catch { soundsCache = []; }
  }
  if (!videosCache) {
    try { videosCache = await api.getVideos(); } catch { videosCache = []; }
  }
  if (!scenesCache) {
    try { scenesCache = await api.getScenes(); } catch { scenesCache = []; }
  }
}

export function invalidateAssetCache() {
  soundsCache = null;
  videosCache = null;
  scenesCache = null;
}

export function renderCommandList(container, cue, allCues, editorCtx) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', { className: 'card__title' }, 'Sequential Commands'),
      el('button', {
        className: 'btn btn--small',
        textContent: '+ Command',
        onClick: () => {
          if (!cue.commands) cue.commands = [];
          cue.commands.push({ action: 'sound:play', payload: {} });
          editorCtx.markDirty();
          refreshCommands();
        },
      }),
    ),
  );

  const commandsDiv = el('div', {});
  card.appendChild(commandsDiv);
  container.appendChild(card);

  function refreshCommands() {
    commandsDiv.textContent = '';
    if (!cue.commands || cue.commands.length === 0) {
      commandsDiv.appendChild(el('div', { className: 'empty-state' }, 'No commands. Click "+ Command" to add one.'));
      return;
    }
    // Load assets then render
    ensureAssets().then(() => {
      for (let i = 0; i < cue.commands.length; i++) {
        commandsDiv.appendChild(buildCommandRow(i, cue, allCues, editorCtx, refreshCommands));
      }
    });
  }

  refreshCommands();
}

function buildCommandRow(index, cue, allCues, editorCtx, refreshFn) {
  const cmd = cue.commands[index];
  const def = ACTION_DEFS[cmd.action];

  const row = el('div', {
    style: {
      padding: '12px',
      margin: '0 12px 8px',
      background: 'var(--bg-input)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-subtle)',
    },
  });

  // Header: action selector + order buttons + delete
  const header = el('div', {
    style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' },
  });

  const indexLabel = el('span', {
    className: 'mono',
    style: { fontSize: '11px', color: 'var(--text-muted)', minWidth: '20px' },
  }, `${index + 1}.`);

  const actionSelect = buildActionSelect(cmd.action, (newAction) => {
    cmd.action = newAction;
    cmd.payload = {};
    editorCtx.markDirty();
    refreshFn();
  });

  const moveUpBtn = el('button', {
    className: 'btn btn--small', textContent: '\u25b2', disabled: index === 0,
    style: { padding: '2px 6px', fontSize: '10px' },
    onClick: () => {
      [cue.commands[index - 1], cue.commands[index]] = [cue.commands[index], cue.commands[index - 1]];
      editorCtx.markDirty();
      refreshFn();
    },
  });
  const moveDownBtn = el('button', {
    className: 'btn btn--small', textContent: '\u25bc', disabled: index === cue.commands.length - 1,
    style: { padding: '2px 6px', fontSize: '10px' },
    onClick: () => {
      [cue.commands[index], cue.commands[index + 1]] = [cue.commands[index + 1], cue.commands[index]];
      editorCtx.markDirty();
      refreshFn();
    },
  });
  const deleteBtn = el('button', {
    className: 'btn btn--small btn--danger', textContent: '\u00d7',
    onClick: () => {
      cue.commands.splice(index, 1);
      editorCtx.markDirty();
      refreshFn();
    },
  });

  header.append(indexLabel, actionSelect, moveUpBtn, moveDownBtn, deleteBtn);
  row.appendChild(header);

  // Payload fields
  if (def && def.fields.length > 0) {
    const payloadGrid = el('div', { className: 'form-grid' });
    for (const field of def.fields) {
      payloadGrid.appendChild(buildPayloadField(field, cmd, allCues, editorCtx));
    }
    row.appendChild(payloadGrid);
  }

  return row;
}

function buildActionSelect(currentAction, onChange) {
  // Group actions by category
  const categories = {};
  for (const [action, def] of Object.entries(ACTION_DEFS)) {
    if (!categories[def.category]) categories[def.category] = [];
    categories[def.category].push({ action, label: def.label });
  }

  const select = el('select', {
    style: { flex: '1' },
    onChange: () => onChange(select.value),
  });

  for (const [cat, actions] of Object.entries(categories)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = cat.charAt(0).toUpperCase() + cat.slice(1);
    for (const { action, label } of actions) {
      const opt = el('option', {
        value: action,
        ...(action === currentAction ? { selected: true } : {}),
      }, label);
      optgroup.appendChild(opt);
    }
    select.appendChild(optgroup);
  }

  return select;
}

export function buildPayloadField(field, cmd, allCues, editorCtx) {
  const group = el('div', { className: 'form-group' },
    el('label', { className: 'form-group__label' }, field.label),
  );

  if (!cmd.payload) cmd.payload = {};
  const currentVal = cmd.payload[field.key];

  if (field.type === 'sound-picker' || field.type === 'video-picker') {
    const assetType = field.type === 'sound-picker' ? 'sounds' : 'videos';
    const cache = field.type === 'sound-picker' ? soundsCache : videosCache;
    const select = el('select', {
      onChange: () => {
        if (select.value === '__upload__') {
          uploadAsset(assetType, select, cmd, field.key, editorCtx);
        } else {
          cmd.payload[field.key] = select.value || undefined;
          editorCtx.markDirty();
        }
      },
    },
      el('option', { value: '' }, field.required ? '— select —' : '(none)'),
      ...(cache || []).map(a =>
        el('option', { value: a.name, ...(a.name === currentVal ? { selected: true } : {}) }, a.name)
      ),
      el('option', { value: '__upload__' }, 'Upload new...'),
    );
    group.appendChild(select);

  } else if (field.type === 'sink-picker') {
    const sinks = ['(default)', 'hdmi', 'bluetooth', 'combine-bt'];
    const select = el('select', {
      onChange: () => {
        cmd.payload[field.key] = select.value === '(default)' ? undefined : select.value;
        editorCtx.markDirty();
      },
    },
      ...sinks.map(s =>
        el('option', { value: s, ...(s === (currentVal || '(default)') ? { selected: true } : {}) }, s)
      ),
    );
    group.appendChild(select);

  } else if (field.type === 'cue-picker') {
    const select = el('select', {
      onChange: () => { cmd.payload[field.key] = select.value; editorCtx.markDirty(); },
    },
      el('option', { value: '' }, '— select —'),
      ...allCues.map(c =>
        el('option', { value: c.id, ...(c.id === currentVal ? { selected: true } : {}) }, c.label || c.id)
      ),
    );
    group.appendChild(select);

  } else if (field.type === 'scene-picker') {
    if (scenesCache && scenesCache.length > 0) {
      const select = el('select', {
        onChange: () => { cmd.payload[field.key] = select.value; editorCtx.markDirty(); },
      },
        el('option', { value: '' }, '— select —'),
        ...scenesCache.map(s =>
          el('option', { value: s.id, ...(s.id === currentVal ? { selected: true } : {}) }, `${s.name} (${s.id})`)
        ),
      );
      group.appendChild(select);
    } else {
      // Fallback to text input when HA is unreachable
      const input = el('input', {
        type: 'text', value: currentVal || '', placeholder: 'e.g. scene.game',
        onInput: () => { cmd.payload[field.key] = input.value; editorCtx.markDirty(); },
      });
      group.appendChild(input);
    }

  } else if (field.type === 'range') {
    const val = currentVal ?? field.default ?? field.min ?? 0;
    const rangeLabel = el('span', { className: 'mono', style: { minWidth: '35px', textAlign: 'right' } }, String(val));
    const range = el('input', {
      type: 'range',
      min: String(field.min ?? 0),
      max: String(field.max ?? 100),
      value: String(val),
      onInput: () => {
        cmd.payload[field.key] = parseInt(range.value);
        rangeLabel.textContent = range.value;
        editorCtx.markDirty();
      },
    });
    group.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, range, rangeLabel));

  } else if (field.type === 'select') {
    const select = el('select', {
      onChange: () => { cmd.payload[field.key] = select.value; editorCtx.markDirty(); },
    },
      ...field.options.map(opt =>
        el('option', { value: opt, ...(opt === currentVal ? { selected: true } : {}) }, opt)
      ),
    );
    group.appendChild(select);

  } else {
    // text
    const input = el('input', {
      type: 'text', value: currentVal || '',
      onInput: () => { cmd.payload[field.key] = input.value; editorCtx.markDirty(); },
    });
    group.appendChild(input);
  }

  return group;
}

function uploadAsset(type, selectElement, cmd, payloadKey, editorCtx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = type === 'sounds' ? '.wav,.mp3' : '.mp4';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) { selectElement.value = cmd.payload[payloadKey] || ''; return; }

    try {
      const result = type === 'sounds'
        ? await api.uploadSound(file)
        : await api.uploadVideo(file);
      // Refresh cache
      if (type === 'sounds') soundsCache = await api.getSounds();
      else videosCache = await api.getVideos();
      // Set the value
      cmd.payload[payloadKey] = result.filename;
      editorCtx.markDirty();
      // Add new option and select it
      const opt = el('option', { value: result.filename, selected: true }, result.filename);
      selectElement.insertBefore(opt, selectElement.lastElementChild);
      selectElement.value = result.filename;
    } catch (err) {
      selectElement.value = cmd.payload[payloadKey] || '';
      alert(`Upload failed: ${err.message}`);
    }
  });
  input.click();
}
