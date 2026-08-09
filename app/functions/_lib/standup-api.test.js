// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractQuality, fetchLinearStandup, normalizeStandup } from './standup-api.js';

const NOW = new Date('2026-08-09T12:00:00.000Z');

function issue(overrides = {}) {
  return {
    identifier: 'PRO-100',
    title: 'Default issue',
    completedAt: null,
    updatedAt: '2026-08-09T10:00:00.000Z',
    state: { name: 'In Progress', type: 'started' },
    assignee: null,
    project: { name: 'Smart Home Dashboard' },
    labels: { nodes: [] },
    comments: { nodes: [] },
    ...overrides,
  };
}

describe('normalizeStandup', () => {
  it('returns five stable agent rows and classifies direct yesterday/today/blocker work', () => {
    const payload = normalizeStandup([
      issue({
        identifier: 'PRO-101',
        title: 'Finished adapter',
        completedAt: '2026-08-09T08:00:00.000Z',
        state: { name: 'Done', type: 'completed' },
        assignee: { name: 'Derek' },
        comments: { nodes: [{ body: 'QA verdict: **PASS** — regression clean.' }] },
      }),
      issue({
        identifier: 'PRO-102',
        title: 'Review matrix',
        assignee: { name: 'Mo' },
        state: { name: 'In Review', type: 'started' },
      }),
      issue({
        identifier: 'PRO-103',
        title: 'Awaiting wall review',
        assignee: { name: 'Sam' },
        labels: { nodes: [{ name: 'awaiting-tim' }] },
      }),
    ], { now: NOW });

    expect(payload.agents.map(agent => agent.name)).toEqual(['Nigel', 'Derek', 'Mo', 'Smith', 'Sam']);
    expect(payload.agents[1].columns.yesterday[0]).toMatchObject({ issue: 'PRO-101', quality: 'QA PASS', attribution: { type: 'direct' } });
    expect(payload.agents[2].columns.today[0]).toMatchObject({ issue: 'PRO-102' });
    expect(payload.agents[4].columns.blockers[0]).toMatchObject({ issue: 'PRO-103', status: 'Awaiting Tim' });
  });

  it('uses route evidence without claiming direct ownership and reports unresolved grouping', () => {
    const payload = normalizeStandup([
      issue({ identifier: 'PRO-104', title: 'Routed ops work', labels: { nodes: [{ name: 'route:ops' }] } }),
      issue({ identifier: 'PRO-106', title: 'Explicit Derek route', labels: { nodes: [{ name: 'route:derek' }] } }),
      issue({ identifier: 'PRO-105', title: 'Unattributed project work' }),
    ], { now: NOW });

    expect(payload.agents[3].columns.today[0]).toMatchObject({
      issue: 'PRO-104',
      attribution: { type: 'grouped', basis: 'route:ops' },
    });
    expect(payload.agents[1].columns.today[0]).toMatchObject({ issue: 'PRO-106', attribution: { type: 'direct' } });
    expect(payload.unresolved).toEqual([{ basis: 'project:Smart Home Dashboard', count: 1 }]);
  });

  it('groups Smith agent-ops work and parenthesized Mo comment evidence without claiming assignees', () => {
    const payload = normalizeStandup([
      issue({ identifier: 'PRO-OPS', labels: { nodes: [{ name: 'agent-ops' }] } }),
      issue({
        identifier: 'PRO-DESIGN',
        comments: { nodes: [{ body: 'FRONT-END REQUIREMENTS (Mo): fixed matrix.' }] },
      }),
    ], { now: NOW });

    expect(payload.agents[3].columns.today[0]).toMatchObject({
      issue: 'PRO-OPS',
      attribution: { type: 'grouped', basis: 'agent-ops' },
    });
    expect(payload.agents[2].columns.today[0]).toMatchObject({
      issue: 'PRO-DESIGN',
      attribution: { type: 'grouped', basis: 'comment:Mo' },
    });
  });

  it('excludes completions older than 24 hours and caps every cell payload', () => {
    const old = issue({ identifier: 'PRO-OLD', completedAt: '2026-08-08T11:59:59.000Z', state: { name: 'Done', type: 'completed' }, assignee: { name: 'Nigel' } });
    const active = Array.from({ length: 14 }, (_, index) => issue({ identifier: `PRO-${200 + index}`, assignee: { name: 'Nigel' } }));
    const payload = normalizeStandup([old, ...active], { now: NOW, maxPerCell: 10 });

    expect(payload.agents[0].columns.yesterday).toEqual([]);
    expect(payload.agents[0].columns.today).toHaveLength(10);
    expect(payload.truncated).toBe(4);
  });

  it('does not report unrelated backlog issues as unresolved standup work', () => {
    const payload = normalizeStandup([
      issue({
        identifier: 'PRO-BACKLOG',
        state: { name: 'Backlog', type: 'backlog' },
      }),
    ], { now: NOW });

    expect(payload.unresolved).toEqual([]);
  });
});

describe('fetchLinearStandup', () => {
  it('marks the payload when Linear has more than the fetched 100 issues', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      data: {
        issues: {
          nodes: [],
          pageInfo: { hasNextPage: true },
        },
      },
    }), { status: 200 });

    const payload = await fetchLinearStandup('linear-key', { fetchImpl, now: NOW });

    expect(payload.sourceTruncated).toBe(true);
  });
});

describe('extractQuality', () => {
  it('returns only observed verdicts and otherwise stays QA pending', () => {
    expect(extractQuality([{ body: 'SAM_PASS — release checks clean.' }])).toBe('Sam PASS');
    expect(extractQuality([{ body: 'DESIGN PASS — fixed matrix approved.' }])).toBe('Design PASS');
    expect(extractQuality([{ body: 'No verdict has landed yet.' }])).toBe('QA pending');
  });

  it('uses the newest observed verdict instead of preserving an obsolete failure', () => {
    expect(extractQuality([
      { body: 'QA verdict: FAIL', createdAt: '2026-08-09T10:00:00.000Z' },
      { body: 'QA verdict: PASS', createdAt: '2026-08-09T11:00:00.000Z' },
    ])).toBe('QA PASS');
  });
});
