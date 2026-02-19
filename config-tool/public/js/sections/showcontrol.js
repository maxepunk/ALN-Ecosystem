/**
 * Show Control Section
 * Left: cue list with filters, add/duplicate/delete.
 * Right: cue editor (identity, trigger, commands/timeline, routing).
 * Bottom-left: asset manager (sounds/videos).
 */
import * as api from '../utils/api.js';
import { el } from '../utils/formatting.js';
import { renderCueEditor, clearCueEditor } from '../components/cueEditor.js';
import { renderAssetManager } from '../components/assetManager.js';

let cuesData = null;
let selectedIndex = -1;
let ctx = null;
let filterMode = 'all';
let listContainer = null;
let editorContainer = null;
let assetContainer = null;

export function render(container, config, context) {
  ctx = context;
  cuesData = JSON.parse(JSON.stringify(config.cues));
  if (!cuesData.cues) cuesData.cues = [];
  selectedIndex = -1;

  const panel = el('div', { className: 'split-panel' });

  // ── Left panel: cue list + asset manager ──
  const left = el('div', { className: 'split-panel__left' });

  const listCard = el('div', { className: 'card', style: { flex: '1', minHeight: '0' } },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Cues'),
      ),
      el('div', { style: { display: 'flex', gap: '4px' } },
        el('button', {
          className: 'btn btn--small',
          textContent: '+ New',
          onClick: addCue,
        }),
        el('button', {
          className: 'btn btn--small',
          textContent: 'Dup',
          onClick: duplicateCue,
        }),
        el('button', {
          className: 'btn btn--small btn--danger',
          textContent: 'Del',
          onClick: deleteCue,
        }),
      ),
    ),
  );

  // Filter
  const filterSelect = el('select', {
    style: { margin: '0 12px 8px', width: 'calc(100% - 24px)' },
    onChange: () => {
      filterMode = filterSelect.value;
      refreshCueList();
    },
  },
    el('option', { value: 'all' }, 'All Cues'),
    el('option', { value: 'quickfire' }, 'Quick Fire (Manual)'),
    el('option', { value: 'standing-event' }, 'Standing (Event)'),
    el('option', { value: 'standing-clock' }, 'Standing (Clock)'),
    el('option', { value: 'compound' }, 'Compound (Timeline)'),
  );
  listCard.appendChild(filterSelect);

  listContainer = el('div', { style: { overflowY: 'auto', flex: '1' } });
  listCard.appendChild(listContainer);
  left.appendChild(listCard);

  // Asset manager at bottom of left panel
  assetContainer = el('div', {});
  left.appendChild(assetContainer);

  // ── Right panel: cue editor ──
  const right = el('div', { className: 'split-panel__right' });
  editorContainer = el('div', {});
  right.appendChild(editorContainer);

  panel.appendChild(left);
  panel.appendChild(right);
  container.appendChild(panel);

  refreshCueList();
  renderAssetManager(assetContainer, ctx);
}

const FILTER_PREDICATES = {
  all: () => true,
  quickfire: (cue) => cue.quickFire && !cue.trigger,
  'standing-event': (cue) => cue.trigger?.event,
  'standing-clock': (cue) => cue.trigger?.clock,
  compound: (cue) => !!cue.timeline,
};

function getFilteredIndices() {
  const predicate = FILTER_PREDICATES[filterMode] || FILTER_PREDICATES.all;
  const indices = [];
  for (let i = 0; i < cuesData.cues.length; i++) {
    if (predicate(cuesData.cues[i])) indices.push(i);
  }
  return indices;
}

function getCueBadge(cue) {
  const hasQuickFire = cue.quickFire;
  const hasTrigger = !!cue.trigger;
  const isCompound = !!cue.timeline;

  if (isCompound) return { text: 'Timeline', cls: 'badge--both' };
  if (hasQuickFire && hasTrigger) return { text: 'Both', cls: 'badge--both' };
  if (hasTrigger) return { text: 'Auto', cls: 'badge--auto' };
  if (hasQuickFire) return { text: 'Manual', cls: 'badge--manual' };
  return { text: 'Auto', cls: 'badge--auto' };
}

function refreshCueList() {
  listContainer.textContent = '';
  const indices = getFilteredIndices();

  if (indices.length === 0) {
    listContainer.appendChild(el('div', { className: 'empty-state' },
      cuesData.cues.length === 0 ? 'No cues. Click "+ New" to create one.' : 'No cues match this filter.',
    ));
    return;
  }

  const list = el('div', { className: 'cue-list' });
  for (const idx of indices) {
    const cue = cuesData.cues[idx];
    const badge = getCueBadge(cue);

    const item = el('div', {
      className: `cue-list__item${idx === selectedIndex ? ' active' : ''}`,
      dataset: { index: String(idx) },
      onClick: () => selectCue(idx),
    },
      el('span', { className: 'cue-list__item-label' }, cue.label || cue.id),
      el('span', { className: `badge ${badge.cls}` }, badge.text),
    );

    // Drag-to-reorder
    item.draggable = true;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(idx));
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => { item.style.opacity = ''; });
    item.addEventListener('dragover', (e) => { e.preventDefault(); });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = idx;
      if (fromIdx === toIdx) return;
      const [moved] = cuesData.cues.splice(fromIdx, 1);
      cuesData.cues.splice(toIdx, 0, moved);
      // Adjust selectedIndex
      if (selectedIndex === fromIdx) selectedIndex = toIdx;
      else if (fromIdx < selectedIndex && toIdx >= selectedIndex) selectedIndex--;
      else if (fromIdx > selectedIndex && toIdx <= selectedIndex) selectedIndex++;
      ctx.markDirty('showcontrol');
      refreshCueList();
    });

    list.appendChild(item);
  }
  listContainer.appendChild(list);
}

