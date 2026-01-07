// ============================================================================
// KEY FACTS EXTRACTION - State Variant Intelligence v2
// ============================================================================
// Prompt 3: Extract grounded Key Facts from Evidence, apply deterministic
// QA gates, and produce validated learning_objectives for variant synthesis.
// ============================================================================

import { chatCompletion, type ChatMessage } from '../../supabase/functions/server/utils/openai.ts';
import type { ScopeContract, LearnerRole } from './scopeContract.ts';
import type { ResearchPlan, EvidenceBlock, EvidenceSnippet, SourceTier } from './researchPlan.ts';

// ============================================================================
// TYPES
// ============================================================================

export type QAGateStatus = 'PASS' | 'PASS_WITH_REVIEW' | 'FAIL';

export interface KeyFactCitation {
  evidenceId: string;
  snippetIndex: number;
  tier: SourceTier;
  hostname: string;
  url: string;
  effectiveDate?: string | null;
  quote: string;           // exact substring from snippet
}

export interface KeyFactCandidate {
  id: string;
  factText: string;          // single sentence, atomic claim
  mappedAction: string;      // must be one of scope.allowedLearnerActions
  anchorHit: string[];       // subset of scope.domainAnchors matched
  citations: KeyFactCitation[]; // 1-3 citations
  isStrongClaim: boolean;    // requires Tier-1 support
  qaStatus: QAGateStatus;
  qaFlags: string[];         // reasons for FAIL or REVIEW
  createdAtISO: string;
}

export interface QualityGateResult {
  gate: string;              // gate identifier (A, B, C, D, E)
  gateName: string;          // human-readable name
  status: QAGateStatus;
  reason: string;
  details?: Record<string, unknown>;
}

export interface KeyFactsExtractionResult {
  id: string;
  contractId?: string;
  planId?: string;
  stateCode: string;
  stateName?: string;
  extractedAtISO: string;

  // Results
  keyFacts: KeyFactCandidate[];
  rejectedFacts: Array<{
    factText: string;
    reason: string;
    failedGates: string[];
  }>;

  // Aggregated QA
  overallStatus: QAGateStatus;
  gateResults: QualityGateResult[];

  // Debug/audit
  rawLLMResponse?: string;
  extractionMethod: 'llm' | 'fallback';
}

export interface KeyFactsExtractionInput {
  scopeContract: ScopeContract;
  researchPlan: ResearchPlan;
  evidenceBlocks: EvidenceBlock[];
  sourceContent?: string;
  contractId?: string;
  planId?: string;
  stateCode: string;
  stateName?: string;
}

// ============================================================================
// STRONG CLAIM DETECTION
// ============================================================================

const STRONG_CLAIM_PATTERNS = [
  /\bmust\b/i,
  /\bshall\b/i,
  /\brequired\b/i,
  /\bprohibited\b/i,
  /\billegal\b/i,
  /\bunlawful\b/i,
  /\bfine\s+of\s+\$/i,
  /\bpenalty\b/i,
  /\bviolation\b/i,
  /\bfelony\b/i,
  /\bmisdemeanor\b/i,
  /\blicense\s+revoc/i,
  /\bsuspension\b/i,
  /\bminimum\s+age\b/i,
  /\bmaximum\s+\$/i,
  /\bup\s+to\s+\d+/i,
  /\b\d+\s*years?\s+imprisonment/i,
];

/**
 * Detect if a fact contains strong regulatory/legal claims
 * that require Tier-1 source support.
 */
export function isStrongClaim(factText: string): boolean {
  return STRONG_CLAIM_PATTERNS.some(pattern => pattern.test(factText));
}

// ============================================================================
// SOFT ANCHOR MATCHING WITH DERIVED ALIASES
// ============================================================================

/**
 * Alias mappings for common domain anchor variations.
 * Maps canonical anchor terms to their aliases.
 */
