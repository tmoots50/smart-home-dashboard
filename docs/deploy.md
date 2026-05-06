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
| `?theme=fun` | Swaps the editorial dark theme for the warm light variant. |
| `?scale=0.6` | Shrinks the whole UI proportionally (multiplies root font-size). Useful when a tablet's CSS viewport is small but the physical display is large. |
| `?lat=…&lon=…&location=…` | Override the default Atlanta weather location. |

Example Fully Kiosk start URL: `https://dashboard.pages.dev/?kiosk=1&theme=fun`.

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
