// ============================================================================
// TRACK RELATIONSHIPS API ROUTES
// ============================================================================

import { Hono } from 'npm:hono';
import { streamText } from 'npm:hono/streaming';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as trackRel from './track-relationships.ts';
import { getVariantSystemPrompt, getClarificationPrompt } from '../../../lib/prompts/variantGeneration.ts';
import {
  buildScopeContract,
  freezeScopeContractWithRoles,
  createScopeContractLog,
  type ScopeContractInput,
  type ScopeContractResult,
  type ScopeContractLog,
  type LearnerRole,
  type ScopeContract
} from '../../../lib/prompts/scopeContract.ts';
import {
  buildResearchPlan,
  buildResearchPlanWithLLM,
  retrieveEvidence,
  createResearchPlanLog,
  classifySourceTier,
  type ResearchPlan,
  type ResearchPlanInput,
  type RetrievalOutput,
  type EvidenceBlock,
  type SearchProvider,
  type FetchProvider,
  type SearchResult
} from '../../../lib/prompts/researchPlan.ts';
import {
  extractKeyFacts,
  createKeyFactsExtractionLog,
  runAllGates,
  findDuplicateFact,
  mergeDuplicateFacts,
  isStrongClaim,
  type KeyFactsExtractionInput,
  type KeyFactsExtractionResult,
  type KeyFactCandidate,
  type QAGateStatus
} from '../../../lib/prompts/keyFacts.ts';
import {
  generateVariantDraft,
  applyInstructions,
  createVariantDraftLog,
  type VariantDraftInput,
  type VariantDraftOutput,
  type ApplyInstructionsInput,
  type TrackType,
  type DraftStatus
} from '../../../lib/prompts/variantDraft.ts';
import { streamChatCompletion, chatCompletion, type ChatMessage } from './utils/openai.ts';

