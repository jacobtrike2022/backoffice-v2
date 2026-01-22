// ============================================================================
// TRACK RELATIONSHIPS CRUD OPERATIONS (Frontend)
// ============================================================================

import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { supabase } from '../supabase';

export interface VariantContext {
  // Geographic
  state_code?: string;
  state_name?: string;

  // Company
  org_id?: string;
  org_name?: string;

  // Unit
  store_id?: string;
  store_name?: string;

  // Lineage tracking
  parent_variant_id?: string;  // Immediate parent if chained
  lineage?: string[];          // [base_id, parent_variant_id, ...]

  // Sync tracking
  base_synced_at?: string;     // ISO timestamp when variant was last synced with base
}

export type VariantType = 'geographic' | 'company' | 'unit';

export interface TrackRelationship {
  id: string;
  source_track_id: string;
  derived_track_id: string;
  relationship_type: 'source' | 'prerequisite' | 'related' | 'variant';
  variant_type?: VariantType | null;
  variant_context?: VariantContext | null;
  created_at: string;
  source_track?: {
    id: string;
    title: string;
    type: string;
    thumbnail_url: string;
    status: string;
    updated_at?: string;  // For base update detection
  };
  derived_track?: {
    id: string;
    title: string;
    type: string;
    thumbnail_url: string;
    status: string;
  };
}

export interface RelationshipStats {
  derivedCount: number;
  sourceCount: number;
  hasDerivedCheckpoints: boolean;
  variantCount?: number;
  variants?: {
    geographic: number;
    company: number;
    unit: number;
  };
  variantsNeedingReview?: number;
}

/**
 * Get access token for authenticated requests
 */
async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    // In demo mode, use the public anon key instead
    return publicAnonKey;
  }
  return session.access_token;
}

/**
 * Create a relationship between tracks
 */
export async function createTrackRelationship(
  sourceTrackId: string,
  derivedTrackId: string,
  relationshipType: 'source' | 'prerequisite' | 'related' = 'source'
): Promise<TrackRelationship> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sourceTrackId,
      derivedTrackId,
      relationshipType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create track relationship');
  }

  const data = await response.json();
  return data.relationship;
}

/**
 * Get all tracks derived from a source track (children)
 */
export async function getDerivedTracks(
  sourceTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();
  
  let url = `${getServerUrl()}/track-relationships/derived/${sourceTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch derived tracks');
  }

  const data = await response.json();
  return data.derived;
}

/**
 * Get the source track for a derived track (parent) - returns first source for backward compatibility
 */
export async function getSourceTrack(
  derivedTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  let url = `${getServerUrl()}/track-relationships/source/${derivedTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch source track');
  }

  const data = await response.json();
  return data.source;
}

/**
 * Get all source tracks for a derived track (supports multiple sources)
 */
export async function getSourceTracks(
  derivedTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  let url = `${getServerUrl()}/track-relationships/source/${derivedTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch source tracks');
  }

  const data = await response.json();
  return data.sources || (data.source ? [data.source] : []);
}

/**
 * Get relationship statistics for a track
 */
export async function getTrackRelationshipStats(
  trackId: string
): Promise<RelationshipStats> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/stats/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch relationship stats');
  }

  const data = await response.json();
  return data.stats;
}

/**
 * Delete a track relationship
 */
export async function deleteTrackRelationship(relationshipId: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/${relationshipId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete track relationship');
  }
}

// ============================================================================
// VARIANT RELATIONSHIP FUNCTIONS
// ============================================================================

/**
 * Create a variant relationship between tracks
 */
export async function createVariantRelationship(
  sourceTrackId: string,
  derivedTrackId: string,
  variantType: VariantType,
  variantContext: VariantContext
): Promise<TrackRelationship> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sourceTrackId,
      derivedTrackId,
      variantType,
      variantContext,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create variant relationship');
  }

  const data = await response.json();
  return data.relationship;
}

/**
 * Get all variants of a track
 */
export async function getTrackVariants(
  trackId: string,
  variantType?: VariantType
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  let url = `${getServerUrl()}/track-relationships/variants/${trackId}`;
  if (variantType) {
    url += `?type=${variantType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Track variants endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch track variants');
  }

  const data = await response.json();
  return data.variants;
}

/**
 * Find variant for specific context (e.g., find TX variant)
 */
