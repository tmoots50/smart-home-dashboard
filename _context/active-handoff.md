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
