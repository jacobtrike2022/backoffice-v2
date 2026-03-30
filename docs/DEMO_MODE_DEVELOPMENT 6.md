# Demo Mode Development Notes

While we're still building demo mode, these patterns apply to **all new features** that call Supabase Edge Functions or external APIs.

## The Problem

In demo mode:
- There is **no real Supabase auth session** — `supabase.auth.getSession()` returns `{ session: null }`
- The app fetches a "demo admin user" from the database (Sarah Admin) for display
- If you call an Edge Function with `Authorization: Bearer ` (empty), Supabase rejects the request with **401 Unauthorized**

## The Fix: Every Edge Function Call

**Always** use the anon key as fallback when calling Edge Functions from the frontend:

```typescript
import { publicAnonKey } from '../utils/supabase/info';
// or: import { supabaseAnonKey } from '../lib/supabase';

const { data: { session } } = await supabase.auth.getSession();
const authToken = session?.access_token || publicAnonKey;

const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'apikey': publicAnonKey,
  },
  body: JSON.stringify(payload),
});
```

### Key points

- `authToken = session?.access_token || publicAnonKey` — use anon key when no session
- Include `apikey: publicAnonKey` so Supabase accepts the request
- Never send `Authorization: Bearer ` (empty string)

## Reference Implementations

These files already follow this pattern — use them as templates when adding new Edge Function calls:

- `src/lib/crud/brain.ts` — all brain endpoints
- `src/components/trike-admin/CreateDemoModal.tsx` — demo create
- `src/components/trike-admin/OrganizationsList.tsx` — `handleAssignSeedPeopleToStores`
- `src/components/trike-admin/BatchDemoCreation.tsx`
- `src/components/BrainChat/BrainChatDrawer.tsx`
- `src/lib/crud/tracks.ts` — transcription, versioning
- `src/lib/crud/knowledge-base.ts`
- `src/lib/crud/tags.ts`
- `src/components/content-authoring/VariantGenerationChat.tsx`

## Checklist for New Features

When adding a new feature that calls an Edge Function:

- [ ] Import `publicAnonKey` from `utils/supabase/info` (or `supabaseAnonKey` from `lib/supabase`)
- [ ] Use `session?.access_token || publicAnonKey` for the Authorization header
- [ ] Include `apikey: publicAnonKey` in headers
- [ ] Test in demo mode (no login) to confirm it works

## When to Remove This

Once demo mode is retired and all users must authenticate, these fallbacks can be removed. Until then, **every new Edge Function call** must support demo mode.
