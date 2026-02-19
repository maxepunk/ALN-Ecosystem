/**
 * Asset Manager Component
 * Sound/Video file browser with upload, preview, and delete.
 */
import * as api from '../utils/api.js';
import { formatFileSize, el } from '../utils/formatting.js';
import { invalidateAssetCache } from './commandForm.js';

let currentTab = 'sounds';

export function renderAssetManager(container, ctx) {
  container.textContent = '';

  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', { className: 'card__title' }, 'Assets'),
    ),
  );

  // Tabs
  const tabs = el('div', { className: 'tabs', style: { margin: '0 12px' } });
  const soundsTab = el('button', {
    className: `tabs__tab${currentTab === 'sounds' ? ' active' : ''}`,
    textContent: 'Sounds',
    onClick: () => { currentTab = 'sounds'; renderAssetManager(container, ctx); },
  });
  const videosTab = el('button', {
    className: `tabs__tab${currentTab === 'videos' ? ' active' : ''}`,
    textContent: 'Videos',
    onClick: () => { currentTab = 'videos'; renderAssetManager(container, ctx); },
  });
  tabs.append(soundsTab, videosTab);
  card.appendChild(tabs);

  // Upload button
  const uploadBtn = el('button', {
    className: 'btn btn--small',
    style: { margin: '8px 12px' },
    textContent: `Upload ${currentTab === 'sounds' ? 'Sound' : 'Video'}`,
    onClick: () => handleUpload(ctx, listDiv),
  });
  card.appendChild(uploadBtn);

  // File list
  const listDiv = el('div', { style: { maxHeight: '250px', overflowY: 'auto' } });
  card.appendChild(listDiv);

  container.appendChild(card);

  loadAssetList(listDiv, ctx);
}

async function loadAssetList(listDiv, ctx) {
  listDiv.textContent = '';
  try {
    const assets = currentTab === 'sounds' ? await api.getSounds() : await api.getVideos();

    if (assets.length === 0) {
      listDiv.appendChild(el('div', { className: 'empty-state' }, `No ${currentTab} files.`));
      return;
    }

    for (const asset of assets) {
      const row = el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '12px',
        },
      });

      // Filename
      row.appendChild(el('span', {
        style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      }, asset.name));

      // Size
      row.appendChild(el('span', { className: 'mono', style: { color: 'var(--text-muted)', fontSize: '11px' } },
        formatFileSize(asset.size)));

      // Used by badge
      if (asset.usedBy && asset.usedBy.length > 0) {
        row.appendChild(el('span', { className: 'badge badge--used' }, `${asset.usedBy.length} cue${asset.usedBy.length > 1 ? 's' : ''}`));
      } else {
        row.appendChild(el('span', { className: 'badge badge--unused' }, 'unused'));
      }

      // Preview (sounds only)
      if (currentTab === 'sounds') {
        let audio = null;
        const previewBtn = el('button', {
          className: 'btn btn--small',
          textContent: '\u25b6',
          style: { padding: '2px 6px', fontSize: '10px' },
          onClick: () => {
            if (audio) {
              audio.pause();
              audio = null;
              previewBtn.textContent = '\u25b6';
            } else {
              audio = new Audio(`/audio/${encodeURIComponent(asset.name)}`);
              audio.play();
              previewBtn.textContent = '\u25a0';
              audio.addEventListener('ended', () => {
                audio = null;
                previewBtn.textContent = '\u25b6';
              });
            }
          },
        });
        row.appendChild(previewBtn);
      }

      // Delete
      const deleteBtn = el('button', {
        className: 'btn btn--small btn--danger',
        textContent: '\u00d7',
        style: { padding: '2px 6px', fontSize: '10px' },
        onClick: async () => {
          const usedWarning = asset.usedBy && asset.usedBy.length > 0
            ? `\n\nWarning: Used by: ${asset.usedBy.join(', ')}`
            : '';
          if (!confirm(`Delete ${asset.name}?${usedWarning}`)) return;
          try {
            await api.deleteAsset(currentTab, asset.name);
            invalidateAssetCache();
            ctx.toast(`Deleted ${asset.name}`, 'success');
            loadAssetList(listDiv, ctx);
          } catch (err) {
            ctx.toast(`Failed to delete: ${err.message}`, 'error');
          }
        },
      });
      row.appendChild(deleteBtn);

      listDiv.appendChild(row);
    }
  } catch (err) {
    listDiv.appendChild(el('div', { className: 'empty-state' }, `Failed to load: ${err.message}`));
  }
}

function handleUpload(ctx, listDiv) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = currentTab === 'sounds' ? '.wav,.mp3' : '.mp4';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      if (currentTab === 'sounds') await api.uploadSound(file);
      else await api.uploadVideo(file);
      invalidateAssetCache();
      ctx.toast(`Uploaded ${file.name}`, 'success');
      loadAssetList(listDiv, ctx);
    } catch (err) {
      ctx.toast(`Upload failed: ${err.message}`, 'error');
    }
  });
  input.click();
}
