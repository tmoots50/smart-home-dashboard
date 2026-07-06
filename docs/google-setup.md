# Google setup — Drive (photos) + Tasks (lists) + Calendar (events)

The dashboard reads photos from a Google Drive folder, shared lists from Google Tasks, and events from Google Calendar via four CF Pages Functions:

- `/api/photos` — lists images in the configured Drive folder
- `/api/photos/[id]` — proxies image bytes (Drive files aren't browser-fetchable without OAuth)
- `/api/tasks/[list]` and `/api/tasks/[list]/strike` — proxies Google Tasks API
- `/api/calendar` — fetches today's events across configured calendars

> **Why Drive instead of Google Photos?** Google deprecated the `photoslibrary.readonly` scope on 2025-03-31. Third-party apps can no longer read user-curated photo albums via the Photos Library API — Google's replacement (Picker API) requires a human to interactively pick photos per session. For an ambient dashboard, Drive is the stable alternative: drop photos into a Drive folder, dashboard pulls them.

Both Functions use a single OAuth refresh token for your Google account, stored in CF Pages env vars (server-side, never in the browser bundle). The dashboard hits the Functions with a shared bearer token.

This is a **one-time setup**. After it's done, deploys are just `git push`.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. **Create project** → name it `smart-home-dashboard` (or similar).
3. **APIs & Services → Library**, enable:
   - **Google Drive API**
   - **Google Tasks API**
   - **Google Calendar API**

## 2. Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. **User type:** External (this is a personal-use app).
3. App name: `Smart Home Dashboard`. App logo + support email: skip / your email.
4. **Scopes**, add:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/calendar.readonly`
5. **Test users**, add: your Google account email (and Caroline's, if she should also be able to grant).
6. **⚠️ Publish the app.** On the OAuth consent screen (a.k.a. "Google Auth Platform → Audience"), set **Publishing status → In production** (click **Publish app** and accept the confirmation). Do **not** leave it in **Testing**.

   > **Why this matters — the single most important step in this doc.** In **Testing** status Google expires the refresh token after **7 days**. Everything works for a week, then `getAccessToken()` starts returning `invalid_grant` and the dashboard silently falls back to mock data (calendar, todos, groceries, and photos all die at once, since they share one token). This bit us for ~7 weeks in May–June 2026. **In production** status, the refresh token does not expire on the 7-day clock.
   >
   > For a single-user personal app using only *sensitive* (not *restricted*) scopes — `drive.readonly`, `tasks`, `calendar.readonly` — publishing does **not** require Google's verification review. You'll see a one-time "Google hasn't verified this app" screen during consent; click **Advanced → Go to Smart Home Dashboard (unsafe)** to proceed. That's expected for an unverified personal app and is fine here.
   >
   > If the token ever dies again with `invalid_grant`, confirm publishing status is still **In production**, then re-mint (Step 4) and update `GOOGLE_REFRESH_TOKEN`.

## 3. Create OAuth client credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. **Application type:** Desktop app.
3. Save the **Client ID** + **Client secret**.

(Why Desktop instead of Web app? Desktop clients support an out-of-band redirect that lets us mint a refresh token from the laptop without standing up a real redirect URL anywhere.)

## 4. Mint a refresh token

One-time interactive flow. Use the helper script:

```bash
node scripts/mint-google-token.mjs
```

It prompts for the Client ID + Client Secret from step 3, prints the consent URL, asks you to paste the auth code Google shows after you grant access, then prints all the env-var values you need (in copy-pasteable format) for the next step.

> **Important:** Google only returns `refresh_token` on the FIRST exchange after consent. If you ever lose it, revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and re-run the script.

## 5. Find your Google Tasks list IDs

Once the dashboard is deployed (or with the Function running locally via `wrangler pages dev`), hit the discovery endpoint:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" https://your-app.pages.dev/api/tasks/_lists
```

Returns:

```json
{ "lists": [{ "id": "MTk1...", "title": "My Tasks" }, { "id": "Mjc4...", "title": "Groceries" }] }
```

Note the `id` for the list you want to use as **Todos** and the one for **Groceries**. Create them in the Google Tasks app first if they don't exist.

## 5b. Find your Google Calendar IDs

Same pattern, different endpoint:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" "https://your-app.pages.dev/api/calendar?_lists=1"
```

Returns:

```json
{ "calendars": [
  { "id": "primary", "summary": "tim.moots@gmail.com", "primary": true, "accessRole": "owner" },
  { "id": "abc123@group.calendar.google.com", "summary": "Family", "accessRole": "owner" },
  { "id": "def456@group.calendar.google.com", "summary": "Caroline (work)", "accessRole": "reader" }
]}
```

Pick the calendars you want to surface and shape them into a JSON array for the env var (see step 7). The `label` is what shows on the dashboard ("Family", "Tim (Work)", "Caroline (Work)") and is independent of Google's `summary`.

## 6. Find your Drive photos folder ID

Same pattern:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" "https://your-app.pages.dev/api/photos?_lists=1"
```

Returns:

```json
{ "folders": [{ "id": "1AbC...", "name": "Dashboard Photos" }, ...] }
```

Note the `id` of the folder you dropped photos in.

## 7. Set Cloudflare Pages env vars

In the CF Pages dashboard → your project → **Settings → Environment variables → Production**:

| Name | Value |
|------|-------|
| `DASHBOARD_TOKEN` | Random string (`openssl rand -hex 32`). MUST match `VITE_DASHBOARD_TOKEN` below. |
| `GOOGLE_CLIENT_ID` | From step 3 |
| `GOOGLE_CLIENT_SECRET` | From step 3 |
| `GOOGLE_REFRESH_TOKEN` | From step 4 |
| `GOOGLE_DRIVE_PHOTOS_FOLDER_ID` | From step 6 |
| `GOOGLE_TASKS_LIST_TODOS_ID` | From step 5 |
| `GOOGLE_TASKS_LIST_GROCERIES_ID` | From step 5 |
| `GOOGLE_CALENDARS_JSON` | JSON array shaped like `[{"label":"Family","id":"abc@group.calendar.google.com"},{"label":"Tim (Work)","id":"primary"}]`. From step 5b. |
| `ALLOW_ORIGIN` | Comma-separated origins for CORS, e.g. `https://your-app.pages.dev,http://localhost:5173` |
| `VITE_DASHBOARD_TOKEN` | **Same string as `DASHBOARD_TOKEN`** — this one ships in the client bundle so the dashboard sends it on every request. |

Mark `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and the tokens as **encrypted** in CF Pages — they're shown as ●●● after save and never re-displayed.

Deploy / redeploy. Dashboard should now fetch real data.

## 8. Local dev

Add the same vars to `app/.env.local` (gitignored):

```bash
VITE_DASHBOARD_TOKEN=same-as-prod
```

The Vite app reads `VITE_DASHBOARD_TOKEN` and sends it to `/api/...`. To run the Functions locally too, use Wrangler:

```bash
cd app
npx wrangler pages dev dist --compatibility-date=2024-01-01
```

(In dev, you need a separate `.dev.vars` file for the server-side env vars Wrangler reads. See Wrangler docs.)

## Troubleshooting

- **401 from /api/...** — `DASHBOARD_TOKEN` (server) doesn't match `VITE_DASHBOARD_TOKEN` (bundle). Check both, redeploy.
- **500 "GOOGLE_*" not set** — env var missing in CF Pages. Re-check spelling, redeploy.
- **502 "google token refresh"** — refresh token expired or revoked. Re-do step 4.
- **502 "drive list 403"** — scope missing or folder access lost. Re-grant scopes (step 2 / step 4 again).
- **502 "calendar … 403"** — `calendar.readonly` scope wasn't granted at the latest token mint. Re-run step 4 to mint a fresh refresh token with the calendar scope included.
- **500 "GOOGLE_CALENDARS_JSON not set or empty"** — env var missing or malformed JSON. Hit `/api/calendar?_lists=1` to discover IDs, then set the env var as a JSON array.
- **Empty photos / tasks / calendar** — wrong album ID / list ID / calendar ID. Re-run discovery (steps 5, 5b, 6).

## Token rotation

To rotate the OAuth credentials (e.g. someone saw `GOOGLE_REFRESH_TOKEN`):

1. Revoke at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
2. Re-run step 4 to mint a new refresh token.
3. Update CF Pages env var, redeploy.

To rotate `DASHBOARD_TOKEN`:

1. Generate a new token: `openssl rand -hex 32`.
2. Update both `DASHBOARD_TOKEN` and `VITE_DASHBOARD_TOKEN` in CF Pages.
3. Redeploy. Old tablets re-fetch the bundle on next reload and pick up the new token.
