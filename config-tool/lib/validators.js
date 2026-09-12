'use strict';
/**
 * Schema validation for all four config writers (F-TOOL-04).
 *
 * Every write path — direct PUT, preset load, preset import — goes through
 * these validators so a malformed body can never silently revert the live
 * game's economy/cues/routing to backend defaults.
 *
 * Each validate* function returns an array of human-readable error strings
 * (empty = valid). `assertValid` turns a non-empty list into a
 * ValidationError, which lib/routes.js maps to HTTP 400 + details.
 */

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details || [];
  }
}

const RATING_KEYS = ['1', '2', '3', '4', '5'];
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** game.json `scoring` block: baseValues for ratings 1-5 + numeric typeMultipliers map (extra keys like display/semantics pass through untouched). */
function validateScoring(data) {
  const errors = [];
  if (!isPlainObject(data)) return ['scoring config must be a JSON object'];

  if (!isPlainObject(data.baseValues)) {
    errors.push('baseValues must be an object mapping ratings 1-5 to dollar values');
  } else {
    for (const key of RATING_KEYS) {
      if (!(key in data.baseValues)) {
        errors.push(`baseValues missing rating "${key}"`);
      } else if (!isFiniteNumber(data.baseValues[key]) || data.baseValues[key] < 0) {
        errors.push(`baseValues["${key}"] must be a non-negative number (got ${JSON.stringify(data.baseValues[key])})`);
      }
    }
    for (const key of Object.keys(data.baseValues)) {
      if (!RATING_KEYS.includes(key)) errors.push(`baseValues has unknown rating key "${key}" (valid: 1-5)`);
    }
  }

  if (!isPlainObject(data.typeMultipliers)) {
    errors.push('typeMultipliers must be an object mapping memory types to multipliers');
  } else {
    if (Object.keys(data.typeMultipliers).length === 0) {
      errors.push('typeMultipliers must not be empty');
    }
    for (const [type, mult] of Object.entries(data.typeMultipliers)) {
      if (!isFiniteNumber(mult) || mult < 0) {
        errors.push(`typeMultipliers["${type}"] must be a non-negative number (got ${JSON.stringify(mult)})`);
      }
    }
  }

  return errors;
}

// NOTE: a `validateCues` shape-validator used to live here. Since A3 slice 4
// (D-4.7c), cues are pack content: configManager.writeCues validates the
// `cues` array directly against the pack-internal gate
// (backend/src/gameRules/cueValidation.js `validateCuesBlock`, the SAME
// check packService runs at activation) rather than this tool's own ad-hoc
// shape rules. Presets no longer carry or validate a `cues` section at all
// — see validatePresetSections below.

/** routing.json: `routes` object (stream -> route object) + `ducking` array of rule objects. */
function validateRouting(data) {
  const errors = [];
  if (!isPlainObject(data)) return ['routing config must be a JSON object'];

  if (!isPlainObject(data.routes)) {
    errors.push('routes must be an object mapping streams to route definitions');
  } else {
    for (const [stream, route] of Object.entries(data.routes)) {
      if (!isPlainObject(route)) errors.push(`routes["${stream}"] must be an object`);
    }
  }

  if (!Array.isArray(data.ducking)) {
    errors.push('ducking must be an array of ducking rules (use [] for none)');
  } else {
    data.ducking.forEach((rule, i) => {
      if (!isPlainObject(rule)) errors.push(`ducking[${i}] must be an object`);
    });
  }

  return errors;
}

/** PUT /config/env body: flat map of well-formed keys to scalar, newline-free values. */
function validateEnvUpdates(updates) {
  const errors = [];
  if (!isPlainObject(updates)) return ['env updates must be a JSON object of key/value pairs'];

  for (const [key, value] of Object.entries(updates)) {
    if (!ENV_KEY_PATTERN.test(key)) {
      errors.push(`invalid env key "${key}" (letters, digits, and underscores only)`);
      continue;
    }
    const t = typeof value;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      errors.push(`env value for ${key} must be a string, number, or boolean (got ${Array.isArray(value) ? 'array' : t})`);
    } else if (t === 'string' && /[\n\r]/.test(value)) {
      errors.push(`env value for ${key} must not contain newlines`);
    }
  }

  return errors;
}

/** Throw a ValidationError when the error list is non-empty. */
function assertValid(errors, what) {
  if (errors.length > 0) {
    throw new ValidationError(`Invalid ${what}`, errors);
  }
}

/**
 * Validate a whole preset bundle; returns prefixed error strings for all
 * sections. Cues are pack content, not preset/venue state (A3 slice 4,
 * D-4.7c) — a preset no longer requires (or is validated on) a `cues` key.
 * An older preset/export that still carries one is silently accepted here;
 * configManager.loadPreset never reads it.
 */
function validatePresetSections(preset) {
  const errors = [];
  errors.push(...validateEnvUpdates(preset.env).map(e => `env: ${e}`));
  errors.push(...validateScoring(preset.scoringConfig).map(e => `scoringConfig: ${e}`));
  errors.push(...validateRouting(preset.routing).map(e => `routing: ${e}`));
  return errors;
}

module.exports = {
  ValidationError,
  validateScoring,
  validateRouting,
  validateEnvUpdates,
  validatePresetSections,
  assertValid,
};
