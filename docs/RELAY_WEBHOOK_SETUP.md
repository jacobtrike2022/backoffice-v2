# Relay Location Scraper – Webhook Setup

Relay.app scrapes store locations from company websites. When the playbook completes, it must **POST to our callback** so we can replace seed stores with real locations.

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
| `org_id` | Trigger input | Echoed from DemoCreate (required) |
| `company_name` | Trigger input | e.g. "Friendly Express" |
| `company_domain` | Trigger input | e.g. "https://www.friendlyexpress.com" |
| `locations` | Scraper output | Array of `{ name, address, city, state, zip, code?, ... }` |

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
| Relay never calls back | Cron calls `POST /admin/relay-fallback-seed` (see below) |

### Cron: Relay Fallback Seed

Call this endpoint periodically (e.g. every 10 min) to create seed stores for orgs where Relay was triggered but never returned:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/trike-server/admin/relay-fallback-seed" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"minutesAgo": 10}'
```

Requires JWT (service role). Finds orgs with `relay_run_id` set, no `relay_locations_imported_at`, 0 stores, created > `minutesAgo` minutes ago.

## People Distribution

Seed people are distributed across the **first 5 stores** (round-robin). Works for 5 or 500 stores: person 0→store 0, person 1→store 1, …, person 5→store 0, etc.

## Verification

After configuring the callback step:

1. Create a new demo (e.g. Friendly Express)
2. Check Edge Function logs for `[Relay] Callback received:`
3. If present, you should see `[Relay] Callback: imported N stores for org ...`
4. Units page should show real locations instead of seed placeholders

## Deploy

```bash
npx supabase functions deploy relay-location-callback
```
