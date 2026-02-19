/**
 * Shared form field builder for env-backed config fields.
 * Used by both Infrastructure and Audio & Environment sections.
 */
import { el } from './formatting.js';

/**
 * Create a form group element for an env variable.
 *
 * @param {Object} envData - Mutable env data object
 * @param {string} key - Env var key
 * @param {string} label - Display label
 * @param {string} type - Field type: 'text' | 'number' | 'url' | 'password' | 'boolean' | 'select'
 * @param {Object} opts - Optional: { options, hint, sectionName, markDirty }
 * @returns {HTMLElement}
 */
export function makeEnvField(envData, key, label, type, opts = {}) {
  const { options, hint, sectionName, markDirty } = opts;
  const currentValue = envData[key] || '';
  const dirty = () => markDirty(sectionName);

  const group = el('div', { className: 'form-group' },
    el('label', { className: 'form-group__label', htmlFor: `env-${key}` }, label),
  );

  if (type === 'boolean') {
    const cb = el('input', {
      type: 'checkbox', id: `env-${key}`,
      checked: currentValue === 'true',
      onChange: () => { envData[key] = cb.checked ? 'true' : 'false'; dirty(); },
    });
    group.appendChild(cb);

  } else if (type === 'select' && options) {
    const select = el('select', {
      id: `env-${key}`,
      onChange: () => { envData[key] = select.value; dirty(); },
    },
      ...options.map(opt =>
        el('option', { value: opt, ...(opt === currentValue ? { selected: true } : {}) }, opt)
      ),
    );
    group.appendChild(select);

  } else if (type === 'password') {
    const wrapper = el('div', { className: 'password-wrapper' });
    const input = el('input', {
      type: 'password', id: `env-${key}`, value: currentValue,
      onInput: () => { envData[key] = input.value; dirty(); },
    });
    const toggle = el('button', {
      className: 'password-toggle', type: 'button', textContent: '\u{1f441}',
      onClick: () => { input.type = input.type === 'password' ? 'text' : 'password'; },
    });
    wrapper.append(input, toggle);
    group.appendChild(wrapper);

  } else {
    const inputType = type === 'url' ? 'url' : type === 'number' ? 'number' : 'text';
    const input = el('input', {
      type: inputType, id: `env-${key}`, value: currentValue,
      onInput: () => { envData[key] = input.value; dirty(); },
    });
    group.appendChild(input);
  }

  if (hint) {
    group.appendChild(el('div', { className: 'form-group__hint' }, hint));
  }

  return group;
}
