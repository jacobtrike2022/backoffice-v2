/**
 * Unified form scoring engine.
 *
 * Supports three scoring modes:
 *   - pass_fail:  1 point per correct answer (default, simplest)
 *   - weighted:   custom point values per block, optional per-answer point maps
 *   - section:    each section scored independently with optional weights & thresholds
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ScoringMode = 'pass_fail' | 'weighted' | 'section';

export interface ScorableBlock {
  id: string;
  section_id?: string | null;
  type: string; // block_type
  label?: string;
  options?: string[];
  validation_rules?: Record<string, unknown> | null;
}

export interface ScoringConfig {
  scoring_mode: ScoringMode;
  pass_threshold: number; // form-wide threshold (0-100)
  sections?: Array<{
    id: string;
    title?: string;
    settings?: Record<string, unknown> | null;
  }>;
}

export interface SectionScore {
  section_id: string;
  section_title: string;
  earned: number;
  possible: number;
  percentage: number;
  passed: boolean;
  threshold: number;
  criticalFail: boolean;
  criticalItems: string[];
}

export interface ScoringResult {
  scoring_mode: ScoringMode;
  score_percentage: number;
  passed: boolean;
  total_weight: number;
  earned_weight: number;
  criticalFail?: boolean;
  criticalItems?: string[];
  /** Present only when scoring_mode === 'section' */
  section_scores?: SectionScore[];
}

// ── Constants ────────────────────────────────────────────────────────────────

