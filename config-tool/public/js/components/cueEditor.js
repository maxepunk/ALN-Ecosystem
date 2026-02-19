/**
 * Cue Editor Component
 * Renders identity, trigger, commands/timeline, and routing override sections.
 */
import { el } from '../utils/formatting.js';
import { renderConditionBuilder } from './conditionBuilder.js';
import { renderCommandList } from './commandForm.js';
import { renderTimelineView } from './timelineView.js';

const TRIGGER_EVENTS = {
  'transaction:accepted': { label: 'Token Processed', fields: ['tokenId', 'teamId', 'deviceType', 'points', 'memoryType', 'valueRating', 'groupId', 'teamScore', 'hasGroupBonus'] },
  'group:completed': { label: 'Group Completed', fields: ['teamId', 'groupId', 'multiplier', 'bonus'] },
  'video:loading': { label: 'Video Loading', fields: ['tokenId'] },
  'video:started': { label: 'Video Started', fields: ['tokenId', 'duration'] },
  'video:completed': { label: 'Video Completed', fields: ['tokenId'] },
  'video:paused': { label: 'Video Paused', fields: ['tokenId'] },
  'video:resumed': { label: 'Video Resumed', fields: ['tokenId'] },
  'player:scan': { label: 'Player Scan', fields: ['tokenId', 'deviceId', 'deviceType'] },
  'session:created': { label: 'Session Created', fields: ['sessionId'] },
  'cue:completed': { label: 'Cue Completed', fields: ['cueId'] },
  'sound:completed': { label: 'Sound Completed', fields: ['file'] },
  'spotify:track:changed': { label: 'Spotify Track Changed', fields: ['title', 'artist'] },
  'gameclock:started': { label: 'Game Clock Started', fields: ['gameStartTime'] },
};

const SINK_OPTIONS = ['(default)', 'hdmi', 'bluetooth', 'combine-bt'];

export function renderCueEditor(container, cue, allCues, editorCtx) {
  container.textContent = '';

  if (!cue) {
    container.appendChild(el('div', { className: 'empty-state' }, 'Select a cue to edit'));
    return;
  }

  renderIdentity(container, cue, editorCtx);
  renderTrigger(container, cue, editorCtx);

  if (cue.timeline) {
    renderTimelineView(container, cue, allCues, editorCtx);
  } else {
    renderCommandList(container, cue, allCues, editorCtx);
  }

  renderRoutingOverride(container, cue, editorCtx);
  renderCueTypeSwitch(container, cue, allCues, editorCtx);
}

export function clearCueEditor(container) {
  container.textContent = '';
  container.appendChild(el('div', { className: 'empty-state' }, 'Select a cue to edit'));
}

// ── Identity ──

function renderIdentity(container, cue, editorCtx) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__title', style: { marginBottom: '8px' } }, 'Identity'),
  );

  const grid = el('div', { className: 'form-grid' });

  // Label
  const labelGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-group__label' }, 'Label'),
  );
  const labelInput = el('input', {
    type: 'text', value: cue.label || '',
    onInput: () => {
      cue.label = labelInput.value;
      editorCtx.markDirty();
      editorCtx.onLabelChange();
    },
  });
  labelGroup.appendChild(labelInput);
  grid.appendChild(labelGroup);

  // ID (read-only)
  const idGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-group__label' }, 'ID'),
  );
  const idInput = el('input', {
    type: 'text', value: cue.id, disabled: true,
    style: { opacity: '0.6' },
  });
  idGroup.appendChild(idInput);
  grid.appendChild(idGroup);

  // Icon
  const iconGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-group__label' }, 'Icon'),
  );
  const iconInput = el('input', {
    type: 'text', value: cue.icon || '',
    onInput: () => { cue.icon = iconInput.value || null; editorCtx.markDirty(); },
  });
  iconGroup.appendChild(iconInput);
  grid.appendChild(iconGroup);

  // Once
  const onceGroup = el('div', { className: 'form-group' },
    el('label', { className: 'form-group__label' }, 'Fire Once'),
  );
  const onceCb = el('input', {
    type: 'checkbox', checked: !!cue.once,
    onChange: () => { cue.once = onceCb.checked; editorCtx.markDirty(); },
  });
  onceGroup.appendChild(onceCb);
  grid.appendChild(onceGroup);

  card.appendChild(grid);
  container.appendChild(card);
}