const ANCHOR_ALIASES: Record<string, string[]> = {
  // Age verification terms
  'age verification': ['id check', 'checking id', 'verify age', 'proof of age', 'valid id'],
  'id check': ['age verification', 'checking id', 'verify age', 'proof of age'],
  'valid id': ['government-issued id', 'photo id', 'drivers license', 'state id', 'passport'],

  // Tobacco terms
  'tobacco': ['cigarettes', 'cigars', 'smokeless', 'vape', 'e-cigarette', 'nicotine'],
  'cigarettes': ['tobacco', 'tobacco products', 'smokes'],
  'vape': ['e-cigarette', 'vaping', 'electronic cigarette', 'e-cig'],

  // Alcohol terms
  'alcohol': ['liquor', 'beer', 'wine', 'spirits', 'alcoholic beverages'],
  'liquor': ['alcohol', 'spirits', 'distilled spirits', 'hard liquor'],
  'beer': ['alcohol', 'malt beverage', 'brew'],
  'wine': ['alcohol', 'fermented'],

  // Fuel/UST terms
  'ust': ['underground storage tank', 'fuel tank', 'storage tank'],
  'underground storage tank': ['ust', 'fuel storage', 'tank system'],
  'fuel': ['gasoline', 'diesel', 'petroleum', 'motor fuel'],
  'dispenser': ['fuel pump', 'gas pump', 'pump'],

  // Compliance terms
  'compliance': ['regulatory compliance', 'legal compliance', 'requirements'],
  'training': ['certification', 'education', 'instruction'],
  'permit': ['license', 'authorization', 'approval'],
  'license': ['permit', 'certification', 'authorization'],

  // Retail terms
  'point of sale': ['pos', 'checkout', 'register', 'cash register'],
  'pos': ['point of sale', 'checkout', 'register'],
  'register': ['cash register', 'pos', 'checkout'],

  // Safety terms
  'spill': ['leak', 'release', 'discharge', 'overflow'],
  'leak': ['spill', 'release', 'seepage'],
  'inspection': ['audit', 'review', 'examination', 'check'],
};

/**
 * Get derived aliases for an anchor term.
 */
export function getAnchorAliases(anchor: string): string[] {
  const anchorLower = anchor.toLowerCase();
  const aliases: string[] = [anchorLower];

  // Direct lookup
  if (ANCHOR_ALIASES[anchorLower]) {
    aliases.push(...ANCHOR_ALIASES[anchorLower]);
  }

  // Check if anchor is an alias of something else
  for (const [canonical, aliasList] of Object.entries(ANCHOR_ALIASES)) {
    if (aliasList.some(a => a.toLowerCase() === anchorLower)) {
      aliases.push(canonical);
      aliases.push(...aliasList);
    }
  }

  // Deduplicate
  return [...new Set(aliases)];
}

/**
 * Check if text matches an anchor term (including aliases).
 */
export function matchesAnchor(text: string, anchor: string): boolean {
  const textLower = text.toLowerCase();
  const aliases = getAnchorAliases(anchor);

  return aliases.some(alias => textLower.includes(alias.toLowerCase()));
}

/**
 * Find all matching anchors in text (with alias support).
 */
export function findMatchingAnchors(text: string, anchors: string[]): string[] {
  const matches: string[] = [];

  for (const anchor of anchors) {
    if (matchesAnchor(text, anchor)) {
      matches.push(anchor);
    }
  }

  return matches;
}

// ============================================================================
// DETERMINISTIC QA GATES
// ============================================================================

/**
 * Gate A: Every fact must map to an allowedLearnerAction and hit ≥1 domainAnchor.
 */
