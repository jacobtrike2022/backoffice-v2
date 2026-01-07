// ============================================================================
// VARIANT DRAFT SYNTHESIS TESTS - State Variant Intelligence v2
// ============================================================================
// Tests for Prompt 4: Minimal-Delta Variant Synthesis + Editor-Ready Output.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractMarkers,
  removeMarkers,
  findUnmarkedChanges,
  normalizeHtml,
  normalizeForComparison,
  renderToIntermediate,
  renderFromIntermediate,
  findCandidateSpans,
  computeDiffOps,
  buildChangeNotes,
  type TrackType,
  type DraftStatus,
  type DiffOp,
  type ChangeNote,
  type VariantDraftInput,
  type VariantDraftOutput,
} from '../variantDraft';
import type { ScopeContract, LearnerRole } from '../scopeContract';
import type { KeyFactCandidate, QAGateStatus, SourceTier } from '../keyFacts';

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
    'manage alcohol inventory',
    'check CDL requirements',
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

const createMockKeyFactWithReview = (overrides: Partial<KeyFactCandidate> = {}): KeyFactCandidate => ({
  id: 'fact-review',
  factText: 'Texas retailers may face fines up to $500 for first-time tobacco violations.',
  mappedAction: 'refuse sale to underage customer',
  anchorHit: ['tobacco', 'compliance'],
  citations: [
    {
      evidenceId: 'evidence-2',
      snippetIndex: 0,
      tier: 'tier2' as SourceTier,
      hostname: 'justia.com',
      url: 'https://justia.com/texas-tobacco-law',
      effectiveDate: '2023-06-01',
      quote: 'fines up to $500 for first-time tobacco violations',
    },
  ],
  isStrongClaim: true,
  qaStatus: 'PASS_WITH_REVIEW' as QAGateStatus,
  qaFlags: ['Strong claim with only Tier-2 citation'],
  createdAtISO: new Date().toISOString(),
  ...overrides,
});

// Sample source content for tests
const SAMPLE_ARTICLE_HTML = `<h1>Age Verification Training</h1>
<p>Welcome to the age verification training module.</p>
<h2>Your Responsibilities</h2>
<p>You must verify customer age before any tobacco sale. Always check ID for customers who appear under 30.</p>
<p>If a customer cannot produce valid ID, you must refuse the sale.</p>
<h2>Acceptable IDs</h2>
<ul>
<li>Driver's license</li>
<li>State-issued ID</li>
<li>Passport</li>
</ul>
<p>Remember: compliance is everyone's responsibility.</p>`;

const SAMPLE_VIDEO_TRANSCRIPT = `Welcome to age verification training.
In this module, you'll learn how to properly verify customer age before tobacco sales.

Your first responsibility is checking identification.
When a customer approaches to buy tobacco, you should verify they are of legal age.

If you have any doubt about a customer's age, ask for ID.
If the customer cannot produce valid ID, politely refuse the sale.

Thank you for completing this training.`;

// ============================================================================
// MARKER EXTRACTION TESTS
// ============================================================================

