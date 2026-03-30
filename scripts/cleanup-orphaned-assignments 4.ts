#!/usr/bin/env node
/**
 * One-time cleanup: Delete assignments that are not "CORE Onboarding First Week"
 * Removes orphaned assignments (playlist deleted) and assignments to other playlists.
 *
 * Usage: npx tsx scripts/cleanup-orphaned-assignments.ts
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env (or SUPABASE_TOKEN from .cursor/credentials)
 *
 * Alternative: Run the SQL in supabase/migrations/20260312100001_cleanup_orphaned_assignments.sql
 * directly in Supabase Dashboard > SQL Editor
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env if present
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch {}

// Fallback: try .cursor/credentials/SUPABASE_TOKEN.md
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TOKEN;
if (!serviceKey) {
  try {
    const credPath = path.join(process.cwd(), '.cursor', 'credentials', 'SUPABASE_TOKEN.md');
    if (fs.existsSync(credPath)) {
      const content = fs.readFileSync(credPath, 'utf-8');
      const match = content.match(/```\s*\n([^\s]+)\s*\n```/);
      if (match) serviceKey = match[1].trim();
    }
  } catch {}
}

const projectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const url = process.env.SUPABASE_URL || `https://${projectId}.supabase.co`;

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set in .env or run with:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-key npx tsx scripts/cleanup-orphaned-assignments.ts');
  console.error('\nOr run the SQL in supabase/migrations/20260312100001_cleanup_orphaned_assignments.sql');
  console.error('directly in Supabase Dashboard > SQL Editor');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGET_PLAYLIST = 'CORE Onboarding First Week';

async function main() {
  console.log('Fetching assignments with playlist info...');

  const { data: assignments, error: fetchError } = await supabase
    .from('assignments')
    .select('id, playlist_id, playlist:playlists(title)')
    .limit(10000);

  if (fetchError) {
    console.error('Fetch error:', fetchError);
    process.exit(1);
  }

  const toDelete = (assignments || []).filter((a) => {
    const title = (a.playlist as { title?: string } | null)?.title;
    return !title || title !== TARGET_PLAYLIST;
  });

  if (toDelete.length === 0) {
    console.log('No orphaned or non-CORE assignments found. Nothing to delete.');
    return;
  }

  console.log(`Found ${toDelete.length} assignments to delete (not "${TARGET_PLAYLIST}")`);
  const ids = toDelete.map((a) => a.id);

  // Delete in batches of 100
  const batchSize = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from('assignments').delete().in('id', batch);
    if (error) {
      console.error('Delete error:', error);
      process.exit(1);
    }
    deleted += batch.length;
    console.log(`Deleted ${deleted}/${ids.length}...`);
  }

  console.log(`Done. Deleted ${deleted} orphaned/non-CORE assignments.`);
}

main().catch(console.error);
