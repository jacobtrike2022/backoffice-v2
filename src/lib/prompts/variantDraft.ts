// ============================================================================
// VARIANT DRAFT SYNTHESIS - State Variant Intelligence v2
// ============================================================================
// Prompt 4: Minimal-Delta Variant Synthesis + Editor-Ready Output
// Generates geographic variant drafts grounded ONLY in validated Key Facts.
// ============================================================================

import { chatCompletion, type ChatMessage } from '../../supabase/functions/server/utils/openai.ts';
import type { ScopeContract, LearnerRole } from './scopeContract.ts';
import type { KeyFactCandidate, KeyFactCitation, QAGateStatus } from './keyFacts.ts';

// ============================================================================
// TYPES
// ============================================================================

export type TrackType = 'article' | 'video' | 'story' | 'checkpoint';
export type DraftStatus = 'generated' | 'generated_needs_review' | 'blocked';
export type DiffOpType = 'equal' | 'insert' | 'delete' | 'replace';

export interface DiffOp {
  type: DiffOpType;
  sourceStart: number;
  sourceEnd: number;
  draftStart: number;
  draftEnd: number;
  newText?: string;
  oldText?: string;
  noteId?: string; // links to ChangeNote
}

export interface CitationRef {
  url: string;
  tier: string;
  snippet: string;
  effectiveOrUpdatedDate?: string | null;
}

export interface ChangeNote {
  id: string;
  title: string;
  description: string; // 1–2 sentences max
  mappedAction: string;
  anchorMatches: string[];
  affectedRange: { start: number; end: number }; // in draftContent
  keyFactIds: string[];
  citations: CitationRef[];
  status: 'applied' | 'needs_review' | 'blocked';
}

export interface VariantDraftOutput {
  draftId: string;
  status: DraftStatus;
  trackType: TrackType;
  draftTitle: string;
  draftContent: string; // HTML for article; plaintext otherwise
  diffOps: DiffOp[];
  changeNotes: ChangeNote[];
  appliedKeyFactIds: string[];
  needsReviewKeyFactIds: string[];
  blockedReasons?: string[];
  // Metadata
  contractId?: string;
  extractionId?: string;
  stateCode: string;
  stateName?: string;
  generatedAtISO: string;
}

export interface VariantDraftInput {
  sourceTrackType: TrackType;
  sourceTitle: string;
  sourceContent: string;
  scopeContract: ScopeContract;
  validatedKeyFacts: KeyFactCandidate[];
  qualityGateStatus: QAGateStatus;
  variantContext: {
    stateCode: string;
    stateName?: string;
  };
  contractId?: string;
  extractionId?: string;
}

export interface ApplyInstructionsInput {
  draftId: string;
  instruction: string;
  currentDraftContent: string;
  scopeContract: ScopeContract;
  validatedKeyFacts: KeyFactCandidate[];
  stateCode: string;
  stateName?: string;
}

export interface ApplyInstructionsOutput {
  draftContent: string;
  diffOps: DiffOp[];
  changeNotes: ChangeNote[];
  blockedChanges: Array<{
    instruction: string;
    reason: string;
    suggestion?: string;
  }>;
  appliedKeyFactIds: string[];
}

// ============================================================================
// MARKER PATTERN
// ============================================================================

const KF_MARKER_PATTERN = /\[\[KF:([a-zA-Z0-9_-]+)\]\]/g;

/**
 * Extract all Key Fact markers from text.
 */
export function extractMarkers(text: string): Array<{ marker: string; factId: string; index: number }> {
  const markers: Array<{ marker: string; factId: string; index: number }> = [];
  let match;

  while ((match = KF_MARKER_PATTERN.exec(text)) !== null) {
    markers.push({
      marker: match[0],
      factId: match[1],
      index: match.index,
    });
  }

  // Reset regex state
  KF_MARKER_PATTERN.lastIndex = 0;

  return markers;
}

