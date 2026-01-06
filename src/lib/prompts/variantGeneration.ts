export type VariantType = 'geographic' | 'company' | 'unit';

export interface VariantContext {
  state_code?: string;
  state_name?: string;
  org_id?: string;
  org_name?: string;
  store_id?: string;
  store_name?: string;
}

export interface GenerationConfig {
  variantType: VariantType;
  variantContext: VariantContext;
  sourceTrackType: 'video' | 'article' | 'story' | 'checkpoint';
  sourceTitle: string;
  sourceContent: string; // HTML or transcript
}

// ============================================================================
// AUDIENCE DERIVATION SYSTEM
// ============================================================================
// Derive learner role from source content instead of hardcoding.
// The scope lock is simple: if a rule doesn't modify a learner action
// found in the source, it gets discarded. No need for forbidden topic lists.
// ============================================================================

export type LearnerRole =
  | 'frontline_cashier'
  | 'manager_supervisor'
  | 'delivery_driver'
  | 'owner_executive'
  | 'back_office_admin'
  | 'other';

export interface AudienceDerivation {
  primaryRole: LearnerRole;
  secondaryRoles: LearnerRole[];
  evidence: string[]; // Exact phrases from source supporting the role
  roleConfidence: 'high' | 'medium' | 'low';
  learnerActions: string[]; // Core verbs/actions taught (e.g., "check ID", "refuse sale")
  roleImplications: string[]; // What the learner can actually do in their job
}

// Role indicators: phrases that suggest a specific learner audience
const ROLE_INDICATORS: Record<LearnerRole, string[]> = {
  frontline_cashier: [
    'ring up', 'checkout', 'register', 'customer service', 'ask for id',
    'refuse the sale', 'card the customer', 'scan', 'at the counter',
    'when a customer', 'your customer', 'tell the customer', 'apologize',
    'continue to ring', 'complete the transaction', 'behind the counter',
    // Additional indicators
    'point of sale', 'pos', 'at the register', 'during checkout', 'transaction',
    'customer approaches', 'customer asks', 'customer presents'
  ],
  manager_supervisor: [
    'supervise', 'train your team', 'coach', 'audit', 'review logs',
    'store policy', 'discipline', 'write up', 'shift lead', 'as a manager',
    'your employees', 'your staff', 'your team',
    // Additional indicators
    'ensure compliance', 'store manager', 'shift manager', 'policy enforcement',
    'employee training', 'compliance audit', 'supervising staff'
  ],
  delivery_driver: [
    'deliver', 'route', 'vehicle', 'load', 'unload', 'manifest',
    'customer delivery', 'drop off', 'signature on delivery',
    // Additional indicators
    'at the door', 'recipient', 'hand-off', 'return to store', 'undeliverable',
    'delivery address', 'driver', 'en route'
  ],
  owner_executive: [
    'license', 'renew', 'file', 'remit', 'tax return', 'business registration',
    'compliance officer', 'as an owner', 'your business', 'store owner',
    // Additional indicators
    'renewal', 'licensing', 'fee', 'filing', 'audit notice',
    'business license', 'annual report', 'regulatory filing'
  ],
  back_office_admin: [
    'inventory', 'records', 'spreadsheet', 'report', 'filing',
    'documentation', 'administrative', 'back office',
    // Additional indicators
    'data entry', 'record keeping', 'compliance records'
  ],
  other: []
};

// Action verbs that indicate learner actions (what they're being taught to DO)
const ACTION_VERB_PATTERNS = [
  'check id', 'verify age', 'ask for', 'refuse', 'decline', 'accept',
  'scan', 'ring up', 'complete', 'call', 'notify', 'report', 'sign',
  'deliver', 'load', 'file', 'submit', 'review', 'approve', 'train',
  'supervise', 'audit', 'document', 'record', 'enter', 'process'
];

/**
 * Derive the learner audience from source content.
 *
 * APPROACH:
 * 1. Scan for role indicator phrases
 * 2. Count matches per role
 * 3. Extract supporting evidence (exact quotes)
 * 4. Determine confidence based on match strength
 * 5. Extract learner actions (verbs) for scope lock
 */
