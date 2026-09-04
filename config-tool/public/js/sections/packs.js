/**
 * PROTOTYPE — PS.1 pack manager, three structurally different variants
 * (mattpocock prototype skill, UI branch, sub-shape A).
 *
 * Plan: three variants of the pack-manager page, switchable via
 * ?variant=, mounted as a URL-gated section inside the real tool
 * shell. Read-only; every mutation affordance is a stub. Content per
 * D-P1/D-P1r2 + §9 ratification: three identities (live tree / draft /
 * running orchestrator), pack selection, version trail, validate,
 * media & needs (read-only inventory wearing verdict badges),
 * commit & push, export zip, minimal create-new-pack.
 *
 * Variant A "Mission control" — identity/staleness strip first, panel grid.
 * Variant B "Ledger"          — the publish trail is the page's spine.
 * Variant C "Preflight console" — one dense needs table; identity as chips.
 *
 * THROWAWAY CODE. The winning structure gets rebuilt properly in the
 * PS.1 build stage; this file and its losers move to a throwaway branch.
 */
import { mountSwitcher } from '../components/prototypeSwitcher.js';

// ── Sample data: REAL pack identity + refs; trail/orchestrator rows are
// plausible fabrications, plainly for the mock. One deliberate story:
// the draft differs from live, and the orchestrator runs YESTERDAY'S
// hash — the staleness surface every variant must make legible.
const D = {
  packs: ['ALN-TokenData (about-last-night)', 'toy-heist (fixture)', 'parity-pack (fixture)'],
  live: { version: '1.0.0', hash: 'caa6c7ca5937', when: 'published 2026-08-31 · notion sync' },
  draft: { id: 'draft-7f2e', base: 'caa6c7ca5937', hash: '41d2b90aa011', dirty: ['game.json', 'cues.json'], opened: 'today 08:12' },
  orch: { hash: '9be04417c2aa', since: 'activated 2026-09-03 21:40', stale: true },
  trail: [
    { when: '2026-08-31 14:02', draft: 'draft-6b11', base: '9be04417c2aa', hash: 'caa6c7ca5937', by: 'notion sync' },
    { when: '2026-08-24 19:47', draft: 'draft-59c0', base: '77aa01f3d520', hash: '9be04417c2aa', by: 'max' },
    { when: '2026-08-19 11:15', draft: 'draft-4a77', base: '31c09e51b7ff', hash: '77aa01f3d520', by: 'max' },
  ],
  validate: {
    ok: false,
    lines: [
      { level: 'err', text: "cues.json endgame step 4: lighting role 'police-arrival-4' not declared in game.json lightingRoles" },
      { level: 'warn', text: "tokens.json: 3 tokens have SF_MemoryType null (scores 0x as UNKNOWN)" },
    ],
  },
  needs: [
    { kind: 'video', id: 'kai001.mp4', verdict: 'runs', depth: 'live', why: 'present in public/videos' },
    { kind: 'video', id: 'rem001.mp4', verdict: 'runs', depth: 'live', why: 'present in public/videos' },
    { kind: 'sound', id: 'attention.wav', verdict: 'runs', depth: 'live', why: 'present in public/audio' },
    { kind: 'sound', id: 'tension.wav', verdict: 'fault', depth: 'live', why: 'MISSING from public/audio — restore the file or re-author the cue' },
    { kind: 'sound', id: '15min.wav · 30min.wav · 60min.wav · 90min.wav', verdict: 'runs', depth: 'live', why: 'present in public/audio' },
    { kind: 'channel', id: 'aln-idle (idle loop)', verdict: 'runs', depth: 'paper', why: 'bound: idle-loop.mp4 (aln-full-kit)' },
    { kind: 'role', id: 'gameplay · video-playback · blackout · police-* (7 roles)', verdict: 'runs', depth: 'paper', why: 'all bound in aln-full-kit' },
    { kind: 'audio target', id: "ENDGAME target:'bluetooth' (ledger L8)", verdict: 'fault', depth: 'paper', why: 'retiring per Q3 — re-author as an audio role this build' },
    { kind: 'endpoint', id: 'display.main', verdict: 'dormant', depth: 'paper', why: 'no endpoints block yet — resolves "not installed tonight"' },
  ],
};

