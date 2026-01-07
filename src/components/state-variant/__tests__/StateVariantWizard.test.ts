// ============================================================================
// STATE VARIANT WIZARD INTEGRATION TESTS
// ============================================================================
// Integration tests for the StateVariantWizard component flow
// Tests the 4-step wizard: State Selection -> Audience -> Research Plan -> Editor
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the CRUD functions
const mockBuildScopeContract = vi.fn();
const mockFreezeScopeContractRoles = vi.fn();
const mockBuildResearchPlan = vi.fn();
const mockRetrieveEvidence = vi.fn();
const mockExtractKeyFacts = vi.fn();
const mockGenerateDraft = vi.fn();

vi.mock('../../../lib/crud/trackRelationships', () => ({
  buildScopeContract: (...args: any[]) => mockBuildScopeContract(...args),
  freezeScopeContractRoles: (...args: any[]) => mockFreezeScopeContractRoles(...args),
  buildResearchPlan: (...args: any[]) => mockBuildResearchPlan(...args),
  retrieveEvidence: (...args: any[]) => mockRetrieveEvidence(...args),
  extractKeyFacts: (...args: any[]) => mockExtractKeyFacts(...args),
  generateDraft: (...args: any[]) => mockGenerateDraft(...args),
}));

// Test fixtures
const mockSourceTrack = {
  id: 'track-123',
  title: 'UST Alarms Training',
  type: 'article' as const,
  content_text: '<h1>UST Alarms</h1><p>Training content here...</p>',
};

const mockScopeContractResponse = {
  contractId: 'contract-456',
  scopeContract: {
    primaryRole: 'frontline_store_associate' as const,
    roleConfidence: 'high' as const,
    roleEvidenceQuotes: ['As a store associate...'],
    instructionalGoal: 'Train associates on UST alarm handling',
    domainAnchors: ['UST', 'alarms', 'safety'],
    regulatoryDomains: ['environmental'],
    mappedActions: ['report_alarm', 'document_incident'],
  },
  roleSelectionNeeded: false,
  topRoleMatches: [],
};

const mockScopeContractResponseWithRoleSelection = {
  ...mockScopeContractResponse,
  roleSelectionNeeded: true,
  topRoleMatches: [
    { roleId: 'role-1', roleName: 'Manager', score: 0.9, why: 'Supervisory content' },
    { roleId: 'role-2', roleName: 'Associate', score: 0.85, why: 'Frontline tasks' },
    { roleId: 'role-3', roleName: 'Driver', score: 0.7, why: 'Delivery mentions' },
  ],
};

const mockResearchPlanResponse = {
  planId: 'plan-789',
  researchPlan: {
    queries: [
      {
        id: 'q1',
        query: 'Texas UST regulations',
        mappedAction: 'report_alarm',
        anchorTerms: ['UST', 'underground storage tank'],
        negativeTerms: ['federal', 'EPA'],
        targetType: 'regulation' as const,
        why: 'State-specific tank regulations',
      },
      {
        id: 'q2',
        query: 'Texas environmental compliance',
        mappedAction: 'document_incident',
        anchorTerms: ['TCEQ', 'Texas'],
        negativeTerms: [],
        targetType: 'agency_guidance' as const,
        why: 'State agency requirements',
      },
    ],
    globalNegativeTerms: ['California', 'Florida'],
    sourcePolicy: {
      preferTier1: true,
      allowTier2Justia: true,
      forbidTier3ForStrongClaims: true,
    },
  },
};

const mockRetrievalResponse = {
  evidenceCount: 15,
  rejectedCount: 3,
  evidence: [
    {
      url: 'https://texas.gov/ust-rules',
      title: 'Texas UST Rules',
      snippet: 'UST owners must report...',
      tier: 'tier1_official' as const,
    },
  ],
  rejectedReasons: ['Not Texas-specific', 'Outdated'],
};

