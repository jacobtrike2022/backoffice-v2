/**
 * Conditional Logic Engine for Trike Forms
 *
 * Data structure stored in form_blocks.conditional_logic (JSONB):
 * {
 *   action: 'show' | 'hide',        // what to do when conditions match
 *   operator: 'AND' | 'OR',         // how multiple conditions combine
 *   conditions: Array<{
 *     source_block_id: string,       // which block's answer triggers this
 *     operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
 *               'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty',
 *     value: string                  // the comparison value
 *   }>
 * }
 *
 * SC only supports single-condition, equals-only logic.
 * Trike supports AND/OR multi-condition with 8 operators — a direct competitive advantage.
 */

export type LogicOperator = 'AND' | 'OR';
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';
export type LogicAction = 'show' | 'hide';

export interface Condition {
  source_block_id: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionalLogic {
  action: LogicAction;
  operator: LogicOperator;
  conditions: Condition[];
}

/**
 * Evaluate a single condition against the current answers.
 */
function evaluateCondition(condition: Condition, answers: Record<string, unknown>): boolean {
  const rawAnswer = answers[condition.source_block_id];
  const answer = rawAnswer === undefined || rawAnswer === null ? '' : String(rawAnswer).toLowerCase().trim();
  const compareValue = condition.value.toLowerCase().trim();

  switch (condition.operator) {
    case 'equals':
      return answer === compareValue;
    case 'not_equals':
      return answer !== compareValue;
    case 'contains':
      return answer.includes(compareValue);
    case 'not_contains':
      return !answer.includes(compareValue);
    case 'greater_than':
      return parseFloat(answer) > parseFloat(compareValue);
    case 'less_than':
      return parseFloat(answer) < parseFloat(compareValue);
    case 'is_empty':
      return answer === '' || rawAnswer === null || rawAnswer === undefined;
    case 'is_not_empty':
      return answer !== '' && rawAnswer !== null && rawAnswer !== undefined;
    default:
      return false;
  }
}

/**
 * Determine whether a block should be visible given the current answers.
 * Returns true if the block should be shown, false if it should be hidden.
 *
 * If conditional_logic is null/undefined/has no conditions, the block is always visible.
 */
export function isBlockVisible(
  conditionalLogic: ConditionalLogic | null | undefined,
  answers: Record<string, unknown>
): boolean {
  if (!conditionalLogic || !conditionalLogic.conditions || conditionalLogic.conditions.length === 0) {
    return true; // No logic = always visible
  }

  const { action, operator, conditions } = conditionalLogic;

  const results = conditions.map((c) => evaluateCondition(c, answers));

  let conditionsMet: boolean;
  if (operator === 'AND') {
    conditionsMet = results.every(Boolean);
  } else {
    // OR
    conditionsMet = results.some(Boolean);
  }

  if (action === 'show') {
    return conditionsMet; // show when conditions met
  } else {
    // action === 'hide'
    return !conditionsMet; // hide when conditions met = show when NOT met
  }
}

/**
 * Filter a list of blocks to only those that should be visible.
 * Used by FormRenderer to skip hidden blocks.
 */
export function getVisibleBlocks<T extends { id: string; conditional_logic?: ConditionalLogic | null }>(
  blocks: T[],
  answers: Record<string, unknown>
): T[] {
  return blocks.filter((block) => isBlockVisible(block.conditional_logic, answers));
}
