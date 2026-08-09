const AGENT_DEFS = [
  ['Nigel', 'NI'],
  ['Derek', 'DE'],
  ['Mo', 'MO'],
  ['Smith', 'SM'],
  ['Sam', 'SA'],
];

const BLOCKER_LABELS = new Map([
  ['awaiting-tim', 'Awaiting Tim'],
  ['awaiting-input', 'Awaiting Input'],
  ['blocked', 'Blocked'],
]);

const LINEAR_QUERY = `
  query StandupIssues($first: Int!) {
    issues(first: $first, orderBy: updatedAt) {
      nodes {
        identifier
        title
        completedAt
        updatedAt
        state { name type }
        assignee { name displayName }
        project { name }
        labels(first: 20) { nodes { name } }
        comments(first: 20) { nodes { body createdAt user { name displayName } } }
      }
      pageInfo { hasNextPage }
    }
  }
`;

export function extractQuality(comments = []) {
  const bodies = comments
    .map(comment => ({
      body: String(comment?.body || ''),
      createdAt: validDate(comment?.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(comment => comment.body);
  for (const body of bodies) {
    const qa = body.match(/QA\s+verdict[^\n]*?\b(PASS|FAIL)\b/i);
    if (qa) return `QA ${qa[1].toUpperCase()}`;
    const sam = body.match(/\bSAM[_\s-]?(PASS|FAIL)\b/i);
    if (sam) return `Sam ${sam[1].toUpperCase()}`;
    const design = body.match(/\bDESIGN\s+(PASS|FAIL)\b/i);
    if (design) return `Design ${design[1].toUpperCase()}`;
    const acceptance = body.match(/\bACCEPTANCE[^\n]*?\b(PASS|FAIL|APPROVE|REJECT)\b/i);
    if (acceptance) return `Acceptance ${acceptance[1].toUpperCase()}`;
  }
  return 'QA pending';
}

export function normalizeStandup(issues, { now = new Date(), maxPerCell = 10 } = {}) {
  const generatedAt = validDate(now)?.toISOString() || new Date().toISOString();
  const cutoff = new Date(new Date(generatedAt).getTime() - 24 * 60 * 60 * 1000);
  const agents = AGENT_DEFS.map(([name, initials]) => ({
    name,
    initials,
    columns: { yesterday: [], today: [], blockers: [] },
  }));
  const byName = new Map(agents.map(agent => [agent.name.toLowerCase(), agent]));
  const unresolvedCounts = new Map();
  let truncated = 0;

  for (const raw of Array.isArray(issues) ? issues : []) {
    const completedAt = validDate(raw?.completedAt);
    const stateName = String(raw?.state?.name || 'Unknown');
    const activeToday = /^(in progress|in review)$/i.test(stateName.trim());
    const blocker = blockerStatus(raw);
    const columns = [];
    if (completedAt && completedAt >= cutoff && completedAt <= new Date(generatedAt)) columns.push('yesterday');
    if (activeToday) columns.push('today');
    if (!completedAt && blocker) columns.push('blockers');
    if (!columns.length) continue;

    const attribution = resolveAttribution(raw);
    if (!attribution.agent) {
      const basis = attribution.basis || unresolvedBasis(raw);
      unresolvedCounts.set(basis, (unresolvedCounts.get(basis) || 0) + 1);
      continue;
    }

    const agent = byName.get(attribution.agent.toLowerCase());
    if (!agent) continue;

    for (const column of columns) {
      const item = normalizeItem(raw, attribution, column, blocker);
      if (agent.columns[column].length < maxPerCell) agent.columns[column].push(item);
      else truncated += 1;
    }
  }

  for (const agent of agents) {
    for (const items of Object.values(agent.columns)) {
      items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.issue.localeCompare(b.issue));
    }
  }

  return {
    state: 'ready',
    source: 'linear',
    generatedAt,
    freshness: `Linear · updated ${generatedAt}`,
    agents,
    unresolved: [...unresolvedCounts].map(([basis, count]) => ({ basis, count })),
    truncated,
  };
}

export async function fetchLinearStandup(apiKey, { fetchImpl = fetch, now = new Date() } = {}) {
  const response = await fetchImpl('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: LINEAR_QUERY, variables: { first: 100 } }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Linear HTTP ${response.status}`);
  if (!body || body.errors?.length || !Array.isArray(body.data?.issues?.nodes)) {
    const detail = body?.errors?.[0]?.message || 'malformed Linear response';
    throw new Error(detail);
  }
  return {
    ...normalizeStandup(body.data.issues.nodes, { now }),
    sourceTruncated: Boolean(body.data.issues.pageInfo?.hasNextPage),
  };
}

function resolveAttribution(issue) {
  const assignee = String(issue?.assignee?.displayName || issue?.assignee?.name || '').trim();
  const direct = canonicalAgent(assignee);
  if (direct) return { agent: direct, type: 'direct', basis: '' };

  const labels = issue?.labels?.nodes || [];
  const normalizedLabels = unique(labels
    .map(label => String(label?.name || '').trim().toLowerCase()));
  if (normalizedLabels.includes('agent-ops')) {
    return { agent: 'Smith', type: 'grouped', basis: 'agent-ops' };
  }
  const routeLabels = unique(labels
    .map(label => String(label?.name || '').trim().toLowerCase())
    .filter(label => /^route:/.test(label)));
  if (routeLabels.length === 1) {
    const route = routeLabels[0];
    const routedAgent = canonicalAgent(route.replace(/^route:/, ''));
    if (routedAgent) return { agent: routedAgent, type: 'direct', basis: '' };
    // The approved PRO-127 design establishes route:ops as Smith's grouped
    // operational area. It is intentionally grouped, not presented as an
    // assignee claim.
    if (route === 'route:ops') return { agent: 'Smith', type: 'grouped', basis: route };
  }

  const comments = issue?.comments?.nodes || [];
  const commentAgents = unique(comments.flatMap(comment => {
    const author = canonicalAgent(comment?.user?.displayName || comment?.user?.name);
    const body = String(comment?.body || '');
    const bodyMatches = AGENT_DEFS
      .map(([name]) => name)
      .filter(name => commentNamesAgent(body, name));
    return [...(author ? [author] : []), ...bodyMatches];
  }));
  if (commentAgents.length === 1) {
    return { agent: commentAgents[0], type: 'grouped', basis: `comment:${commentAgents[0]}` };
  }

  return { agent: null, type: 'grouped', basis: unresolvedBasis(issue) };
}

function normalizeItem(issue, attribution, column, blocker) {
  const attributionData = attribution.type === 'direct'
    ? { type: 'direct' }
    : { type: 'grouped', basis: attribution.basis };
  const state = String(issue?.state?.name || 'Unknown');
  const provenance = attribution.type === 'direct' ? 'Direct' : `Grouped by ${attribution.basis}`;
  return {
    issue: String(issue?.identifier || 'Linear'),
    title: String(issue?.title || '(untitled issue)'),
    quality: column === 'yesterday' ? extractQuality(issue?.comments?.nodes) : '',
    status: column === 'blockers' ? blocker : '',
    attribution: attributionData,
    note: `${state} · ${provenance}`,
    updatedAt: validDate(issue?.updatedAt)?.toISOString() || '',
  };
}

function blockerStatus(issue) {
  for (const label of issue?.labels?.nodes || []) {
    const normalized = String(label?.name || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (BLOCKER_LABELS.has(normalized)) return BLOCKER_LABELS.get(normalized);
  }
  return '';
}

function unresolvedBasis(issue) {
  const project = String(issue?.project?.name || '').trim();
  if (project) return `project:${project}`;
  const route = (issue?.labels?.nodes || []).map(label => String(label?.name || '').trim()).find(name => /^route:/i.test(name));
  if (route) return route.toLowerCase();
  return 'area:unattributed';
}

function canonicalAgent(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return AGENT_DEFS.find(([name]) => name.toLowerCase() === normalized)?.[0] || null;
}

function commentNamesAgent(body, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:\\[${escaped}\\]|\\(${escaped}\\)|^\\s*${escaped}\\s*:|route:${escaped}\\b|\\b${escaped}_(?:DONE|WAITING|FAILED|PASS)\\b)`, 'im').test(body);
}

function validDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
