const COLUMNS = [
  ['yesterday', 'Yesterday'],
  ['today', 'Today'],
  ['blockers', 'Blockers'],
];

export function renderStandup(data) {
  const agents = data?.agents || [];
  if (data?.state === 'loading') return renderStatus(data?.message || 'Loading Linear standup…', data?.freshness);
  if (!agents.length) return renderStatus(data?.message || 'No Linear standup data available.', data?.freshness);

  const notice = ['stale', 'error'].includes(data?.state)
    ? `<p class="standup__notice" role="status">${escapeHtml(data?.message || 'Standup unavailable — showing last-known data.')}</p>`
    : '';
  const coverage = renderCoverage(data);
  const unresolved = renderUnresolved(data?.unresolved);

  return `
    <div class="card__header standup__header">
      <h2 class="card__title">Scrum Standup</h2>
      <span class="standup__freshness">${escapeHtml(data.freshness || 'Linear')}</span>
    </div>
    ${notice}
    <div class="standup__legend" aria-hidden="true">
      <span>Agent</span>${COLUMNS.map(([, label]) => `<span>${label}</span>`).join('')}
    </div>
    <div class="standup__rows">
      ${agents.map(agent => renderAgentRow(agent)).join('')}
    </div>
    ${coverage}
    ${unresolved}
  `;
}

export function mountStandup(slot, source) {
  const resolved = typeof source === 'function' ? source() : source;
  let current = resolved?.initial || resolved || { agents: [] };

  const render = () => { slot.innerHTML = renderStandup(current); };
  render();

  slot.addEventListener('click', (event) => {
    const cell = event.target.closest('.standup-cell');
    if (!cell) return;
    const detail = findCell(current, cell.dataset.agent, cell.dataset.column);
    openStandupDetail(detail);
  });

  resolved?.live?.then(next => {
    if (!next) return;
    current = next;
    render();
  }).catch(() => {
    const hasLastKnown = Array.isArray(current?.agents) && current.agents.length > 0;
    current = hasLastKnown
      ? {
          ...current,
          state: 'stale',
          freshness: 'Linear · stale',
          message: 'Live Linear is unavailable; showing last-known data.',
        }
      : {
          state: 'unavailable',
          source: 'linear',
          freshness: 'Linear · unavailable',
          message: 'Linear standup is temporarily unavailable.',
          agents: [],
          unresolved: [],
          truncated: 0,
          sourceTruncated: false,
        };
    render();
  });

  return {
    refresh(next) {
      current = next;
      render();
    },
  };
}

function renderStatus(message, freshness) {
  return `
    <div class="card__header standup__header">
      <h2 class="card__title">Scrum Standup</h2>
      <span class="standup__freshness">${escapeHtml(freshness || 'Linear')}</span>
    </div>
    <p class="standup__status">${escapeHtml(message)}</p>
  `;
}

function renderUnresolved(groups) {
  if (!Array.isArray(groups) || !groups.length) return '';
  return `<div class="standup__unresolved" role="status">
    ${groups.map(group => {
      const count = Number(group?.count) || 0;
      const noun = count === 1 ? 'record' : 'records';
      return `<p><strong>${count} unassigned ${noun}</strong> · Grouped by ${escapeHtml(group?.basis || 'area:unattributed')}</p>`;
    }).join('')}
  </div>`;
}

function renderCoverage(data) {
  const messages = [];
  const truncated = Number(data?.truncated) || 0;
  if (truncated > 0) {
    const noun = truncated === 1 ? 'entry' : 'entries';
    messages.push(`${truncated} additional cell ${noun} omitted by the display limit.`);
  }
  if (data?.sourceTruncated) {
    messages.push('Linear has more records; this standup uses the latest 100 issues.');
  }
  if (!messages.length) return '';
  return `<div class="standup__coverage" role="status">${messages.map(message => `<p>${escapeHtml(message)}</p>`).join('')}</div>`;
}

function renderAgentRow(agent) {
  return `
    <div class="agent-row">
      <div class="agent-row__identity">
        <span class="agent-row__avatar">${escapeHtml(agent.initials)}</span>
        <span class="agent-row__name">${escapeHtml(agent.name)}</span>
      </div>
      ${COLUMNS.map(([key, label]) => renderCell(agent, key, label)).join('')}
    </div>
  `;
}

