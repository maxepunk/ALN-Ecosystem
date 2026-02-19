/**
 * Timeline View Component
 * Visual timeline for compound cues with drag-to-reposition and inline editing.
 */
import { el } from '../utils/formatting.js';
import { ACTION_DEFS, buildPayloadField, ensureAssets } from './commandForm.js';

const CATEGORY_COLORS = {
  sound: '#4285f4',
  lighting: '#fbbc04',
  video: '#ea4335',
  spotify: '#1ed760',
  cue: '#a855f7',
  display: '#9ca3af',
  audio: '#06b6d4',
};

let pxPerSec = 60;

export function renderTimelineView(container, cue, allCues, editorCtx) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Timeline'),
        buildDriverBadge(cue),
      ),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('label', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'Zoom'),
        buildZoomSlider(() => refreshTimeline()),
        el('button', {
          className: 'btn btn--small',
          textContent: '+ Entry',
          onClick: () => {
            const maxAt = cue.timeline.reduce((m, e) => Math.max(m, e.at), 0);
            cue.timeline.push({ at: maxAt + 1, action: 'sound:play', payload: {} });
            editorCtx.markDirty();
            refreshTimeline();
          },
        }),
      ),
    ),
  );

  // Duration input
  const durationRow = el('div', {
    style: { padding: '0 12px 8px', display: 'flex', gap: '8px', alignItems: 'center' },
  });
  const durInput = el('input', {
    type: 'number', value: String(cue.duration || ''), min: '0', step: '1',
    style: { width: '80px' },
    placeholder: 'auto',
    onInput: () => {
      const val = parseInt(durInput.value);
      if (val > 0) cue.duration = val;
      else delete cue.duration;
      editorCtx.markDirty();
      refreshTimeline();
    },
  });
  durationRow.append(
    el('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'Duration (s):'),
    durInput,
    el('span', { style: { fontSize: '11px', color: 'var(--text-muted)' } },
      `Auto: ${getMaxAt(cue)}s`),
  );
  card.appendChild(durationRow);

  // Visual timeline
  const timelineOuter = el('div', { className: 'timeline-container' });
  card.appendChild(timelineOuter);

  // Entry list below
  const entryListDiv = el('div', {});
  card.appendChild(entryListDiv);

  container.appendChild(card);

  function refreshTimeline() {
    renderVisualTimeline(timelineOuter, cue, editorCtx, refreshTimeline);
    renderEntryList(entryListDiv, cue, allCues, editorCtx, refreshTimeline);
  }

  // Load assets for pickers, then render
  ensureAssets().then(() => refreshTimeline());
}

function buildDriverBadge(cue) {
  const hasVideo = (cue.timeline || []).some(e =>
    e.action === 'video:queue:add' || e.action === 'video:play'
  );
  if (!hasVideo) return el('span', {});
  return el('div', { className: 'badge badge--both', style: { fontSize: '10px' } },
    'Video-driven timeline');
}

function buildZoomSlider(onChange) {
  const slider = el('input', {
    type: 'range', min: '20', max: '200', value: String(pxPerSec),
    style: { width: '100px' },
    onInput: () => {
      pxPerSec = parseInt(slider.value);
      onChange();
    },
  });
  return slider;
}

function getMaxAt(cue) {
  if (!cue.timeline || cue.timeline.length === 0) return 0;
  return Math.max(...cue.timeline.map(e => e.at));
}

function getDuration(cue) {
  return cue.duration || (getMaxAt(cue) + 1);
}

function getCategoryForAction(action) {
  const def = ACTION_DEFS[action];
  return def ? def.category : 'display';
}

function renderVisualTimeline(timelineOuter, cue, editorCtx, refreshFn) {
  timelineOuter.textContent = '';
  if (!cue.timeline || cue.timeline.length === 0) {
    timelineOuter.appendChild(el('div', { className: 'empty-state' }, 'Empty timeline'));
    return;
  }

  const duration = getDuration(cue);
  const totalWidth = duration * pxPerSec;

  const canvas = el('div', {
    style: {
      position: 'relative',
      width: `${totalWidth}px`,
      minHeight: '80px',
      padding: '28px 0 8px',
    },
  });

  // Ruler
  const ruler = el('div', { className: 'timeline-ruler', style: { width: `${totalWidth}px` } });
  for (let t = 0; t <= duration; t++) {
    const tick = el('div', {
      style: {
        position: 'absolute',
        left: `${t * pxPerSec}px`,
        top: '0',
        height: '100%',
        borderLeft: '1px solid var(--border-subtle)',
        fontSize: '9px',
        color: 'var(--text-muted)',
        paddingLeft: '3px',
        paddingTop: '2px',
      },
    }, `${t}s`);
    ruler.appendChild(tick);
  }
  canvas.appendChild(ruler);

  // Place blocks — simple stacking (row per block for now)
  const sorted = cue.timeline
    .map((entry, i) => ({ entry, originalIndex: i }))
    .sort((a, b) => a.entry.at - b.entry.at);

  sorted.forEach(({ entry, originalIndex }, row) => {
    const cat = getCategoryForAction(entry.action);
    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.display;
    const def = ACTION_DEFS[entry.action];
    const label = def ? def.label : entry.action;

    const block = el('div', {
      className: `timeline-block timeline-block--${cat}`,
      style: {
        left: `${entry.at * pxPerSec}px`,
        top: `${28 + row * 32}px`,
        minWidth: `${Math.max(pxPerSec * 0.8, 60)}px`,
      },
    }, label);

    // Drag to reposition
    block.draggable = true;
    let dragStartX = 0;
    block.addEventListener('dragstart', (e) => {
      dragStartX = e.clientX;
      e.dataTransfer.setData('text/plain', String(originalIndex));
      block.style.opacity = '0.5';
    });
    block.addEventListener('dragend', () => { block.style.opacity = ''; });

    canvas.appendChild(block);
  });

  // Drop handler on canvas for repositioning
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const idx = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(idx)) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.parentElement.scrollLeft;
    let newAt = Math.round((x / pxPerSec) * 2) / 2; // snap to 0.5s
    newAt = Math.max(0, newAt);
    cue.timeline[idx].at = newAt;
    editorCtx.markDirty();
    refreshFn();
  });

  // Adjust container height
  canvas.style.minHeight = `${28 + sorted.length * 32 + 8}px`;

  timelineOuter.appendChild(canvas);
}

