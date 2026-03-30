#!/usr/bin/env node
/**
 * List thumbnail files in track-media storage and optionally recover thumbnail_url for tracks
 * that currently have default/no thumbnail but have a file in storage.
 *
 * Checks all buckets that look like track media (name contains "track" or "media") and the
 * thumbnails/ folder in each. Path pattern: thumbnails/{trackId}-{timestamp}.{ext}
 *
 * Usage:
 *   npx tsx scripts/list-and-recover-track-thumbnails.ts           # list only (dry run)
 *   npx tsx scripts/list-and-recover-track-thumbnails.ts --recover  # update tracks with signed URLs
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_TOKEN (and VITE_SUPABASE_PROJECT_ID or SUPABASE_URL)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const THUMBNAILS_PREFIX = 'thumbnails/';
const SIGNED_URL_EXPIRY = 315360000; // 10 years in seconds (same as upload)

// Buckets to check (frontend uses first; edge function may use track-media)
const BUCKET_CANDIDATES = ['make-2858cc8b-track-media', 'track-media'];

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

let serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TOKEN || '').trim();
if (!serviceKey) {
  try {
    const credPath = path.join(process.cwd(), '.cursor', 'credentials', 'SUPABASE_TOKEN.md');
    if (fs.existsSync(credPath)) {
      const content = fs.readFileSync(credPath, 'utf-8');
      const match = content.match(/```\s*\n([^\s]+)\s*\n```/);
      if (match) {
        serviceKey = match[1].trim();
      } else {
        const line = content.split('\n').find((l) => /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(l.trim()));
        if (line) serviceKey = line.trim();
      }
    }
  } catch {}
}
serviceKey = serviceKey.replace(/\s/g, '');

const projectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || 'kgzhlvxzdlexsrozbbxs';
const url = (process.env.SUPABASE_URL || `https://${projectId}.supabase.co`).trim();

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set in .env or .cursor/credentials/SUPABASE_TOKEN.md');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Parse track ID from thumbnail path. Path format: thumbnails/{uuid}-{timestamp}.ext or {uuid}-{timestamp}.ext */
function parseTrackIdFromPath(filePath: string): { trackId: string; timestamp: number } | null {
  const name = filePath.startsWith(THUMBNAILS_PREFIX)
    ? filePath.slice(THUMBNAILS_PREFIX.length)
    : filePath.replace(/^.*\//, ''); // allow any prefix (e.g. content/)
  const withoutExt = name.replace(/\.[^.]+$/, '');
  const parts = withoutExt.split('-');
  // UUID = 5 segments (8-4-4-4-12), then timestamp
  if (parts.length < 6) return null;
  const trackId = parts.slice(0, 5).join('-');
  const ts = parseInt(parts[5], 10);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId) || isNaN(ts))
    return null;
  return { trackId, timestamp: ts };
}

type ThumbnailEntry = { bucket: string; path: string; trackId: string; timestamp: number };

async function listAllBuckets(): Promise<string[]> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Failed to list buckets:', error);
    return [...BUCKET_CANDIDATES];
  }
  const names = (buckets || []).map((b) => b.name).filter(Boolean);
  console.log('Buckets in project:', names.length ? names.join(', ') : '(none)');
  const toCheck = [...new Set([...BUCKET_CANDIDATES, ...names.filter((n) => /track|media/i.test(n))])];
  return toCheck;
}