export function deriveAudience(sourceContent: string): AudienceDerivation {
  const contentLower = sourceContent.toLowerCase();
  const roleCounts: Record<LearnerRole, number> = {
    frontline_cashier: 0,
    manager_supervisor: 0,
    delivery_driver: 0,
    owner_executive: 0,
    back_office_admin: 0,
    other: 0
  };
  const roleEvidence: Record<LearnerRole, string[]> = {
    frontline_cashier: [],
    manager_supervisor: [],
    delivery_driver: [],
    owner_executive: [],
    back_office_admin: [],
    other: []
  };

  // Count role indicators and collect evidence
  for (const [role, indicators] of Object.entries(ROLE_INDICATORS) as [LearnerRole, string[]][]) {
    for (const indicator of indicators) {
      if (contentLower.includes(indicator)) {
        roleCounts[role]++;
        // Extract a snippet around the match for evidence
        const idx = contentLower.indexOf(indicator);
        const start = Math.max(0, idx - 20);
        const end = Math.min(sourceContent.length, idx + indicator.length + 30);
        const snippet = sourceContent.substring(start, end).trim();
        if (roleEvidence[role].length < 6) {
          roleEvidence[role].push(`"...${snippet}..."`);
        }
      }
    }
  }

  // Determine primary role (highest count)
  let primaryRole: LearnerRole = 'other';
  let maxCount = 0;
  for (const [role, count] of Object.entries(roleCounts) as [LearnerRole, number][]) {
    if (count > maxCount) {
      maxCount = count;
      primaryRole = role;
    }
  }

  // Determine secondary roles (any with at least 2 matches)
  const secondaryRoles: LearnerRole[] = [];
  for (const [role, count] of Object.entries(roleCounts) as [LearnerRole, number][]) {
    if (role !== primaryRole && count >= 2) {
      secondaryRoles.push(role);
    }
  }

  // Determine confidence
  let roleConfidence: 'high' | 'medium' | 'low' = 'low';
  if (maxCount >= 5) {
    roleConfidence = 'high';
  } else if (maxCount >= 2) {
    roleConfidence = 'medium';
  }

  // If low confidence, default to 'other' for cautious adaptation
  if (roleConfidence === 'low') {
    primaryRole = 'other';
  }

  // Extract learner actions (verbs being taught)
  const learnerActions: string[] = [];
  for (const action of ACTION_VERB_PATTERNS) {
    if (contentLower.includes(action)) {
      learnerActions.push(action);
    }
  }

  // Generate role implications
  const roleImplications = generateRoleImplications(primaryRole, learnerActions);

  return {
    primaryRole,
    secondaryRoles: secondaryRoles.slice(0, 2),
    evidence: roleEvidence[primaryRole].slice(0, 6),
    roleConfidence,
    learnerActions,
    roleImplications
  };
}

/**
 * Generate role implications based on detected role and actions.
 */
function generateRoleImplications(role: LearnerRole, actions: string[]): string[] {
  const implications: string[] = [];

  switch (role) {
    case 'frontline_cashier':
      implications.push('Can check customer IDs at point of sale');
      implications.push('Can refuse sales when policy requires');
      implications.push('Can escalate issues to management');
      if (actions.includes('scan')) implications.push('Can operate register/scanner');
      break;
    case 'manager_supervisor':
      implications.push('Can train and supervise frontline staff');
      implications.push('Can review compliance logs and audits');
      implications.push('Can enforce store-level policy');
      break;
    case 'delivery_driver':
      implications.push('Can verify age at point of delivery');
      implications.push('Can refuse delivery when policy requires');
      break;
    case 'owner_executive':
      implications.push('Can manage business licensing and compliance');
      implications.push('Can set store-wide policies');
      break;
    default:
      implications.push('Role-specific actions to be determined from content');
  }

  return implications;
}

// ============================================================================
// QUALITY GATE: Validate rules map to source learner actions
// ============================================================================
// Simple gate: if a rule doesn't modify a learner action from the source,
// it gets rejected. No hardcoded forbidden lists needed.
// ============================================================================

