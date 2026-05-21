/**
 * Music Section
 *
 * Playlist authoring UI. Two-pane layout:
 *   Left: list of playlists with "+ New playlist" button.
 *   Right: detail editor for the selected playlist (name, shuffle, loop,
 *          crossfade, available-tracks list + current-tracks reorderable list).
 *
 * State lives in MusicModel (a pure CRUD wrapper). The Save button in the
 * toolbar (app.js auto-wires it) calls our exported `save()` which PUTs the
 * full playlist set back to the orchestrator via the config-tool proxy.
 */
import * as api from '../utils/api.js';
import { el } from '../utils/formatting.js';
import { MusicModel } from './musicModel.js';

const model = new MusicModel();
let ctx = null;
let containerRoot = null;
let selectedId = null;
let loadError = null;

export async function render(container, config, context) {
  ctx = context;
  containerRoot = container;
  containerRoot.innerHTML = '';
  containerRoot.appendChild(el('div', { className: 'section__loading' }, 'Loading music…'));
  try {
    const [pl, tr] = await Promise.all([api.getMusicPlaylists(), api.getMusicTracks()]);
    model.setPlaylists(pl.playlists || []);
    model.setTracks(tr.tracks || []);
    selectedId = model.getPlaylists()[0]?.id || null;
    loadError = null;
  } catch (err) {
    loadError = err.message;
  }
  _redraw();
}

/**
 * Re-fetch playlists + tracks from the orchestrator. app.js calls this
 * when navigating back to the music section if the module has already been
 * loaded — without it, a transient orchestrator outage on first load would
 * leave the section stuck in the error state until full page reload.
 */
export async function refresh() {
  if (!containerRoot || !ctx) return;
  containerRoot.innerHTML = '';
  containerRoot.appendChild(el('div', { className: 'section__loading' }, 'Loading music…'));
  try {
    const [pl, tr] = await Promise.all([api.getMusicPlaylists(), api.getMusicTracks()]);
    model.setPlaylists(pl.playlists || []);
    model.setTracks(tr.tracks || []);
    if (!selectedId) selectedId = model.getPlaylists()[0]?.id || null;
    loadError = null;
  } catch (err) {
    loadError = err.message;
  }
  _redraw();
}

export async function save() {
  // Defensive: never persist when the initial load failed. The model could
  // contain stale/empty data and a PUT would clobber the on-disk file with
  // garbage. The dirty-state UX should prevent users from reaching Save in
  // this scenario, but a runtime guard is cheap insurance.
  if (loadError) {
    throw new Error('Cannot save: music data failed to load. Refresh the section first.');
  }
  await api.putMusicPlaylists(model.toJSON());
}

function _redraw() {
  containerRoot.innerHTML = '';
  if (loadError) {
    containerRoot.appendChild(el('div', { className: 'empty-state' },
      `Failed to load music data: ${loadError}. Is the orchestrator running at ORCHESTRATOR_URL?`));
    return;
  }
  const layout = el('div', { style: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' } },
    _renderPlaylistList(),
    _renderPlaylistDetail(),
  );
  containerRoot.appendChild(layout);
}

function _renderPlaylistList() {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Playlists'),
        el('div', { className: 'card__subtitle' }, 'Select to edit'),
      ),
    ),
  );
  const list = el('ul', { style: { listStyle: 'none', padding: 0, margin: '0 0 12px 0' } });
  for (const p of model.getPlaylists()) {
    const isSelected = p.id === selectedId;
    list.appendChild(el('li', {
      style: {
        padding: '8px 10px',
        background: isSelected ? 'var(--color-bg-elev, #eef2f7)' : 'transparent',
        cursor: 'pointer',
        borderRadius: '4px',
      },
      onClick: () => { selectedId = p.id; _redraw(); },
    },
      el('div', { style: { fontWeight: isSelected ? '600' : '400' } }, p.name),
      el('div', { className: 'card__subtitle' }, `${p.tracks.length} tracks`),
    ));
  }
  card.appendChild(list);

  card.appendChild(el('button', {
    className: 'btn btn--secondary',
    onClick: () => {
      const name = prompt('Playlist name?');
      if (!name) return;
      try {
        const p = model.createPlaylist(name);
        selectedId = p.id;
        ctx.markDirty('music');
        _redraw();
      } catch (err) {
        ctx.toast(err.message, 'error');
      }
    },
  }, '+ New playlist'));
  return card;
}