export async function findVariantByContext(
  sourceTrackId: string,
  variantType: VariantType,
  contextKey: string,
  contextValue: string
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  const params = new URLSearchParams({
    sourceTrackId,
    variantType,
    contextKey,
    contextValue,
  });

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/find?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Find variant endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to find variant');
  }

  const data = await response.json();
  return data.variant;
}

/**
 * Get the "base" track for a variant (inverse lookup)
 */
export async function getBaseTrackForVariant(
  variantTrackId: string
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/base/${variantTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Base track endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get base track');
  }

  const data = await response.json();
  return data.baseTrack;
}

/**
 * Get relationship statistics including variant counts
 */
export async function getTrackRelationshipStatsWithVariants(
  trackId: string
): Promise<RelationshipStats> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/stats-with-variants/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Stats with variants endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch relationship stats with variants');
  }

  const data = await response.json();
  return data.stats;
}

/**
 * Get full variant tree (all descendants)
 */
export async function getVariantTree(
  trackId: string
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant-tree/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Variant tree endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch variant tree');
  }

  const data = await response.json();
  return data.tree;
}

/**
 * Get parent variant (immediate parent in chain)
 */
export async function getParentVariant(
  variantTrackId: string
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/parent/${variantTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Parent variant endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get parent variant');
  }

  const data = await response.json();
  return data.parentVariant;
}

/**
 * Get variants needing review (base was updated after they were synced)
 */
export async function getVariantsNeedingReview(
  baseTrackId: string
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variants/needs-review/${baseTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Variants needing review endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get variants needing review');
  }

  const data = await response.json();
  return data.variantsNeedingReview;
}

/**
 * Mark variant as synced with base (after admin reviews)
 */
export async function markVariantSynced(
  relationshipId: string
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/mark-synced/${relationshipId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Mark synced endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to mark variant as synced');
  }
}

/**
 * Get ultimate base track for any variant (walks up the chain)
 */
export async function getUltimateBaseTrack(
  variantTrackId: string
): Promise<{ baseTrack: TrackRelationship | null; depth: number }> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/ultimate-base/${variantTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
      console.error(`Ultimate base track endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get ultimate base track');
  }

  const data = await response.json();
  return data;
}

// ============================================================================
// SCOPE CONTRACT FUNCTIONS (State Variant Intelligence v2)
// ============================================================================

export type LearnerRole =
  | 'frontline_store_associate'
  | 'manager_supervisor'
  | 'delivery_driver'
  | 'owner_executive'
  | 'back_office_admin'
  | 'other';

export interface ScopeContract {
  primaryRole: LearnerRole;
  secondaryRoles: LearnerRole[];
  roleConfidence: 'high' | 'medium' | 'low';
  roleEvidenceQuotes: string[];
  allowedLearnerActions: string[];
  disallowedActionClasses: string[];
  domainAnchors: string[];
  instructionalGoal: string;
}

export interface OrgRoleMatch {
  roleId: string;
  roleName: string;
  score: number;
  why: string;
}

export interface ScopeContractResponse {
  contractId: string;
  scopeContract: ScopeContract;
  roleSelectionNeeded: boolean;
  topRoleMatches?: OrgRoleMatch[];
  extractionMethod: 'llm' | 'fallback';
  validationErrors?: string[];
  sourceTrackId?: string;
  sourceTitle?: string;
  createdAt?: string;
}

/**
 * Build a Scope Contract for a source track.
 * This is the first step in the v2 variant pipeline.
 */
export async function buildScopeContract(
  sourceTrackId: string,
  variantType: VariantType,
  variantContext: VariantContext,
  includeOrgRoles: boolean = true
): Promise<ScopeContractResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/scope-contract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sourceTrackId,
      variantType,
      variantContext,
      includeOrgRoles,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to build scope contract');
  }

  return response.json();
}

/**
 * Freeze a Scope Contract with user-selected roles.
 * Call this after user confirms role selection in UI.
 */
export async function freezeScopeContractRoles(
  contractId: string,
  primaryRole: LearnerRole,
  secondaryRoles: LearnerRole[] = []
): Promise<ScopeContractResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/scope-contract/${contractId}/freeze-roles`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        primaryRole,
        secondaryRoles,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to freeze scope contract roles');
  }

  return response.json();
}

/**
 * Retrieve a stored Scope Contract by ID.
 */
