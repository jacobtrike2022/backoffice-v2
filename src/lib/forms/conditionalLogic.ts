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
export type LogicAction = 'show' | 'hide' | 'skip_to_section';

export interface Condition {
  source_block_id: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionalLogic {
  action: LogicAction;
  operator: LogicOperator;
  conditions: Condition[];
  target_section_id?: string; // For skip_to_section
}

/**
 * Build a dependency map: for each block ID, which block IDs reference it
 * in their conditional_logic.conditions[].source_block_id.
 */
export function buildBlockDependencyMap<T extends { id: string; conditional_logic?: ConditionalLogic | null }>(
  blocks: T[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const block of blocks) {
    const logic = block.conditional_logic;
    if (!logic?.conditions) continue;
    for (const cond of logic.conditions) {
      if (cond.source_block_id) {
        if (!map[cond.source_block_id]) {
          map[cond.source_block_id] = [];
        }
        map[cond.source_block_id].push(block.id);
      }
    }
  }
  return map;
}

/**
 * Generate a short human-readable summary of a block's conditional logic.
 * E.g. "Show when 'Is area clean?' = Yes"
 */
export function conditionSummaryText<T extends { id: string; label: string; block_type: string }>(
  logic: ConditionalLogic | null | undefined,
  allBlocks: T[],
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (!logic?.conditions?.length) return '';

  const OPERATOR_LABELS: Record<string, string> = {
    equals: '=',
    not_equals: '\u2260',
    contains: '\u2283',
    not_contains: '\u2285',
    greater_than: '>',
    less_than: '<',
    is_empty: t('forms.opIsEmpty'),
    is_not_empty: t('forms.opIsNotEmpty'),
  };

  const actionLabel =
    logic.action === 'show'
      ? t('forms.conditionShow')
      : logic.action === 'hide'
      ? t('forms.conditionHide')
      : t('forms.conditionSkipToSection');

  const condTexts = logic.conditions.map(c => {
    const srcBlock = allBlocks.find(b => b.id === c.source_block_id);
    const srcLabel = srcBlock?.label
      ? `'${srcBlock.label.length > 25 ? srcBlock.label.slice(0, 25) + '\u2026' : srcBlock.label}'`
      : '?';
    const opLabel = OPERATOR_LABELS[c.operator] || c.operator;
    if (c.operator === 'is_empty' || c.operator === 'is_not_empty') {
      return `${srcLabel} ${opLabel}`;
    }
    return `${srcLabel} ${opLabel} ${c.value || '?'}`;
  });

  if (condTexts.length === 1) {
    return `${actionLabel} ${t('forms.conditionSummaryWhen')} ${condTexts[0]}`;
  }

  const joiner = logic.operator === 'AND' ? t('forms.conditionAll') : t('forms.conditionAny');
  return `${actionLabel} ${t('forms.conditionSummaryWhen')} ${joiner}: ${condTexts.join(` ${logic.operator === 'AND' ? '&' : '|'} `)}`;
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
  } else if (action === 'hide') {
    return !conditionsMet; // hide when conditions met = show when NOT met
  } else {
    // skip_to_section — block itself is always visible; section skipping is handled by the renderer
    return true;
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