const app = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper to get org ID from access token
async function getOrgIdFromToken(accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null;
  
  // Check if this is the public anon key (demo mode)
  const publicAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (accessToken === publicAnonKey) {
    // Demo mode: return default org ID
    console.log('🔓 Demo mode detected, using default org ID');
    return '10000000-0000-0000-0000-000000000001';
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  
  return profile?.organization_id || null;
}

// ============================================================================
// CREATE RELATIONSHIP
// ============================================================================
app.post('/create', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, derivedTrackId, relationshipType } = await c.req.json();
    
    if (!sourceTrackId || !derivedTrackId) {
      return c.json({ error: 'sourceTrackId and derivedTrackId are required' }, 400);
    }

    const relationship = await trackRel.createTrackRelationship(
      orgId,
      sourceTrackId,
      derivedTrackId,
      relationshipType || 'source'
    );

    return c.json({ relationship });
  } catch (error: any) {
    console.error('Error creating track relationship:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET DERIVED TRACKS (children)
// ============================================================================
app.get('/derived/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');
    const relationshipType = c.req.query('type') as 'source' | 'prerequisite' | 'related' | undefined;

    const derived = await trackRel.getDerivedTracks(orgId, trackId, relationshipType);

    return c.json({ derived });
  } catch (error: any) {
    console.error('Error fetching derived tracks:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET SOURCE TRACK (parent)
// ============================================================================
app.get('/source/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');
    const relationshipType = c.req.query('type') as 'source' | 'prerequisite' | 'related' | undefined;

    const source = await trackRel.getSourceTrack(orgId, trackId, relationshipType);

    return c.json({ source });
  } catch (error: any) {
    console.error('Error fetching source track:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET RELATIONSHIP STATS
// ============================================================================
app.get('/stats/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const stats = await trackRel.getTrackRelationshipStats(orgId, trackId);

    return c.json({ stats });
  } catch (error: any) {
    console.error('Error fetching relationship stats:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// GET BATCH RELATIONSHIPS (for multiple tracks)
// ============================================================================
app.post('/batch', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);
    
    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { trackIds } = await c.req.json();
    
    if (!trackIds || !Array.isArray(trackIds)) {
      return c.json({ error: 'trackIds array is required' }, 400);
    }

    const relationships = await trackRel.getBatchTrackRelationships(orgId, trackIds);

    return c.json({ relationships });
  } catch (error: any) {
    console.error('Error fetching batch relationships:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// DELETE RELATIONSHIP
// ============================================================================
app.delete('/:relationshipId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const relationshipId = c.req.param('relationshipId');

    await trackRel.deleteTrackRelationship(orgId, relationshipId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting track relationship:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// VARIANT RELATIONSHIP ROUTES
// ============================================================================

// CREATE VARIANT RELATIONSHIP
app.post('/variant/create', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, derivedTrackId, variantType, variantContext } = await c.req.json();

    if (!sourceTrackId || !derivedTrackId || !variantType) {
      return c.json({ error: 'sourceTrackId, derivedTrackId, and variantType are required' }, 400);
    }

    const relationship = await trackRel.createVariantRelationship(
      orgId,
      sourceTrackId,
      derivedTrackId,
      variantType,
      variantContext || {}
    );

    return c.json({ relationship });
  } catch (error: any) {
    console.error('Error creating variant relationship:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET TRACK VARIANTS
app.get('/variants/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');
    const variantType = c.req.query('type') as 'geographic' | 'company' | 'unit' | undefined;

    const variants = await trackRel.getTrackVariants(orgId, trackId, variantType);

    return c.json({ variants });
  } catch (error: any) {
    console.error('Error fetching track variants:', error);
    return c.json({ error: error.message }, 500);
  }
});

// FIND VARIANT BY CONTEXT
app.get('/variant/find', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sourceTrackId = c.req.query('sourceTrackId');
    const variantType = c.req.query('variantType') as 'geographic' | 'company' | 'unit';
    const contextKey = c.req.query('contextKey');
    const contextValue = c.req.query('contextValue');

    if (!sourceTrackId || !variantType || !contextKey || !contextValue) {
      return c.json({ error: 'sourceTrackId, variantType, contextKey, and contextValue are required' }, 400);
    }

    const variant = await trackRel.findVariantByContext(
      orgId,
      sourceTrackId,
      variantType,
      contextKey,
      contextValue
    );

    return c.json({ variant });
  } catch (error: any) {
    console.error('Error finding variant by context:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET BASE TRACK FOR VARIANT
app.get('/variant/base/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const baseTrack = await trackRel.getBaseTrackForVariant(orgId, trackId);

    return c.json({ baseTrack });
  } catch (error: any) {
    console.error('Error getting base track for variant:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET STATS WITH VARIANTS
app.get('/stats-with-variants/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const stats = await trackRel.getTrackRelationshipStatsWithVariants(orgId, trackId);

    return c.json({ stats });
  } catch (error: any) {
    console.error('Error fetching relationship stats with variants:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET FULL VARIANT TREE (all descendants)
app.get('/variant-tree/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const tree = await trackRel.getVariantTree(orgId, trackId);

    return c.json({ tree });
  } catch (error: any) {
    console.error('Error fetching variant tree:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET PARENT VARIANT (immediate parent)
app.get('/variant/parent/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const parentVariant = await trackRel.getParentVariant(orgId, trackId);

    return c.json({ parentVariant });
  } catch (error: any) {
    console.error('Error getting parent variant:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET VARIANTS NEEDING REVIEW
app.get('/variants/needs-review/:baseTrackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const baseTrackId = c.req.param('baseTrackId');

    const variantsNeedingReview = await trackRel.getVariantsNeedingReview(orgId, baseTrackId);

    return c.json({ variantsNeedingReview });
  } catch (error: any) {
    console.error('Error getting variants needing review:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MARK VARIANT AS SYNCED
app.post('/variant/mark-synced/:relationshipId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const relationshipId = c.req.param('relationshipId');

    await trackRel.markVariantSynced(orgId, relationshipId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error marking variant as synced:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET ULTIMATE BASE TRACK
app.get('/variant/ultimate-base/:trackId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const trackId = c.req.param('trackId');

    const result = await trackRel.getUltimateBaseTrack(orgId, trackId);

    return c.json(result);
  } catch (error: any) {
    console.error('Error getting ultimate base track:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// SCOPE CONTRACT ROUTES (State Variant Intelligence v2)
// ============================================================================

// In-memory storage for scope contract logs (replace with DB in production)
const scopeContractLogs: Map<string, ScopeContractLog> = new Map();

/**
 * POST /variant/scope-contract
 * Build a Scope Contract from source content.
 * This is the first step in the v2 variant pipeline.
 */
app.post('/variant/scope-contract', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, variantType, variantContext, includeOrgRoles } = await c.req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return c.json({ error: 'sourceTrackId, variantType, and variantContext are required' }, 400);
    }

    // Fetch source track content
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, title, type, content_text, transcript')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) {
      return c.json({ error: 'Source track not found' }, 404);
    }

    const sourceContent = track.content_text || track.transcript || '';

    if (!sourceContent || sourceContent.trim().length < 50) {
      return c.json({ error: 'Source track has insufficient content for scope analysis' }, 400);
    }

    // Optionally fetch org roles for role matching
    let orgRoles: ScopeContractInput['orgRoles'] | undefined;
    if (includeOrgRoles) {
      const { data: roles } = await supabase
        .from('roles')
        .select('id, name, description, job_description')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .limit(20);

      if (roles && roles.length > 0) {
        orgRoles = roles.map((r: any) => ({
          roleId: r.id,
          roleName: r.name,
          roleDescription: r.description || r.job_description || undefined,
          dailyActivities: undefined
        }));
      }
    }

    // Build the scope contract
    const input: ScopeContractInput = {
      sourceTrackType: track.type as ScopeContractInput['sourceTrackType'],
      sourceTitle: track.title,
      sourceContent,
      variantType,
      variantContext,
      orgRoles
    };

    console.log('[ScopeContract Route] Building contract for:', track.title);

    const result = await buildScopeContract(input);

    // Create and store log
    const log = createScopeContractLog(result, input, sourceTrackId);
    scopeContractLogs.set(log.id, log);

    // Also store in variant_scope_contracts table if it exists
    try {
      await supabase.from('variant_scope_contracts').insert({
        id: log.id,
        organization_id: orgId,
        source_track_id: sourceTrackId,
        variant_type: variantType,
        variant_context: variantContext,
        scope_contract: result.scopeContract,
        role_selection_needed: result.roleSelectionNeeded,
        top_role_matches: result.topRoleMatches || null,
        extraction_method: result.extractionMethod,
        validation_errors: result.validationErrors || null,
        created_at: log.timestamp
      });
      console.log('[ScopeContract Route] Stored contract in DB:', log.id);
    } catch (dbError) {
      // Table may not exist yet - log but don't fail
      console.log('[ScopeContract Route] DB storage skipped (table may not exist):', (dbError as Error).message);
    }

    return c.json({
      contractId: log.id,
      scopeContract: result.scopeContract,
      roleSelectionNeeded: result.roleSelectionNeeded,
      topRoleMatches: result.topRoleMatches,
      extractionMethod: result.extractionMethod,
      validationErrors: result.validationErrors
    });
  } catch (error: any) {
    console.error('Error building scope contract:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /variant/scope-contract/:contractId/freeze-roles
 * Freeze the scope contract with user-selected roles.
 * Call this after user confirms role selection in UI.
 */
app.post('/variant/scope-contract/:contractId/freeze-roles', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const contractId = c.req.param('contractId');
    const { primaryRole, secondaryRoles } = await c.req.json();

    if (!primaryRole) {
      return c.json({ error: 'primaryRole is required' }, 400);
    }

    // Retrieve the stored log
    const log = scopeContractLogs.get(contractId);
    if (!log) {
      return c.json({ error: 'Scope contract not found' }, 404);
    }

    // Freeze the contract with selected roles
    const frozenContract = freezeScopeContractWithRoles(
      log.scopeContract,
      primaryRole as LearnerRole,
      (secondaryRoles || []) as LearnerRole[]
    );

    // Update the stored log
    log.scopeContract = frozenContract;
    log.roleSelectionNeeded = false;
    scopeContractLogs.set(contractId, log);

    // Update in DB if table exists
    try {
      await supabase
        .from('variant_scope_contracts')
        .update({
          scope_contract: frozenContract,
          role_selection_needed: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', contractId)
        .eq('organization_id', orgId);
    } catch (dbError) {
      console.log('[ScopeContract Route] DB update skipped:', (dbError as Error).message);
    }

    return c.json({
      contractId,
      scopeContract: frozenContract,
      roleSelectionNeeded: false
    });
  } catch (error: any) {
    console.error('Error freezing scope contract roles:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/scope-contract/:contractId
 * Retrieve a stored scope contract by ID.
 */
app.get('/variant/scope-contract/:contractId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const contractId = c.req.param('contractId');

    // Try in-memory first
    const log = scopeContractLogs.get(contractId);
    if (log) {
      return c.json({
        contractId: log.id,
        scopeContract: log.scopeContract,
        roleSelectionNeeded: log.roleSelectionNeeded,
        topRoleMatches: log.topRoleMatches,
        extractionMethod: log.extractionMethod,
        sourceTrackId: log.sourceTrackId,
        sourceTitle: log.sourceTitle,
        createdAt: log.timestamp
      });
    }

    // Try database
    const { data: dbLog, error: dbError } = await supabase
      .from('variant_scope_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('organization_id', orgId)
      .single();

    if (dbError || !dbLog) {
      return c.json({ error: 'Scope contract not found' }, 404);
    }

    return c.json({
      contractId: dbLog.id,
      scopeContract: dbLog.scope_contract,
      roleSelectionNeeded: dbLog.role_selection_needed,
      topRoleMatches: dbLog.top_role_matches,
      extractionMethod: dbLog.extraction_method,
      sourceTrackId: dbLog.source_track_id,
      createdAt: dbLog.created_at
    });
  } catch (error: any) {
    console.error('Error retrieving scope contract:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// RESEARCH PLAN ROUTES (State Variant Intelligence v2 - Prompt 2)
// ============================================================================

// In-memory storage for research plans (replace with DB in production)
const researchPlanLogs: Map<string, any> = new Map();

/**
 * Stub search provider - replace with real provider (Tavily, SerpAPI, etc.)
 */
class StubSearchProvider implements SearchProvider {
  async search(params: { query: string; maxResults: number }): Promise<SearchResult[]> {
    console.log('[StubSearch] Query:', params.query);
    // Return empty results - real implementation would call actual search API
    return [];
  }
}

/**
 * Stub fetch provider - replace with real implementation
 */
class StubFetchProvider implements FetchProvider {
  async fetchHtml(url: string): Promise<{ html: string; finalUrl?: string }> {
    console.log('[StubFetch] URL:', url);
    // Real implementation would fetch actual page content
    throw new Error('Fetch provider not configured');
  }
}

/**
 * POST /variant/research-plan
 * Generate a Research Plan from a Scope Contract.
 */
app.post('/variant/research-plan', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { contractId, scopeContract, stateCode, stateName, useLLM } = await c.req.json();

    if (!stateCode) {
      return c.json({ error: 'stateCode is required' }, 400);
    }

    // Get scope contract either from ID or directly provided
    let contract: ScopeContract;
    let resolvedContractId: string | undefined = contractId;

    if (contractId) {
      // Fetch from stored contract
      const log = scopeContractLogs.get(contractId);
      if (log) {
        contract = log.scopeContract;
      } else {
        // Try database
        const { data: dbLog, error: dbError } = await supabase
          .from('variant_scope_contracts')
          .select('scope_contract')
          .eq('id', contractId)
          .eq('organization_id', orgId)
          .single();

        if (dbError || !dbLog) {
          return c.json({ error: 'Scope contract not found' }, 404);
        }
        contract = dbLog.scope_contract;
      }
    } else if (scopeContract) {
      contract = scopeContract;
    } else {
      return c.json({ error: 'Either contractId or scopeContract is required' }, 400);
    }

    // Build research plan
    const planInput: ResearchPlanInput = {
      scopeContract: contract,
      contractId: resolvedContractId,
      stateCode,
      stateName,
    };

    console.log('[ResearchPlan Route] Building plan for:', stateCode);

    const plan = useLLM
      ? await buildResearchPlanWithLLM(planInput)
      : await buildResearchPlan(planInput);

    // Store log
    const log = createResearchPlanLog(plan);
    researchPlanLogs.set(plan.id, log);

    // Store in DB if table exists
    try {
      await supabase.from('variant_research_plans').insert({
        id: plan.id,
        organization_id: orgId,
        contract_id: resolvedContractId || null,
        state_code: stateCode,
        state_name: stateName || null,
        research_plan: plan,
        created_at: log.timestamp,
      });
      console.log('[ResearchPlan Route] Stored plan in DB:', plan.id);
    } catch (dbError) {
      console.log('[ResearchPlan Route] DB storage skipped:', (dbError as Error).message);
    }

    return c.json({
      planId: plan.id,
      researchPlan: plan,
      queryCount: plan.queries.length,
      globalNegativeCount: plan.globalNegativeTerms.length,
    });
  } catch (error: any) {
    console.error('Error building research plan:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /variant/retrieve-evidence
 * Execute a Research Plan and retrieve evidence.
 * Note: Requires configured search/fetch providers.
 */
app.post('/variant/retrieve-evidence', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { planId, researchPlan, contractId, scopeContract, sourceContent } = await c.req.json();

    // Get research plan
    let plan: ResearchPlan;
    if (planId) {
      const log = researchPlanLogs.get(planId);
      if (log) {
        plan = log.researchPlan;
      } else {
        // Try database
        const { data: dbLog, error: dbError } = await supabase
          .from('variant_research_plans')
          .select('research_plan')
          .eq('id', planId)
          .eq('organization_id', orgId)
          .single();

        if (dbError || !dbLog) {
          return c.json({ error: 'Research plan not found' }, 404);
        }
        plan = dbLog.research_plan;
      }
    } else if (researchPlan) {
      plan = researchPlan;
    } else {
      return c.json({ error: 'Either planId or researchPlan is required' }, 400);
    }

    // Get scope contract
    let contract: ScopeContract;
    if (contractId) {
      const log = scopeContractLogs.get(contractId);
      if (log) {
        contract = log.scopeContract;
      } else {
        const { data: dbLog } = await supabase
          .from('variant_scope_contracts')
          .select('scope_contract')
          .eq('id', contractId)
          .eq('organization_id', orgId)
          .single();
        if (!dbLog) {
          return c.json({ error: 'Scope contract not found' }, 404);
        }
        contract = dbLog.scope_contract;
      }
    } else if (scopeContract) {
      contract = scopeContract;
    } else {
      return c.json({ error: 'Either contractId or scopeContract is required' }, 400);
    }

    // Note: Real implementation needs configured providers
    // This stub returns empty results
    console.log('[Retrieval Route] Retrieval requested but providers not configured');

    const output: RetrievalOutput = {
      researchPlan: plan,
      evidence: [],
      rejected: [],
    };

    // Store results
    try {
      await supabase.from('variant_retrieval_results').insert({
        id: crypto.randomUUID(),
        organization_id: orgId,
        plan_id: plan.id,
        contract_id: contractId || null,
        evidence_count: output.evidence.length,
        rejected_count: output.rejected.length,
        retrieval_output: output,
        created_at: new Date().toISOString(),
      });
    } catch (dbError) {
      console.log('[Retrieval Route] DB storage skipped:', (dbError as Error).message);
    }

    return c.json({
      planId: plan.id,
      evidenceCount: output.evidence.length,
      rejectedCount: output.rejected.length,
      evidence: output.evidence,
      rejected: output.rejected,
      note: 'Search providers not configured - returning empty results',
    });
  } catch (error: any) {
    console.error('Error retrieving evidence:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/research-plan/:planId
 * Retrieve a stored research plan.
 */
app.get('/variant/research-plan/:planId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const planId = c.req.param('planId');

    // Try in-memory first
    const log = researchPlanLogs.get(planId);
    if (log) {
      return c.json({
        planId: log.researchPlan.id,
        researchPlan: log.researchPlan,
        retrievalOutput: log.retrievalOutput,
        createdAt: log.timestamp,
      });
    }

    // Try database
    const { data: dbLog, error: dbError } = await supabase
      .from('variant_research_plans')
      .select('*')
      .eq('id', planId)
      .eq('organization_id', orgId)
      .single();

    if (dbError || !dbLog) {
      return c.json({ error: 'Research plan not found' }, 404);
    }

    return c.json({
      planId: dbLog.id,
      researchPlan: dbLog.research_plan,
      createdAt: dbLog.created_at,
    });
  } catch (error: any) {
    console.error('Error retrieving research plan:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /variant/classify-source
 * Classify a URL's source tier (utility endpoint).
 */
app.post('/variant/classify-source', async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: 'url is required' }, 400);
    }

    const tier = classifySourceTier(url);

    return c.json({
      url,
      tier,
      isTier1: tier === 'tier1',
      isTier2: tier === 'tier2',
      isTier3: tier === 'tier3',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// KEY FACTS EXTRACTION ROUTES (State Variant Intelligence v2 - Prompt 3)
// ============================================================================

// In-memory storage for key facts extractions (replace with DB in production)
const keyFactsLogs: Map<string, KeyFactsExtractionResult> = new Map();

/**
 * POST /variant/key-facts
 * Extract Key Facts from evidence blocks.
 */
app.post('/variant/key-facts', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const {
      contractId,
      planId,
      scopeContract,
      researchPlan,
      evidenceBlocks,
      stateCode,
      stateName,
      sourceContent
    } = await c.req.json();

    if (!stateCode) {
      return c.json({ error: 'stateCode is required' }, 400);
    }

    // Get scope contract
    let contract: ScopeContract;
    if (contractId) {
      const log = scopeContractLogs.get(contractId);
      if (log) {
        contract = log.scopeContract;
      } else {
        const { data: dbLog } = await supabase
          .from('variant_scope_contracts')
          .select('scope_contract')
          .eq('id', contractId)
          .eq('organization_id', orgId)
          .single();
        if (!dbLog) {
          return c.json({ error: 'Scope contract not found' }, 404);
        }
        contract = dbLog.scope_contract;
      }
    } else if (scopeContract) {
      contract = scopeContract;
    } else {
      return c.json({ error: 'Either contractId or scopeContract is required' }, 400);
    }

    // Get research plan
    let plan: ResearchPlan;
    if (planId) {
      const log = researchPlanLogs.get(planId);
      if (log) {
        plan = log.researchPlan;
      } else {
        const { data: dbLog } = await supabase
          .from('variant_research_plans')
          .select('research_plan')
          .eq('id', planId)
          .eq('organization_id', orgId)
          .single();
        if (!dbLog) {
          return c.json({ error: 'Research plan not found' }, 404);
        }
        plan = dbLog.research_plan;
      }
    } else if (researchPlan) {
      plan = researchPlan;
    } else {
      return c.json({ error: 'Either planId or researchPlan is required' }, 400);
    }

    // Validate evidence blocks
    let evidence: EvidenceBlock[] = evidenceBlocks || [];
    if (evidence.length === 0) {
      // Try to get from retrieval results
      if (planId) {
        const { data: retrievalData } = await supabase
          .from('variant_retrieval_results')
          .select('retrieval_output')
          .eq('plan_id', planId)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (retrievalData?.retrieval_output?.evidence) {
          evidence = retrievalData.retrieval_output.evidence;
        }
      }
    }

    if (evidence.length === 0) {
      return c.json({
        error: 'No evidence blocks provided. Run evidence retrieval first.',
        hint: 'POST /variant/retrieve-evidence with configured search providers'
      }, 400);
    }

    // Build extraction input
    const input: KeyFactsExtractionInput = {
      scopeContract: contract,
      researchPlan: plan,
      evidenceBlocks: evidence,
      sourceContent,
      contractId,
      planId,
      stateCode,
      stateName,
    };

    console.log('[KeyFacts Route] Extracting facts for:', stateCode, 'from', evidence.length, 'evidence blocks');

    const result = await extractKeyFacts(input);

    // Store in memory
    keyFactsLogs.set(result.id, result);

    // Store in DB
    try {
      // Insert extraction record
      await supabase.from('variant_key_facts_extractions').insert({
        id: result.id,
        organization_id: orgId,
        contract_id: contractId || null,
        plan_id: planId || null,
        state_code: stateCode,
        state_name: stateName || null,
        extraction_method: result.extractionMethod,
        overall_status: result.overallStatus,
        key_facts_count: result.keyFacts.length,
        rejected_facts_count: result.rejectedFacts.length,
        gate_results: result.gateResults,
        raw_llm_response: result.rawLLMResponse || null,
        created_at: result.extractedAtISO,
      });

      // Insert individual key facts
      if (result.keyFacts.length > 0) {
        const keyFactRows = result.keyFacts.map(f => ({
          id: f.id,
          organization_id: orgId,
          extraction_id: result.id,
          fact_text: f.factText,
          mapped_action: f.mappedAction,
          anchor_hits: f.anchorHit,
          is_strong_claim: f.isStrongClaim,
          qa_status: f.qaStatus,
          qa_flags: f.qaFlags,
          citations: f.citations,
          created_at: f.createdAtISO,
        }));

        await supabase.from('variant_key_facts').insert(keyFactRows);
      }

      // Insert rejected facts
      if (result.rejectedFacts.length > 0) {
        const rejectedRows = result.rejectedFacts.map(f => ({
          id: crypto.randomUUID(),
          organization_id: orgId,
          extraction_id: result.id,
          fact_text: f.factText,
          reason: f.reason,
          failed_gates: f.failedGates,
          created_at: result.extractedAtISO,
        }));

        await supabase.from('variant_rejected_facts').insert(rejectedRows);
      }

      console.log('[KeyFacts Route] Stored extraction in DB:', result.id);
    } catch (dbError) {
      console.log('[KeyFacts Route] DB storage skipped:', (dbError as Error).message);
    }

    return c.json({
      extractionId: result.id,
      overallStatus: result.overallStatus,
      keyFactsCount: result.keyFacts.length,
      rejectedFactsCount: result.rejectedFacts.length,
      keyFacts: result.keyFacts,
      rejectedFacts: result.rejectedFacts,
      gateResults: result.gateResults,
      extractionMethod: result.extractionMethod,
    });
  } catch (error: any) {
    console.error('Error extracting key facts:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/key-facts/:extractionId
 * Retrieve a stored key facts extraction.
 */
app.get('/variant/key-facts/:extractionId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const extractionId = c.req.param('extractionId');

    // Try in-memory first
    const cached = keyFactsLogs.get(extractionId);
    if (cached) {
      return c.json({
        extractionId: cached.id,
        overallStatus: cached.overallStatus,
        keyFactsCount: cached.keyFacts.length,
        rejectedFactsCount: cached.rejectedFacts.length,
        keyFacts: cached.keyFacts,
        rejectedFacts: cached.rejectedFacts,
        gateResults: cached.gateResults,
        extractionMethod: cached.extractionMethod,
        extractedAt: cached.extractedAtISO,
      });
    }

    // Try database
    const { data: extraction, error: extractionError } = await supabase
      .from('variant_key_facts_extractions')
      .select('*')
      .eq('id', extractionId)
      .eq('organization_id', orgId)
      .single();

    if (extractionError || !extraction) {
      return c.json({ error: 'Key facts extraction not found' }, 404);
    }

    // Fetch associated key facts
    const { data: keyFacts } = await supabase
      .from('variant_key_facts')
      .select('*')
      .eq('extraction_id', extractionId)
      .eq('organization_id', orgId);

    // Fetch rejected facts
    const { data: rejectedFacts } = await supabase
      .from('variant_rejected_facts')
      .select('*')
      .eq('extraction_id', extractionId)
      .eq('organization_id', orgId);

    return c.json({
      extractionId: extraction.id,
      overallStatus: extraction.overall_status,
      keyFactsCount: extraction.key_facts_count,
      rejectedFactsCount: extraction.rejected_facts_count,
      keyFacts: (keyFacts || []).map((f: any) => ({
        id: f.id,
        factText: f.fact_text,
        mappedAction: f.mapped_action,
        anchorHit: f.anchor_hits,
        isStrongClaim: f.is_strong_claim,
        qaStatus: f.qa_status,
        qaFlags: f.qa_flags,
        citations: f.citations,
        createdAtISO: f.created_at,
      })),
      rejectedFacts: (rejectedFacts || []).map((f: any) => ({
        factText: f.fact_text,
        reason: f.reason,
        failedGates: f.failed_gates,
      })),
      gateResults: extraction.gate_results,
      extractionMethod: extraction.extraction_method,
      extractedAt: extraction.created_at,
    });
  } catch (error: any) {
    console.error('Error retrieving key facts extraction:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /variant/key-facts/:extractionId/update-status
 * Update the QA status of a specific key fact (for manual review).
 */
app.post('/variant/key-facts/:extractionId/update-status', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const extractionId = c.req.param('extractionId');
    const { factId, newStatus, reviewNote } = await c.req.json();

    if (!factId || !newStatus) {
      return c.json({ error: 'factId and newStatus are required' }, 400);
    }

    if (!['PASS', 'PASS_WITH_REVIEW', 'FAIL'].includes(newStatus)) {
      return c.json({ error: 'newStatus must be PASS, PASS_WITH_REVIEW, or FAIL' }, 400);
    }

    // Update in database
    const { error: updateError } = await supabase
      .from('variant_key_facts')
      .update({
        qa_status: newStatus,
        qa_flags: reviewNote
          ? Deno.env.get('__qa_flags_append') // This needs special handling
          : undefined
      })
      .eq('id', factId)
      .eq('extraction_id', extractionId)
      .eq('organization_id', orgId);

    if (updateError) {
      return c.json({ error: 'Failed to update key fact status' }, 500);
    }

    // Also update in-memory cache if present
    const cached = keyFactsLogs.get(extractionId);
    if (cached) {
      const fact = cached.keyFacts.find(f => f.id === factId);
      if (fact) {
        fact.qaStatus = newStatus as QAGateStatus;
        if (reviewNote) {
          fact.qaFlags.push(`Manual review: ${reviewNote}`);
        }
      }
    }

    return c.json({ success: true, factId, newStatus });
  } catch (error: any) {
    console.error('Error updating key fact status:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/key-facts/by-state/:stateCode
 * List all key fact extractions for a state.
 */
app.get('/variant/key-facts/by-state/:stateCode', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const stateCode = c.req.param('stateCode');
    const statusFilter = c.req.query('status') as QAGateStatus | undefined;

    let query = supabase
      .from('variant_key_facts_extractions')
      .select('id, state_code, state_name, overall_status, key_facts_count, rejected_facts_count, created_at')
      .eq('organization_id', orgId)
      .eq('state_code', stateCode.toUpperCase())
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('overall_status', statusFilter);
    }

    const { data: extractions, error } = await query;

    if (error) {
      return c.json({ error: 'Failed to fetch extractions' }, 500);
    }

    return c.json({
      stateCode: stateCode.toUpperCase(),
      extractions: extractions || [],
      count: extractions?.length || 0,
    });
  } catch (error: any) {
    console.error('Error listing key fact extractions:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /variant/validate-fact
 * Utility endpoint to validate a fact candidate against QA gates.
 */
app.post('/variant/validate-fact', async (c) => {
  try {
    const { factText, mappedAction, citations, scopeContract } = await c.req.json();

    if (!factText || !scopeContract) {
      return c.json({ error: 'factText and scopeContract are required' }, 400);
    }

    // Build a temporary fact candidate
    const tempFact: KeyFactCandidate = {
      id: crypto.randomUUID(),
      factText,
      mappedAction: mappedAction || scopeContract.allowedLearnerActions[0],
      anchorHit: [],
      citations: citations || [],
      isStrongClaim: isStrongClaim(factText),
      qaStatus: 'PASS',
      qaFlags: [],
      createdAtISO: new Date().toISOString(),
    };

    // Run QA gates
    const { status, flags, gateResults } = runAllGates(tempFact, scopeContract, []);

    return c.json({
      factText,
      isStrongClaim: tempFact.isStrongClaim,
      qaStatus: status,
      qaFlags: flags,
      gateResults,
    });
  } catch (error: any) {
    console.error('Error validating fact:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// VARIANT DRAFT ROUTES (State Variant Intelligence v2 - Prompt 4)
// ============================================================================

// In-memory storage for drafts (replace with DB in production)
const variantDraftsLogs: Map<string, VariantDraftOutput> = new Map();

/**
 * POST /variant/generate-draft
 * Generate a minimal-delta variant draft from validated key facts.
 */
app.post('/variant/generate-draft', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const {
      sourceTrackId,
      contractId,
      keyFactsExtractionId,
      // Optional direct inputs (alternative to IDs)
      sourceContent,
      sourceTitle,
      sourceTrackType,
      scopeContract,
      validatedKeyFacts,
      qualityGateStatus,
      stateCode,
      stateName,
    } = await c.req.json();

    // Validate required inputs
    if (!stateCode) {
      return c.json({ error: 'stateCode is required' }, 400);
    }

    // Get source track content
    let trackContent: string;
    let trackTitle: string;
    let trackType: TrackType;

    if (sourceTrackId) {
      const { data: track, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, type, content_text, transcript')
        .eq('id', sourceTrackId)
        .eq('organization_id', orgId)
        .single();

      if (trackError || !track) {
        return c.json({ error: 'Source track not found' }, 404);
      }

      trackContent = track.content_text || track.transcript || '';
      trackTitle = track.title;
      trackType = track.type as TrackType;
    } else if (sourceContent && sourceTitle && sourceTrackType) {
      trackContent = sourceContent;
      trackTitle = sourceTitle;
      trackType = sourceTrackType;
    } else {
      return c.json({ error: 'Either sourceTrackId or (sourceContent, sourceTitle, sourceTrackType) required' }, 400);
    }

    // Get scope contract
    let contract: ScopeContract;
    let resolvedContractId: string | undefined = contractId;

    if (contractId) {
      const log = scopeContractLogs.get(contractId);
      if (log) {
        contract = log.scopeContract;
      } else {
        const { data: dbLog } = await supabase
          .from('variant_scope_contracts')
          .select('scope_contract')
          .eq('id', contractId)
          .eq('organization_id', orgId)
          .single();
        if (!dbLog) {
          return c.json({ error: 'Scope contract not found' }, 404);
        }
        contract = dbLog.scope_contract;
      }
    } else if (scopeContract) {
      contract = scopeContract;
    } else {
      return c.json({ error: 'Either contractId or scopeContract is required' }, 400);
    }

    // Get validated key facts
    let keyFacts: KeyFactCandidate[];
    let gateStatus: QAGateStatus;
    let resolvedExtractionId: string | undefined = keyFactsExtractionId;

    if (keyFactsExtractionId) {
      const cached = keyFactsLogs.get(keyFactsExtractionId);
      if (cached) {
        keyFacts = cached.keyFacts;
        gateStatus = cached.overallStatus;
      } else {
        // Fetch from DB
        const { data: extraction } = await supabase
          .from('variant_key_facts_extractions')
          .select('overall_status')
          .eq('id', keyFactsExtractionId)
          .eq('organization_id', orgId)
          .single();

        if (!extraction) {
          return c.json({ error: 'Key facts extraction not found' }, 404);
        }

        gateStatus = extraction.overall_status as QAGateStatus;

        // Fetch key facts
        const { data: facts } = await supabase
          .from('variant_key_facts')
          .select('*')
          .eq('extraction_id', keyFactsExtractionId)
          .eq('organization_id', orgId);

        keyFacts = (facts || []).map((f: any) => ({
          id: f.id,
          factText: f.fact_text,
          mappedAction: f.mapped_action,
          anchorHit: f.anchor_hits || [],
          citations: f.citations || [],
          isStrongClaim: f.is_strong_claim,
          qaStatus: f.qa_status as QAGateStatus,
          qaFlags: f.qa_flags || [],
          createdAtISO: f.created_at,
        }));
      }
    } else if (validatedKeyFacts && qualityGateStatus) {
      keyFacts = validatedKeyFacts;
      gateStatus = qualityGateStatus;
    } else {
      return c.json({ error: 'Either keyFactsExtractionId or (validatedKeyFacts, qualityGateStatus) required' }, 400);
    }

    // Build draft input
    const input: VariantDraftInput = {
      sourceTrackType: trackType,
      sourceTitle: trackTitle,
      sourceContent: trackContent,
      scopeContract: contract,
      validatedKeyFacts: keyFacts,
      qualityGateStatus: gateStatus,
      variantContext: { stateCode, stateName },
      contractId: resolvedContractId,
      extractionId: resolvedExtractionId,
    };

    console.log('[VariantDraft Route] Generating draft for:', trackTitle, 'state:', stateCode);

    const result = await generateVariantDraft(input);

    // Store in memory
    variantDraftsLogs.set(result.draftId, result);

    // Store in DB
    try {
      // Insert draft
      await supabase.from('variant_drafts').insert({
        id: result.draftId,
        organization_id: orgId,
        contract_id: resolvedContractId || null,
        extraction_id: resolvedExtractionId || null,
        source_track_id: sourceTrackId || null,
        state_code: stateCode,
        state_name: stateName || null,
        track_type: result.trackType,
        status: result.status,
        draft_title: result.draftTitle,
        draft_content: result.draftContent,
        applied_key_fact_ids: result.appliedKeyFactIds,
        needs_review_key_fact_ids: result.needsReviewKeyFactIds,
        blocked_reasons: result.blockedReasons || null,
        diff_ops: result.diffOps,
        created_at: result.generatedAtISO,
      });

      // Insert change notes
      if (result.changeNotes.length > 0) {
        const noteRows = result.changeNotes.map(n => ({
          id: n.id,
          draft_id: result.draftId,
          organization_id: orgId,
          title: n.title,
          description: n.description,
          mapped_action: n.mappedAction,
          anchor_matches: n.anchorMatches,
          affected_range_start: n.affectedRange.start,
          affected_range_end: n.affectedRange.end,
          key_fact_ids: n.keyFactIds,
          citations: n.citations,
          status: n.status,
          created_at: result.generatedAtISO,
        }));

        await supabase.from('variant_change_notes').insert(noteRows);
      }

      console.log('[VariantDraft Route] Stored draft in DB:', result.draftId);
    } catch (dbError) {
      console.log('[VariantDraft Route] DB storage skipped:', (dbError as Error).message);
    }

    return c.json(result);
  } catch (error: any) {
    console.error('Error generating variant draft:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/draft/:draftId
 * Retrieve a stored variant draft.
 */
app.get('/variant/draft/:draftId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const draftId = c.req.param('draftId');

    // Try in-memory first
    const cached = variantDraftsLogs.get(draftId);
    if (cached) {
      return c.json(cached);
    }

    // Try database
    const { data: draft, error: draftError } = await supabase
      .from('variant_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('organization_id', orgId)
      .single();

    if (draftError || !draft) {
      return c.json({ error: 'Variant draft not found' }, 404);
    }

    // Fetch change notes
    const { data: changeNotes } = await supabase
      .from('variant_change_notes')
      .select('*')
      .eq('draft_id', draftId)
      .eq('organization_id', orgId);

    const result: VariantDraftOutput = {
      draftId: draft.id,
      status: draft.status as DraftStatus,
      trackType: draft.track_type as TrackType,
      draftTitle: draft.draft_title,
      draftContent: draft.draft_content,
      diffOps: draft.diff_ops || [],
      changeNotes: (changeNotes || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        description: n.description,
        mappedAction: n.mapped_action,
        anchorMatches: n.anchor_matches || [],
        affectedRange: { start: n.affected_range_start, end: n.affected_range_end },
        keyFactIds: n.key_fact_ids || [],
        citations: n.citations || [],
        status: n.status,
      })),
      appliedKeyFactIds: draft.applied_key_fact_ids || [],
      needsReviewKeyFactIds: draft.needs_review_key_fact_ids || [],
      blockedReasons: draft.blocked_reasons || undefined,
      contractId: draft.contract_id || undefined,
      extractionId: draft.extraction_id || undefined,
      stateCode: draft.state_code,
      stateName: draft.state_name || undefined,
      generatedAtISO: draft.created_at,
    };

    return c.json(result);
  } catch (error: any) {
    console.error('Error retrieving variant draft:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /variant/draft/:draftId/apply-instructions
 * Apply lightning bolt edit instructions to a draft.
 */
app.post('/variant/draft/:draftId/apply-instructions', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const draftId = c.req.param('draftId');
    const { instruction } = await c.req.json();

    if (!instruction) {
      return c.json({ error: 'instruction is required' }, 400);
    }

    // Get current draft
    let draft: VariantDraftOutput | null = null;

    const cached = variantDraftsLogs.get(draftId);
    if (cached) {
      draft = cached;
    } else {
      // Fetch from DB
      const { data: dbDraft } = await supabase
        .from('variant_drafts')
        .select('*')
        .eq('id', draftId)
        .eq('organization_id', orgId)
        .single();

      if (dbDraft) {
        draft = {
          draftId: dbDraft.id,
          status: dbDraft.status as DraftStatus,
          trackType: dbDraft.track_type as TrackType,
          draftTitle: dbDraft.draft_title,
          draftContent: dbDraft.draft_content,
          diffOps: dbDraft.diff_ops || [],
          changeNotes: [],
          appliedKeyFactIds: dbDraft.applied_key_fact_ids || [],
          needsReviewKeyFactIds: dbDraft.needs_review_key_fact_ids || [],
          blockedReasons: dbDraft.blocked_reasons || undefined,
          contractId: dbDraft.contract_id || undefined,
          extractionId: dbDraft.extraction_id || undefined,
          stateCode: dbDraft.state_code,
          stateName: dbDraft.state_name || undefined,
          generatedAtISO: dbDraft.created_at,
        };
      }
    }

    if (!draft) {
      return c.json({ error: 'Variant draft not found' }, 404);
    }

    // Get scope contract
    let contract: ScopeContract | null = null;
    if (draft.contractId) {
      const log = scopeContractLogs.get(draft.contractId);
      if (log) {
        contract = log.scopeContract;
      } else {
        const { data: dbLog } = await supabase
          .from('variant_scope_contracts')
          .select('scope_contract')
          .eq('id', draft.contractId)
          .eq('organization_id', orgId)
          .single();
        if (dbLog) {
          contract = dbLog.scope_contract;
        }
      }
    }

    if (!contract) {
      return c.json({ error: 'Scope contract not found for this draft' }, 404);
    }

    // Get validated key facts
    let keyFacts: KeyFactCandidate[] = [];
    if (draft.extractionId) {
      const cachedExtraction = keyFactsLogs.get(draft.extractionId);
      if (cachedExtraction) {
        keyFacts = cachedExtraction.keyFacts;
      } else {
        const { data: facts } = await supabase
          .from('variant_key_facts')
          .select('*')
          .eq('extraction_id', draft.extractionId)
          .eq('organization_id', orgId);

        keyFacts = (facts || []).map((f: any) => ({
          id: f.id,
          factText: f.fact_text,
          mappedAction: f.mapped_action,
          anchorHit: f.anchor_hits || [],
          citations: f.citations || [],
          isStrongClaim: f.is_strong_claim,
          qaStatus: f.qa_status as QAGateStatus,
          qaFlags: f.qa_flags || [],
          createdAtISO: f.created_at,
        }));
      }
    }

    // Apply instructions
    const applyInput: ApplyInstructionsInput = {
      draftId,
      instruction,
      currentDraftContent: draft.draftContent,
      scopeContract: contract,
      validatedKeyFacts: keyFacts,
      stateCode: draft.stateCode,
      stateName: draft.stateName,
    };

    console.log('[VariantDraft Route] Applying instruction to draft:', draftId);

    const result = await applyInstructions(applyInput);

    // Update draft if content changed
    if (result.draftContent !== draft.draftContent) {
      // Update in-memory
      draft.draftContent = result.draftContent;
      draft.diffOps = result.diffOps;
      draft.changeNotes = result.changeNotes;
      draft.appliedKeyFactIds = [...new Set([...draft.appliedKeyFactIds, ...result.appliedKeyFactIds])];
      variantDraftsLogs.set(draftId, draft);

      // Update in DB
      try {
        await supabase
          .from('variant_drafts')
          .update({
            draft_content: result.draftContent,
            diff_ops: result.diffOps,
            applied_key_fact_ids: draft.appliedKeyFactIds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId)
          .eq('organization_id', orgId);

        // Store edit history
        await supabase.from('variant_draft_history').insert({
          id: crypto.randomUUID(),
          draft_id: draftId,
          organization_id: orgId,
          instruction,
          previous_content: draft.draftContent,
          new_content: result.draftContent,
          diff_ops: result.diffOps,
          change_notes: result.changeNotes,
          applied_key_fact_ids: result.appliedKeyFactIds,
          blocked_changes: result.blockedChanges.length > 0 ? result.blockedChanges : null,
          created_at: new Date().toISOString(),
        });
      } catch (dbError) {
        console.log('[VariantDraft Route] DB update skipped:', (dbError as Error).message);
      }
    }

    return c.json({
      draftId,
      draftContent: result.draftContent,
      diffOps: result.diffOps,
      changeNotes: result.changeNotes,
      blockedChanges: result.blockedChanges,
      appliedKeyFactIds: result.appliedKeyFactIds,
    });
  } catch (error: any) {
    console.error('Error applying instructions to draft:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/drafts/by-state/:stateCode
 * List all variant drafts for a state.
 */
app.get('/variant/drafts/by-state/:stateCode', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const stateCode = c.req.param('stateCode');
    const statusFilter = c.req.query('status') as DraftStatus | undefined;

    let query = supabase
      .from('variant_drafts')
      .select('id, state_code, state_name, track_type, status, draft_title, created_at')
      .eq('organization_id', orgId)
      .eq('state_code', stateCode.toUpperCase())
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: drafts, error } = await query;

    if (error) {
      return c.json({ error: 'Failed to fetch drafts' }, 500);
    }

    return c.json({
      stateCode: stateCode.toUpperCase(),
      drafts: drafts || [],
      count: drafts?.length || 0,
    });
  } catch (error: any) {
    console.error('Error listing variant drafts:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /variant/draft/:draftId/history
 * Get edit history for a draft.
 */
app.get('/variant/draft/:draftId/history', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const draftId = c.req.param('draftId');

    const { data: history, error } = await supabase
      .from('variant_draft_history')
      .select('*')
      .eq('draft_id', draftId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch draft history' }, 500);
    }

    return c.json({
      draftId,
      history: (history || []).map((h: any) => ({
        id: h.id,
        instruction: h.instruction,
        diffOps: h.diff_ops,
        changeNotes: h.change_notes,
        appliedKeyFactIds: h.applied_key_fact_ids,
        blockedChanges: h.blocked_changes,
        createdAt: h.created_at,
      })),
      count: history?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching draft history:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// AI-ASSISTED VARIANT GENERATION ROUTES
// ============================================================================

// POST /variant/chat
app.post('/variant/chat', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, variantType, variantContext, messages } = await c.req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return c.json({ error: 'sourceTrackId, variantType, and variantContext are required' }, 400);
    }

    // Fetch source track content
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('title, type, content_text, transcript')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) {
      return c.json({ error: 'Source track not found' }, 404);
    }

    const sourceContent = track.content_text || track.transcript || '';
    const systemPrompt = getVariantSystemPrompt(variantType, variantContext, track.type);

    let apiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (!messages || messages.length === 0) {
      // First message - use clarification prompt
      const firstMessage = getClarificationPrompt(variantType, variantContext, sourceContent);
      apiMessages.push({ role: 'user', content: firstMessage });
    } else {
      apiMessages = [...apiMessages, ...messages];
    }

    // Check if we should signal "ready to generate"
    const isReadyToGenerate = messages && messages.length >= 4; // After ~2 user responses

    return streamText(c, async (stream) => {
      const completion = streamChatCompletion(apiMessages, { temperature: 0.7 });
      
      for await (const chunk of completion) {
        await stream.write(chunk);
      }

      if (isReadyToGenerate) {
        await stream.write('\n\n[READY_TO_GENERATE]');
      }
    });
  } catch (error: any) {
    console.error('Error in /variant/chat:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /variant/generate
app.post('/variant/generate', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const orgId = await getOrgIdFromToken(accessToken);

    if (!orgId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sourceTrackId, variantType, variantContext, clarificationAnswers } = await c.req.json();

    if (!sourceTrackId || !variantType || !variantContext) {
      return c.json({ error: 'sourceTrackId, variantType, and variantContext are required' }, 400);
    }

    // Fetch source track content
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', sourceTrackId)
      .eq('organization_id', orgId)
      .single();

    if (trackError || !track) {
      return c.json({ error: 'Source track not found' }, 404);
    }

    const sourceContent = track.content_text || track.transcript || '';
    
    const qaContent = clarificationAnswers 
      ? clarificationAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : 'No specific clarifications provided.';

    const generationPrompt = `
Source Content:
${sourceContent}

Variant Context:
- Type: ${variantType}
- Details: ${JSON.stringify(variantContext)}

Clarification Answers:
${qaContent}

TASK: Generate the adapted content for this variant.
Maintain the exact same structure as the source.
Return the output in the following JSON format:
{
  "generatedTitle": "Suggested variant title",
  "generatedContent": "The adapted HTML/text content",
  "adaptations": [
    {
      "section": "Name of section",
      "originalText": "...",
      "adaptedText": "...",
      "reason": "..."
    }
  ]
}
`;

    const systemPrompt = getVariantSystemPrompt(variantType, variantContext, track.type);
    
    const response = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: generationPrompt }
    ], {
      temperature: 0.3, // More deterministic for generation
      response_format: { type: 'json_object' }
    });

    try {
      const parsed = JSON.parse(response);
      return c.json(parsed);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', response);
      return c.json({ 
        generatedTitle: `${track.title} (${variantType} variant)`,
        generatedContent: response,
        adaptations: []
      });
    }
  } catch (error: any) {
    console.error('Error in /variant/generate:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
