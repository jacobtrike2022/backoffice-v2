// ============================================================================
// RESEARCH PLAN & RETRIEVAL - State Variant Intelligence v2
// ============================================================================
// Prompt 2: Generate constrained research plans and retrieve evidence
// without scope creep. All queries must be tied to the Scope Contract.
// ============================================================================

import { chatCompletion, type ChatMessage } from '../../supabase/functions/server/utils/openai.ts';
import type { ScopeContract, LearnerRole } from './scopeContract.ts';

// ============================================================================
// TYPES
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
  query: string;                   // final query string sent to search provider
  mappedAction: string;            // must be one of scope.allowedLearnerActions
  anchorTerms: string[];           // subset of scope.domainAnchors used in query
  negativeTerms: string[];         // derived from scope.disallowedActionClasses
  targetType: EvidenceTargetType;
  why: string;                     // 1 sentence: what learner behavior this clarifies
}

export interface ResearchPlan {
  id: string;
  stateCode: string;
  stateName?: string;
  generatedAtISO: string;
  contractId?: string;
  primaryRole: LearnerRole;
  queries: ResearchQuery[];         // 6–15 max
  globalNegativeTerms: string[];    // used across all queries
  sourcePolicy: {
    preferTier1: boolean;
    allowTier2Justia: boolean;
    forbidTier3ForStrongClaims: boolean;
  };
}

export type SourceTier = 'tier1' | 'tier2' | 'tier3' | 'unknown';

export interface EvidenceSnippet {
  text: string;                    // short excerpt, 1–3 sentences
  context?: string;                // optional surrounding context
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

  // dates (best effort)
  effectiveDate?: string | null;
  updatedDate?: string | null;

  // content
  snippets: EvidenceSnippet[];     // 1–5 max
  rawTextHash?: string;            // optional: hash of fetched content for audit/debug
}

export interface RetrievalRejection {
  url: string;
  reason: string;                  // deterministic reason
  matchedDisallowedTerms?: string[];
  roleMismatch?: boolean;
  anchorMismatch?: boolean;
}

export interface RetrievalOutput {
  researchPlan: ResearchPlan;
  evidence: EvidenceBlock[];
  rejected: RetrievalRejection[];
}

export interface ResearchPlanInput {
  scopeContract: ScopeContract;
  contractId?: string;
  stateCode: string;
  stateName?: string;
  sourceContent?: string;          // original content for context-aware negatives
}

// ============================================================================
// PROVIDER ABSTRACTIONS
// ============================================================================

export interface SearchResult {
  url: string;
  title?: string;
  snippet?: string;
}

export interface SearchProvider {
  search(params: { query: string; maxResults: number }): Promise<SearchResult[]>;
}

export interface FetchProvider {
  fetchHtml(url: string): Promise<{ html: string; finalUrl?: string }>;
}

// ============================================================================
// SOURCE TIER CLASSIFICATION
// ============================================================================

// Tier 1: Official government/legal sources
const TIER1_PATTERNS = [
  /\.gov$/i,
  /\.state\.[a-z]{2}\.us$/i,
  /legislature\./i,
  /legis\./i,
  /\.courts\./i,
  /admin\.code\./i,
  /dph\.[a-z]+\.gov/i,
  /tax\.[a-z]+\.gov/i,
  /swrcb\./i,
  /epa\.gov/i,
  /osha\.gov/i,
  /atf\.gov/i,
];

// State agency patterns (common across states)
const STATE_AGENCY_PATTERNS = [
  /department.*health/i,
  /department.*revenue/i,
  /department.*environment/i,
  /department.*labor/i,
  /attorney.*general/i,
  /secretary.*state/i,
];

// Tier 2: Reputable legal publishers
const TIER2_DOMAINS = [
  'justia.com',
  'law.cornell.edu',
  'findlaw.com',
  'lexisnexis.com',
  'westlaw.com',
  'casetext.com',
  'nolo.com',
];

