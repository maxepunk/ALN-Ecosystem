/**
 * collectPackNeeds — the pack-needs aggregator (C2, design §8,
 * ratified 2026-09-04; CONTEXT.md "One truth, three loops").
 *
 * Pure over a pack snapshot {game, cues, manifest}; performs no I/O.
 * Walks the pack's declared and implied needs into one typed list
 * that resolve() (gameRules/resolution.js) turns into verdicts.
 * Authored importance rides each need where the pack declares it
 * (pack-manifest.json hardware.*.onAbsent: 'require' | 'degrade').
 *
 * @param {{game: object, cues: object, manifest: object}} pack
 * @returns {Array<{kind: string, id: string, onAbsent?: string,
 *   sources: string[]}>}
 */
function collectPackNeeds(pack) {
  const needs = [];
  const hardware = (pack.manifest && pack.manifest.hardware) || {};

  const stack = hardware.stack || {};
  for (const [id, decl] of Object.entries(stack)) {
    needs.push({
      kind: 'service',
      id,
      onAbsent: decl.onAbsent || 'degrade',
      sources: [`pack-manifest.json hardware.stack.${id}`],
    });
  }

  const endpoints = hardware.endpoints || {};
  for (const [id, decl] of Object.entries(endpoints)) {
    needs.push({
      kind: 'endpoint',
      id,
      onAbsent: decl.onAbsent || 'degrade',
      sources: [`pack-manifest.json hardware.endpoints.${id}`],
    });
  }

  const game = pack.game || {};
  const fallbacks = game.lightingRoleFallbacks || {};
  for (const role of game.lightingRoles || []) {
    needs.push({
      kind: 'lighting-role',
      id: role,
      fallback: Object.prototype.hasOwnProperty.call(fallbacks, role)
        ? fallbacks[role]
        : null,
      sources: ['game.json lightingRoles'],
    });
  }

  // The idle-loop surface names a media channel the venue must be
  // able to play; a null channel declares no idle loop (toy pack).
  const idleLoop = (game.surfaces || {}).idleLoop;
  if (idleLoop) {
    needs.push({
      kind: 'surface-channel',
      id: idleLoop,
      sources: ['game.json surfaces.idleLoop'],
    });
  }

  for (const cap of game.requires || []) {
    needs.push({
      kind: 'capability',
      id: cap,
      sources: ['game.json requires'],
    });
  }

  // Cue-implied needs: every command in a cue, including timeline
  // steps, can reference media and roles the venue must supply.
  const soundFiles = new Map();
  const roleRefs = new Map();
  for (const cue of (pack.cues && pack.cues.cues) || []) {
    const steps = cue.timeline || [];
    const commands = (cue.commands || []).concat(
      steps.flatMap((s) => s.commands || [])
    );
    for (const cmd of commands) {
      const payload = cmd.payload || {};
      if (cmd.action === 'sound:play' && payload.file) {
        if (!soundFiles.has(payload.file)) soundFiles.set(payload.file, []);
        soundFiles.get(payload.file).push(`cues.json ${cue.id}`);
      }
      if (cmd.action === 'lighting:scene:activate' && payload.role) {
        if (!roleRefs.has(payload.role)) roleRefs.set(payload.role, []);
        roleRefs.get(payload.role).push(`cues.json ${cue.id}`);
      }
    }
  }
  for (const [file, sources] of soundFiles) {
    needs.push({ kind: 'sound', id: file, sources });
  }
  for (const [role, sources] of roleRefs) {
    needs.push({ kind: 'lighting-role-ref', id: role, sources });
  }

  // A declared min of 0 asks nothing of the venue; only min > 0 is a
  // need (C1 §2: deviceClass below min = NO-GO).
  for (const decl of hardware.deviceClasses || []) {
    if (decl.min > 0) {
      needs.push({
        kind: 'device-class',
        id: decl.class,
        min: decl.min,
        sources: ['pack-manifest.json hardware.deviceClasses'],
      });
    }
  }

  return needs;
}

module.exports = { collectPackNeeds };
