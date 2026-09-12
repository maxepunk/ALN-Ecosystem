/**
 * Draft bar (B0 BS.3) — the toolbar strip that says WHICH draft this
 * session is editing and carries the Publish / Discard actions.
 *
 * Pure DOM component (no fetch, no store): renders from the stamp it
 * is given and reports intent through callbacks — the musicModel
 * pure-split shape, testable under jsdom.
 */

/**
 * Render the draft bar into a container.
 * @param {HTMLElement} container
 * @param {Object|null} draft - the draft stamp, or null (bar empties)
 * @param {{onPublish: Function, onDiscard: Function}} handlers
 */
export function renderDraftBar(container, draft, { onPublish, onDiscard }) {
  container.textContent = '';
  if (!draft) return;

  const label = document.createElement('span');
  label.className = 'draft-bar__label';
  const baseHash = draft.base && draft.base.contentHash
    ? draft.base.contentHash.replace(/^sha256:/, '').slice(0, 8)
    : '????????';
  label.textContent = `Draft ${draft.draftId} · base ${baseHash}`;
  container.appendChild(label);

  const publishBtn = document.createElement('button');
  publishBtn.className = 'btn btn--primary draft-bar__publish';
  publishBtn.textContent = 'Publish pack';
  publishBtn.addEventListener('click', onPublish);
  container.appendChild(publishBtn);

  const discardBtn = document.createElement('button');
  discardBtn.className = 'btn draft-bar__discard';
  discardBtn.textContent = 'Discard draft';
  discardBtn.addEventListener('click', onDiscard);
  container.appendChild(discardBtn);
}