export const SCOREABLE_BLOCK_TYPES = [
  'radio',
  'checkboxes',
  'dropdown',
  'yes_no',
  'rating',
  'number',
  'text',
  'textarea',
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compare a user's response to the expected correct answer.
 * Handles type-specific comparison for checkboxes, numbers, ratings, and text.
 */
export function isAnswerCorrect(
  blockType: string,
  response: unknown,
  correctAnswer: string,
): boolean {
  if (blockType === 'checkboxes') {
    const correctSet = correctAnswer
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .sort();
    const responseArr = Array.isArray(response)
      ? (response as string[]).map((s) => String(s).trim().toLowerCase()).sort()
      : [];
    return (
      correctSet.length === responseArr.length &&
      correctSet.every((v, i) => v === responseArr[i])
    );
  }

  if (blockType === 'number' || blockType === 'rating') {
    return String(response) === String(correctAnswer);
  }

  // Default: case-insensitive trimmed string comparison
  return (
    String(response || '')
      .toLowerCase()
      .trim() === correctAnswer.toLowerCase().trim()
  );
}

/**
 * Extract correct answer from a block's validation_rules,
 * supporting both current and legacy formats.
 */
function getCorrectAnswer(vr: Record<string, unknown>): string {
  const legacySettings = (vr._settings as Record<string, unknown>) || {};
  return (
    (vr._correct_answer as string) ||
    (legacySettings.correct_answer as string) ||
    ''
  );
}

// ── Scoring Engine ───────────────────────────────────────────────────────────

interface BlockScore {
  block_id: string;
  section_id: string | null;
  earned: number;
  possible: number;
  isCriticalFail: boolean;
}

/**
 * Score a single block. Returns null if the block is not scoreable.
 */
function scoreBlock(
  block: ScorableBlock,
  answer: unknown,
  mode: ScoringMode,
): BlockScore | null {
  const vr = (block.validation_rules ?? {}) as Record<string, unknown>;
  const correctAnswer = getCorrectAnswer(vr);
  const isCritical = !!(vr._critical);
  const allowNa = !!(vr._allow_na);

  // Block must have a correct answer to be scored
  if (!correctAnswer) return null;

  // If N/A is allowed and the user answered N/A, exclude from scoring
  if (allowNa && String(answer || '').toLowerCase() === 'n/a') return null;

  const correct = isAnswerCorrect(block.type, answer, correctAnswer);

  if (mode === 'weighted') {
    const pointValues = vr._point_values as Record<string, number> | undefined;
    const blockPoints = (vr._points as number) ?? 1;

    // If per-answer point map exists, use it
    if (pointValues && answer !== undefined && answer !== null && answer !== '') {
      const answerKey = String(answer).toLowerCase();
      const earned =
        pointValues[String(answer)] ?? pointValues[answerKey] ?? 0;
      return {
        block_id: block.id,
        section_id: block.section_id ?? null,
        earned: Math.min(earned, blockPoints),
        possible: blockPoints,
        isCriticalFail: isCritical && !correct,
      };
    }

    // Otherwise: full points if correct, 0 if not
    return {
      block_id: block.id,
      section_id: block.section_id ?? null,
      earned: correct ? blockPoints : 0,
      possible: blockPoints,
      isCriticalFail: isCritical && !correct,
    };
  }

  // pass_fail and section modes: 1 point per correct answer
  return {
    block_id: block.id,
    section_id: block.section_id ?? null,
    earned: correct ? 1 : 0,
    possible: 1,
    isCriticalFail: isCritical && !correct,
  };
}

/**
 * Unified scoring calculation. Handles all three modes.
 *
 * @param blocks       All form blocks (will be filtered to scoreable ones)
 * @param answers      Submitted answers keyed by block ID
 * @param config       Form-level scoring configuration
 * @param hiddenBlockIds  Set of block IDs hidden by conditional logic or hidden sections
 */
export function calculateFormScore(
  blocks: ScorableBlock[],
  answers: Record<string, unknown>,
  config: ScoringConfig,
  hiddenBlockIds?: Set<string>,
): ScoringResult {
  const mode = config.scoring_mode || 'pass_fail';
  const scores: BlockScore[] = [];

  for (const block of blocks) {
    // Skip hidden blocks
    if (hiddenBlockIds?.has(block.id)) continue;

    const result = scoreBlock(block, answers[block.id], mode);
    if (result) scores.push(result);
  }

  // Aggregate critical failures
  const criticalItems = scores
    .filter((s) => s.isCriticalFail)
    .map((s) => s.block_id);
  const criticalFail = criticalItems.length > 0;

  // ── Section mode ─────────────────────────────────────────────────────────
  if (mode === 'section' && config.sections && config.sections.length > 0) {
    return calculateSectionScores(scores, config, criticalFail, criticalItems);
  }

  // ── Pass/fail and weighted modes ─────────────────────────────────────────
  const totalWeight = scores.reduce((sum, s) => sum + s.possible, 0);
  const earnedWeight = scores.reduce((sum, s) => sum + s.earned, 0);
  const scorePercentage =
    totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;

  return {
    scoring_mode: mode,
    score_percentage: Math.round(scorePercentage * 100) / 100,
    passed: !criticalFail && scorePercentage >= config.pass_threshold,
    total_weight: totalWeight,
    earned_weight: earnedWeight,
    criticalFail,
    criticalItems,
  };
}

/**
 * Calculate per-section scores and a weighted overall score.
 */
function calculateSectionScores(
  scores: BlockScore[],
  config: ScoringConfig,
  criticalFail: boolean,
  criticalItems: string[],
): ScoringResult {
  const sections = config.sections || [];

  // Group block scores by section
  const bySectionId = new Map<string, BlockScore[]>();
  for (const s of scores) {
    const sid = s.section_id || '__unsectioned__';
    if (!bySectionId.has(sid)) bySectionId.set(sid, []);
    bySectionId.get(sid)!.push(s);
  }

  const sectionScores: SectionScore[] = [];
  let hasExplicitWeights = false;

  for (const section of sections) {
    const sectionBlocks = bySectionId.get(section.id) || [];
    if (sectionBlocks.length === 0) continue; // skip sections with no scored blocks

    const earned = sectionBlocks.reduce((sum, s) => sum + s.earned, 0);
    const possible = sectionBlocks.reduce((sum, s) => sum + s.possible, 0);
    const percentage = possible > 0 ? (earned / possible) * 100 : 0;

    const settings = (section.settings || {}) as Record<string, unknown>;
    const weight = settings.scoring_weight as number | undefined;
    const threshold =
      (settings.scoring_pass_threshold as number) ?? config.pass_threshold;

    if (weight != null && weight > 0) hasExplicitWeights = true;

    const sectionCriticals = sectionBlocks
      .filter((s) => s.isCriticalFail)
      .map((s) => s.block_id);

    sectionScores.push({
      section_id: section.id,
      section_title: section.title || 'Untitled Section',
      earned,
      possible,
      percentage: Math.round(percentage * 100) / 100,
      passed: sectionCriticals.length === 0 && percentage >= threshold,
      threshold,
      criticalFail: sectionCriticals.length > 0,
      criticalItems: sectionCriticals,
    });
  }

  // Handle blocks not assigned to any section
  const unsectioned = bySectionId.get('__unsectioned__');
  if (unsectioned && unsectioned.length > 0) {
    const earned = unsectioned.reduce((sum, s) => sum + s.earned, 0);
    const possible = unsectioned.reduce((sum, s) => sum + s.possible, 0);
    const percentage = possible > 0 ? (earned / possible) * 100 : 0;
    const unsectionedCriticals = unsectioned
      .filter((s) => s.isCriticalFail)
      .map((s) => s.block_id);

    sectionScores.push({
      section_id: '__unsectioned__',
      section_title: 'General',
      earned,
      possible,
      percentage: Math.round(percentage * 100) / 100,
      passed:
        unsectionedCriticals.length === 0 &&
        percentage >= config.pass_threshold,
      threshold: config.pass_threshold,
      criticalFail: unsectionedCriticals.length > 0,
      criticalItems: unsectionedCriticals,
    });
  }

  // Calculate overall score using section weights
  let overallPercentage: number;
  if (hasExplicitWeights) {
    // Weighted average based on explicit section weights
    let weightedSum = 0;
    let totalWeightValue = 0;
    for (const ss of sectionScores) {
      const section = sections.find((s) => s.id === ss.section_id);
      const w =
        (section?.settings as Record<string, unknown>)?.scoring_weight as
          | number
          | undefined;
      const weight = w && w > 0 ? w : 1; // default weight of 1 for unweighted sections
      weightedSum += ss.percentage * weight;
      totalWeightValue += weight;
    }
    overallPercentage =
      totalWeightValue > 0 ? weightedSum / totalWeightValue : 0;
  } else {
    // No explicit weights: overall score = total earned / total possible across all sections
    const totalPossible = sectionScores.reduce((s, ss) => s + ss.possible, 0);
    const totalEarned = sectionScores.reduce((s, ss) => s + ss.earned, 0);
    overallPercentage =
      totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
  }

  const totalWeight = sectionScores.reduce((s, ss) => s + ss.possible, 0);
  const earnedWeight = sectionScores.reduce((s, ss) => s + ss.earned, 0);

  // Overall pass: all sections must pass AND no critical failures
  const allSectionsPassed = sectionScores.every((ss) => ss.passed);

  return {
    scoring_mode: 'section',
    score_percentage: Math.round(overallPercentage * 100) / 100,
    passed: !criticalFail && allSectionsPassed,
    total_weight: totalWeight,
    earned_weight: earnedWeight,
    criticalFail,
    criticalItems,
    section_scores: sectionScores,
  };
}