export async function getScopeContract(
  contractId: string
): Promise<ScopeContractResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/scope-contract/${contractId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get scope contract');
  }

  return response.json();
}

// ============================================================================
// RESEARCH PLAN FUNCTIONS (State Variant Intelligence v2 - Prompt 2)
// ============================================================================

export type EvidenceTargetType =
  | 'statute'
  | 'regulation'
  | 'agency_guidance'
  | 'enforcement_policy'
  | 'forms_or_signage'
  | 'unknown';

export interface ResearchQuery {
  id: string;
  query: string;
  mappedAction: string;
  anchorTerms: string[];
  negativeTerms: string[];
  targetType: EvidenceTargetType;
  why: string;
}

export interface ResearchPlan {
  id: string;
  stateCode: string;
  stateName?: string;
  generatedAtISO: string;
  contractId?: string;
  primaryRole: LearnerRole;
  queries: ResearchQuery[];
  globalNegativeTerms: string[];
  sourcePolicy: {
    preferTier1: boolean;
    allowTier2Justia: boolean;
    forbidTier3ForStrongClaims: boolean;
  };
}

export interface ResearchPlanResponse {
  planId: string;
  researchPlan: ResearchPlan;
  queryCount: number;
  globalNegativeCount: number;
}

export type SourceTier = 'tier1' | 'tier2' | 'tier3' | 'unknown';

export interface EvidenceSnippet {
  text: string;
  context?: string;
}

export interface EvidenceBlock {
  evidenceId: string;
  queryId: string;
  url: string;
  hostname: string;
  title?: string;
  publisher?: string;
  tier: SourceTier;
  retrievedAtISO: string;
  effectiveDate?: string | null;
  updatedDate?: string | null;
  snippets: EvidenceSnippet[];
  rawTextHash?: string;
}

export interface RetrievalRejection {
  url: string;
  reason: string;
  matchedDisallowedTerms?: string[];
  roleMismatch?: boolean;
  anchorMismatch?: boolean;
}

export interface RetrievalResponse {
  planId: string;
  evidenceCount: number;
  rejectedCount: number;
  evidence: EvidenceBlock[];
  rejected: RetrievalRejection[];
  note?: string;
}

/**
 * Build a Research Plan from a Scope Contract.
 */
export async function buildResearchPlan(
  contractIdOrContract: string | ScopeContract,
  stateCode: string,
  stateName?: string,
  useLLM: boolean = false
): Promise<ResearchPlanResponse> {
  const accessToken = await getAccessToken();

  const body: Record<string, unknown> = {
    stateCode,
    stateName,
    useLLM,
  };

  if (typeof contractIdOrContract === 'string') {
    body.contractId = contractIdOrContract;
  } else {
    body.scopeContract = contractIdOrContract;
  }

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/research-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to build research plan');
  }

  return response.json();
}

/**
 * Execute a Research Plan and retrieve evidence.
 */
export async function retrieveEvidence(
  planIdOrPlan: string | ResearchPlan,
  contractIdOrContract: string | ScopeContract,
  sourceContent?: string
): Promise<RetrievalResponse> {
  const accessToken = await getAccessToken();

  const body: Record<string, unknown> = {};

  if (typeof planIdOrPlan === 'string') {
    body.planId = planIdOrPlan;
  } else {
    body.researchPlan = planIdOrPlan;
  }

  if (typeof contractIdOrContract === 'string') {
    body.contractId = contractIdOrContract;
  } else {
    body.scopeContract = contractIdOrContract;
  }

  if (sourceContent) {
    body.sourceContent = sourceContent;
  }

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/retrieve-evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to retrieve evidence');
  }

  return response.json();
}

/**
 * Retrieve a stored Research Plan by ID.
 */
export async function getResearchPlan(
  planId: string
): Promise<{ planId: string; researchPlan: ResearchPlan; createdAt?: string }> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/research-plan/${planId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get research plan');
  }

  return response.json();
}

/**
 * Classify a URL's source tier.
 */
export async function classifySourceTier(
  url: string
): Promise<{ url: string; tier: SourceTier; isTier1: boolean; isTier2: boolean; isTier3: boolean }> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/classify-source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to classify source');
  }

  return response.json();
}

// ============================================================================
// KEY FACTS FUNCTIONS (State Variant Intelligence v2 - Prompt 3)
// ============================================================================