const badge = (v, depth) => `
  <span class="pk-badge pk-badge--${v}"><span class="pk-dot"></span>${v}</span>
  <span class="pk-depth pk-depth--${depth}">${depth}</span>`;

const stub = (label, primary = false) =>
  `<button class="btn ${primary ? 'btn--primary' : ''} pk-stub"
     title="prototype — action stubbed">${label}</button>`;

// ── Variant A — "Mission control": staleness strip, then a panel grid.
function variantA() {
  return `
  <div class="pk-idstrip">
    <div class="pk-idcard">
      <div class="pk-idcard__k">live tree</div>
      <div class="pk-idcard__hash">${D.live.hash}</div>
      <div class="pk-idcard__meta">v${D.live.version} · ${D.live.when}</div>
    </div>
    <div class="pk-idcard pk-idcard--draft">
      <div class="pk-idcard__k">draft</div>
      <div class="pk-idcard__hash">${D.draft.hash}</div>
      <div class="pk-idcard__meta">${D.draft.id} · edits: ${D.draft.dirty.join(', ')}</div>
    </div>
    <div class="pk-idcard pk-idcard--stale">
      <div class="pk-idcard__k">running orchestrator</div>
      <div class="pk-idcard__hash">${D.orch.hash}</div>
      <div class="pk-idcard__meta">${D.orch.since} · <b>one publish behind</b></div>
    </div>
  </div>
  <div class="pk-grid">
    <div class="pk-panel">
      <header><b>Version trail</b><span>publish log</span></header>
      ${D.trail.map((t) => `
        <div class="pk-trailrow">
          <span class="pk-mono pk-dim">${t.when}</span>
          <span class="pk-mono">${t.base} → <b>${t.hash}</b></span>
          <span class="pk-dim">${t.by}</span>
        </div>`).join('')}
    </div>
    <div class="pk-panel">
      <header><b>Validate</b><span>gate runner, no landing</span></header>
      ${D.validate.lines.map((l) => `
        <div class="pk-vline pk-vline--${l.level}">${l.text}</div>`).join('')}
      <div class="pk-panel__foot">${stub('Run validate', true)}</div>
    </div>
    <div class="pk-panel pk-panel--wide">
      <header><b>Media &amp; needs</b><span>what this pack needs tonight</span></header>
      ${D.needs.map((n) => `
        <div class="pk-needrow">
          <span class="pk-kind">${n.kind}</span>
          <span class="pk-mono pk-need-id">${n.id}</span>
          ${badge(n.verdict, n.depth)}
          <span class="pk-why">${n.why}</span>
        </div>`).join('')}
    </div>
    <div class="pk-panel pk-panel--wide pk-actions">
      <header><b>Pack</b><span>${D.packs[0]}</span></header>
      <div class="pk-actionrow">
        <select class="pk-select">${D.packs.map((p) => `<option>${p}</option>`).join('')}</select>
        ${stub('New pack…')} ${stub('Export zip')} ${stub('Commit & push pack', true)}
        <span class="pk-dim pk-small">submodule dirty-or-ahead · refuses mid-publish</span>
      </div>
    </div>
  </div>`;
}