/**
 * Remove all markers from text.
 */
export function removeMarkers(text: string): string {
  return text.replace(KF_MARKER_PATTERN, '').trim();
}

/**
 * Check if text contains any unmarked changes by comparing to source.
 * Returns spans that changed but lack markers.
 */
export function findUnmarkedChanges(
  sourceText: string,
  markedDraftText: string
): Array<{ text: string; start: number; end: number }> {
  const unmarked: Array<{ text: string; start: number; end: number }> = [];

  // Remove markers to get clean draft
  const cleanDraft = removeMarkers(markedDraftText);

  // Normalize both for comparison
  const sourceNorm = normalizeForComparison(sourceText);
  const draftNorm = normalizeForComparison(cleanDraft);

  // Simple word-level diff to find changed regions
  const sourceWords = sourceNorm.split(/\s+/);
  const draftWords = draftNorm.split(/\s+/);

  // Find words in draft that aren't in source (simple heuristic)
  const sourceWordSet = new Set(sourceWords.map(w => w.toLowerCase()));

  let currentPos = 0;
  for (const word of draftWords) {
    const wordStart = cleanDraft.indexOf(word, currentPos);
    if (wordStart === -1) continue;

    const wordEnd = wordStart + word.length;
    currentPos = wordEnd;

    // Check if this word is "new" (not in source)
    if (!sourceWordSet.has(word.toLowerCase()) && word.length > 3) {
      // Check if there's a marker nearby (within 50 chars)
      const nearbyText = markedDraftText.substring(
        Math.max(0, wordStart - 10),
        Math.min(markedDraftText.length, wordEnd + 60)
      );

      if (!KF_MARKER_PATTERN.test(nearbyText)) {
        unmarked.push({ text: word, start: wordStart, end: wordEnd });
      }
      KF_MARKER_PATTERN.lastIndex = 0;
    }
  }

  return unmarked;
}

// ============================================================================
// HTML NORMALIZATION
// ============================================================================

/**
 * Normalize HTML content for consistent processing.
 * - Preserves semantic blocks: h1/h2/h3/p/em/strong/ul/li/ol
 * - Removes scripts/styles
 * - Normalizes whitespace
 */
export function normalizeHtml(html: string): string {
  let normalized = html;

  // Remove scripts and styles
  normalized = normalized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  normalized = normalized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  normalized = normalized.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Remove HTML comments
  normalized = normalized.replace(/<!--[\s\S]*?-->/g, '');

  // Normalize whitespace within tags
  normalized = normalized.replace(/>\s+</g, '><');

  // Normalize multiple spaces/newlines to single space
  normalized = normalized.replace(/\s+/g, ' ');

  // Add newlines after block elements for readability
  const blockTags = ['</h1>', '</h2>', '</h3>', '</h4>', '</p>', '</div>', '</li>', '</ul>', '</ol>', '</blockquote>'];
  for (const tag of blockTags) {
    normalized = normalized.replace(new RegExp(tag, 'gi'), tag + '\n');
  }

  // Trim leading/trailing whitespace from lines
  normalized = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  return normalized.trim();
}

/**
 * Normalize text for comparison (strip HTML, lowercase, collapse whitespace).
 */