function selectCue(index) {
  selectedIndex = index;
  refreshCueList();
  editorContainer.textContent = '';
  renderCueEditor(editorContainer, cuesData.cues[index], cuesData.cues, {
    markDirty: () => ctx.markDirty('showcontrol'),
    toast: ctx.toast,
    onLabelChange: () => refreshCueList(),
  });
}

function addCue() {
  const newCue = {
    id: 'cue-' + Date.now(),
    label: 'New Cue',
    quickFire: true,
    commands: [],
  };
  cuesData.cues.push(newCue);
  ctx.markDirty('showcontrol');
  selectedIndex = cuesData.cues.length - 1;
  refreshCueList();
  selectCue(selectedIndex);
}

function duplicateCue() {
  if (selectedIndex < 0) {
    ctx.toast('Select a cue to duplicate', 'info');
    return;
  }
  const clone = JSON.parse(JSON.stringify(cuesData.cues[selectedIndex]));
  clone.id = clone.id + '-copy-' + Date.now();
  clone.label = clone.label + ' (copy)';
  cuesData.cues.splice(selectedIndex + 1, 0, clone);
  ctx.markDirty('showcontrol');
  selectedIndex = selectedIndex + 1;
  refreshCueList();
  selectCue(selectedIndex);
}

function deleteCue() {
  if (selectedIndex < 0) {
    ctx.toast('Select a cue to delete', 'info');
    return;
  }
  const cue = cuesData.cues[selectedIndex];

  // Check if any other cue references this one via cue:fire
  const refs = cuesData.cues.filter(c =>
    c !== cue && (c.commands || c.timeline || []).some(cmd =>
      cmd.action === 'cue:fire' && cmd.payload?.cueId === cue.id
    )
  );
  const warning = refs.length > 0
    ? `\n\nWarning: Referenced by: ${refs.map(r => r.label).join(', ')}`
    : '';

  if (!confirm(`Delete cue "${cue.label}"?${warning}`)) return;

  cuesData.cues.splice(selectedIndex, 1);
  ctx.markDirty('showcontrol');
  if (selectedIndex >= cuesData.cues.length) selectedIndex = cuesData.cues.length - 1;
  refreshCueList();
  if (selectedIndex >= 0) {
    selectCue(selectedIndex);
  } else {
    editorContainer.textContent = '';
    clearCueEditor(editorContainer);
  }
}

export async function save() {
  // Validate before saving
  for (const cue of cuesData.cues) {
    if (!cue.label || !cue.label.trim()) {
      throw new Error(`Cue "${cue.id}" has no label`);
    }
    if (cue.commands && cue.timeline) {
      throw new Error(`Cue "${cue.label}" has both commands and timeline (must have only one)`);
    }
    // Validate clock trigger format
    if (cue.trigger?.clock) {
      const parts = cue.trigger.clock.split(':');
      if (parts.length !== 3 || parts.some(p => isNaN(parseInt(p)))) {
        throw new Error(`Cue "${cue.label}" has invalid clock trigger format (expected HH:MM:SS)`);
      }
    }
  }
  // Check for duplicate IDs
  const ids = new Set();
  for (const cue of cuesData.cues) {
    if (ids.has(cue.id)) throw new Error(`Duplicate cue ID: ${cue.id}`);
    ids.add(cue.id);
  }

  // Warn about missing sound/video files (non-blocking)
  try {
    const [sounds, videos] = await Promise.all([api.getSounds(), api.getVideos()]);
    const soundNames = new Set(sounds.map(s => s.name));
    const videoNames = new Set(videos.map(v => v.name));
    const warnings = [];
    for (const cue of cuesData.cues) {
      for (const cmd of (cue.commands || cue.timeline || [])) {
        if (cmd.action === 'sound:play' && cmd.payload?.file && !soundNames.has(cmd.payload.file)) {
          warnings.push(`"${cue.label}": sound "${cmd.payload.file}" not found`);
        }
        if (cmd.action === 'video:queue:add' && cmd.payload?.videoFile && !videoNames.has(cmd.payload.videoFile)) {
          warnings.push(`"${cue.label}": video "${cmd.payload.videoFile}" not found`);
        }
      }
    }
    if (warnings.length > 0) {
      ctx.toast(`Warning: ${warnings.join('; ')}`, 'info');
    }
  } catch {
    // Asset check is best-effort — don't block save
  }

  await api.putCues(cuesData);
}