async function listFolderInBucket(
  bucket: string,
  folderPath: string,
  pathPrefix: string
): Promise<ThumbnailEntry[]> {
  const results: ThumbnailEntry[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folderPath, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      if (error.message?.includes('Bucket not found') || (error as any).statusCode === '404') return results;
      console.error(`Storage list error (${bucket}/${folderPath || '(root)'}):`, error.message);
      if (error.message?.includes('Invalid Compact JWS') || (error as any).statusCode === '403') {
        console.error(
          '\nUse the SERVICE ROLE key (secret), not the anon key.\n' +
            '  Supabase Dashboard → Settings → API → service_role (secret)'
        );
      }
      throw error;
    }

    const items = data || [];
    for (const file of items) {
      if (!file.name) continue;
      const fullPath = pathPrefix ? pathPrefix + file.name : file.name;
      const parsed = parseTrackIdFromPath(fullPath);
      if (parsed) results.push({ bucket, path: fullPath, trackId: parsed.trackId, timestamp: parsed.timestamp });
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return results;
}

async function listThumbnailFilesInBucket(bucket: string): Promise<ThumbnailEntry[]> {
  const fromThumbnails = await listFolderInBucket(bucket, 'thumbnails', THUMBNAILS_PREFIX);
  const fromRoot = await listFolderInBucket(bucket, '', '');
  return [...fromThumbnails, ...fromRoot];
}

async function listThumbnailFiles(): Promise<ThumbnailEntry[]> {
  const buckets = await listAllBuckets();
  const all: ThumbnailEntry[] = [];
  for (const bucket of buckets) {
    const files = await listThumbnailFilesInBucket(bucket);
    if (files.length) console.log(`  ${bucket}: ${files.length} file(s) in thumbnails/`);
    all.push(...files);
  }
  return all;
}

async function main() {
  const doRecover = process.argv.includes('--recover');

  console.log('Listing thumbnail files in storage...');
  const files = await listThumbnailFiles();
  console.log(`Found ${files.length} thumbnail file(s) across all track-media buckets.`);

  if (files.length === 0) {
    console.log('No thumbnail files found. Nothing to recover.');
    return;
  }

  // Per track, keep the most recent file (by timestamp in filename)
  const byTrack = new Map<string, { bucket: string; path: string; timestamp: number }>();
  for (const f of files) {
    const existing = byTrack.get(f.trackId);
    if (!existing || f.timestamp > existing.timestamp)
      byTrack.set(f.trackId, { bucket: f.bucket, path: f.path, timestamp: f.timestamp });
  }

  console.log(`Unique tracks with at least one thumbnail file: ${byTrack.size}`);

  // Tracks that currently have no custom thumbnail (null, empty, or default placeholder)
  const { data: tracks, error: tracksError } = await supabase
    .from('tracks')
    .select('id, title, thumbnail_url')
    .in('id', Array.from(byTrack.keys()));

  if (tracksError) {
    console.error('Tracks fetch error:', tracksError);
    process.exit(1);
  }

  const needsRecovery = (tracks || []).filter((t) => {
    const u = (t.thumbnail_url || '').trim();
    return !u || u === '' || u === '/default-thumbnail.png';
  });

  console.log(`Tracks that have a file in storage but no custom thumbnail_url: ${needsRecovery.length}`);

  if (needsRecovery.length === 0) {
    console.log('No tracks need recovery (all already have thumbnail_url set).');
    return;
  }

  if (!doRecover) {
    console.log('\nDry run. Tracks that would be updated:');
    for (const t of needsRecovery) {
      const f = byTrack.get(t.id);
      if (f) console.log(`  ${t.id}  "${(t.title || '').slice(0, 50)}"  ->  ${f.bucket}/${f.path}`);
    }
    console.log('\nTo apply updates, run:  npx tsx scripts/list-and-recover-track-thumbnails.ts --recover');
    return;
  }

  let updated = 0;
  for (const track of needsRecovery) {
    const f = byTrack.get(track.id);
    if (!f) continue;

    const { data: signedData, error: signError } = await supabase.storage
      .from(f.bucket)
      .createSignedUrl(f.path, SIGNED_URL_EXPIRY);

    if (signError) {
      console.error(`Failed to create signed URL for ${f.path}:`, signError);
      continue;
    }

    const { error: updateError } = await supabase
      .from('tracks')
      .update({ thumbnail_url: signedData.signedUrl })
      .eq('id', track.id);

    if (updateError) {
      console.error(`Failed to update track ${track.id}:`, updateError);
      continue;
    }

    updated++;
    console.log(`Updated: ${track.id}  "${(track.title || '').slice(0, 50)}"`);
  }

  console.log(`\nDone. Updated ${updated} track(s) with recovered thumbnail URLs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