// Tier 3 / Blocked: Known low-quality sources
const TIER3_BLOCKED_PATTERNS = [
  /reddit\.com/i,
  /quora\.com/i,
  /yahoo\.answers/i,
  /ehow\.com/i,
  /wikihow\.com/i,
  /medium\.com/i,
  /blog\./i,
  /wordpress\.com/i,
];

export function classifySourceTier(url: string): SourceTier {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check Tier 1 patterns
    for (const pattern of TIER1_PATTERNS) {
      if (pattern.test(hostname)) {
        return 'tier1';
      }
    }

    // Check if it's a state agency by name pattern
    const pathname = urlObj.pathname.toLowerCase();
    for (const pattern of STATE_AGENCY_PATTERNS) {
      if (pattern.test(hostname) || pattern.test(pathname)) {
        return 'tier1';
      }
    }

    // Check Tier 2 domains
    for (const domain of TIER2_DOMAINS) {
      if (hostname.includes(domain)) {
        return 'tier2';
      }
    }

    // Check Tier 3 / blocked patterns
    for (const pattern of TIER3_BLOCKED_PATTERNS) {
      if (pattern.test(hostname)) {
        return 'tier3';
      }
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ============================================================================
// NEGATIVE TERMS GENERATION
// ============================================================================

// Global drift terms by role - these are EXCLUDED unless present in source anchors
const ROLE_DRIFT_NEGATIVES: Record<LearnerRole, string[]> = {
  frontline_store_associate: [
    'CDL', 'commercial driver', 'vehicle code', 'driver testing',
    'license renewal', 'tax filing', 'tax return', 'annual filing',
    'equipment specification', 'vendor contract', 'pricing policy',
    'hiring', 'termination', 'payroll',
  ],
  manager_supervisor: [
    'CDL', 'commercial driver', 'vehicle code',
    'license renewal', 'tax filing', 'business license application',
    'equipment specification', 'vendor contract negotiation',
    'executive compensation', 'board resolution',
  ],
  delivery_driver: [
    'POS operation', 'cash register', 'checkout',
    'inventory management', 'stocking', 'merchandising',
    'tax filing', 'license renewal', 'hiring',
  ],
  owner_executive: [
    'POS operation', 'cash register', 'checkout',
    'stocking shelves', 'customer service desk',
  ],
  back_office_admin: [
    'POS operation', 'customer checkout', 'sales floor',
    'CDL', 'vehicle operation',
  ],
  other: [
    'CDL', 'commercial driver', 'vehicle code',
    'tax filing', 'license renewal',
  ],
};

// Known drift categories
const CATEGORY_DRIFT_TERMS: Record<string, string[]> = {
  alcohol: ['alcohol', 'liquor', 'beer', 'wine', 'ABC', 'beverage control'],
  tobacco: ['tobacco', 'cigarette', 'vape', 'e-cigarette', 'smoking'],
  fuel: ['fuel', 'gasoline', 'diesel', 'UST', 'tank', 'dispenser'],
  food_safety: ['food safety', 'foodborne', 'haccp', 'health inspection'],
  pharmacy: ['pharmacy', 'prescription', 'controlled substance', 'DEA'],
};

/**
 * Generate global negative terms based on role and anchors.
 * Terms that ARE in the anchors are NOT excluded (they're relevant).
 */
function generateGlobalNegatives(
  role: LearnerRole,
  anchors: string[],
  disallowedActions: string[]
): string[] {
  const negatives: string[] = [];
  const anchorsLower = anchors.map(a => a.toLowerCase()).join(' ');

  // Add role-specific drift terms (if not in anchors)
  const roleDrift = ROLE_DRIFT_NEGATIVES[role] || ROLE_DRIFT_NEGATIVES.other;
  for (const term of roleDrift) {
    if (!anchorsLower.includes(term.toLowerCase())) {
      negatives.push(term);
    }
  }

  // Add category drift terms (if category not in anchors)
  for (const [category, terms] of Object.entries(CATEGORY_DRIFT_TERMS)) {
    const categoryInAnchors = terms.some(t => anchorsLower.includes(t.toLowerCase()));
    if (!categoryInAnchors) {
      // Add first 2 terms from category as negatives
      negatives.push(...terms.slice(0, 2));
    }
  }

  // Convert disallowed actions to keywords
  for (const action of disallowedActions) {
    const keywords = action
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    negatives.push(...keywords.slice(0, 2));
  }

  // Deduplicate and limit
  return [...new Set(negatives)].slice(0, 25);
}

/**
 * Generate query-specific negative terms based on the action being researched.
 */
function generateQueryNegatives(
  action: string,
  globalNegatives: string[],
  anchors: string[]
): string[] {
  const queryNegatives: string[] = [];
  const anchorsLower = anchors.map(a => a.toLowerCase()).join(' ');
  const actionLower = action.toLowerCase();

  // Start with a subset of global negatives most relevant to this action
  for (const neg of globalNegatives) {
    // Don't add negatives that overlap with the action itself
    if (!actionLower.includes(neg.toLowerCase())) {
      queryNegatives.push(neg);
    }
  }

  return queryNegatives.slice(0, 8);
}

// ============================================================================
// RESEARCH PLAN GENERATION
// ============================================================================

/**
 * Map actions to evidence target types based on keywords.
 */
function inferTargetType(action: string, anchors: string[]): EvidenceTargetType {
  const combined = `${action} ${anchors.join(' ')}`.toLowerCase();

  if (combined.includes('sign') || combined.includes('post') || combined.includes('display')) {
    return 'forms_or_signage';
  }
  if (combined.includes('penalty') || combined.includes('enforce') || combined.includes('fine')) {
    return 'enforcement_policy';
  }
  if (combined.includes('agency') || combined.includes('guideline') || combined.includes('advisory')) {
    return 'agency_guidance';
  }
  if (combined.includes('code') || combined.includes('rule') || combined.includes('admin')) {
    return 'regulation';
  }
  if (combined.includes('law') || combined.includes('statute') || combined.includes('act')) {
    return 'statute';
  }

  return 'unknown';
}

/**
 * Generate a research query from an action and anchors.
 */
function generateQueryForAction(
  action: string,
  anchors: string[],
  stateCode: string,
  stateName: string | undefined,
  globalNegatives: string[],
  existingQueries: ResearchQuery[]
): ResearchQuery | null {
  // Select 1-3 relevant anchors for this action
  const actionWords = action.toLowerCase().split(/\s+/);
  const relevantAnchors = anchors.filter(anchor => {
    const anchorLower = anchor.toLowerCase();
    return actionWords.some(w => anchorLower.includes(w) || w.includes(anchorLower));
  });

  // If no direct matches, use first 2 anchors
  const selectedAnchors = relevantAnchors.length > 0
    ? relevantAnchors.slice(0, 3)
    : anchors.slice(0, 2);

  // Build the query string
  const stateStr = stateName || stateCode;
  const anchorStr = selectedAnchors.join(' ');
  const queryNegatives = generateQueryNegatives(action, globalNegatives, anchors);

  // Don't duplicate very similar queries
  const queryBase = `${stateStr} ${anchorStr} ${action}`.toLowerCase();
  const isDuplicate = existingQueries.some(eq => {
    const existingBase = `${eq.query}`.toLowerCase();
    // Simple overlap check
    const words1 = queryBase.split(/\s+/);
    const words2 = existingBase.split(/\s+/);
    const overlap = words1.filter(w => words2.includes(w)).length;
    return overlap > words1.length * 0.7;
  });

  if (isDuplicate) {
    return null;
  }

  const query = `${stateStr} ${anchorStr} ${action} regulation requirements`;

  return {
    id: crypto.randomUUID(),
    query,
    mappedAction: action,
    anchorTerms: selectedAnchors,
    negativeTerms: queryNegatives,
    targetType: inferTargetType(action, selectedAnchors),
    why: `Clarifies state-specific requirements for "${action}" to ensure compliant learner behavior.`,
  };
}

/**
 * Build a ResearchPlan from a ScopeContract.
 */
export async function buildResearchPlan(input: ResearchPlanInput): Promise<ResearchPlan> {
  const { scopeContract, contractId, stateCode, stateName, sourceContent } = input;
  const { primaryRole, allowedLearnerActions, domainAnchors, disallowedActionClasses } = scopeContract;

  console.log('[ResearchPlan] Building plan for:', stateCode, 'role:', primaryRole);

  // Generate global negatives
  const globalNegativeTerms = generateGlobalNegatives(
    primaryRole,
    domainAnchors,
    disallowedActionClasses
  );

  // Generate queries for each action (1-2 per action, max 15 total)
  const queries: ResearchQuery[] = [];

  for (const action of allowedLearnerActions) {
    if (queries.length >= 15) break;

    const query = generateQueryForAction(
      action,
      domainAnchors,
      stateCode,
      stateName,
      globalNegativeTerms,
      queries
    );

    if (query) {
      queries.push(query);
    }
  }

  // If we have too few queries, add some anchor-focused queries
  if (queries.length < 6) {
    const stateStr = stateName || stateCode;
    for (const anchor of domainAnchors.slice(0, 4)) {
      if (queries.length >= 6) break;

      const genericQuery: ResearchQuery = {
        id: crypto.randomUUID(),
        query: `${stateStr} ${anchor} compliance requirements regulations`,
        mappedAction: allowedLearnerActions[0], // map to first action as fallback
        anchorTerms: [anchor],
        negativeTerms: globalNegativeTerms.slice(0, 5),
        targetType: 'regulation',
        why: `General compliance requirements for ${anchor} in ${stateStr}.`,
      };
      queries.push(genericQuery);
    }
  }

  const plan: ResearchPlan = {
    id: crypto.randomUUID(),
    stateCode,
    stateName,
    generatedAtISO: new Date().toISOString(),
    contractId,
    primaryRole,
    queries,
    globalNegativeTerms,
    sourcePolicy: {
      preferTier1: true,
      allowTier2Justia: true,
      forbidTier3ForStrongClaims: true,
    },
  };

  console.log('[ResearchPlan] Generated plan with', queries.length, 'queries');

  return plan;
}

// ============================================================================
// LLM-ENHANCED RESEARCH PLAN (optional, for more sophisticated query generation)
// ============================================================================

export async function buildResearchPlanWithLLM(input: ResearchPlanInput): Promise<ResearchPlan> {
  const { scopeContract, contractId, stateCode, stateName } = input;

  // First build deterministic plan
  const basePlan = await buildResearchPlan(input);

  // Optionally enhance with LLM for better query formulation
  const systemMessage = `You are a legal research assistant. Output valid JSON only. No markdown.

Given a Scope Contract and target state, generate focused research queries.
Each query must:
1. Reference at least one domain anchor
2. Map to one allowed learner action
3. Target state-specific regulations/requirements
4. Be specific enough to find relevant legal sources

Output JSON:
{
  "queries": [
    {
      "query": "search query string",
      "mappedAction": "action from allowedLearnerActions",
      "anchorTerms": ["anchors used"],
      "targetType": "statute|regulation|agency_guidance|enforcement_policy|forms_or_signage|unknown",
      "why": "1 sentence explanation"
    }
  ]
}`;

  const userMessage = `Generate 6-10 focused research queries for:

STATE: ${stateName || stateCode}
ROLE: ${scopeContract.primaryRole}
INSTRUCTIONAL GOAL: ${scopeContract.instructionalGoal}

ALLOWED LEARNER ACTIONS:
${scopeContract.allowedLearnerActions.map(a => `- ${a}`).join('\n')}

DOMAIN ANCHORS:
${scopeContract.domainAnchors.map(a => `- ${a}`).join('\n')}

DISALLOWED ACTION CLASSES (do NOT research these):
${scopeContract.disallowedActionClasses.map(a => `- ${a}`).join('\n')}

Generate queries that:
1. Focus on what ${scopeContract.primaryRole} needs to know
2. Target ${stateName || stateCode}-specific regulations
3. Use domain anchors in queries
4. Avoid disallowed topics entirely`;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.3, response_format: { type: 'json_object' } }
    );

    const parsed = JSON.parse(response);
    const llmQueries = parsed.queries || [];

    // Merge LLM queries with base plan, validating each
    const mergedQueries: ResearchQuery[] = [];

    for (const q of llmQueries) {
      // Validate that mappedAction is actually in allowedLearnerActions
      const validAction = scopeContract.allowedLearnerActions.find(
        a => a.toLowerCase().includes(q.mappedAction?.toLowerCase() || '') ||
             q.mappedAction?.toLowerCase().includes(a.toLowerCase())
      );

      if (!validAction) {
        console.log('[ResearchPlan] LLM query rejected - unmapped action:', q.mappedAction);
        continue;
      }

      // Validate that at least one anchor is used
      const validAnchors = (q.anchorTerms || []).filter((t: string) =>
        scopeContract.domainAnchors.some(a => a.toLowerCase().includes(t.toLowerCase()))
      );

      if (validAnchors.length === 0) {
        console.log('[ResearchPlan] LLM query rejected - no valid anchors:', q.query);
        continue;
      }

      mergedQueries.push({
        id: crypto.randomUUID(),
        query: q.query,
        mappedAction: validAction,
        anchorTerms: validAnchors,
        negativeTerms: basePlan.globalNegativeTerms.slice(0, 5),
        targetType: q.targetType || 'unknown',
        why: q.why || 'LLM-generated query',
      });

      if (mergedQueries.length >= 15) break;
    }

    // If LLM queries are insufficient, supplement with base plan queries
    if (mergedQueries.length < 6) {
      for (const baseQuery of basePlan.queries) {
        if (mergedQueries.length >= 15) break;
        const isDuplicate = mergedQueries.some(mq =>
          mq.mappedAction === baseQuery.mappedAction &&
          mq.anchorTerms.some(a => baseQuery.anchorTerms.includes(a))
        );
        if (!isDuplicate) {
          mergedQueries.push(baseQuery);
        }
      }
    }

    return {
      ...basePlan,
      queries: mergedQueries,
    };
  } catch (error) {
    console.error('[ResearchPlan] LLM enhancement failed, using base plan:', error);
    return basePlan;
  }
}