// Tier-1 domain allowlist: authoritative government sources
const TIER1_DOMAIN_PATTERNS = [
  /\.gov$/i,
  /\.gov\//i,
  /legislature\./i,
  /leg\.state\./i,
  /legis\./i,
  /capitol\./i,
  /admin\.code/i,
  /admincode/i,
  /regulations\./i,
  /rules\.state\./i,
  /sos\.state\./i,
  /dor\.state\./i,
  /atg\.state\./i,
];

/**
 * Check if a URL is from a Tier-1 (authoritative government) source.
 */
function isTier1Source(url: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return TIER1_DOMAIN_PATTERNS.some(pattern => pattern.test(urlLower));
}

export interface ResearchRule {
  rule: string;
  source: string;
  url: string;
  effectiveDate?: string;
  sourceAction?: string; // Which learner action this modifies
  confidence: 'high' | 'medium' | 'low' | 'needs_review';
}

export interface QualityGateResult {
  passed: boolean;
  relevantRules: ResearchRule[];
  rejectedRules: Array<{ rule: ResearchRule; reason: string }>;
  issues: string[];
  tier1Count: number;
}

/**
 * Quality gate: validate rules map to learner actions from source.
 *
 * CORE PRINCIPLE: If a rule doesn't modify something the learner is being
 * taught to DO, it's out of scope. Period.
 */
export function validateResearchRelevance(
  rules: ResearchRule[],
  audience: AudienceDerivation
): QualityGateResult {
  const relevantRules: ResearchRule[] = [];
  const rejectedRules: Array<{ rule: ResearchRule; reason: string }> = [];
  const issues: string[] = [];
  let tier1Count = 0;

  const learnerActions = audience.learnerActions;

  for (const rule of rules) {
    const ruleLower = rule.rule.toLowerCase();
    const isTier1 = isTier1Source(rule.url);

    // SCOPE LOCK: Does this rule modify a learner action?
    let matchedAction: string | null = null;
    for (const action of learnerActions) {
      // Check if rule relates to this action
      const actionWords = action.split(' ');
      if (actionWords.some(word => ruleLower.includes(word))) {
        matchedAction = action;
        break;
      }
    }

    // Also allow generic age/ID/sale rules if learner has related actions
    if (!matchedAction) {
      const genericMatches = [
        { keywords: ['age', 'year', 'old', 'minor'], actions: ['verify age', 'check id'] },
        { keywords: ['id', 'identification', 'license', 'passport'], actions: ['check id', 'verify age', 'ask for'] },
        { keywords: ['refuse', 'deny', 'decline'], actions: ['refuse', 'decline'] },
        { keywords: ['sale', 'sell', 'purchase'], actions: ['ring up', 'complete', 'scan'] }
      ];
      for (const { keywords, actions: relatedActions } of genericMatches) {
        if (keywords.some(kw => ruleLower.includes(kw))) {
          if (relatedActions.some(a => learnerActions.includes(a))) {
            matchedAction = relatedActions.find(a => learnerActions.includes(a)) || null;
            break;
          }
        }
      }
    }

    if (!matchedAction) {
      rejectedRules.push({
        rule,
        reason: `Does not modify any learner action: ${learnerActions.join(', ')}`
      });
      continue;
    }

    rule.sourceAction = matchedAction;

    // Check citation for strong claims
    const strongClaims = ['must', 'required', 'illegal', 'penalty', 'fine', 'violation'];
    if (strongClaims.some(c => ruleLower.includes(c)) && !isTier1) {
      rule.confidence = 'needs_review';
      issues.push(`"${rule.rule.substring(0, 40)}..." needs Tier-1 verification`);
    }

    relevantRules.push(rule);
    if (isTier1) tier1Count++;
  }

  const passed = tier1Count >= 2 && relevantRules.length > 0;

  if (tier1Count < 2) {
    issues.push(`Only ${tier1Count} Tier-1 sources. Need 2+ for quality pass.`);
  }

  return { passed, relevantRules, rejectedRules, issues, tier1Count };
}

