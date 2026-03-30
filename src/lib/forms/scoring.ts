/**
 * Form scoring engine.
 * Calculates a score for a form submission based on block scoring_rules.
 */

export interface ScoringRule {
  /** Map of answer value → points awarded. e.g. { "yes": 10, "no": 0 } */
  values?: Record<string, number>;
  /** Fixed points for any non-empty answer */
  points_for_answer?: number;
  /** Maximum possible points for this block */
  max_points?: number;
}

export interface ScoreBreakdown {
  block_id: string;
  label: string;
  earned: number;
  possible: number;
}

export interface ScoreResult {
  total: number;
  maxPossible: number;
  percentage: number | null;
  breakdown: ScoreBreakdown[];
}

export interface ScoredBlock {
  id: string;
  label?: string;
  scoring_rules?: ScoringRule | null;
}

/**
 * Calculate score for a form submission.
 * @param blocks - The form blocks (must include scoring_rules)
 * @param answers - The submitted answers keyed by block ID
 */
export function calculateScore(
  blocks: ScoredBlock[],
  answers: Record<string, unknown>
): ScoreResult {
  let total = 0;
  let maxPossible = 0;
  const breakdown: ScoreBreakdown[] = [];

  for (const block of blocks) {
    if (!block.scoring_rules) continue;

    const rules = block.scoring_rules;
    const answer = answers[block.id];
    const possible = rules.max_points ?? getMaxFromValues(rules.values) ?? 0;

    if (possible === 0) continue; // not a scored block

    let earned = 0;

    if (rules.values && answer !== undefined && answer !== null && answer !== '') {
      const answerKey = String(answer).toLowerCase();
      // Try exact match first, then case-insensitive
      earned = rules.values[String(answer)] ?? rules.values[answerKey] ?? 0;
    } else if (rules.points_for_answer !== undefined && answer !== undefined && answer !== null && answer !== '') {
      earned = rules.points_for_answer;
    }

    // Clamp earned to possible
    earned = Math.min(earned, possible);

    total += earned;
    maxPossible += possible;

    breakdown.push({
      block_id: block.id,
      label: block.label || block.id,
      earned,
      possible,
    });
  }

  const percentage = maxPossible > 0
    ? Math.round((total / maxPossible) * 1000) / 10 // one decimal place
    : null;

  return { total, maxPossible, percentage, breakdown };
}

function getMaxFromValues(values?: Record<string, number>): number | undefined {
  if (!values) return undefined;
  const vals = Object.values(values);
  if (vals.length === 0) return undefined;
  return Math.max(...vals);
}
