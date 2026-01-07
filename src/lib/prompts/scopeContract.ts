// ============================================================================
// SCOPE CONTRACT - State Variant Intelligence v2
// ============================================================================
// Prompt 1: Derive and freeze a Scope Contract from source content.
// The contract constrains all downstream stages (research, Key Facts, generation).
// ============================================================================

import { chatCompletion, type ChatMessage } from '../../supabase/functions/server/utils/openai.ts';

// ============================================================================
// TYPES
// ============================================================================

export type LearnerRole =
  | 'frontline_store_associate'
  | 'manager_supervisor'
  | 'delivery_driver'
  | 'owner_executive'
  | 'back_office_admin'
  | 'other';

export interface ScopeContract {
  // Role determination
  primaryRole: LearnerRole;
  secondaryRoles: LearnerRole[]; // max 2
  roleConfidence: 'high' | 'medium' | 'low';
  roleEvidenceQuotes: string[]; // exact snippets from source, max 6

  // Scope boundaries
  allowedLearnerActions: string[]; // 5–12 (imperative, verb + object)
  disallowedActionClasses: string[]; // 5–10 (e.g., "file tax returns", "set equipment specs")

  // Domain anchoring
  domainAnchors: string[]; // 6–15 nouns/noun-phrases from source
  instructionalGoal: string; // single sentence
}

export interface ScopeContractInput {
  sourceTrackType: 'video' | 'article' | 'story' | 'checkpoint';
  sourceTitle: string;
  sourceContent: string; // HTML or transcript
  variantType: 'geographic' | 'company' | 'unit';
  variantContext: {
    state_code?: string;
    state_name?: string;
    org_id?: string;
    org_name?: string;
    store_id?: string;
    store_name?: string;
  };
  orgRoles?: Array<{
    roleId: string;
    roleName: string;
    roleDescription?: string;
    dailyActivities?: string[];
  }>;
}

export interface OrgRoleMatch {
  roleId: string;
  roleName: string;
  score: number;
  why: string;
}

export interface ScopeContractResult {
  scopeContract: ScopeContract;
  roleSelectionNeeded: boolean;
  topRoleMatches?: OrgRoleMatch[];
  // Debug/logging
  rawLLMResponse?: string;
  extractionMethod: 'llm' | 'fallback';
  validationErrors?: string[];
  validationWarnings?: string[];
}

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_LEARNER_ROLES: LearnerRole[] = [
  'frontline_store_associate',
  'manager_supervisor',
  'delivery_driver',
  'owner_executive',
  'back_office_admin',
  'other'
];

function isValidLearnerRole(role: unknown): role is LearnerRole {
  return typeof role === 'string' && VALID_LEARNER_ROLES.includes(role as LearnerRole);
}

function isValidConfidence(conf: unknown): conf is 'high' | 'medium' | 'low' {
  return conf === 'high' || conf === 'medium' || conf === 'low';
}