// ============================================================================
// VARIANT SYSTEM PROMPT
// ============================================================================

export function getVariantSystemPrompt(
  variantType: VariantType,
  variantContext: VariantContext,
  sourceTrackType: string
): string {
  let focusAreas = '';
  let contextDetails = '';

  switch (variantType) {
    case 'geographic':
      focusAreas = `
## SCOPE LOCK (HARD RULE)
You will receive a derived learner role and list of learner actions from the source.
You may ONLY add state-specific rules that directly modify one of those learner actions.

For any proposed rule, you MUST identify:
- **SourceAction:** Which learner action it modifies
- **WhyItMatters:** 1 sentence on behavioral impact

If you cannot map a rule to a SourceAction, DISCARD it.

## ROLE AWARENESS
Write for the derived role (not assumed). Use second person.
Focus on what the learner DOES, not business operations.

## MINIMAL-DELTA
Change ONLY what the state requires. Same structure, same flow.
If unsure, leave it as-is.`;
      contextDetails = `Target State: ${variantContext.state_name || variantContext.state_code || 'Not specified'}`;
      break;

    case 'company':
      focusAreas = `
- Focus on company policies for ${variantContext.org_name || 'the organization'}.
- Incorporate company-specific procedures, brand standards, escalation paths.
- Maintain the same instructional scope as the source.`;
      contextDetails = `Target Organization: ${variantContext.org_name || 'Not specified'}`;
      break;

    case 'unit':
      focusAreas = `
- Focus on local details for ${variantContext.store_name || 'this unit'}.
- Include store layout, local contacts, specific equipment.
- Maintain the same instructional scope as the source.`;
      contextDetails = `Target Unit/Store: ${variantContext.store_name || variantContext.store_id || 'Not specified'}`;
      break;
  }

  return `You are a training content adaptation assistant.

YOUR GOAL: Adapt training (type: ${sourceTrackType}) into a ${variantType} variant with MINIMAL changes.

CONTEXT:
${contextDetails}

RULES:
${focusAreas}

## CITATION REQUIREMENT
"Must", "required", "illegal", "penalty" claims need Tier-1 (.gov) citation.
If no citation, mark [NEEDS REVIEW].

## OUTPUT FORMAT
1. **Research Findings** — 3-8 rules, each with SourceAction mapping
2. **Draft Script** — Minimal changes from source
3. **Open Questions** — 0-3 company-specific only (POS, escalation, card-all policy)`;
}

// ============================================================================
// CLARIFICATION PROMPT
// ============================================================================

export function getClarificationPrompt(
  variantType: VariantType,
  variantContext: VariantContext,
  sourceContent: string
): string {
  const audience = deriveAudience(sourceContent);
  const contentSummary = sourceContent.substring(0, 400) + (sourceContent.length > 400 ? '...' : '');

  let targetDesc = '';

  switch (variantType) {
    case 'geographic':
      targetDesc = `${variantContext.state_name || 'the specified state'}`;
      break;
    case 'company':
      targetDesc = `${variantContext.org_name || 'your organization'}`;
      break;
    case 'unit':
      targetDesc = `${variantContext.store_name || 'this location'}`;
      break;
  }

  if (variantType === 'geographic') {
    return `## Audience Derivation
**Role:** ${audience.primaryRole.replace('_', ' ')} (${audience.roleConfidence} confidence)
**Evidence:** ${audience.evidence.slice(0, 3).join('; ') || 'None'}
**Learner Actions:** ${audience.learnerActions.join(', ') || 'None detected'}

## Source Summary
"${contentSummary}"

## Approach for ${targetDesc}
I will research ${targetDesc} regulations that modify the learner actions above.
Rules that don't map to a learner action get discarded.

**After research, I may ask (0-3):**
- POS flow for age-restricted items?
- Escalation path?
- Card-all policy?

**Ready?** Type "proceed" or provide company context first.`;
  }

  return `I've analyzed the source for ${targetDesc}.

**Summary:** "${contentSummary}"

Any specific requirements, or should I proceed?`;
}
