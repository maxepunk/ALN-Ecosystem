/**
 * Presets Section
 * Save, load, export, import, and delete named configuration presets.
 */
import * as api from '../utils/api.js';
import { formatDate, el } from '../utils/formatting.js';

let ctx = null;

export function render(container, config, context) {
  ctx = context;

  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Configuration Presets'),
        el('div', { className: 'card__subtitle' }, 'Save and restore complete venue configurations'),
      ),
      el('div', { style: { display: 'flex', gap: '8px' } },
        el('button', {
          className: 'btn btn--small',
          textContent: 'Save Current',
          onClick: () => saveCurrentPreset(listContainer),
        }),
        el('button', {
          className: 'btn btn--small',
          textContent: 'Import',
          onClick: () => importPreset(listContainer),
        }),
      ),
    ),
  );

  const listContainer = el('div', {});
  card.appendChild(listContainer);
  container.appendChild(card);

  loadPresetList(listContainer);
}

async function loadPresetList(listContainer) {
  listContainer.textContent = '';
  try {
    const presets = await api.getPresets();
    if (presets.length === 0) {
      listContainer.appendChild(el('div', { className: 'empty-state' }, 'No presets saved yet. Click "Save Current" to create one.'));
      return;
    }

    const table = el('table', { className: 'data-table' },
      el('thead', {},
        el('tr', {},
          el('th', {}, 'Name'),
          el('th', {}, 'Description'),
          el('th', {}, 'Created'),
          el('th', {}, 'Actions'),
        ),
      ),
    );

    const tbody = el('tbody', {});
    for (const preset of presets) {
      const isBackup = preset.name.startsWith('_backup_');

      const actions = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
        el('button', {
          className: 'btn btn--small',
          textContent: 'Load',
          onClick: () => handleLoad(preset.filename, listContainer),
        }),
        el('button', {
          className: 'btn btn--small',
          textContent: 'Export',
          onClick: () => api.exportPreset(preset.filename),
        }),
      );

      if (!isBackup) {
        actions.appendChild(el('button', {
          className: 'btn btn--small btn--danger',
          textContent: 'Delete',
          onClick: () => handleDelete(preset.filename, preset.name, listContainer),
        }));
      }

      tbody.appendChild(el('tr', {},
        el('td', { style: { fontWeight: '600' } },
          isBackup ? `(auto-backup)` : preset.name,
        ),
        el('td', { style: { color: 'var(--text-muted)' } }, preset.description || '—'),
        el('td', { className: 'mono', style: { fontSize: '12px' } }, formatDate(preset.created)),
        el('td', {}, actions),
      ));
    }

    table.appendChild(tbody);
    listContainer.appendChild(table);
  } catch (err) {
    listContainer.appendChild(el('div', { className: 'empty-state' }, `Failed to load presets: ${err.message}`));
  }
}

async function saveCurrentPreset(listContainer) {
  const name = prompt('Preset name:');
  if (!name || !name.trim()) return;

  const description = prompt('Description (optional):') || '';

  try {
    await api.savePreset(name.trim(), description.trim());
    ctx.toast(`Preset "${name.trim()}" saved`, 'success');
    loadPresetList(listContainer);
  } catch (err) {
    ctx.toast(`Failed to save preset: ${err.message}`, 'error');
  }
}

async function handleLoad(filename, listContainer) {
  if (!confirm('Load this preset? Your current configuration will be overwritten.\n\nAn automatic backup will be created first.')) return;

  try {
    await api.loadPreset(filename);
    ctx.toast('Preset loaded — all configs updated', 'success');
    await ctx.refreshConfig();
    loadPresetList(listContainer);
  } catch (err) {
    ctx.toast(`Failed to load preset: ${err.message}`, 'error');
  }
}

async function handleDelete(filename, name, listContainer) {
  if (!confirm(`Delete preset "${name}"? This cannot be undone.`)) return;

  try {
    await api.deletePreset(filename);
    ctx.toast(`Preset "${name}" deleted`, 'success');
    loadPresetList(listContainer);
  } catch (err) {
    ctx.toast(`Failed to delete preset: ${err.message}`, 'error');
  }
}

function importPreset(listContainer) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      await api.importPreset(file);
      ctx.toast(`Preset imported from ${file.name}`, 'success');
      loadPresetList(listContainer);
    } catch (err) {
      ctx.toast(`Failed to import preset: ${err.message}`, 'error');
    }
  });
  input.click();
}

// Presets don't have dirty state — actions are immediate
export async function save() {}