function isNonEmptyStringArray(arr: unknown, minLength = 1, maxLength = 20): arr is string[] {
  return (
    Array.isArray(arr) &&
    arr.length >= minLength &&
    arr.length <= maxLength &&
    arr.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contract: ScopeContract | null;
}

// Regulatory claim patterns that should NOT appear in Prompt 1 (scope-only stage)
const REGULATORY_CLAIM_PATTERNS = [
  /\bmust\s+be\s+\d+/i,           // "must be 21"
  /\billegal\b/i,
  /\bpenalty\b/i,
  /\bfine\s+of\b/i,
  /\bviolation\b/i,
  /\bstatute\b/i,
  /\bregulation\b/i,
  /\bcode\s+section\b/i,
  /\b\d+\s*U\.?S\.?C\.?\b/i,      // "21 USC"
  /\b\d+\s*C\.?F\.?R\.?\b/i,      // "21 CFR"
];

/**
 * Check if a string contains regulatory claims that shouldn't be in Prompt 1.
 */
function containsRegulatoryClaimsForScope(text: string): boolean {
  return REGULATORY_CLAIM_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Validate that evidence quotes are actual substrings of source content.
 * Returns the validated quotes (only those that are real substrings).
 */
function validateEvidenceQuotes(
  quotes: string[],
  sourceContent: string
): { valid: string[]; invalid: string[] } {
  const sourceLower = sourceContent.toLowerCase();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const quote of quotes) {
    // Clean up the quote (remove ellipses, extra whitespace)
    const cleanQuote = quote
      .replace(/^["'\s.]+|["'\s.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanQuote.length < 5) {
      invalid.push(quote);
      continue;
    }

    // Check if it's a substring (case-insensitive, allow for minor whitespace differences)
    const quoteLower = cleanQuote.toLowerCase();
    if (sourceLower.includes(quoteLower)) {
      valid.push(cleanQuote);
    } else {
      // Try fuzzy match - check if most words are present
      const words = quoteLower.split(/\s+/).filter(w => w.length > 3);
      const matchedWords = words.filter(w => sourceLower.includes(w));
      if (matchedWords.length >= words.length * 0.7) {
        valid.push(cleanQuote);
      } else {
        invalid.push(quote);
      }
    }
  }

  return { valid, invalid };
}

function validateScopeContract(raw: unknown, sourceContent?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not an object'], warnings: [], contract: null };
  }

  const obj = raw as Record<string, unknown>;

  // Validate primaryRole
  if (!isValidLearnerRole(obj.primaryRole)) {
    errors.push(`Invalid primaryRole: ${obj.primaryRole}`);
  }

  // Validate secondaryRoles
  if (!Array.isArray(obj.secondaryRoles)) {
    errors.push('secondaryRoles must be an array');
  } else if (obj.secondaryRoles.length > 2) {
    errors.push('secondaryRoles must have at most 2 items');
  } else if (!obj.secondaryRoles.every(isValidLearnerRole)) {
    errors.push('secondaryRoles contains invalid roles');
  }

  // Validate roleConfidence
  if (!isValidConfidence(obj.roleConfidence)) {
    errors.push(`Invalid roleConfidence: ${obj.roleConfidence}`);
  }

  // Validate roleEvidenceQuotes
  if (!isNonEmptyStringArray(obj.roleEvidenceQuotes, 0, 6)) {
    errors.push('roleEvidenceQuotes must be array of 0-6 strings');
  }

  // Validate allowedLearnerActions (enforce 5-12 bounds)
  let allowedActions = obj.allowedLearnerActions;
  if (!Array.isArray(allowedActions)) {
    errors.push('allowedLearnerActions must be an array');
    allowedActions = [];
  } else {
    // Trim to bounds
    if (allowedActions.length > 12) {
      warnings.push(`allowedLearnerActions had ${allowedActions.length} items, trimmed to 12`);
      allowedActions = allowedActions.slice(0, 12);
    }
    if (allowedActions.length < 5) {
      errors.push(`allowedLearnerActions must have at least 5 items, got ${allowedActions.length}`);
    }
    // Check for regulatory claims in actions (shouldn't be here in Prompt 1)
    for (const action of allowedActions as string[]) {
      if (containsRegulatoryClaimsForScope(action)) {
        warnings.push(`Action "${action.substring(0, 40)}..." contains regulatory language - will be filtered`);
      }
    }
  }

  // Validate disallowedActionClasses (enforce 5-10 bounds)
  let disallowedActions = obj.disallowedActionClasses;
  if (!Array.isArray(disallowedActions)) {
    errors.push('disallowedActionClasses must be an array');
    disallowedActions = [];
  } else {
    if (disallowedActions.length > 10) {
      warnings.push(`disallowedActionClasses had ${disallowedActions.length} items, trimmed to 10`);
      disallowedActions = disallowedActions.slice(0, 10);
    }
    if (disallowedActions.length < 5) {
      errors.push(`disallowedActionClasses must have at least 5 items, got ${disallowedActions.length}`);
    }
  }

  // Validate domainAnchors (enforce 6-15 bounds)
  let anchors = obj.domainAnchors;
  if (!Array.isArray(anchors)) {
    errors.push('domainAnchors must be an array');
    anchors = [];
  } else {
    if (anchors.length > 15) {
      warnings.push(`domainAnchors had ${anchors.length} items, trimmed to 15`);
      anchors = anchors.slice(0, 15);
    }
    if (anchors.length < 6) {
      errors.push(`domainAnchors must have at least 6 items, got ${anchors.length}`);
    }
  }

  // Validate instructionalGoal
  let instructionalGoal = obj.instructionalGoal;
  if (typeof instructionalGoal !== 'string' || instructionalGoal.trim().length === 0) {
    errors.push('instructionalGoal must be a non-empty string');
    instructionalGoal = '';
  } else {
    // Check for regulatory claims in goal
    if (containsRegulatoryClaimsForScope(instructionalGoal as string)) {
      warnings.push('instructionalGoal contains regulatory language - should be scope-only');
    }
  }

  // Validate evidence quotes are actual substrings
  let validatedQuotes: string[] = [];
  if (sourceContent && Array.isArray(obj.roleEvidenceQuotes)) {
    const quoteValidation = validateEvidenceQuotes(obj.roleEvidenceQuotes as string[], sourceContent);
    validatedQuotes = quoteValidation.valid;
    if (quoteValidation.invalid.length > 0) {
      warnings.push(`${quoteValidation.invalid.length} evidence quotes were not exact substrings and were removed`);
    }
  } else {
    validatedQuotes = (obj.roleEvidenceQuotes as string[] || []).slice(0, 6);
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, contract: null };
  }

  // Filter out actions with regulatory claims
  const filteredActions = (allowedActions as string[])
    .filter(a => typeof a === 'string' && a.trim().length > 0)
    .filter(a => !containsRegulatoryClaimsForScope(a))
    .slice(0, 12);

  return {
    valid: true,
    errors: [],
    warnings,
    contract: {
      primaryRole: obj.primaryRole as LearnerRole,
      secondaryRoles: (obj.secondaryRoles as LearnerRole[]).slice(0, 2),
      roleConfidence: obj.roleConfidence as 'high' | 'medium' | 'low',
      roleEvidenceQuotes: validatedQuotes.slice(0, 6),
      allowedLearnerActions: filteredActions.length >= 5 ? filteredActions : (allowedActions as string[]).slice(0, 12),
      disallowedActionClasses: (disallowedActions as string[]).slice(0, 10),
      domainAnchors: (anchors as string[]).slice(0, 15),
      instructionalGoal: instructionalGoal as string
    }
  };
}

