# src/supabase - Local Supabase Configuration

This folder contains local Supabase configuration files that work with the Supabase CLI.

## Contents

- `migrations/` - Database migration files
- `seeds/` - Database seed data

## Edge Functions

**Edge Functions are NOT stored here.**

The deployed Supabase Edge Functions are located at:
```
/supabase/functions/trike-server/index.ts
```

To deploy edge functions:
```bash
npx supabase functions deploy trike-server
```

To view logs:
```bash
npx supabase functions logs trike-server
```

## Important

Do NOT create edge function code in `src/supabase/functions/` - it will not be deployed.
Always edit `/supabase/functions/trike-server/index.ts` for production changes.
