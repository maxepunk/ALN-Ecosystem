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

/**
 * cues.json: plain array or wrapper `{cues: [...]}` (both backend-supported).
 * Each cue needs an id and at least one of quickFire/trigger.
 */
function validateCues(data) {
  const errors = [];
  let list;
  if (Array.isArray(data)) {
    list = data;
  } else if (isPlainObject(data) && Array.isArray(data.cues)) {
    list = data.cues;
  } else {
    return ['cues must be an array of cues or an object with a "cues" array'];
  }

  const seenIds = new Set();
  list.forEach((cue, i) => {
    const ref = (cue && cue.id) || `#${i}`;
    if (!isPlainObject(cue)) {
      errors.push(`cue ${ref} must be an object`);
      return;
    }
    if (typeof cue.id !== 'string' || cue.id.trim() === '') {
      errors.push(`cue #${i} ("${cue.label || 'unlabeled'}") must have a non-empty string id`);
    } else if (seenIds.has(cue.id)) {
      errors.push(`duplicate cue id "${cue.id}"`);
    } else {
      seenIds.add(cue.id);
    }
    if (!cue.quickFire && !isPlainObject(cue.trigger)) {
      errors.push(`cue ${ref} must have quickFire and/or a trigger object (it can never fire otherwise)`);
    }
    if (cue.commands !== undefined && !Array.isArray(cue.commands)) {
      errors.push(`cue ${ref}: commands must be an array`);
    }
    if (cue.timeline !== undefined && !Array.isArray(cue.timeline)) {
      errors.push(`cue ${ref}: timeline must be an array`);
    }
    if (Array.isArray(cue.commands) && Array.isArray(cue.timeline)) {
      errors.push(`cue ${ref} has both commands and timeline (must have only one)`);
    }
  });

  return errors;
}

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

/** Validate a whole preset bundle; returns prefixed error strings for all sections. */
function validatePresetSections(preset) {
  const errors = [];
  errors.push(...validateEnvUpdates(preset.env).map(e => `env: ${e}`));
  errors.push(...validateScoring(preset.scoringConfig).map(e => `scoringConfig: ${e}`));
  errors.push(...validateCues(preset.cues).map(e => `cues: ${e}`));
  errors.push(...validateRouting(preset.routing).map(e => `routing: ${e}`));
  return errors;
}

module.exports = {
  ValidationError,
  validateScoring,
  validateCues,
  validateRouting,
  validateEnvUpdates,
  validatePresetSections,
  assertValid,
};
