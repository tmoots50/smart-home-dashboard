export function getMockStandup() {
  return {
    freshness: 'Demo data · 8:42 AM',
    state: 'ready',
    source: 'demo',
    unresolved: [],
    truncated: 0,
    sourceTruncated: false,
    agents: [
      agent('Nigel', 'NI', {
        yesterday: [item('PRO-124', 'Accepted calendar cleanup', { quality: 'QA A', note: 'Acceptance passed with no follow-up.' })],
        today: [item('PRO-127', 'Orchestrate handoff', { note: 'In Progress · directly attributed by assignee and triage comment.' })],
        blockers: [],
      }),
      agent('Derek', 'DE', {
        yesterday: [item('PRO-123', 'Shipped live overview docs', { quality: 'QA A', note: 'Sam verdict: PASS. Build and regressions clean.' })],
        today: [item('PRO-128', 'Linear standup adapter', { note: 'In Progress · direct Linear assignee.' })],
        blockers: [item('INPUT', 'API field decision', { status: 'Awaiting input', note: 'Awaiting input on the quality payload shape.' })],
      }),
      agent('Mo', 'MO', {
        yesterday: [item('PRO-125', 'Calendar design verdict', { quality: 'QA A−', note: 'Design pass; one density note recorded.' })],
        today: [item('PRO-127', 'Standup directions', { note: 'In Progress · design direction and requirements.' })],
        blockers: [],
      }),
      agent('Smith', 'SM', {
        yesterday: [
          item('PRO-119', 'Agent routing repair', { quality: 'QA B+', groupedBy: 'route:ops', note: 'Grouped by route:ops because no clean assignee existed.' }),
          item('PRO-118', 'Fallback attribution sweep', { quality: 'QA pending', groupedBy: 'route:ops', note: 'Grouped by route:ops from the same operational area.' }),
          item('PRO-117', 'Routing labels repair', { quality: 'QA pending', groupedBy: 'route:ops', note: 'Grouped by route:ops from the same operational area.' }),
        ],
        today: [
          item('PRO-126', 'Skill health audit', { groupedBy: 'route:ops', note: 'Grouped by route:ops · attribution is intentionally explicit.' }),
          item('PRO-130', 'Ops backlog grooming', { groupedBy: 'route:ops', note: 'Grouped by route:ops because no clean assignee existed.' }),
        ],
        blockers: [],
      }),
      agent('Sam', 'SA', {
        yesterday: [item('PRO-123', 'Release review', { quality: 'PASS', note: 'Verdict PASS · no regression findings.' })],
        today: [item('PRO-127', 'Prepare release checks', { note: 'In Review · regression plan drafted.' })],
        blockers: [item('TIM', 'Wall screenshot pending', { status: 'Awaiting Tim', note: 'Awaiting Tim · real-device evidence is not available yet.' })],
      }),
    ],
  };
}

function agent(name, initials, columns) {
  return { name, initials, columns };
}

function item(issue, title, opts = {}) {
  return {
    issue,
    title,
    quality: opts.quality || '',
    status: opts.status || '',
    attribution: opts.groupedBy ? { type: 'grouped', basis: opts.groupedBy } : { type: 'direct' },
    note: opts.note || '',
  };
}
