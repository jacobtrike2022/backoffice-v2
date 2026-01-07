// ============================================================================
// KEY FACTS EXTRACTION TESTS - State Variant Intelligence v2
// ============================================================================
// Tests for Prompt 3: Key Facts extraction, QA gates, and grounding validation.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isStrongClaim,
  getAnchorAliases,
  matchesAnchor,
  findMatchingAnchors,
  findDuplicateFact,
  mergeDuplicateFacts,
  runAllGates,
  validateCitationQuote,
  type KeyFactCandidate,
  type KeyFactCitation,
  type QAGateStatus,
} from '../keyFacts';
import type { ScopeContract, LearnerRole } from '../scopeContract';
import type { EvidenceBlock, SourceTier } from '../researchPlan';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockScopeContract = (overrides: Partial<ScopeContract> = {}): ScopeContract => ({
  primaryRole: 'frontline_store_associate' as LearnerRole,
  secondaryRoles: [],
  roleConfidence: 'high',
  roleEvidenceQuotes: [],
  allowedLearnerActions: [
    'verify customer age using valid ID',
    'scan ID barcode with POS system',
    'refuse sale to underage customer',
    'check expiration date on ID',
    'report suspicious IDs to supervisor',
  ],
  disallowedActionClasses: [
    'file tax returns',
    'renew business licenses',
    'set pricing policies',
    'negotiate vendor contracts',
    'conduct equipment inspections',
  ],
  domainAnchors: [
    'tobacco',
    'age verification',
    'valid ID',
    'point of sale',
    'customer',
    'compliance',
  ],
  instructionalGoal: 'Train associates to properly verify customer age before tobacco sales.',
  ...overrides,
});

const createMockEvidenceBlock = (overrides: Partial<EvidenceBlock> = {}): EvidenceBlock => ({
  evidenceId: 'evidence-1',
  queryId: 'query-1',
  url: 'https://www.texas.gov/tobacco-regulations',
  hostname: 'texas.gov',
  title: 'Texas Tobacco Sales Regulations',
  publisher: 'State of Texas',
  tier: 'tier1' as SourceTier,
  retrievedAtISO: new Date().toISOString(),
  effectiveDate: '2024-01-01',
  updatedDate: null,
  snippets: [
    {
      text: 'In Texas, retailers must verify that customers are at least 21 years old before selling tobacco products. A valid government-issued photo ID is required.',
      context: 'Age verification requirements section',
    },
    {
      text: 'Retailers who sell tobacco to minors face penalties of up to $500 for the first offense and potential license suspension for repeat violations.',
      context: 'Penalties section',
    },
  ],
  rawTextHash: 'abc123',
  ...overrides,
});

