# Relay Location Scraper – Webhook Setup

Relay.app scrapes store locations from company websites. When the playbook completes, it must **POST to our callback** so we can replace seed stores with real locations.

**What we automate vs. what you configure once:**
- **Automated:** Fallback cron (pg_cron every 10 min) seeds orgs when Relay never returns.
- **Manual (one-time):** Add an HTTP step in Relay.app that POSTs to our callback when the scraper finishes. We cannot configure Relay from code—it's a third-party automation platform.

## Current Behavior

- **DemoCreate** triggers Relay → Relay runs scraper → returns locations
- **When Relay is triggered**: DemoCreate skips seed stores (no placeholder "5 locs"). Org shows 0 until callback runs.
- **Callback** (when Relay playbook POSTs): Inserts real stores, assigns seed people to first store.
- **If callback never runs**: Org stays at 0 stores until Relay is configured.
- **If Relay returns no locations**: Callback creates 5 seed stores as fallback so demo isn't broken.

## Callback URL

Use the **standalone** function (no JWT required):

```
https://<your-project-id>.supabase.co/functions/v1/relay-location-callback
```

Example: `https://kgzhlvxzdlexsrozbbxs.supabase.co/functions/v1/relay-location-callback`

**Do not** use the trike-server route (`/trike-server/relay/location-callback`) — it requires JWT and Relay cannot send Supabase auth.

## Relay Playbook Configuration

Add an **HTTP Request** step at the end of your Relay playbook that POSTs to the callback when the scraper completes.

### Required payload

| Field | Source | Description |
|-------|--------|-------------|
| `org_id` | Trigger input | **CRITICAL** — Must be echoed from trigger. Add `org_id` to your Relay playbook trigger schema. Without it, seed people can't be assigned to stores. |
| `company_name` | Trigger input | e.g. "Friendly Express" |
| `company_domain` | Trigger input | e.g. "https://www.friendlyexpress.com" |
| `locations` | Scraper output | Array of `{ name, address, city, state, zip, code?, ... }` |
| `total_scraped` or `totalLocationCount` | Scraper output | **Optional.** Total locations found by scraper (e.g. 38). Relay AI step often outputs `totalLocationCount`. If the `locations` array has fewer items, send this so the UI can show "5 locs (38 scraped)". |
| `industry` | Merge step | **Optional.** `{ code: string, name: string }` (e.g. `{ code: 'cstore', name: 'Convenience Stores' }`). Used to set the org’s `industry_id` from the `industries` table. |
| `operating_states` | Merge step | **Optional.** Array of 2-letter US state codes (e.g. `["TX","LA","GA"]`). Stored on the organization and in `scraped_data`. |
| `co_type` | Merge step | **Optional.** Notion “Co Type” value, e.g. `"LEAD"` or `"CLIENT"`. Stored in `scraped_data.relay_co_type`. |
| `date_checked` | Merge step | **Optional.** Date the scraper ran. Stored in `scraped_data.relay_date_checked`. |

### Example body (Relay step)

```json
{
  "org_id": "{{trigger.body.org_id}}",
  "company_name": "{{trigger.body.company_name}}",
  "company_domain": "{{trigger.body.company_domain}}",
  "locations": "{{steps.scraper.outputs.locations}}"
}
```

(Adjust `steps.scraper.outputs` to match your playbook step names.)

### Relay output format (what we accept)

We accept either `locations` or `stores`:

```json
{
  "org_id": "fabcd213-e79d-4320-8255-566d2c166381",
  "company_name": "Friendly Express",
  "company_domain": "https://www.friendlyexpress.com",
  "locations": [
    {
      "name": "Store #101",
      "code": "101",
      "address": "1310 US HWY 82 W",
      "city": "Tifton",
      "state": "GA",
      "zip": "31793"
    }
  ]
}
```

## Fallback When Relay Fails

If Relay never returns or returns an error, seed stores are created so demos stay usable:

| Scenario | Behavior |
|----------|----------|
| Relay returns no locations | Callback creates 5 seed stores, assigns people |
| Relay callback insert fails | Callback creates 5 seed stores as fallback |
| Relay never calls back | **pg_cron** runs every 10 min and seeds stuck orgs (automated) |

### Relay Fallback Cron (automated)

A **pg_cron** job runs every 10 minutes and calls the `relay-fallback-cron` Edge Function. No manual curl needed.

**Setup:** After deploy, ensure vault has `project_url` and `anon_key` (Dashboard > Database > Vault). If you already use these for notification emails, you're good. The migration `20260311110001_relay_fallback_cron.sql` creates the cron job.

**Manual fallback (optional):** If you need to run it immediately after deploy:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/relay-fallback-cron" \
  -H "Content-Type: application/json" \
  -d '{"minutesAgo": 10}'
```

No JWT required (`relay-fallback-cron` has `verify_jwt = false`).

## People Distribution

Seed people are distributed across the **first 5 stores** (round-robin). Works for 5 or 500 stores: person 0→store 0, person 1→store 1, …, person 5→store 0, etc.

## Troubleshooting: Seed people not assigned to stores

If stores appear but employees show "No Store":

1. **Verify `org_id` is passed** — The Relay HTTP step must send `org_id` from the trigger. Add `org_id` to your playbook's trigger input schema and use `{{trigger.body.org_id}}` in the callback body.
2. **Check Edge Function logs** — Look for `[Relay] Callback: no seed people` — if you see "total users in org: 0", the org has no users (wrong org_id or creation failed). If "total users in org: 1", only the admin exists (onboarding path didn't seed).
3. **Manual fix** — In Trike Admin → Organizations → org dropdown → "Fix store assignments".

## Verification

After configuring the callback step:

1. Create a new demo (e.g. Friendly Express)
2. Check Edge Function logs for `[Relay] Callback received:`
3. If present, you should see `[Relay] Callback: imported N stores for org ...`
4. Units page should show real locations instead of seed placeholders

## Deploy

```bash
npx supabase functions deploy relay-location-callback
npx supabase functions deploy relay-fallback-cron
```

Then run migrations (or `supabase db push`) so the pg_cron job is created.