// ── Trigger ──

function renderTrigger(container, cue, editorCtx) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__title', style: { marginBottom: '8px' } }, 'Trigger Mode'),
  );

  // Mode radio: Manual / Automatic / Both
  const mode = cue.quickFire && cue.trigger ? 'both'
    : cue.trigger ? 'auto'
    : 'manual';

  const radioGroup = el('div', { className: 'radio-group' });
  const triggerConfigContainer = el('div', {});

  for (const opt of ['manual', 'auto', 'both']) {
    const label = { manual: 'Manual', auto: 'Automatic', both: 'Both' }[opt];
    const radio = el('input', {
      type: 'radio', name: 'trigger-mode', value: opt,
      checked: opt === mode,
      onChange: () => {
        if (opt === 'manual') {
          cue.quickFire = true;
          delete cue.trigger;
        } else if (opt === 'auto') {
          delete cue.quickFire;
          if (!cue.trigger) cue.trigger = { event: 'transaction:accepted' };
        } else {
          cue.quickFire = true;
          if (!cue.trigger) cue.trigger = { event: 'transaction:accepted' };
        }
        editorCtx.markDirty();
        renderTriggerConfig(triggerConfigContainer, cue, editorCtx);
      },
    });
    radioGroup.appendChild(el('label', { className: 'radio-label' }, radio, ` ${label}`));
  }

  card.appendChild(radioGroup);
  card.appendChild(triggerConfigContainer);
  container.appendChild(card);

  if (mode !== 'manual') {
    renderTriggerConfig(triggerConfigContainer, cue, editorCtx);
  }
}

function renderTriggerConfig(container, cue, editorCtx) {
  container.textContent = '';
  if (!cue.trigger) return;

  const isClockTrigger = !!cue.trigger.clock;

  // Trigger type selector
  const typeSelect = el('select', {
    style: { marginBottom: '12px' },
    onChange: () => {
      if (typeSelect.value === 'clock') {
        delete cue.trigger.event;
        delete cue.trigger.conditions;
        cue.trigger.clock = '00:05:00';
      } else {
        delete cue.trigger.clock;
        cue.trigger.event = typeSelect.value;
        cue.trigger.conditions = cue.trigger.conditions || [];
      }
      editorCtx.markDirty();
      renderTriggerConfig(container, cue, editorCtx);
    },
  },
    ...Object.entries(TRIGGER_EVENTS).map(([ev, def]) =>
      el('option', {
        value: ev,
        ...((!isClockTrigger && cue.trigger.event === ev) ? { selected: true } : {}),
      }, def.label)
    ),
    el('option', {
      value: 'clock',
      ...(isClockTrigger ? { selected: true } : {}),
    }, 'Game Clock Time'),
  );
  container.appendChild(typeSelect);

  if (isClockTrigger) {
    renderClockTrigger(container, cue, editorCtx);
  } else {
    renderEventConditions(container, cue, editorCtx);
  }
}

