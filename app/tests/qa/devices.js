// Device profiles the QA harness renders and measures against. Each entry
// becomes a Playwright project in playwright.config.js, so every spec runs
// once per profile.
//
// `canvas` is the CSS design contract: portrait 1080×1920 (global.css pins
// .briefing to max-width:1080px). It answers "does the layout honor its own
// stylesheet?".
//
// `tablet` is the production wall device — Meswao B3 in Fully Kiosk. Its CSS
// viewport is NOT 1080×1920; production reconciles the difference with a
// ?scale= param in the kiosk start URL (see main.js). It answers "does the
// layout survive what the wall actually renders?". Bugs hide in the gap
// between the two.
//
// To fill in `tablet`: load the deployed dashboard on the wall tablet with
// &probe=1 appended to the kiosk URL, copy the numbers it displays, and set
// `query` to the ?scale= value from the production start URL.
export const profiles = {
  canvas: {
    name: 'canvas',
    use: {
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
      hasTouch: true,
    },
    query: '', // canvas is the unscaled design contract — no ?scale=
  },

  // TODO(Tim): read these off the wall tablet via ?probe=1, then uncomment.
  // tablet: {
  //   name: 'tablet',
  //   use: {
  //     viewport: { width: 0 /* innerWidth */, height: 0 /* innerHeight */ },
  //     deviceScaleFactor: 0 /* dpr */,
  //     hasTouch: true,
  //   },
  //   query: '&scale=0.6', // must match the production kiosk start URL
  // },
};