// ============================================================================
// EVIDENCE EXTRACTION
// ============================================================================

/**
 * Extract date from HTML content (best effort).
 */
function extractDateFromHtml(html: string): { effectiveDate?: string; updatedDate?: string } {
  const datePatterns = [
    { pattern: /effective[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i, type: 'effective' },
    { pattern: /last\s+updated[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i, type: 'updated' },
    { pattern: /amended[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i, type: 'updated' },
    { pattern: /updated[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i, type: 'updated' },
    { pattern: /(\d{1,2}\/\d{1,2}\/\d{4})/i, type: 'updated' },
    { pattern: /(\d{4}-\d{2}-\d{2})/i, type: 'updated' },
  ];

  let effectiveDate: string | undefined;
  let updatedDate: string | undefined;

  for (const { pattern, type } of datePatterns) {
    const match = html.match(pattern);
    if (match) {
      if (type === 'effective' && !effectiveDate) {
        effectiveDate = match[1];
      } else if (type === 'updated' && !updatedDate) {
        updatedDate = match[1];
      }
    }
  }

  return { effectiveDate, updatedDate };
}

/**
 * Extract title from HTML content.
 */
function extractTitleFromHtml(html: string): string | undefined {
  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim().substring(0, 200);
  }

  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim().substring(0, 200);
  }

  return undefined;
}

/**
 * Extract relevant snippets from HTML based on query terms.
 */
function extractSnippetsFromHtml(
  html: string,
  queryTerms: string[],
  maxSnippets: number = 5
): EvidenceSnippet[] {
  // Remove HTML tags for text extraction
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const snippets: EvidenceSnippet[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const termsLower = queryTerms.map(t => t.toLowerCase());

  for (const sentence of sentences) {
    if (snippets.length >= maxSnippets) break;

    const sentenceLower = sentence.toLowerCase();
    const matchCount = termsLower.filter(t => sentenceLower.includes(t)).length;

    if (matchCount >= 1) {
      const trimmed = sentence.trim().substring(0, 500);
      // Avoid duplicates
      if (!snippets.some(s => s.text === trimmed)) {
        snippets.push({
          text: trimmed,
          context: undefined,
        });
      }
    }
  }

  return snippets;
}

/**
 * Simple hash for content auditing.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// RETRIEVAL RELEVANCE FILTER
// ============================================================================

/**
 * Check if evidence should be rejected based on scope contract constraints.
 */
export function filterEvidence(
  url: string,
  snippets: EvidenceSnippet[],
  scopeContract: ScopeContract,
  sourceContent?: string
): RetrievalRejection | null {
  const { primaryRole, domainAnchors, disallowedActionClasses } = scopeContract;

  const snippetText = snippets.map(s => s.text).join(' ').toLowerCase();
  const anchorsLower = domainAnchors.map(a => a.toLowerCase());
  const sourceContentLower = sourceContent?.toLowerCase() || '';

  // 1. Anchor mismatch check
  const hasAnchorMatch = anchorsLower.some(anchor => snippetText.includes(anchor));
  if (!hasAnchorMatch) {
    return {
      url,
      reason: 'No domain anchor terms found in snippets',
      anchorMismatch: true,
    };
  }

  // 2. Role authority mismatch check
  const ADMIN_AUTHORITY_TERMS = [
    'file', 'remit', 'renew', 'fee schedule', 'application',
    'tax return', 'annual report', 'business license',
  ];

  const FRONTLINE_EXCLUDED_TERMS = [
    'cdl', 'commercial driver', 'vehicle code', 'driver testing',
  ];

  if (primaryRole === 'frontline_store_associate' || primaryRole === 'delivery_driver') {
    for (const term of [...ADMIN_AUTHORITY_TERMS, ...FRONTLINE_EXCLUDED_TERMS]) {
      if (snippetText.includes(term.toLowerCase())) {
        // Check if this term is actually in the source content (if so, it's allowed)
        if (!sourceContentLower.includes(term.toLowerCase())) {
          return {
            url,
            reason: `Role authority mismatch: "${term}" not appropriate for ${primaryRole}`,
            roleMismatch: true,
            matchedDisallowedTerms: [term],
          };
        }
      }
    }
  }

  // 3. Disallowed action class hit
  const matchedDisallowed: string[] = [];
  for (const disallowed of disallowedActionClasses) {
    const keywords = disallowed.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matches = keywords.filter(kw => snippetText.includes(kw));
    if (matches.length >= 2) {
      // Check if it's in source content (then it's allowed)
      if (!sourceContentLower.includes(disallowed.toLowerCase())) {
        matchedDisallowed.push(disallowed);
      }
    }
  }

  if (matchedDisallowed.length > 0) {
    return {
      url,
      reason: `Contains disallowed action class terms`,
      matchedDisallowedTerms: matchedDisallowed,
    };
  }

  return null; // Evidence passes filter
}

// ============================================================================
// MAIN RETRIEVAL FUNCTION
// ============================================================================

export interface RetrieveEvidenceInput {
  researchPlan: ResearchPlan;
  scopeContract: ScopeContract;
  searchProvider: SearchProvider;
  fetchProvider: FetchProvider;
  sourceContent?: string;
  maxResultsPerQuery?: number;
}

export async function retrieveEvidence(input: RetrieveEvidenceInput): Promise<RetrievalOutput> {
  const {
    researchPlan,
    scopeContract,
    searchProvider,
    fetchProvider,
    sourceContent,
    maxResultsPerQuery = 5,
  } = input;

  const evidence: EvidenceBlock[] = [];
  const rejected: RetrievalRejection[] = [];
  const seenUrls = new Set<string>();

  console.log('[Retrieval] Starting evidence retrieval for', researchPlan.queries.length, 'queries');

  for (const query of researchPlan.queries) {
    console.log('[Retrieval] Executing query:', query.query);

    try {
      // Search
      const results = await searchProvider.search({
        query: query.query,
        maxResults: maxResultsPerQuery,
      });

      for (const result of results) {
        // Skip duplicates
        if (seenUrls.has(result.url)) continue;
        seenUrls.add(result.url);

        // Classify tier
        const tier = classifySourceTier(result.url);

        // Skip tier3 entirely
        if (tier === 'tier3') {
          rejected.push({
            url: result.url,
            reason: 'Tier 3 source (blocked)',
          });
          continue;
        }

        try {
          // Fetch content
          const { html, finalUrl } = await fetchProvider.fetchHtml(result.url);
          const url = finalUrl || result.url;

          // Extract data
          const hostname = new URL(url).hostname;
          const title = extractTitleFromHtml(html) || result.title;
          const dates = extractDateFromHtml(html);
          const queryTerms = [...query.anchorTerms, ...query.mappedAction.split(/\s+/)];
          const snippets = extractSnippetsFromHtml(html, queryTerms);

          if (snippets.length === 0) {
            rejected.push({
              url,
              reason: 'No relevant snippets found',
              anchorMismatch: true,
            });
            continue;
          }

          // Apply relevance filter
          const rejection = filterEvidence(url, snippets, scopeContract, sourceContent);
          if (rejection) {
            rejected.push(rejection);
            continue;
          }

          // Build evidence block
          const block: EvidenceBlock = {
            evidenceId: crypto.randomUUID(),
            queryId: query.id,
            url,
            hostname,
            title,
            publisher: hostname, // Simple publisher derivation
            tier,
            retrievedAtISO: new Date().toISOString(),
            effectiveDate: dates.effectiveDate || null,
            updatedDate: dates.updatedDate || null,
            snippets,
            rawTextHash: hashContent(html),
          };

          evidence.push(block);
          console.log('[Retrieval] Accepted evidence from:', hostname, 'tier:', tier);

        } catch (fetchError) {
          console.error('[Retrieval] Fetch failed for:', result.url, fetchError);
          rejected.push({
            url: result.url,
            reason: `Fetch failed: ${(fetchError as Error).message}`,
          });
        }
      }
    } catch (searchError) {
      console.error('[Retrieval] Search failed for query:', query.query, searchError);
    }
  }

  console.log('[Retrieval] Complete. Accepted:', evidence.length, 'Rejected:', rejected.length);

  return {
    researchPlan,
    evidence,
    rejected,
  };
}

// ============================================================================
// LOGGING / PERSISTENCE
// ============================================================================

export interface ResearchPlanLog {
  id: string;
  timestamp: string;
  contractId?: string;
  stateCode: string;
  researchPlan: ResearchPlan;
  retrievalOutput?: RetrievalOutput;
}

export function createResearchPlanLog(
  plan: ResearchPlan,
  output?: RetrievalOutput
): ResearchPlanLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    contractId: plan.contractId,
    stateCode: plan.stateCode,
    researchPlan: plan,
    retrievalOutput: output,
  };
}