// ============================================================================
// AMBIGUITY SIGNALS
// ============================================================================

interface AmbiguitySignals {
  hasOverloadedTerms: boolean;
  hasMixedRoleLanguage: boolean;
  hasAdminOperationalMix: boolean;
  triggersRoleSelection: boolean;
  signals: string[];
}

const OVERLOADED_TERMS = [
  'delivery', 'driver', 'fleet', 'route', 'manifest',
  'inventory', 'audit', 'compliance', 'inspection'
];

const ADMIN_TERMS = [
  'file', 'renew', 'remit', 'audit', 'license', 'registration',
  'permit', 'tax', 'annual', 'regulatory', 'reporting'
];

const FRONTLINE_TERMS = [
  'checkout', 'register', 'customer', 'sale', 'scan',
  'ring up', 'pos', 'transaction', 'counter'
];

const MANAGER_TERMS = [
  'supervisor', 'manager must', 'train staff', 'coach',
  'review logs', 'employee', 'shift lead', 'supervise'
];

function detectAmbiguitySignals(sourceContent: string): AmbiguitySignals {
  const contentLower = sourceContent.toLowerCase();
  const signals: string[] = [];

  // Check for overloaded terms
  const foundOverloaded = OVERLOADED_TERMS.filter(term => contentLower.includes(term));
  const hasOverloadedTerms = foundOverloaded.length >= 2;
  if (hasOverloadedTerms) {
    signals.push(`Overloaded terms found: ${foundOverloaded.join(', ')}`);
  }

  // Check for mixed role language (both "you must do X" and "manager must do Y")
  const hasFrontlineAction = contentLower.includes('you must') || contentLower.includes('you should');
  const hasManagerAction = MANAGER_TERMS.some(term => contentLower.includes(term));
  const hasMixedRoleLanguage = hasFrontlineAction && hasManagerAction;
  if (hasMixedRoleLanguage) {
    signals.push('Mixed role language detected (frontline + manager actions)');
  }

  // Check for admin/operational mix
  const hasAdminTerms = ADMIN_TERMS.filter(term => contentLower.includes(term)).length >= 2;
  const hasFrontlineTerms = FRONTLINE_TERMS.filter(term => contentLower.includes(term)).length >= 2;
  const hasAdminOperationalMix = hasAdminTerms && hasFrontlineTerms;
  if (hasAdminOperationalMix) {
    signals.push('Admin and operational language mix detected');
  }

  const triggersRoleSelection = hasOverloadedTerms || hasMixedRoleLanguage || hasAdminOperationalMix;

  return {
    hasOverloadedTerms,
    hasMixedRoleLanguage,
    hasAdminOperationalMix,
    triggersRoleSelection,
    signals
  };
}