// ── Variant B — "Ledger": the trail is the spine; identity in a rail.
function variantB() {
  const entry = (title, hash, meta, cls = '', body = '') => `
    <div class="pk-ledger__entry ${cls}">
      <div class="pk-ledger__node"></div>
      <div class="pk-ledger__card">
        <div class="pk-ledger__head"><b>${title}</b>
          <span class="pk-mono">${hash}</span></div>
        <div class="pk-dim pk-small">${meta}</div>
        ${body}
      </div>
    </div>`;
  return `
  <div class="pk-ledgerwrap">
    <aside class="pk-rail">
      <div class="pk-rail__block">
        <div class="pk-rail__k">pack</div>
        <select class="pk-select pk-select--full">${D.packs.map((p) => `<option>${p}</option>`).join('')}</select>
      </div>
      <div class="pk-rail__block">
        <div class="pk-rail__k">running orchestrator</div>
        <div class="pk-mono">${D.orch.hash}</div>
        <div class="pk-stale-chip">one publish behind</div>
      </div>
      <div class="pk-rail__block">
        <div class="pk-rail__k">actions</div>
        ${stub('New pack…')}${stub('Export zip')}${stub('Commit & push', true)}
      </div>
      <div class="pk-rail__block">
        <div class="pk-rail__k">media &amp; needs</div>
        ${D.needs.filter((n) => n.verdict !== 'runs').map((n) => `
          <div class="pk-rail__need">${badge(n.verdict, n.depth)}
            <span class="pk-mono pk-small">${n.id}</span></div>`).join('')}
        <div class="pk-dim pk-small">${D.needs.filter((n) => n.verdict === 'runs').length} more resolve runs — expand ▾</div>
      </div>
    </aside>
    <div class="pk-ledger">
      ${entry('DRAFT', D.draft.hash,
    `${D.draft.id} · base ${D.draft.base} · edits: ${D.draft.dirty.join(', ')}`,
    'pk-ledger__entry--draft',
    `<div class="pk-vblock">${D.validate.lines.map((l) => `
        <div class="pk-vline pk-vline--${l.level}">${l.text}</div>`).join('')}
      <div style="margin-top:8px">${stub('Run validate', true)} ${stub('Publish')}</div></div>`)}
      ${entry('LIVE · v' + D.live.version, D.live.hash, D.live.when, 'pk-ledger__entry--live')}
      ${D.trail.slice(1).map((t) =>
    entry('published', t.hash, `${t.when} · ${t.by} · base ${t.base}`)).join('')}
    </div>
  </div>`;
}

// ── Variant C — "Preflight console": one dense needs table; identity chips.
function variantC() {
  const groups = [...new Set(D.needs.map((n) => n.kind))];
  return `
  <div class="pk-console">
    <div class="pk-console__head">
      <select class="pk-select">${D.packs.map((p) => `<option>${p}</option>`).join('')}</select>
      <span class="pk-chip">live <span class="pk-mono">${D.live.hash}</span></span>
      <span class="pk-chip pk-chip--draft">draft <span class="pk-mono">${D.draft.hash}</span></span>
      <span class="pk-chip pk-chip--stale">orch <span class="pk-mono">${D.orch.hash}</span> · stale</span>
      <span class="pk-console__spacer"></span>
      ${stub('New pack…')}${stub('Export')}${stub('Validate')}${stub('Commit & push', true)}
    </div>
    <div class="pk-console__verdictbar">
      <span class="pk-vcount pk-vcount--fault">2 fault</span>
      <span class="pk-vcount pk-vcount--dormant">1 dormant</span>
      <span class="pk-vcount pk-vcount--runs">${D.needs.filter((n) => n.verdict === 'runs').length} run</span>
      <span class="pk-dim pk-small">resolved against aln-full-kit · mixed depth</span>
    </div>
    ${groups.map((g) => `
      <div class="pk-console__group">${g}</div>
      ${D.needs.filter((n) => n.kind === g).map((n) => `
        <div class="pk-consolerow ${n.verdict === 'fault' || n.verdict === 'no-go' ? 'pk-consolerow--loud' : ''}">
          <span class="pk-mono pk-need-id">${n.id}</span>
          ${badge(n.verdict, n.depth)}
          <span class="pk-why">${n.why}</span>
        </div>`).join('')}`).join('')}
    <div class="pk-console__foot">
      trail: ${D.trail.map((t) => `<span class="pk-mono">${t.hash}</span>`).join(' ← ')}
      <span class="pk-dim">· full log ▸</span>
    </div>
  </div>`;
}

const VARIANTS = { A: variantA, B: variantB, C: variantC };
const NAMES = { A: 'Mission control', B: 'Ledger', C: 'Preflight console' };

export function render(container) {
  injectStyles();
  const url = new URL(window.location);
  let v = (url.searchParams.get('variant') || 'A').toUpperCase();
  if (!VARIANTS[v]) v = 'A';

  const host = document.createElement('div');
  host.className = 'pk-host';
  container.appendChild(host);

  const draw = (key) => { host.innerHTML = VARIANTS[key](); };
  draw(v);

  mountSwitcher({
    variants: ['A', 'B', 'C'],
    current: v,
    label: (key) => NAMES[key],
    onChange: draw,
  });
}

