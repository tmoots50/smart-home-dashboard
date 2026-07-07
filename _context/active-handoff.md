# ⚠️ OPEN 2026-07-02 — Google data layer down (expired refresh token)

Live check of the deployed dashboard (2026-07-02): the Google-backed `/api/*`
endpoints return 500.
- `/api/calendar`, `/api/tasks/todos`, `/api/tasks/groceries`, `/api/photos` →
  `google token refresh 400: invalid_grant / Bad Request`. Shared root cause:
  the Google OAuth **refresh token is dead**. The OAuth consent screen was left
  in **Testing** status, whose refresh tokens expire after **7 days** — so the
  Google data layer has been silently serving mock since ~mid-May.
- `/api/headlines` → 200 (no Google dependency; the only healthy one).

*(`/api/mabel` was retired 2026-07-07 when Huckleberry was removed from scope —
see decision log. It was never live in prod anyway.)*

Auth passes (500 not 401) → `DASHBOARD_TOKEN` is present server-side; this is
NOT a repeat of the 2026-05-06 env-var drop below.

**Fix (Tim-in-loop):** (1) publish OAuth app to Production [permanent fix — stops
the 7-day expiry]; (2) revoke old grant at myaccount.google.com/permissions;
(3) re-run `scripts/mint-google-token.mjs` (needs GOOGLE_CLIENT_ID/SECRET, still
valid — pull from CF env or .envrc.local); (4) set new `GOOGLE_REFRESH_TOKEN` on
CF Pages (Production scope); (5) redeploy; (6) verify endpoints 200.
Durable prevention already landed: `docs/google-setup.md` Step 2.6 + comment in
`mint-google-token.mjs` now require publishing the app.

Also note: `.envrc.local` is MISSING on Tim's Mac as of this session — recreate
it (CF API token + Google client id/secret) before running the CF/env scripts.

---

# CF Pages env-var blocker — resolved 2026-05-06

The 500 `DASHBOARD_TOKEN unset` error is fixed. End-to-end Functions auth path
works (Functions return 401 without bearer, real responses with bearer).

## What it actually was — two compounding bugs

1. **Production env_vars were empty in the CF dashboard.** The 11 vars only ever
   lived on the Preview environment. The new merged Workers+Pages "Variables
   and Secrets" UI made it look like one shared list, masking the missing
   Production scope. Adding then removing `wrangler.jsonc` may have made this
   worse (wrangler-managed mode replaces Production env_vars), but Production
   was likely empty before that too — the symptom predated the wrangler.jsonc
   commit.

2. **`DASHBOARD_TOKEN` had a trailing space in the var name** (`"DASHBOARD_TOKEN "`).
   So `env.DASHBOARD_TOKEN` was always undefined. Even if Production had been
   populated, the auth check would still have returned the same 500. Almost
   certainly a paste artifact when the var was first created.

## How it got fixed

- `scripts/copy-cf-env-preview-to-prod.mjs` — one-off CF API script that GETs
  `deployment_configs.preview.env_vars` and PATCHes them onto
  `deployment_configs.production.env_vars`. Lives in the repo for the next
  time someone has to do this.
- Trailing space removed manually in CF dashboard for both Preview and
  Production.

## Lessons stashed for the future

- `app/wrangler.jsonc` is not needed for this project and was actively harmful;
  do not re-add unless you intend to manage env vars from the Wrangler config.
- When debugging "env var set but undefined in Function," dump
  `Object.keys(env)` first. It catches both empty-scope and bad-name issues
  faster than reasoning about it.