// ============================================================================
// FALLBACK CONTRACT GENERATION
// ============================================================================

function generateFallbackContract(input: ScopeContractInput): ScopeContract {
  const contentLower = input.sourceContent.toLowerCase();

  // Simple heuristic extraction for anchors
  const words = input.sourceContent.split(/\s+/);
  const nounPatterns = /^[A-Z][a-z]+$|^[A-Z]{2,}$/;
  const potentialAnchors = words
    .filter(w => nounPatterns.test(w) || w.length > 5)
    .map(w => w.replace(/[^a-zA-Z]/g, ''))
    .filter(w => w.length > 3)
    .slice(0, 15);

  // Extract unique anchors
  const uniqueAnchors = [...new Set(potentialAnchors)];
  while (uniqueAnchors.length < 6) {
    uniqueAnchors.push('training content');
  }

  // Simple action extraction
  const actionVerbs = ['verify', 'check', 'report', 'notify', 'complete', 'follow', 'document'];
  const foundActions = actionVerbs
    .filter(v => contentLower.includes(v))
    .map(v => `${v} procedures`);

  while (foundActions.length < 5) {
    foundActions.push('follow company procedures');
  }

  return {
    primaryRole: 'other',
    secondaryRoles: [],
    roleConfidence: 'low',
    roleEvidenceQuotes: [],
    allowedLearnerActions: foundActions.slice(0, 12),
    disallowedActionClasses: [
      'file tax returns',
      'set equipment specifications',
      'modify business licenses',
      'establish pricing policies',
      'negotiate vendor contracts'
    ],
    domainAnchors: uniqueAnchors.slice(0, 15),
    instructionalGoal: `Train learners on ${input.sourceTitle} procedures and compliance requirements.`
  };
}

// ============================================================================
// ORG ROLE MATCHING
// ============================================================================