function injectStyles() {
  if (document.getElementById('pk-proto-style')) return;
  const s = document.createElement('style');
  s.id = 'pk-proto-style';
  s.textContent = `
  .pk-host { --pk-gap:12px; font-size:13px; }
  .pk-mono { font-family:var(--font-mono); font-size:12px; }
  .pk-dim { color:var(--text-muted); }
  .pk-small { font-size:11px; }
  .pk-why { color:var(--text-secondary); font-size:12px; }
  .pk-stub { cursor:not-allowed; opacity:.9; }
  .pk-select { font:inherit; font-size:12px; background:var(--bg-input);
    color:var(--text-primary); border:1px solid var(--border-medium);
    border-radius:6px; padding:6px 8px; }
  .pk-select--full { width:100%; }

  .pk-badge { display:inline-flex; align-items:center; gap:5px; font-size:11px;
    line-height:1; padding:3px 8px 3px 6px; border-radius:999px;
    border:1px solid var(--border-medium); background:var(--bg-raised); }
  .pk-dot { width:6px; height:6px; border-radius:50%; }
  .pk-badge--runs { border-color:rgba(76,175,80,.35); color:var(--success); }
  .pk-badge--runs .pk-dot { background:var(--success); }
  .pk-badge--dormant { border-color:var(--border-subtle); color:var(--text-muted); }
  .pk-badge--dormant .pk-dot { background:var(--text-muted); }
  .pk-badge--fault { border-color:rgba(239,83,80,.45);
    background:rgba(239,83,80,.08); color:var(--danger); }
  .pk-badge--fault .pk-dot { background:var(--danger); }
  .pk-depth { font-family:var(--font-mono); font-size:9px; padding:2px 5px;
    border-radius:3px; }
  .pk-depth--paper { color:var(--text-muted); border:1px dashed var(--border-medium); }
  .pk-depth--live { color:var(--info); border:1px solid rgba(66,165,245,.4); }

  /* A — mission control */
  .pk-idstrip { display:grid; grid-template-columns:repeat(3,1fr);
    gap:var(--pk-gap); margin-bottom:var(--pk-gap); }
  .pk-idcard { background:var(--bg-surface); border:1px solid var(--border-subtle);
    border-radius:10px; padding:12px 14px; }
  .pk-idcard--draft { border-color:var(--border-accent); }
  .pk-idcard--stale { border-color:rgba(255,152,0,.5); }
  .pk-idcard--stale .pk-idcard__meta b { color:var(--warning); }
  .pk-idcard__k { font-size:10px; letter-spacing:.1em; text-transform:uppercase;
    color:var(--text-muted); margin-bottom:4px; }
  .pk-idcard__hash { font-family:var(--font-mono); font-size:15px; }
  .pk-idcard__meta { font-size:11px; color:var(--text-secondary); margin-top:4px; }
  .pk-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--pk-gap); }
  .pk-panel { background:var(--bg-surface); border:1px solid var(--border-subtle);
    border-radius:10px; padding:12px 14px; }
  .pk-panel--wide { grid-column:1 / -1; }
  .pk-panel header { display:flex; justify-content:space-between;
    align-items:baseline; border-bottom:1px solid var(--border-subtle);
    padding-bottom:7px; margin-bottom:9px; }
  .pk-panel header b { font-size:11px; letter-spacing:.07em;
    text-transform:uppercase; color:var(--amber-300); }
  .pk-panel header span { font-size:11px; color:var(--text-muted); }
  .pk-panel__foot { margin-top:10px; }
  .pk-trailrow { display:flex; gap:14px; padding:5px 0;
    border-bottom:1px dashed var(--border-subtle); }
  .pk-trailrow:last-child { border-bottom:none; }
  .pk-vline { font-family:var(--font-mono); font-size:11.5px; padding:4px 8px;
    border-radius:4px; margin-bottom:5px; }
  .pk-vline--err { background:rgba(239,83,80,.1); color:#ff9a97; }
  .pk-vline--warn { background:rgba(255,152,0,.08); color:var(--warning); }
  .pk-needrow { display:flex; align-items:center; gap:10px; padding:6px 0;
    border-bottom:1px dashed var(--border-subtle); }
  .pk-needrow:last-child { border-bottom:none; }
  .pk-kind { font-size:10px; letter-spacing:.06em; text-transform:uppercase;
    color:var(--text-muted); width:82px; flex-shrink:0; }
  .pk-need-id { flex:0 1 auto; min-width:0; }
  .pk-actionrow { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

  /* B — ledger */
  .pk-ledgerwrap { display:grid; grid-template-columns:250px 1fr; gap:18px; }
  .pk-rail__block { background:var(--bg-surface); border:1px solid var(--border-subtle);
    border-radius:10px; padding:11px 13px; margin-bottom:10px; }
  .pk-rail__k { font-size:10px; letter-spacing:.1em; text-transform:uppercase;
    color:var(--text-muted); margin-bottom:6px; }
  .pk-rail__block .btn { display:block; width:100%; margin-bottom:6px;
    text-align:center; }
  .pk-rail__need { display:flex; align-items:center; gap:6px; padding:4px 0; }
  .pk-stale-chip { display:inline-block; margin-top:5px; font-size:10px;
    color:var(--warning); border:1px solid rgba(255,152,0,.4);
    border-radius:999px; padding:2px 8px; }
  .pk-ledger { position:relative; padding-left:22px; }
  .pk-ledger::before { content:''; position:absolute; left:7px; top:8px;
    bottom:8px; width:2px; background:var(--border-medium); }
  .pk-ledger__entry { position:relative; margin-bottom:12px; }
  .pk-ledger__node { position:absolute; left:-21px; top:14px; width:10px;
    height:10px; border-radius:50%; background:var(--bg-raised);
    border:2px solid var(--text-muted); }
  .pk-ledger__entry--draft .pk-ledger__node { border-color:var(--amber-300); }
  .pk-ledger__entry--live .pk-ledger__node { border-color:var(--success); }
  .pk-ledger__card { background:var(--bg-surface);
    border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; }
  .pk-ledger__entry--draft .pk-ledger__card { border-color:var(--border-accent); }
  .pk-ledger__head { display:flex; justify-content:space-between;
    align-items:baseline; margin-bottom:3px; }
  .pk-ledger__head b { font-size:11px; letter-spacing:.07em;
    text-transform:uppercase; color:var(--amber-300); }
  .pk-vblock { margin-top:9px; border-top:1px dashed var(--border-subtle);
    padding-top:9px; }

  /* C — preflight console */
  .pk-console__head { display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    margin-bottom:10px; }
  .pk-console__spacer { flex:1; }
  .pk-chip { font-size:11px; padding:4px 10px; border-radius:999px;
    border:1px solid var(--border-medium); color:var(--text-secondary); }
  .pk-chip--draft { border-color:var(--border-accent); color:var(--amber-300); }
  .pk-chip--stale { border-color:rgba(255,152,0,.5); color:var(--warning); }
  .pk-console__verdictbar { display:flex; align-items:center; gap:12px;
    background:var(--bg-surface); border:1px solid var(--border-subtle);
    border-radius:8px; padding:8px 12px; margin-bottom:12px; }
  .pk-vcount { font-size:12px; font-weight:600; }
  .pk-vcount--fault { color:var(--danger); }
  .pk-vcount--dormant { color:var(--text-muted); }
  .pk-vcount--runs { color:var(--success); }
  .pk-console__group { font-size:10px; letter-spacing:.1em;
    text-transform:uppercase; color:var(--text-muted); margin:14px 0 6px; }
  .pk-consolerow { display:flex; align-items:center; gap:10px;
    background:var(--bg-surface); border:1px solid var(--border-subtle);
    border-radius:6px; padding:8px 12px; margin-bottom:5px; }
  .pk-consolerow--loud { border-left:3px solid var(--danger); }
  .pk-console__foot { margin-top:16px; font-size:11px;
    color:var(--text-secondary); }
  `;
  document.head.appendChild(s);
}
