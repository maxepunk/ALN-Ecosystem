/**
 * Shared formatting utilities.
 */

// Pack-driven money spec (A3 slice 3b, R-3b-1): the edited pack's
// scoring.display.format drives rendering — one '#,###' signed
// grouped-integer token wrapped by literal affixes (grammar twin of
// backend gameRules/formatting.js). Baked ALN spec fallback; applied by
// app.js from GET /api/config after each load. Replaces the old
// hardcoded Intl USD formatter — byte-identical for the ALN spec on
// NON-NEGATIVE values (the tool's previews never render negatives);
// negatives now follow the engine convention ($-25,000, the sign on
// the number token) instead of Intl's -$25,000.
let MONEY_SPEC = { prefix: '$', suffix: '' };

export function applyPackMoneyFormat(format) {
  const m = typeof format === 'string' ? format.match(/^([^#]*)#,###([^#]*)$/) : null;
  MONEY_SPEC = m ? { prefix: m[1], suffix: m[2] } : { prefix: '$', suffix: '' };
  return m !== null;
}

export function formatCurrency(value) {
  return MONEY_SPEC.prefix + (value || 0).toLocaleString('en-US') + MONEY_SPEC.suffix;
}

/**
 * Star construction (slice 3b twin of the scanner's formatStars):
 * clamped to the pack's rating scale so out-of-range data never throws
 * a negative-repeat RangeError. Glyphs stay per-surface (Q-3b-2 held).
 */
export function formatStars(rating, scale = 5, { filled = '\u2605', empty = null } = {}) {
  const r = Math.max(0, Math.min(scale, rating || 0));
  return filled.repeat(r) + (empty ? empty.repeat(scale - r) : '');
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format seconds as M:SS or H:MM:SS (with optional .d fractional).
 */
export function formatTime(totalSeconds) {
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const whole = Math.floor(s);
  const frac = Math.round((s - whole) * 10);
  let sStr = String(whole).padStart(2, '0');
  if (frac > 0) sStr += '.' + frac;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${sStr}`;
  return `${m}:${sStr}`;
}

/**
 * Parse M:SS, H:MM:SS, or bare seconds into a float.
 */
export function parseTime(str) {
  str = String(str).trim();
  const parts = str.split(':');
  if (parts.length === 3) {
    return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
  }
  if (parts.length === 2) {
    return (parseInt(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
  }
  return parseFloat(str) || 0;
}

/**
 * Create a DOM element with attributes and children.
 */
export function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') elem.className = val;
    else if (key === 'textContent') elem.textContent = val;
    else if (key.startsWith('on')) elem.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'dataset') Object.assign(elem.dataset, val);
    else if (key === 'style' && typeof val === 'object') Object.assign(elem.style, val);
    else if (key === 'htmlFor') elem.htmlFor = val;
    else if (key === 'checked' || key === 'hidden' || key === 'disabled' || key === 'required' || key === 'open' || key === 'selected') elem[key] = val;
    else elem.setAttribute(key, val);
  }
  for (const child of children) {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else if (child != null) elem.appendChild(child);
  }
  return elem;
}
