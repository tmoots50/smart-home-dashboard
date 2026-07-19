# Outlook calendar setup — published ICS feed (Caroline's work calendar)

The dashboard can surface any calendar that publishes an **ICS URL** — no
Microsoft account, OAuth, or Graph API involved. The CF Function
(`app/functions/_lib/ics-api.js`) fetches the feed, expands recurrences, and
merges the events into the same wall card / overlay / month view / Hermes API
as the Google calendars. ICS calendars are **always read-only**: the dashboard
returns HTTP 403 for any write, and Hermes refuses with exit code 68 before a
request is even made.

This is a one-time setup per feed.

---

## 1. Publish the calendar from Outlook (calendar owner does this)

In **Outlook on the web** (works for most work/Microsoft 365 accounts):

1. **Settings (gear) → Calendar → Shared calendars**.
2. Under **Publish a calendar**:
   - *Select a calendar:* **Calendar** (the main work calendar).
   - *Select permissions:* **Can view all details** (the wall shows titles,
     times, and locations; "titles only" would render every event as "Busy").
3. Click **Publish**, then copy the **ICS** link (not the HTML one). It looks
   like:

   ```
   https://outlook.office365.com/owa/calendar/<long-id>/calendar.ics
   ```

4. Send that URL to whoever maintains the dashboard config.

> **If the publish option is missing or grayed out**, the Microsoft 365 admin
> has disabled calendar publishing for the org. There is no self-serve
> workaround — the alternatives are asking IT to allow publishing, or a
> Microsoft Graph OAuth integration (real-time but a whole new auth stack;
> deliberately not built).

## 2. Wire the feed into the dashboard

Set the `ICS_CALENDARS_JSON` env var on the CF Pages project (scriptable via
the `cf-pages-infra` skill — no dashboard UI needed):

```json
[{"label":"Caroline (Work)","url":"https://outlook.office365.com/owa/calendar/<long-id>/calendar.ics","person":"Caroline","kind":"work"}]
```

- `label` — source name shown in event detail.
- `person` — the wall column the events merge into.
- `kind: "work"` — renders the small **Work** tag on each event.
- `readOnly` is implied; ICS feeds cannot be written to.

Optionally create + bind a Workers KV namespace named `ICS_CACHE` (15-min
read-through cache, serve-stale on fetch errors). Without the binding the
Function falls open to a direct fetch per request — slower and less resilient,
but functional.

## 3. Verify

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" \
  "https://<your-app>.pages.dev/api/calendar/upcoming?days=7" | jq \
  '.events[] | select(.calendar == "Caroline (Work)") | {title, startsAt}'
```

And confirm a write is refused (expect **403 read-only**):

```bash
curl -X POST -H "Authorization: Bearer $DASHBOARD_TOKEN" -H 'content-type: application/json' \
  -d '{"calendar":"Caroline (Work)","title":"nope","start":"2026-08-01T10:00:00-04:00","end":"2026-08-01T11:00:00-04:00"}' \
  "https://<your-app>.pages.dev/api/calendar/events"
```

---

## Freshness caveat (inherent, documented, accepted)

A *published* Outlook feed is regenerated on Microsoft's schedule — typically
**every few hours**, not on every change. The dashboard fetching the URL more
often can't make Microsoft republish faster; it only picks up the newest
snapshot Microsoft has produced. So a meeting added at 9:00 may not hit the
wall until lunch.

This is fine for a family wall ("does Caroline have meetings tonight?"), and
it's still strictly fresher than the old subscribe-in-Google approach (8–24h
lag). If real-time ever matters, the upgrade path is Microsoft Graph OAuth —
a deliberate non-goal for v1.

## Failure behavior

- **Feed unreachable / URL revoked:** the Function serves the last KV-cached
  copy (up to 24h), then the calendar quietly drops to empty. Other calendars
  are never affected — one dead feed cannot blank the card or the endpoint.
- **URL rotated:** republishing in Outlook can mint a new URL; update
  `ICS_CALENDARS_JSON` with the new one.
- **Anyone-with-the-link caveat:** a published ICS URL is an unauthenticated
  secret link. Treat it like a password (env var only — never commit it).
