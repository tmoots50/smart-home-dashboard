# Active handoff — 2026-05-06

State of the deployment when this session ended. Read this first when picking up the CF Pages debugging.

## What's deployed

- Repo on `main` at `5d57386` (latest push).
- Cloudflare Pages project `smart-home-dashboard` connected to GitHub. Latest build passing.
- URL: `smart-home-dashboard.pages.dev` (or whatever CF assigned — Tim has it).
- All Google APIs enabled, OAuth refresh token minted with `drive.readonly + tasks + calendar.readonly` scopes.

## The active blocker

**Pages Functions return 500 `{"error":"server misconfigured: DASHBOARD_TOKEN unset"}` on every API call.**

The Function code:
```js
// app/functions/_lib/auth.js
if (!env.DASHBOARD_TOKEN) {
  return new Response(... 'DASHBOARD_TOKEN unset' ..., { status: 500 });
}
```

That error fires when `context.env.DASHBOARD_TOKEN` is undefined inside the Function. Means env vars aren't reaching the runtime.

### What's already been tried (don't repeat)

- ✅ Confirmed all 11 env vars are set in CF dashboard → Settings → Variables and Secrets (screenshot saved Tim's terminal). Names: `ALLOW_ORIGIN`, `DASHBOARD_TOKEN`, `GOOGLE_CALENDARS_JSON`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_PHOTOS_FOLDER_ID`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_TASKS_LIST_GROCERIES_ID`, `GOOGLE_TASKS_LIST_TODOS_ID`, `NODE_VERSION`, `VITE_DASHBOARD_TOKEN`. All Plaintext type.
- ✅ Retried deployment from CF UI — didn't fix.
- ✅ Pushed empty commit to force fresh deploy — didn't fix.
- ❌ "Bindings" section in Settings is for KV/D1/R2/etc. resources only — not plain env vars.
- ❌ "Runtime" section in Settings is for placement/compatibility, no env-var input.
- ✅ Last attempt before handoff: pushed `app/wrangler.jsonc` declaring `pages_build_output_dir` + `nodejs_compat`. CF was previously logging "No Wrangler configuration file found" — now it'll find one. Tim hasn't reported the result of that build yet.

### Likely next things to try (in order)

1. **Check the build log for the wrangler.jsonc deploy.** Does it now say "Found Wrangler configuration"? Did the build succeed? Are env vars reaching Functions? Tim hits `/api/tasks/todos` to check.

2. **If still failing:** click the "Pages configuration" link in the left sidebar of Settings (has external-arrow icon). This goes to legacy Pages-specific settings — it may have a SEPARATE env vars section that the new merged Workers+Pages UI hides.

3. **If that's empty too:** the new CF Pages with the Workers-under-the-hood model may require env vars to be set via `wrangler.jsonc` `[vars]` block (with values committed to repo — bad for secrets) OR via `wrangler secret put` CLI for each secret. This is the documented "Workers + Static Assets" pattern.

4. **Last resort:** restructure as a Workers project (not Pages). The `app/functions/api/` files would consolidate into a single `worker.js` entry that routes manually + uses `assets` binding to serve `dist/`. Bigger refactor, but matches CF's current direction.

## Recent project decisions worth knowing

- 2026-05-05: Pivoted hardware from Pi+cocopar to Meswao Android tablet + Fully Kiosk Browser + CF Pages hosting. Pi will eventually run Home Assistant.
- 2026-05-06 (morning): Built Apple Notes iNote bridge for Old Mac. Dropped same day when Tim ruled out Old Mac dependency. Bridge code moved to `openclaw-setup/bridges/inote/`.
- 2026-05-06 (afternoon): Pivoted photos from Apple Photos / iCloud / Google Photos to **Google Drive** (Photos Library API was deprecated 2025-03-31). Tim's family album lives in a Drive folder named "Mabel Eloise".
- 2026-05-06: Switched todos+groceries from Apple Notes to **Google Tasks** (Caroline migrating apps).
- 2026-05-06: A parallel Claude agent added Google Calendar wiring (calendar.readonly scope, /api/calendar Function, calendar.js client + widget).
- 2026-05-06: Vite bumped 5→7 to fix CF Pages npm ci EBADPLATFORM error caused by stale esbuild platform deps.
- 2026-05-06: Added `app/.npmrc` pinning `registry=https://registry.npmjs.org/` because Tim's global npm registry points to Narvar Artifactory (work, unreachable from CF).

## Architecture summary

```
Meswao tablet (Fully Kiosk Browser)
    │
    │ HTTPS GET https://smart-home-dashboard.pages.dev/?kiosk=1
    │                  │
    │                  ▼
    │       Cloudflare Pages (static assets from app/dist/)
    │                  │
    │                  │ + dashboard.js fetches /api/* with Bearer DASHBOARD_TOKEN
    │                  ▼
    └──────▶ CF Pages Functions (app/functions/api/)
                       │
                       │ uses GOOGLE_* env vars to mint Google access token
                       ▼
                Google APIs (Drive, Tasks, Calendar)
```

## Key files

- `docs/google-setup.md` — full one-time Google Cloud setup runbook (Tim mostly done; needs to verify all env vars configured)
- `scripts/mint-google-token.mjs` — interactive OAuth refresh-token mint with grant-vs-requested scope check
- `scripts/discover-google-ids.mjs` — lists Drive folders, Tasks lists, Calendars after auth
- `app/functions/api/photos.js` + `app/functions/api/photos/[id].js` — Drive photos endpoints
- `app/functions/api/tasks/[list].js` + `[list]/strike.js` — Google Tasks endpoints
- `app/functions/api/calendar.js` — Google Calendar endpoint (parallel-agent work)
- `app/functions/_lib/google-auth.js` — refresh-token → access-token cache
- `app/functions/_lib/auth.js` — bearer token gate (the function returning the 500 right now)
- `app/wrangler.jsonc` — newly added in last commit to try to force binding
