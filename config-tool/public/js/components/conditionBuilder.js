/**
 * Condition Builder Component
 * Dynamic rows for building trigger conditions.
 */
import { el } from '../utils/formatting.js';

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'at least' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'at most' },
  { value: 'in', label: 'is one of' },
];

export function renderConditionBuilder(container, conditions, availableFields, editorCtx) {
  container.textContent = '';

  const header = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
    el('span', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' } }, 'Conditions'),
    el('button', {
      className: 'btn btn--small',
      textContent: '+ Condition',
      onClick: () => {
        conditions.push({ field: availableFields[0] || '', op: 'eq', value: '' });
        editorCtx.markDirty();
        renderConditionBuilder(container, conditions, availableFields, editorCtx);
      },
    }),
  );
  container.appendChild(header);

  if (conditions.length === 0) {
    container.appendChild(el('div', {
      style: { fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' },
    }, 'No conditions — cue fires on every matching event.'));
    return;
  }

  for (let i = 0; i < conditions.length; i++) {
    container.appendChild(buildConditionRow(i, conditions, availableFields, editorCtx, container));
  }
}

function buildConditionRow(index, conditions, availableFields, editorCtx, parentContainer) {
  const cond = conditions[index];

  const fieldSelect = el('select', {
    style: { width: '120px' },
    onChange: () => { cond.field = fieldSelect.value; editorCtx.markDirty(); },
  },
    ...availableFields.map(f =>
      el('option', { value: f, ...(f === cond.field ? { selected: true } : {}) }, f)
    ),
  );

  const opSelect = el('select', {
    style: { width: '120px' },
    onChange: () => {
      cond.op = opSelect.value;
      editorCtx.markDirty();
      // Update placeholder hint
      valueInput.placeholder = cond.op === 'in' ? 'comma-separated values' : 'value';
    },
  },
    ...OPERATORS.map(op =>
      el('option', { value: op.value, ...(op.value === cond.op ? { selected: true } : {}) }, op.label)
    ),
  );

  const valueInput = el('input', {
    type: 'text',
    value: Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value ?? ''),
    style: { width: '160px' },
    placeholder: cond.op === 'in' ? 'comma-separated values' : 'value',
    onInput: () => {
      if (cond.op === 'in') {
        cond.value = valueInput.value.split(',').map(v => v.trim()).filter(Boolean);
      } else {
        const raw = valueInput.value;
        const num = Number(raw);
        // Auto-coerce to number for numeric comparisons
        cond.value = raw !== '' && !isNaN(num) ? num : raw;
      }
      editorCtx.markDirty();
    },
  });

  const deleteBtn = el('button', {
    className: 'btn btn--small btn--danger',
    textContent: '\u00d7',
    onClick: () => {
      conditions.splice(index, 1);
      editorCtx.markDirty();
      renderConditionBuilder(parentContainer, conditions, availableFields, editorCtx);
    },
  });

  return el('div', {
    style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' },
  }, fieldSelect, opSelect, valueInput, deleteBtn);
}
