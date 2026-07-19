# Deploy

The dashboard is hosted on **Cloudflare Pages**, auto-deployed from the `main` branch of [tmoots50/smart-home-dashboard](https://github.com/tmoots50/smart-home-dashboard).

## One-time Cloudflare Pages setup

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize the GitHub app for `tmoots50` and pick `smart-home-dashboard`.
3. Build configuration:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `app`
   - **Node version:** `22` (set under **Environment variables** as `NODE_VERSION=22`)
4. Save and deploy. First build takes ~1 minute.

After the first deploy, Cloudflare assigns a `*.pages.dev` URL. Optional: bind a custom domain under **Custom domains**.

## How the dashboard loads on the tablet

The Meswao tablet runs **Fully Kiosk Browser** pointed at the Cloudflare Pages URL. Useful URL params the dashboard reads:

| Param | Effect |
|-------|--------|
| `?kiosk=1` | Locks scrolling and hides any dev-only affordances. Always set in production. |
| `?theme=…` | **Dev preview only.** Forces a theme (`fun` light / `cosy` dark) — but only when `?kiosk=1` is *absent*. In kiosk mode it's ignored so the auto schedule + toggle own the theme (see below). |
| `?scale=0.6` | Shrinks the whole UI proportionally (multiplies root font-size). Useful when a tablet's CSS viewport is small but the physical display is large. |
| `?lat=…&lon=…&location=…` | Override the default Atlanta weather location. |

Example Fully Kiosk start URL: `https://dashboard.pages.dev/?kiosk=1`.

### Light / dark mode (auto + manual)

The dashboard themes itself **automatically by the sun**: `fun` (warm light)
between sunrise and sunset for ZIP 30324, `cosy` (warm dark) overnight. Sun
times are computed locally (`app/src/lib/suntimes.js`) — no API call — and
re-checked every minute, so the wall crosses sunrise/sunset without a reload.

The **leftmost action-bar button** (sun/moon) manually flips light↔dark. A tap
**overrides the auto schedule until the next sun event**, then auto resumes —
so you can force dark for movie night without permanently disabling the
schedule. The choice persists across reloads (localStorage), so **no URL edit
is ever needed**. A previously pinned `?theme=fun` in the start URL is now a
harmless no-op in kiosk mode; you can leave it or drop it.

## Promoting from preview to production

Cloudflare Pages auto-deploys every push to `main` to the production URL, and every other branch to a unique preview URL. There is no separate promotion step — branch protection on `main` is the only gate.

## Rollback

The CF Pages dashboard keeps every build. **Workers & Pages → smart-home-dashboard → Deployments → … → Rollback to this deployment.**

## Local preview of the production build

```bash
cd app
npm run build
npm run preview     # http://localhost:4173
```

This is what the tablet sees, modulo the Cloudflare CDN edge. Useful for sanity-checking before pushing.