function runGateA(
  fact: KeyFactCandidate,
  scopeContract: ScopeContract
): QualityGateResult {
  const { allowedLearnerActions, domainAnchors } = scopeContract;

  // Check action mapping
  const actionMatch = allowedLearnerActions.some(action => {
    const actionLower = action.toLowerCase();
    const factLower = fact.factText.toLowerCase();
    const mappedLower = fact.mappedAction.toLowerCase();

    // Either the mapped action is in our list, or the fact references an allowed action
    return mappedLower.includes(actionLower) ||
           actionLower.includes(mappedLower) ||
           factLower.includes(actionLower);
  });

  if (!actionMatch) {
    return {
      gate: 'A',
      gateName: 'Mapping/Scope Gate',
      status: 'FAIL',
      reason: `Fact does not map to any allowed learner action. Mapped: "${fact.mappedAction}"`,
      details: { allowedActions: allowedLearnerActions },
    };
  }

  // Check anchor hit (using soft matching)
  const anchorHits = findMatchingAnchors(fact.factText, domainAnchors);

  if (anchorHits.length === 0) {
    return {
      gate: 'A',
      gateName: 'Mapping/Scope Gate',
      status: 'FAIL',
      reason: 'Fact does not reference any domain anchor (even with aliases)',
      details: { domainAnchors, checkedAliases: true },
    };
  }

  // Update fact with actual anchor hits
  fact.anchorHit = anchorHits;

  return {
    gate: 'A',
    gateName: 'Mapping/Scope Gate',
    status: 'PASS',
    reason: `Maps to action and hits ${anchorHits.length} anchor(s)`,
    details: { anchorHits },
  };
}

/**
 * Gate B: Strong claims (must/shall/penalty) must have at least one Tier-1 citation.
 */
function runGateB(
  fact: KeyFactCandidate
): QualityGateResult {
  const isStrong = isStrongClaim(fact.factText);
  fact.isStrongClaim = isStrong;

  if (!isStrong) {
    return {
      gate: 'B',
      gateName: 'Strong Claim Support Gate',
      status: 'PASS',
      reason: 'Not a strong claim, Tier-1 not required',
    };
  }

  const hasTier1 = fact.citations.some(c => c.tier === 'tier1');

  if (!hasTier1) {
    // Check if we have tier2 - can pass with review
    const hasTier2 = fact.citations.some(c => c.tier === 'tier2');

    if (hasTier2) {
      return {
        gate: 'B',
        gateName: 'Strong Claim Support Gate',
        status: 'PASS_WITH_REVIEW',
        reason: 'Strong claim has Tier-2 support but lacks Tier-1. Manual review required.',
        details: {
          strongClaimPatterns: STRONG_CLAIM_PATTERNS
            .filter(p => p.test(fact.factText))
            .map(p => p.source)
        },
      };
    }

    return {
      gate: 'B',
      gateName: 'Strong Claim Support Gate',
      status: 'FAIL',
      reason: 'Strong claim requires Tier-1 citation (none found)',
      details: {
        citationTiers: fact.citations.map(c => c.tier),
        strongClaimPatterns: STRONG_CLAIM_PATTERNS
          .filter(p => p.test(fact.factText))
          .map(p => p.source)
      },
    };
  }

  return {
    gate: 'B',
    gateName: 'Strong Claim Support Gate',
    status: 'PASS',
    reason: 'Strong claim has Tier-1 support',
  };
}

/**
 * Gate C: Date hygiene - warn if effectiveDate is missing or > 3 years old.
 */
function runGateC(
  fact: KeyFactCandidate
): QualityGateResult {
  const now = new Date();
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

  let hasDate = false;
  let hasStaleDate = false;
  let staleCitations: string[] = [];

  for (const citation of fact.citations) {
    if (citation.effectiveDate) {
      hasDate = true;

      try {
        const dateStr = citation.effectiveDate;
        const parsed = new Date(dateStr);

        if (!isNaN(parsed.getTime()) && parsed < threeYearsAgo) {
          hasStaleDate = true;
          staleCitations.push(`${citation.hostname}: ${dateStr}`);
        }
      } catch {
        // Can't parse date, treat as missing
      }
    }
  }

  if (!hasDate) {
    return {
      gate: 'C',
      gateName: 'Date Hygiene Gate',
      status: 'PASS_WITH_REVIEW',
      reason: 'No effective dates found on citations. Manual verification recommended.',
    };
  }

  if (hasStaleDate) {
    return {
      gate: 'C',
      gateName: 'Date Hygiene Gate',
      status: 'PASS_WITH_REVIEW',
      reason: `Some citations are >3 years old: ${staleCitations.join(', ')}`,
      details: { staleCitations },
    };
  }

  return {
    gate: 'C',
    gateName: 'Date Hygiene Gate',
    status: 'PASS',
    reason: 'Citations have recent effective dates',
  };
}