export function normalizeForComparison(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

// ============================================================================
// TRACK TYPE RENDERING
// ============================================================================

/**
 * Render content to intermediate format based on track type.
 */
export function renderToIntermediate(trackType: TrackType, content: string): string {
  switch (trackType) {
    case 'article':
      return normalizeHtml(content);
    case 'video':
      // Plaintext transcript - preserve paragraph breaks
      return content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    case 'story':
      // Structured text - preserve section markers
      return content.replace(/\r\n/g, '\n').trim();
    case 'checkpoint':
      // Q/A format - preserve structure
      return content.replace(/\r\n/g, '\n').trim();
    default:
      return content.trim();
  }
}

/**
 * Render from intermediate format back to final output.
 */
export function renderFromIntermediate(trackType: TrackType, intermediate: string): string {
  // For now, intermediate and final are the same
  // Future: could add format-specific post-processing
  return intermediate;
}

// ============================================================================
// SPAN MAPPING
// ============================================================================

export interface CandidateSpan {
  start: number;
  end: number;
  text: string;
  score: number;
  matchedTerms: string[];
}

/**
 * Find candidate spans in source content that might need modification
 * based on a Key Fact.
 */
export function findCandidateSpans(
  sourceContent: string,
  keyFact: KeyFactCandidate,
  scopeContract: ScopeContract
): CandidateSpan[] {
  const spans: CandidateSpan[] = [];
  const contentLower = sourceContent.toLowerCase();

  // Build search terms from:
  // 1. Anchor matches from the fact
  // 2. Citation snippets
  // 3. Domain anchors from scope contract
  const searchTerms: string[] = [
    ...keyFact.anchorHit,
    ...scopeContract.domainAnchors,
  ];

  // Add tokens from citation snippets
  for (const citation of keyFact.citations) {
    const snippetWords = citation.quote
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);
    searchTerms.push(...snippetWords.slice(0, 5));
  }

  // Dedupe and lowercase
  const uniqueTerms = [...new Set(searchTerms.map(t => t.toLowerCase()))];

  // Find sentences/paragraphs containing these terms
  const sentences = splitIntoSentences(sourceContent);

  for (const { text, start, end } of sentences) {
    const sentenceLower = text.toLowerCase();
    const matchedTerms: string[] = [];

    for (const term of uniqueTerms) {
      if (sentenceLower.includes(term)) {
        matchedTerms.push(term);
      }
    }

    if (matchedTerms.length > 0) {
      // Score based on number of matches and term relevance
      const score = matchedTerms.length / uniqueTerms.length;

      spans.push({
        start,
        end,
        text,
        score,
        matchedTerms,
      });
    }
  }

  // Sort by score descending and return top 3
  return spans
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Split content into sentences with position tracking.
 */
function splitIntoSentences(content: string): Array<{ text: string; start: number; end: number }> {
  const sentences: Array<{ text: string; start: number; end: number }> = [];

  // Handle HTML by splitting on tags and sentence boundaries
  const stripped = content.replace(/<[^>]+>/g, ' ');
  const parts = stripped.split(/(?<=[.!?])\s+/);

  let currentPos = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;

    // Find actual position in original content
    const start = content.indexOf(trimmed, currentPos);
    if (start === -1) {
      currentPos += trimmed.length;
      continue;
    }

    const end = start + trimmed.length;
    sentences.push({ text: trimmed, start, end });
    currentPos = end;
  }

  return sentences;
}

// ============================================================================
// LLM PROMPT CONSTRUCTION
// ============================================================================

