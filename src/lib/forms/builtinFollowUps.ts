import type { BlockTemplate } from '../crud/blockGroups';
import { PARENT_PLACEHOLDER } from './blockGroupSerializer';

/**
 * System-level "No Follow-Up" pack.
 *
 * When attached to a yes_no block, these three blocks appear conditionally
 * when the user selects "No":
 *   1. Comments / Details  (textarea, required)
 *   2. Photo Evidence      (photo, optional)
 *   3. Follow-Up Required  (text, optional)
 *
 * All conditional logic references use __PARENT__ which gets resolved to
 * the target yes_no block's ID at insertion time.
 */
export const NO_FOLLOWUP_PACK: BlockTemplate[] = [
  {
    ref_id: 'followup-0',
    block_type: 'textarea',
    label: 'Comments / Details',
    description: 'Explain what was found or observed',
    placeholder: 'Describe the issue...',
    is_required: true,
    conditional_logic: {
      action: 'show' as const,
      operator: 'AND' as const,
      conditions: [{ source_block_id: PARENT_PLACEHOLDER, operator: 'equals', value: 'no' }],
    },
  },
  {
    ref_id: 'followup-1',
    block_type: 'photo',
    label: 'Photo Evidence',
    description: 'Attach photo(s) of the issue',
    is_required: false,
    conditional_logic: {
      action: 'show' as const,
      operator: 'AND' as const,
      conditions: [{ source_block_id: PARENT_PLACEHOLDER, operator: 'equals', value: 'no' }],
    },
  },
  {
    ref_id: 'followup-2',
    block_type: 'text',
    label: 'Follow-Up Required',
    description: 'Note any follow-up actions needed',
    placeholder: 'e.g. Maintenance ticket #, manager name...',
    is_required: false,
    conditional_logic: {
      action: 'show' as const,
      operator: 'AND' as const,
      conditions: [{ source_block_id: PARENT_PLACEHOLDER, operator: 'equals', value: 'no' }],
    },
  },
];

/**
 * Marker stored in block.settings to identify blocks created by the
 * built-in follow-up pack (vs. user-created block groups).
 */
export const FOLLOWUP_PACK_MARKER = '_builtin_followup';

/**
 * Check whether a block was created by the built-in follow-up pack.
 */
export function isFollowUpPackBlock(settings?: Record<string, unknown>): boolean {
  return !!(settings && settings[FOLLOWUP_PACK_MARKER] === true);
}
