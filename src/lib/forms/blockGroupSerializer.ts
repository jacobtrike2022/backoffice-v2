import type { LocalBlock } from '../../hooks/useFormBuilder';
import type { BlockTemplate } from '../crud/blockGroups';
import type { ConditionalLogic } from './conditionalLogic';

/**
 * The sentinel value used in block group templates to indicate
 * "this condition references the parent block that the group
 * will be connected to after insertion."
 */
export const PARENT_PLACEHOLDER = '__PARENT__';

// ============================================================================
// SERIALIZE: selected blocks → group template
// ============================================================================

/**
 * Convert a set of selected LocalBlocks into a reusable BlockTemplate[].
 *
 * Conditional logic references are made relative:
 * - References to other blocks within the selection → replaced with ref_id
 * - References to blocks outside the selection → replaced with __PARENT__
 */
export function serializeBlocksToGroupTemplate(
  selectedBlocks: LocalBlock[],
  _allBlocks: LocalBlock[]
): BlockTemplate[] {
  // Sort by display_order so the template preserves visual ordering
  const sorted = [...selectedBlocks].sort((a, b) => a.display_order - b.display_order);

  // Build old-ID → ref_id map
  const idToRefId = new Map<string, string>();
  sorted.forEach((block, idx) => {
    idToRefId.set(block.id, String(idx));
  });

  return sorted.map((block, idx) => {
    // Remap conditional logic references
    let conditionalLogic: BlockTemplate['conditional_logic'] = null;
    const logic = block.conditional_logic as ConditionalLogic | null;

    if (logic?.conditions?.length) {
      const remappedConditions = logic.conditions.map(cond => {
        const refId = idToRefId.get(cond.source_block_id);
        return {
          source_block_id: refId ?? PARENT_PLACEHOLDER,
          operator: cond.operator,
          value: cond.value,
        };
      });

      conditionalLogic = {
        action: logic.action,
        operator: logic.operator,
        conditions: remappedConditions,
      };
    }

    return {
      ref_id: String(idx),
      block_type: block.block_type,
      label: block.label,
      description: block.description || undefined,
      placeholder: block.placeholder || undefined,
      options: block.options ? [...block.options] : undefined,
      is_required: block.is_required,
      validation_rules: block.validation_rules ? { ...block.validation_rules } : undefined,
      settings: block.settings ? { ...block.settings } : undefined,
      conditional_logic: conditionalLogic,
    };
  });
}

// ============================================================================
// INSTANTIATE: group template → new LocalBlocks ready for insertion
// ============================================================================

/**
 * Expand a BlockTemplate[] into concrete LocalBlock[] with new IDs.
 *
 * - Generates a shared `group_instance_id` for visual grouping.
 * - Resolves intra-group ref_id references to new block IDs.
 * - Keeps __PARENT__ as-is so the UI can detect unbound blocks.
 */
export function instantiateGroupTemplate(
  templates: BlockTemplate[],
  formId: string,
  sectionId: string | null,
  afterBlockId: string | null,
  existingBlocks: LocalBlock[],
  /** When provided, resolves __PARENT__ references to this block ID instead of leaving them unbound. */
  resolveParentToBlockId?: string,
  /** Extra settings to merge into every instantiated block (e.g. follow-up pack marker). */
  extraSettings?: Record<string, unknown>
): LocalBlock[] {
  const groupInstanceId = crypto.randomUUID();

  // Build ref_id → new block ID map
  const refIdToNewId = new Map<string, string>();
  templates.forEach(tmpl => {
    refIdToNewId.set(tmpl.ref_id, `new-${crypto.randomUUID()}`);
  });

  // Compute starting display_order
  let startOrder: number;
  if (afterBlockId) {
    const afterBlock = existingBlocks.find(b => b.id === afterBlockId);
    const afterIdx = existingBlocks.findIndex(b => b.id === afterBlockId);
    const nextBlock = afterIdx !== -1 ? existingBlocks[afterIdx + 1] : undefined;

    if (afterBlock && nextBlock) {
      // Insert between two blocks — space them evenly
      const gap = nextBlock.display_order - afterBlock.display_order;
      startOrder = afterBlock.display_order + gap / (templates.length + 1);
    } else if (afterBlock) {
      startOrder = afterBlock.display_order + 1;
    } else {
      startOrder = existingBlocks.length;
    }
  } else {
    const maxOrder = existingBlocks.reduce((max, b) => Math.max(max, b.display_order), -1);
    startOrder = maxOrder + 1;
  }

  return templates.map((tmpl, idx) => {
    const newId = refIdToNewId.get(tmpl.ref_id)!;

    // Resolve conditional logic references
    let conditionalLogic: unknown = null;
    if (tmpl.conditional_logic?.conditions?.length) {
      const resolvedConditions = tmpl.conditional_logic.conditions.map(cond => {
        if (cond.source_block_id === PARENT_PLACEHOLDER) {
          // Resolve to concrete parent block ID if provided, otherwise keep as __PARENT__
          return {
            source_block_id: resolveParentToBlockId || PARENT_PLACEHOLDER,
            operator: cond.operator,
            value: cond.value,
          };
        }
        // Resolve intra-group ref_id to actual new block ID
        const resolved = refIdToNewId.get(cond.source_block_id);
        return {
          source_block_id: resolved || cond.source_block_id,
          operator: cond.operator,
          value: cond.value,
        };
      });

      conditionalLogic = {
        action: tmpl.conditional_logic.action,
        operator: tmpl.conditional_logic.operator,
        conditions: resolvedConditions,
      };
    }

    return {
      id: newId,
      _isNew: true,
      _isDirty: true,
      form_id: formId,
      section_id: sectionId,
      block_type: tmpl.block_type,
      label: tmpl.label,
      description: tmpl.description,
      placeholder: tmpl.placeholder,
      options: tmpl.options ? [...tmpl.options] : undefined,
      is_required: tmpl.is_required,
      validation_rules: tmpl.validation_rules ? { ...tmpl.validation_rules } : undefined,
      settings: {
        ...(tmpl.settings || {}),
        ...(extraSettings || {}),
        group_instance_id: groupInstanceId,
      },
      conditional_logic: conditionalLogic,
      display_order: startOrder + idx,
    } as LocalBlock;
  });
}

/**
 * Check if a block has unbound __PARENT__ references in its conditional logic.
 */
export function hasUnboundParent(block: LocalBlock): boolean {
  const logic = block.conditional_logic as ConditionalLogic | null;
  if (!logic?.conditions?.length) return false;
  return logic.conditions.some(c => c.source_block_id === PARENT_PLACEHOLDER);
}

/**
 * Get the group_instance_id from a block, checking settings first then _settings fallback.
 */
export function getGroupInstanceId(block: LocalBlock): string | null {
  const fromSettings = (block.settings as Record<string, unknown> | undefined)?.group_instance_id;
  if (typeof fromSettings === 'string') return fromSettings;

  const fromValidation = (block.validation_rules as Record<string, unknown> | undefined)?._settings;
  if (fromValidation && typeof fromValidation === 'object') {
    const gid = (fromValidation as Record<string, unknown>).group_instance_id;
    if (typeof gid === 'string') return gid;
  }

  return null;
}
