/**
 * Token Browser Component — read-only table of tokens with filters.
 * Cross-references scoring config to show calculated values.
 */
import { formatCurrency, el } from '../utils/formatting.js';

export function renderTokenBrowser(container, tokens, scoring) {
  const tokenList = Object.values(tokens);
  const types = [...new Set(tokenList.map(t => t.SF_MemoryType))].sort();
  const ratings = [...new Set(tokenList.map(t => String(t.SF_ValueRating)))].sort();
  const groups = [...new Set(tokenList.map(t => t.SF_Group).filter(Boolean))].sort();

  // State
  let filterType = '';
  let filterRating = '';
  let filterGroup = '';
  let filterSearch = '';

  const card = el('div', { className: 'card' },
    el('div', { className: 'card__header' },
      el('div', {},
        el('div', { className: 'card__title' }, 'Token Browser'),
        el('div', { className: 'card__subtitle' }, `${tokenList.length} tokens loaded (read-only)`),
      ),
    ),
  );

  // Filters
  const filterBar = el('div', { className: 'filter-bar' });

  const typeSelect = el('select', { onChange: () => { filterType = typeSelect.value; renderTable(); } },
    el('option', { value: '' }, 'All Types'),
    ...types.map(t => el('option', { value: t }, t)),
  );

  const ratingSelect = el('select', { onChange: () => { filterRating = ratingSelect.value; renderTable(); } },
    el('option', { value: '' }, 'All Ratings'),
    ...ratings.map(r => el('option', { value: r }, `${r} Star`)),
  );

  const groupSelect = el('select', { onChange: () => { filterGroup = groupSelect.value; renderTable(); } },
    el('option', { value: '' }, 'All Groups'),
    ...groups.map(g => el('option', { value: g }, g)),
  );

  const searchInput = el('input', {
    type: 'text', placeholder: 'Search tokens...',
    onInput: () => { filterSearch = searchInput.value.toLowerCase(); renderTable(); },
  });

  filterBar.append(typeSelect, ratingSelect, groupSelect, searchInput);
  card.appendChild(filterBar);

  // Table
  const tableWrap = el('div', { style: { maxHeight: '400px', overflowY: 'auto' } });
  card.appendChild(tableWrap);

  function renderTable() {
    const filtered = tokenList.filter(t => {
      if (filterType && t.SF_MemoryType !== filterType) return false;
      if (filterRating && String(t.SF_ValueRating) !== filterRating) return false;
      if (filterGroup && t.SF_Group !== filterGroup) return false;
      if (filterSearch && !t.SF_RFID.toLowerCase().includes(filterSearch)) return false;
      return true;
    });

    const baseValues = scoring.baseValues || {};
    const typeMultipliers = scoring.typeMultipliers || {};

    const table = el('table', { className: 'data-table' },
      el('thead', {},
        el('tr', {},
          el('th', {}, 'Token ID'),
          el('th', {}, 'Type'),
          el('th', {}, 'Rating'),
          el('th', {}, 'Group'),
          el('th', {}, 'Value'),
          el('th', {}, 'Media'),
        ),
      ),
      el('tbody', {},
        ...filtered.map(t => {
          const base = baseValues[String(t.SF_ValueRating)] || 0;
          const mult = typeMultipliers[t.SF_MemoryType] || 0;
          const value = base * mult;
          const media = [
            t.image ? 'img' : null,
            t.audio ? 'aud' : null,
            t.video ? 'vid' : null,
          ].filter(Boolean).join(', ') || 'none';

          return el('tr', {},
            el('td', { className: 'mono' }, t.SF_RFID),
            el('td', {}, t.SF_MemoryType),
            el('td', {}, '★'.repeat(t.SF_ValueRating)),
            el('td', {}, t.SF_Group || '—'),
            el('td', { className: 'mono' }, formatCurrency(value)),
            el('td', {}, media),
          );
        }),
      ),
    );

    if (filtered.length === 0) {
      table.querySelector('tbody').appendChild(
        el('tr', {}, el('td', { colspan: '6', className: 'empty-state' }, 'No tokens match filters'))
      );
    }

    tableWrap.textContent = '';
    tableWrap.appendChild(table);
  }

  renderTable();
  container.appendChild(card);
}