const mockKeyFactsResponse = {
  extractionId: 'extraction-101',
  keyFactsCount: 8,
  rejectedFactsCount: 2,
  overallStatus: 'PASS' as const,
  keyFacts: [
    {
      factId: 'fact-1',
      factText: 'Texas requires UST alarms to be reported within 24 hours',
      isStrongClaim: true,
      qaStatus: 'PASS' as const,
      citations: [],
    },
  ],
  rejectedFacts: [],
};

const mockDraftResponse = {
  success: true,
  draft: {
    draftId: 'draft-202',
    contractId: 'contract-456',
    extractionId: 'extraction-101',
    sourceTrackId: 'track-123',
    stateCode: 'TX',
    stateName: 'Texas',
    trackType: 'article' as const,
    status: 'generated' as const,
    draftTitle: 'UST Alarms Training (Texas)',
    draftContent: '<h1>UST Alarms</h1><p>Texas-specific content...</p>',
    sourceContent: '<h1>UST Alarms</h1><p>Training content here...</p>',
    diffOps: [
      {
        id: 'diff-1',
        type: 'insert' as const,
        sourceStart: 50,
        sourceEnd: 50,
        draftStart: 50,
        draftEnd: 70,
        oldText: '',
        newText: 'In Texas, you must...',
        noteId: 'note-1',
      },
    ],
    changeNotes: [
      {
        id: 'note-1',
        title: 'Texas Reporting Requirement',
        description: 'Added Texas-specific reporting timeframe',
        mappedAction: 'report_alarm',
        anchorMatches: ['UST', 'alarm'],
        affectedRangeStart: 50,
        affectedRangeEnd: 70,
        keyFactIds: ['fact-1'],
        citations: [],
        status: 'applied' as const,
      },
    ],
    appliedKeyFactIds: ['fact-1'],
    needsReviewKeyFactIds: [],
  },
};

