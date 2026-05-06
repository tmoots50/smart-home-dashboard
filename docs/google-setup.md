# Google setup — Photos + Tasks

The dashboard reads from your Google Photos shared album and your Google Tasks lists via two CF Pages Functions:

- `/api/photos` — proxies Google Photos Library API
- `/api/tasks/[list]` and `/api/tasks/[list]/strike` — proxies Google Tasks API

Both Functions use a single OAuth refresh token for your Google account, stored in CF Pages env vars (server-side, never in the browser bundle). The dashboard hits the Functions with a shared bearer token.

This is a **one-time setup**. After it's done, deploys are just `git push`.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. **Create project** → name it `smart-home-dashboard` (or similar).
3. **APIs & Services → Library**, enable:
   - **Google Photos Library API**
   - **Google Tasks API**

## 2. Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. **User type:** External (this is a personal-use app).
3. App name: `Smart Home Dashboard`. App logo + support email: skip / your email.
4. **Scopes**, add:
   - `https://www.googleapis.com/auth/photoslibrary.readonly`
   - `https://www.googleapis.com/auth/tasks`
5. **Test users**, add: your Google account email (and Caroline's, if she should also be able to grant). Test mode is fine — no public verification needed for personal use.

## 3. Create OAuth client credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. **Application type:** Desktop app.
3. Save the **Client ID** + **Client secret**.

(Why Desktop instead of Web app? Desktop clients support an out-of-band redirect that lets us mint a refresh token from the laptop without standing up a real redirect URL anywhere.)

## 4. Mint a refresh token

This is the one-time interactive part. We use the OAuth 2.0 device-code-style flow on your laptop.

```bash
# Your client ID + secret from step 3:
export CID="your-client-id.apps.googleusercontent.com"
export CSECRET="your-client-secret"
export SCOPES="https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/tasks"

# Step a — open the consent URL in a browser and grant access:
echo "https://accounts.google.com/o/oauth2/v2/auth?client_id=$CID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ["SCOPES"]))')&access_type=offline&prompt=consent"

# Open the URL it printed. After granting, Google shows you an auth code.
# Copy it.

# Step b — exchange the auth code for a refresh token:
export AUTH_CODE="paste-the-code-here"
curl -s -d "client_id=$CID" -d "client_secret=$CSECRET" -d "code=$AUTH_CODE" -d "grant_type=authorization_code" -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" https://oauth2.googleapis.com/token
```

The response is a JSON blob containing a `refresh_token`. **Save it.** This is the long-lived credential the Functions will use to mint access tokens automatically forever.

> **Important:** Google only returns `refresh_token` on the FIRST exchange after consent. If you ever lose it, revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and re-do step 4.

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

## 6. Find your Google Photos album ID

Same pattern:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" "https://your-app.pages.dev/api/photos?_lists=1"
```

Returns:

```json
{ "albums": [{ "id": "AKq...", "title": "Mabel — Year One", "count": 87 }] }
```

Note the `id` for the family album you want to display.

## 7. Set Cloudflare Pages env vars

In the CF Pages dashboard → your project → **Settings → Environment variables → Production**:

| Name | Value |
|------|-------|
| `DASHBOARD_TOKEN` | Random string (`openssl rand -hex 32`). MUST match `VITE_DASHBOARD_TOKEN` below. |
| `GOOGLE_CLIENT_ID` | From step 3 |
| `GOOGLE_CLIENT_SECRET` | From step 3 |
| `GOOGLE_REFRESH_TOKEN` | From step 4 |
| `GOOGLE_PHOTOS_ALBUM_ID` | From step 6 |
| `GOOGLE_TASKS_LIST_TODOS_ID` | From step 5 |
| `GOOGLE_TASKS_LIST_GROCERIES_ID` | From step 5 |
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
- **502 "photos search 403"** — scope missing or album access lost. Re-grant scopes (step 2 / step 4 again).
- **Empty photos / tasks** — wrong album ID / list ID. Re-run discovery (steps 5-6).

## Token rotation

To rotate the OAuth credentials (e.g. someone saw `GOOGLE_REFRESH_TOKEN`):

1. Revoke at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
2. Re-run step 4 to mint a new refresh token.
3. Update CF Pages env var, redeploy.

To rotate `DASHBOARD_TOKEN`:

1. Generate a new token: `openssl rand -hex 32`.
2. Update both `DASHBOARD_TOKEN` and `VITE_DASHBOARD_TOKEN` in CF Pages.
3. Redeploy. Old tablets re-fetch the bundle on next reload and pick up the new token.