function renderClockTrigger(container, cue, editorCtx) {
  const parts = (cue.trigger.clock || '00:00:00').split(':').map(Number);
  const h = parts[0] || 0, m = parts[1] || 0, s = parts[2] || 0;

  const row = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });

  const hInput = el('input', {
    type: 'number', value: String(h), min: '0', max: '23', style: { width: '60px' },
    onInput: () => updateClock(),
  });
  const mInput = el('input', {
    type: 'number', value: String(m), min: '0', max: '59', style: { width: '60px' },
    onInput: () => updateClock(),
  });
  const sInput = el('input', {
    type: 'number', value: String(s), min: '0', max: '59', style: { width: '60px' },
    onInput: () => updateClock(),
  });

  function updateClock() {
    const hh = String(parseInt(hInput.value) || 0).padStart(2, '0');
    const mm = String(parseInt(mInput.value) || 0).padStart(2, '0');
    const ss = String(parseInt(sInput.value) || 0).padStart(2, '0');
    cue.trigger.clock = `${hh}:${mm}:${ss}`;
    editorCtx.markDirty();
  }

  row.append(
    el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'At'),
    hInput, el('span', {}, ':'), mInput, el('span', {}, ':'), sInput,
    el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, '(HH:MM:SS)'),
  );
  container.appendChild(row);
}

function renderEventConditions(container, cue, editorCtx) {
  const eventDef = TRIGGER_EVENTS[cue.trigger.event];
  if (!eventDef) return;

  if (!cue.trigger.conditions) cue.trigger.conditions = [];

  const conditionsDiv = el('div', { style: { marginTop: '8px' } });
  renderConditionBuilder(conditionsDiv, cue.trigger.conditions, eventDef.fields, editorCtx);
  container.appendChild(conditionsDiv);

  // Available fields reference
  const fieldsRef = el('div', {
    style: { marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' },
  }, `Available fields: ${eventDef.fields.join(', ')}`);
  container.appendChild(fieldsRef);
}

// ── Routing Override ──

function renderRoutingOverride(container, cue, editorCtx) {
  const details = document.createElement('details');
  details.className = 'config-group';
  if (cue.routing) details.open = true;

  const summary = document.createElement('summary');
  summary.textContent = 'Routing Override';
  details.appendChild(summary);

  const body = el('div', { className: 'config-group__body' });
  const grid = el('div', { className: 'form-grid' });

  for (const stream of ['sound', 'video', 'spotify']) {
    const currentVal = cue.routing?.[stream] || '(default)';

    const group = el('div', { className: 'form-group' },
      el('label', { className: 'form-group__label' }, `${stream} output`),
    );

    const select = el('select', {
      onChange: () => {
        if (select.value === '(default)') {
          if (cue.routing) delete cue.routing[stream];
          if (cue.routing && Object.keys(cue.routing).length === 0) delete cue.routing;
        } else {
          if (!cue.routing) cue.routing = {};
          cue.routing[stream] = select.value;
        }
        editorCtx.markDirty();
      },
    },
      ...SINK_OPTIONS.map(opt =>
        el('option', { value: opt, ...(opt === currentVal ? { selected: true } : {}) }, opt)
      ),
    );
    group.appendChild(select);
    grid.appendChild(group);
  }

  body.appendChild(grid);
  details.appendChild(body);
  container.appendChild(details);
}

// ── Type Switch (sequential ↔ timeline) ──

function renderCueTypeSwitch(container, cue, allCues, editorCtx) {
  const isTimeline = !!cue.timeline;
  const switchBtn = el('button', {
    className: 'btn btn--small',
    style: { marginTop: '12px' },
    textContent: isTimeline ? 'Convert to Sequential' : 'Convert to Timeline',
    onClick: () => {
      if (isTimeline) {
        if (!confirm('Convert to sequential commands? Timeline entries with "at" offsets will become a flat command list.')) return;
        cue.commands = (cue.timeline || []).map(({ at, ...cmd }) => cmd);
        delete cue.timeline;
        delete cue.duration;
      } else {
        if (!confirm('Convert to timeline? Each command will get an "at" offset starting from 0.')) return;
        let offset = 0;
        cue.timeline = (cue.commands || []).map(cmd => {
          const entry = { at: offset, ...cmd };
          offset += 1;
          return entry;
        });
        delete cue.commands;
      }
      editorCtx.markDirty();
      // Re-render the whole editor
      renderCueEditor(container.parentElement, cue, allCues, editorCtx);
    },
  });
  container.appendChild(switchBtn);
}
