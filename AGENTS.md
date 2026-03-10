# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Trike Backoffice is a React 18 + TypeScript SPA built with Vite 6, backed by hosted Supabase (PostgreSQL + Auth + Edge Functions). There is no local database or Docker — the app connects to the cloud Supabase instance at `kgzhlvxzdlexsrozbbxs.supabase.co`.

### Environment variables

A `.env` file must exist in the project root with at minimum:

```
VITE_SUPABASE_PROJECT_ID=kgzhlvxzdlexsrozbbxs
VITE_SUPABASE_ANON_KEY=<anon key from src/public/kb-public.html fallback>
```

The anon key (public, safe for client-side) can be found as a fallback value in `src/public/kb-public.html`. The `.env` file is gitignored.

### Running the app

- `npm run dev` — starts Vite dev server on **port 3000** (not 5173; configured in `vite.config.ts`)
- `npm run build` — production build to `build/` directory
- `npm run test:run` — run Vitest tests (27 tests across 2 files)

### Key caveats

- The dev server port is **3000**, not 5173 as some documentation states. Check `vite.config.ts` for the authoritative config.
- The app may load into the Dashboard directly if a Supabase auth session exists in the browser. To see the login page, sign out first or clear localStorage.
- The `CLAUDE.md` and `.cursor/rules/trike-backoffice.mdc` files contain extensive schema rules (e.g., never use `role_name` on `users` table, never use empty string values in Radix UI Select). Read those before making database or UI changes.
- Path alias `@` maps to `./src` (configured in `vite.config.ts`).
- Build produces a large main chunk (~4MB) — this is expected for now; there's a known warning about chunk size.