const createMockKeyFact = (overrides: Partial<KeyFactCandidate> = {}): KeyFactCandidate => ({
  id: 'fact-1',
  factText: 'In Texas, retailers must verify that customers are at least 21 years old before selling tobacco products.',
  mappedAction: 'verify customer age using valid ID',
  anchorHit: ['tobacco', 'age verification'],
  citations: [
    {
      evidenceId: 'evidence-1',
      snippetIndex: 0,
      tier: 'tier1' as SourceTier,
      hostname: 'texas.gov',
      url: 'https://www.texas.gov/tobacco-regulations',
      effectiveDate: '2024-01-01',
      quote: 'retailers must verify that customers are at least 21 years old before selling tobacco products',
    },
  ],
  isStrongClaim: true,
  qaStatus: 'PASS' as QAGateStatus,
  qaFlags: [],
  createdAtISO: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// STRONG CLAIM DETECTION TESTS
// ============================================================================

describe('isStrongClaim', () => {
  it('detects "must" as a strong claim', () => {
    expect(isStrongClaim('Retailers must verify customer age')).toBe(true);
  });

  it('detects "shall" as a strong claim', () => {
    expect(isStrongClaim('The clerk shall check ID for all tobacco sales')).toBe(true);
  });

  it('detects "required" as a strong claim', () => {
    expect(isStrongClaim('Age verification is required for all tobacco purchases')).toBe(true);
  });

  it('detects penalty language as a strong claim', () => {
    expect(isStrongClaim('Violators face a penalty of up to $1000')).toBe(true);
    expect(isStrongClaim('This is a violation of state law')).toBe(true);
    expect(isStrongClaim('Fines of $500 may be imposed')).toBe(true);
  });

  it('detects "illegal" and "prohibited" as strong claims', () => {
    expect(isStrongClaim('It is illegal to sell tobacco to minors')).toBe(true);
    expect(isStrongClaim('Sales are prohibited without valid ID')).toBe(true);
  });

  it('detects minimum age claims as strong', () => {
    expect(isStrongClaim('Customers must be minimum age 21 to purchase')).toBe(true);
  });

  it('returns false for non-strong claims', () => {
    expect(isStrongClaim('Retailers should verify customer age')).toBe(false);
    expect(isStrongClaim('It is recommended to check ID')).toBe(false);
    expect(isStrongClaim('Many stores use barcode scanners')).toBe(false);
  });
});

// ============================================================================
// SOFT ANCHOR MATCHING TESTS
// ============================================================================

describe('getAnchorAliases', () => {
  it('returns aliases for tobacco', () => {
    const aliases = getAnchorAliases('tobacco');
    expect(aliases).toContain('tobacco');
    expect(aliases).toContain('cigarettes');
    expect(aliases).toContain('vape');
    expect(aliases).toContain('e-cigarette');
  });

  it('returns aliases for age verification', () => {
    const aliases = getAnchorAliases('age verification');
    expect(aliases).toContain('age verification');
    expect(aliases).toContain('id check');
    expect(aliases).toContain('verify age');
  });

  it('handles reverse lookup (alias to canonical)', () => {
    const aliases = getAnchorAliases('e-cig');
    expect(aliases).toContain('e-cig');
    expect(aliases).toContain('vape');
    expect(aliases).toContain('e-cigarette');
  });

  it('returns just the input for unknown anchors', () => {
    const aliases = getAnchorAliases('obscure-term');
    expect(aliases).toContain('obscure-term');
    expect(aliases.length).toBe(1);
  });
});

describe('matchesAnchor', () => {
  it('matches exact anchor in text', () => {
    expect(matchesAnchor('This is about tobacco sales', 'tobacco')).toBe(true);
  });

  it('matches anchor alias in text', () => {
    expect(matchesAnchor('This is about cigarette sales', 'tobacco')).toBe(true);
    expect(matchesAnchor('Using the vape product', 'tobacco')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(matchesAnchor('TOBACCO sales are regulated', 'tobacco')).toBe(true);
    expect(matchesAnchor('Age Verification is required', 'age verification')).toBe(true);
  });

  it('returns false when no match', () => {
    expect(matchesAnchor('This text has no relevant terms', 'tobacco')).toBe(false);
  });
});

describe('findMatchingAnchors', () => {
  it('finds all matching anchors in text', () => {
    const text = 'Verify customer age using valid ID before tobacco sale';
    const anchors = ['tobacco', 'age verification', 'valid ID', 'fuel', 'alcohol'];
    const matches = findMatchingAnchors(text, anchors);

    expect(matches).toContain('tobacco');
    expect(matches).toContain('age verification');
    expect(matches).toContain('valid ID');
    expect(matches).not.toContain('fuel');
    expect(matches).not.toContain('alcohol');
  });

  it('matches via aliases', () => {
    const text = 'Check ID before cigarette purchase';
    const anchors = ['tobacco', 'age verification'];
    const matches = findMatchingAnchors(text, anchors);

    // 'cigarette' is an alias of 'tobacco'
    expect(matches).toContain('tobacco');
    // 'check id' is close to 'id check' which is alias of 'age verification'
    expect(matches).toContain('age verification');
  });
});

// ============================================================================
// DUPLICATE DETECTION TESTS
// ============================================================================

describe('findDuplicateFact', () => {
  it('detects near-duplicate facts', () => {
    const existingFact = createMockKeyFact({
      factText: 'In Texas, retailers must verify that customers are at least 21 years old before selling tobacco products.',
    });

    const newFact = createMockKeyFact({
      id: 'fact-2',
      factText: 'Texas retailers must verify customers are at least 21 years old before tobacco product sales.',
    });

    const duplicate = findDuplicateFact(newFact, [existingFact]);
    expect(duplicate).not.toBeNull();
    expect(duplicate?.id).toBe('fact-1');
  });

  it('does not flag different facts as duplicates', () => {
    const existingFact = createMockKeyFact({
      factText: 'In Texas, retailers must verify that customers are at least 21 years old before selling tobacco products.',
    });

    const newFact = createMockKeyFact({
      id: 'fact-2',
      factText: 'Retailers who sell tobacco to minors face penalties of up to $500 for the first offense.',
    });

    const duplicate = findDuplicateFact(newFact, [existingFact]);
    expect(duplicate).toBeNull();
  });

  it('handles empty existing facts array', () => {
    const newFact = createMockKeyFact();
    const duplicate = findDuplicateFact(newFact, []);
    expect(duplicate).toBeNull();
  });
});

describe('mergeDuplicateFacts', () => {
  it('keeps fact with better tier citations', () => {
    const tier1Fact = createMockKeyFact({
      id: 'fact-tier1',
      citations: [
        {
          evidenceId: 'evidence-1',
          snippetIndex: 0,
          tier: 'tier1',
          hostname: 'texas.gov',
          url: 'https://texas.gov/regs',
          effectiveDate: '2024-01-01',
          quote: 'test quote',
        },
      ],
    });

    const tier2Fact = createMockKeyFact({
      id: 'fact-tier2',
      citations: [
        {
          evidenceId: 'evidence-2',
          snippetIndex: 0,
          tier: 'tier2',
          hostname: 'justia.com',
          url: 'https://justia.com/law',
          effectiveDate: '2024-01-01',
          quote: 'another quote',
        },
      ],
    });

    const merged = mergeDuplicateFacts(tier1Fact, tier2Fact);

    // Should keep tier1 fact as primary
    expect(merged.id).toBe('fact-tier1');
    // Should merge citations from both
    expect(merged.citations.length).toBe(2);
  });

  it('deduplicates citations', () => {
    const fact1 = createMockKeyFact({
      citations: [
        {
          evidenceId: 'evidence-1',
          snippetIndex: 0,
          tier: 'tier1',
          hostname: 'texas.gov',
          url: 'https://texas.gov/regs',
          effectiveDate: '2024-01-01',
          quote: 'test quote',
        },
      ],
    });

    const fact2 = createMockKeyFact({
      id: 'fact-2',
      citations: [
        {
          evidenceId: 'evidence-1', // Same evidence
          snippetIndex: 0,          // Same snippet
          tier: 'tier1',
          hostname: 'texas.gov',
          url: 'https://texas.gov/regs',
          effectiveDate: '2024-01-01',
          quote: 'test quote',
        },
      ],
    });

    const merged = mergeDuplicateFacts(fact1, fact2);
    expect(merged.citations.length).toBe(1);
  });
});

// ============================================================================
// CITATION VALIDATION TESTS
// ============================================================================

describe('validateCitationQuote', () => {
  it('validates exact substring match', () => {
    const evidence = createMockEvidenceBlock();
    const result = validateCitationQuote(
      'retailers must verify that customers are at least 21 years old',
      evidence
    );

    expect(result.valid).toBe(true);
    expect(result.snippetIndex).toBe(0);
  });

  it('validates case-insensitive match', () => {
    const evidence = createMockEvidenceBlock();
    const result = validateCitationQuote(
      'RETAILERS MUST VERIFY that customers are at least 21 years old',
      evidence
    );

    expect(result.valid).toBe(true);
  });

  it('rejects quotes not in evidence', () => {
    const evidence = createMockEvidenceBlock();
    const result = validateCitationQuote(
      'This text does not appear in the evidence at all',
      evidence
    );

    expect(result.valid).toBe(false);
  });

  it('allows fuzzy match for minor differences', () => {
    const evidence = createMockEvidenceBlock();
    // Slightly different wording but most words match
    const result = validateCitationQuote(
      'retailers must verify customers at least 21 years before selling tobacco',
      evidence
    );

    // Should pass fuzzy matching (80% word overlap)
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// QA GATES TESTS
// ============================================================================

describe('runAllGates', () => {
  let scopeContract: ScopeContract;

  beforeEach(() => {
    scopeContract = createMockScopeContract();
  });

  describe('Gate A: Mapping/Scope Gate', () => {
    it('passes when fact maps to allowed action and hits anchor', () => {
      const fact = createMockKeyFact({
        mappedAction: 'verify customer age using valid ID',
        anchorHit: [],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateA = gateResults.find(g => g.gate === 'A');
      expect(gateA?.status).toBe('PASS');
    });

    it('fails when mapped action not in allowed list', () => {
      const fact = createMockKeyFact({
        mappedAction: 'file annual tax return', // Not in allowed actions
        anchorHit: ['tobacco'],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateA = gateResults.find(g => g.gate === 'A');
      expect(gateA?.status).toBe('FAIL');
    });

    it('fails when no anchor matches', () => {
      const fact = createMockKeyFact({
        factText: 'This fact has no relevant domain terms at all.', // No anchor terms
        mappedAction: 'verify customer age using valid ID',
        anchorHit: [],
      });

      const contractNoAnchors = createMockScopeContract({
        domainAnchors: ['fuel', 'gasoline', 'UST'], // No matches in fact
      });

      const { status, gateResults } = runAllGates(fact, contractNoAnchors, []);

      const gateA = gateResults.find(g => g.gate === 'A');
      expect(gateA?.status).toBe('FAIL');
    });
  });

  describe('Gate B: Strong Claim Support Gate', () => {
    it('passes non-strong claims without tier1', () => {
      const fact = createMockKeyFact({
        factText: 'Retailers often use barcode scanners to verify age.', // No strong language
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier2',
            hostname: 'justia.com',
            url: 'https://justia.com/law',
            effectiveDate: '2024-01-01',
            quote: 'test',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateB = gateResults.find(g => g.gate === 'B');
      expect(gateB?.status).toBe('PASS');
    });

    it('passes strong claims with tier1 citation', () => {
      const fact = createMockKeyFact({
        factText: 'Retailers must verify customer age before tobacco sales.',
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/regs',
            effectiveDate: '2024-01-01',
            quote: 'must verify customer age',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateB = gateResults.find(g => g.gate === 'B');
      expect(gateB?.status).toBe('PASS');
    });

    it('returns PASS_WITH_REVIEW for strong claim with only tier2', () => {
      const fact = createMockKeyFact({
        factText: 'Retailers must verify customer age before tobacco sales.',
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier2',
            hostname: 'justia.com',
            url: 'https://justia.com/law',
            effectiveDate: '2024-01-01',
            quote: 'must verify customer age',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateB = gateResults.find(g => g.gate === 'B');
      expect(gateB?.status).toBe('PASS_WITH_REVIEW');
    });

    it('fails strong claims with no tier1 or tier2', () => {
      const fact = createMockKeyFact({
        factText: 'Retailers must verify customer age before tobacco sales.',
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'unknown',
            hostname: 'blog.com',
            url: 'https://blog.com/post',
            effectiveDate: null,
            quote: 'must verify customer age',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateB = gateResults.find(g => g.gate === 'B');
      expect(gateB?.status).toBe('FAIL');
    });
  });

  describe('Gate C: Date Hygiene Gate', () => {
    it('passes with recent effective dates', () => {
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 6); // 6 months ago

      const fact = createMockKeyFact({
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/regs',
            effectiveDate: recentDate.toISOString(),
            quote: 'test',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateC = gateResults.find(g => g.gate === 'C');
      expect(gateC?.status).toBe('PASS');
    });

    it('returns PASS_WITH_REVIEW for stale dates (>3 years)', () => {
      const staleDate = new Date();
      staleDate.setFullYear(staleDate.getFullYear() - 4); // 4 years ago

      const fact = createMockKeyFact({
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/regs',
            effectiveDate: staleDate.toISOString(),
            quote: 'test',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateC = gateResults.find(g => g.gate === 'C');
      expect(gateC?.status).toBe('PASS_WITH_REVIEW');
    });

    it('returns PASS_WITH_REVIEW for missing dates', () => {
      const fact = createMockKeyFact({
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/regs',
            effectiveDate: null,
            quote: 'test',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateC = gateResults.find(g => g.gate === 'C');
      expect(gateC?.status).toBe('PASS_WITH_REVIEW');
    });
  });

  describe('Gate D: Dedupe Gate', () => {
    it('passes when no duplicates exist', () => {
      const fact = createMockKeyFact();
      const existingFacts: KeyFactCandidate[] = [];

      const { status, gateResults } = runAllGates(fact, scopeContract, existingFacts);

      const gateD = gateResults.find(g => g.gate === 'D');
      expect(gateD?.status).toBe('PASS');
    });

    it('fails when duplicate exists', () => {
      const existingFact = createMockKeyFact({
        factText: 'In Texas, retailers must verify that customers are at least 21 years old before selling tobacco products.',
      });

      const newFact = createMockKeyFact({
        id: 'fact-2',
        factText: 'Texas retailers must verify customers are at least 21 years old before tobacco sales.',
      });

      const { status, gateResults } = runAllGates(newFact, scopeContract, [existingFact]);

      const gateD = gateResults.find(g => g.gate === 'D');
      expect(gateD?.status).toBe('FAIL');
    });
  });

  describe('Overall status aggregation', () => {
    it('returns PASS when all gates pass', () => {
      const fact = createMockKeyFact();
      const { status } = runAllGates(fact, scopeContract, []);

      expect(status).toBe('PASS');
    });

    it('returns FAIL when any gate fails', () => {
      const fact = createMockKeyFact({
        mappedAction: 'file tax returns', // Not in allowed actions
      });

      const { status } = runAllGates(fact, scopeContract, []);

      expect(status).toBe('FAIL');
    });

    it('returns PASS_WITH_REVIEW when gates have review but no fail', () => {
      const fact = createMockKeyFact({
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/regs',
            effectiveDate: null, // Missing date triggers PASS_WITH_REVIEW in Gate C
            quote: 'retailers must verify customer age',
          },
        ],
      });

      const { status } = runAllGates(fact, scopeContract, []);

      // All gates pass except C which is PASS_WITH_REVIEW
      expect(status).toBe('PASS_WITH_REVIEW');
    });
  });
});

// ============================================================================
// REGRESSION TEST CASES FROM SPEC
// ============================================================================

describe('Regression Test Cases', () => {
  describe('Case 1: UST tank sticker claim without Tier-1', () => {
    it('marks claim requiring Tier-1 as FAIL when only Tier-2 available for penalty language', () => {
      const scopeContract = createMockScopeContract({
        primaryRole: 'frontline_store_associate',
        allowedLearnerActions: [
          'report spill to supervisor',
          'verify tank sticker presence',
          'follow emergency procedures',
        ],
        domainAnchors: ['UST', 'fuel', 'tank', 'spill', 'compliance'],
      });

      // Strong claim about penalty - requires Tier-1
      const fact = createMockKeyFact({
        factText: 'UST tank operators who fail to display current inspection stickers face penalties of up to $10,000 per day.',
        mappedAction: 'verify tank sticker presence',
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'unknown', // No Tier-1 or Tier-2
            hostname: 'compliance-blog.com',
            url: 'https://compliance-blog.com/ust',
            effectiveDate: null,
            quote: 'penalties of up to $10,000',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      expect(status).toBe('FAIL');
      const gateB = gateResults.find(g => g.gate === 'B');
      expect(gateB?.status).toBe('FAIL');
      expect(gateB?.reason).toContain('Strong claim requires Tier-1');
    });
  });

  describe('Case 2: Cigarette ID check (alias matching)', () => {
    it('matches cigarette → tobacco anchor via alias', () => {
      const scopeContract = createMockScopeContract({
        allowedLearnerActions: [
          'verify customer age using valid ID',
          'refuse sale to underage customer',
        ],
        domainAnchors: ['tobacco', 'age verification', 'valid ID'],
      });

      const fact = createMockKeyFact({
        factText: 'Employees must check ID before selling cigarettes to any customer who appears under 30.',
        mappedAction: 'verify customer age using valid ID',
        anchorHit: [], // Will be populated by gate
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/tobacco',
            effectiveDate: '2024-01-01',
            quote: 'must check ID before selling cigarettes',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      const gateA = gateResults.find(g => g.gate === 'A');
      expect(gateA?.status).toBe('PASS');

      // Verify anchor was matched via alias
      expect(fact.anchorHit).toContain('tobacco');
    });
  });

  describe('Case 3: Cross-domain drift detection', () => {
    it('fails fact that references disallowed domain', () => {
      const scopeContract = createMockScopeContract({
        primaryRole: 'frontline_store_associate',
        allowedLearnerActions: [
          'verify customer age using valid ID',
          'process tobacco sale at register',
        ],
        disallowedActionClasses: [
          'renew business licenses',
          'file annual tax returns',
          'manage alcohol inventory',
        ],
        domainAnchors: ['tobacco', 'age verification', 'point of sale'],
      });

      // This fact mentions nothing about the allowed domain
      const fact = createMockKeyFact({
        factText: 'The annual liquor license renewal must be submitted to the state by December 31.',
        mappedAction: 'process alcohol license renewal', // Not in allowed list
        anchorHit: [],
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/alcohol-licensing',
            effectiveDate: '2024-01-01',
            quote: 'annual liquor license renewal',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      expect(status).toBe('FAIL');

      const gateA = gateResults.find(g => g.gate === 'A');
      expect(gateA?.status).toBe('FAIL');
    });

    it('fails frontline associate fact about executive-level duties', () => {
      const scopeContract = createMockScopeContract({
        primaryRole: 'frontline_store_associate',
        allowedLearnerActions: [
          'verify customer age using valid ID',
          'refuse sale to underage customer',
          'report issues to supervisor',
        ],
        disallowedActionClasses: [
          'file tax returns',
          'renew business licenses',
          'set equipment specifications',
          'negotiate vendor contracts',
        ],
        domainAnchors: ['tobacco', 'age verification', 'customer', 'sale'],
      });

      // Executive-level duty not appropriate for frontline
      const fact = createMockKeyFact({
        factText: 'The business license renewal application must be submitted with the required fee.',
        mappedAction: 'renew business licenses', // Not in allowed list
        anchorHit: [],
        citations: [
          {
            evidenceId: 'evidence-1',
            snippetIndex: 0,
            tier: 'tier1',
            hostname: 'texas.gov',
            url: 'https://texas.gov/licensing',
            effectiveDate: '2024-01-01',
            quote: 'business license renewal application',
          },
        ],
      });

      const { status, gateResults } = runAllGates(fact, scopeContract, []);

      expect(status).toBe('FAIL');

      const gateA = gateResults.find(g => g.gate === 'A');
      expect(gateA?.status).toBe('FAIL');
      expect(gateA?.reason).toContain('does not map to any allowed learner action');
    });
  });
});
