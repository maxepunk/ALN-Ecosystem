/**
 * Game Economy Section
 * Editable tables for base values and type multipliers,
 * live formula preview, read-only token browser.
 */
import * as api from '../utils/api.js';
import { formatCurrency, el } from '../utils/formatting.js';
import { renderTokenBrowser } from '../components/tokenBrowser.js';

let scoringData = null;
let ctx = null;

export function render(container, config, context) {
  ctx = context;
  scoringData = JSON.parse(JSON.stringify(config.scoring));

  // Base Values Card
  const baseCard = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Base Values'),
        el('div', { className: 'card__subtitle' }, 'Dollar value per star rating (Black Market mode)'),
      ),
    ),
  );

  const baseTable = el('table', { className: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Rating'),
        el('th', {}, 'Stars'),
        el('th', {}, 'Base Value ($)'),
      ),
    ),
    el('tbody', {},
      ...Object.entries(scoringData.baseValues).map(([rating, value]) => {
        const input = el('input', {
          type: 'number', value: String(value), min: '0', step: '1000',
          style: { width: '150px' },
          onInput: () => {
            scoringData.baseValues[rating] = parseInt(input.value) || 0;
            ctx.markDirty('economy');
            updatePreview();
            updateExamples();
          },
        });
        return el('tr', {},
          el('td', {}, rating),
          el('td', {}, '\u2605'.repeat(parseInt(rating))),
          el('td', {}, input),
        );
      }),
    ),
  );
  baseCard.appendChild(baseTable);
  container.appendChild(baseCard);

  // Type Multipliers Card
  const multCard = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Type Multipliers'),
        el('div', { className: 'card__subtitle' }, 'Multiplier applied per memory type'),
      ),
    ),
  );

  const multTable = el('table', { className: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Memory Type'),
        el('th', {}, 'Multiplier'),
        el('th', {}, 'Example (3\u2605)'),
      ),
    ),
    el('tbody', {},
      ...Object.entries(scoringData.typeMultipliers).map(([type, mult]) => {
        const input = el('input', {
          type: 'number', value: String(mult), min: '0', step: '1',
          style: { width: '100px' },
          onInput: () => {
            scoringData.typeMultipliers[type] = parseFloat(input.value) || 0;
            ctx.markDirty('economy');
            updatePreview();
            updateExamples();
          },
        });
        const exampleTd = el('td', { className: 'mono', dataset: { exampleType: type } });
        return el('tr', {},
          el('td', {}, type),
          el('td', {}, input),
          exampleTd,
        );
      }),
    ),
  );
  multCard.appendChild(multTable);
  container.appendChild(multCard);

  // Formula Preview
  const previewDiv = el('div', { className: 'formula-preview' });
  const previewCard = el('div', { className: 'card' },
    el('div', { className: 'card__title', style: { marginBottom: '8px' } }, 'Formula Preview'),
    previewDiv,
  );
  container.appendChild(previewCard);

  // Store ref for updates
  container._formulaPreview = previewDiv;

  updatePreview();
  updateExamples();

  // Token Browser (loaded async) — uses live scoringData so edits are reflected
  loadTokenBrowser(container, scoringData);
}

function updatePreview() {
  const preview = document.querySelector('.formula-preview');
  if (!preview || !scoringData) return;
  const lines = ['tokenScore = baseValues[rating] \u00d7 typeMultipliers[type]', ''];
  for (const [type, mult] of Object.entries(scoringData.typeMultipliers)) {
    const base3 = scoringData.baseValues['3'] || 0;
    lines.push(`  3\u2605 ${type}: ${formatCurrency(base3)} \u00d7 ${mult} = ${formatCurrency(base3 * mult)}`);
  }
  preview.textContent = lines.join('\n');
}

function updateExamples() {
  if (!scoringData) return;
  for (const [type, mult] of Object.entries(scoringData.typeMultipliers)) {
    const cell = document.querySelector(`[data-example-type="${type}"]`);
    if (cell) {
      const base3 = scoringData.baseValues['3'] || 0;
      cell.textContent = formatCurrency(base3 * mult);
    }
  }
}

async function loadTokenBrowser(container, scoring) {
  try {
    const tokens = await api.getTokens();
    renderTokenBrowser(container, tokens, scoring);
  } catch (err) {
    container.appendChild(el('div', { className: 'empty-state' }, `Failed to load tokens: ${err.message}`));
  }
}

export async function save() {
  await api.putScoring(scoringData);
}