/**
 * Gate D: Dedupe/merge - detect near-duplicate facts.
 * Returns the duplicate if found, otherwise null.
 */
export function findDuplicateFact(
  fact: KeyFactCandidate,
  existingFacts: KeyFactCandidate[]
): KeyFactCandidate | null {
  const factWords = new Set(
    fact.factText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );

  for (const existing of existingFacts) {
    const existingWords = new Set(
      existing.factText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    // Calculate Jaccard similarity
    const intersection = [...factWords].filter(w => existingWords.has(w));
    const union = new Set([...factWords, ...existingWords]);
    const similarity = intersection.length / union.size;

    if (similarity > 0.7) {
      return existing;
    }
  }

  return null;
}

function runGateD(
  fact: KeyFactCandidate,
  existingFacts: KeyFactCandidate[]
): QualityGateResult {
  const duplicate = findDuplicateFact(fact, existingFacts);

  if (duplicate) {
    return {
      gate: 'D',
      gateName: 'Dedupe/Merge Gate',
      status: 'FAIL',
      reason: `Near-duplicate of existing fact: "${duplicate.factText.substring(0, 50)}..."`,
      details: { duplicateId: duplicate.id },
    };
  }

  return {
    gate: 'D',
    gateName: 'Dedupe/Merge Gate',
    status: 'PASS',
    reason: 'No duplicates found',
  };
}

/**
 * Gate E: Size guardrails - ensure we have reasonable fact counts.
 * This is run at the batch level, not per-fact.
 */
function runGateE(
  facts: KeyFactCandidate[],
  evidenceCount: number
): QualityGateResult {
  if (facts.length === 0) {
    return {
      gate: 'E',
      gateName: 'Size Guardrail Gate',
      status: 'FAIL',
      reason: 'No facts extracted from evidence',
      details: { evidenceCount },
    };
  }

  if (facts.length < 3 && evidenceCount > 5) {
    return {
      gate: 'E',
      gateName: 'Size Guardrail Gate',
      status: 'PASS_WITH_REVIEW',
      reason: `Only ${facts.length} facts from ${evidenceCount} evidence blocks. May be under-extracting.`,
      details: { factCount: facts.length, evidenceCount },
    };
  }

  if (facts.length > 50) {
    return {
      gate: 'E',
      gateName: 'Size Guardrail Gate',
      status: 'PASS_WITH_REVIEW',
      reason: `${facts.length} facts may be over-granular. Consider consolidation.`,
      details: { factCount: facts.length },
    };
  }

  return {
    gate: 'E',
    gateName: 'Size Guardrail Gate',
    status: 'PASS',
    reason: `${facts.length} facts from ${evidenceCount} evidence blocks`,
    details: { factCount: facts.length, evidenceCount },
  };
}

/**
 * Run all gates on a fact candidate and return aggregate status.
 */
export function runAllGates(
  fact: KeyFactCandidate,
  scopeContract: ScopeContract,
  existingFacts: KeyFactCandidate[]
): { status: QAGateStatus; flags: string[]; gateResults: QualityGateResult[] } {
  const gateResults: QualityGateResult[] = [];
  const flags: string[] = [];

  // Run gates A-D (per-fact gates)
  const gateA = runGateA(fact, scopeContract);
  gateResults.push(gateA);
  if (gateA.status !== 'PASS') flags.push(`A: ${gateA.reason}`);

  const gateB = runGateB(fact);
  gateResults.push(gateB);
  if (gateB.status !== 'PASS') flags.push(`B: ${gateB.reason}`);

  const gateC = runGateC(fact);
  gateResults.push(gateC);
  if (gateC.status !== 'PASS') flags.push(`C: ${gateC.reason}`);

  const gateD = runGateD(fact, existingFacts);
  gateResults.push(gateD);
  if (gateD.status !== 'PASS') flags.push(`D: ${gateD.reason}`);

  // Determine aggregate status
  const hasFail = gateResults.some(g => g.status === 'FAIL');
  const hasReview = gateResults.some(g => g.status === 'PASS_WITH_REVIEW');

  let status: QAGateStatus = 'PASS';
  if (hasFail) status = 'FAIL';
  else if (hasReview) status = 'PASS_WITH_REVIEW';

  return { status, flags, gateResults };
}

// ============================================================================
// CITATION VALIDATION
// ============================================================================

/**
 * Validate that a citation quote is an exact substring of the evidence snippet.
 */
export function validateCitationQuote(
  quote: string,
  evidenceBlock: EvidenceBlock
): { valid: boolean; snippetIndex: number; normalizedQuote: string } {
  const quoteLower = quote.toLowerCase().trim();

  for (let i = 0; i < evidenceBlock.snippets.length; i++) {
    const snippetLower = evidenceBlock.snippets[i].text.toLowerCase();

    if (snippetLower.includes(quoteLower)) {
      return { valid: true, snippetIndex: i, normalizedQuote: quote.trim() };
    }
  }

  // Try fuzzy match - allow for minor differences
  for (let i = 0; i < evidenceBlock.snippets.length; i++) {
    const snippetWords = evidenceBlock.snippets[i].text.toLowerCase().split(/\s+/);
    const quoteWords = quoteLower.split(/\s+/).filter(w => w.length > 2);

    const matchedWords = quoteWords.filter(qw => snippetWords.some(sw => sw.includes(qw)));
    if (matchedWords.length >= quoteWords.length * 0.8) {
      return { valid: true, snippetIndex: i, normalizedQuote: quote.trim() };
    }
  }

  return { valid: false, snippetIndex: -1, normalizedQuote: quote };
}

// ============================================================================
// LLM EXTRACTION PROMPT
// ============================================================================

function buildKeyFactsExtractionPrompt(
  input: KeyFactsExtractionInput
): ChatMessage[] {
  const { scopeContract, researchPlan, evidenceBlocks, stateCode, stateName } = input;

  const systemMessage = `You are a legal research analyst extracting grounded Key Facts from evidence.

OUTPUT FORMAT: Valid JSON only. No markdown. No extra keys.
{
  "keyFacts": [
    {
      "factText": "Single sentence atomic claim",
      "mappedAction": "exact action from allowedLearnerActions",
      "anchorHit": ["anchor terms matched"],
      "citations": [
        {
          "evidenceId": "id from evidence block",
          "quote": "EXACT substring from evidence snippet"
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. factText must be a single atomic sentence - one claim per fact
2. mappedAction MUST exactly match one of the allowedLearnerActions provided
3. Each fact MUST hit at least one domainAnchor
4. quote MUST be an exact substring from the evidence - no paraphrasing
5. Strong claims (must/shall/prohibited/penalty) require the strongest evidence
6. Do NOT include facts about topics outside the scope contract
7. Do NOT include generic facts not specific to ${stateName || stateCode}`;

  const evidenceSummary = evidenceBlocks.map(eb => ({
    evidenceId: eb.evidenceId,
    url: eb.url,
    tier: eb.tier,
    title: eb.title,
    snippets: eb.snippets.map((s, i) => ({ index: i, text: s.text })),
    effectiveDate: eb.effectiveDate,
  }));

  const userMessage = `Extract Key Facts for ${stateName || stateCode} training adaptation.

SCOPE CONTRACT:
- Primary Role: ${scopeContract.primaryRole}
- Instructional Goal: ${scopeContract.instructionalGoal}

ALLOWED LEARNER ACTIONS (factText must map to one of these):
${scopeContract.allowedLearnerActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

DOMAIN ANCHORS (each fact must reference at least one):
${scopeContract.domainAnchors.join(', ')}

DISALLOWED TOPICS (do NOT extract facts about these):
${scopeContract.disallowedActionClasses.join(', ')}

EVIDENCE BLOCKS:
${JSON.stringify(evidenceSummary, null, 2)}

Extract atomic Key Facts. Each fact must:
1. Be a single sentence with one specific claim
2. Be grounded with an exact quote from evidence
3. Map to an allowed learner action
4. Be relevant to ${scopeContract.primaryRole} in ${stateName || stateCode}

Output valid JSON with keyFacts array.`;

  return [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ];
}

// ============================================================================
// FALLBACK EXTRACTION
// ============================================================================

/**
 * Simple rule-based extraction when LLM fails.
 */
function extractFallbackFacts(
  input: KeyFactsExtractionInput
): KeyFactCandidate[] {
  const { scopeContract, evidenceBlocks, stateCode, stateName } = input;
  const facts: KeyFactCandidate[] = [];

  for (const evidence of evidenceBlocks) {
    for (let snippetIdx = 0; snippetIdx < evidence.snippets.length; snippetIdx++) {
      const snippet = evidence.snippets[snippetIdx];

      // Check for anchor matches
      const anchorHits = findMatchingAnchors(snippet.text, scopeContract.domainAnchors);
      if (anchorHits.length === 0) continue;

      // Find relevant action
      let mappedAction = scopeContract.allowedLearnerActions[0];
      for (const action of scopeContract.allowedLearnerActions) {
        const actionKeywords = action.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (actionKeywords.some(kw => snippet.text.toLowerCase().includes(kw))) {
          mappedAction = action;
          break;
        }
      }

      // Extract first sentence as fact
      const sentences = snippet.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      if (sentences.length === 0) continue;

      const factText = sentences[0].trim() + '.';

      // Check for duplicates
      if (facts.some(f => findDuplicateFact(f, [{ ...f, factText }]))) {
        continue;
      }

      const fact: KeyFactCandidate = {
        id: crypto.randomUUID(),
        factText,
        mappedAction,
        anchorHit: anchorHits,
        citations: [{
          evidenceId: evidence.evidenceId,
          snippetIndex: snippetIdx,
          tier: evidence.tier,
          hostname: evidence.hostname,
          url: evidence.url,
          effectiveDate: evidence.effectiveDate,
          quote: factText.substring(0, 100),
        }],
        isStrongClaim: isStrongClaim(factText),
        qaStatus: 'PASS_WITH_REVIEW',
        qaFlags: ['Extracted via fallback method - requires review'],
        createdAtISO: new Date().toISOString(),
      };

      facts.push(fact);

      if (facts.length >= 20) break;
    }

    if (facts.length >= 20) break;
  }

  return facts;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export async function extractKeyFacts(
  input: KeyFactsExtractionInput
): Promise<KeyFactsExtractionResult> {
  const { scopeContract, researchPlan, evidenceBlocks, contractId, planId, stateCode, stateName } = input;

  console.log('[KeyFacts] Starting extraction for:', stateCode, 'with', evidenceBlocks.length, 'evidence blocks');

  let rawKeyFacts: Array<{
    factText: string;
    mappedAction: string;
    anchorHit?: string[];
    citations: Array<{ evidenceId: string; quote: string }>;
  }> = [];
  let rawLLMResponse: string | undefined;
  let extractionMethod: 'llm' | 'fallback' = 'llm';

  // Try LLM extraction
  try {
    const messages = buildKeyFactsExtractionPrompt(input);

    rawLLMResponse = await chatCompletion(messages, {
      temperature: 0.2, // Low temperature for factual extraction
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(rawLLMResponse);
    rawKeyFacts = parsed.keyFacts || parsed.key_facts || [];

    console.log('[KeyFacts] LLM extracted', rawKeyFacts.length, 'raw facts');

  } catch (error) {
    console.error('[KeyFacts] LLM extraction failed:', error);
    extractionMethod = 'fallback';
  }

  // Use fallback if LLM failed or returned nothing
  if (rawKeyFacts.length === 0) {
    console.log('[KeyFacts] Using fallback extraction');
    const fallbackFacts = extractFallbackFacts(input);
    extractionMethod = 'fallback';

    // Convert fallback to result format
    const passedFacts: KeyFactCandidate[] = [];
    const rejectedFacts: Array<{ factText: string; reason: string; failedGates: string[] }> = [];

    for (const fact of fallbackFacts) {
      const { status, flags, gateResults } = runAllGates(fact, scopeContract, passedFacts);

      fact.qaStatus = status;
      fact.qaFlags = flags;

      if (status === 'FAIL') {
        rejectedFacts.push({
          factText: fact.factText,
          reason: flags.join('; '),
          failedGates: gateResults.filter(g => g.status === 'FAIL').map(g => g.gate),
        });
      } else {
        passedFacts.push(fact);
      }
    }

    const gateE = runGateE(passedFacts, evidenceBlocks.length);
    const allGates = [gateE];

    const overallStatus = passedFacts.some(f => f.qaStatus === 'FAIL') ? 'FAIL'
      : passedFacts.some(f => f.qaStatus === 'PASS_WITH_REVIEW') || gateE.status === 'PASS_WITH_REVIEW' ? 'PASS_WITH_REVIEW'
      : 'PASS';

    return {
      id: crypto.randomUUID(),
      contractId,
      planId,
      stateCode,
      stateName,
      extractedAtISO: new Date().toISOString(),
      keyFacts: passedFacts,
      rejectedFacts,
      overallStatus,
      gateResults: allGates,
      rawLLMResponse,
      extractionMethod,
    };
  }

  // Process LLM-extracted facts through QA gates
  const evidenceMap = new Map(evidenceBlocks.map(eb => [eb.evidenceId, eb]));
  const passedFacts: KeyFactCandidate[] = [];
  const rejectedFacts: Array<{ factText: string; reason: string; failedGates: string[] }> = [];

  for (const rawFact of rawKeyFacts) {
    // Validate and build citations
    const citations: KeyFactCitation[] = [];

    for (const rawCite of rawFact.citations || []) {
      const evidence = evidenceMap.get(rawCite.evidenceId);

      if (!evidence) {
        console.log('[KeyFacts] Citation references unknown evidence:', rawCite.evidenceId);
        continue;
      }

      // Validate quote is exact substring
      const validation = validateCitationQuote(rawCite.quote, evidence);

      if (!validation.valid) {
        console.log('[KeyFacts] Citation quote not found in evidence:', rawCite.quote.substring(0, 50));
        continue;
      }

      citations.push({
        evidenceId: evidence.evidenceId,
        snippetIndex: validation.snippetIndex,
        tier: evidence.tier,
        hostname: evidence.hostname,
        url: evidence.url,
        effectiveDate: evidence.effectiveDate,
        quote: validation.normalizedQuote,
      });
    }

    // Skip facts with no valid citations
    if (citations.length === 0) {
      rejectedFacts.push({
        factText: rawFact.factText,
        reason: 'No valid citations (quotes not found in evidence)',
        failedGates: ['CITATION_VALIDATION'],
      });
      continue;
    }

    // Build fact candidate
    const fact: KeyFactCandidate = {
      id: crypto.randomUUID(),
      factText: rawFact.factText,
      mappedAction: rawFact.mappedAction,
      anchorHit: rawFact.anchorHit || [],
      citations,
      isStrongClaim: isStrongClaim(rawFact.factText),
      qaStatus: 'PASS',
      qaFlags: [],
      createdAtISO: new Date().toISOString(),
    };

    // Run QA gates
    const { status, flags, gateResults } = runAllGates(fact, scopeContract, passedFacts);

    fact.qaStatus = status;
    fact.qaFlags = flags;

    if (status === 'FAIL') {
      rejectedFacts.push({
        factText: fact.factText,
        reason: flags.join('; '),
        failedGates: gateResults.filter(g => g.status === 'FAIL').map(g => g.gate),
      });
    } else {
      passedFacts.push(fact);
    }
  }

  // Run batch-level gate E
  const gateE = runGateE(passedFacts, evidenceBlocks.length);

  // Calculate overall status
  const hasFailedFacts = passedFacts.some(f => f.qaStatus === 'FAIL');
  const hasReviewFacts = passedFacts.some(f => f.qaStatus === 'PASS_WITH_REVIEW');

  let overallStatus: QAGateStatus = 'PASS';
  if (hasFailedFacts || gateE.status === 'FAIL') {
    overallStatus = 'FAIL';
  } else if (hasReviewFacts || gateE.status === 'PASS_WITH_REVIEW') {
    overallStatus = 'PASS_WITH_REVIEW';
  }

  console.log('[KeyFacts] Extraction complete:', {
    passed: passedFacts.length,
    rejected: rejectedFacts.length,
    overallStatus,
  });

  return {
    id: crypto.randomUUID(),
    contractId,
    planId,
    stateCode,
    stateName,
    extractedAtISO: new Date().toISOString(),
    keyFacts: passedFacts,
    rejectedFacts,
    overallStatus,
    gateResults: [gateE],
    rawLLMResponse,
    extractionMethod,
  };
}

// ============================================================================
// MERGE DUPLICATE FACTS
// ============================================================================

/**
 * Merge two near-duplicate facts, keeping the one with better citations.
 */
export function mergeDuplicateFacts(
  fact1: KeyFactCandidate,
  fact2: KeyFactCandidate
): KeyFactCandidate {
  // Keep the one with more/better citations
  const score1 = fact1.citations.reduce((acc, c) => {
    if (c.tier === 'tier1') return acc + 3;
    if (c.tier === 'tier2') return acc + 2;
    return acc + 1;
  }, 0);

  const score2 = fact2.citations.reduce((acc, c) => {
    if (c.tier === 'tier1') return acc + 3;
    if (c.tier === 'tier2') return acc + 2;
    return acc + 1;
  }, 0);

  const primary = score1 >= score2 ? fact1 : fact2;
  const secondary = score1 >= score2 ? fact2 : fact1;

  // Merge citations (dedupe by evidenceId + snippetIndex)
  const seenCitations = new Set(
    primary.citations.map(c => `${c.evidenceId}:${c.snippetIndex}`)
  );

  const mergedCitations = [...primary.citations];
  for (const cite of secondary.citations) {
    const key = `${cite.evidenceId}:${cite.snippetIndex}`;
    if (!seenCitations.has(key)) {
      mergedCitations.push(cite);
      seenCitations.add(key);
    }
  }

  // Merge anchor hits
  const mergedAnchors = [...new Set([...primary.anchorHit, ...secondary.anchorHit])];

  return {
    ...primary,
    citations: mergedCitations.slice(0, 5), // Cap at 5 citations
    anchorHit: mergedAnchors,
  };
}

// ============================================================================
// LOGGING / PERSISTENCE
// ============================================================================

export interface KeyFactsExtractionLog {
  id: string;
  timestamp: string;
  contractId?: string;
  planId?: string;
  stateCode: string;
  result: KeyFactsExtractionResult;
}

export function createKeyFactsExtractionLog(
  result: KeyFactsExtractionResult
): KeyFactsExtractionLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    contractId: result.contractId,
    planId: result.planId,
    stateCode: result.stateCode,
    result,
  };
}
