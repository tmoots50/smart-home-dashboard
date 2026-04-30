// Mock message-of-the-day. Real source: a JSON file Tim edits over SSH
// (or a tiny push endpoint, deferred). Returns null when nothing's set.

export function getMockMessage() {
  return {
    quote: 'You don’t need to be cheerful — you just need to show up.',
    from: 'Tim',
  };
}