function buildDraftGenerationPrompt(input: VariantDraftInput): ChatMessage[] {
  const { sourceTrackType, sourceTitle, sourceContent, scopeContract, validatedKeyFacts, variantContext } = input;

  const systemMessage = `You are a training content adaptation engine.
Output ONLY the revised content (HTML for articles, plaintext otherwise).
You must preserve structure and change as little as possible.

HARD RULES:
- You may ONLY use the provided Key Facts for state-specific changes.
- Do NOT add new topics, new sections, or new compliance info.
- Do NOT change anything unless a Key Fact requires it.
- Any sentence you modify must end with [[KF:<id>]] where <id> is the Key Fact ID that justifies the change.
- If you change text without a marker, the output is invalid.
- Preserve all HTML tags exactly for articles.
- Maintain the same paragraph structure and order.
- Keep the same tone and voice appropriate for the learner role.

ROLE VOICE GUIDELINES:
${getRoleVoiceGuidelines(scopeContract.primaryRole)}`;

  const keyFactsSection = validatedKeyFacts.map(kf => {
    const citationsStr = kf.citations.map(c =>
      `  - ${c.url} (${c.tier}): "${c.quote.substring(0, 100)}..." ${c.effectiveDate ? `[${c.effectiveDate}]` : ''}`
    ).join('\n');

    return `- id: ${kf.id}
  fact: ${kf.factText}
  mappedAction: ${kf.mappedAction}
  anchors: ${kf.anchorHit.join(', ')}
  status: ${kf.qaStatus}
  citations:
${citationsStr}`;
  }).join('\n\n');

  const userMessage = `Track type: ${sourceTrackType}
Target state: ${variantContext.stateName || variantContext.stateCode} (${variantContext.stateCode})
Learner role: ${scopeContract.primaryRole}
Allowed actions: ${scopeContract.allowedLearnerActions.join(', ')}
Domain anchors: ${scopeContract.domainAnchors.join(', ')}
Disallowed action classes: ${scopeContract.disallowedActionClasses.join(', ')}

VALIDATED KEY FACTS:
${keyFactsSection}

SOURCE CONTENT:
${sourceContent}

INSTRUCTIONS:
Rewrite the source for ${variantContext.stateName || variantContext.stateCode} with minimal changes.
Only edit where Key Facts require changes.
Every changed sentence must end with [[KF:<id>]] where <id> is the exact Key Fact ID.
Preserve headings, paragraph order, and HTML structure.
Return revised content only. No explanations.`;

  return [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ];
}

function getRoleVoiceGuidelines(role: LearnerRole): string {
  switch (role) {
    case 'frontline_store_associate':
      return `- Use second-person voice ("you must", "you should")
- Focus on immediate actions at point of sale
- Emphasize report/escalate for issues beyond authority
- Avoid manager-level or administrative language`;

    case 'manager_supervisor':
      return `- Use supervisory language ("ensure your team", "train staff")
- Include oversight and audit responsibilities
- Reference employee training and compliance monitoring
- May include some administrative duties`;

    case 'delivery_driver':
      return `- Focus on delivery, handoff, and route procedures
- Emphasize safety and proper documentation
- Use driver-specific terminology
- Avoid POS or store operations language`;

    case 'owner_executive':
      return `- Include administrative and licensing duties if taught in source
- May reference business-level compliance
- Keep operational details if relevant to owner oversight`;

    case 'back_office_admin':
      return `- Focus on documentation and record-keeping
- Include compliance reporting duties
- Avoid customer-facing or sales floor language`;

    default:
      return `- Maintain consistent voice with source content
- Keep professional and instructional tone`;
  }
}

// ============================================================================
// DIFF COMPUTATION
// ============================================================================

/**
 * Compute diff operations between source and draft.
 */
export function computeDiffOps(
  sourceContent: string,
  draftContent: string,
  markerMap: Map<number, string[]> // position -> keyFactIds
): DiffOp[] {
  const ops: DiffOp[] = [];

  // Simple line-by-line diff for now
  // Future: implement Myers diff or similar for better precision
  const sourceLines = sourceContent.split('\n');
  const draftLines = draftContent.split('\n');

  let sourcePos = 0;
  let draftPos = 0;
  let noteCounter = 0;

  const maxLines = Math.max(sourceLines.length, draftLines.length);

  for (let i = 0; i < maxLines; i++) {
    const sourceLine = sourceLines[i] || '';
    const draftLine = draftLines[i] || '';

    const sourceLineStart = sourcePos;
    const sourceLineEnd = sourcePos + sourceLine.length;
    const draftLineStart = draftPos;
    const draftLineEnd = draftPos + draftLine.length;

    if (sourceLine === draftLine) {
      ops.push({
        type: 'equal',
        sourceStart: sourceLineStart,
        sourceEnd: sourceLineEnd,
        draftStart: draftLineStart,
        draftEnd: draftLineEnd,
      });
    } else if (!sourceLine && draftLine) {
      ops.push({
        type: 'insert',
        sourceStart: sourceLineStart,
        sourceEnd: sourceLineStart,
        draftStart: draftLineStart,
        draftEnd: draftLineEnd,
        newText: draftLine,
        noteId: `note-${++noteCounter}`,
      });
    } else if (sourceLine && !draftLine) {
      ops.push({
        type: 'delete',
        sourceStart: sourceLineStart,
        sourceEnd: sourceLineEnd,
        draftStart: draftLineStart,
        draftEnd: draftLineStart,
        oldText: sourceLine,
        noteId: `note-${++noteCounter}`,
      });
    } else {
      ops.push({
        type: 'replace',
        sourceStart: sourceLineStart,
        sourceEnd: sourceLineEnd,
        draftStart: draftLineStart,
        draftEnd: draftLineEnd,
        oldText: sourceLine,
        newText: draftLine,
        noteId: `note-${++noteCounter}`,
      });
    }

    sourcePos = sourceLineEnd + 1; // +1 for newline
    draftPos = draftLineEnd + 1;
  }

  return ops;
}

