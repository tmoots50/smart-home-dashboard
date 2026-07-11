// State fixtures for the in-app article overlay (article-overlay.js).
// URLs are same-origin stubs under public/qa/ so the harness never touches
// the network: article-stub.html paints an opaque background (framed article
// covers the hint); article-blank.html stays transparent (what a frame-refused
// site looks like — the hint shows through).
export const states = {
  typical: {
    url: '/qa/article-stub.html',
    source: 'Atlanta Magazine',
    title: 'Best patios in Atlanta',
  },
  blocked: {
    url: '/qa/article-blank.html',
    source: 'On the Cheap',
    title: 'Free & cheap things to do this weekend',
  },
  'long-source': {
    url: '/qa/article-stub.html',
    source: 'The Atlanta Journal-Constitution Weekend Guide Extended Metropolitan Edition',
    title: 'A very long source label must truncate, not wrap the header',
  },
};