async function matchOrgRoles(
  scopeContract: ScopeContract,
  orgRoles: NonNullable<ScopeContractInput['orgRoles']>
): Promise<OrgRoleMatch[]> {
  if (orgRoles.length === 0) {
    return [];
  }

  const rolesSummary = orgRoles.map(r => ({
    id: r.roleId,
    name: r.roleName,
    desc: r.roleDescription || '',
    activities: r.dailyActivities?.join(', ') || ''
  }));

  const systemMessage = `You are a role matching assistant. Output valid JSON only. No markdown.`;

  const userMessage = `Given this Scope Contract from training content:

Primary Role: ${scopeContract.primaryRole}
Allowed Actions: ${scopeContract.allowedLearnerActions.join(', ')}
Domain Anchors: ${scopeContract.domainAnchors.join(', ')}
Instructional Goal: ${scopeContract.instructionalGoal}

And these organization roles:
${JSON.stringify(rolesSummary, null, 2)}

Rank the top 3 org roles by relevance to this training content.
Output JSON array:
[
  { "roleId": "...", "roleName": "...", "score": 0.0-1.0, "why": "1 sentence" }
]`;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      { temperature: 0.3, response_format: { type: 'json_object' } }
    );

    const parsed = JSON.parse(response);

    // Handle both array and object with array property
    const matches = Array.isArray(parsed) ? parsed : (parsed.matches || parsed.roles || []);

    return matches
      .filter((m: any) => m.roleId && m.roleName && typeof m.score === 'number')
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5)
      .map((m: any) => ({
        roleId: m.roleId,
        roleName: m.roleName,
        score: Math.min(1, Math.max(0, m.score)),
        why: m.why || 'Matched based on role activities'
      }));
  } catch (error) {
    console.error('[ScopeContract] Error matching org roles:', error);

    // Fallback: simple keyword matching
    const contractKeywords = [
      ...scopeContract.allowedLearnerActions,
      ...scopeContract.domainAnchors
    ].join(' ').toLowerCase();

    return orgRoles
      .map(role => {
        const roleText = `${role.roleName} ${role.roleDescription || ''} ${role.dailyActivities?.join(' ') || ''}`.toLowerCase();
        const matches = contractKeywords.split(' ').filter(kw => roleText.includes(kw)).length;
        return {
          roleId: role.roleId,
          roleName: role.roleName,
          score: Math.min(1, matches / 10),
          why: 'Keyword match fallback'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}

// ============================================================================
// LLM PROMPT FOR SCOPE CONTRACT EXTRACTION
// ============================================================================

function buildScopeContractPrompt(input: ScopeContractInput): ChatMessage[] {
  const systemMessage = `You are a training content analyst. Output valid JSON only. No extra keys. No markdown.

Your task is to derive a Scope Contract from training content that will constrain all downstream adaptation.

Output this exact JSON structure:
{
  "primaryRole": "<one of: frontline_store_associate, manager_supervisor, delivery_driver, owner_executive, back_office_admin, other>",
  "secondaryRoles": ["<0-2 additional roles>"],
  "roleConfidence": "<high|medium|low>",
  "roleEvidenceQuotes": ["<exact quotes from source, max 6>"],
  "allowedLearnerActions": ["<5-12 imperative verb+object phrases>"],
  "disallowedActionClasses": ["<5-10 action types NOT taught>"],
  "domainAnchors": ["<6-15 nouns/noun-phrases defining the topic>"],
  "instructionalGoal": "<single sentence describing what learner will be able to do>"
}`;

  const userMessage = `Source Content Analysis Request

TRACK TYPE: ${input.sourceTrackType}
TITLE: ${input.sourceTitle}
VARIANT TYPE: ${input.variantType}
${input.variantContext.state_name ? `TARGET STATE: ${input.variantContext.state_name}` : ''}
${input.variantContext.org_name ? `TARGET ORG: ${input.variantContext.org_name}` : ''}
${input.variantContext.store_name ? `TARGET STORE: ${input.variantContext.store_name}` : ''}

SOURCE CONTENT:
---
${input.sourceContent.substring(0, 8000)}${input.sourceContent.length > 8000 ? '\n[TRUNCATED]' : ''}
---

INSTRUCTIONS:
1. Derive the intended learner role(s) from the source content. DO NOT ASSUME.
2. Provide exact evidence quotes from the source supporting your role determination.
3. Extract allowedLearnerActions as concrete verbs + objects (what the learner is being taught to DO).
4. Extract disallowedActionClasses: duties that are NOT taught and would indicate scope drift.
5. Extract domainAnchors as nouns/phrases that define what system/topic this is about.
6. Write a single-sentence instructionalGoal.

ROLE DETERMINATION RULES:
- If content says "report to supervisor/manager", that implies frontline authority boundary.
- If content includes "your team", "your employees", "train staff", that implies manager role.
- If content focuses on delivery, routes, manifests, that implies delivery driver role.
- If content includes licensing, renewals, tax filing, that implies owner/executive role.
- If ambiguous between multiple roles, set roleConfidence to "medium" or "low".
- If truly unclear, use "other" with low confidence.

SCOPE BOUNDARY RULES:
- allowedLearnerActions must be things explicitly taught in this content.
- disallowedActionClasses should include duties that would cause scope drift:
  * If frontline: disallow filing taxes, setting policies, equipment specs
  * If manager: disallow executive decisions, license renewals
  * If delivery: disallow POS operations, inventory management
- Do NOT include laws/regulations in this stage - this is scope determination only.

Output valid JSON only.`;

  return [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage }
  ];
}

// ============================================================================
// MAIN FUNCTION: buildScopeContract
// ============================================================================

export async function buildScopeContract(input: ScopeContractInput): Promise<ScopeContractResult> {
  console.log('[ScopeContract] Building scope contract for:', input.sourceTitle);

  // Detect ambiguity signals first
  const ambiguitySignals = detectAmbiguitySignals(input.sourceContent);
  console.log('[ScopeContract] Ambiguity signals:', ambiguitySignals);

  let scopeContract: ScopeContract;
  let extractionMethod: 'llm' | 'fallback' = 'llm';
  let rawLLMResponse: string | undefined;
  let validationErrors: string[] | undefined;
  let validationWarnings: string[] | undefined;

  try {
    // Call LLM for scope contract extraction
    const messages = buildScopeContractPrompt(input);

    rawLLMResponse = await chatCompletion(messages, {
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    console.log('[ScopeContract] Raw LLM response received, length:', rawLLMResponse.length);

    // Parse and validate (pass sourceContent for evidence quote validation)
    const parsed = JSON.parse(rawLLMResponse);
    const validation = validateScopeContract(parsed, input.sourceContent);

    if (validation.valid && validation.contract) {
      scopeContract = validation.contract;
      validationWarnings = validation.warnings.length > 0 ? validation.warnings : undefined;
      console.log('[ScopeContract] LLM extraction successful');
      if (validationWarnings) {
        console.log('[ScopeContract] Warnings:', validationWarnings);
      }
    } else {
      console.warn('[ScopeContract] Validation failed:', validation.errors);
      validationErrors = validation.errors;
      validationWarnings = validation.warnings.length > 0 ? validation.warnings : undefined;
      scopeContract = generateFallbackContract(input);
      extractionMethod = 'fallback';
    }
  } catch (error) {
    console.error('[ScopeContract] LLM extraction failed:', error);
    scopeContract = generateFallbackContract(input);
    extractionMethod = 'fallback';
    validationErrors = [(error as Error).message];
  }

  // Determine if role selection is needed
  let roleSelectionNeeded =
    scopeContract.roleConfidence !== 'high' ||
    ambiguitySignals.triggersRoleSelection;

  // Match org roles if provided - IMPORTANT: don't let this block contract creation
  let topRoleMatches: OrgRoleMatch[] | undefined;
  if (input.orgRoles && input.orgRoles.length > 0) {
    try {
      topRoleMatches = await matchOrgRoles(scopeContract, input.orgRoles);

      // If we have good org role matches, we might need role selection
      if (topRoleMatches.length > 0 && topRoleMatches[0].score < 0.8) {
        roleSelectionNeeded = true;
      }
    } catch (roleMatchError) {
      // Role matching failed - don't block contract creation, just log and continue
      console.error('[ScopeContract] Role matching failed (non-blocking):', roleMatchError);
      roleSelectionNeeded = true; // Flag for review since we couldn't match
    }
  }

  // If no org roles available and confidence is low, flag for review
  if (!input.orgRoles && scopeContract.roleConfidence === 'low') {
    roleSelectionNeeded = true;
  }

  const result: ScopeContractResult = {
    scopeContract,
    roleSelectionNeeded,
    topRoleMatches,
    rawLLMResponse,
    extractionMethod,
    validationErrors,
    validationWarnings
  };

  console.log('[ScopeContract] Result:', {
    primaryRole: scopeContract.primaryRole,
    roleConfidence: scopeContract.roleConfidence,
    roleSelectionNeeded,
    extractionMethod,
    actionsCount: scopeContract.allowedLearnerActions.length,
    anchorsCount: scopeContract.domainAnchors.length,
    warningsCount: validationWarnings?.length || 0
  });

  return result;
}

// ============================================================================
// UTILITY: Freeze contract after user role selection
// ============================================================================

export function freezeScopeContractWithRoles(
  contract: ScopeContract,
  selectedPrimaryRole: LearnerRole,
  selectedSecondaryRoles: LearnerRole[]
): ScopeContract {
  return {
    ...contract,
    primaryRole: selectedPrimaryRole,
    secondaryRoles: selectedSecondaryRoles.slice(0, 2),
    roleConfidence: 'high' // User confirmed, so confidence is now high
  };
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

export interface ScopeContractLog {
  id: string;
  timestamp: string;
  sourceTrackId?: string;
  sourceTitle: string;
  variantType: string;
  variantContext: ScopeContractInput['variantContext'];
  scopeContract: ScopeContract;
  roleSelectionNeeded: boolean;
  topRoleMatches?: OrgRoleMatch[];
  extractionMethod: 'llm' | 'fallback';
  validationErrors?: string[];
  rawLLMResponse?: string;
}

export function createScopeContractLog(
  result: ScopeContractResult,
  input: ScopeContractInput,
  sourceTrackId?: string
): ScopeContractLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    sourceTrackId,
    sourceTitle: input.sourceTitle,
    variantType: input.variantType,
    variantContext: input.variantContext,
    scopeContract: result.scopeContract,
    roleSelectionNeeded: result.roleSelectionNeeded,
    topRoleMatches: result.topRoleMatches,
    extractionMethod: result.extractionMethod,
    validationErrors: result.validationErrors,
    rawLLMResponse: result.rawLLMResponse
  };
}
