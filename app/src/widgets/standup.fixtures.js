import { getMockStandup } from '../lib/standup-mock.js';

const typical = getMockStandup();
const mapAgents = (transform) => typical.agents.map(agent => ({
  ...agent,
  columns: transform(agent.columns, agent),
}));

const empty = {
  state: 'ready',
  source: 'demo',
  freshness: 'Demo data · no updates',
  agents: mapAgents(() => ({ yesterday: [], today: [], blockers: [] })),
};

export const states = {
  typical,
  grouped: typical,
  dense: typical,
  empty,
  'all-clear': {
    ...typical,
    freshness: 'Demo data · all blockers clear',
    agents: mapAgents(columns => ({ ...columns, blockers: [] })),
  },
  'no-updates': empty,
  'qa-pending': {
    ...typical,
    freshness: 'Demo data · QA pending',
    agents: mapAgents((columns, agent) => ({
      ...columns,
      yesterday: columns.yesterday.map((item, index) => (
        agent.name === 'Derek' && index === 0 ? { ...item, quality: '' } : item
      )),
    })),
  },
  loading: {
    state: 'loading',
    freshness: 'Linear · loading',
    message: 'Loading Linear standup…',
    agents: [],
  },
  stale: {
    ...typical,
    state: 'stale',
    source: 'linear',
    freshness: 'Linear · stale since 8:42 AM',
    message: 'Live Linear is unavailable; showing last-known data.',
    agents: typical.agents,
  },
  unavailable: {
    state: 'unavailable',
    source: 'linear',
    freshness: 'Linear · unavailable',
    message: 'Linear standup is not configured.',
    agents: [],
  },
  truncated: {
    ...typical,
    freshness: 'Linear · partial coverage',
    truncated: 3,
    sourceTruncated: true,
    unresolved: [{ basis: 'project:Smart Home Dashboard', count: 2 }],
  },
};

states.error = states.unavailable;
