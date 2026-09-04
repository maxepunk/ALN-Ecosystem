/**
 * API client for the ALN Config Tool backend.
 * All methods return Promises resolving to JSON.
 *
 * B0 BS.3: the auth session token (shared store) rides every request
 * as a Bearer header; a 401 carries err.status for the login flow. The
 * two PACK writers (putScoring/putCues) route through DRAFTS — the
 * live-pack write routes refuse since BS.2 — and publish is the one
 * explicit landing call.
 */

// appStore is a LIVE ESM binding (`export let`) — resetAppStore()
// reassigns it and every reference here follows; tests need no
// injection seam.
import { appStore } from '../store.js';

async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
  };
  const { token } = appStore.get();
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    opts.body = body;
  }
  const res = await fetch(`/api${path}`, opts);
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Auth
export async function login(password) {
  const { token } = await request('POST', '/auth/login', { password });
  appStore.update({ token });
  return token;
}

// Config
export const getConfig = () => request('GET', '/config');
export const putEnv = (data) => request('PUT', '/config/env', data);
export const putRouting = (data) => request('PUT', '/config/routing', data);

// -- Drafts (B0 BS.3) --

/**
 * The draft this session edits: the one in the store, else the NEWEST
 * server-side draft (a tool restart must not strand work), else a
 * fresh one drafted from the live pack.
 */
async function ensureDraft() {
  const resumed = await resumeDraft();
  if (resumed) return resumed;
  const { draft } = await request('POST', '/drafts');
  appStore.update({ draft });
  return draft;
}

/**
 * Boot-time draft adoption: surface an existing unpublished draft
 * (newest wins) so the editors render its content — but never CREATE
 * one just by opening the tool.
 */
export async function resumeDraft() {
  if (appStore.get().draft) return appStore.get().draft;
  const drafts = await request('GET', '/drafts');
  if (drafts.length === 0) return null;
  const draft = drafts.reduce((a, b) =>
    Date.parse(a.lastEdited) >= Date.parse(b.lastEdited) ? a : b);
  appStore.update({ draft });
  return draft;
}

/** PACK writer, draft-routed: scoring lands in the draft, never live. */
export async function putScoring(data) {
  const draft = await ensureDraft();
  return request('PUT', `/drafts/${draft.draftId}/scoring`, data);
}

/** PACK writer, draft-routed: cues land in the draft, never live. */
export async function putCues(data) {
  const draft = await ensureDraft();
  return request('PUT', `/drafts/${draft.draftId}/cues`, data);
}

/** Publish the session's draft to the live pack; clears it from the store. */
export async function publishCurrentDraft() {
  const draft = appStore.get().draft;
  if (!draft) throw new Error('no draft to publish');
  const { publish } = await request('POST', `/drafts/${draft.draftId}/publish`);
  appStore.update({ draft: null });
  return publish;
}

/** Discard the session's draft (delete server-side, clear the store). */
export async function discardCurrentDraft() {
  const draft = appStore.get().draft;
  if (!draft) return;
  await request('DELETE', `/drafts/${draft.draftId}`);
  appStore.update({ draft: null });
}

/**
 * The config the EDITORS should render: live venue config, with pack
 * content (scoring/cues/pack identity) overlaid from the session's
 * draft when one exists — you see what you are editing, not the live
 * pack your unpublished edits have not reached.
 */
export async function getEffectiveConfig() {
  const config = await request('GET', '/config');
  const draft = appStore.get().draft;
  if (!draft) return config;
  const draftContent = await request('GET', `/drafts/${draft.draftId}/config`);
  return { ...config, ...draftContent };
}

// Vocabulary (B0 — the engine's cue-authoring vocabulary, one source)
export const getVocabulary = () => request('GET', '/vocabulary');

// Tokens
export const getTokens = () => request('GET', '/tokens');

// Scenes
export const getScenes = () => request('GET', '/scenes');

// Assets
export const getSounds = () => request('GET', '/assets/sounds');
export const getVideos = () => request('GET', '/assets/videos');

export function uploadSound(file) {
  const form = new FormData();
  form.append('file', file);
  return request('POST', '/assets/sounds', form);
}

export function uploadVideo(file) {
  const form = new FormData();
  form.append('file', file);
  return request('POST', '/assets/videos', form);
}

export const deleteAsset = (type, name) => request('DELETE', `/assets/${type}/${encodeURIComponent(name)}`);

// Presets
export const getPresets = () => request('GET', '/presets');
export const savePreset = (name, description) => request('POST', '/presets', { name, description });
export const loadPreset = (filename) => request('PUT', `/presets/${encodeURIComponent(filename)}/load`);
export const deletePreset = (filename) => request('DELETE', `/presets/${encodeURIComponent(filename)}`);

export function exportPreset(filename) {
  // Trigger file download
  const a = document.createElement('a');
  a.href = `/api/presets/${encodeURIComponent(filename)}/export`;
  a.download = filename;
  a.click();
}

export async function importPreset(file) {
  const form = new FormData();
  form.append('file', file);
  return request('POST', '/presets/import', form);
}

// Music
export const getMusicTracks = () => request('GET', '/music/tracks');
export const getMusicPlaylists = () => request('GET', '/music/playlists');
export const putMusicPlaylists = (data) => request('PUT', '/music/playlists', data);
