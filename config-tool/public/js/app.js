/**
 * ALN Config Tool — SPA Controller
 * Handles navigation, dirty state, toast notifications, and section lifecycle.
 *
 * B0 BS.3: state lives in the shared store (auth session, draft
 * identity, per-section dirty) — sections keep the same ctx API
 * (markDirty/toast/refreshConfig). Pack edits ride a DRAFT (surfaced in
 * the toolbar draft bar; publish is the explicit landing step); a 401
 * from any call raises the login overlay.
 */
import * as api from './utils/api.js';
import { appStore } from './store.js';
import { setVocabulary } from './utils/vocabulary.js';
import { renderDraftBar } from './components/draftBar.js';
import { applyPackMoneyFormat } from './utils/formatting.js';

// Section modules loaded lazily
const sectionModules = {};
const sectionNames = {
  economy: 'Game Economy',
  showcontrol: 'Show Control',
  music: 'Music & Playlists',
  audio: 'Audio & Environment',
  infra: 'Infrastructure',
  presets: 'Presets',
};

// App state (dirty/draft/auth live in the shared store)
let currentSection = 'economy';
let configCache = null;

// DOM refs
const sectionTitle = document.getElementById('sectionTitle');
const dirtyIndicator = document.getElementById('dirtyIndicator');
const saveBtn = document.getElementById('saveBtn');
const toastContainer = document.getElementById('toastContainer');
const draftBarEl = document.getElementById('draftBar');
const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginCancel = document.getElementById('loginCancel');

// -- Navigation --

document.querySelectorAll('.sidebar__link').forEach(link => {
  link.addEventListener('click', () => {
    const section = link.dataset.section;
    if (section === currentSection) return;
    navigateTo(section);
  });
});

function navigateTo(section) {
  // Update sidebar
  document.querySelectorAll('.sidebar__link').forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  // Update sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');

  // Update toolbar
  currentSection = section;
  sectionTitle.textContent = sectionNames[section];
  updateDirtyUI();

  // Load section if not yet initialized
  loadSection(section);
}

// -- Section Loading --

async function loadSection(section) {
  if (sectionModules[section]) {
    // Already loaded — just refresh if the module supports it
    if (sectionModules[section].refresh) {
      sectionModules[section].refresh();
    }
    return;
  }

  try {
    // Ensure config is loaded (draft pack content overlaid when a
    // draft exists — you see what you are editing)
    if (!configCache) {
      configCache = await api.getEffectiveConfig();
      applyPackIdentity(configCache);
    }

    const mod = await import(`./sections/${section}.js`);
    sectionModules[section] = mod;
    const container = document.getElementById(`section-${section}`);
    container.innerHTML = '';
    mod.render(container, configCache, { markDirty, toast, refreshConfig });
  } catch (err) {
    const container = document.getElementById(`section-${section}`);
    container.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'empty-state';
    errDiv.textContent = `Failed to load section: ${err.message}`;
    container.appendChild(errDiv);
    console.error(`Failed to load section ${section}:`, err);
  }
}

// -- Dirty State (shared store) --

export function markDirty(section = currentSection, dirty = true) {
  appStore.setDirty(section, dirty);
  updateDirtyUI();
}

function updateDirtyUI() {
  const isDirty = appStore.get().dirty[currentSection];
  dirtyIndicator.hidden = !isDirty;
  saveBtn.hidden = !isDirty;
}

// -- Save --

saveBtn.addEventListener('click', async () => {
  const mod = sectionModules[currentSection];
  if (mod && mod.save) {
    try {
      await mod.save();
      markDirty(currentSection, false);
      toast('Changes saved', 'success');
      // Refresh config cache
      configCache = await api.getEffectiveConfig();
    } catch (err) {
      if (err.status === 401) return showLogin();
      toast(`Save failed: ${err.message}`, 'error');
    }
  }
});

// -- Login (B0 BS.3) --

function showLogin() {
  loginError.hidden = true;
  loginOverlay.hidden = false;
  loginPassword.focus();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api.login(loginPassword.value);
    loginPassword.value = '';
    loginOverlay.hidden = true;
    toast('Logged in — retry your change', 'success');
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  }
});

loginCancel.addEventListener('click', () => {
  loginOverlay.hidden = true;
});

// -- Draft bar (B0 BS.3): which draft this session edits + publish --

function updateDraftBar() {
  renderDraftBar(draftBarEl, appStore.get().draft, {
    onPublish: async () => {
      try {
        const entry = await api.publishCurrentDraft();
        toast(`Pack published (${entry.contentHash.slice(0, 15)}…)`, 'success');
        await refreshConfig();
      } catch (err) {
        if (err.status === 401) return showLogin();
        // A 409 carries the pipeline's own refusal text (conflict, gate
        // problems) — show it verbatim, it names the recovery.
        toast(err.message, 'error');
      }
    },
    onDiscard: async () => {
      if (!window.confirm('Discard this draft? Unpublished pack edits are lost.')) return;
      try {
        await api.discardCurrentDraft();
        toast('Draft discarded', 'info');
        await refreshConfig();
      } catch (err) {
        if (err.status === 401) return showLogin();
        toast(`Discard failed: ${err.message}`, 'error');
      }
    },
  });
}

appStore.subscribe(updateDraftBar);

// -- Pack Identity (slice 3a) --

// The tool edits ONE pack; its chrome says which. Derived from
// GET /api/config `pack` (game.json title) — baked wording only for a
// packless/partial dir.
function applyPackIdentity(config) {
  const title = config?.pack?.title;
  if (title) document.title = `${title} — Config Tool`;
  // Slice 3b: the money formatter follows the edited pack's declared spec
  applyPackMoneyFormat(config?.scoring?.display?.format);
}

// -- Config Refresh --

async function refreshConfig() {
  configCache = await api.getEffectiveConfig();
  applyPackIdentity(configCache);
  // Re-render all loaded sections with fresh data
  for (const [section, mod] of Object.entries(sectionModules)) {
    if (mod && mod.render) {
      const container = document.getElementById(`section-${section}`);
      container.innerHTML = '';
      mod.render(container, configCache, { markDirty, toast, refreshConfig });
    }
    appStore.setDirty(section, false);
  }
  updateDirtyUI();
}

// -- Toast Notifications --

export function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove());
  }, 3000);
}

// -- Unsaved changes guard --

window.addEventListener('beforeunload', (e) => {
  if (appStore.isDirty()) {
    e.preventDefault();
  }
});

// -- Init --
// Adopt an existing unpublished draft BEFORE the first section renders
// (its pack content overlays the live config); never create one just
// by opening the tool.
(async () => {
  // The engine's cue vocabulary (D1): the served sets decide what the
  // editors offer. On failure the baked tables stand in — loudly.
  try {
    setVocabulary(await api.getVocabulary());
  } catch (err) {
    console.warn('[vocabulary] fetch failed — editors run on the BAKED fallback tables:', err.message);
  }
  try {
    await api.resumeDraft();
  } catch (err) {
    console.warn('Draft resume failed (continuing with live config):', err.message);
  }
  updateDraftBar();
  loadSection('economy');
})();
