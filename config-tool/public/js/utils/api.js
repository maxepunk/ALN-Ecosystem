/**
 * API client for the ALN Config Tool backend.
 * All methods return Promises resolving to JSON.
 */

async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
  };
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    opts.body = body;
  }
  const res = await fetch(`/api${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// Config
export const getConfig = () => request('GET', '/config');
export const putEnv = (data) => request('PUT', '/config/env', data);
export const putScoring = (data) => request('PUT', '/config/scoring', data);
export const putCues = (data) => request('PUT', '/config/cues', data);
export const putRouting = (data) => request('PUT', '/config/routing', data);

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