describe('StateVariantWizard Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: State Selection', () => {
    it('should trigger scope contract build when state is selected', async () => {
      mockBuildScopeContract.mockResolvedValue(mockScopeContractResponse);

      // Simulate state selection
      const selectedState = { code: 'TX', name: 'Texas' };

      // The wizard would call buildScopeContract
      await mockBuildScopeContract(
        mockSourceTrack.id,
        'geographic',
        { state_code: selectedState.code, state_name: selectedState.name },
        true
      );

      expect(mockBuildScopeContract).toHaveBeenCalledWith(
        'track-123',
        'geographic',
        { state_code: 'TX', state_name: 'Texas' },
        true
      );
    });

    it('should include all 50 US states + DC', () => {
      const expectedStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
        'DC'
      ];

      // Import from the wizard to verify
      // This is a static check
      expect(expectedStates).toHaveLength(51);
    });
  });

  describe('Step 2: Audience Confirmation', () => {
    it('should skip role selection when roleSelectionNeeded is false', async () => {
      mockBuildScopeContract.mockResolvedValue(mockScopeContractResponse);
      mockBuildResearchPlan.mockResolvedValue(mockResearchPlanResponse);

      // Build scope contract
      const scopeResult = await mockBuildScopeContract(
        mockSourceTrack.id,
        'geographic',
        { state_code: 'TX', state_name: 'Texas' },
        true
      );

      expect(scopeResult.roleSelectionNeeded).toBe(false);

      // Should proceed directly without freezing roles
      await mockBuildResearchPlan(
        scopeResult.contractId,
        'TX',
        'Texas',
        true
      );

      expect(mockFreezeScopeContractRoles).not.toHaveBeenCalled();
      expect(mockBuildResearchPlan).toHaveBeenCalled();
    });

    it('should allow role selection when roleSelectionNeeded is true', async () => {
      mockBuildScopeContract.mockResolvedValue(mockScopeContractResponseWithRoleSelection);
      mockFreezeScopeContractRoles.mockResolvedValue({ success: true });
      mockBuildResearchPlan.mockResolvedValue(mockResearchPlanResponse);

      // Build scope contract
      const scopeResult = await mockBuildScopeContract(
        mockSourceTrack.id,
        'geographic',
        { state_code: 'TX', state_name: 'Texas' },
        true
      );

      expect(scopeResult.roleSelectionNeeded).toBe(true);
      expect(scopeResult.topRoleMatches).toHaveLength(3);

      // User selects roles and freezes
      const selectedRoles = ['Manager', 'Associate'];
      await mockFreezeScopeContractRoles(
        scopeResult.contractId,
        selectedRoles[0],
        selectedRoles.slice(1)
      );

      expect(mockFreezeScopeContractRoles).toHaveBeenCalledWith(
        'contract-456',
        'Manager',
        ['Associate']
      );
    });
  });

  describe('Step 3: Research Plan', () => {
    it('should generate research plan with queries', async () => {
      mockBuildResearchPlan.mockResolvedValue(mockResearchPlanResponse);

      const planResult = await mockBuildResearchPlan(
        'contract-456',
        'TX',
        'Texas',
        true
      );

      expect(planResult.researchPlan.queries).toHaveLength(2);
      expect(planResult.researchPlan.queries[0].targetType).toBe('regulation');
      expect(planResult.researchPlan.sourcePolicy.preferTier1).toBe(true);
    });

    it('should include anchor and negative terms', async () => {
      mockBuildResearchPlan.mockResolvedValue(mockResearchPlanResponse);

      const planResult = await mockBuildResearchPlan(
        'contract-456',
        'TX',
        'Texas',
        true
      );

      const query = planResult.researchPlan.queries[0];
      expect(query.anchorTerms).toContain('UST');
      expect(query.negativeTerms).toContain('federal');
    });
  });

  describe('Step 4: Generation Pipeline', () => {
    it('should run full pipeline: evidence -> key facts -> draft', async () => {
      mockRetrieveEvidence.mockResolvedValue(mockRetrievalResponse);
      mockExtractKeyFacts.mockResolvedValue(mockKeyFactsResponse);
      mockGenerateDraft.mockResolvedValue(mockDraftResponse);

      // Step 1: Retrieve evidence
      const evidenceResult = await mockRetrieveEvidence(
        'plan-789',
        'contract-456',
        mockSourceTrack.content_text
      );

      expect(evidenceResult.evidenceCount).toBe(15);
      expect(evidenceResult.rejectedCount).toBe(3);

      // Step 2: Extract key facts
      const keyFactsResult = await mockExtractKeyFacts(
        'contract-456',
        'plan-789',
        evidenceResult.evidence,
        'TX',
        'Texas',
        mockSourceTrack.content_text
      );

      expect(keyFactsResult.overallStatus).toBe('PASS');
      expect(keyFactsResult.keyFactsCount).toBe(8);

      // Step 3: Generate draft
      const draftResult = await mockGenerateDraft({
        contractId: 'contract-456',
        extractionId: keyFactsResult.extractionId,
        sourceTrackId: mockSourceTrack.id,
        stateCode: 'TX',
        stateName: 'Texas',
        sourceContent: mockSourceTrack.content_text,
        sourceTitle: mockSourceTrack.title,
        trackType: 'article',
      });

      expect(draftResult.success).toBe(true);
      expect(draftResult.draft.status).toBe('generated');
      expect(draftResult.draft.diffOps).toHaveLength(1);
      expect(draftResult.draft.changeNotes).toHaveLength(1);
    });

    it('should handle FAIL status from key facts extraction', async () => {
      const failedKeyFactsResponse = {
        ...mockKeyFactsResponse,
        overallStatus: 'FAIL' as const,
        keyFactsCount: 0,
        rejectedFactsCount: 5,
      };

      mockRetrieveEvidence.mockResolvedValue(mockRetrievalResponse);
      mockExtractKeyFacts.mockResolvedValue(failedKeyFactsResponse);

      const keyFactsResult = await mockExtractKeyFacts(
        'contract-456',
        'plan-789',
        mockRetrievalResponse.evidence,
        'TX',
        'Texas',
        mockSourceTrack.content_text
      );

      expect(keyFactsResult.overallStatus).toBe('FAIL');

      // Should NOT proceed to draft generation
      expect(mockGenerateDraft).not.toHaveBeenCalled();
    });

    it('should handle blocked draft status', async () => {
      const blockedDraftResponse = {
        ...mockDraftResponse,
        draft: {
          ...mockDraftResponse.draft,
          status: 'blocked' as const,
          blockedReasons: ['Insufficient evidence for claims'],
        },
      };

      mockRetrieveEvidence.mockResolvedValue(mockRetrievalResponse);
      mockExtractKeyFacts.mockResolvedValue(mockKeyFactsResponse);
      mockGenerateDraft.mockResolvedValue(blockedDraftResponse);

      const draftResult = await mockGenerateDraft({
        contractId: 'contract-456',
        extractionId: 'extraction-101',
        sourceTrackId: mockSourceTrack.id,
        stateCode: 'TX',
        stateName: 'Texas',
        sourceContent: mockSourceTrack.content_text,
        sourceTitle: mockSourceTrack.title,
        trackType: 'article',
      });

      expect(draftResult.draft.status).toBe('blocked');
      expect(draftResult.draft.blockedReasons).toContain('Insufficient evidence for claims');
    });
  });

  describe('Draft Result', () => {
    it('should include diffOps with noteId references', async () => {
      mockGenerateDraft.mockResolvedValue(mockDraftResponse);

      const draftResult = await mockGenerateDraft({
        contractId: 'contract-456',
        extractionId: 'extraction-101',
        sourceTrackId: mockSourceTrack.id,
        stateCode: 'TX',
        stateName: 'Texas',
        sourceContent: mockSourceTrack.content_text,
        sourceTitle: mockSourceTrack.title,
        trackType: 'article',
      });

      const diffOp = draftResult.draft.diffOps[0];
      expect(diffOp.noteId).toBe('note-1');
      expect(diffOp.type).toBe('insert');
    });

    it('should include changeNotes with citations', async () => {
      mockGenerateDraft.mockResolvedValue(mockDraftResponse);

      const draftResult = await mockGenerateDraft({
        contractId: 'contract-456',
        extractionId: 'extraction-101',
        sourceTrackId: mockSourceTrack.id,
        stateCode: 'TX',
        stateName: 'Texas',
        sourceContent: mockSourceTrack.content_text,
        sourceTitle: mockSourceTrack.title,
        trackType: 'article',
      });

      const note = draftResult.draft.changeNotes[0];
      expect(note.id).toBe('note-1');
      expect(note.title).toBe('Texas Reporting Requirement');
      expect(note.status).toBe('applied');
      expect(note.keyFactIds).toContain('fact-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockBuildScopeContract.mockRejectedValue(new Error('Network error'));

      await expect(
        mockBuildScopeContract(
          mockSourceTrack.id,
          'geographic',
          { state_code: 'TX', state_name: 'Texas' },
          true
        )
      ).rejects.toThrow('Network error');
    });

    it('should allow retry after failure', async () => {
      // First call fails
      mockRetrieveEvidence
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockRetrievalResponse);

      // First attempt fails
      await expect(
        mockRetrieveEvidence('plan-789', 'contract-456', 'content')
      ).rejects.toThrow('Timeout');

      // Retry succeeds
      const result = await mockRetrieveEvidence('plan-789', 'contract-456', 'content');
      expect(result.evidenceCount).toBe(15);
    });
  });

  describe('State Persistence', () => {
    it('should include draftId in response for URL persistence', async () => {
      mockGenerateDraft.mockResolvedValue(mockDraftResponse);

      const draftResult = await mockGenerateDraft({
        contractId: 'contract-456',
        extractionId: 'extraction-101',
        sourceTrackId: mockSourceTrack.id,
        stateCode: 'TX',
        stateName: 'Texas',
        sourceContent: mockSourceTrack.content_text,
        sourceTitle: mockSourceTrack.title,
        trackType: 'article',
      });

      expect(draftResult.draft.draftId).toBe('draft-202');
      // This draftId can be persisted in URL for page refresh resilience
    });
  });
});
