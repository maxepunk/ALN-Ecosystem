/**
 * Served-vocabulary client (B0 BS.3, D1 restored): the engine's cue
 * vocabulary — trigger events, condition operators, actions with their
 * field specs — arrives from GET /api/vocabulary (the same exported
 * tables the activation gate validates against; one source, zero
 * drift). The SERVED sets decide what the editors OFFER; the baked
 * local tables (TRIGGER_EVENTS, ACTION_DEFS) survive only as UI
 * DECORATION and as the loud fallback when the fetch fails.
 *
 * Pure module: no DOM, no fetch — the caller loads and injects.
 */

let served = null;

/** Inject the fetched vocabulary (null clears — fallback posture). */
export function setVocabulary(v) {
  served = v;
}

/** The trigger events the editor offers (served set, else baked keys). */
export function getTriggerEventNames(bakedTable) {
  if (served && Array.isArray(served.triggerEvents)) return [...served.triggerEvents];
  return Object.keys(bakedTable);
}

/**
 * UI decoration for one trigger event: the baked entry when known, a
 * plain undecorated one otherwise (a NEW engine event is authorable
 * immediately, just unlabeled until the table catches up).
 */
export function decorateTriggerEvent(name, bakedTable) {
  return bakedTable[name] || { label: name, fields: [] };
}

/**
 * Derive a payload form from the engine's field spec
 * ({field: 'string'|'number'|'boolean'}) — every engine-declared field
 * is REQUIRED by the gate's own typeOk check.
 */
function deriveActionDef(action, fieldSpec) {
  const fields = Object.entries(fieldSpec || {}).map(([key, type]) => {
    if (type === 'boolean') {
      // boolean-select stores a REAL boolean — the gate's typeOk
      // refuses the string form.
      return { key, type: 'boolean-select', label: key, required: true };
    }
    return { key, type: type === 'number' ? 'number' : 'text', label: key, required: true };
  });
  return { label: action, category: action.split(':')[0], fields };
}

/**
 * The actions the editor offers, as [{action, def}]: the SERVED action
 * set (else baked keys), decorated from the baked table when known and
 * DERIVED from the engine's field spec otherwise. Baked actions the
 * engine does not serve are NOT offered — the gate would refuse them.
 */
export function getActionEntries(bakedDefs) {
  if (!served || !served.actions) {
    return Object.entries(bakedDefs).map(([action, def]) => ({ action, def }));
  }
  return Object.keys(served.actions).map((action) => ({
    action,
    def: bakedDefs[action] || deriveActionDef(action, served.actions[action]),
  }));
}

/** Condition operator names (served set, else the baked list). */
export function getConditionOps(bakedOps) {
  if (served && Array.isArray(served.conditionOperators)) return [...served.conditionOperators];
  return [...bakedOps];
}