export type QAGateStatus = 'PASS' | 'PASS_WITH_REVIEW' | 'FAIL';

export interface KeyFactCitation {
  evidenceId: string;
  snippetIndex: number;
  tier: SourceTier;
  hostname: string;
  url: string;
  effectiveDate?: string | null;
  quote: string;
}

export interface KeyFactCandidate {
  id: string;
  factText: string;
  mappedAction: string;
  anchorHit: string[];
  citations: KeyFactCitation[];
  isStrongClaim: boolean;
  qaStatus: QAGateStatus;
  qaFlags: string[];
  createdAtISO: string;
}

export interface RejectedFact {
  factText: string;
  reason: string;
  failedGates: string[];
}

export interface QualityGateResult {
  gate: string;
  gateName: string;
  status: QAGateStatus;
  reason: string;
  details?: Record<string, unknown>;
}

export interface KeyFactsExtractionResponse {
  extractionId: string;
  overallStatus: QAGateStatus;
  keyFactsCount: number;
  rejectedFactsCount: number;
  keyFacts: KeyFactCandidate[];
  rejectedFacts: RejectedFact[];
  gateResults: QualityGateResult[];
  extractionMethod: 'llm' | 'fallback';
  extractedAt?: string;
}

/**
 * Extract Key Facts from evidence blocks.
 */
export async function extractKeyFacts(
  contractIdOrContract: string | ScopeContract,
  planIdOrPlan: string | ResearchPlan,
  evidenceBlocks: EvidenceBlock[],
  stateCode: string,
  stateName?: string,
  sourceContent?: string
): Promise<KeyFactsExtractionResponse> {
  const accessToken = await getAccessToken();

  const body: Record<string, unknown> = {
    stateCode,
    stateName,
    evidenceBlocks,
  };

  if (typeof contractIdOrContract === 'string') {
    body.contractId = contractIdOrContract;
  } else {
    body.scopeContract = contractIdOrContract;
  }

  if (typeof planIdOrPlan === 'string') {
    body.planId = planIdOrPlan;
  } else {
    body.researchPlan = planIdOrPlan;
  }

  if (sourceContent) {
    body.sourceContent = sourceContent;
  }

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/key-facts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to extract key facts');
  }

  return response.json();
}

/**
 * Retrieve a stored Key Facts extraction by ID.
 */
export async function getKeyFactsExtraction(
  extractionId: string
): Promise<KeyFactsExtractionResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/key-facts/${extractionId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get key facts extraction');
  }

  return response.json();
}

/**
 * Update the QA status of a specific key fact (for manual review).
 */
export async function updateKeyFactStatus(
  extractionId: string,
  factId: string,
  newStatus: QAGateStatus,
  reviewNote?: string
): Promise<{ success: boolean; factId: string; newStatus: QAGateStatus }> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/key-facts/${extractionId}/update-status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        factId,
        newStatus,
        reviewNote,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to update key fact status');
  }

  return response.json();
}

/**
 * List all key fact extractions for a state.
 */
