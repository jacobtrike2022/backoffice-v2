# Seed Data Instructions

## Run Migrations in Order

1. **First:** `/migrations/organizational_hierarchy.sql`
   - Creates tables: `roles`, `districts`, `stores`
   - Seeds 6 roles for Demo Company

2. **Second:** `/migrations/seed_districts_stores.sql`
   - Seeds 4 districts (Northeast, Southeast, Midwest, West Coast)
   - Seeds 9 stores distributed across districts

3. **Third (if needed):** `/migrations/fix_rls_policies.sql`
   - Fixes RLS infinite recursion issues
   - Already applied if you ran Phase 1

## Seed Data Summary

### Districts (4)
- Northeast District (NE)
- Southeast District (SE)
- Midwest District (MW)
- West Coast District (WC)

### Stores (9)
- **Northeast:** Boston Flagship (#101), New York Times Square (#102)
- **Southeast:** Atlanta Perimeter (#201), Miami Beach (#202)
- **Midwest:** Chicago Magnificent Mile (#301), Minneapolis Mall of America (#302)
- **West Coast:** Los Angeles Beverly Center (#401), San Francisco Union Square (#402), Seattle Downtown (#403)

## How to Run in Supabase

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of `seed_districts_stores.sql`
4. Click "Run"
5. Verify success in Table Editor (check `districts` and `stores` tables)