function renderEntryList(entryListDiv, cue, allCues, editorCtx, refreshFn) {
  entryListDiv.textContent = '';

  if (!cue.timeline || cue.timeline.length === 0) return;

  // Sort by `at` for display
  const sorted = cue.timeline
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => a.entry.at - b.entry.at);

  const table = el('table', { className: 'data-table', style: { margin: '8px 0' } },
    el('thead', {},
      el('tr', {},
        el('th', { style: { width: '60px' } }, 'At (s)'),
        el('th', {}, 'Action'),
        el('th', {}, 'Payload'),
        el('th', { style: { width: '60px' } }, ''),
      ),
    ),
  );

  const tbody = el('tbody', {});
  for (const { entry, i } of sorted) {
    const def = ACTION_DEFS[entry.action];

    // At input
    const atInput = el('input', {
      type: 'number', value: String(entry.at), min: '0', step: '0.5',
      style: { width: '55px' },
      onInput: () => {
        entry.at = parseFloat(atInput.value) || 0;
        editorCtx.markDirty();
        renderVisualTimeline(
          entryListDiv.previousElementSibling, cue, editorCtx, refreshFn
        );
      },
    });

    // Action select
    const actionSelect = buildCompactActionSelect(entry.action, (newAction) => {
      entry.action = newAction;
      entry.payload = {};
      editorCtx.markDirty();
      refreshFn();
    });

    // Payload summary
    const payloadSummary = buildPayloadSummary(entry);

    // Delete
    const deleteBtn = el('button', {
      className: 'btn btn--small btn--danger', textContent: '\u00d7',
      onClick: () => {
        cue.timeline.splice(i, 1);
        editorCtx.markDirty();
        refreshFn();
      },
    });

    // Expand row for inline editing
    const detailsRow = el('tr', { hidden: true });
    const toggleBtn = el('button', {
      className: 'btn btn--small', textContent: '\u270e',
      style: { padding: '2px 6px', fontSize: '10px' },
      onClick: () => {
        detailsRow.hidden = !detailsRow.hidden;
        if (!detailsRow.hidden && detailsRow.childNodes.length === 0) {
          const td = el('td', { colSpan: '4' });
          const grid = el('div', { className: 'form-grid' });
          if (def && def.fields.length > 0) {
            for (const field of def.fields) {
              grid.appendChild(buildPayloadField(field, entry, allCues, editorCtx));
            }
          }
          td.appendChild(grid);
          detailsRow.appendChild(td);
        }
      },
    });

    tbody.appendChild(el('tr', {},
      el('td', {}, atInput),
      el('td', {}, actionSelect),
      el('td', { className: 'mono', style: { fontSize: '11px' } }, payloadSummary),
      el('td', { style: { display: 'flex', gap: '2px' } }, toggleBtn, deleteBtn),
    ));
    tbody.appendChild(detailsRow);
  }

  table.appendChild(tbody);
  entryListDiv.appendChild(table);
}

function buildCompactActionSelect(currentAction, onChange) {
  const select = el('select', {
    style: { fontSize: '12px' },
    onChange: () => onChange(select.value),
  });
  for (const [action, def] of Object.entries(ACTION_DEFS)) {
    select.appendChild(
      el('option', {
        value: action,
        ...(action === currentAction ? { selected: true } : {}),
      }, def.label)
    );
  }
  return select;
}

function buildPayloadSummary(entry) {
  const p = entry.payload;
  if (!p || Object.keys(p).length === 0) return '—';
  const parts = [];
  if (p.file) parts.push(p.file);
  if (p.videoFile) parts.push(p.videoFile);
  if (p.sceneId) parts.push(p.sceneId);
  if (p.cueId) parts.push(p.cueId);
  if (p.uri) parts.push(p.uri);
  if (p.volume !== undefined) parts.push(`vol:${p.volume}`);
  if (p.stream) parts.push(p.stream);
  if (p.sink) parts.push(p.sink);
  if (p.target) parts.push(`→${p.target}`);
  return parts.join(', ') || '—';
}