function _renderPlaylistDetail() {
  const card = el('div', { className: 'card' });
  const playlist = selectedId ? model.getPlaylist(selectedId) : null;
  if (!playlist) {
    card.appendChild(el('div', { className: 'empty-state' }, 'Select a playlist or create one.'));
    return card;
  }

  card.appendChild(el('div', { className: 'card__header' },
    el('div', {},
      el('div', { className: 'card__title' }, playlist.name),
      el('div', { className: 'card__subtitle' }, `id: ${playlist.id} · ${playlist.tracks.length} tracks`),
    ),
  ));

  // Shuffle / loop / crossfade controls
  const shuffleBox = el('input', { type: 'checkbox', checked: !!playlist.shuffle,
    onChange: () => { model.setShuffle(playlist.id, shuffleBox.checked); ctx.markDirty('music'); },
  });
  const loopBox = el('input', { type: 'checkbox', checked: !!playlist.loop,
    onChange: () => { model.setLoop(playlist.id, loopBox.checked); ctx.markDirty('music'); },
  });
  const crossfadeOut = el('span', { className: 'mono' }, `${playlist.crossfadeMs} ms`);
  const crossfadeIn = el('input', {
    type: 'range', min: 0, max: 5000, step: 100, value: String(playlist.crossfadeMs),
    style: { verticalAlign: 'middle' },
    onInput: () => {
      const v = parseInt(crossfadeIn.value, 10);
      model.setCrossfadeMs(playlist.id, v);
      crossfadeOut.textContent = `${v} ms`;
      ctx.markDirty('music');
    },
  });
  card.appendChild(el('div', { style: { display: 'flex', gap: '20px', alignItems: 'center', padding: '12px 0' } },
    el('label', {}, shuffleBox, ' Shuffle'),
    el('label', {}, loopBox, ' Loop'),
    el('label', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      'Crossfade ', crossfadeIn, crossfadeOut),
  ));

  // Two-pane track editor
  card.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
    _renderAvailableTracks(playlist),
    _renderCurrentTracks(playlist),
  ));

  // Delete playlist
  card.appendChild(el('div', { style: { marginTop: '16px', borderTop: '1px solid #ddd', paddingTop: '12px' } },
    el('button', {
      className: 'btn btn--danger',
      onClick: () => {
        if (!confirm(`Delete playlist "${playlist.name}"? This is not undone until you click Save.`)) return;
        model.deletePlaylist(playlist.id);
        selectedId = model.getPlaylists()[0]?.id || null;
        ctx.markDirty('music');
        _redraw();
      },
    }, 'Delete playlist'),
  ));

  return card;
}

function _renderAvailableTracks(playlist) {
  const box = el('div', {},
    el('h4', { style: { margin: '0 0 8px 0' } }, 'Available Tracks'),
  );
  const list = el('ul', { style: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' } });
  const tracks = model.getTracks();
  if (tracks.length === 0) {
    box.appendChild(el('div', { className: 'empty-state' }, 'No tracks in MPD database. Add MP3s to backend/public/music/ and re-seed.'));
    return box;
  }
  for (const t of tracks) {
    const label = t.title && t.artist ? `${t.title} — ${t.artist}` : (t.title || t.file);
    list.appendChild(el('li', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #eee' } },
      el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
      el('button', {
        className: 'btn btn--small',
        title: 'Add to playlist',
        onClick: () => { model.addTrack(playlist.id, t.file); ctx.markDirty('music'); _redraw(); },
      }, '+'),
    ));
  }
  box.appendChild(list);
  return box;
}

function _renderCurrentTracks(playlist) {
  const box = el('div', {},
    el('h4', { style: { margin: '0 0 8px 0' } }, 'Playlist Tracks (in order)'),
  );
  const list = el('ul', { style: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' } });
  if (playlist.tracks.length === 0) {
    box.appendChild(el('div', { className: 'empty-state' }, 'Empty — add tracks from the left.'));
    return box;
  }
  playlist.tracks.forEach((file, i) => {
    list.appendChild(el('li', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #eee' } },
      el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${i + 1}. ${file}`),
      el('span', { style: { display: 'flex', gap: '4px' } },
        el('button', { className: 'btn btn--small', disabled: i === 0, title: 'Move up',
          onClick: () => { model.moveTrack(playlist.id, i, i - 1); ctx.markDirty('music'); _redraw(); } }, '↑'),
        el('button', { className: 'btn btn--small', disabled: i === playlist.tracks.length - 1, title: 'Move down',
          onClick: () => { model.moveTrack(playlist.id, i, i + 1); ctx.markDirty('music'); _redraw(); } }, '↓'),
        el('button', { className: 'btn btn--small btn--danger', title: 'Remove',
          onClick: () => { model.removeTrack(playlist.id, i); ctx.markDirty('music'); _redraw(); } }, '✕'),
      ),
    ));
  });
  box.appendChild(list);
  return box;
}
