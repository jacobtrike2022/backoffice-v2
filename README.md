# Trike Backoffice Dashboard Application SCHEMA SANDBOX

This is a code bundle for Trike Backoffice Dashboard Application SCHEMA SANDBOX. The original project is available at https://www.figma.com/design/aQqsGmiRMNMDNmDl6lfSlA/Trike-Backoffice-Dashboard-Application-SCHEMA-SANDBOX.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Demo Mode Development

**While building demo mode**, there is no real auth session — Edge Function calls will 401 if you use an empty Bearer token. Use the anon key as fallback:

```typescript
const authToken = session?.access_token || publicAnonKey;
headers: { 'Authorization': `Bearer ${authToken}`, 'apikey': publicAnonKey }
```

See **[docs/DEMO_MODE_DEVELOPMENT.md](docs/DEMO_MODE_DEVELOPMENT.md)** for full pattern and checklist.

## Database / content notes

- **Article body:** Article-type tracks store the main body in the **`transcript`** column (not only `content_text`). When showing or validating article content, use `transcript` first, then `content_text` (e.g. `transcript || content_text || article_body`).

## Supabase migrations

- **Idempotent migrations:** For new migrations that add RLS policies or triggers, use `DROP POLICY IF EXISTS` / `DROP TRIGGER IF EXISTS` before `CREATE POLICY` / `CREATE TRIGGER` so re-runs and partial applies don’t fail.
- **"Local migration files to be inserted before":** If `supabase db push` fails with this message, repair history (only when the remote already has that schema) with:
  `supabase migration repair <version> --status applied`
  then run `supabase db push` again. See **.cursor/docs/README_MIGRATIONS.mdc** for details.
- **CLI vs migration history table:** If you edit `supabase_migrations.schema_migrations` manually, the CLI matches local files using the migration **version** format described in **.cursor/docs/README_MIGRATIONS.mdc** (section 4). Avoid setting `version` to the full `filename_without_.sql` unless you have verified with `supabase migration list` / `db push`.