export async function getKeyFactsByState(
  stateCode: string,
  statusFilter?: QAGateStatus
): Promise<{
  stateCode: string;
  extractions: Array<{
    id: string;
    state_code: string;
    state_name?: string;
    overall_status: QAGateStatus;
    key_facts_count: number;
    rejected_facts_count: number;
    created_at: string;
  }>;
  count: number;
}> {
  const accessToken = await getAccessToken();

  let url = `${getServerUrl()}/track-relationships/variant/key-facts/by-state/${stateCode}`;
  if (statusFilter) {
    url += `?status=${statusFilter}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to list key facts by state');
  }

  return response.json();
}

/**
 * Validate a fact candidate against QA gates (utility function).
 */
export async function validateFact(
  factText: string,
  scopeContract: ScopeContract,
  mappedAction?: string,
  citations?: KeyFactCitation[]
): Promise<{
  factText: string;
  isStrongClaim: boolean;
  qaStatus: QAGateStatus;
  qaFlags: string[];
  gateResults: QualityGateResult[];
}> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/validate-fact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      factText,
      scopeContract,
      mappedAction,
      citations,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to validate fact');
  }

  return response.json();
}

// ============================================================================
// DRAFT GENERATION FUNCTIONS (State Variant Intelligence v2 - Prompt 4)
// ============================================================================

export type DraftStatus = 'generated' | 'generated_needs_review' | 'blocked';
export type ChangeNoteStatus = 'applied' | 'needs_review' | 'blocked';

export interface DiffOp {
  id: string;
  type: 'insert' | 'delete' | 'replace';
  sourceStart: number;
  sourceEnd: number;
  draftStart: number;
  draftEnd: number;
  oldText: string;
  newText: string;
  noteId: string;
}

export interface CitationRef {
  url: string;
  tier: SourceTier;
  snippet: string;
  title?: string;
  hostname?: string;
  effectiveOrUpdatedDate?: string;
}

export interface ChangeNote {
  id: string;
  title: string;
  description: string;
  mappedAction: string;
  anchorMatches: string[];
  affectedRangeStart: number;
  affectedRangeEnd: number;
  keyFactIds: string[];
  citations: CitationRef[];
  status: ChangeNoteStatus;
}

export interface VariantDraft {
  draftId: string;
  contractId: string;
  extractionId: string;
  sourceTrackId: string;
  stateCode: string;
  stateName?: string;
  trackType: 'article' | 'video' | 'story' | 'checkpoint';
  status: DraftStatus;
  draftTitle: string;
  draftContent: string;
  sourceContent: string;
  diffOps: DiffOp[];
  changeNotes: ChangeNote[];
  appliedKeyFactIds: string[];
  needsReviewKeyFactIds: string[];
  blockedReasons?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerateDraftInput {
  contractId: string;
  extractionId: string;
  sourceTrackId: string;
  stateCode: string;
  stateName?: string;
  sourceContent: string;
  sourceTitle: string;
  trackType: 'article' | 'video' | 'story' | 'checkpoint';
}

export interface GenerateDraftResponse {
  draft: VariantDraft;
  success: boolean;
  message?: string;
}

export interface ApplyInstructionsInput {
  draftId: string;
  instruction: string;
  contractId?: string;
  extractionId?: string;
}

export interface ApplyInstructionsResponse {
  draft: VariantDraft;
  success: boolean;
  changesApplied: number;
  blockedChanges?: Array<{
    reason: string;
    suggestedText: string;
  }>;
  message?: string;
}

/**
 * Generate a variant draft from validated key facts.
 */
export async function generateDraft(
  input: GenerateDraftInput
): Promise<GenerateDraftResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/generate-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to generate draft');
  }

  return response.json();
}

/**
 * Get a variant draft by ID.
 */
export async function getDraft(draftId: string): Promise<VariantDraft> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/draft/${draftId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get draft');
  }

  return response.json();
}

/**
 * Apply instructions to a draft (lightning bolt iterative edits).
 */
export async function applyInstructions(
  input: ApplyInstructionsInput
): Promise<ApplyInstructionsResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/draft/${input.draftId}/apply-instructions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instruction: input.instruction,
        contractId: input.contractId,
        extractionId: input.extractionId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to apply instructions');
  }

  return response.json();
}

/**
 * Update draft status (for publish workflow).
 */
export async function updateDraftStatus(
  draftId: string,
  status: DraftStatus,
  reviewedBy?: string
): Promise<VariantDraft> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/draft/${draftId}/status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        status,
        reviewedBy,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to update draft status');
  }

  return response.json();
}

/**
 * Publish a draft as a new variant track.
 */
export async function publishDraft(
  draftId: string,
  options?: {
    skipReviewCheck?: boolean;
    publishedBy?: string;
  }
): Promise<{
  variantTrackId: string;
  relationshipId: string;
  success: boolean;
}> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/draft/${draftId}/publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(options || {}),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to publish draft');
  }

  return response.json();
}

/**
 * Get all drafts for a source track.
 */
export async function getDraftsForTrack(
  sourceTrackId: string,
  stateCode?: string
): Promise<VariantDraft[]> {
  const accessToken = await getAccessToken();

  let url = `${getServerUrl()}/track-relationships/variant/drafts/${sourceTrackId}`;
  if (stateCode) {
    url += `?stateCode=${encodeURIComponent(stateCode)}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to get drafts');
  }

  const data = await response.json();
  return data.drafts || [];
}

/**
 * Delete a draft.
 */
export async function deleteDraft(draftId: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${getServerUrl()}/track-relationships/variant/draft/${draftId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete draft');
  }
}