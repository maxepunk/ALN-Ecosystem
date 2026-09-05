/**
 * PROTOTYPE — floating variant switcher (mattpocock prototype skill,
 * UI branch). Shared by any UI prototype mounted in the tool. Visible
 * ONLY when the URL carries ?variant= (this tool has no build-env
 * flag, so URL-gating stands in for the skill's NODE_ENV gate).
 * Throwaway: not production code.
 */
export function mountSwitcher({ variants, current, label, onChange }) {
  const bar = document.createElement('div');
  bar.className = 'proto-switcher';
  bar.innerHTML = `
    <button class="proto-switcher__btn" data-dir="-1" title="Previous variant">←</button>
    <span class="proto-switcher__label"></span>
    <button class="proto-switcher__btn" data-dir="1" title="Next variant">→</button>
  `;
  const labelEl = bar.querySelector('.proto-switcher__label');

  function setLabel(v) {
    labelEl.textContent = `${v} — ${label(v)}`;
  }
  setLabel(current);

  function cycle(dir) {
    const i = variants.indexOf(current);
    current = variants[(i + dir + variants.length) % variants.length];
    const url = new URL(window.location);
    url.searchParams.set('variant', current);
    window.history.replaceState(null, '', url);
    setLabel(current);
    onChange(current);
  }

  bar.querySelectorAll('.proto-switcher__btn').forEach((b) =>
    b.addEventListener('click', () => cycle(Number(b.dataset.dir)))
  );
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
      || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') cycle(-1);
    if (e.key === 'ArrowRight') cycle(1);
  });

  if (!document.getElementById('proto-switcher-style')) {
    const s = document.createElement('style');
    s.id = 'proto-switcher-style';
    s.textContent = `
      .proto-switcher { position:fixed; bottom:18px; left:50%;
        transform:translateX(-50%); z-index:999; display:flex;
        align-items:center; gap:10px; padding:8px 14px;
        background:#000; border:1px solid var(--amber-500,#d4a017);
        border-radius:999px; box-shadow:0 4px 24px rgba(0,0,0,.6);
        font-family:var(--font-mono,monospace); font-size:12px;
        color:var(--amber-300,#ffd54f); }
      .proto-switcher__btn { font:inherit; background:none; border:none;
        color:inherit; cursor:pointer; padding:2px 6px; }
      .proto-switcher__btn:hover { color:#fff; }
      .proto-switcher__label { letter-spacing:.04em; }
    `;
    document.head.appendChild(s);
  }
  document.body.appendChild(bar);
  return bar;
}
