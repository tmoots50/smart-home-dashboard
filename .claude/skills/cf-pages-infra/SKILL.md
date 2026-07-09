---
name: cf-pages-infra
description: Make Cloudflare Pages infra changes for the Smart Home Dashboard via the API token — create/bind Workers KV namespaces, add env-var bindings, inspect project config — WITHOUT the CF dashboard UI. Use whenever a task would otherwise say "Tim, go bind a KV namespace / add a binding / set a Pages env var in the Cloudflare dashboard." Attempt the CLI/API path first; only escalate to Tim for the one thing an agent can't do (widen its own token scope).
allowed-tools: Bash, Read, Edit, Grep
---

# Cloudflare Pages infra — do it via the API, not the dashboard

**Principle:** for this project, CF Pages infra (KV namespaces, bindings, env vars) is scriptable with the API token in `.envrc.local`. The dashboard UI is the fallback, not the default. The *only* irreducibly-manual step is minting/widening the token — an agent must not self-widen its own credentials.

This is a **git-integration Pages project** — there is **no `wrangler.toml`**. `scripts/ship.sh` just `git push`es and CF auto-rebuilds. Bindings therefore live on the *project config*, changed via the CF REST API (or `scripts/bind-kv.mjs`), and **take effect on the NEXT deployment only**.

## Credentials

`.envrc.local` (gitignored) holds `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`. Load them in the same invocation:

```bash
source .envrc.local && node scripts/bind-kv.mjs ...
```

- **Never print the token.** Never commit `.envrc.local`. When confirming an update, mask (`${V:0:9}…`, length) — never echo the value.
- **`.envrc.local` extraction gotcha:** lines may carry an inline `# comment` after the quoted value. A naive `sed 's/^export KEY=//'` grabs the comment too and corrupts the `Bearer` header (symptom: `Invalid request headers`). Extract strictly inside the first quote pair:
  ```bash
  readval(){ sed -n -E "s/^export ${1}=\"([^\"]*)\".*/\1/p" .envrc.local | head -n1; }
  ```

## The common case: create + bind a KV namespace

Use the project helper — idempotent, additive (preserves other bindings), binds **both** Production and Preview, titles the namespace `smart-home-dashboard-<binding>` by convention:

```bash
source .envrc.local && node scripts/bind-kv.mjs BINDING_NAME
```

Bind with the **default title** (no explicit title arg) so re-runs stay idempotent — a mismatched title silently creates a duplicate namespace and re-points the binding. Current bindings (2026-07-08): `CURATED`, `HOME_DEVICES`.

## Verify token scope FIRST (before assuming the UI is required)

If a KV call returns `Authentication error [code: 10000]`, the token is almost always **scope-limited**, not invalid. Diagnose with read-only probes:

```bash
source .envrc.local
API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID"
AUTH="authorization: Bearer $CLOUDFLARE_API_TOKEN"
# Pages scope? (should succeed — also shows current bindings + env vars)
curl -sS "$API/pages/projects/$CLOUDFLARE_PAGES_PROJECT" -H "$AUTH" | jq '{success, prod_kv:(.result.deployment_configs.production.kv_namespaces//{}|keys)}'
# Workers KV scope? (fails → token lacks Workers KV: Edit)
curl -sS "$API/storage/kv/namespaces?per_page=100" -H "$AUTH" | jq '{success, errors:[.errors[]?.message]}'
```

**Ignore `GET /user/tokens/verify`** — a narrowly-scoped token can't self-verify and returns a misleading `Invalid API Token`. Trust the resource-level probes above instead.

## If the token lacks scope (the one thing to escalate)

You cannot widen the token yourself. Give Tim the exact steps:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → My Profile → API Tokens → **Create Custom Token**.
2. Permissions: **Account · Cloudflare Pages · Edit** + **Account · Workers KV Storage · Edit** (add whichever is missing). Account Resources → his account.
3. Create, copy, **delete the old token** (especially if it ever appeared in chat).
4. Replace the `CLOUDFLARE_API_TOKEN="…"` line in `.envrc.local` (targeted `sed -i ''` so you don't dump his other secrets), confirm masked.

## Anything bind-kv.mjs doesn't cover (env vars, other bindings): additive-PATCH pattern

GET the project, merge into `deployment_configs.{production,preview}`, PATCH **only** the fields you're changing (never resend read-only fields), then **read back and confirm** existing bindings + env-var count survived. Binding shape:
`"kv_namespaces": { "NAME": { "namespace_id": "<id>" } }`. Additive means: start from the existing map and add your key — never send a bare replacement that drops siblings.

## Rails

- **Additive only.** Preserve existing bindings + env vars; verify by read-back (`env_vars_preserved` count is a cheap check).
- **Deleting a namespace:** confirm nothing references it (re-point the binding first) and nothing's written to it. It needs `Workers KV Storage: Edit`.
- **Activation trap.** Changes apply on the next deployment. If the code that *uses* a new binding is unshipped, the endpoint still fails until it deploys. Don't `ship.sh` if the working tree has unrelated/uncommitted work — say so and let Tim sequence the deploy.
- **No `wrangler.toml`.** Don't introduce one to "tidy up" bindings — CF can then treat the file as source-of-truth and drop dashboard/API-set bindings not mirrored in it.