// ============================================================================
// CHANGE NOTE CONSTRUCTION
// ============================================================================

/**
 * Build change notes from diff ops and marker mappings.
 */
export function buildChangeNotes(
  diffOps: DiffOp[],
  markedDraft: string,
  keyFacts: KeyFactCandidate[],
  scopeContract: ScopeContract
): ChangeNote[] {
  const notes: ChangeNote[] = [];
  const keyFactMap = new Map(keyFacts.map(kf => [kf.id, kf]));

  // Extract all markers and their positions
  const markers = extractMarkers(markedDraft);

  // Group markers by approximate position
  const markersByPosition = new Map<number, string[]>();
  for (const marker of markers) {
    // Round to nearest 100 chars for grouping
    const bucket = Math.floor(marker.index / 100) * 100;
    const existing = markersByPosition.get(bucket) || [];
    existing.push(marker.factId);
    markersByPosition.set(bucket, existing);
  }

  // Create notes for non-equal ops
  for (const op of diffOps) {
    if (op.type === 'equal' || !op.noteId) continue;

    // Find markers near this change
    const opMidpoint = (op.draftStart + op.draftEnd) / 2;
    const nearbyBucket = Math.floor(opMidpoint / 100) * 100;

    // Check surrounding buckets too
    const nearbyFactIds: string[] = [];
    for (let b = nearbyBucket - 200; b <= nearbyBucket + 200; b += 100) {
      const ids = markersByPosition.get(b) || [];
      nearbyFactIds.push(...ids);
    }

    const uniqueFactIds = [...new Set(nearbyFactIds)];

    if (uniqueFactIds.length === 0) {
      // No marker found - this could be an unmarked change
      // For now, skip creating a note (will be flagged as issue)
      continue;
    }

    // Get key facts for these IDs
    const relatedFacts = uniqueFactIds
      .map(id => keyFactMap.get(id))
      .filter((kf): kf is KeyFactCandidate => kf !== undefined);

    if (relatedFacts.length === 0) continue;

    // Build citations from related facts
    const citations: CitationRef[] = [];
    for (const fact of relatedFacts) {
      for (const cite of fact.citations) {
        citations.push({
          url: cite.url,
          tier: cite.tier,
          snippet: cite.quote,
          effectiveOrUpdatedDate: cite.effectiveDate,
        });
      }
    }

    // Determine status based on fact statuses
    const hasNeedsReview = relatedFacts.some(f => f.qaStatus === 'PASS_WITH_REVIEW');
    const status: ChangeNote['status'] = hasNeedsReview ? 'needs_review' : 'applied';

    // Build title and description
    const primaryFact = relatedFacts[0];
    const title = buildChangeTitle(primaryFact, op);
    const description = buildChangeDescription(primaryFact, op);

    notes.push({
      id: op.noteId,
      title,
      description,
      mappedAction: primaryFact.mappedAction,
      anchorMatches: primaryFact.anchorHit,
      affectedRange: { start: op.draftStart, end: op.draftEnd },
      keyFactIds: uniqueFactIds,
      citations,
      status,
    });
  }

  return notes;
}