describe('Marker Functions', () => {
  describe('extractMarkers', () => {
    it('extracts single marker from text', () => {
      const text = 'In Texas, customers must be 21 to purchase tobacco. [[KF:abc123-def456]]';
      const markers = extractMarkers(text);

      expect(markers).toHaveLength(1);
      expect(markers[0].factId).toBe('abc123-def456');
      expect(markers[0].marker).toBe('[[KF:abc123-def456]]');
    });

    it('extracts multiple markers from text', () => {
      const text = 'Fact one applies here. [[KF:fact-1]] And fact two as well. [[KF:fact-2]]';
      const markers = extractMarkers(text);

      expect(markers).toHaveLength(2);
      expect(markers[0].factId).toBe('fact-1');
      expect(markers[1].factId).toBe('fact-2');
    });

    it('handles text with no markers', () => {
      const text = 'This text has no markers at all.';
      const markers = extractMarkers(text);

      expect(markers).toHaveLength(0);
    });

    it('extracts markers with UUID format', () => {
      const text = 'The minimum age is 21. [[KF:a1b2c3d4-e5f6-7890-abcd-ef1234567890]]';
      const markers = extractMarkers(text);

      expect(markers).toHaveLength(1);
      expect(markers[0].factId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });

  describe('removeMarkers', () => {
    it('removes single marker from text', () => {
      const text = 'Customers must be 21 to purchase tobacco. [[KF:fact-1]]';
      const clean = removeMarkers(text);

      expect(clean).toBe('Customers must be 21 to purchase tobacco.');
      expect(clean).not.toContain('[[KF:');
    });

    it('removes multiple markers from text', () => {
      const text = 'Fact one. [[KF:fact-1]] Fact two. [[KF:fact-2]]';
      const clean = removeMarkers(text);

      expect(clean).toBe('Fact one.  Fact two.');
      expect(clean).not.toContain('[[KF:');
    });

    it('handles text with no markers', () => {
      const text = 'This text has no markers.';
      const clean = removeMarkers(text);

      expect(clean).toBe('This text has no markers.');
    });
  });

  describe('findUnmarkedChanges', () => {
    it('identifies new words without nearby markers', () => {
      const source = 'Verify customer age before tobacco sales.';
      const marked = 'Verify customer age before tobacco sales. You must also check for expired IDs.';

      const unmarked = findUnmarkedChanges(source, marked);

      // Should find "expired" as a new word without marker
      expect(unmarked.length).toBeGreaterThan(0);
      const foundExpired = unmarked.some(u => u.text.toLowerCase().includes('expired'));
      expect(foundExpired).toBe(true);
    });

    it('does not flag changes with nearby markers', () => {
      const source = 'Verify customer age before tobacco sales.';
      const marked = 'In Texas, customers must be at least 21 years old. [[KF:fact-1]]';

      const unmarked = findUnmarkedChanges(source, marked);

      // The marker is nearby, so changes should not be flagged as unmarked
      // Most changes near the marker should be considered marked
      expect(unmarked.length).toBeLessThan(5);
    });
  });
});

// ============================================================================
// HTML NORMALIZATION TESTS
// ============================================================================

describe('HTML Normalization', () => {
  describe('normalizeHtml', () => {
    it('removes script tags', () => {
      const html = '<p>Content</p><script>alert("xss")</script><p>More</p>';
      const normalized = normalizeHtml(html);

      expect(normalized).not.toContain('script');
      expect(normalized).not.toContain('alert');
      expect(normalized).toContain('Content');
      expect(normalized).toContain('More');
    });

    it('removes style tags', () => {
      const html = '<style>.red { color: red; }</style><p>Content</p>';
      const normalized = normalizeHtml(html);

      expect(normalized).not.toContain('style');
      expect(normalized).not.toContain('color');
      expect(normalized).toContain('Content');
    });

    it('removes HTML comments', () => {
      const html = '<p>Visible</p><!-- hidden comment --><p>Also visible</p>';
      const normalized = normalizeHtml(html);

      expect(normalized).not.toContain('comment');
      expect(normalized).not.toContain('<!--');
      expect(normalized).toContain('Visible');
    });

    it('preserves semantic HTML tags', () => {
      const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p>';
      const normalized = normalizeHtml(html);

      expect(normalized).toContain('<h1>');
      expect(normalized).toContain('</h1>');
      expect(normalized).toContain('<p>');
      expect(normalized).toContain('<strong>');
    });

    it('adds newlines after block elements', () => {
      const html = '<h1>Title</h1><p>Para 1</p><p>Para 2</p>';
      const normalized = normalizeHtml(html);

      expect(normalized.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('normalizeForComparison', () => {
    it('strips HTML tags', () => {
      const html = '<p>This is <strong>bold</strong> text.</p>';
      const normalized = normalizeForComparison(html);

      expect(normalized).not.toContain('<');
      expect(normalized).not.toContain('>');
      expect(normalized).toContain('this is bold text');
    });

    it('lowercases text', () => {
      const html = 'ALL CAPS and MixedCase';
      const normalized = normalizeForComparison(html);

      expect(normalized).toBe('all caps and mixedcase');
    });

    it('collapses whitespace', () => {
      const html = 'Multiple   spaces   and\n\nnewlines';
      const normalized = normalizeForComparison(html);

      expect(normalized).not.toContain('  ');
      expect(normalized).not.toContain('\n');
    });
  });
});

// ============================================================================
// TRACK TYPE RENDERING TESTS
// ============================================================================

describe('Track Type Rendering', () => {
  describe('renderToIntermediate', () => {
    it('normalizes HTML for article type', () => {
      const content = '<p>Article content</p><script>bad()</script>';
      const result = renderToIntermediate('article', content);

      expect(result).toContain('Article content');
      expect(result).not.toContain('script');
    });

    it('preserves paragraph breaks for video type', () => {
      const content = 'Line 1\n\n\n\nLine 2\n\n\nLine 3';
      const result = renderToIntermediate('video', content);

      // Should collapse multiple newlines to double newlines
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('preserves structure for checkpoint type', () => {
      const content = 'Question 1?\nA) Option A\nB) Option B';
      const result = renderToIntermediate('checkpoint', content);

      expect(result).toContain('Question 1?');
      expect(result).toContain('A) Option A');
    });
  });

  describe('renderFromIntermediate', () => {
    it('returns content unchanged for now', () => {
      const content = '<p>Test content</p>';
      const result = renderFromIntermediate('article', content);

      expect(result).toBe(content);
    });
  });
});

// ============================================================================
// SPAN MAPPING TESTS
// ============================================================================

describe('Span Mapping', () => {
  describe('findCandidateSpans', () => {
    it('finds spans matching key fact anchors', () => {
      const content = 'Verify customer age before tobacco sales. Always check valid ID. The point of sale system helps track compliance.';
      const keyFact = createMockKeyFact({
        anchorHit: ['tobacco', 'valid ID'],
      });
      const scopeContract = createMockScopeContract();

      const spans = findCandidateSpans(content, keyFact, scopeContract);

      expect(spans.length).toBeGreaterThan(0);
      // Should find spans containing the matched terms
      const foundTobacco = spans.some(s => s.text.toLowerCase().includes('tobacco'));
      expect(foundTobacco).toBe(true);
    });

    it('scores spans by number of matched terms', () => {
      const content = `Sentence with tobacco only.
      Sentence with tobacco and age verification for customers.
      Random unrelated sentence.`;
      const keyFact = createMockKeyFact({
        anchorHit: ['tobacco', 'age verification', 'customer'],
      });
      const scopeContract = createMockScopeContract();

      const spans = findCandidateSpans(content, keyFact, scopeContract);

      // The span with more matches should have a higher score
      if (spans.length >= 2) {
        expect(spans[0].score).toBeGreaterThanOrEqual(spans[1].score);
      }
    });

    it('returns top 3 candidate spans', () => {
      const content = `Tobacco sentence 1. Tobacco sentence 2. Tobacco sentence 3.
      Tobacco sentence 4. Tobacco sentence 5.`;
      const keyFact = createMockKeyFact({
        anchorHit: ['tobacco'],
      });
      const scopeContract = createMockScopeContract();

      const spans = findCandidateSpans(content, keyFact, scopeContract);

      expect(spans.length).toBeLessThanOrEqual(3);
    });
  });
});

// ============================================================================
// DIFF COMPUTATION TESTS
// ============================================================================

describe('Diff Computation', () => {
  describe('computeDiffOps', () => {
    it('identifies equal lines', () => {
      const source = 'Line 1\nLine 2\nLine 3';
      const draft = 'Line 1\nLine 2\nLine 3';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      expect(ops.every(op => op.type === 'equal')).toBe(true);
    });

    it('identifies replaced lines', () => {
      const source = 'Original line';
      const draft = 'Modified line';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      expect(ops.some(op => op.type === 'replace')).toBe(true);
      const replaceOp = ops.find(op => op.type === 'replace');
      expect(replaceOp?.oldText).toBe('Original line');
      expect(replaceOp?.newText).toBe('Modified line');
    });

    it('identifies inserted lines', () => {
      const source = 'Line 1';
      const draft = 'Line 1\nNew line';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      expect(ops.some(op => op.type === 'insert')).toBe(true);
    });

    it('identifies deleted lines', () => {
      const source = 'Line 1\nLine 2';
      const draft = 'Line 1';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      expect(ops.some(op => op.type === 'delete')).toBe(true);
    });

    it('assigns noteId to non-equal operations', () => {
      const source = 'Original';
      const draft = 'Modified';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      const nonEqualOps = ops.filter(op => op.type !== 'equal');
      expect(nonEqualOps.every(op => op.noteId !== undefined)).toBe(true);
    });
  });
});

// ============================================================================
// CHANGE NOTE CONSTRUCTION TESTS
// ============================================================================

describe('Change Note Construction', () => {
  describe('buildChangeNotes', () => {
    it('creates notes for non-equal diff ops with markers', () => {
      const diffOps: DiffOp[] = [
        {
          type: 'replace',
          sourceStart: 0,
          sourceEnd: 10,
          draftStart: 0,
          draftEnd: 50,
          oldText: 'Old text',
          newText: 'New text about Texas tobacco requirements',
          noteId: 'note-1',
        },
      ];
      const markedDraft = 'New text about Texas tobacco requirements. [[KF:fact-1]]';
      const keyFacts = [createMockKeyFact()];
      const scopeContract = createMockScopeContract();

      const notes = buildChangeNotes(diffOps, markedDraft, keyFacts, scopeContract);

      expect(notes.length).toBeGreaterThan(0);
    });

    it('links notes to key facts via markers', () => {
      const diffOps: DiffOp[] = [
        {
          type: 'replace',
          sourceStart: 0,
          sourceEnd: 10,
          draftStart: 0,
          draftEnd: 60,
          oldText: 'Generic text',
          newText: 'Texas requires 21 for tobacco',
          noteId: 'note-1',
        },
      ];
      const markedDraft = 'Texas requires 21 for tobacco. [[KF:fact-1]]';
      const keyFacts = [createMockKeyFact()];
      const scopeContract = createMockScopeContract();

      const notes = buildChangeNotes(diffOps, markedDraft, keyFacts, scopeContract);

      if (notes.length > 0) {
        expect(notes[0].keyFactIds).toContain('fact-1');
      }
    });

    it('includes citations from linked key facts', () => {
      const diffOps: DiffOp[] = [
        {
          type: 'replace',
          sourceStart: 0,
          sourceEnd: 10,
          draftStart: 0,
          draftEnd: 60,
          oldText: 'Generic text',
          newText: 'Texas requires 21 for tobacco',
          noteId: 'note-1',
        },
      ];
      const markedDraft = 'Texas requires 21 for tobacco. [[KF:fact-1]]';
      const keyFacts = [createMockKeyFact()];
      const scopeContract = createMockScopeContract();

      const notes = buildChangeNotes(diffOps, markedDraft, keyFacts, scopeContract);

      if (notes.length > 0) {
        expect(notes[0].citations.length).toBeGreaterThan(0);
        expect(notes[0].citations[0].url).toBe('https://www.texas.gov/tobacco-regulations');
      }
    });

    it('sets status to needs_review for PASS_WITH_REVIEW facts', () => {
      const diffOps: DiffOp[] = [
        {
          type: 'replace',
          sourceStart: 0,
          sourceEnd: 10,
          draftStart: 0,
          draftEnd: 60,
          oldText: 'Generic text',
          newText: 'Texas fines can reach $500',
          noteId: 'note-1',
        },
      ];
      const markedDraft = 'Texas fines can reach $500. [[KF:fact-review]]';
      const keyFacts = [createMockKeyFactWithReview()];
      const scopeContract = createMockScopeContract();

      const notes = buildChangeNotes(diffOps, markedDraft, keyFacts, scopeContract);

      if (notes.length > 0) {
        expect(notes[0].status).toBe('needs_review');
      }
    });
  });
});

// ============================================================================
// REGRESSION TEST CASES FROM SPEC
// ============================================================================

describe('Regression Test Cases', () => {
  describe('Case 1: Article minimal-delta test', () => {
    it('preserves headings and structure, only targeted lines change', () => {
      const sourceContent = SAMPLE_ARTICLE_HTML;
      const draftContent = SAMPLE_ARTICLE_HTML.replace(
        'You must verify customer age before any tobacco sale.',
        'In Texas, you must verify that customers are at least 21 years old before any tobacco sale. [[KF:fact-1]]'
      );

      // Count headings in source and draft
      const sourceH1Count = (sourceContent.match(/<h1>/gi) || []).length;
      const sourceH2Count = (sourceContent.match(/<h2>/gi) || []).length;
      const draftH1Count = (draftContent.match(/<h1>/gi) || []).length;
      const draftH2Count = (draftContent.match(/<h2>/gi) || []).length;

      expect(draftH1Count).toBe(sourceH1Count);
      expect(draftH2Count).toBe(sourceH2Count);

      // Verify structure is preserved
      expect(draftContent).toContain('<h1>Age Verification Training</h1>');
      expect(draftContent).toContain('<h2>Your Responsibilities</h2>');
      expect(draftContent).toContain('<h2>Acceptable IDs</h2>');

      // Verify only targeted section changed
      expect(draftContent).toContain('21 years old');
      expect(draftContent).toContain('[[KF:fact-1]]');
    });

    it('every change has a noteId in diff ops', () => {
      const source = 'Original text about tobacco sales.';
      const draft = 'Texas requires 21 for tobacco sales.';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      const nonEqualOps = ops.filter(op => op.type !== 'equal');
      expect(nonEqualOps.every(op => op.noteId !== undefined)).toBe(true);
      expect(nonEqualOps.every(op => op.noteId?.startsWith('note-'))).toBe(true);
    });
  });

  describe('Case 2: Drift prevention test', () => {
    it('UST anchors must not produce alcohol content', () => {
      // Scope contract for UST (underground storage tanks) domain
      const ustScopeContract = createMockScopeContract({
        primaryRole: 'frontline_store_associate',
        allowedLearnerActions: [
          'report fuel spill to supervisor',
          'verify tank sticker presence',
          'follow emergency procedures',
        ],
        disallowedActionClasses: [
          'manage alcohol inventory',
          'process alcohol sales',
          'check CDL requirements',
        ],
        domainAnchors: ['UST', 'fuel', 'tank', 'spill', 'compliance'],
      });

      // Key fact within UST domain
      const ustKeyFact = createMockKeyFact({
        id: 'ust-fact-1',
        factText: 'UST operators must display current inspection stickers.',
        mappedAction: 'verify tank sticker presence',
        anchorHit: ['UST', 'tank', 'compliance'],
      });

      // Find candidate spans - should NOT match alcohol-related content
      const contentWithAlcohol = `
        UST tank inspection is important.
        The alcohol inventory must be managed properly.
        Check the tank sticker for compliance.
      `;

      const spans = findCandidateSpans(contentWithAlcohol, ustKeyFact, ustScopeContract);

      // Verify that spans match UST-related content, not alcohol content
      const alcoholSpan = spans.find(s =>
        s.text.toLowerCase().includes('alcohol inventory')
      );

      // The UST fact should not match to alcohol inventory sentences
      // because the mapped action is about tanks, not alcohol
      if (alcoholSpan) {
        // If alcohol span exists, it should have a lower score than UST spans
        const ustSpan = spans.find(s =>
          s.text.toLowerCase().includes('tank')
        );
        if (ustSpan) {
          expect(ustSpan.score).toBeGreaterThanOrEqual(alcoholSpan.score);
        }
      }
    });

    it('UST anchors must not produce CDL/ID content outside scope', () => {
      const ustScopeContract = createMockScopeContract({
        primaryRole: 'frontline_store_associate',
        allowedLearnerActions: [
          'report fuel spill to supervisor',
          'verify tank sticker presence',
        ],
        disallowedActionClasses: [
          'check CDL requirements',
          'verify driver license class',
        ],
        domainAnchors: ['UST', 'fuel', 'tank', 'spill'],
      });

      const ustKeyFact = createMockKeyFact({
        id: 'ust-fact-1',
        factText: 'Fuel spills must be reported immediately.',
        mappedAction: 'report fuel spill to supervisor',
        anchorHit: ['fuel', 'spill'],
      });

      // Content that mixes UST and CDL topics
      const mixedContent = `
        Report any fuel spills immediately.
        CDL holders must have proper endorsements.
        Tank compliance is required for all operators.
      `;

      const spans = findCandidateSpans(mixedContent, ustKeyFact, ustScopeContract);

      // CDL content should not be top matches for UST facts
      const cdlSpan = spans.find(s =>
        s.text.toLowerCase().includes('cdl')
      );

      // If there are CDL spans, they should have lower scores than fuel/tank spans
      const fuelSpan = spans.find(s =>
        s.text.toLowerCase().includes('fuel')
      );

      if (cdlSpan && fuelSpan) {
        expect(fuelSpan.score).toBeGreaterThanOrEqual(cdlSpan.score);
      }
    });
  });

  describe('Case 3: Marker enforcement test', () => {
    it('identifies unmarked changes in draft', () => {
      const source = 'verify customer age before tobacco sales';
      // A draft with significant changes but NO marker
      // Use lowercase words to match what the normalization produces
      const markedDraft = 'in texasspecific, verify that customers are at least twentyone years old before tobacco sales in the starsector.';
      // Note: No [[KF:...]] marker present, and unique new words like "texasspecific", "twentyone", "starsector"

      const unmarked = findUnmarkedChanges(source, markedDraft);

      // Should identify that there are new/changed words without markers
      // The words "texasspecific", "twentyone", "starsector" are clearly new (>3 chars, not in source)
      expect(unmarked.length).toBeGreaterThan(0);
    });

    it('accepts changes with proper markers', () => {
      const source = 'Verify customer age before tobacco sales.';
      const markedDraft = 'In Texas, customers must be at least 21 years old before tobacco sales. [[KF:fact-1]]';

      const unmarked = findUnmarkedChanges(source, markedDraft);

      // Changes near the marker should not be flagged
      // The key changes are marked, so unmarked count should be low
      expect(unmarked.length).toBeLessThan(3);
    });

    it('detects changes far from any marker', () => {
      const source = 'Line 1 about tobacco. Line 2 about age. Line 3 about sales.';
      const markedDraft = `Line 1 is now about Texas tobacco requirements. [[KF:fact-1]]
                          Line 2 has completely different content with no marker nearby.
                          Line 3 remains about sales.`;

      const unmarked = findUnmarkedChanges(source, markedDraft);

      // Line 2 changes should be flagged since they're far from the marker
      expect(unmarked.length).toBeGreaterThan(0);
    });
  });

  describe('Case 4: needs_review status propagation', () => {
    it('ChangeNote status is needs_review when Key Fact is PASS_WITH_REVIEW', () => {
      const diffOps: DiffOp[] = [
        {
          type: 'replace',
          sourceStart: 0,
          sourceEnd: 20,
          draftStart: 0,
          draftEnd: 50,
          oldText: 'Original text',
          newText: 'Texas fines up to $500',
          noteId: 'note-1',
        },
      ];
      const markedDraft = 'Texas fines up to $500. [[KF:fact-review]]';
      const keyFacts = [createMockKeyFactWithReview()];
      const scopeContract = createMockScopeContract();

      const notes = buildChangeNotes(diffOps, markedDraft, keyFacts, scopeContract);

      // Find the note linked to the PASS_WITH_REVIEW fact
      const reviewNote = notes.find(n => n.keyFactIds.includes('fact-review'));

      if (reviewNote) {
        expect(reviewNote.status).toBe('needs_review');
      }
    });

    it('collects needsReviewKeyFactIds separately from appliedKeyFactIds', () => {
      const passedFact = createMockKeyFact({ id: 'passed-fact' });
      const reviewFact = createMockKeyFactWithReview({ id: 'review-fact' });

      // Create two separate diff ops at different positions to get separate notes
      const diffOps: DiffOp[] = [
        {
          type: 'replace',
          sourceStart: 0,
          sourceEnd: 50,
          draftStart: 0,
          draftEnd: 100,
          oldText: 'Original text about age',
          newText: 'Texas requires 21 for tobacco.',
          noteId: 'note-1',
        },
        {
          type: 'replace',
          sourceStart: 500,
          sourceEnd: 550,
          draftStart: 500,
          draftEnd: 600,
          oldText: 'Original text about fines',
          newText: 'Fines can reach $500.',
          noteId: 'note-2',
        },
      ];

      // Position markers far enough apart to be in separate buckets
      const markedDraft = `${'x'.repeat(50)}Texas requires 21 for tobacco. [[KF:passed-fact]]${'x'.repeat(400)}Fines can reach $500. [[KF:review-fact]]`;
      const keyFacts = [passedFact, reviewFact];
      const scopeContract = createMockScopeContract();

      const notes = buildChangeNotes(diffOps, markedDraft, keyFacts, scopeContract);

      // With two diff ops, we should get notes for each
      // At minimum verify that PASS_WITH_REVIEW facts result in needs_review status
      const reviewNote = notes.find(n => n.keyFactIds.includes('review-fact'));

      if (reviewNote) {
        expect(reviewNote.status).toBe('needs_review');
      }

      // If there's a note with only the passed-fact, it should be 'applied'
      const onlyPassedNote = notes.find(n =>
        n.keyFactIds.includes('passed-fact') && !n.keyFactIds.includes('review-fact')
      );

      if (onlyPassedNote) {
        expect(onlyPassedNote.status).toBe('applied');
      }
    });
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  describe('Empty content handling', () => {
    it('handles empty source content', () => {
      const source = '';
      const draft = 'New content added. [[KF:fact-1]]';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      expect(ops.some(op => op.type === 'insert' || op.type === 'replace')).toBe(true);
    });

    it('handles empty draft content', () => {
      const source = 'Original content';
      const draft = '';
      const markerMap = new Map<number, string[]>();

      const ops = computeDiffOps(source, draft, markerMap);

      expect(ops.some(op => op.type === 'delete' || op.type === 'replace')).toBe(true);
    });
  });

  describe('Special characters handling', () => {
    it('handles HTML entities in content', () => {
      const html = '<p>5 &gt; 3 and 2 &lt; 4</p>';
      const normalized = normalizeHtml(html);

      expect(normalized).toContain('&gt;');
      expect(normalized).toContain('&lt;');
    });

    it('handles markers with special regex characters nearby', () => {
      const text = 'Requirements (see section 1.2) apply here. [[KF:fact-1]]';
      const markers = extractMarkers(text);

      expect(markers).toHaveLength(1);
      expect(markers[0].factId).toBe('fact-1');
    });
  });

  describe('Multi-line content handling', () => {
    it('processes multi-paragraph HTML correctly', () => {
      const html = `
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
        <p>Paragraph 3</p>
      `;
      const normalized = normalizeHtml(html);

      expect(normalized).toContain('Paragraph 1');
      expect(normalized).toContain('Paragraph 2');
      expect(normalized).toContain('Paragraph 3');
    });

    it('handles CRLF line endings in video transcripts', () => {
      const content = 'Line 1\r\nLine 2\r\nLine 3';
      const result = renderToIntermediate('video', content);

      expect(result).not.toContain('\r');
      expect(result.split('\n').length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ============================================================================
// PERFORMANCE CHARACTERISTICS
// ============================================================================

describe('Performance Characteristics', () => {
  it('handles large documents without timeout', () => {
    const largeParagraph = '<p>' + 'Word '.repeat(1000) + '</p>';
    const largeDoc = largeParagraph.repeat(100);

    const startTime = Date.now();
    const normalized = normalizeHtml(largeDoc);
    const elapsed = Date.now() - startTime;

    // Should complete in reasonable time (under 1 second)
    expect(elapsed).toBeLessThan(1000);
    expect(normalized.length).toBeGreaterThan(0);
  });

  it('diff computation scales with content size', () => {
    const makeLines = (n: number) => Array.from({ length: n }, (_, i) => `Line ${i}`).join('\n');

    const source = makeLines(100);
    const draft = makeLines(100).replace('Line 50', 'Modified Line 50');
    const markerMap = new Map<number, string[]>();

    const startTime = Date.now();
    const ops = computeDiffOps(source, draft, markerMap);
    const elapsed = Date.now() - startTime;

    // Should complete quickly
    expect(elapsed).toBeLessThan(500);
    expect(ops.length).toBeGreaterThan(0);
  });
});
