/**
 * ALN Config Tool — SPA Controller
 * Handles navigation, dirty state, toast notifications, and section lifecycle.
 */
import * as api from './utils/api.js';

// Section modules loaded lazily
const sectionModules = {};
const sectionNames = {
  economy: 'Game Economy',
  showcontrol: 'Show Control',
  audio: 'Audio & Environment',
  infra: 'Infrastructure',
  presets: 'Presets',
};

// App state
let currentSection = 'economy';
let configCache = null;
const dirtyState = {};

// DOM refs
const sectionTitle = document.getElementById('sectionTitle');
const dirtyIndicator = document.getElementById('dirtyIndicator');
const saveBtn = document.getElementById('saveBtn');
const toastContainer = document.getElementById('toastContainer');

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
    // Ensure config is loaded
    if (!configCache) {
      configCache = await api.getConfig();
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

// -- Dirty State --

export function markDirty(section = currentSection, dirty = true) {
  dirtyState[section] = dirty;
  updateDirtyUI();
}

function updateDirtyUI() {
  const isDirty = dirtyState[currentSection];
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
      configCache = await api.getConfig();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }
});

// -- Config Refresh --

async function refreshConfig() {
  configCache = await api.getConfig();
  // Re-render all loaded sections with fresh data
  for (const [section, mod] of Object.entries(sectionModules)) {
    if (mod && mod.render) {
      const container = document.getElementById(`section-${section}`);
      container.innerHTML = '';
      mod.render(container, configCache, { markDirty, toast, refreshConfig });
    }
    dirtyState[section] = false;
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
  if (Object.values(dirtyState).some(Boolean)) {
    e.preventDefault();
  }
});

// -- Init --

loadSection('economy');
