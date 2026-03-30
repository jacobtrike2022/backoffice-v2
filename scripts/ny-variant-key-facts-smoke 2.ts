/**
 * Smoke test: run geographic (NY) variant pipeline through trike-server through key-facts step.
 * Uses .env VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_ANON_KEY.
 *
 * Usage:
 *   npx tsx scripts/ny-variant-key-facts-smoke.ts [trackId]
 *   npx tsx scripts/ny-variant-key-facts-smoke.ts   # searches title ILIKE '%Alcohol%'
 *
 * Does not commit; read-only aside from creating scope/plan/extraction rows on the server.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const projectId = process.env.VITE_SUPABASE_PROJECT_ID || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const functionName = process.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';

if (!projectId || !anonKey) {
  console.error('Missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const serverUrl = `https://${projectId}.supabase.co/functions/v1/${functionName}`;

function edgeHeaders(json: boolean): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: edgeHeaders(true),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

function bodyForAdaptation(row: {
  type: string;
  transcript: string | null;
  content_text: string | null;
}): string {
  const t = (row.type || '').toLowerCase();
  if (t === 'article' || t === 'video') {
    return (row.transcript || row.content_text || '').trim();
  }
  return (row.content_text || row.transcript || '').trim();
}

async function main() {
  const supabase = createClient(`https://${projectId}.supabase.co`, anonKey);

  let trackId = process.argv[2];
  let track: {
    id: string;
    title: string;
    type: string;
    transcript: string | null;
    content_text: string | null;
  } | null = null;

  if (trackId) {
    const { data, error } = await supabase
      .from('tracks')
      .select('id,title,type,transcript,content_text')
      .eq('id', trackId)
      .maybeSingle();
    if (error) throw error;
    track = data;
  } else {
    const { data, error } = await supabase
      .from('tracks')
      .select('id,title,type,transcript,content_text')
      .ilike('title', '%Alcohol%')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    track = data;
    trackId = track?.id;
  }

  if (!track?.id) {
    console.error(
      'No track found. Pass a track UUID: npx tsx scripts/ny-variant-key-facts-smoke.ts <trackId>',
    );
    process.exit(1);
  }

  const sourceContent = bodyForAdaptation(track);
  console.log(
    JSON.stringify(
      {
        trackId: track.id,
        title: track.title,
        type: track.type,
        sourceContentChars: sourceContent.length,
      },
      null,
      2,
    ),
  );

  const scope = await postJson<{
    contractId: string;
    roleSelectionNeeded: boolean;
    scopeContract: { primaryRole: string; secondaryRoles: string[] };
  }>('/track-relationships/variant/scope-contract', {
    sourceTrackId: track.id,
    variantType: 'geographic',
    variantContext: { state_code: 'NY', state_name: 'New York' },
    includeOrgRoles: true,
  });

  console.log(
    'Scope:',
    JSON.stringify(
      {
        contractId: scope.contractId,
        roleSelectionNeeded: scope.roleSelectionNeeded,
        primaryRole: scope.scopeContract?.primaryRole,
      },
      null,
      2,
    ),
  );

  if (scope.roleSelectionNeeded) {
    await postJson('/track-relationships/variant/scope-contract/' + scope.contractId + '/freeze-roles', {
      primaryRole: scope.scopeContract.primaryRole,
      secondaryRoles: scope.scopeContract.secondaryRoles || [],
    });
    console.log('Roles frozen (primary from scope contract).');
  }

  const plan = await postJson<{
    planId: string;
    queryCount: number;
  }>('/track-relationships/variant/research-plan', {
    contractId: scope.contractId,
    stateCode: 'NY',
    stateName: 'New York',
    useLLM: true,
    avoidTopics: '',
  });

  console.log('Research plan:', JSON.stringify({ planId: plan.planId, queryCount: plan.queryCount }, null, 2));

  const retrieval = await postJson<{
    evidenceCount: number;
    rejectedCount: number;
    evidence: unknown[];
    rejected: unknown[];
  }>('/track-relationships/variant/retrieve-evidence', {
    planId: plan.planId,
    contractId: scope.contractId,
    sourceContent,
  });

  console.log(
    'Retrieval:',
    JSON.stringify(
      {
        evidenceCount: retrieval.evidenceCount,
        rejectedCount: retrieval.rejectedCount,
        evidenceUrls: (retrieval.evidence as { url?: string }[]).map((e) => e.url).filter(Boolean),
      },
      null,
      2,
    ),
  );

  const keyFacts = await postJson<{
    extractionId: string;
    overallStatus: string;
    keyFactsCount: number;
    rejectedFactsCount: number;
    keyFacts: Array<{ factText: string; qaStatus: string; qaFlags: string[]; citations: unknown[] }>;
    rejectedFacts: Array<{ factText: string; reason: string; failedGates: string[] }>;
    gateResults: Array<{ gate: string; gateName: string; status: string; reason: string }>;
    extractionMethod: string;
  }>('/track-relationships/variant/key-facts', {
    contractId: scope.contractId,
    planId: plan.planId,
    evidenceBlocks: retrieval.evidence,
    stateCode: 'NY',
    stateName: 'New York',
    sourceContent,
  });

  console.log('\n=== KEY FACTS (guardrail result) ===\n');
  console.log(
    JSON.stringify(
      {
        extractionId: keyFacts.extractionId,
        overallStatus: keyFacts.overallStatus,
        keyFactsCount: keyFacts.keyFactsCount,
        rejectedFactsCount: keyFacts.rejectedFactsCount,
        extractionMethod: keyFacts.extractionMethod,
        gateResults: keyFacts.gateResults,
        passedFacts: keyFacts.keyFacts.map((f) => ({
          factText: f.factText,
          qaStatus: f.qaStatus,
          qaFlags: f.qaFlags,
          citationCount: f.citations?.length ?? 0,
        })),
        rejectedFacts: keyFacts.rejectedFacts,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