function renderCell(agent, columnKey, columnLabel) {
  const items = agent.columns?.[columnKey] || [];
  const primary = items[0] || null;
  const clear = !primary;
  const title = primary?.title || (columnKey === 'blockers' ? 'No blockers' : 'No updates');
  const issue = primary?.issue || (columnKey === 'blockers' ? 'Clear' : 'None');
  const groupedBasis = primary?.attribution?.type === 'grouped' ? primary.attribution.basis : '';
  const quality = primary && columnKey === 'yesterday' ? (primary.quality || 'QA pending') : '';
  const overflow = Math.max(0, items.length - 1);
  const blocked = columnKey === 'blockers' && primary;
  const status = primary?.status || '';
  const aria = [agent.name, columnLabel, issue, title, quality, status, groupedBasis ? `Grouped by ${groupedBasis}` : '', overflow ? `+${overflow} more` : '']
    .filter(Boolean)
    .join(' · ');

  return `<button type="button" class="standup-cell${clear ? ' standup-cell--clear' : ''}${blocked ? ' standup-cell--blocked' : ''}" data-agent="${escapeAttr(agent.name)}" data-column="${columnKey}" aria-label="${escapeAttr(aria)}">
    <span class="standup-cell__issue">${escapeHtml(issue)}</span>
    <span class="standup-cell__title">${escapeHtml(title)}</span>
    ${(quality || status || groupedBasis || overflow) ? `<span class="standup-cell__meta">
      ${quality ? `<span class="quality${quality === 'QA pending' ? ' quality--pending' : ''}">${escapeHtml(quality)}</span>` : ''}
      ${status ? `<span class="standup-cell__status">${escapeHtml(status)}</span>` : ''}
      ${groupedBasis ? `<span class="attribution">Grouped by ${escapeHtml(groupedBasis)}</span>` : ''}
      ${overflow ? `<span class="overflow-count" aria-label="${overflow} more grouped items">+${overflow}</span>` : ''}
    </span>` : ''}
  </button>`;
}

function findCell(data, agentName, columnKey) {
  const agent = (data?.agents || []).find(item => item.name === agentName);
  const items = agent?.columns?.[columnKey] || [];
  const primary = items[0] || null;
  const column = COLUMNS.find(([key]) => key === columnKey)?.[1] || columnKey;
  return { agent, columnKey, column, primary, items };
}

let detailKeyHandler = null;

function openStandupDetail(detail) {
  closeStandupDetail();
  const primary = detail.primary;
  const title = primary?.title || (detail.columnKey === 'blockers' ? 'No blockers' : 'No updates');
  const note = primary?.note || (primary ? '' : 'No Linear records in this cell.');
  const host = document.createElement('div');
  host.className = 'overlay overlay--standup-detail';
  host.dataset.standupOverlay = 'true';
  host.innerHTML = `
    <section class="overlay__panel standup-detail" role="dialog" aria-modal="true" aria-labelledby="standup-detail-title">
      <div class="overlay__header">
        <p class="standup-detail__key" data-detail-key>${escapeHtml(detail.agent?.name || 'Standup')} · ${escapeHtml(detail.column.toLowerCase())}</p>
        <button type="button" class="overlay__close" aria-label="Close standup detail" data-standup-close>×</button>
      </div>
      <h2 class="standup-detail__title" id="standup-detail-title" data-detail-title>${escapeHtml(title)}</h2>
      <p class="standup-detail__note" data-detail-note>${escapeHtml(note)}</p>
      ${detail.items.length > 1 ? `<ul class="standup-detail__items">${detail.items.map(item => `<li><strong>${escapeHtml(item.issue)}</strong> ${escapeHtml(item.title)}</li>`).join('')}</ul>` : ''}
    </section>
  `;
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');

  const close = () => closeStandupDetail();
  host.querySelector('[data-standup-close]').addEventListener('click', close);
  host.addEventListener('click', event => { if (event.target === host) close(); });
  const onKey = event => {
    if (event.key !== 'Escape') return;
    close();
  };
  detailKeyHandler = onKey;
  document.addEventListener('keydown', onKey);
}

function closeStandupDetail() {
  if (detailKeyHandler) document.removeEventListener('keydown', detailKeyHandler);
  detailKeyHandler = null;
  document.querySelectorAll('[data-standup-overlay]').forEach(el => el.remove());
  document.documentElement.classList.remove('has-overlay');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
