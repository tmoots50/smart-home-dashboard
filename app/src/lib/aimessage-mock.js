// Mock message from the family AI assistant. Real source: a periodic call to
// Claude (or a Pi-side daemon) that composes a short household-aware note based
// on calendar, Mabel data, weather, etc. Refreshes on a heartbeat — every N min,
// or pushed when state changes meaningfully.

export function getMockAiMessage(now = new Date()) {
  return {
    text: 'Mabel’s on a nursing roll today — 5 of 7 feeds so far. You and Caroline have crushed it.',
    sentAt: new Date(now.getTime() - 7 * 60_000).toISOString(),
    source: 'Jarvis',
  };
}