function buildChangeTitle(fact: KeyFactCandidate, op: DiffOp): string {
  // Extract verb from mapped action
  const actionWords = fact.mappedAction.split(' ');
  const verb = actionWords[0] || 'Update';

  // Find object from anchors
  const object = fact.anchorHit[0] || 'content';

  return `${capitalize(verb)} ${object} requirement`;
}

function buildChangeDescription(fact: KeyFactCandidate, op: DiffOp): string {
  // Keep it to 1-2 sentences
  const factSnippet = fact.factText.length > 100
    ? fact.factText.substring(0, 100) + '...'
    : fact.factText;

  return `Applied state-specific requirement: ${factSnippet}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// MAIN DRAFT GENERATION
// ============================================================================

export async function generateVariantDraft(
  input: VariantDraftInput
): Promise<VariantDraftOutput> {
  const {
    sourceTrackType,
    sourceTitle,
    sourceContent,
    scopeContract,
    validatedKeyFacts,
    qualityGateStatus,
    variantContext,
    contractId,
    extractionId,
  } = input;

  console.log('[VariantDraft] Generating draft for:', sourceTitle, 'state:', variantContext.stateCode);

  // HARD RULE: Block on FAIL status
  if (qualityGateStatus === 'FAIL') {
    console.log('[VariantDraft] Blocked due to FAIL status');
    return {
      draftId: crypto.randomUUID(),
      status: 'blocked',
      trackType: sourceTrackType,
      draftTitle: sourceTitle,
      draftContent: '',
      diffOps: [],
      changeNotes: [],
      appliedKeyFactIds: [],
      needsReviewKeyFactIds: [],
      blockedReasons: [
        'Quality gate status is FAIL. Cannot generate draft with failed key facts.',
        'Review and fix key facts extraction before generating draft.',
      ],
      contractId,
      extractionId,
      stateCode: variantContext.stateCode,
      stateName: variantContext.stateName,
      generatedAtISO: new Date().toISOString(),
    };
  }

  // Filter to only PASS and PASS_WITH_REVIEW facts
  const usableFacts = validatedKeyFacts.filter(
    kf => kf.qaStatus === 'PASS' || kf.qaStatus === 'PASS_WITH_REVIEW'
  );

  if (usableFacts.length === 0) {
    console.log('[VariantDraft] No usable key facts, returning source as-is');
    return {
      draftId: crypto.randomUUID(),
      status: 'generated',
      trackType: sourceTrackType,
      draftTitle: `${sourceTitle} - ${variantContext.stateName || variantContext.stateCode}`,
      draftContent: renderToIntermediate(sourceTrackType, sourceContent),
      diffOps: [],
      changeNotes: [],
      appliedKeyFactIds: [],
      needsReviewKeyFactIds: [],
      contractId,
      extractionId,
      stateCode: variantContext.stateCode,
      stateName: variantContext.stateName,
      generatedAtISO: new Date().toISOString(),
    };
  }

  // Normalize source content
  const normalizedSource = renderToIntermediate(sourceTrackType, sourceContent);

  // Build LLM prompt
  const adaptedInput: VariantDraftInput = {
    ...input,
    sourceContent: normalizedSource,
    validatedKeyFacts: usableFacts,
  };

  const messages = buildDraftGenerationPrompt(adaptedInput);

  let markedDraft: string;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount < maxRetries) {
    try {
      markedDraft = await chatCompletion(messages, {
        temperature: 0.2, // Low temperature for factual adaptation
      });

      // Validate markers
      const markers = extractMarkers(markedDraft);
      const unmarkedChanges = findUnmarkedChanges(normalizedSource, markedDraft);

      if (unmarkedChanges.length > 5) {
        // Too many unmarked changes - likely model didn't follow instructions
        console.log('[VariantDraft] Too many unmarked changes, retrying...');
        retryCount++;
        continue;
      }

      break;
    } catch (error) {
      console.error('[VariantDraft] LLM generation failed:', error);
      retryCount++;
    }
  }

  // @ts-ignore - markedDraft will be assigned in the loop
  if (!markedDraft) {
    return {
      draftId: crypto.randomUUID(),
      status: 'blocked',
      trackType: sourceTrackType,
      draftTitle: sourceTitle,
      draftContent: '',
      diffOps: [],
      changeNotes: [],
      appliedKeyFactIds: [],
      needsReviewKeyFactIds: [],
      blockedReasons: ['Draft generation failed after multiple retries.'],
      contractId,
      extractionId,
      stateCode: variantContext.stateCode,
      stateName: variantContext.stateName,
      generatedAtISO: new Date().toISOString(),
    };
  }

  // Extract markers and build mapping
  const markers = extractMarkers(markedDraft);
  const markerMap = new Map<number, string[]>();
  for (const marker of markers) {
    const bucket = Math.floor(marker.index / 100) * 100;
    const existing = markerMap.get(bucket) || [];
    existing.push(marker.factId);
    markerMap.set(bucket, existing);
  }

  // Remove markers from final draft
  const cleanDraft = removeMarkers(markedDraft);

  // Compute diff ops
  const diffOps = computeDiffOps(normalizedSource, cleanDraft, markerMap);

  // Build change notes
  const changeNotes = buildChangeNotes(diffOps, markedDraft, usableFacts, scopeContract);

  // Determine applied and needs_review fact IDs
  const appliedKeyFactIds: string[] = [];
  const needsReviewKeyFactIds: string[] = [];

  for (const note of changeNotes) {
    for (const factId of note.keyFactIds) {
      const fact = usableFacts.find(f => f.id === factId);
      if (fact) {
        if (fact.qaStatus === 'PASS_WITH_REVIEW') {
          if (!needsReviewKeyFactIds.includes(factId)) {
            needsReviewKeyFactIds.push(factId);
          }
        } else {
          if (!appliedKeyFactIds.includes(factId)) {
            appliedKeyFactIds.push(factId);
          }
        }
      }
    }
  }

  // Determine overall status
  const hasNeedsReview = needsReviewKeyFactIds.length > 0 || qualityGateStatus === 'PASS_WITH_REVIEW';
  const status: DraftStatus = hasNeedsReview ? 'generated_needs_review' : 'generated';

  // Generate title
  const draftTitle = `${sourceTitle} - ${variantContext.stateName || variantContext.stateCode}`;

  console.log('[VariantDraft] Draft generated:', {
    status,
    changeNotes: changeNotes.length,
    appliedFacts: appliedKeyFactIds.length,
    needsReviewFacts: needsReviewKeyFactIds.length,
  });

  return {
    draftId: crypto.randomUUID(),
    status,
    trackType: sourceTrackType,
    draftTitle,
    draftContent: renderFromIntermediate(sourceTrackType, cleanDraft),
    diffOps,
    changeNotes,
    appliedKeyFactIds,
    needsReviewKeyFactIds,
    contractId,
    extractionId,
    stateCode: variantContext.stateCode,
    stateName: variantContext.stateName,
    generatedAtISO: new Date().toISOString(),
  };
}

// ============================================================================
// LIGHTNING BOLT ITERATIVE EDIT
// ============================================================================

export async function applyInstructions(
  input: ApplyInstructionsInput
): Promise<ApplyInstructionsOutput> {
  const {
    draftId,
    instruction,
    currentDraftContent,
    scopeContract,
    validatedKeyFacts,
    stateCode,
    stateName,
  } = input;

  console.log('[VariantDraft] Applying instruction to draft:', draftId);

  // Check if instruction requires new facts
  const blockedChanges: ApplyInstructionsOutput['blockedChanges'] = [];

  // Detect requests that would require new research
  const newFactPatterns = [
    /add.*(?:law|regulation|requirement|statute)/i,
    /include.*(?:penalty|fine|violation)/i,
    /what.*(?:age|limit|requirement)/i,
    /(?:research|find|look up)/i,
  ];

  for (const pattern of newFactPatterns) {
    if (pattern.test(instruction)) {
      // Check if we have a Key Fact that covers this
      const instructionLower = instruction.toLowerCase();
      const hasCoveringFact = validatedKeyFacts.some(kf =>
        kf.factText.toLowerCase().includes(instructionLower.substring(0, 20))
      );

      if (!hasCoveringFact) {
        blockedChanges.push({
          instruction,
          reason: 'This change would require new compliance information not in validated Key Facts.',
          suggestion: 'Run research and key facts extraction again to include this information.',
        });
      }
    }
  }

  // Build edit prompt
  const systemMessage = `You are a training content editor.
Apply the user's instruction to the draft content.

HARD RULES:
- You may rephrase or clarify existing content.
- You may NOT add new compliance claims beyond the provided Key Facts.
- You may NOT add new topics beyond the domain anchors.
- Preserve HTML structure if present.
- Mark any changed sentence with [[KF:<id>]] if it relates to a Key Fact.
- If the instruction cannot be safely applied, return the original content unchanged.

AVAILABLE KEY FACTS:
${validatedKeyFacts.map(kf => `- ${kf.id}: ${kf.factText}`).join('\n')}

DOMAIN ANCHORS (stay within these topics):
${scopeContract.domainAnchors.join(', ')}

DISALLOWED TOPICS:
${scopeContract.disallowedActionClasses.join(', ')}`;

  const userMessage = `INSTRUCTION: ${instruction}

CURRENT DRAFT:
${currentDraftContent}

Apply the instruction. Return the revised content only.
If the instruction cannot be applied safely, return the original unchanged.`;

  try {
    const revisedContent = await chatCompletion(
      [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.3 }
    );

    // Extract markers and clean
    const markers = extractMarkers(revisedContent);
    const cleanContent = removeMarkers(revisedContent);

    // Compute diff from current to new
    const markerMap = new Map<number, string[]>();
    for (const marker of markers) {
      const bucket = Math.floor(marker.index / 100) * 100;
      const existing = markerMap.get(bucket) || [];
      existing.push(marker.factId);
      markerMap.set(bucket, existing);
    }

    const diffOps = computeDiffOps(currentDraftContent, cleanContent, markerMap);
    const changeNotes = buildChangeNotes(diffOps, revisedContent, validatedKeyFacts, scopeContract);

    // Collect applied fact IDs
    const appliedKeyFactIds = [...new Set(changeNotes.flatMap(n => n.keyFactIds))];

    return {
      draftContent: cleanContent,
      diffOps,
      changeNotes,
      blockedChanges,
      appliedKeyFactIds,
    };
  } catch (error) {
    console.error('[VariantDraft] Apply instructions failed:', error);

    return {
      draftContent: currentDraftContent,
      diffOps: [],
      changeNotes: [],
      blockedChanges: [
        {
          instruction,
          reason: `Failed to apply instruction: ${(error as Error).message}`,
        },
      ],
      appliedKeyFactIds: [],
    };
  }
}

// ============================================================================
// LOGGING / PERSISTENCE
// ============================================================================

export interface VariantDraftLog {
  id: string;
  timestamp: string;
  draftOutput: VariantDraftOutput;
}

export function createVariantDraftLog(output: VariantDraftOutput): VariantDraftLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    draftOutput: output,
  };
}
